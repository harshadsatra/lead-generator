import { COUNTRY_NAMES } from '@lead/shared'
import { searchPlaces } from '@lead/shared/places'
import { addCandidate, type Outcome } from '../lib/candidates'
import { fetchPage } from '../lib/http'
import { fundingCompany, parseRss, sameCompany } from './news-parse'

export const NEWS_FEEDS = ['https://inc42.com/buzz/feed/', 'https://yourstory.com/feed']
export const NEWS_EVERY_HOURS = 6
const SEEN_KEEP = 500

export interface NewsState { country: string, seen?: string[], last?: string }

// Funding headlines -> company -> Google Maps profile (for website/phone) -> lead with a funding signal.
// Articles are remembered, found or not, so each one costs at most one Places search.
export async function scanNews(campaignId: string, geo: NewsState, log: (msg: string) => void) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set in .env')
  const seen = new Set(geo.seen ?? [])
  const tally: Partial<Record<Outcome | 'notFunding' | 'noMatch' | 'failed', number>> = {}
  const bump = (k: keyof typeof tally) => (tally[k] = (tally[k] ?? 0) + 1)

  for (const feed of NEWS_FEEDS) {
    const page = await fetchPage(feed)
    if (!page.ok) {
      log(`  feed failed ${feed}: ${page.error}`)
      continue
    }
    for (const item of parseRss(page.html)) {
      if (seen.has(item.link)) continue
      seen.add(item.link)
      const company = fundingCompany(item.title)
      if (!company) {
        bump('notFunding')
        continue
      }
      try {
        const { places } = await searchPlaces(key, `${company} ${COUNTRY_NAMES[geo.country] ?? ''}`.trim())
        const p = places.find(x => !x.closed && x.website && sameCompany(company, x.name))
        if (!p) {
          log(`  no Maps match for "${company}"`)
          bump('noMatch')
          continue
        }
        bump(await addCandidate({
          name: p.name, website: p.website, phone: p.phone, city: p.city, locality: p.locality, country: p.country,
          category: p.category, reviews: p.reviews, placeId: p.placeId, sourceUrl: item.link,
          raw: { headline: item.title, published: item.published, company, maps: p.mapsUrl }
        }, { campaignId, country: geo.country, source: 'news', signalType: 'funding', foundAt: item.published ?? new Date().toISOString() }))
      } catch (err) {
        log(`  "${company}": ${(err as Error).message}`)
        bump('failed')
      }
    }
  }
  return { seen: [...seen].slice(-SEEN_KEEP), last: new Date().toISOString(), tally }
}
