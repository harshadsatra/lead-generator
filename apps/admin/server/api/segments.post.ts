import { z } from 'zod'

const Body = z.object({
  name: z.string().trim().min(3, 'Give the segment a name').max(80),
  service: z.string().trim().max(200).optional(),
  case_studies: z.string().trim().max(500).optional()
})

export default defineEventHandler(async (event) => {
  const body = Body.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, message: body.error.issues[0]?.message ?? 'Invalid segment' })
  try {
    return await directusAsUser<{ id: string, name: string }>(event, '/items/le_segments', {
      method: 'POST',
      query: { fields: 'id,name' },
      body: { name: body.data.name, service: body.data.service || null, case_studies: body.data.case_studies || null }
    })
  } catch (err) {
    if (directusErrorCode(err) === 'RECORD_NOT_UNIQUE') throw createError({ statusCode: 409, message: 'A segment with that name already exists' })
    throw err
  }
})
