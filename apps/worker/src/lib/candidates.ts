import { api, one } from './db'
import { firstEmail, hash, normalizePhone, normalizeWebsite } from './normalize'

const INACTIVE = ['archived', 'rejected', 'closed_no_response', 'closed_lost', 'suppressed']

export interface Candidate {
  name: string
  website?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  locality?: string | null
  country?: string | null
  category?: string | null
  reviews: number | null
  placeId?: string | null
  ownerName?: string | null
  sourceUrl: string
  raw: Record<string, unknown>
}

export interface CandidateContext {
  campaignId: string
  country: string
  source: string
  foundAt: string
}

export type Outcome = 'imported' | 'merged' | 'skippedDuplicate' | 'skippedOtherCampaign' | 'skippedSuppressed'

export async function isSuppressed(email: string | null, phone: string | null, domain: string | null) {
  const or: unknown[] = []
  if (email) or.push({ email_hash: { _eq: hash(email) } })
  if (phone) or.push({ phone_hash: { _eq: hash(phone) } })
  if (domain) or.push({ domain: { _eq: domain } })
  return or.length > 0 && !!(await one('le_suppression', { _or: or }))
}

async function findBusiness(placeId: string | null | undefined, domain: string | null, phone: string | null, name: string, city: string | null | undefined) {
  if (placeId) {
    const b = await one<{ id: string }>('le_businesses', { gbp_place_id: { _eq: placeId } })
    if (b) return b
  }
  if (domain) {
    const b = await one<{ id: string }>('le_businesses', { domain: { _eq: domain } })
    if (b) return b
  }
  if (phone) {
    const b = await one<{ id: string }>('le_businesses', { phone: { _eq: phone } })
    if (b) return b
  }
  // ponytail: exact name+city match; add fuzzy matching when scanners from several sources overlap
  if (city) return one<{ id: string }>('le_businesses', { _and: [{ name: { _eq: name } }, { city: { _eq: city } }] })
}

// Dedupe + suppression + provenance, then a new lead in `discovered` for the Enricher.
export async function addCandidate(c: Candidate, ctx: CandidateContext): Promise<Outcome> {
  const country = c.country ?? ctx.country
  const site = normalizeWebsite(c.website ?? undefined)
  const phone = normalizePhone(c.phone ?? undefined, country)
  const email = firstEmail(c.email ?? undefined)
  if (await isSuppressed(email, phone, site.domain)) return 'skippedSuppressed'

  let business = await findBusiness(c.placeId, site.domain, phone, c.name, c.city)
  let outcome: Outcome = 'imported'
  if (business) {
    const leads = await api<{ campaign_id: string, state: string }[]>('GET', `/items/le_leads?limit=-1&fields=campaign_id,state&filter[business_id][_eq]=${business.id}`)
    if (leads.some(l => l.campaign_id === ctx.campaignId)) return 'skippedDuplicate'
    if (leads.some(l => !INACTIVE.includes(l.state))) return 'skippedOtherCampaign'
    outcome = 'merged'
  } else {
    business = await api<{ id: string }>('POST', '/items/le_businesses', {
      name: c.name, domain: site.domain, phone, city: c.city || null, country, locality: c.locality ?? null,
      category: c.category ?? null, gbp_place_id: c.placeId ?? null, review_count: c.reviews
    })
  }

  await api('POST', '/items/le_signals', {
    business_id: business!.id, source: ctx.source, source_url: c.sourceUrl, signal_type: ctx.source,
    raw: { ...c.raw, _website: site.url, _social_only: site.socialOnly }, found_at: ctx.foundAt
  })
  let contactId: string | null = null
  if (email || phone) {
    contactId = (await api<{ id: string }>('POST', '/items/le_contacts', {
      business_id: business!.id, name: c.ownerName ?? null, email, phone,
      found_via: ctx.source, source_url: c.sourceUrl, found_at: ctx.foundAt, verified_status: 'unknown'
    })).id
  }
  await api('POST', '/items/le_leads', {
    business_id: business!.id, campaign_id: ctx.campaignId, primary_contact_id: contactId, state: 'discovered', channel: 'email',
    events: [{ actor: ctx.source, type: 'created', payload: { source: ctx.source, source_url: c.sourceUrl } }]
  })
  return outcome
}
