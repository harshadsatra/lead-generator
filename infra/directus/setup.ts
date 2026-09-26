// Create-only Lead Engine schema, roles and seed data on the SHARED Directus.
// Dry run by default; pass --apply to write. Never deletes, never touches non-le_ objects.
// Run: pnpm le:setup [--apply]

import { fileURLToPath } from 'node:url'

const BASE = process.env.DIRECTUS_URL
const TOKEN = process.env.DIRECTUS_SETUP_TOKEN
const APPLY = process.argv.includes('--apply')

// ---------- schema ----------

interface F {
  type: string
  required?: boolean
  unique?: boolean
  default?: unknown
  m2o?: string
  onDelete?: 'CASCADE' | 'SET NULL'
  special?: string[]
  note?: string
}
interface C { icon: string, note: string, singleton?: boolean, fields: Record<string, F> }

const FOLDER = 'le_lead_engine'
const USERS = 'directus_users'
const created: Record<string, F> = { date_created: { type: 'timestamp', special: ['date-created'] } }
const updated: Record<string, F> = { date_updated: { type: 'timestamp', special: ['date-updated'] } }
const parent = (collection: string, required = true): F =>
  ({ type: 'uuid', m2o: collection, required, onDelete: required ? 'CASCADE' : 'SET NULL' })
const ref = (collection: string): F => ({ type: 'uuid', m2o: collection, onDelete: 'SET NULL' })

const COLLECTIONS: Record<string, C> = {
  le_segments: {
    icon: 'category', note: 'ICP segment library',
    fields: {
      name: { type: 'string', required: true, unique: true },
      signals: { type: 'text' },
      service: { type: 'string' },
      case_studies: { type: 'text' },
      icp: { type: 'text' },
      weights: { type: 'json', note: 'Rubric weight overrides; null = default weights' },
      min_budget: { type: 'integer', note: 'INR; null = global default' },
      auto_send: { type: 'boolean', default: false, note: 'Gate 2 off (phase 2+, code-enforced conditions)' },
      ...created
    }
  },
  le_mailboxes: {
    icon: 'mail', note: 'Cold sending mailboxes',
    fields: {
      email: { type: 'string', required: true, unique: true },
      domain: { type: 'string' },
      provider: { type: 'string', default: 'gmail' },
      daily_cap: { type: 'integer', default: 40 },
      ramp_start_date: { type: 'date' },
      health: { type: 'string', default: 'ok' },
      paused: { type: 'boolean', default: false },
      ...created
    }
  },
  le_campaigns: {
    icon: 'campaign', note: 'One automation run: segment, area, budget, team',
    fields: {
      name: { type: 'string', required: true },
      segment_id: ref('le_segments'),
      geography: { type: 'json' },
      min_budget: { type: 'integer' },
      scanners: { type: 'json' },
      weights_override: { type: 'json' },
      weekly_cap: { type: 'integer' },
      channels: { type: 'json' },
      cadence: { type: 'json' },
      offer_mode: { type: 'string' },
      status: { type: 'string', default: 'draft', required: true },
      owner_id: ref(USERS),
      is_test: { type: 'boolean', default: false, required: true, note: 'Test data: never sends live; removed by le:cleanup-test' },
      ...created, ...updated
    }
  },
  le_campaign_members: {
    icon: 'group', note: 'Who manages / closes each campaign',
    fields: {
      campaign_id: parent('le_campaigns'),
      user_id: { ...parent(USERS) },
      role: { type: 'string', required: true, note: 'manager | closer' }
    }
  },
  le_campaign_mailboxes: {
    icon: 'forward_to_inbox', note: 'Mailboxes a campaign may send from',
    fields: {
      campaign_id: parent('le_campaigns'),
      mailbox_id: parent('le_mailboxes')
    }
  },
  le_businesses: {
    icon: 'storefront', note: 'Deduped real-world business',
    fields: {
      name: { type: 'string', required: true },
      domain: { type: 'string', unique: true },
      phone: { type: 'string' },
      locality: { type: 'string' },
      city: { type: 'string' },
      category: { type: 'string' },
      gbp_place_id: { type: 'string', unique: true },
      review_count: { type: 'integer' },
      ...created
    }
  },
  le_signals: {
    icon: 'sensors', note: 'Raw signals with provenance (DPDP)',
    fields: {
      business_id: parent('le_businesses'),
      source: { type: 'string', required: true, note: 'Scanner plugin id' },
      source_url: { type: 'text', required: true },
      signal_type: { type: 'string' },
      raw: { type: 'json' },
      found_at: { type: 'timestamp', required: true }
    }
  },
  le_contacts: {
    icon: 'contact_mail', note: 'Published business contacts only',
    fields: {
      business_id: parent('le_businesses'),
      name: { type: 'string' },
      role: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      found_via: { type: 'string', required: true },
      source_url: { type: 'text', note: 'Where the contact was published (DPDP)' },
      found_at: { type: 'timestamp' },
      verified_status: { type: 'string', default: 'unknown', note: 'valid | invalid | risky | unknown' },
      verified_at: { type: 'timestamp' }
    }
  },
  le_audits: {
    icon: 'speed', note: 'Site audit; re-run after 30 days',
    fields: {
      business_id: parent('le_businesses'),
      psi_mobile: { type: 'integer' },
      psi_desktop: { type: 'integer' },
      lcp_ms: { type: 'integer' },
      cls: { type: 'float' },
      has_ssl: { type: 'boolean' },
      cms: { type: 'string' },
      issues: { type: 'json', note: 'Top 3 issues, each pointing at a metric key' },
      metrics: { type: 'json' },
      screenshots: { type: 'json' },
      run_at: { type: 'timestamp', required: true }
    }
  },
  le_leads: {
    icon: 'person_search', note: 'Lead state machine',
    fields: {
      business_id: parent('le_businesses'),
      campaign_id: parent('le_campaigns'),
      primary_contact_id: ref('le_contacts'),
      state: { type: 'string', required: true, default: 'discovered' },
      score: { type: 'integer' },
      score_breakdown: { type: 'json' },
      band: { type: 'string' },
      segment_id: ref('le_segments'),
      plan: { type: 'json' },
      channel: { type: 'string' },
      offer: { type: 'string', note: 'audit_pdf | mockup | call_only' },
      owner_id: ref(USERS),
      approved_by: ref(USERS),
      approved_at: { type: 'timestamp' },
      closed_reason: { type: 'string' },
      summary: { type: 'text' },
      ...created, ...updated
    }
  },
  le_events: {
    icon: 'timeline', note: 'Append-only lead timeline',
    fields: {
      lead_id: parent('le_leads'),
      actor: { type: 'string', required: true },
      type: { type: 'string', required: true },
      payload: { type: 'json' },
      ...created
    }
  },
  le_messages: {
    icon: 'outgoing_mail', note: 'Every draft and send',
    fields: {
      lead_id: parent('le_leads'),
      step: { type: 'integer', required: true },
      channel: { type: 'string', required: true, default: 'email' },
      subject: { type: 'string' },
      body: { type: 'text' },
      status: { type: 'string', required: true, default: 'draft', note: 'draft | approved | scheduled | sent | failed' },
      scheduled_at: { type: 'timestamp' },
      sent_at: { type: 'timestamp' },
      provider_msg_id: { type: 'string', unique: true, note: 'Set once sent; guards against double-send' },
      mailbox_id: ref('le_mailboxes'),
      ...created
    }
  },
  le_replies: {
    icon: 'reply', note: 'Inbound replies',
    fields: {
      lead_id: parent('le_leads'),
      message_id: ref('le_messages'),
      body: { type: 'text' },
      classification: { type: 'string' },
      confidence: { type: 'float' },
      received_at: { type: 'timestamp' },
      actioned: { type: 'boolean', default: false }
    }
  },
  le_suppression: {
    icon: 'block', note: 'Global do-not-contact list (hashed)',
    fields: {
      email_hash: { type: 'string', unique: true },
      phone_hash: { type: 'string', unique: true },
      domain: { type: 'string' },
      reason: { type: 'string', required: true },
      ...created
    }
  },
  le_templates: {
    icon: 'description', note: 'Style guide, banned phrases',
    fields: {
      name: { type: 'string', required: true, unique: true },
      kind: { type: 'string', required: true, note: 'style_guide | banned_phrases' },
      body: { type: 'text' }
    }
  },
  le_llm_usage: {
    icon: 'payments', note: 'LLM tokens and cost per lead per agent',
    fields: {
      lead_id: ref('le_leads'),
      agent: { type: 'string', required: true },
      model: { type: 'string', required: true },
      input_tokens: { type: 'integer' },
      output_tokens: { type: 'integer' },
      cost_inr: { type: 'float' },
      ...created
    }
  },
  le_global_config: {
    icon: 'tune', note: 'Global defaults and hard limits', singleton: true,
    fields: {
      min_budget: { type: 'integer', default: 30000 },
      weekly_lead_cap: { type: 'integer', default: 25 },
      cadence_days: { type: 'json' },
      max_follow_ups: { type: 'integer', default: 3 },
      send_windows: { type: 'json' },
      holidays: { type: 'json' },
      daily_cap_per_mailbox: { type: 'integer', default: 40 },
      ramp_per_week: { type: 'json' },
      bounce_pause_pct: { type: 'float', default: 3 },
      llm_budget_monthly_inr: { type: 'integer' },
      llm_cap_per_lead_inr: { type: 'float', default: 5 },
      default_offer_mode: { type: 'string', default: 'ask_per_lead' },
      default_owner: ref(USERS),
      emergency_stop: { type: 'boolean', default: false }
    }
  }
}
const LE = Object.keys(COLLECTIONS)
const O2M = [{ collection: 'le_leads', field: 'events', many: 'le_events', manyField: 'lead_id' }]

// ---------- roles ----------

const CRUD = ['create', 'read', 'update', 'delete'] as const
type Grant = Record<string, readonly string[]>
const all = (actions: readonly string[]): Grant => Object.fromEntries(LE.map(c => [c, actions]))
const TEAM_USERS_FILTER = { _or: [{ role: { name: { _starts_with: 'LE ' } } }, { role: { name: { _eq: 'Administrator' } } }] }

const ROLES: { name: string, app: boolean, grants: Grant }[] = [
  { name: 'LE Admin', app: true, grants: all(CRUD) },
  { name: 'LE Worker', app: false, grants: all(CRUD) },
  {
    name: 'LE Campaign manager', app: true,
    grants: {
      ...all(['read']),
      le_campaigns: ['create', 'read', 'update'],
      le_campaign_members: ['create', 'read', 'update', 'delete'],
      le_campaign_mailboxes: ['create', 'read', 'delete'],
      le_leads: ['read', 'update'],
      le_messages: ['read', 'update'],
      le_events: ['create', 'read'],
      le_suppression: ['create', 'read']
    }
  },
  {
    name: 'LE Closer', app: true,
    grants: {
      le_campaigns: ['read'], le_businesses: ['read'], le_signals: ['read'], le_contacts: ['read'],
      le_audits: ['read'], le_leads: ['read', 'update'], le_messages: ['create', 'read'],
      le_replies: ['read', 'update'], le_events: ['create', 'read'], le_suppression: ['create']
    }
  }
]

// ---------- seed ----------

const SEGMENTS = [
  ['Real estate developers and brokers', 'Project launch, slow or non-mobile site, no lead forms', 'Website + CRM integration', 'Real estate portfolio, Kishco CRM'],
  ['Restaurants, cafés, hotels', 'Strong GBP reviews but no site or a broken booking flow', 'Website, booking, Shopify menu/merch', 'Hospitality projects'],
  ['Clinics and health tech', 'Poor mobile site, no appointment booking', 'Website + booking + WhatsApp integration', 'Health tech projects'],
  ['D2C and e-commerce brands', 'Instagram-only store, slow Shopify/WooCommerce', 'Shopify build or rebuild', 'E-commerce, Shopify work'],
  ['Startups (seed to Series A)', 'Funding news, hiring web devs, outdated landing page', 'SaaS/full-stack, landing pages', 'SaaS, DocuX'],
  ['Edtech and coaching institutes', 'Old WordPress, no online enrolment', 'Web app, LMS, payments', 'Edtech projects']
].map(([name, signals, service, case_studies]) => ({ name, signals, service, case_studies }))

const GLOBAL_CONFIG = {
  cadence_days: [0, 3, 7, 14],
  send_windows: { days: ['tue', 'wed', 'thu'], slots: [['09:30', '11:30'], ['15:00', '17:00']] },
  holidays: [],
  ramp_per_week: [15, 25, 40]
}

// ---------- http + guard ----------

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const json = res.status === 204 ? {} : await res.json() as { data?: T, errors?: { message: string }[] }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify((json as { errors?: unknown }).errors)}`)
  return (json as { data: T }).data
}

const isLe = (s: unknown) => typeof s === 'string' && s.startsWith('le_')
export const ours = { policies: new Set<string>(), roles: new Set<string>() }

export function assertSafe(method: string, path: string, body: Record<string, unknown>) {
  const ok
    = (method === 'POST' && path === '/collections' && isLe(body.collection))
      || (method === 'POST' && /^\/fields\/le_[a-z_]+$/.test(path))
      || (method === 'POST' && path === '/relations' && isLe(body.collection))
      || (method === 'POST' && (path === '/policies' || path === '/roles') && String(body.name).startsWith('LE '))
      || (method === 'POST' && path === '/access' && ours.roles.has(String(body.role)) && ours.policies.has(String(body.policy)))
      || (method === 'POST' && path === '/permissions' && ours.policies.has(String(body.policy))
        && (isLe(body.collection) || (body.collection === USERS && body.action === 'read')))
      || ((method === 'POST' || method === 'PATCH') && /^\/items\/le_[a-z_]+$/.test(path))
  if (!ok) throw new Error(`Refusing unsafe write: ${method} ${path} ${JSON.stringify(body).slice(0, 120)}`)
}

const plan: string[] = []
let fakeId = 0
async function write<T = { id: string }>(label: string, method: string, path: string, body: Record<string, unknown>): Promise<T> {
  assertSafe(method, path, body)
  plan.push(label)
  if (!APPLY) return { id: `(new-${++fakeId})` } as T
  return api<T>(method, path, body)
}

// ---------- build ----------

function fieldDef(name: string, f: F) {
  return {
    field: name,
    type: f.type,
    meta: { required: f.required ?? false, note: f.note ?? null, special: f.special ?? null, readonly: !!f.special, hidden: false },
    schema: { is_nullable: !f.required, is_unique: f.unique ?? false, default_value: f.default ?? null }
  }
}
const pkDef = {
  field: 'id', type: 'uuid',
  meta: { hidden: true, readonly: true, special: ['uuid'] },
  schema: { is_primary_key: true, length: 36, has_auto_increment: false }
}

async function main() {
  if (!BASE || !TOKEN) throw new Error('DIRECTUS_URL and DIRECTUS_SETUP_TOKEN must be set in .env')
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} against ${BASE}\n`)

  const collections = new Set((await api<{ collection: string }[]>('GET', '/collections?limit=-1')).map(c => c.collection))
  const fields = new Set((await api<{ collection: string, field: string }[]>('GET', '/fields?limit=-1')).map(f => `${f.collection}.${f.field}`))
  const relations = new Set((await api<{ collection: string, field: string }[]>('GET', '/relations?limit=-1')).map(r => `${r.collection}.${r.field}`))
  const policies = new Map((await api<{ id: string, name: string }[]>('GET', '/policies?limit=-1&fields=id,name')).map(p => [p.name, p.id]))
  const roles = new Map((await api<{ id: string, name: string }[]>('GET', '/roles?limit=-1&fields=id,name')).map(r => [r.name, r.id]))

  // Folder
  if (!collections.has(FOLDER)) {
    await write(`collection ${FOLDER} (folder)`, 'POST', '/collections', { collection: FOLDER, meta: { icon: 'radar', note: 'Shwez Lead Engine', collapse: 'closed' }, schema: null })
  }

  // Collections + fields
  for (const [name, c] of Object.entries(COLLECTIONS)) {
    if (!collections.has(name)) {
      await write(`collection ${name} (${Object.keys(c.fields).length} fields)`, 'POST', '/collections', {
        collection: name,
        meta: { icon: c.icon, note: c.note, group: FOLDER, singleton: c.singleton ?? false },
        schema: {},
        fields: [pkDef, ...Object.entries(c.fields).map(([n, f]) => fieldDef(n, f))]
      })
      continue
    }
    for (const [n, f] of Object.entries(c.fields)) {
      if (!fields.has(`${name}.${n}`)) await write(`field ${name}.${n}`, 'POST', `/fields/${name}`, fieldDef(n, f))
    }
  }

  // O2M alias fields (before relations that reference them)
  for (const o of O2M) {
    if (!fields.has(`${o.collection}.${o.field}`)) {
      await write(`field ${o.collection}.${o.field} (o2m -> ${o.many})`, 'POST', `/fields/${o.collection}`, { field: o.field, type: 'alias', meta: { special: ['o2m'], interface: 'list-o2m' } })
    }
  }

  // Relations
  for (const [name, c] of Object.entries(COLLECTIONS)) {
    for (const [n, f] of Object.entries(c.fields)) {
      if (!f.m2o || relations.has(`${name}.${n}`)) continue
      const o2m = O2M.find(o => o.many === name && o.manyField === n)
      await write(`relation ${name}.${n} -> ${f.m2o} (${f.onDelete})`, 'POST', '/relations', {
        collection: name, field: n, related_collection: f.m2o,
        meta: { one_field: o2m?.field ?? null },
        schema: { on_delete: f.onDelete }
      })
    }
  }

  // Policies, roles, access, permissions
  for (const r of ROLES) {
    let policyId = policies.get(r.name)
    const newPolicy = !policyId
    if (!policyId) {
      policyId = (await write(`policy ${r.name} (app access: ${r.app})`, 'POST', '/policies', { name: r.name, icon: 'badge', app_access: r.app, admin_access: false })).id
    }
    ours.policies.add(policyId)
    let roleId = roles.get(r.name)
    if (!roleId) {
      roleId = (await write(`role ${r.name}`, 'POST', '/roles', { name: r.name, icon: 'badge' })).id
    }
    ours.roles.add(roleId)
    if (newPolicy) {
      await write(`attach policy -> role ${r.name}`, 'POST', '/access', { role: roleId, policy: policyId })
      const grants = Object.entries(r.grants)
      for (const [collection, actions] of grants) {
        for (const action of actions) {
          await write(`  perm ${r.name}: ${action} ${collection}`, 'POST', '/permissions', { policy: policyId, collection, action, fields: ['*'], permissions: {}, validation: {} })
        }
      }
      await write(`  perm ${r.name}: read ${USERS} (id, names, email; LE + Administrator users only)`, 'POST', '/permissions', {
        policy: policyId, collection: USERS, action: 'read', fields: ['id', 'first_name', 'last_name', 'email'], permissions: TEAM_USERS_FILTER, validation: {}
      })
    }
  }

  // Seed (only into empty collections)
  const empty = async (c: string) => !collections.has(c) || (await api<unknown[]>('GET', `/items/${c}?limit=1&fields=id`)).length === 0
  if (await empty('le_segments')) {
    for (const s of SEGMENTS) await write(`seed le_segments: ${s.name}`, 'POST', '/items/le_segments', s)
  }
  if (!collections.has('le_global_config') || (await api<Record<string, unknown> | null>('GET', '/items/le_global_config'))?.cadence_days == null) {
    await write('seed le_global_config defaults', 'PATCH', '/items/le_global_config', GLOBAL_CONFIG)
  }

  const perms = plan.filter(p => p.startsWith('  perm')).length
  console.log(plan.filter(p => !p.startsWith('  perm')).join('\n'))
  console.log(`\n${perms} permission rows (run with --verbose to list)`)
  if (process.argv.includes('--verbose')) console.log(plan.filter(p => p.startsWith('  perm')).join('\n'))
  console.log(`\n${plan.length} writes ${APPLY ? 'applied' : 'planned'}. Deletes: 0. Non-le_ objects touched: 0.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
