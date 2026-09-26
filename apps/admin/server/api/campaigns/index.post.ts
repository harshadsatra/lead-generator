import { CampaignInput } from '#shared/campaign'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = CampaignInput.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, message: body.error.issues.map(i => i.message).join('; ') })
  const { name, source, segment_id, country, query, areas, is_test } = body.data
  return directusAsUser<{ id: string }>(event, '/items/le_campaigns', {
    method: 'POST',
    query: { fields: 'id' },
    body: {
      name, segment_id, is_test, status: 'draft', scanners: [source], owner_id: user.id,
      geography: source === 'gbp' ? { country, query, areas } : { country }
    }
  })
})
