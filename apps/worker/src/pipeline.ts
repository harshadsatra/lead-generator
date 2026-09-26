import { scoreLead } from '@lead/shared'
import { api, one, q, transition, type Lead } from './lib/db'
import { isSuppressed } from './lib/candidates'
import { auditSite } from './agents/auditor'
import { route, scoreFacts } from './agents/analyser'
import { findPublishedEmail } from './agents/enricher'
import type { Metrics } from './agents/audit-checks'

const AUDIT_MAX_AGE_DAYS = 30
export const PIPELINE_STATES = ['discovered', 'enriched', 'audited'] as const

export interface Row extends Lead {
  business_id: { id: string, name: string, domain: string | null, review_count: number | null }
  primary_contact_id: { email: string | null, verified_status: string } | null
}
export interface Segment { id: string, service: string | null, case_studies: string | null }
interface AuditRow { metrics: Metrics, issues: { key: string, text: string }[] }

async function enrich(lead: Row) {
  if (lead.primary_contact_id?.email) return transition(lead, 'enriched', 'enricher', 'email from source')
  if (!lead.business_id.domain) return transition(lead, 'enriched', 'enricher', 'no website to look for an email')
  const found = await findPublishedEmail(lead.business_id.domain)
  if (!found) return transition(lead, 'enriched', 'enricher', 'no email published on the site')
  if (await isSuppressed(found.email, null, null)) return transition(lead, 'enriched', 'enricher', 'published email is on the suppression list')
  const contact = await api<{ id: string }>('POST', '/items/le_contacts', {
    business_id: lead.business_id.id, email: found.email, found_via: 'website', source_url: found.url,
    found_at: new Date().toISOString(), verified_status: 'unknown'
  })
  lead.primary_contact_id = { email: found.email, verified_status: 'unknown' }
  return transition(lead, 'enriched', 'enricher', `email published on ${found.url}`, { primary_contact_id: contact.id })
}

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

// discovered → enriched → audited → scored → awaiting_approval | archived. Resumes from any of these states.
export async function processLead(lead: Row, segment: Segment, minReviews: number | null) {
  if (lead.state === 'discovered') await enrich(lead)
  let result: AuditRow | undefined
  if (lead.state === 'enriched') {
    result = await audit(lead)
    await transition(lead, 'audited', 'auditor', result.issues[0]?.text ?? 'no issues found')
  }
  result ??= await latestAudit(lead.business_id.id) ?? await audit(lead)

  const signals = await api<{ found_at: string, signal_type: string | null, raw: { _chain_branch?: string | null } | null }[]>('GET', `/items/le_signals?limit=-1&fields=found_at,signal_type,raw&sort=-found_at&filter=${q({ business_id: { _eq: lead.business_id.id } })}`)
  const { score, band, breakdown } = scoreLead(scoreFacts({
    metrics: result.metrics,
    reviewCount: lead.business_id.review_count,
    segmentHasCaseStudy: !!segment.case_studies,
    contactVerified: lead.primary_contact_id?.verified_status === 'valid',
    signalFoundAt: signals[0]?.found_at ?? null,
    intentSignals: signals.some(s => s.signal_type === 'funding') ? ['funding'] : []
  }))
  const plan = { hook: result.issues[0]?.text ?? null, issues: result.issues, service: segment.service, case_study: segment.case_studies }
  await transition(lead, 'scored', 'analyser', `score ${score}`, { score, band, score_breakdown: breakdown, segment_id: segment.id, plan })
  const next = route(score, band, lead.business_id.review_count, minReviews, signals.find(s => s.raw?._chain_branch)?.raw?._chain_branch ?? null)
  await transition(lead, next.to, 'analyser', next.reason, next.to === 'archived' ? { closed_reason: next.reason } : {})
  return { score, band: next.to === 'archived' ? 'archived' : band }
}

export async function processCampaign(campaign: { id: string, segment_id: Segment | null }, log: (msg: string) => void, concurrency = 3) {
  if (!campaign.segment_id) throw new Error('Campaign has no segment')
  const config = await api<{ min_reviews: number | null }>('GET', '/items/le_global_config?fields=min_reviews')
  const leads = await api<Row[]>('GET', `/items/le_leads?limit=-1&fields=id,state,business_id.id,business_id.name,business_id.domain,business_id.review_count,primary_contact_id.email,primary_contact_id.verified_status&filter=${q({ _and: [{ campaign_id: { _eq: campaign.id } }, { state: { _in: PIPELINE_STATES } }] })}`)
  const queue = [...leads]
  const tally: Record<string, number> = {}
  const run = async () => {
    for (let lead = queue.shift(); lead; lead = queue.shift()) {
      try {
        const { score, band } = await processLead(lead, campaign.segment_id!, config.min_reviews)
        tally[band] = (tally[band] ?? 0) + 1
        log(`  ${band.padEnd(8)} ${String(score).padStart(3)}  ${lead.business_id.name}`)
      } catch (err) {
        tally.failed = (tally.failed ?? 0) + 1
        log(`  FAILED        ${lead.business_id.name}: ${(err as Error).message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, run))
  return { total: leads.length, tally }
}
