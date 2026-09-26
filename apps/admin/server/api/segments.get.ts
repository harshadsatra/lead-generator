export default defineEventHandler(event =>
  directusAsUser<{ id: string, name: string }[]>(event, '/items/le_segments', { query: { fields: 'id,name', sort: 'name', limit: -1 } })
)
