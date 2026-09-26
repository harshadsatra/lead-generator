export default defineEventHandler(event =>
  directusAsUser<{ id: string, name: string, is_test: boolean, status: string, scanners: string[] | null, date_created: string, geography: { country?: string, areas?: string[] } | null, segment_id: { name: string } | null }[]>(event, '/items/le_campaigns', { query: {
    fields: 'id,name,is_test,status,scanners,date_created,geography,segment_id.name',
    sort: '-date_created',
    limit: -1
  } })
)
