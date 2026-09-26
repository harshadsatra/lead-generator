import { fetchPage as get } from '../lib/http'
import { analyzeHtml, buildIssues, failedFetchVerdict, isOutdatedCms, type Issue, type Metrics } from './audit-checks'

interface Psi { score: number | null, lcpMs: number | null, cls: number | null, error?: string }

// Any PageSpeed failure (bad key, quota, Google outage, network) leaves the lead for retry,
// except Lighthouse failing to load the page, which is a real finding about the site.
export class RetryableAuditError extends Error {}

async function psi(url: string, strategy: 'mobile' | 'desktop'): Promise<Psi> {
  const q = new URLSearchParams({ url, strategy, category: 'performance' })
  if (process.env.PAGESPEED_API_KEY) q.set('key', process.env.PAGESPEED_API_KEY)
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(120_000) })
    const json = await res.json() as {
      error?: { message: string }
      lighthouseResult?: { categories: { performance: { score: number | null } }, audits: Record<string, { numericValue?: number }> }
    }
    const message = json.error?.message ?? `HTTP ${res.status}`
    if (/Lighthouse returned error/i.test(message)) return { score: null, lcpMs: null, cls: null, error: message }
    if (!res.ok || !json.lighthouseResult) throw new RetryableAuditError(`PageSpeed: ${message}`)
    const lr = json.lighthouseResult
    const score = lr.categories.performance.score
    const lcp = lr.audits['largest-contentful-paint']?.numericValue
    const cls = lr.audits['cumulative-layout-shift']?.numericValue
    return {
      score: score === null ? null : Math.round(score * 100),
      lcpMs: lcp === undefined ? null : Math.round(lcp),
      cls: cls === undefined ? null : Math.round(cls * 1000) / 1000
    }
  } catch (err) {
    if (err instanceof RetryableAuditError) throw err
    throw new RetryableAuditError(`PageSpeed: ${(err as Error).message}`)
  }
}

export interface AuditResult {
  metrics: Metrics & { finalUrl?: string, fetchError?: string, psiError?: string, blocked?: boolean }
  issues: Issue[]
}

export async function auditSite(site: { domain: string | null, socialOnly: boolean }): Promise<AuditResult> {
  const empty = { hasSsl: null, psiMobile: null, psiDesktop: null, lcpMs: null, cls: null, outdatedCms: false }
  if (!site.domain) {
    const metrics = { ...empty, noSite: site.socialOnly ? 'social_only' as const : 'no_website' as const }
    return { metrics, issues: buildIssues(metrics) }
  }

  let page = await get(`https://${site.domain}`)
  let hasSsl: boolean | null = page.ok && page.url.startsWith('https://')
  if (!page.ok) {
    page = await get(`http://${site.domain}`)
    hasSsl = page.ok ? false : null
  }

  const facts = page.ok && page.status < 400 ? analyzeHtml(page.html, page.status) : null
  if (facts?.noSite) {
    const metrics = { ...empty, ...facts, hasSsl, finalUrl: page.ok ? page.url : undefined }
    return { metrics, issues: buildIssues(metrics) }
  }

  const target = page.ok ? page.url : `https://${site.domain}`
  const [mobile, desktop] = await Promise.all([psi(target, 'mobile'), psi(target, 'desktop')])
  const psiFields = {
    psiMobile: mobile.score,
    psiDesktop: desktop.score,
    lcpMs: mobile.lcpMs,
    cls: mobile.cls,
    ...(mobile.error || desktop.error ? { psiError: mobile.error ?? desktop.error } : {})
  }

  if (!facts) {
    const { blocked, noSite } = failedFetchVerdict(page.ok ? { ok: true, status: page.status } : { ok: false }, mobile)
    const metrics = {
      ...empty, ...psiFields, noSite, hasSsl: noSite ? null : hasSsl,
      blocked, fetchError: page.ok ? `HTTP ${page.status}` : page.error
    }
    return { metrics, issues: buildIssues(metrics) }
  }

  const metrics = { ...facts, ...psiFields, hasSsl, outdatedCms: isOutdatedCms(facts.cms, facts.cmsVersion), finalUrl: page.url }
  return { metrics, issues: buildIssues(metrics) }
}
