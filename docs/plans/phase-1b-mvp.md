# Phase 1b — MVP agents and UI (weeks 3–6)

§0 (the Phase 0 helper) and the extra items listed in README → Decisions were
approved to run before the gate. **Everything else here stays blocked until the
Phase 0 gate passes** (see README → Gate results).

**Exit test:** 25 approved leads/week, bounce < 2%, admin review < 20 min/day.

Verified 27 Sep 2026: `pnpm test` (38 tests), `pnpm typecheck`, `pnpm lint` all clean;
`pnpm le:setup` reports 0 pending writes; no test data left.

## 0. Phase 0 helper (built before the gate; no LLM, no automated sending)

Discovery, audit, scoring and manual outreach tracking, so Harshad can run the
50 Phase 0 sends from the tool. The worker is a 30 s polling loop, not pg-boss yet.

- [x] Worker Directus client (`LE Worker` token) + `transition()`: one PATCH on `le_leads` with a nested `events` create
- [x] CSV import: `pnpm le:import <file.csv> --country GB --campaign "<name>" [--segment "<segment>"] [--test]`. Tolerant headers; skips rows that say "has website" but give no URL; leads land in `discovered` for the worker
- [x] Shared `addCandidate()` (import, Maps, news): dedupe on place id → domain → phone → exact name+city; skip businesses active in another campaign; suppression check; provenance (source, source_url, found_at); E.164 phones per country
- [x] Google Places scanner: Text Search per area, 3 pages (≤ 60), 30-day per-campaign skip, closed businesses dropped, one bad result doesn't abort the scan; areas are text or map rectangles (`locationRestriction`)
- [x] Enricher v0: email the business publishes on its own site (homepage, then up to 2 contact/about pages, contact pages first); provenance URL stored; suppression checked. No Hunter / verification yet
- [x] Auditor v0: PSI mobile + desktop (score, LCP, CLS), SSL, viewport, contact form, CMS (WordPress + version, WooCommerce, Shopify, Wix, Squarespace, Webflow, Joomla), no working site (parked, placeholder, default page, soft 404); top 3 issues each tied to a metric key; 30-day audit reuse
- [x] Auditor safety: browser user agent; a site is only "broken" if Google's Lighthouse can't load it either; 401/403/429 = blocked, never broken; PageSpeed quota/network errors leave the lead for retry
- [x] Scoring: rubric from audit + review count + funding signal; routes to `awaiting_approval` or `archived` with reason (score < 50, too small < `min_reviews`, chain branch page)
- [x] `pnpm le:worker`: scans launched campaigns, runs discovered → enriched → audited → scored → awaiting/archived; `pnpm le:process` for one-off runs
- [x] Admin inbox: Awaiting → To send → Sent → Outcomes → Archived; Approve with offer (mockup only for hot, server-enforced), Reject with reason; Mark as sent (first + up to `max_follow_ups`, channel recorded); Log reply (7 classes; unsubscribe → hashed suppression, bounce → contact invalid); Close no-response; stats bar with the 2% gate
- [x] Lead cards: website, Google profile link, PSI, HTTPS, CMS, top issues, contact; assisted WhatsApp button (wa.me with drafted message incl. STOP opt-out) for leads with a phone
- [x] Campaigns: list, New campaign (source Google Maps / Startup news, segment, country, query, areas via region → city suggestions or map rectangle, test flag), Preview (1 Places search), Launch / Scan again, Pause / Resume, per-stage counts
- [x] Segments page: create, edit, delete (refused while campaigns use it)
- [ ] Harshad test: a real campaign end to end; spot-check 2–3 audits against pagespeed.web.dev; click through every tab and button in a browser, desktop and phone width

Deferred until the gate: screenshots (Playwright), Wappalyzer, Hunter + Reacher, LLM agents, Gmail sending.

## Prep (do when the job queue or deploy is next; Harshad: "after multiple tests")

- [ ] Server audit (read-only), results into `infra/SERVER.md`: `nproc && free -h && df -h`; `docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'`; Postgres container/version and network behind cms.shwezstudio.in; reverse proxy; outbound port 25 (`nc -vz -w 5 gmail-smtp-in.l.google.com 25`); existing Postgres backups
- [ ] With Harshad's OK: `lead_queue` database + its own DB user on the Directus Postgres; SSH tunnel command for local dev in CLAUDE.md
- [ ] Confirm the Directus licence covers this use (BSL / Open Innovation Grant)
- [ ] `infra/docker-compose.yml`: worker, reacher, admin (Directus/Postgres already run); admin subdomain + reverse proxy (ask Harshad for the name); `NUXT_GOOGLE_*`/`NUXT_PUBLIC_*` env in production
- [ ] Backups include `le_*` tables and `lead_queue`, plus one restore test
- [ ] If RAM < 8 GB: Playwright concurrency 1 and a VPS upgrade checkpoint

## 1. Safety rails (before any agent)

- [ ] LLM wrapper (`apps/worker/src/lib/llm.ts`): AI SDK + Anthropic provider, Zod output schemas, writes an `llm_usage` row per call, refuses a call when the lead's spend would pass ₹5 or the monthly budget is exceeded. Haiku 4.5 for filtering/classifying, Sonnet 5 for analysis/drafting
- [ ] pg-boss setup: queues per agent, retries, `singletonKey` / idempotency keys (replaces the polling loop)
- [x] Suppression check helper (`isSuppressed`: hashed email/phone, domain), used by import, scans and the Enricher; the Sender must use it too
- [ ] Emergency stop: flag exists in `le_global_config`; the Sender must check it before every send
- [ ] Sentry (free tier) for the worker and admin
- [ ] Tests: cost cap blocks the call; suppressed contact is never returned; emergency stop blocks send

## 2. Scanners

- [ ] `ScannerPlugin` interface (spec § Agent specs 1): today scanners are plain functions sharing `addCandidate()`; formalise when a 4th source arrives
- [ ] Fuzzy name + locality matching in dedupe (exact match today)
- [x] **Manual import**: CSV (own sheet, Mantis/LeadSweep exports) with source URL + scan time. Paste-a-URL not built
- [x] **GBP**: Places by campaign query + area (text or map rectangle), 30-day skip per campaign. A shared cross-campaign cache (spec "grid cell") is not built
- [ ] Tests: dedupe cases (`addCandidate` is only covered by live end-to-end runs, no unit test)

## 3. Enricher

- [ ] Waterfall: ~~Crawlee~~ website contact page/footer (done with plain fetch) → GBP phone (done) → Hunter.io (only if nothing found) → pattern guess → Reacher verify
- [x] Only published business contacts stored, with `found_via` and `source_url`
- [ ] Owner name from About/team pages when published
- [ ] Test: no email is marked usable unless the verifier says "valid" (all emails are `unknown` today)

## 4. Auditor

- [x] PSI API mobile + desktop (score, LCP, CLS)
- [ ] SSL, viewport, contact form done; homepage broken links and form submit test not built
- [x] "No working website": parked, soft 404, under construction, default page, Facebook/Instagram-only
- [ ] Stack detection with Wappalyzer fingerprints (a simpler CMS check exists)
- [ ] Mobile + desktop screenshots (Directus files)
- [x] Output: 3 headline issues ranked by business impact, each pointing to a stored metric
- [x] Skip re-audit if the last audit is under 30 days old
- [x] Tests: issue ranking and metric keys; broken-vs-blocked verdict

## 5. Analyser

- [ ] LLM extracts facts (intent, size signals) into a Zod schema; score comes from the rubric function, not the model
- [ ] Plan JSON: hook, service and case study are filled by rules today; channel choice and risks need the LLM step
- [x] Bands route: <50 → `archived` with reason; else → `awaiting_approval` (plus too-small and chain-branch rules)
- [x] Test: same stored facts → same score

## 6. Sales Agent (first touch only; follow-ups are Phase 2)

- [ ] Style guide + banned phrases in `templates`
- [ ] Draft matches the offer (audit PDF / mockup / call only). Today: a fixed WhatsApp draft only
- [ ] Checks in code: < 120 words, ≤ 1 link, no attachment, banned phrases absent, identity + address + opt-out present
- [ ] Fact check: every number or claim in the draft exists in the lead record; fail → redraft once, then flag
- [ ] Test: checks reject a bad draft

## 7. Sender (Gmail API)

- [ ] OAuth for the dedicated Workspace mailbox; token stored server-side only
- [ ] Leads in `is_test` campaigns can never send live, whatever `SEND_MODE` is (tested)
- [ ] **`SEND_MODE=dry_run` by default**; `allowlist` mode sends only to test addresses; `live` needs an explicit env change
- [ ] Caps in code: 40/day per mailbox across all campaigns, ramp 15 → 25 → 40 by week
- [ ] Send windows Tue–Thu 9:30–11:30 / 15:00–17:00 lead time zone, holiday list
- [ ] Idempotency: one `messages` row → at most one Gmail send (check `provider_msg_id` before sending)
- [ ] `List-Unsubscribe` header + one-click opt-out link → public route in admin → suppression
- [ ] Bounce tracking; auto-pause mailbox at > 3% bounce or any complaint
- [ ] Tests: cap enforced across two campaigns; retrying a job doesn't double-send; out-of-window send is deferred

## 8. Admin UI (Nuxt)

- [x] Login against Directus (admins + `LE` roles only)
- [x] Server-side Directus fetch helper that refreshes the access token (`directusAsUser`, verified past the 15-minute expiry)
- [ ] Role-aware nav (Closer sees Hot replies only, etc.)
- [ ] **Campaigns**: done except pre-flight lead/cost/mailbox-capacity estimates, Clone and Archive
- [ ] **Approval inbox**: done except screenshot, draft message + Edit, Snooze, A/E/R shortcuts
- [x] Team + Settings: Directus Data Studio (sidebar link); Segments has its own page
- [ ] Check in a browser, desktop and phone width (all UI so far was verified through the API and server-rendered HTML only)

## 9. Compliance and launch

- [ ] Retention job: delete archived candidates after 90 days
- [ ] Pre-launch self-review checklist as a campaign launch step: provenance stored, opt-out works end to end, privacy notice live, suppression checked
- [ ] End-to-end dry run on real Phase 0 data: scan → enrich → audit → score → approve → dry-run send
- [ ] Switch to `live` with Harshad's explicit OK; ramp starts at 15/day

## Done when

- [ ] Exit test numbers recorded in README → Gate results
