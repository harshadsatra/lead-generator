import { createHash } from 'node:crypto'

const SOCIAL_HOSTS = ['facebook.com', 'fb.com', 'instagram.com', 'linktr.ee', 'wa.me', 'whatsapp.com', 'justdial.com', 'google.com', 'goo.gl', 'g.page']

export function normalizeWebsite(input: string | undefined): { url: string | null, domain: string | null, socialOnly: boolean } {
  const raw = (input ?? '').trim()
  if (!raw) return { url: null, domain: null, socialOnly: false }
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return { url: null, domain: null, socialOnly: false }
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  if (!host.includes('.')) return { url: null, domain: null, socialOnly: false }
  if (SOCIAL_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) return { url: u.href, domain: null, socialOnly: true }
  return { url: `${u.protocol}//${u.hostname}${u.pathname === '/' ? '' : u.pathname}`, domain: host, socialOnly: false }
}

// Indian numbers reduce to their last 10 digits so "+91 98200 12345" and "098200 12345" match.
export function normalizePhone(input: string | undefined): string | null {
  const digits = (input ?? '').split(/[,;/]/)[0]!.replace(/\D/g, '')
  if (digits.length < 8) return null
  if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) return digits.slice(-10)
  return digits
}

export function firstEmail(input: string | undefined): string | null {
  const m = (input ?? '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)
  return m ? m[0].toLowerCase() : null
}

// Review counts arrive as "120", "1,234 reviews" or "4.5 (120)"; ratings (decimals) are ignored.
export function parseCount(input: string | undefined): number | null {
  const ints = ((input ?? '').match(/\d[\d,]*(\.\d+)?/g) ?? []).filter(t => !t.includes('.'))
  const last = ints.at(-1)
  return last ? Number(last.replace(/,/g, '')) : null
}

export const hash = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex')

const ALIASES: Record<string, string[]> = {
  name: ['name', 'businessname', 'business', 'company', 'companyname', 'title'],
  website: ['website', 'websiteurl', 'url', 'site', 'domain', 'web'],
  phone: ['phone', 'phonenumber', 'mobile', 'contactnumber', 'contact', 'telephone'],
  email: ['email', 'emails', 'emailaddress', 'mail'],
  city: ['city', 'town'],
  locality: ['locality', 'area', 'neighbourhood', 'neighborhood', 'suburb'],
  category: ['category', 'categories', 'type', 'businesstype', 'industry'],
  reviews: ['reviews', 'reviewcount', 'reviewscount', 'totalreviews', 'userratingstotal', 'ratingcount', 'noofreviews'],
  ownerName: ['owner', 'ownername', 'contactname', 'decisionmaker', 'contactperson'],
  sourceUrl: ['sourceurl', 'googlemapsurl', 'mapsurl', 'mapslink', 'googlemapslink', 'gmblink', 'link', 'placeurl'],
  placeId: ['placeid', 'googleplaceid', 'gbpplaceid']
}
export type Field = keyof typeof ALIASES

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

export function mapColumns(headers: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {}
  for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
    const h = headers.find(h => aliases.includes(key(h)))
    if (h) out[field] = h
  }
  return out
}
