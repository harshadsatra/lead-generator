// pnpm le:import <file.csv> --country GB --campaign "<name>" [--segment "<segment name>"] [--source mantis] [--test]
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'
import { api, one } from '../lib/db'
import { addCandidate } from '../lib/candidates'
import { csvToObjects } from '../lib/csv'
import { mapColumns, normalizeWebsite, parseCount, SUPPORTED_COUNTRIES } from '../lib/normalize'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { country: { type: 'string' }, campaign: { type: 'string' }, segment: { type: 'string' }, source: { type: 'string', default: 'import' }, test: { type: 'boolean', default: false } }
})
const file = positionals[0]
const countryArg = values.country?.toUpperCase()
if (!file || !values.campaign || !countryArg || !/^[A-Z]{2}$/.test(countryArg)) {
  console.error('Usage: pnpm le:import <file.csv> --country GB --campaign "<name>" [--segment "<segment>"] [--source mantis] [--test]')
  console.error('--country is the ISO code of the leads\' country (GB, IN, US, ...)')
  process.exit(1)
}
const country: string = countryArg
if (!SUPPORTED_COUNTRIES.includes(country)) console.warn(`Note: no phone rules for ${country}; phones are stored as given with a + prefix.`)

async function campaignId(): Promise<string> {
  const existing = await one<{ id: string, is_test: boolean }>('le_campaigns', { name: { _eq: values.campaign } }, 'id,is_test')
  if (existing) {
    if (existing.is_test !== values.test) throw new Error(`Campaign "${values.campaign}" has is_test=${existing.is_test}; pass ${existing.is_test ? '--test' : 'no --test'}`)
    return existing.id
  }
  if (!values.segment) throw new Error(`Campaign "${values.campaign}" doesn't exist yet; pass --segment "<segment name>" to create it`)
  const segment = await one<{ id: string }>('le_segments', { name: { _eq: values.segment } })
  if (!segment) throw new Error(`Segment "${values.segment}" not found (see Lead Engine → Le Segments in Directus)`)
  const c = await api<{ id: string }>('POST', '/items/le_campaigns', { name: values.campaign, segment_id: segment.id, is_test: values.test, status: 'active', scanners: ['import'], geography: { country } })
  console.log(`Created campaign "${values.campaign}"${values.test ? ' (test)' : ''}`)
  return c.id
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
    const listed = get('sourceUrl')
    const outcome = await addCandidate({
      name, website: get('website'), phone: get('phone'), email: get('email'), city: get('city'), locality: get('locality'),
      category: get('category'), reviews: parseCount(get('reviews')), placeId: get('placeId'), ownerName: get('ownerName'),
      sourceUrl: listed && /^https?:\/\//i.test(listed) ? listed : `file://${basename(file!)}#row${i + 2}`,
      raw: row
    }, { campaignId: campaign, country, source: `import:${values.source}`, foundAt })
    tally[outcome]++
  }
  console.log(`\n${rows.length} rows →`, tally, '\nLeads are in "discovered": run pnpm le:process or keep pnpm le:worker running.')
  if (tally.skippedWebsiteUrlMissing) console.log(`\n${tally.skippedWebsiteUrlMissing} rows say they have a website but the Website column is empty. Re-export with website URLs.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
