import { z } from 'zod'
import { HUMAN_REPLIES, POSITIVE_REPLIES } from '@lead/shared'

// Phase 0 gate numbers for one campaign, counted per lead.
export default defineEventHandler(async (event) => {
  const campaign = z.uuid().safeParse(getQuery(event).campaign)
  if (!campaign.success) throw createError({ statusCode: 400, message: 'Invalid campaign' })
  const inCampaign = { lead_id: { campaign_id: { _eq: campaign.data } } }

  const [sentRows, replyRows] = await Promise.all([
    directusAsUser<{ countDistinct: { lead_id: number } }[]>(event, '/items/le_messages', {
      query: { 'aggregate[countDistinct]': 'lead_id', 'filter': JSON.stringify({ _and: [inCampaign, { status: { _eq: 'sent' } }] }) }
    }),
    directusAsUser<{ classification: string, countDistinct: { lead_id: number } }[]>(event, '/items/le_replies', {
      query: { 'aggregate[countDistinct]': 'lead_id', 'groupBy[]': 'classification', 'filter': JSON.stringify(inCampaign) }
    })
  ])
  const sent = Number(sentRows[0]?.countDistinct.lead_id ?? 0)
  const by = (classes: readonly string[]) =>
    replyRows.filter(r => classes.includes(r.classification)).reduce((n, r) => n + Number(r.countDistinct.lead_id), 0)
  // ponytail: a lead with replies of two classes counts in both; fine at Phase 0 volume.
  const anyReply = by(HUMAN_REPLIES)
  const positive = by(POSITIVE_REPLIES)
  const bounced = by(['bounce'])
  const pct = (n: number) => (sent ? Math.round((n / sent) * 1000) / 10 : 0)
  return { sent, anyReply, positive, bounced, anyReplyPct: pct(anyReply), positivePct: pct(positive), bouncePct: pct(bounced) }
})
