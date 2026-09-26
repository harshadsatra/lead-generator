import type { ScoreFacts } from '@lead/shared'
import type { Metrics } from './audit-checks'

// Rule-based facts only (no LLM yet): intent/size signals beyond review count arrive with later scanners.
export function scoreFacts(input: {
  metrics: Metrics
  reviewCount: number | null
  segmentHasCaseStudy: boolean
  contactVerified: boolean
  signalFoundAt: string | null
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
    intentSignals: [],
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
