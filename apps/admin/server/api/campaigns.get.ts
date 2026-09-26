export default defineEventHandler(event =>
  directusAsUser<{ id: string, name: string, is_test: boolean, status: string }[]>(event, '/items/le_campaigns', { query: {
    fields: 'id,name,is_test,status',
    sort: '-date_created',
    limit: -1
  } })
)
