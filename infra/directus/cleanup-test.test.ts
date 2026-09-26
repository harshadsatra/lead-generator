import { test } from 'node:test'
import assert from 'node:assert/strict'
import { businessesToDelete } from './cleanup-test.ts'

test('keeps businesses a real campaign still uses', () => {
  assert.deepEqual(businessesToDelete(['a', 'b', 'b', 'c'], ['b']), ['a', 'c'])
  assert.deepEqual(businessesToDelete(['a'], ['a']), [])
  assert.deepEqual(businessesToDelete([], []), [])
})
