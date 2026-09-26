import { z } from 'zod'

const Query = z.object({ status: z.enum(['new', 'replied', 'dismissed']).default('new') })

export default defineEventHandler(async (event) => {
  const q = Query.safeParse(getQuery(event))
  if (!q.success) throw createError({ statusCode: 400, message: 'Invalid status' })
  return directusAsUser<{ id: string, url: string, title: string, body: string | null, author: string | null, community: string | null, posted_at: string | null, matched: string | null, status: string }[]>(
    event, '/items/le_posts', {
      query: {
        fields: 'id,url,title,body,author,community,posted_at,matched,status',
        filter: JSON.stringify({ status: { _eq: q.data.status } }),
        sort: '-posted_at',
        limit: 200
      }
    })
})
