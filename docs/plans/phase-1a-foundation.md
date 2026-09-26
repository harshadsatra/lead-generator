# Phase 1a — Foundation (done 26 Sep 2026)

Cheap, low-risk groundwork: nothing here sends email or spends on paid APIs.
The server audit, `lead_queue` database and production stack moved to
Phase 1b § Prep (26 Sep): they're only needed once jobs run or we deploy.

**Directus:** the lead engine uses the existing shared instance at
`https://cms.shwezstudio.in`, for local dev too. Other projects live there, so:
`le_` prefix on every collection, a "Lead Engine" folder, `LE` roles that see
only `le_*`, a create-only setup script, and **never `directus schema apply`**
(it diffs the whole instance and can delete other projects' collections).

## Repo and tooling

- [x] `git init`, `.gitignore` (node_modules, .env, .output, .nuxt, dist, uploads)
- [x] pnpm workspace: `apps/*`, `packages/*`
- [x] Root `tsconfig.base.json` (strict)
- [x] Root scripts: `dev`, `build`, `typecheck`, `lint`, `test`
- [x] `.env.example` with every variable named (no values); real `.env` never committed
- [x] `.nvmrc` → 22

## Boilerplates (pull, don't fork)

| Piece | How it comes in |
| --- | --- |
| Nuxt UI v4 dashboard template | Cloned into `apps/admin` (git history stripped) |
| Directus | Existing shared instance, cms.shwezstudio.in (v11.4.1) |
| Postgres | Existing Postgres behind Directus; separate `lead_queue` database for pg-boss (Phase 1b § Prep) |
| Reacher | Docker image `reacherhq/backend`, pinned (Phase 1b) |
| pg-boss, AI SDK + `@ai-sdk/anthropic`, Crawlee, Playwright, googleapis | npm dependencies, added **when the task that needs them starts**, not up front |
| Wappalyzer fingerprints | Added with the full Auditor (Phase 1b) |

- [x] Clone the Nuxt UI dashboard template into `apps/admin`; `pnpm dev` runs
- [x] Strip template demo pages not in the spec's 6 screens (keep the layout shell)
- [x] `apps/worker`: Node 22 + TS skeleton
- [x] `packages/shared`: Zod schemas for enums (lead state, band, offer, channel, reply class)

## Access to the shared Directus

- [x] Admin token in `.env` as `DIRECTUS_SETUP_TOKEN` (**rotate**: it was shared in chat)
- [x] `LE Worker` service user (token only, no password): reads/writes `le_*`, gets 403 on other projects. Worker never uses an admin token
- [x] Tokens go in local `.env` only (`DIRECTUS_TOKEN`, `DIRECTUS_SETUP_TOKEN`)
- [x] Admin login: `nuxt-auth-utils` sealed cookie session, Directus tokens server-side only, access limited to Directus admins + `LE *` roles, 2FA code supported, safe `redirect` param

## Data model in Directus (`le_` prefix)

`infra/directus/setup.ts`: idempotent, **create-only**, dry run by default.

- [x] Setup script (`pnpm le:setup`, `--apply` to write); guard refuses any write outside `le_` / `LE` (tested)
- [x] "Lead Engine" collection folder
- [x] Core: `le_businesses`, `le_signals`, `le_contacts`, `le_audits`, `le_leads`, `le_messages`, `le_replies`, `le_events`, `le_suppression`
- [x] Campaign + team: `le_campaigns` (incl. **`is_test`**), `le_campaign_mailboxes`, `le_campaign_members` (campaign ↔ Directus user, manager/closer). No `team_members` table: the team is Directus users with one `LE` role each (approved 26 Sep)
- [x] Config: `le_global_config` (singleton), `le_segments`, `le_mailboxes`, `le_templates`, `le_llm_usage`
- [x] Unique constraints: `le_businesses.domain`, `le_businesses.gbp_place_id`, `le_suppression.email_hash`, `le_messages.provider_msg_id`
- [x] `le_leads.events` O2M alias: a lead update + event insert in one request (verified atomic)
- [x] Roles: `LE Admin`, `LE Worker`, `LE Campaign manager`, `LE Closer`, no permissions outside `le_*`
- [x] Seed: 6 segments, `le_global_config` defaults. Still blank: `default_owner`, `llm_budget_monthly_inr` (Harshad sets in Directus)
- [x] `pnpm le:cleanup-test`: deletes `is_test` campaign data; keeps suppression + llm_usage (dry run unless `--apply`)
- Later phases add `le_territories` (phase 2) and `le_preview_sites` (phase 3) with the same script

## Shared core (tested, pure code)

- [x] Lead state machine in `packages/shared` (all 196 state pairs tested against the spec diagram)
- [x] Scoring rubric (spec weights, bands 70+/50–69/<50, weights must sum to 100)
- [x] Access rule `canUseLeadEngine` (tested)
