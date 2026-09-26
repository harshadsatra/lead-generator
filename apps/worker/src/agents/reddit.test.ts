import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuery, matchPhrase } from './reddit-match'

test('query ORs quoted phrases', () => {
  assert.equal(buildQuery(['need a website', 'web "developer"']), '"need a website" OR "web developer"')
})

test('keeps only posts that really contain a phrase', () => {
  const phrases = ['need a website', 'looking for a web developer']
  assert.equal(matchPhrase({ title: '[Hiring] Looking for a web developer in Pune', selftext: '' }, phrases), 'looking for a web developer')
  assert.equal(matchPhrase({ title: 'Bakery owner', selftext: 'We NEED A WEBSITE for orders' }, phrases), 'need a website')
  assert.equal(matchPhrase({ title: 'Best web hosting?', selftext: 'which host is good' }, phrases), null)
})
