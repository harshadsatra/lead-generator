import { z } from 'zod'

export const VIEWS = {
  awaiting: ['awaiting_approval'],
  to_send: ['approved'],
  sent: ['in_sequence'],
  outcomes: ['handed_to_admin', 'closed_lost', 'closed_no_response', 'suppressed'],
  archived: ['archived', 'rejected']
} as const

const Query = z.object({
  campaign: z.uuid(),
  view: z.enum(Object.keys(VIEWS) as [keyof typeof VIEWS]).default('awaiting')
})

interface LeadRow {
  id: string
  state: string
  channel: string | null
  score: number | null
  band: string | null
  offer: string | null
  closed_reason: string | null
  plan: { hook: string | null, issues: { key: string, text: string }[], service: string | null } | null
  business_id: { id: string, name: string, domain: string | null, gbp_place_id: string | null, city: string | null, category: string | null, review_count: number | null }
  primary_contact_id: { email: string | null, phone: string | null, verified_status: string } | null
  messages: { step: number, status: string, sent_at: string | null, channel: string | null }[]
  replies: { classification: string, received_at: string | null }[]
}
interface AuditRow { business_id: string, psi_mobile: number | null, psi_desktop: number | null, has_ssl: boolean | null, cms: string | null }

export default defineEventHandler(async (event) => {
  const parsed = Query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid campaign or view' })
  const { campaign, view } = parsed.data

  const leads = await directusAsUser<LeadRow[]>(event, '/items/le_leads', { query: {
    fields: 'id,state,channel,score,band,offer,closed_reason,plan,messages.step,messages.status,messages.sent_at,messages.channel,replies.classification,replies.received_at,business_id.id,business_id.name,business_id.domain,business_id.gbp_place_id,business_id.city,business_id.category,business_id.review_count,primary_contact_id.email,primary_contact_id.phone,primary_contact_id.verified_status',
    filter: JSON.stringify({ _and: [{ campaign_id: { _eq: campaign } }, { state: { _in: VIEWS[view] } }] }),
    sort: '-score',
    limit: -1
  } })
  if (leads.length === 0) return []

  const audits = await directusAsUser<AuditRow[]>(event, '/items/le_audits', { query: {
    fields: 'business_id,psi_mobile,psi_desktop,has_ssl,cms',
    filter: JSON.stringify({ business_id: { _in: leads.map(l => l.business_id.id) } }),
    sort: '-run_at',
    limit: -1
  } })
  const latest = new Map<string, AuditRow>()
  for (const a of audits) if (!latest.has(a.business_id)) latest.set(a.business_id, a)

  return leads.map(l => ({ ...l, audit: latest.get(l.business_id.id) ?? null }))
})
