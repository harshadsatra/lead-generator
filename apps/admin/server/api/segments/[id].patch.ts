import { z } from 'zod'
import { SEGMENT_FIELDS, SegmentInput } from '#shared/segment'

export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const body = SegmentInput.safeParse(await readBody(event))
  if (!id.success) throw createError({ statusCode: 400, message: 'Invalid segment id' })
  if (!body.success) throw createError({ statusCode: 400, message: body.error.issues[0]?.message ?? 'Invalid segment' })
  return directusAsUser(event, `/items/le_segments/${id.data}`, {
    method: 'PATCH', query: { fields: SEGMENT_FIELDS }, body: body.data
  }).catch(uniqueName)
})
