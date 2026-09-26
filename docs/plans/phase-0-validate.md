# Phase 0 — Validate the offer (manual, weeks 1–2)

Owner: Harshad. The goal is to prove that audit-led outreach gets replies
**before** paying for the rest of the build. The tool now finds, audits and
scores leads and tracks sends and replies; the sending itself is by hand.

**Exit test:** positive reply rate ≥ 2% on 50 sends (at least 1 positive reply).
With only 50 sends, one reply is a weak signal. Also read the tone of every
reply, and write down any "not now" answers.

## Mailbox and domain

- [ ] Decide the cold mailbox address and domain (open item in the spec)
- [ ] Create the dedicated Google Workspace mailbox
- [ ] SPF record published and passing
- [ ] DKIM enabled in Google Admin and passing
- [ ] DMARC record published (start at `p=none` with a `rua` report address)
- [ ] Send a test to mail-tester.com; score ≥ 9/10
- [ ] Mailbox signature: real name, Shwez Studio, postal address, and a link to the privacy notice

## Compliance minimum (DPDP / UK GDPR)

- [ ] Privacy notice page live on shwezstudio.in (covers outreach data, source, opt-out; written so it also works for UK recipients)
- [ ] Opt-out line in every email ("Reply 'stop' and I won't email again")
- [x] Suppression: log an opt-out reply as **Unsubscribe** in the inbox; the email/phone is hashed onto the permanent list and future scans and imports skip it
- [x] Provenance: every lead and contact stores its source URL and date automatically

## Leads

- [ ] Market: README says **UK** (decided 27 Sep), but the first real campaign ("Test 1") is Mumbai. Confirm which market Phase 0 measures; the 2% gate is per market
- [ ] Pick 1 segment (Segments page) and keep it for all 50 sends
- [ ] Write a one-page ICP: who qualifies, who is disqualified, which case study to cite
- [ ] Create real (not test) campaigns in areas with weaker sites (use Preview; prefer neighbourhoods), keep `pnpm le:worker` running
- [ ] Approve about 50 leads that have an email or a phone (best-fit leads often have only a phone → WhatsApp)
- [ ] Track in the inbox: Mark as sent / Log reply per lead; the stats bar shows the gate numbers

## Audits (automated by the worker)

- [ ] Spot-check 2–3 audits against pagespeed.web.dev
- [ ] Approve/reject in the inbox; the **Approved** tab is the send list, and each lead's top issue is the email opener

## Sending

- [ ] Email template: under 120 words, opens with the audit finding, one ask, no attachments, plain text, at most one link
- [ ] WhatsApp: use a separate business number; review the drafted message before sending; low volume
- [ ] Ramp: max 15 new emails/day in week 1, 25 in week 2
- [ ] Send only Tue–Thu, 9:30–11:30 or 15:00–17:00 in the lead's local time (UK: GMT/BST, i.e. 14:00–16:00 / 19:30–21:30 IST while BST applies)
- [ ] Follow-ups on day 3 and day 7, each adding something new (recommended: 42% of replies come from follow-ups, so skipping them undercounts the offer)
- [ ] Watch bounces: stop if bounce rate goes above 3%

## Result

- [ ] 50 sent
- [ ] Classify every reply: interested / not now / referral / OOO / not interested / unsubscribe / bounce
- [ ] Record the result in `README.md` → Gate results
- [ ] Pass → unblock Phase 1b. Fail → rework the offer or segment and run again. Don't start building.
