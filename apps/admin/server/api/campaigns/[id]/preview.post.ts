import { z } from 'zod'
import { areaBounds, areaSearch, MAX_PAGES_PER_AREA, searchPlaces, type Area } from '@lead/shared/places'

// Pre-flight: one Places search for the first area, so the owner sees what a full scan would find.
export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, message: 'Invalid campaign id' })
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw createError({ statusCode: 503, message: 'GOOGLE_PLACES_API_KEY is not set' })

  const c = await directusAsUser<{ geography: { query?: string, areas?: Area[] } | null }>(event, `/items/le_campaigns/${id.data}`, { query: { fields: 'geography' } })
  const area = c.geography?.areas?.[0]
  if (!c.geography?.query || !area) throw createError({ statusCode: 409, message: 'Campaign has no search query or areas' })

  let res
  try {
    res = await searchPlaces(key, areaSearch(c.geography.query, area), undefined, areaBounds(area))
  } catch (err) {
    throw createError({ statusCode: 502, message: (err as Error).message })
  }
  const open = res.places.filter(p => !p.closed)
  return {
    query: areaBounds(area) ? `${c.geography.query} (inside the map area)` : areaSearch(c.geography.query, area),
    found: res.places.length,
    morePages: !!res.nextPageToken,
    withWebsite: open.filter(p => p.website).length,
    withoutWebsite: open.filter(p => !p.website).length,
    closed: res.places.length - open.length,
    maxSearches: (c.geography.areas?.length ?? 0) * MAX_PAGES_PER_AREA,
    sample: open.slice(0, 10).map(p => ({ name: p.name, website: p.website, reviews: p.reviews, rating: p.rating }))
  }
})
