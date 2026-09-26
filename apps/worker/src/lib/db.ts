import { assertTransition, type LeadState } from '@lead/shared'
import { directus, q } from '@lead/shared/directus'

export const api = directus(process.env.DIRECTUS_TOKEN)
export { q }

export interface Lead {
  id: string
  state: LeadState
}

// State change + event row in one request (Directus nested writes are transactional).
// ponytail: no compare-and-set on state; add a filtered batch update once parallel jobs run.
export async function transition(lead: Lead, to: LeadState, actor: string, reason?: string, fields: Record<string, unknown> = {}) {
  assertTransition(lead.state, to)
  await api('PATCH', `/items/le_leads/${lead.id}`, {
    ...fields,
    state: to,
    events: { create: [{ actor, type: 'transition', payload: { from: lead.state, to, reason: reason ?? null } }] }
  })
  lead.state = to
}

export async function one<T>(collection: string, filter: unknown, fields = 'id'): Promise<T | undefined> {
  return (await api<T[]>('GET', `/items/${collection}?limit=1&fields=${fields}&filter=${q(filter)}`))[0]
}
