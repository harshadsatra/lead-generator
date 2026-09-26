import { z } from 'zod'

const Body = z.object({
  subreddits: z.array(z.string().trim().transform(v => v.replace(/^\/?r\//i, '')).pipe(z.string().regex(/^\w{2,21}$/, 'Subreddit names are letters, numbers and _'))).max(30),
  phrases: z.array(z.string().trim().min(3).max(60)).min(1, 'Add at least one phrase').max(20)
})

// Needs update rights on le_global_config (LE Admin / Directus admin); others get a 403 message.
export default defineEventHandler(async (event) => {
  const body = Body.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, message: body.error.issues[0]?.message ?? 'Invalid watch list' })
  await directusAsUser(event, '/items/le_global_config', { method: 'PATCH', body: { reddit_watch: body.data } })
  return body.data
})
