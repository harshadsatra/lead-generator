import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from './decision'

test('approve sets offer; mockup only for hot', () => {
  assert.deepEqual(decide({ state: 'awaiting_approval', band: 'warm' }, { action: 'approve', offer: 'audit_pdf' }).fields, { offer: 'audit_pdf' })
  assert.throws(() => decide({ state: 'awaiting_approval', band: 'warm' }, { action: 'approve', offer: 'mockup' }), /hot leads only/)
  assert.equal(decide({ state: 'awaiting_approval', band: 'hot' }, { action: 'approve', offer: 'mockup' }).to, 'approved')
})

test('reject records reason; only from awaiting_approval', () => {
  assert.deepEqual(decide({ state: 'awaiting_approval', band: 'warm' }, { action: 'reject', reason: 'Too small' }).fields, { closed_reason: 'rejected: Too small' })
  assert.throws(() => decide({ state: 'approved', band: 'hot' }, { action: 'reject', reason: 'x' }), /Illegal lead transition/)
  assert.throws(() => decide({ state: 'archived', band: null }, { action: 'approve', offer: 'call_only' }), /Illegal lead transition/)
})
