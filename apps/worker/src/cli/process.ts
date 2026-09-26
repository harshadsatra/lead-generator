// pnpm le:process --campaign "<name>" [--concurrency 3]
// Audits and scores every lead in the campaign that is `enriched` or `audited`. Safe to re-run.
import { parseArgs } from 'node:util'
import { scoreLead } from '@lead/shared'
import { api, one, q, transition, type Lead } from '../lib/db'
import { auditSite } from '../agents/auditor'
import { scoreFacts } from '../agents/analyser'
import type { Metrics } from '../agents/audit-checks'

const ACTOR = 'auditor'
const AUDIT_MAX_AGE_DAYS = 30

const { values } = parseArgs({ options: { campaign: { type: 'string' }, concurrency: { type: 'string', default: '3' } } })
if (!values.campaign) {
  console.error('Usage: pnpm le:process --campaign "<name>" [--concurrency 3]')
  process.exit(1)
}

interface Row extends Lead {
  business_id: { id: string, name: string, domain: string | null, review_count: number | null }
  primary_contact_id: { verified_status: string } | null
}
interface Segment { id: string, service: string | null, case_studies: string | null }
interface AuditRow { metrics: Metrics, issues: { key: string, text: string }[] }

async function latestAudit(businessId: string) {
  const since = new Date(Date.now() - AUDIT_MAX_AGE_DAYS * 86_400_000).toISOString()
  return one<AuditRow>('le_audits', { _and: [{ business_id: { _eq: businessId } }, { run_at: { _gte: since } }] }, 'metrics,issues')
}

async function audit(lead: Row): Promise<AuditRow> {
  const cached = await latestAudit(lead.business_id.id)
  if (cached) return cached
  const signal = await one<{ raw: { _social_only?: boolean } | null }>('le_signals', { business_id: { _eq: lead.business_id.id } }, 'raw')
  const { metrics, issues } = await auditSite({ domain: lead.business_id.domain, socialOnly: signal?.raw?._social_only === true })
  await api('POST', '/items/le_audits', {
    business_id: lead.business_id.id,
    psi_mobile: metrics.psiMobile,
    psi_desktop: metrics.psiDesktop,
    lcp_ms: metrics.lcpMs,
    cls: metrics.cls,
    has_ssl: metrics.hasSsl,
    cms: metrics.cms ?? null,
    issues,
    metrics,
    run_at: new Date().toISOString()
  })
  return { metrics, issues }
}

async function processLead(lead: Row, segment: Segment) {
  let result: AuditRow | undefined
  if (lead.state === 'enriched') {
    result = await audit(lead)
    await transition(lead, 'audited', ACTOR, result.issues[0]?.text ?? 'no issues found')
  }
  result ??= await latestAudit(lead.business_id.id) ?? await audit(lead)

  const signal = await one<{ found_at: string }>('le_signals', { business_id: { _eq: lead.business_id.id } }, 'found_at')
  const { score, band, breakdown } = scoreLead(scoreFacts({
    metrics: result.metrics,
    reviewCount: lead.business_id.review_count,
    segmentHasCaseStudy: !!segment.case_studies,
    contactVerified: lead.primary_contact_id?.verified_status === 'valid',
    signalFoundAt: signal?.found_at ?? null
  }))
  const plan = { hook: result.issues[0]?.text ?? null, issues: result.issues, service: segment.service, case_study: segment.case_studies }
  await transition(lead, 'scored', 'analyser', `score ${score}`, { score, band, score_breakdown: breakdown, segment_id: segment.id, plan })
  if (band === 'archived') await transition(lead, 'archived', 'analyser', `score ${score} < 50`, { closed_reason: `score ${score} < 50` })
  else await transition(lead, 'awaiting_approval', 'analyser', `${band} lead, score ${score}`)
  return { score, band }
}

async function main() {
  const campaign = await one<{ id: string, segment_id: Segment | null }>('le_campaigns', { name: { _eq: values.campaign } }, 'id,segment_id.id,segment_id.service,segment_id.case_studies')
  if (!campaign) throw new Error(`Campaign "${values.campaign}" not found`)
  if (!campaign.segment_id) throw new Error(`Campaign "${values.campaign}" has no segment`)
  const leads = await api<Row[]>('GET', `/items/le_leads?limit=-1&fields=id,state,business_id.id,business_id.name,business_id.domain,business_id.review_count,primary_contact_id.verified_status&filter=${q({ _and: [{ campaign_id: { _eq: campaign.id } }, { state: { _in: ['enriched', 'audited'] } }] })}`)
  console.log(`${leads.length} leads to audit/score in "${values.campaign}"${process.env.PAGESPEED_API_KEY ? '' : ' (no PAGESPEED_API_KEY: Google may rate-limit)'}`)

  const queue = [...leads]
  const tally: Record<string, number> = {}
  const worker = async () => {
    for (let lead = queue.shift(); lead; lead = queue.shift()) {
      try {
        const { score, band } = await processLead(lead, campaign.segment_id!)
        tally[band] = (tally[band] ?? 0) + 1
        console.log(`  ${band.padEnd(8)} ${String(score).padStart(3)}  ${lead.business_id.name}`)
      } catch (err) {
        tally.failed = (tally.failed ?? 0) + 1
        console.log(`  FAILED        ${lead.business_id.name}: ${(err as Error).message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Number(values.concurrency)) }, worker))
  console.log('\nDone:', tally)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
