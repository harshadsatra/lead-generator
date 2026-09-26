import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafe, ours } from './setup.ts'

ours.policies.add('p-ours')
ours.roles.add('r-ours')

test('allows only le_ / LE writes', () => {
  assert.doesNotThrow(() => assertSafe('POST', '/collections', { collection: 'le_leads' }))
  assert.doesNotThrow(() => assertSafe('POST', '/fields/le_leads', { field: 'x' }))
  assert.doesNotThrow(() => assertSafe('POST', '/relations', { collection: 'le_leads' }))
  assert.doesNotThrow(() => assertSafe('POST', '/roles', { name: 'LE Closer' }))
  assert.doesNotThrow(() => assertSafe('POST', '/access', { role: 'r-ours', policy: 'p-ours' }))
  assert.doesNotThrow(() => assertSafe('POST', '/permissions', { policy: 'p-ours', collection: 'le_leads', action: 'update' }))
  assert.doesNotThrow(() => assertSafe('POST', '/permissions', { policy: 'p-ours', collection: 'directus_users', action: 'read' }))
  assert.doesNotThrow(() => assertSafe('PATCH', '/items/le_global_config', {}))
  assert.doesNotThrow(() => assertSafe('PATCH', '/relations/le_messages/lead_id', { meta: { one_field: 'messages' } }))
})

test('refuses anything touching other projects', () => {
  const bad: [string, string, Record<string, unknown>][] = [
    ['POST', '/collections', { collection: 'projects' }],
    ['POST', '/fields/projects', { field: 'x' }],
    ['POST', '/relations', { collection: 'enquiry' }],
    ['POST', '/roles', { name: 'Customer' }],
    ['POST', '/policies', { name: 'Administrator' }],
    ['POST', '/access', { role: 'someone-elses-role', policy: 'p-ours' }],
    ['POST', '/access', { role: 'r-ours', policy: 'Administrator-policy' }],
    ['POST', '/permissions', { policy: 'someone-elses', collection: 'le_leads', action: 'read' }],
    ['POST', '/permissions', { policy: 'p-ours', collection: 'projects', action: 'read' }],
    ['POST', '/permissions', { policy: 'p-ours', collection: 'directus_users', action: 'update' }],
    ['POST', '/items/enquiry', {}],
    ['PATCH', '/collections/projects', {}],
    ['DELETE', '/collections/le_leads', {}],
    ['DELETE', '/items/le_leads', {}],
    ['PATCH', '/relations/projects/owner', { meta: {} }],
    ['PATCH', '/relations/le_messages/lead_id', { schema: { on_delete: 'NO ACTION' } }]
  ]
  for (const [m, p, b] of bad) assert.throws(() => assertSafe(m, p, b), /Refusing unsafe write/, `${m} ${p}`)
})
