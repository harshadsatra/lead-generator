import { z } from 'zod'
import { ReplyClass, replyOutcome } from '@lead/shared'
import { hash } from '@lead/shared/hash'

const Body = z.object({ classification: ReplyClass, note: z.string().max(5000).optional() })

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = Body.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, message: 'Invalid reply' })
  const { id, lead, sent } = await loadLead(event)
  const { classification, note } = body.data
  const outcome = rule(() => replyOutcome(lead.state, classification))
  const closes = outcome.to !== 'in_sequence'

  await directusAsUser(event, `/items/le_leads/${id}`, {
    method: 'PATCH',
    body: {
      state: outcome.to,
      ...(closes && outcome.to !== 'handed_to_admin' ? { closed_reason: outcome.note } : {}),
      replies: {
        create: [{
          message_id: sent.at(-1)?.id ?? null,
          classification,
          confidence: 1,
          body: note ?? null,
          received_at: new Date().toISOString(),
          actioned: true
        }]
      },
      events: { create: transitionEvents(user.email, [lead.state, 'replied', outcome.to], outcome.note) }
    }
  })

  const contact = lead.primary_contact_id
  if (contact && classification === 'bounce') {
    await directusAsUser(event, `/items/le_contacts/${contact.id}`, { method: 'PATCH', body: { verified_status: 'invalid', verified_at: new Date().toISOString() } })
  }
  if (contact && classification === 'unsubscribe') {
    for (const [field, value] of [['email_hash', contact.email], ['phone_hash', contact.phone]] as const) {
      if (!value) continue
      await directusAsUser(event, '/items/le_suppression', { method: 'POST', body: { [field]: hash(value), reason: 'unsubscribe reply' } })
        .catch((err) => {
          if (directusErrorCode(err) !== 'RECORD_NOT_UNIQUE') throw err
        })
    }
  }
  return { state: outcome.to }
})
