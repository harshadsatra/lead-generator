import { z } from 'zod'

interface CampaignRow {
  id: string
  name: string
  status: string
  scanners: string[] | null
  is_test: boolean
  date_created: string
  segment_id: { name: string } | null
  geography: { country?: string, query?: string, areas?: string[], scanned?: Record<string, string>, news?: { seen?: string[], last?: string }, error?: string | null } | null
}

export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, message: 'Invalid campaign id' })
  const [campaign, counts] = await Promise.all([
    directusAsUser<CampaignRow>(event, `/items/le_campaigns/${id.data}`, {
      query: { fields: 'id,name,status,scanners,is_test,date_created,geography,segment_id.name' }
    }),
    directusAsUser<{ state: string, count: number | string }[]>(event, '/items/le_leads', {
      query: { 'aggregate[count]': '*', 'groupBy[]': 'state', 'filter': JSON.stringify({ campaign_id: { _eq: id.data } }) }
    })
  ])
  return { ...campaign, counts: Object.fromEntries(counts.map(c => [c.state, Number(c.count)])) as Record<string, number> }
})
