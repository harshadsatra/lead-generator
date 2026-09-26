import { assertTransition } from '@lead/shared'

// Sequence finished with no reply.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { id, lead } = await loadLead(event)
  rule(() => assertTransition(lead.state, 'closed_no_response'))
  await directusAsUser(event, `/items/le_leads/${id}`, {
    method: 'PATCH',
    body: {
      state: 'closed_no_response',
      closed_reason: 'no response',
      events: { create: transitionEvents(user.email, [lead.state, 'closed_no_response'], 'closed: no response') }
    }
  })
  return { state: 'closed_no_response' }
})
