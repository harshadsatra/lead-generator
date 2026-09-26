import { nextStep } from '@lead/shared'

// Phase 0: the email was sent by hand; record it (first email or the next follow-up).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { id, lead, sent } = await loadLead(event)
  if (lead.state !== 'approved' && lead.state !== 'in_sequence') {
    throw createError({ statusCode: 409, message: `Can't record a send for a lead that is ${lead.state}` })
  }
  const config = await directusAsUser<{ max_follow_ups: number | null }>(event, '/items/le_global_config', { query: { fields: 'max_follow_ups' } })
  const step = rule(() => nextStep(sent.length, config.max_follow_ups ?? 3))
  const now = new Date().toISOString()

  await directusAsUser(event, `/items/le_leads/${id}`, {
    method: 'PATCH',
    body: {
      ...(lead.state === 'approved' ? { state: 'in_sequence' } : {}),
      messages: { create: [{ step, channel: 'email', status: 'sent', sent_at: now }] },
      events: {
        create: lead.state === 'approved'
          ? transitionEvents(user.email, ['approved', 'in_sequence'], 'first email sent by hand')
          : [{ actor: user.email, type: 'message_sent', payload: { step, reason: `follow-up ${step} sent by hand` } }]
      }
    }
  })
  return { step }
})
