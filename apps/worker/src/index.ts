// pnpm le:worker: scans launched campaigns and moves leads through the pipeline.
// ponytail: polls Directus every 30 s; move to pg-boss (spec) when sending/follow-ups need scheduling.
import { api, q } from './lib/db'
import { processCampaign, type Segment } from './pipeline'
import { scanCampaign, type Geography } from './agents/scanner-gbp'

const INTERVAL_MS = 30_000
const log = (msg: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`)

interface Campaign { id: string, name: string, status: string, geography: Geography | null, segment_id: Segment | null }
const FIELDS = 'id,name,status,geography,segment_id.id,segment_id.service,segment_id.case_studies'

async function tick() {
  const toScan = await api<Campaign[]>('GET', `/items/le_campaigns?limit=-1&fields=${FIELDS}&filter=${q({ status: { _eq: 'scan_requested' } })}`)
  for (const c of toScan) {
    log(`scanning "${c.name}"`)
    await api('PATCH', `/items/le_campaigns/${c.id}`, { status: 'scanning' })
    try {
      if (!c.geography?.areas?.length || !c.geography.query) throw new Error('campaign has no search query or areas')
      const { scanned, tally } = await scanCampaign(c.id, c.geography, log)
      await api('PATCH', `/items/le_campaigns/${c.id}`, { status: 'active', geography: { ...c.geography, scanned, error: null } })
      log(`scanned "${c.name}": ${JSON.stringify(tally)}`)
    } catch (err) {
      await api('PATCH', `/items/le_campaigns/${c.id}`, { status: 'scan_failed', geography: { ...c.geography, error: (err as Error).message } })
      log(`scan failed for "${c.name}": ${(err as Error).message}`)
    }
  }

  const active = await api<Campaign[]>('GET', `/items/le_campaigns?limit=-1&fields=${FIELDS}&filter=${q({ status: { _eq: 'active' } })}`)
  for (const c of active) {
    const { total, tally } = await processCampaign(c, log)
    if (total) log(`"${c.name}": ${total} leads → ${JSON.stringify(tally)}`)
  }
}

async function main() {
  log(`worker up; polling every ${INTERVAL_MS / 1000}s${process.env.GOOGLE_PLACES_API_KEY ? '' : ' (GOOGLE_PLACES_API_KEY missing: scans will fail)'}`)
  for (;;) {
    await tick().catch(err => log(`tick failed: ${(err as Error).message}`))
    await new Promise(r => setTimeout(r, INTERVAL_MS))
  }
}

main()
