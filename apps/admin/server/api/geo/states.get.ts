import { z } from 'zod'
import { getStatesOfCountry } from '@countrystatecity/countries'

// Data: countries-states-cities database (ODbL-1.0), via @countrystatecity/countries.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const country = z.string().regex(/^[A-Z]{2}$/).safeParse(getQuery(event).country)
  if (!country.success) throw createError({ statusCode: 400, message: 'Invalid country' })
  const states = await getStatesOfCountry(country.data)
  return states
    .map(s => ({ code: s.iso2, name: s.name, lat: Number(s.latitude), lng: Number(s.longitude) }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
