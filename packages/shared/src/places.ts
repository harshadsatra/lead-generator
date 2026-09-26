// Google Places API (New) Text Search. Server-only: needs the API key.
// The field mask decides what Google bills for; keep it to what le_businesses stores.
const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber', 'places.websiteUri',
  'places.rating', 'places.userRatingCount', 'places.primaryTypeDisplayName',
  'places.googleMapsUri', 'places.businessStatus', 'nextPageToken'
].join(',')

export interface Place {
  placeId: string
  name: string
  website: string | null
  phone: string | null
  reviews: number | null
  rating: number | null
  address: string | null
  city: string | null
  locality: string | null
  country: string | null
  category: string | null
  mapsUrl: string | null
  closed: boolean
}

interface RawPlace {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  addressComponents?: { longText?: string, shortText?: string, types?: string[] }[]
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryTypeDisplayName?: { text: string }
  googleMapsUri?: string
  businessStatus?: string
}

export function toPlace(p: RawPlace): Place {
  const part = (...types: string[]) => p.addressComponents?.find(c => types.some(t => c.types?.includes(t)))
  return {
    placeId: p.id,
    name: p.displayName?.text ?? '',
    website: p.websiteUri ?? null,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    reviews: p.userRatingCount ?? null,
    rating: p.rating ?? null,
    address: p.formattedAddress ?? null,
    city: (part('locality', 'postal_town'))?.longText ?? null,
    locality: (part('sublocality', 'sublocality_level_1', 'neighborhood'))?.longText ?? null,
    country: (part('country'))?.shortText ?? null,
    category: p.primaryTypeDisplayName?.text ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    closed: p.businessStatus === 'CLOSED_PERMANENTLY'
  }
}

export interface Bounds { low: { lat: number, lng: number }, high: { lat: number, lng: number } }
// A campaign area: plain text ("Andheri, Maharashtra") or a named map rectangle.
export type Area = string | { name: string, bounds?: Bounds }
export const areaName = (a: Area) => (typeof a === 'string' ? a : a.name)
export const areaBounds = (a: Area) => (typeof a === 'string' ? undefined : a.bounds)

// Text areas search "<query> in <area>"; map areas search <query> restricted to the rectangle.
export const areaSearch = (query: string, a: Area) => (areaBounds(a) ? query : placesQuery(query, areaName(a)))

export async function searchPlaces(apiKey: string, textQuery: string, pageToken?: string, bounds?: Bounds) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      textQuery,
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
      ...(bounds
        ? { locationRestriction: { rectangle: { low: { latitude: bounds.low.lat, longitude: bounds.low.lng }, high: { latitude: bounds.high.lat, longitude: bounds.high.lng } } } }
        : {})
    }),
    signal: AbortSignal.timeout(30_000)
  })
  const json = await res.json() as { places?: RawPlace[], nextPageToken?: string, error?: { message: string } }
  if (!res.ok) throw new Error(`Google Places: ${json.error?.message ?? `HTTP ${res.status}`}`)
  return { places: (json.places ?? []).map(toPlace), nextPageToken: json.nextPageToken ?? null }
}

export const MAX_PAGES_PER_AREA = 3
export const placesQuery = (query: string, area: string) => `${query} in ${area}`
