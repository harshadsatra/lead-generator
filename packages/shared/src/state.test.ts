import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LeadState } from './index'
import { assertTransition, canTransition } from './state'

// Edges copied by hand from the spec diagram, independent of TRANSITIONS.
const SPEC_EDGES = new Set([
  'discovered>enriched',
  'enriched>audited',
  'audited>scored',
  'scored>archived',
  'scored>awaiting_approval',
  'awaiting_approval>rejected',
  'awaiting_approval>approved',
  'approved>in_sequence',
  'in_sequence>replied',
  'in_sequence>closed_no_response',
  'replied>handed_to_admin',
  'replied>in_sequence',
  'replied>closed_lost',
  'replied>suppressed',
])

test('every state pair matches the spec diagram', () => {
  for (const from of LeadState.options) {
    for (const to of LeadState.options) {
      assert.equal(canTransition(from, to), SPEC_EDGES.has(`${from}>${to}`), `${from} -> ${to}`)
    }
  }
})

test('illegal transition throws', () => {
  assert.throws(() => assertTransition('discovered', 'approved'), /Illegal lead transition/)
  assert.doesNotThrow(() => assertTransition('scored', 'awaiting_approval'))
})
