export interface FeedItem { title: string, link: string, published: string | null }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' }
const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m)
  .trim()

// RSS 2.0 <item>s: title, link, pubDate. No XML library needed for these feeds.
export function parseRss(xml: string): FeedItem[] {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([, item]) => {
    const tag = (name: string) => item!.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1]
    const date = tag('pubDate')
    return {
      title: decode(tag('title') ?? ''),
      link: decode(tag('link') ?? ''),
      published: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null
    }
  }).filter(i => i.title && /^https?:\/\//.test(i.link))
}

const VERB = /\s+(?:to\s+)?(?:raises?|secures?|bags?|nets?|gets?|receives?|mops up|picks up)\b/i
const ROUNDUP = /\bstartups?\s+(?:raised|raise|funding)\b|this week|roundup|weekly|funding galore|top \d+/i
const MONEY = /(\$|₹|rs\.?|inr|usd|mn\b|cr\b|crore|million|lakh|bn\b|seed|series [a-f]|pre-series|funding|round)/i
const DESCRIPTOR = /^(?:.*\b(?:startup|platform|brand|maker|company|firm|marketplace|app|player|provider|unicorn|major|fintech|edtech|healthtech|agritech|saas)\s+)?(?:[a-z]+-(?:based|bound|backed)\s+)?/i

// "Bengaluru-Based Fintech Startup Kiwi Raises $5 Mn In Seed Round" -> "Kiwi". Null for roundups / non-funding news.
export function fundingCompany(title: string): string | null {
  if (ROUNDUP.test(title)) return null
  const m = title.match(VERB)
  if (!m || m.index === undefined || !MONEY.test(title.slice(m.index))) return null
  const name = title.slice(0, m.index)
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/^(?:exclusive|breaking|report)\s*:\s*/i, '')
    .replace(/\s+in talks$/i, '')
    .replace(DESCRIPTOR, '')
    .replace(/['’]s$/i, '')
    .trim()
  if (name.length < 2 || name.split(/\s+/).length > 5 || /,|\bfrom\b|\band\b/i.test(name)) return null
  return name
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

const words = (s: string) => s.toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean)

// Only trust a Maps result that clearly is the same company: identical, or the company's words are the
// Maps name's first words ("Dextr AI" ~ "Dextr AI Technologies Pvt Ltd", but not "Rivet" ~ "Rivets India").
export function sameCompany(company: string, placeName: string): boolean {
  if (norm(company).length < 3) return false
  if (norm(company) === norm(placeName)) return true
  const a = words(company)
  const b = words(placeName)
  return a.length <= b.length && a.every((w, i) => b[i] === w)
}
