import { z } from 'zod'
import { nextStep } from '@lead/shared'

const Body = z.object({ channel: z.enum(['email', 'whatsapp']).default('email') })

// Phase 0: the message was sent by hand (email or WhatsApp); record it as the first touch or the next follow-up.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = Body.safeParse((await readBody(event)) ?? {})
  if (!body.success) throw createError({ statusCode: 400, message: 'Invalid channel' })
  const { channel } = body.data
  const { id, lead, sent } = await loadLead(event)
  if (lead.state !== 'approved' && lead.state !== 'in_sequence') {
    throw createError({ statusCode: 409, message: `Can't record a send for a lead that is ${lead.state}` })
  }
  const config = await directusAsUser<{ max_follow_ups: number | null }>(event, '/items/le_global_config', { query: { fields: 'max_follow_ups' } })
  const step = rule(() => nextStep(sent.length, config.max_follow_ups ?? 3))
  const now = new Date().toISOString()
  const label = channel === 'whatsapp' ? 'WhatsApp' : 'email'

  await directusAsUser(event, `/items/le_leads/${id}`, {
    method: 'PATCH',
    body: {
      ...(lead.state === 'approved' ? { state: 'in_sequence', channel } : {}),
      messages: { create: [{ step, channel, status: 'sent', sent_at: now }] },
      events: {
        create: lead.state === 'approved'
          ? transitionEvents(user.email, ['approved', 'in_sequence'], `first ${label} sent by hand`)
          : [{ actor: user.email, type: 'message_sent', payload: { step, channel, reason: `follow-up ${step} sent by hand on ${label}` } }]
      }
    }
  })
  return { step, channel }
})
