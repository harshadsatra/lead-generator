import { z } from 'zod'

const Query = z.object({
  campaign: z.uuid(),
  state: z.enum(['awaiting_approval', 'archived']).default('awaiting_approval')
})

interface LeadRow {
  id: string
  score: number | null
  band: string | null
  closed_reason: string | null
  plan: { hook: string | null, issues: { key: string, text: string }[], service: string | null } | null
  business_id: { id: string, name: string, domain: string | null, city: string | null, category: string | null, review_count: number | null }
  primary_contact_id: { email: string | null, phone: string | null, verified_status: string } | null
}
interface AuditRow { business_id: string, psi_mobile: number | null, psi_desktop: number | null, has_ssl: boolean | null, cms: string | null }

export default defineEventHandler(async (event) => {
  const parsed = Query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid campaign or state' })
  const { campaign, state } = parsed.data

  const leads = await directusAsUser<LeadRow[]>(event, '/items/le_leads', {
    fields: 'id,score,band,closed_reason,plan,business_id.id,business_id.name,business_id.domain,business_id.city,business_id.category,business_id.review_count,primary_contact_id.email,primary_contact_id.phone,primary_contact_id.verified_status',
    filter: JSON.stringify({ _and: [{ campaign_id: { _eq: campaign } }, { state: { _eq: state } }] }),
    sort: '-score',
    limit: -1
  })
  if (leads.length === 0) return []

  const audits = await directusAsUser<AuditRow[]>(event, '/items/le_audits', {
    fields: 'business_id,psi_mobile,psi_desktop,has_ssl,cms',
    filter: JSON.stringify({ business_id: { _in: leads.map(l => l.business_id.id) } }),
    sort: '-run_at',
    limit: -1
  })
  const latest = new Map<string, AuditRow>()
  for (const a of audits) if (!latest.has(a.business_id)) latest.set(a.business_id, a)

  return leads.map(l => ({ ...l, audit: latest.get(l.business_id.id) ?? null }))
})
