# Phase 2 — Close the loop (weeks 7–9)

**Blocked until the Phase 1 exit test passes.**
**Exit test:** 4 discovery calls booked in a month.

## Reply handling

- [ ] Gmail reply ingest (push notifications or history polling), threads matched to leads
- [ ] Reply Classifier (Haiku 4.5): 7 classes per spec § Agent specs 6, each with its action
- [ ] Confidence < 0.8 → admin queue, never auto-actioned (tested)
- [ ] Referral → new lead in `awaiting_approval`; OOO → pause until return date; later → reminder (default 90 days)
- [ ] Unsubscribe/angry → suppress permanently (tested end to end)

## Sequences

- [ ] Follow-ups at day 3, 7, 14 (from config); each adds new value (audit PDF, case study, mockup link); final "closing the loop"
- [ ] Stop the sequence on any reply; max follow-ups → `closed_no_response`
- [ ] Audit PDF generation (from stored audit + screenshots)

## Closer workflow

- [ ] Telegram bot (grammY) + Resend email alerts to the campaign's closer on a positive reply
- [ ] Escalate to Harshad if unanswered after 4 business hours
- [ ] **Hot replies** screen: suggested reply, reply from the same mailbox thread, Cal.com link
- [ ] **Pipeline board**: kanban by state, lead timeline (signals, audit, messages, replies, events)
- [ ] Closing summary (3–5 lines from events) on every close

## Reporting

- [ ] Weekly digest Monday 9:00 via Resend/Telegram: found, approved, sent, replies, calls, cost, top 3 hooks
- [ ] Offer-per-lead outcomes tracked per segment

## More discovery

- [ ] Reddit scanner (official API)
- [ ] Job boards scanner (RSS/APIs where allowed)
- [ ] Startup news scanner (Inc42, YourStory RSS)
- [ ] Territory monitor: weekly re-scan of saved areas, new businesses only (`territories` table)

## Autonomy and compliance

- [ ] Per-segment auto-send (Gate 2 off) allowed only when the segment has 2%+ positive replies over 100 sends and zero complaints, and the lead scores 80+. Admin toggles it; code enforces the condition
- [ ] Retention: closed leads' personal data deleted after 12 months

## Done when

- [ ] Exit test recorded in README → Gate results
