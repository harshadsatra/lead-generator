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

// Calling code + whether a leading 0 is a domestic trunk prefix to drop.
// ponytail: hand-kept list; switch to libphonenumber-js if many more countries or edge cases appear.
const CALLING: Record<string, [code: string, trunk: boolean]> = {
  IN: ['91', true], GB: ['44', true], US: ['1', false], CA: ['1', false], AU: ['61', true], NZ: ['64', true],
  IE: ['353', true], AE: ['971', true], SG: ['65', false], DE: ['49', true], FR: ['33', true], NL: ['31', true],
  ES: ['34', false], IT: ['39', false], ZA: ['27', true]
}
export const SUPPORTED_COUNTRIES = Object.keys(CALLING)

// E.164 ("+442078368427") so "020 7836 8427" and "+44 20 7836 8427" match.
export function normalizePhone(input: string | undefined, country: string): string | null {
  const first = (input ?? '').split(/[,;/]/)[0]!.trim()
  const digits = first.replace(/\D/g, '')
  if (digits.length < 7) return null
  if (first.startsWith('+')) return `+${digits}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  const c = CALLING[country]
  if (!c) return `+${digits}`
  const [code, trunk] = c
  if (trunk && digits.startsWith('0')) return `+${code}${digits.slice(1)}`
  if (digits.startsWith(code) && digits.length > 10) return `+${digits}`
  return `+${code}${digits}`
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

export { hash } from '@lead/shared/hash'

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
  placeId: ['placeid', 'googleplaceid', 'gbpplaceid'],
  hasWebsite: ['haswebsite', 'websiteavailable']
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
