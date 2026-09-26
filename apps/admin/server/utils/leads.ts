import type { H3Event } from 'h3'
import type { LeadState } from '@lead/shared'

export interface LeadForAction {
  state: LeadState
  campaign_id: string
  primary_contact_id: { id: string, email: string | null, phone: string | null } | null
  messages: { id: string, step: number, status: string, sent_at: string | null }[]
}

export async function loadLead(event: H3Event) {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 400, message: 'Invalid lead id' })
  const lead = await directusAsUser<LeadForAction>(event, `/items/le_leads/${id}`, {
    query: { fields: 'state,campaign_id,primary_contact_id.id,primary_contact_id.email,primary_contact_id.phone,messages.id,messages.step,messages.status,messages.sent_at' }
  })
  return { id, lead, sent: lead.messages.filter(m => m.status === 'sent').sort((a, b) => a.step - b.step) }
}

export function transitionEvents(actor: string, path: LeadState[], reason: string) {
  return path.slice(1).map((to, i) => ({ actor, type: 'transition', payload: { from: path[i], to, reason } }))
}

// Turns thrown state-machine / rule errors into a 409 the UI can show.
export function rule<T>(fn: () => T): T {
  try {
    return fn()
  } catch (err) {
    throw createError({ statusCode: 409, message: (err as Error).message })
  }
}
