# Phase 1a — Foundation (runs in parallel with Phase 0)

Cheap, low-risk groundwork: nothing here sends email or spends on paid APIs.
Stop at the end of this file until the Phase 0 gate passes.

**Directus:** the lead engine uses the existing shared instance at
`https://cms.shwezstudio.in`, for local dev too. Other projects live there, so:
`le_` prefix on every collection, a "Lead Engine" folder, `LE` roles that see
only `le_*`, a create-only setup script, and **never `directus schema apply`**
(it diffs the whole instance and can delete other projects' collections).

## 1. Server audit (Contabo), done first and read-only

Run these on the server and paste the results into `infra/SERVER.md`. Don't change anything yet.

- [ ] `nproc && free -h && df -h`: CPU, RAM, disk. Need about 4 vCPU and 8 GB free for Playwright, Reacher and the worker
- [ ] `docker --version && docker compose version`
- [ ] `docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'`: list existing containers and ports so new ones don't collide
- [ ] Directus version and the Postgres version/container behind cms.shwezstudio.in; Compose file location and network name
- [ ] Reverse proxy in use (Nginx / Caddy / Traefik) and how subdomains are routed
- [ ] Outbound port 25: `nc -vz -w 5 gmail-smtp-in.l.google.com 25` (Reacher needs this; if blocked, ask Contabo support or fall back to a paid verifier)
- [ ] Existing backup setup for the Directus Postgres (lead data will now live in it)
- [ ] Decide subdomain for the admin app, e.g. `leads.shwezstudio.in` (ask Harshad)
- [ ] If RAM < 8 GB, run Playwright jobs one at a time (concurrency 1) and plan a VPS upgrade checkpoint

## 2. Repo and tooling

- [x] `git init`, `.gitignore` (node_modules, .env, .output, .nuxt, dist, uploads)
- [x] pnpm workspace: `apps/*`, `packages/*`
- [x] Root `tsconfig.base.json` (strict)
- [x] Root scripts: `dev`, `build`, `typecheck`, `lint`, `test`
- [x] `.env.example` with every variable named (no values); real `.env` never committed
- [x] `.nvmrc` → 22

## 3. Boilerplates (pull, don't fork)

| Piece | How it comes in |
| --- | --- |
| Nuxt UI v4 dashboard template | Cloned into `apps/admin` (git history stripped) |
| Directus | Existing shared instance, cms.shwezstudio.in |
| Postgres | Existing Postgres behind Directus; separate `lead_queue` database for pg-boss |
| Reacher | Docker image `reacherhq/backend`, pinned |
| pg-boss, AI SDK + `@ai-sdk/anthropic`, Zod, Crawlee, Playwright, googleapis, `@directus/sdk` | npm dependencies, added **when the task that needs them starts**, not up front |
| Wappalyzer fingerprints | Added with the Auditor task (Phase 1b) |

- [x] Clone the Nuxt UI dashboard template into `apps/admin`; `pnpm dev` runs
- [x] Strip template demo pages not in the spec's 6 screens (keep the layout shell)
- [x] `apps/worker`: Node 22 + TS skeleton (folders get created by the first task that needs them)
- [x] `packages/shared`: Zod schemas for enums (lead state, band, offer, channel, reply class)

## 4. Access to the shared Directus and queue DB

- [ ] Harshad creates (or approves Claude creating) the `LE Worker` user with a static token, with a role that has access to `le_*` only, plus a separate admin token used only by the setup script
- [ ] Tokens go in local `.env` only (`DIRECTUS_TOKEN`, `DIRECTUS_SETUP_TOKEN`)
- [ ] Ask Harshad before creating the `lead_queue` database on the Directus Postgres (its own DB user, no access to the Directus DB)
- [x] Admin login: `nuxt-auth-utils` sealed cookie session, Directus tokens server-side only, access limited to Directus admins + `LE *` roles, 2FA code supported, safe `redirect` param
- [ ] Admin app reaches Directus through a Nuxt server proxy, so the shared instance needs no CORS change
- [ ] SSH tunnel for local dev to `lead_queue` (command recorded in CLAUDE.md after the server audit)
- [ ] Confirm the existing Directus licence covers this use (spec caveat on BSL / Open Innovation Grant)

## 5. Data model in Directus (`le_` prefix)

`infra/directus/setup.ts`: an idempotent, **create-only** script that uses the
Directus SDK. It skips anything that already exists, never deletes or alters
non-`le_` items, and supports `--dry-run` (prints the plan). Run the dry run and
show Harshad the output before the first real run.

- [ ] Setup script with `--dry-run`; refuses any collection/role not prefixed `le_` / `LE`
- [ ] "Lead Engine" collection folder
- [ ] Core: `le_businesses`, `le_signals`, `le_contacts`, `le_audits`, `le_leads`, `le_messages`, `le_replies`, `le_events`, `le_suppression`
- [ ] Campaign + team: `le_campaigns` (incl. **`is_test`** boolean), `le_campaign_mailboxes`, `le_team_members`, `le_campaign_members`; `le_leads` gets `campaign_id`, `owner_id`, `offer`
- [ ] Config: `le_global_config` (singleton), `le_segments`, `le_mailboxes`, `le_templates`, `le_llm_usage`
- [ ] Deferred to later phases: `le_preview_sites` (phase 3), `le_territories` (phase 2)
- [ ] Unique constraints: `le_businesses.domain`, `le_businesses.gbp_place_id`, `le_suppression.email_hash`
- [ ] `le_leads.events` as an O2M alias so a lead update + event insert go in one request (Directus runs nested writes in one transaction)
- [ ] Roles: `LE Admin`, `LE Campaign manager`, `LE Closer`, per spec § Team management, with **no** permissions outside `le_*`
- [ ] Seed: 6 segments with rubric weights, `le_global_config` defaults (₹30,000 min budget, cadence 0/3/7/14, 40/day cap, Tue–Thu windows, default owner Harshad)
- [ ] `pnpm le:cleanup-test`: deletes every `is_test` campaign and everything hanging off it (dry run first)

## 6. Shared core (tested, pure code)

- [x] Lead state machine in `packages/shared`: allowed transitions exactly as in the spec diagram; illegal transitions throw
- [ ] `transition(lead, to, actor, reason)` in the worker: one Directus PATCH on `le_leads` with a nested `events` create (atomic)
- [x] Scoring rubric as a pure function: facts → per-factor breakdown → score → band (70+/50–69/<50)
- [x] Tests for both: every allowed and disallowed transition; rubric edge cases (69/70, 49/50)

## 7. Production stack (ready, not live)

- [ ] `infra/docker-compose.yml`: worker, reacher, admin only (Directus/Postgres already run); joins the Directus network only if needed to reach Postgres
- [ ] Reverse-proxy config for the admin subdomain
- [ ] Confirm nightly backups of the Directus Postgres include `le_*` tables and `lead_queue`, plus one restore test
- [ ] Deploy with no worker jobs enabled; confirm the admin login works against cms.shwezstudio.in

## Done when

- [ ] Fresh clone → `pnpm i` → `.env` filled → `pnpm dev` runs admin + worker against cms.shwezstudio.in, `le_*` schema and roles in place, `pnpm test` green
- [ ] Update the README status table
