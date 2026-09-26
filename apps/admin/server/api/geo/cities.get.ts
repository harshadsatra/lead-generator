import { z } from 'zod'
import { searchCitiesByName } from '@countrystatecity/countries'

const Query = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  state: z.string().min(1).max(10),
  q: z.string().trim().max(60).default('')
})

// City / locality suggestions for the campaign area picker.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const p = Query.safeParse(getQuery(event))
  if (!p.success) throw createError({ statusCode: 400, message: 'Invalid query' })
  const cities = await searchCitiesByName(p.data.country, p.data.state, p.data.q)
  const q = p.data.q.toLowerCase()
  return cities
    .map(c => ({ name: c.name, lat: Number(c.latitude), lng: Number(c.longitude) }))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, 25)
})
