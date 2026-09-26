# Development plan — Shwez Lead Engine

Source of truth for scope: `docs/Shwez Lead Engine — Product Spec.md`.
These files track **progress**. Tick `[x]` in the same commit as the work.

## Status

| Plan | Gate to start | Status |
| --- | --- | --- |
| [Phase 0 — Validate (manual)](phase-0-validate.md) | None | Not started |
| [Phase 1a — Foundation](phase-1a-foundation.md) | None (runs in parallel with Phase 0) | Done |
| [Phase 1b — MVP agents + UI](phase-1b-mvp.md) | §0 Phase 0 helper: none. Rest: Phase 0 exit test passed | §0 in progress, rest blocked |
| [Phase 2 — Close the loop](phase-2-close-loop.md) | Phase 1 exit test passed | Blocked |
| [Phase 3 — Expand](phase-3-expand.md) | Phase 2 exit test passed | Blocked |
| Phase 4 — Productize | 2 quarters of data, 3+ projects won | Not planned yet |

Status values: `Not started` · `In progress` · `Done` · `Blocked` · `Failed gate`.

## Gate results

Record each gate result here before moving on. If a gate fails, stop building
and rework the offer or segment (spec § Spend gates).

| Gate | Date | Result | Numbers |
| --- | --- | --- | --- |
| Phase 0 → 1b | | | positive replies __ / 50 sends |
| Phase 1 → 2 | | | approved leads/week __, bounce __%, calls __ |
| Phase 2 → 3 | | | calls/month __, projects won __ |

## Decisions made during planning (26 Sep 2026)

| Topic | Decision |
| --- | --- |
| Sequencing | Phase 0 runs by hand in parallel with Phase 1a. Phase 1b (agents, sending) starts only after the Phase 0 gate passes. |
| Repo | One pnpm monorepo: `apps/admin` (Nuxt 4), `apps/worker` (TS agents), `packages/shared` (Zod schemas, types, state machine), `infra/` (Compose, Directus snapshot). |
| Hosting | Existing Contabo VPS. |
| Directus | Use the existing shared instance at cms.shwezstudio.in, for local dev too. Isolation: `le_` collection prefix, "Lead Engine" folder, `LE` roles scoped to `le_*`, create-only setup script, never `schema apply`. |
| Queue | pg-boss in a separate `lead_queue` database on the Directus Postgres; SSH tunnel in dev. |
| Test data | `is_test` flag on campaigns: never sends live, removed by a cleanup script. |
| Cold sending in phase 1 | Gmail API on the dedicated Workspace mailbox (the spec's Decisions table). The roadmap row saying "sending via bought tool" is treated as superseded. |
| Tracking | Markdown checklists in `docs/plans/`. |
| Phase 0 helper | Build CSV import + audit + score + read-only inbox before the gate, to speed up Phase 0. No LLM, paid APIs or sending until the gate passes. |
| Too-small filter | Leads with fewer than `le_global_config.min_reviews` Google reviews (default 10) are archived as too small; unknown review counts are not penalised. Default chosen by Claude, tune in Directus. |
| Markets (27 Sep) | Leads can be global. Phase 0 validates the **UK** first; each later market gets its own small validation run. Every business stores its ISO country; phones are stored E.164. |
| Cross-country compliance (27 Sep) | Harshad chose **no country restrictions** and no legal review, overriding the spec's "review before EU/US leads" trigger. The spec's basics still apply to every email: real identity, postal address, one-click opt-out, permanent suppression. |
| Discovery before the gate (27 Sep) | Harshad asked to build the campaign screen, Google Places scan and Enricher v0 before Phase 0 finishes, because external exports lacked URLs and emails. Paid lookups (Hunter), email verification, LLM and sending stay gated. |
| Chain filter (27 Sep) | Leads whose listed website is a branch page on a chain's site (`/estate-agents/<area>`, `/our-branches/<x>`, `/our-offices/<x>` …) are archived as "chain branch" with the path as evidence. |
| Assisted WhatsApp (27 Sep) | Best-fit leads (no/broken website) rarely publish an email, so To send/Sent cards with a phone get a WhatsApp button: opens wa.me with a drafted message (sender, business, top issue, service, STOP opt-out); Harshad reviews and sends by hand. Sends record their channel. Use a separate business number; low volume. |
| More sources (27 Sep) | Built ahead of the spec's Phase 2 at Harshad's request. **Startup news:** a campaign Source; Inc42 + YourStory funding headlines every 6 h → company → Google Maps match (whole-word name match, website required) → lead with a `funding` intent signal. **Reddit:** watch list in `le_global_config.reddit_watch`, posts into `le_posts` and the Reddit page for manual in-thread replies (no DMs). Reddit's Data API terms restrict commercial use; Harshad to check before relying on it. |
| Access | One `LE` role per user (or Directus admin); per-campaign manager/closer via `le_campaign_members`. Keep it simple: internal tool. |

## Open questions (ask Harshad; don't guess)

- [ ] Address and domain of the dedicated cold mailbox (spec, before Phase 0).
- [ ] A sample Mantis CSV export (or your own sheet), to check the import columns.
- [ ] Free PageSpeed Insights API key (`PAGESPEED_API_KEY`): Google Cloud → enable "PageSpeed Insights API" → create API key. Without one, Google allows only a few audits.
- [ ] Scoring partial credit (`packages/shared/src/rubric.ts`, `FACTORS`): the spec gives weights but not partial credit, e.g. PSI mobile < 40 = half of Need, 20–49 reviews = a quarter of Size. Review before Phase 1b.
- [ ] State machine gaps, interim choices (27 Sep, revisit in Phase 2): referral → handed to closer (closer adds the referred contact); bounce → closed_lost + contact invalid; later / out of office → back in sequence. Still open: a lead where the Enricher finds no contact at all.
- [ ] Phase 0 lead source: Mantis's free tier gives only about 20 leads with contacts. Buy Mantis (₹3,499), buy LeadSweep Starter ($39), or pull the other 30 by hand?
