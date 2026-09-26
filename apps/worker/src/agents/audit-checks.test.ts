import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeHtml, buildIssues, failedFetchVerdict, isOutdatedCms, type Metrics } from './audit-checks'

const page = (body: string, head = '') => `<html><head>${head}</head><body>${body}</body></html>`
const long = 'Our menu and story. '.repeat(200)

test('healthy WordPress page with contact form', () => {
  const f = analyzeHtml(page(`${long}<form><input type="email"><textarea></textarea></form>`, '<meta name="viewport" content="width=device-width"><meta name="generator" content="WordPress 5.4.2"><link href="/wp-content/x.css">'), 200)
  assert.deepEqual(f, { viewport: true, contactForm: true, cms: 'WordPress', cmsVersion: '5.4.2', noSite: null, textLength: f.textLength })
  assert.equal(isOutdatedCms(f.cms, f.cmsVersion), true)
  assert.equal(isOutdatedCms('WordPress', '6.5'), false)
})

test('no-working-site detection', () => {
  assert.equal(analyzeHtml(page('This domain is for sale! Buy this domain today.'), 200).noSite, 'parked')
  assert.equal(analyzeHtml(page('Coming soon. Our website is under construction.'), 200).noSite, 'under_construction')
  assert.equal(analyzeHtml(page('Welcome to nginx! If you see this page...'), 200).noSite, 'default_page')
  assert.equal(analyzeHtml(page('404 Page not found'), 200).noSite, 'soft_404')
  assert.equal(analyzeHtml(page('Oops'), 503).noSite, 'http_error')
  // Long real page mentioning "coming soon" is not a placeholder.
  assert.equal(analyzeHtml(page(`${long} New branch coming soon!`), 200).noSite, null)
})

test('cms + form detection', () => {
  assert.equal(analyzeHtml(page(long, '<script src="https://cdn.shopify.com/x.js"></script>'), 200).cms, 'Shopify')
  assert.equal(analyzeHtml(page(`${long}<div class="wpcf7">x</div>`), 200).contactForm, true)
  assert.equal(analyzeHtml(page(`${long}<form><input type="search"></form>`), 200).contactForm, false)
})

const base: Metrics = { noSite: null, hasSsl: true, psiMobile: 85, psiDesktop: 95, lcpMs: 1800, cls: 0.01, outdatedCms: false, viewport: true, contactForm: true, cmsVersion: null }

test('issues ranked by impact, max 3, each tied to a metric', () => {
  assert.deepEqual(buildIssues(base), [])
  const bad = buildIssues({ ...base, psiMobile: 23, lcpMs: 7200, hasSsl: false, viewport: false, contactForm: false })
  assert.deepEqual(bad.map(i => i.key), ['psiMobile', 'hasSsl', 'viewport'])
  assert.match(bad[0]!.text, /23\/100.*7\.2s/)
  const noSite = buildIssues({ ...base, noSite: 'parked', hasSsl: false, psiMobile: null, lcpMs: null })
  assert.deepEqual(noSite.map(i => i.key), ['noSite'])
})

test('a site is only "broken" when Google cannot load it either, and never when blocked', () => {
  const lh = (msg: string) => ({ score: null, error: `Lighthouse returned error: ${msg}` })
  assert.deepEqual(failedFetchVerdict({ ok: true, status: 403 }, { score: 99 }), { blocked: true, noSite: null })
  assert.deepEqual(failedFetchVerdict({ ok: false }, { score: 42 }), { blocked: false, noSite: null })
  assert.deepEqual(failedFetchVerdict({ ok: true, status: 404 }, { score: 62 }), { blocked: false, noSite: null })
  assert.deepEqual(failedFetchVerdict({ ok: false }, lh('FAILED_DOCUMENT_REQUEST')), { blocked: false, noSite: 'unreachable' })
  assert.deepEqual(failedFetchVerdict({ ok: true, status: 500 }, lh('ERRORED_DOCUMENT_REQUEST (Status code: 500)')), { blocked: false, noSite: 'http_error' })
  assert.deepEqual(failedFetchVerdict({ ok: true, status: 500 }, lh('ERRORED_DOCUMENT_REQUEST (Status code: 403)')), { blocked: true, noSite: null })
})
