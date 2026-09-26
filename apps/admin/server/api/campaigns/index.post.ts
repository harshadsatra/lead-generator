import { z } from 'zod'
import { CampaignInput } from '#shared/campaign'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = CampaignInput.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, message: z.prettifyError(body.error) })
  const { name, segment_id, country, query, areas, is_test } = body.data
  return directusAsUser<{ id: string }>(event, '/items/le_campaigns', {
    method: 'POST',
    query: { fields: 'id' },
    body: { name, segment_id, is_test, status: 'draft', scanners: ['gbp'], owner_id: user.id, geography: { country, query, areas } }
  })
})
