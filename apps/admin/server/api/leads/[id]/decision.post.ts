import { z } from 'zod'
import { decide, Offer, REJECT_REASONS, type Band, type LeadState } from '@lead/shared'

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), offer: Offer }),
  z.object({ action: z.literal('reject'), reason: z.enum(REJECT_REASONS) })
])

export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const body = Body.safeParse(await readBody(event))
  if (!id.success || !body.success) throw createError({ statusCode: 400, message: 'Invalid decision' })
  const { user } = await requireUserSession(event)

  const lead = await directusAsUser<{ state: LeadState, band: Band | null }>(event, `/items/le_leads/${id.data}`, { query: { fields: 'state,band' } })
  let next
  try {
    next = decide(lead, body.data)
  } catch (err) {
    throw createError({ statusCode: 409, message: (err as Error).message })
  }

  await directusAsUser(event, `/items/le_leads/${id.data}`, {
    method: 'PATCH',
    body: {
      ...next.fields,
      state: next.to,
      ...(next.to === 'approved' ? { approved_by: user.id, approved_at: new Date().toISOString() } : {}),
      events: { create: [{ actor: user.email, type: 'transition', payload: { from: lead.state, to: next.to, reason: next.reason } }] }
    }
  })
  return { state: next.to }
})
