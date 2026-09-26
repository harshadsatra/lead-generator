import { fetchPage } from '../lib/http'
import { contactLinks, extractEmails, pickEmail } from './enrich-extract'

// Enricher v0: an email the business publishes on its own site (homepage, then up to 2 contact/about pages).
// Hunter.io and SMTP verification (spec waterfall) come after the Phase 0 gate.
export async function findPublishedEmail(domain: string) {
  const home = await fetchPage(`https://${domain}`)
  const page = home.ok ? home : await fetchPage(`http://${domain}`)
  if (!page.ok) return null

  const found = extractEmails(page.html).map(email => ({ email, url: page.url }))
  const best = pickEmail(found, domain)
  if (best?.rank === 0) return best

  for (const url of contactLinks(page.html, page.url)) {
    const sub = await fetchPage(url)
    if (sub.ok) found.push(...extractEmails(sub.html).map(email => ({ email, url: sub.url })))
  }
  return pickEmail(found, domain)
}
