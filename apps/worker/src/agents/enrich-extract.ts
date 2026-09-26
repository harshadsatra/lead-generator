const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi
const JUNK = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(sentry|wixpress|sentry-next|example)\.|^(noreply|no-reply|donotreply|do-not-reply)@|^[0-9a-f]{16,}@/i
const ROLE = /^(info|contact|hello|enquir\w*|inquir\w*|sales|office|admin|mail|team|bookings?|reception|lettings|hi)@/i
const FREEMAIL = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|aol|proton(mail)?|zoho|rediffmail)\./i

export function extractEmails(html: string): string[] {
  const decoded = html
    .replace(/&#0*64;|&#x0*40;/gi, '@')
    .replace(/&#0*46;|&#x0*2e;/gi, '.')
    .replace(/%40/g, '@')
  const found = decoded.match(EMAIL_RE) ?? []
  return [...new Set(found.map(e => e.toLowerCase().replace(/^mailto:/, '')))].filter(e => !JUNK.test(e))
}

// 0 = role address on their domain, 1 = other address on their domain, 2 = free-mail; null = someone else's domain.
export function emailRank(email: string, domain: string): number | null {
  const host = email.split('@')[1] ?? ''
  const own = host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`)
  if (own) return ROLE.test(email) ? 0 : 1
  if (FREEMAIL.test(email)) return 2
  return null
}

export function pickEmail(found: { email: string, url: string }[], domain: string) {
  return found
    .map(f => ({ ...f, rank: emailRank(f.email, domain) }))
    .filter((f): f is { email: string, url: string, rank: number } => f.rank !== null)
    .sort((a, b) => a.rank - b.rank)[0] ?? null
}

// Contact-type pages first, about pages only as a fallback.
export function contactLinks(html: string, pageUrl: string, max = 2): string[] {
  const base = new URL(pageUrl)
  const found: { url: string, rank: number }[] = []
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, text] = m
    const label = `${href} ${text}`
    const rank = /contact|enquir|get.in.touch|reach.us|find.us/i.test(label) ? 0 : /about/i.test(label) ? 1 : -1
    if (rank < 0) continue
    let u: URL
    try {
      u = new URL(href!, base)
    } catch {
      continue
    }
    if (u.hostname !== base.hostname || !/^https?:$/.test(u.protocol)) continue
    const clean = `${u.origin}${u.pathname}`
    if (clean !== `${base.origin}${base.pathname}` && !found.some(f => f.url === clean)) found.push({ url: clean, rank })
  }
  return found.sort((a, b) => a.rank - b.rank).slice(0, max).map(f => f.url)
}
