import type { Band, LeadState, Offer } from './index'
import { assertTransition } from './state'

export const REJECT_REASONS = ['Not a fit', 'Too small', 'Site is already good', 'Competitor or agency', 'Duplicate', 'Other'] as const

export type Decision = { action: 'approve', offer: Offer } | { action: 'reject', reason: string }

// Gate 1: the lead + offer decision. Throws on anything the spec doesn't allow.
export function decide(lead: { state: LeadState, band: Band | null }, d: Decision) {
  if (d.action === 'approve') {
    assertTransition(lead.state, 'approved')
    if (d.offer === 'mockup' && lead.band !== 'hot') throw new Error('The mockup offer is for hot leads only')
    return { to: 'approved' as const, reason: `approved, offer ${d.offer}`, fields: { offer: d.offer } }
  }
  assertTransition(lead.state, 'rejected')
  return { to: 'rejected' as const, reason: `rejected: ${d.reason}`, fields: { closed_reason: `rejected: ${d.reason}` } }
}
