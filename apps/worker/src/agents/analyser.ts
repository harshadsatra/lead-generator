import type { IntentSignal, ScoreFacts } from '@lead/shared'
import type { Metrics } from './audit-checks'

// Rule-based facts only (no LLM yet): intent/size signals beyond review count arrive with later scanners.
export function scoreFacts(input: {
  metrics: Metrics
  reviewCount: number | null
  segmentHasCaseStudy: boolean
  contactVerified: boolean
  signalFoundAt: string | null
  intentSignals?: IntentSignal[]
  now?: Date
}): ScoreFacts {
  const m = input.metrics
  const now = input.now ?? new Date()
  return {
    hasWorkingSite: m.noSite === null,
    psiMobile: m.psiMobile,
    hasSsl: m.hasSsl,
    brokenForms: false,
    outdatedCms: m.outdatedCms,
    intentSignals: input.intentSignals ?? [],
    reviewCount: input.reviewCount ?? 0,
    multipleLocations: false,
    activeAds: false,
    teamOf10Plus: false,
    segmentMatch: true,
    hasCaseStudy: input.segmentHasCaseStudy,
    verifiedEmail: input.contactVerified,
    whatsappBusiness: false,
    newestSignalAgeDays: input.signalFoundAt ? Math.floor((now.getTime() - new Date(input.signalFoundAt).getTime()) / 86_400_000) : null
  }
}

export function route(score: number, band: string, reviewCount: number | null, minReviews: number | null, chainBranch: string | null = null) {
  if (chainBranch) return { to: 'archived' as const, reason: `chain branch: website is a branch page (${chainBranch})` }
  if (reviewCount !== null && minReviews !== null && reviewCount < minReviews) {
    return { to: 'archived' as const, reason: `too small: ${reviewCount} reviews < ${minReviews}` }
  }
  if (band === 'archived') return { to: 'archived' as const, reason: `score ${score} < 50` }
  return { to: 'awaiting_approval' as const, reason: `${band} lead, score ${score}` }
}
