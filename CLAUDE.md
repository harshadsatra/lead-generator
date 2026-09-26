# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start of every session

1. Read `docs/plans/README.md`: current phase, gate results, open questions.
2. Open the plan file for the current phase and pick the **first unticked item**. One item (or a small related group) per session.
3. Read only the spec section that item needs (`docs/Shwez Lead Engine — Product Spec.md`); the spec is long, don't reload it all.
4. When done: tick `[x]` in the plan file in the same commit as the code.

## Commands

```bash
pnpm i                                   # install all workspaces
pnpm db:up / pnpm db:down                # local Postgres 16 (:5433) + Directus 12.4.1 (:8055)
pnpm --filter @lead/admin dev            # Nuxt admin on :3000
pnpm --filter @lead/worker dev           # worker (tsx watch)
pnpm typecheck                           # all packages
pnpm lint                                # admin (eslint via @nuxt/eslint)
pnpm test                                # node:test via tsx, files *.test.ts
pnpm --filter @lead/shared exec tsx --test src/<file>.test.ts  # single test file
```

## Layout

- `apps/admin`: Nuxt 4 + Nuxt UI v4, from the `nuxt-ui-templates/dashboard` template (its demo pages are still there until the Phase 1a strip task). Talks to Directus with the Directus SDK.
- `apps/worker`: one Node 22 TS service that runs every agent through pg-boss (on the same Postgres as Directus). Run with `tsx`, no build step.
- `packages/shared`: Zod enums/schemas, lead state machine, scoring rubric. Consumed as TS source (`exports` → `src/index.ts`).
- `infra/`: Compose files; `infra/directus/snapshot.yaml` is the schema source of truth (Directus owns the tables).

Pipeline (spec § System architecture): Scanner plugins → dedupe → Enricher → Auditor → Analyser → **Gate 1** (human) → Sales Agent → **Gate 2** (human) → Sender → Reply Classifier. Agents never call each other: each job reads the lead row, does its work, and moves it forward with `transition()`.

## Rules (non-negotiable)

**Ask Harshad first, don't guess, when:**
- the spec is ambiguous or two sections conflict
- adding any new dependency, service or paid API
- anything costs money (Places API scans beyond one test locality, Hunter credits, new VPS resources, bulk LLM runs)
- touching the Contabo server, production data, DNS, or the mailbox
- moving from one phase to the next (the gate result must be recorded in `docs/plans/README.md`)

**Never:**
- touch the **shared Directus** on the Contabo server (other clients' data). The lead engine has its own Directus + Postgres stack.
- send real email outside `SEND_MODE=live`, which only Harshad sets. Dev uses `dry_run`, tests use `allowlist`.
- start Phase 1b work before the Phase 0 gate passes.
- build automated DMs for LinkedIn/Instagram/X, or scrape Google Maps or LinkedIn (spec § Non-goals, § Avoid).
- commit `.env` or secrets. Add new variables to `.env.example` by name only.

**Always:**
- Change lead state only through `transition()`, which writes the `events` row in the same transaction.
- Keep hard limits in code with a test: 40/day per mailbox across campaigns, the 15 → 25 → 40 ramp, send windows, max follow-ups, ₹5 LLM cost per lead, monthly LLM budget, bounce > 3% auto-pause, emergency stop.
- Make jobs idempotent: a retry must never double-send (check `provider_msg_id`).
- Route LLM calls through the worker's LLM wrapper (logs `llm_usage`, enforces caps). Use Haiku 4.5 for filter/classify and Sonnet 5 for analysis/drafting.
- Check the suppression list before every enrich and every send.
- Make every audit claim and email fact map to a stored value; the score comes from the rubric function, not the model.
- Change schema in local Directus, then re-snapshot to `infra/directus/snapshot.yaml` and commit.

**Keep it lean (budget is tight):**
- Build only what the current plan item needs. No abstractions or dependencies "for later".
- Prefer a Directus Data Studio screen over a custom Nuxt screen (Team, Settings, suppression).
- Leave one small `node:test` file for any non-trivial logic; no test frameworks beyond that.
- Keep Claude sessions short and scoped: one plan item, then commit, then `/clear`.
