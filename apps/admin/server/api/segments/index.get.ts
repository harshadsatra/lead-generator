import { SEGMENT_FIELDS } from '#shared/segment'

interface Segment { id: string, name: string, signals: string | null, service: string | null, case_studies: string | null, icp: string | null, min_budget: number | null }

export default defineEventHandler(async (event) => {
  const [segments, usage] = await Promise.all([
    directusAsUser<Segment[]>(event, '/items/le_segments', { query: { fields: SEGMENT_FIELDS, sort: 'name', limit: -1 } }),
    directusAsUser<{ segment_id: string | null, count: number | string }[]>(event, '/items/le_campaigns', {
      query: { 'aggregate[count]': '*', 'groupBy[]': 'segment_id' }
    })
  ])
  const used = new Map(usage.map(u => [u.segment_id, Number(u.count)]))
  return segments.map(s => ({ ...s, campaigns: used.get(s.id) ?? 0 }))
})
