import { z } from 'zod'

// Refused while campaigns use it: deleting would clear their segment and stop their pipeline.
export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, message: 'Invalid segment id' })
  const [usage] = await directusAsUser<{ count: number | string }[]>(event, '/items/le_campaigns', {
    query: { 'aggregate[count]': '*', 'filter': JSON.stringify({ segment_id: { _eq: id.data } }) }
  })
  const n = Number(usage?.count ?? 0)
  if (n > 0) throw createError({ statusCode: 409, message: `Used by ${n} campaign${n === 1 ? '' : 's'}; move them to another segment first` })
  await directusAsUser(event, `/items/le_segments/${id.data}`, { method: 'DELETE' })
  return { ok: true }
})
