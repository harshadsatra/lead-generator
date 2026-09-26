import { SEGMENT_FIELDS, SegmentInput } from '#shared/segment'

export default defineEventHandler(async (event) => {
  const body = SegmentInput.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, message: body.error.issues[0]?.message ?? 'Invalid segment' })
  return directusAsUser<{ id: string, name: string }>(event, '/items/le_segments', {
    method: 'POST', query: { fields: SEGMENT_FIELDS }, body: body.data
  }).catch(uniqueName)
})
