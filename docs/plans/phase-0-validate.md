# Phase 0 — Validate the offer (manual, weeks 1–2)

Owner: Harshad. No code. The goal is to prove that audit-led cold email gets
replies **before** paying for the Phase 1b build.

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

## Compliance minimum (DPDP)

- [ ] Privacy notice page live on shwezstudio.in (covers outreach data, source, opt-out)
- [ ] Opt-out line in every email ("Reply 'stop' and I won't email again")
- [ ] Suppression sheet: anyone who opts out goes on it the same day and is never emailed again
- [ ] For each lead, record where the contact came from (source URL) and the date

## Leads

- [ ] Pick 1 segment from the spec's list (suggested: real estate or restaurants, where there are case studies)
- [ ] Write a one-page ICP: who qualifies, who is disqualified, which case study to cite
- [ ] Resolve the lead source (see Open questions in README) and get 50 leads
- [ ] Tracking sheet columns: business, contact, source URL, found date, PSI mobile, top 3 issues, sent date, follow-up dates, reply, class, next step

## Audits (by hand)

- [ ] Run PageSpeed Insights (mobile + desktop) for each lead
- [ ] Check SSL, mobile view, contact form, and whether the site is broken, parked or "under construction"
- [ ] Write 1 headline issue per lead that maps to a measured number

## Sending

- [ ] Email template: under 120 words, opens with the audit finding, one ask, no attachments, plain text, at most one link
- [ ] Ramp: max 15 new emails/day in week 1, 25 in week 2
- [ ] Send only Tue–Thu, 9:30–11:30 or 15:00–17:00 IST
- [ ] Follow-ups on day 3 and day 7, each adding something new (recommended: 42% of replies come from follow-ups, so skipping them undercounts the offer)
- [ ] Watch bounces: stop if bounce rate goes above 3%

## Result

- [ ] 50 sent
- [ ] Classify every reply: interested / not now / referral / OOO / not interested / unsubscribe / bounce
- [ ] Record the result in `README.md` → Gate results
- [ ] Pass → unblock Phase 1b. Fail → rework the offer or segment and run again. Don't start building.
- [ ] Hand the tracking sheet to the build as CSV (it becomes the first test data for the manual import scanner)
