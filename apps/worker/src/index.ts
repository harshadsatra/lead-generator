// pnpm le:worker: runs scans (Google Maps, startup news, Reddit) and moves leads through the pipeline.
// ponytail: polls Directus every 30 s; move to pg-boss (spec) when sending/follow-ups need scheduling.
import { api, q } from './lib/db'
import { processCampaign, type Segment } from './pipeline'
import type { Area } from '@lead/shared/places'
import { scanCampaign } from './agents/scanner-gbp'
import { NEWS_EVERY_HOURS, scanNews } from './agents/scanner-news'
import { REDDIT_EVERY_MINUTES, scanReddit } from './agents/reddit'

const INTERVAL_MS = 30_000
const log = (msg: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`)

interface Geography {
  country: string
  query?: string
  areas?: Area[]
  scanned?: Record<string, string>
  news?: { seen?: string[], last?: string }
  error?: string | null
}
interface Campaign { id: string, name: string, status: string, scanners: string[] | null, geography: Geography | null, segment_id: Segment | null }
const FIELDS = 'id,name,status,scanners,geography,segment_id.id,segment_id.service,segment_id.case_studies'
const isNews = (c: Campaign) => c.scanners?.includes('news') ?? false

async function runNews(c: Campaign, geo: Geography) {
  const { tally, ...news } = await scanNews(c.id, { country: geo.country, ...geo.news }, log)
  log(`news "${c.name}": ${JSON.stringify(tally)}`)
  return { ...geo, news, error: null }
}

async function scan(c: Campaign) {
  const geo = c.geography
  if (!geo?.country) throw new Error('campaign has no country')
  if (isNews(c)) return runNews(c, geo)
  if (!geo.areas?.length || !geo.query) throw new Error('campaign has no search query or areas')
  const { scanned, tally } = await scanCampaign(c.id, { country: geo.country, query: geo.query, areas: geo.areas, scanned: geo.scanned }, log)
  log(`scanned "${c.name}": ${JSON.stringify(tally)}`)
  return { ...geo, scanned, error: null }
}

let lastReddit = 0

async function tick() {
  const toScan = await api<Campaign[]>('GET', `/items/le_campaigns?limit=-1&fields=${FIELDS}&filter=${q({ status: { _eq: 'scan_requested' } })}`)
  for (const c of toScan) {
    log(`scanning "${c.name}" (${isNews(c) ? 'startup news' : 'Google Maps'})`)
    await api('PATCH', `/items/le_campaigns/${c.id}`, { status: 'scanning' })
    try {
      await api('PATCH', `/items/le_campaigns/${c.id}`, { status: 'active', geography: await scan(c) })
    } catch (err) {
      await api('PATCH', `/items/le_campaigns/${c.id}`, { status: 'scan_failed', geography: { ...c.geography, error: (err as Error).message } })
      log(`scan failed for "${c.name}": ${(err as Error).message}`)
    }
  }

  const active = await api<Campaign[]>('GET', `/items/le_campaigns?limit=-1&fields=${FIELDS}&filter=${q({ status: { _eq: 'active' } })}`)
  for (const c of active) {
    const last = c.geography?.news?.last
    if (isNews(c) && c.geography && (!last || Date.now() - Date.parse(last) > NEWS_EVERY_HOURS * 3_600_000)) {
      await runNews(c, c.geography)
        .then(geography => api('PATCH', `/items/le_campaigns/${c.id}`, { geography }))
        .catch(err => log(`news failed for "${c.name}": ${(err as Error).message}`))
    }
    const { total, tally } = await processCampaign(c, log)
    if (total) log(`"${c.name}": ${total} leads → ${JSON.stringify(tally)}`)
  }

  if (process.env.REDDIT_CLIENT_ID && Date.now() - lastReddit > REDDIT_EVERY_MINUTES * 60_000) {
    lastReddit = Date.now()
    const { added } = await scanReddit(log)
    if (added) log(`reddit: ${added} new posts`)
  }
}

async function main() {
  const missing = ['GOOGLE_PLACES_API_KEY', 'REDDIT_CLIENT_ID'].filter(k => !process.env[k])
  log(`worker up; polling every ${INTERVAL_MS / 1000}s${missing.length ? ` (not set: ${missing.join(', ')})` : ''}`)
  for (;;) {
    await tick().catch(err => log(`tick failed: ${(err as Error).message}`))
    await new Promise(r => setTimeout(r, INTERVAL_MS))
  }
}

main()
