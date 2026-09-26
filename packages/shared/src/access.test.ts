import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canUseLeadEngine } from './access'

test('only admins and LE roles get in', () => {
  assert.equal(canUseLeadEngine({ adminAccess: true, roleName: null }), true)
  assert.equal(canUseLeadEngine({ adminAccess: false, roleName: 'LE Closer' }), true)
  assert.equal(canUseLeadEngine({ adminAccess: false, roleName: 'Client Editor' }), false)
  assert.equal(canUseLeadEngine({ adminAccess: false, roleName: 'LEAD Manager' }), false)
  assert.equal(canUseLeadEngine({ adminAccess: false, roleName: null }), false)
})
