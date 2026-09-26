import { z } from 'zod'

const MOVES = {
  launch: { from: ['draft', 'active', 'paused', 'scan_failed'], to: 'scan_requested' },
  pause: { from: ['active', 'scan_requested'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' }
} as const

export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const body = z.object({ action: z.enum(['launch', 'pause', 'resume']) }).safeParse(await readBody(event))
  if (!id.success || !body.success) throw createError({ statusCode: 400, message: 'Invalid request' })
  const move = MOVES[body.data.action]
  const c = await directusAsUser<{ status: string }>(event, `/items/le_campaigns/${id.data}`, { query: { fields: 'status' } })
  if (!(move.from as readonly string[]).includes(c.status)) {
    throw createError({ statusCode: 409, message: `Can't ${body.data.action} a campaign that is ${c.status.replace('_', ' ')}` })
  }
  await directusAsUser(event, `/items/le_campaigns/${id.data}`, { method: 'PATCH', body: { status: move.to } })
  return { status: move.to }
})
