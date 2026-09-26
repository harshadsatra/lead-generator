import { z } from 'zod'

export const LeadState = z.enum([
  'discovered',
  'enriched',
  'audited',
  'scored',
  'archived',
  'awaiting_approval',
  'rejected',
  'approved',
  'in_sequence',
  'replied',
  'handed_to_admin',
  'closed_no_response',
  'closed_lost',
  'suppressed',
])
export type LeadState = z.infer<typeof LeadState>

export const Band = z.enum(['hot', 'warm', 'archived'])
export type Band = z.infer<typeof Band>

export const Offer = z.enum(['audit_pdf', 'mockup', 'call_only'])
export type Offer = z.infer<typeof Offer>

export const Channel = z.enum(['email', 'whatsapp', 'linkedin', 'instagram', 'x', 'reddit'])
export type Channel = z.infer<typeof Channel>

export const ReplyClass = z.enum([
  'interested',
  'later',
  'referral',
  'out_of_office',
  'not_interested',
  'unsubscribe',
  'bounce',
])
export type ReplyClass = z.infer<typeof ReplyClass>

export const Role = z.enum(['admin', 'campaign_manager', 'closer'])
export type Role = z.infer<typeof Role>
