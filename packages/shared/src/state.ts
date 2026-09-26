import type { LeadState } from './index'

// Mirrors the spec's "Lead state machine" diagram. Change the spec first, then this.
export const TRANSITIONS: Record<LeadState, readonly LeadState[]> = {
  discovered: ['enriched'],
  enriched: ['audited'],
  audited: ['scored'],
  scored: ['archived', 'awaiting_approval'],
  awaiting_approval: ['rejected', 'approved'],
  approved: ['in_sequence'],
  in_sequence: ['replied', 'closed_no_response'],
  replied: ['handed_to_admin', 'in_sequence', 'closed_lost', 'suppressed'],
  archived: [],
  rejected: [],
  handed_to_admin: [],
  closed_no_response: [],
  closed_lost: [],
  suppressed: [],
}

export function canTransition(from: LeadState, to: LeadState): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: LeadState, to: LeadState): void {
  if (!canTransition(from, to)) throw new Error(`Illegal lead transition ${from} -> ${to}`)
}
