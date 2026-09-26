import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const body = z.object({ status: z.enum(['new', 'replied', 'dismissed']) }).safeParse(await readBody(event))
  if (!id.success || !body.success) throw createError({ statusCode: 400, message: 'Invalid request' })
  await directusAsUser(event, `/items/le_posts/${id.data}`, { method: 'PATCH', body: body.data })
  return body.data
})
