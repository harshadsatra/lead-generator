import type { Band } from './index'

export type Factor = 'need' | 'intent' | 'size' | 'segmentFit' | 'reachability' | 'recency'
export type Weights = Record<Factor, number>

export const DEFAULT_WEIGHTS: Weights = {
  need: 30,
  intent: 20,
  size: 20,
  segmentFit: 15,
  reachability: 10,
  recency: 5,
}

export type IntentSignal = 'explicit_ask' | 'funding' | 'hiring' | 'new_location'

export interface ScoreFacts {
  hasWorkingSite: boolean
  psiMobile: number | null
  hasSsl: boolean | null
  brokenForms: boolean
  outdatedCms: boolean
  intentSignals: IntentSignal[]
  reviewCount: number
  multipleLocations: boolean
  activeAds: boolean
  teamOf10Plus: boolean
  segmentMatch: boolean
  hasCaseStudy: boolean
  verifiedEmail: boolean
  whatsappBusiness: boolean
  newestSignalAgeDays: number | null
}

const cap = (n: number) => Math.min(1, n)

// Each factor returns 0..1; partial credits are Harshad-reviewable defaults, not from the spec.
const FACTORS: Record<Factor, (f: ScoreFacts) => number> = {
  need: (f) => {
    if (!f.hasWorkingSite) return 1
    let n = 0
    if (f.psiMobile !== null) n += f.psiMobile < 40 ? 0.5 : f.psiMobile < 70 ? 0.25 : 0
    if (f.hasSsl === false) n += 0.5
    if (f.brokenForms) n += 0.5
    if (f.outdatedCms) n += 0.25
    return cap(n)
  },
  intent: (f) => {
    if (f.intentSignals.includes('explicit_ask')) return 1
    const n = new Set(f.intentSignals).size
    return n >= 2 ? 1 : n === 1 ? 0.6 : 0
  },
  size: (f) =>
    cap(
      (f.reviewCount >= 50 ? 0.5 : f.reviewCount >= 20 ? 0.25 : 0)
      + (f.multipleLocations ? 0.25 : 0)
      + (f.activeAds ? 0.25 : 0)
      + (f.teamOf10Plus ? 0.25 : 0),
    ),
  segmentFit: (f) => (f.segmentMatch ? (f.hasCaseStudy ? 1 : 0.5) : 0),
  reachability: (f) => (f.verifiedEmail ? 1 : f.whatsappBusiness ? 0.6 : 0),
  recency: (f) =>
    f.newestSignalAgeDays === null ? 0 : f.newestSignalAgeDays <= 14 ? 1 : f.newestSignalAgeDays <= 30 ? 0.5 : 0,
}

export function band(score: number): Band {
  return score >= 70 ? 'hot' : score >= 50 ? 'warm' : 'archived'
}

export function scoreLead(facts: ScoreFacts, weights: Weights = DEFAULT_WEIGHTS) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total !== 100) throw new Error(`Scoring weights must sum to 100, got ${total}`)
  const breakdown = {} as Record<Factor, number>
  for (const k of Object.keys(FACTORS) as Factor[]) breakdown[k] = Math.round(FACTORS[k](facts) * weights[k] * 10) / 10
  const score = Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0))
  return { score, band: band(score), breakdown }
}
