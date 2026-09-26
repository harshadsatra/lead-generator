import { test } from 'node:test'
import assert from 'node:assert/strict'
import { route } from './analyser'

test('routing: too-small businesses archived, unknown review counts not penalised', () => {
  assert.deepEqual(route(60, 'warm', 3, 10), { to: 'archived', reason: 'too small: 3 reviews < 10' })
  assert.equal(route(60, 'warm', 10, 10).to, 'awaiting_approval')
  assert.equal(route(60, 'warm', null, 10).to, 'awaiting_approval')
  assert.equal(route(60, 'warm', 3, null).to, 'awaiting_approval')
  assert.deepEqual(route(40, 'archived', 200, 10), { to: 'archived', reason: 'score 40 < 50' })
})
