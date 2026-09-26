import type { Band, LeadState, Offer, ReplyClass } from './index'
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

// What a logged reply does to the lead. The spec diagram routes every reply via `replied`.
const REPLY_OUTCOME: Record<ReplyClass, { to: LeadState, note: string }> = {
  interested: { to: 'handed_to_admin', note: 'interested: hand to closer' },
  referral: { to: 'handed_to_admin', note: 'referral: closer adds the referred contact as a new lead' },
  later: { to: 'in_sequence', note: 'later: pause follow-ups until the date they gave' },
  out_of_office: { to: 'in_sequence', note: 'out of office: resume after their return date' },
  not_interested: { to: 'closed_lost', note: 'not interested' },
  unsubscribe: { to: 'suppressed', note: 'unsubscribe: suppressed permanently' },
  bounce: { to: 'closed_lost', note: 'bounced: contact marked invalid' }
}

export const POSITIVE_REPLIES: readonly ReplyClass[] = ['interested']
// Auto-replies and bounces aren't a human answering.
export const HUMAN_REPLIES: readonly ReplyClass[] = ['interested', 'referral', 'later', 'not_interested', 'unsubscribe']

export function replyOutcome(state: LeadState, cls: ReplyClass) {
  assertTransition(state, 'replied')
  const o = REPLY_OUTCOME[cls]
  assertTransition('replied', o.to)
  return o
}

export function nextStep(stepsSent: number, maxFollowUps: number) {
  if (stepsSent > maxFollowUps) throw new Error(`Already sent the first email and ${maxFollowUps} follow-ups`)
  return stepsSent
}
