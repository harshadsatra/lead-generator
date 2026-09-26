# Phase 1b — MVP agents and UI (weeks 3–6)

**Blocked until the Phase 0 gate passes** (see README → Gate results).

**Exit test:** 25 approved leads/week, bounce < 2%, admin review < 20 min/day.

Order is chosen so real value arrives early: import Phase 0 leads, audit them,
approve them, and send, before building automated discovery.

## 1. Safety rails (before any agent)

- [ ] LLM wrapper (`apps/worker/src/lib/llm.ts`): AI SDK + Anthropic provider, Zod output schemas, writes an `llm_usage` row per call, refuses a call when the lead's spend would pass ₹5 or the monthly budget is exceeded. Haiku 4.5 for filtering/classifying, Sonnet 5 for analysis/drafting
- [ ] pg-boss setup: queues per agent, retries, `singletonKey` / idempotency keys
- [ ] Suppression check helper (hash email/phone, check domain), used by the Enricher and the Sender
- [ ] Emergency stop flag in `global_config`, checked by the Sender before every send
- [ ] Sentry (free tier) for the worker and admin
- [ ] Tests: cost cap blocks the call; suppressed contact is never returned; emergency stop blocks send

## 2. Scanners

- [ ] `ScannerPlugin` interface (spec § Agent specs 1)
- [ ] Dedupe: match on domain, then phone, then fuzzy name + locality; merge signals into one business; skip businesses active in another campaign
- [ ] **Manual import** plugin: CSV (Phase 0 sheet, Mantis export) + paste URL, stores source URL + scan time
- [ ] **GBP** plugin: Places API by segment + locality grid; cache each grid cell for 30 days. Test on one locality first; confirm cost with Harshad before a full city
- [ ] Tests: dedupe cases; every candidate has source URL + time

## 3. Enricher

- [ ] Waterfall: website contact page/footer (Crawlee) → GBP phone → Hunter.io (only if nothing found) → pattern guess → Reacher verify
- [ ] Only role/published business contacts stored, with `found_via`
- [ ] Owner name from About/team pages when published
- [ ] Test: no email is marked usable unless the verifier says "valid"

## 4. Auditor

- [ ] PSI API mobile + desktop (score, LCP, CLS)
- [ ] SSL, viewport, homepage broken links, contact form present + submit test (no real submit)
- [ ] "No working website": parked, soft 404, under construction, Facebook-only
- [ ] Stack detection with Wappalyzer fingerprints (CMS, Shopify/Woo, WP/jQuery age)
- [ ] Mobile + desktop screenshots (Directus files)
- [ ] Output: 3 headline issues ranked by business impact, each pointing to a stored metric
- [ ] Skip re-audit if the last audit is under 30 days old
- [ ] Test: every issue references a metric key that exists in the audit row

## 5. Analyser

- [ ] LLM extracts facts (intent, size signals) into a Zod schema; score comes from the rubric function (Phase 1a), not the model
- [ ] Plan JSON: recommended service, hook, channel, case study, risks
- [ ] Bands route: <50 → `archived` with reason; else → `awaiting_approval`
- [ ] Test: same stored facts → same score; plan cites ≥ 1 audit finding or signal

## 6. Sales Agent (first touch only; follow-ups are Phase 2)

- [ ] Style guide + banned phrases in `templates`
- [ ] Draft matches the offer (audit PDF / mockup / call only)
- [ ] Checks in code: < 120 words, ≤ 1 link, no attachment, banned phrases absent, identity + address + opt-out present
- [ ] Fact check: every number or claim in the draft exists in the lead record; fail → redraft once, then flag
- [ ] Test: checks reject a bad draft

## 7. Sender (Gmail API)

- [ ] OAuth for the dedicated Workspace mailbox; token stored server-side only
- [ ] **`SEND_MODE=dry_run` by default**; `allowlist` mode sends only to test addresses; `live` needs an explicit env change
- [ ] Caps in code: 40/day per mailbox across all campaigns, ramp 15 → 25 → 40 by week
- [ ] Send windows Tue–Thu 9:30–11:30 / 15:00–17:00 lead time zone, holiday list
- [ ] Idempotency: one `messages` row → at most one Gmail send (check `provider_msg_id` before sending)
- [ ] `List-Unsubscribe` header + one-click opt-out link → public route in admin → suppression
- [ ] Bounce tracking; auto-pause mailbox at > 3% bounce or any complaint
- [ ] Tests: cap enforced across two campaigns; retrying a job doesn't double-send; out-of-window send is deferred

## 8. Admin UI (Nuxt)

- [ ] Directus auth from Nuxt (Directus SDK), role-aware nav
- [ ] **Campaigns**: list, new-campaign form (spec § Campaign inputs; city list first, map picker later), pre-flight (sample scan, lead estimate, mailbox capacity, cost estimate), confirm, then Launch/Pause/Resume/Clone/Archive
- [ ] **Approval inbox**: cards (business, score/band, top finding + screenshot, hook, draft), offer picker (mockup only for hot), Approve / Edit / Reject-with-reason / Snooze, A/E/R shortcuts, mobile-friendly
- [ ] Team + Settings: use Directus Data Studio (no custom screens in phase 1)
- [ ] Check in a browser, desktop and phone width

## 9. Compliance and launch

- [ ] Retention job: delete archived candidates after 90 days
- [ ] Pre-launch self-review checklist as a campaign launch step: provenance stored, opt-out works end to end, privacy notice live, suppression checked
- [ ] End-to-end dry run on the Phase 0 CSV: import → enrich → audit → score → approve → dry-run send
- [ ] Switch to `live` with Harshad's explicit OK; ramp starts at 15/day

## Done when

- [ ] Exit test numbers recorded in README → Gate results
