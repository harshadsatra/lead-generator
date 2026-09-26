# Development plan — Shwez Lead Engine

Source of truth for scope: `docs/Shwez Lead Engine — Product Spec.md`.
These files track **progress**. Tick `[x]` in the same commit as the work.

## Status

| Plan | Gate to start | Status |
| --- | --- | --- |
| [Phase 0 — Validate (manual)](phase-0-validate.md) | None | Not started |
| [Phase 1a — Foundation](phase-1a-foundation.md) | None (runs in parallel with Phase 0) | In progress |
| [Phase 1b — MVP agents + UI](phase-1b-mvp.md) | Phase 0 exit test passed | Blocked |
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

## Open questions (ask Harshad; don't guess)

- [ ] Address and domain of the dedicated cold mailbox (spec, before Phase 0).
- [ ] Contabo VPS size and whether outbound port 25 is open (needed for Reacher). Answered by the server audit in Phase 1a.
- [ ] Phase 0 lead source: Mantis's free tier gives only about 20 leads with contacts. Buy Mantis (₹3,499), buy LeadSweep Starter ($39), or pull the other 30 by hand?
