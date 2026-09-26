import { test } from 'node:test'
import assert from 'node:assert/strict'
import { band, DEFAULT_WEIGHTS, scoreLead, type ScoreFacts } from './rubric'

const empty: ScoreFacts = {
  hasWorkingSite: true,
  psiMobile: 95,
  hasSsl: true,
  brokenForms: false,
  outdatedCms: false,
  intentSignals: [],
  reviewCount: 0,
  multipleLocations: false,
  activeAds: false,
  teamOf10Plus: false,
  segmentMatch: false,
  hasCaseStudy: false,
  verifiedEmail: false,
  whatsappBusiness: false,
  newestSignalAgeDays: null,
}

const perfect: ScoreFacts = {
  ...empty,
  hasWorkingSite: false,
  intentSignals: ['explicit_ask'],
  reviewCount: 120,
  multipleLocations: true,
  activeAds: true,
  segmentMatch: true,
  hasCaseStudy: true,
  verifiedEmail: true,
  newestSignalAgeDays: 3,
}

test('band edges', () => {
  assert.equal(band(70), 'hot')
  assert.equal(band(69), 'warm')
  assert.equal(band(50), 'warm')
  assert.equal(band(49), 'archived')
})

test('bounds and breakdown sum', () => {
  assert.deepEqual(scoreLead(empty).score, 0)
  const r = scoreLead(perfect)
  assert.equal(r.score, 100)
  assert.equal(r.band, 'hot')
  assert.deepEqual(r.breakdown, DEFAULT_WEIGHTS)
})

test('same facts give same score', () => {
  const facts = { ...empty, psiMobile: 32, reviewCount: 60, segmentMatch: true, verifiedEmail: true }
  assert.deepEqual(scoreLead(facts), scoreLead({ ...facts }))
  // need 15 + size 10 + segmentFit 7.5 + reachability 10 = 42.5 -> 43
  assert.equal(scoreLead(facts).score, 43)
})

test('weights must sum to 100', () => {
  assert.throws(() => scoreLead(empty, { ...DEFAULT_WEIGHTS, need: 40 }), /sum to 100/)
})
