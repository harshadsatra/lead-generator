# Phase 1a — Foundation (runs in parallel with Phase 0)

Cheap, low-risk groundwork: nothing here sends email or spends on paid APIs.
Stop at the end of this file until the Phase 0 gate passes.

## 1. Server audit (Contabo), done first and read-only

Run these on the server and paste the results into `infra/SERVER.md`. Don't change anything yet.

- [ ] `nproc && free -h && df -h`: CPU, RAM, disk. Need about 4 vCPU and 8 GB free for Playwright, Reacher and the worker
- [ ] `docker --version && docker compose version`
- [ ] `docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'`: list existing containers and ports so new ones don't collide
- [ ] Location of the shared Directus Compose stack and its network name (**not to be modified**)
- [ ] Reverse proxy in use (Nginx / Caddy / Traefik) and how subdomains are routed
- [ ] Outbound port 25: `nc -vz -w 5 gmail-smtp-in.l.google.com 25` (Reacher needs this; if blocked, ask Contabo support or fall back to a paid verifier)
- [ ] Existing backup setup (if any)
- [ ] Decide subdomains, e.g. `leads-admin.shwezstudio.in`, `leads-api.shwezstudio.in` (ask Harshad)
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
| Directus | Docker image, pinned version, in `infra/docker-compose.yml` |
| Postgres 16 | Docker image, own container for the lead engine |
| Reacher | Docker image `reacherhq/backend`, pinned |
| pg-boss, AI SDK + `@ai-sdk/anthropic`, Zod, Crawlee, Playwright, googleapis | npm dependencies, added **when the task that needs them starts**, not up front |
| Wappalyzer fingerprints | Added with the Auditor task (Phase 1b) |

- [x] Clone the Nuxt UI dashboard template into `apps/admin`; `pnpm dev` runs
- [ ] Strip template demo pages not in the spec's 6 screens (keep the layout shell)
- [x] `apps/worker`: Node 22 + TS skeleton (folders get created by the first task that needs them)
- [x] `packages/shared`: Zod schemas for enums (lead state, band, offer, channel, reply class)

## 4. Local dev stack

- [x] `infra/docker-compose.dev.yml`: Postgres 16 + Directus (pinned), local only
- [x] `docker compose -f infra/docker-compose.dev.yml up -d` gives a working Directus at `localhost:8055`
- [ ] Register for the Directus Open Innovation Grant key and confirm eligibility (spec caveat)

## 5. Data model in Directus

Create collections to match the spec's § Data model. Directus owns the schema;
commit a snapshot so it can be rebuilt.

- [ ] Core: `businesses`, `signals`, `contacts`, `audits`, `leads`, `messages`, `replies`, `events`, `suppression`
- [ ] Campaign + team: `campaigns`, `campaign_mailboxes`, `team_members`, `campaign_members`; `leads` gets `campaign_id`, `owner_id`, `offer`
- [ ] Config: `global_config` (singleton), `segments`, `mailboxes`, `templates`, `llm_usage`
- [ ] Deferred to later phases: `preview_sites` (phase 3), `territories` (phase 2)
- [ ] Unique constraints: `businesses.domain`, `businesses.gbp_place_id`, `suppression.email_hash`
- [ ] Roles: Admin, Campaign manager, Closer, with permissions per spec § Team management
- [ ] Seed: 6 segments with rubric weights, `global_config` defaults (₹30,000 min budget, cadence 0/3/7/14, 40/day cap, Tue–Thu windows, default owner Harshad)
- [ ] `infra/directus/snapshot.yaml` committed; `pnpm db:apply` rebuilds a fresh instance from it

## 6. Shared core (tested, pure code)

- [ ] Lead state machine in `packages/shared`: allowed transitions exactly as in the spec diagram; illegal transitions throw
- [ ] `transition(lead, to, actor, reason)` in the worker: updates `leads.state` and writes an `events` row in one DB transaction
- [ ] Scoring rubric as a pure function: facts → per-factor breakdown → score → band (70+/50–69/<50)
- [ ] Tests for both: every allowed and disallowed transition; rubric edge cases (69/70, 49/50)

## 7. Production stack (ready, not live)

- [ ] `infra/docker-compose.yml`: postgres, directus, reacher, worker, admin, on a network separate from the shared Directus stack
- [ ] Reverse-proxy config for the chosen subdomains
- [ ] Nightly `pg_dump` to object storage, plus one restore test
- [ ] Deploy only the empty stack (no worker jobs enabled); confirm the admin login works

## Done when

- [ ] Fresh clone → `pnpm i` → `docker compose up` → Directus with the full schema and roles, admin shell running, `pnpm test` green
- [ ] Update the README status table
