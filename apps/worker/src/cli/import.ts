// pnpm le:import <file.csv> --campaign "<name>" [--segment "<segment name>"] [--source mantis] [--test]
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'
import { api, one, transition, type Lead } from '../lib/db'
import { csvToObjects } from '../lib/csv'
import { firstEmail, hash, parseCount, mapColumns, normalizePhone, normalizeWebsite } from '../lib/normalize'

const INACTIVE = ['archived', 'rejected', 'closed_no_response', 'closed_lost', 'suppressed']
const ACTOR = 'import'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { campaign: { type: 'string' }, segment: { type: 'string' }, source: { type: 'string', default: 'import' }, test: { type: 'boolean', default: false } }
})
const file = positionals[0]
if (!file || !values.campaign) {
  console.error('Usage: pnpm le:import <file.csv> --campaign "<name>" [--segment "<segment>"] [--source mantis] [--test]')
  process.exit(1)
}

async function campaignId(): Promise<string> {
  const existing = await one<{ id: string, is_test: boolean }>('le_campaigns', { name: { _eq: values.campaign } }, 'id,is_test')
  if (existing) {
    if (existing.is_test !== values.test) throw new Error(`Campaign "${values.campaign}" has is_test=${existing.is_test}; pass ${existing.is_test ? '--test' : 'no --test'}`)
    return existing.id
  }
  if (!values.segment) throw new Error(`Campaign "${values.campaign}" doesn't exist yet; pass --segment "<segment name>" to create it`)
  const segment = await one<{ id: string }>('le_segments', { name: { _eq: values.segment } })
  if (!segment) throw new Error(`Segment "${values.segment}" not found (see Lead Engine → Le Segments in Directus)`)
  const c = await api<{ id: string }>('POST', '/items/le_campaigns', { name: values.campaign, segment_id: segment.id, is_test: values.test, status: 'active', scanners: ['import'] })
  console.log(`Created campaign "${values.campaign}"${values.test ? ' (test)' : ''}`)
  return c.id
}

async function suppressed(email: string | null, phone: string | null, domain: string | null) {
  const or: unknown[] = []
  if (email) or.push({ email_hash: { _eq: hash(email) } })
  if (phone) or.push({ phone_hash: { _eq: hash(phone) } })
  if (domain) or.push({ domain: { _eq: domain } })
  return or.length > 0 && !!(await one('le_suppression', { _or: or }))
}

async function findBusiness(placeId: string | undefined, domain: string | null, phone: string | null, name: string, city: string) {
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

async function main() {
  const rows = csvToObjects(readFileSync(file!, 'utf8'))
  const cols = mapColumns(Object.keys(rows[0] ?? {}))
  if (!cols.name) throw new Error(`No business name column found. Headers: ${Object.keys(rows[0] ?? {}).join(', ')}`)
  console.log(`Columns: ${Object.entries(cols).map(([f, h]) => `${f}←"${h}"`).join(', ')}`)
  const campaign = await campaignId()
  const tally = { imported: 0, merged: 0, skippedDuplicate: 0, skippedOtherCampaign: 0, skippedSuppressed: 0, skippedNoName: 0, skippedWebsiteUrlMissing: 0 }
  const foundAt = new Date().toISOString()

  for (const [i, row] of rows.entries()) {
    const get = (f: keyof typeof cols) => (cols[f] ? row[cols[f]!] : undefined) || undefined
    const name = get('name')
    if (!name) {
      tally.skippedNoName++
      continue
    }
    const site = normalizeWebsite(get('website'))
    // Source says a site exists but gave no URL: auditing would wrongly claim "no website".
    if (!site.url && /^(y|yes|true|1)$/i.test(get('hasWebsite') ?? '')) {
      tally.skippedWebsiteUrlMissing++
      continue
    }
    const phone = normalizePhone(get('phone'))
    const email = firstEmail(get('email'))
    const city = get('city') ?? ''
    if (await suppressed(email, phone, site.domain)) {
      tally.skippedSuppressed++
      continue
    }

    let business = await findBusiness(get('placeId'), site.domain, phone, name, city)
    if (business) {
      const leads = await api<{ campaign_id: string, state: string }[]>('GET', `/items/le_leads?limit=-1&fields=campaign_id,state&filter[business_id][_eq]=${business.id}`)
      if (leads.some(l => l.campaign_id === campaign)) {
        tally.skippedDuplicate++
        continue
      }
      if (leads.some(l => !INACTIVE.includes(l.state))) {
        tally.skippedOtherCampaign++
        continue
      }
      tally.merged++
    } else {
      
      business = await api<{ id: string }>('POST', '/items/le_businesses', {
        name, domain: site.domain, phone, city: city || null, locality: get('locality') ?? null,
        category: get('category') ?? null, gbp_place_id: get('placeId') ?? null,
        review_count: parseCount(get('reviews'))
      })
    }

    const listed = get('sourceUrl')
    const sourceUrl = listed && /^https?:\/\//i.test(listed) ? listed : `file://${basename(file!)}#row${i + 2}`
    await api('POST', '/items/le_signals', {
      business_id: business!.id, source: values.source, source_url: sourceUrl, signal_type: 'import',
      raw: { ...row, _website: site.url, _social_only: site.socialOnly }, found_at: foundAt
    })
    let contactId: string | null = null
    if (email || phone) {
      contactId = (await api<{ id: string }>('POST', '/items/le_contacts', {
        business_id: business!.id, name: get('ownerName') ?? null, email, phone,
        found_via: `import:${values.source}`, source_url: sourceUrl, found_at: foundAt, verified_status: 'unknown'
      })).id
    }
    const lead: Lead = await api<Lead>('POST', '/items/le_leads', {
      business_id: business!.id, campaign_id: campaign, primary_contact_id: contactId, state: 'discovered', channel: 'email',
      events: [{ actor: ACTOR, type: 'created', payload: { source: values.source, source_url: sourceUrl } }]
    })
    await transition(lead, 'enriched', ACTOR, contactId ? 'contact from import (unverified)' : 'no contact in import')
    tally.imported++
  }
  console.log(`\n${rows.length} rows →`, tally)
  if (tally.skippedWebsiteUrlMissing) console.log(`\n${tally.skippedWebsiteUrlMissing} rows say they have a website but the Website column is empty. Re-export with website URLs.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
