import { areaBounds, areaName, areaSearch, MAX_PAGES_PER_AREA, searchPlaces, type Area } from '@lead/shared/places'
import { addCandidate, type Outcome } from '../lib/candidates'

export interface Geography {
  country: string
  query: string
  areas: Area[]
  scanned?: Record<string, string>
}

const RESCAN_AFTER_DAYS = 30

// Google Business Profiles via Places Text Search, one query per area, up to 60 results each.
// ponytail: 30-day cache is per campaign; a shared cache (spec territories) avoids re-buying the same area across campaigns.
export async function scanCampaign(campaignId: string, geo: Geography, log: (msg: string) => void) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set in .env')
  const scanned = { ...geo.scanned }
  const tally: Partial<Record<Outcome | 'closed' | 'noName' | 'failed', number>> = {}
  const bump = (k: keyof typeof tally) => (tally[k] = (tally[k] ?? 0) + 1)
  const fresh = Date.now() - RESCAN_AFTER_DAYS * 86_400_000

  for (const area of geo.areas) {
    const name = areaName(area)
    const search = areaSearch(geo.query, area)
    if (scanned[name] && new Date(scanned[name]).getTime() > fresh) {
      log(`  skip "${name}" (scanned ${scanned[name]!.slice(0, 10)})`)
      continue
    }
    const foundAt = new Date().toISOString()
    let pageToken: string | undefined
    let count = 0
    for (let page = 0; page < MAX_PAGES_PER_AREA; page++) {
      const res = await searchPlaces(key, search, pageToken, areaBounds(area))
      for (const p of res.places) {
        count++
        if (p.closed) {
          bump('closed')
          continue
        }
        if (!p.name) {
          bump('noName')
          continue
        }
        // One bad result must not abort the scan.
        bump(await addCandidate({
          name: p.name, website: p.website, phone: p.phone, city: p.city, locality: p.locality, country: p.country,
          category: p.category, reviews: p.reviews, placeId: p.placeId, sourceUrl: p.mapsUrl ?? `https://www.google.com/maps/place/?q=place_id:${p.placeId}`,
          raw: { ...p, query: search, area: name }
        }, { campaignId, country: geo.country, source: 'gbp', foundAt }).catch((err) => {
          log(`  failed to add "${p.name}": ${(err as Error).message}`)
          return 'failed' as const
        }))
      }
      if (!res.nextPageToken) break
      pageToken = res.nextPageToken
    }
    scanned[name] = foundAt
    log(`  "${name}": ${count} places`)
  }
  return { scanned, tally }
}
