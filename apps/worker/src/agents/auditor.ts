import { analyzeHtml, buildIssues, isOutdatedCms, type Issue, type Metrics } from './audit-checks'

const UA = 'Mozilla/5.0 (compatible; ShwezSiteAudit/1.0; +https://shwezstudio.in)'

async function get(url: string) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) })
    return { ok: true as const, status: res.status, url: res.url, html: (await res.text()).slice(0, 2_000_000) }
  } catch (err) {
    return { ok: false as const, error: String((err as { cause?: { code?: string } }).cause?.code ?? (err as Error).message) }
  }
}

interface Psi { score: number | null, lcpMs: number | null, cls: number | null, error?: string }

// Quota, rate-limit, Google-side and network failures: retry later rather than score without speed data.
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
    if (res.status === 429 || res.status >= 500 || /quota/i.test(message)) throw new RetryableAuditError(`PageSpeed: ${message}`)
    if (!res.ok || !json.lighthouseResult) return { score: null, lcpMs: null, cls: null, error: message }
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
  metrics: Metrics & { finalUrl?: string, fetchError?: string, psiError?: string }
  issues: Issue[]
}

export async function auditSite(site: { domain: string | null, socialOnly: boolean }): Promise<AuditResult> {
  const empty = { hasSsl: null, psiMobile: null, psiDesktop: null, lcpMs: null, cls: null, outdatedCms: false }
  if (!site.domain) {
    const metrics = { ...empty, noSite: site.socialOnly ? 'social_only' as const : 'no_website' as const }
    return { metrics, issues: buildIssues(metrics) }
  }

  let page = await get(`https://${site.domain}`)
  let hasSsl = page.ok && page.url.startsWith('https://')
  if (!page.ok) {
    page = await get(`http://${site.domain}`)
    hasSsl = false
  }
  if (!page.ok) {
    const metrics = { ...empty, noSite: 'unreachable' as const, fetchError: page.error }
    return { metrics, issues: buildIssues(metrics) }
  }

  const facts = analyzeHtml(page.html, page.status)
  const [mobile, desktop] = facts.noSite
    ? [{ score: null, lcpMs: null, cls: null }, { score: null }] as [Psi, Psi]
    : await Promise.all([psi(page.url, 'mobile'), psi(page.url, 'desktop')])
  const metrics = {
    ...facts,
    hasSsl,
    psiMobile: mobile.score,
    psiDesktop: desktop.score,
    lcpMs: mobile.lcpMs,
    cls: mobile.cls,
    outdatedCms: isOutdatedCms(facts.cms, facts.cmsVersion),
    finalUrl: page.url,
    ...(mobile.error || desktop.error ? { psiError: mobile.error ?? desktop.error } : {})
  }
  return { metrics, issues: buildIssues(metrics) }
}
