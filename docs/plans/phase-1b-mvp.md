# Phase 1b — MVP agents and UI (weeks 3–6)

§0 (the Phase 0 helper) was approved to run before the gate (26 Sep).
**Everything from § Prep onward stays blocked until the Phase 0 gate passes** (see README → Gate results).

**Exit test:** 25 approved leads/week, bounce < 2%, admin review < 20 min/day.

## 0. Phase 0 helper (runs now; no LLM, no paid APIs, no sending)

Harshad imports the Phase 0 leads, the tool audits and scores them, and he
writes the 50 emails by hand from the results. Runs as a CLI, with no job queue
yet; each step is a plain function that pg-boss wraps later.

- [x] Worker Directus client (`LE Worker` token) + `transition()`: one PATCH on `le_leads` with a nested `events` create
- [x] CSV import: `pnpm le:import <file.csv> --campaign "<name>" --segment "<segment>" [--test]`. Tolerant headers (Mantis export, own sheet); dedupe on domain → phone → name+city; skip businesses active in another campaign; provenance (source, source_url, found_at); CSV email stored as an unverified contact. State: discovered → enriched
- [x] Auditor v0 (no new dependencies): PSI mobile + desktop (score, LCP, CLS), SSL, mobile viewport, no working site (unreachable, parked, under construction, Facebook/Instagram-only, soft 404), contact form present, CMS (WordPress + version, WooCommerce, Shopify, Wix, Squarespace). Top 3 plain-language issues, each tied to a metric key. State → audited
- [x] Scoring from audit + CSV facts with the rubric → `scored` → `awaiting_approval` (50+) or `archived` (<50, with reason)
- [x] Admin: Directus fetch helper with access-token refresh; Approval inbox lists `awaiting_approval` leads for a chosen campaign (business, score/band, top issues, PSI, site link), read-only
- [ ] Harshad test: import 5–10 real leads; check 2–3 audits against pagespeed.web.dev by hand

Deferred until the gate: screenshots (Playwright), Wappalyzer, Enricher + Reacher, LLM agents, approve/send.

## Prep (moved from Phase 1a; do when the job queue or deploy is next)

- [ ] Server audit (read-only), results into `infra/SERVER.md`: `nproc && free -h && df -h`; `docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'`; Postgres container/version and network behind cms.shwezstudio.in; reverse proxy; outbound port 25 (`nc -vz -w 5 gmail-smtp-in.l.google.com 25`); existing Postgres backups
- [ ] With Harshad's OK: `lead_queue` database + its own DB user on the Directus Postgres; SSH tunnel command for local dev in CLAUDE.md
- [ ] Confirm the Directus licence covers this use (BSL / Open Innovation Grant)
- [ ] `infra/docker-compose.yml`: worker, reacher, admin (Directus/Postgres already run); admin subdomain + reverse proxy (ask Harshad for the name)
- [ ] Backups include `le_*` tables and `lead_queue`, plus one restore test
- [ ] If RAM < 8 GB: Playwright concurrency 1 and a VPS upgrade checkpoint

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
- [ ] Leads in `is_test` campaigns can never send live, whatever `SEND_MODE` is (tested)
- [ ] **`SEND_MODE=dry_run` by default**; `allowlist` mode sends only to test addresses; `live` needs an explicit env change
- [ ] Caps in code: 40/day per mailbox across all campaigns, ramp 15 → 25 → 40 by week
- [ ] Send windows Tue–Thu 9:30–11:30 / 15:00–17:00 lead time zone, holiday list
- [ ] Idempotency: one `messages` row → at most one Gmail send (check `provider_msg_id` before sending)
- [ ] `List-Unsubscribe` header + one-click opt-out link → public route in admin → suppression
- [ ] Bounce tracking; auto-pause mailbox at > 3% bounce or any complaint
- [ ] Tests: cap enforced across two campaigns; retrying a job doesn't double-send; out-of-window send is deferred

## 8. Admin UI (Nuxt)

- [x] Login against Directus (built early, see Phase 1a §4)
- [x] Server-side Directus fetch helper that refreshes the access token (`directusAsUser`)
- [ ] Role-aware nav (Closer sees Hot replies only, etc.)
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
