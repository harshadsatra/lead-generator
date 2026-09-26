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

export { normalizePhone, SUPPORTED_COUNTRIES } from '@lead/shared'

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

// Chains list a branch page (".../estate-agents/covent-garden", ".../our-branches/west-end") as the
// website; independents list their homepage. Returns the path as evidence, or null.
const BRANCH_SEGMENT = /^(branch|branches|our-branches|find-a-branch|office|offices|our-offices|location|locations|our-locations|store|stores|store-locator|estate-agents|letting-agents|showrooms?|clinics|restaurants)$/i
export function chainBranchPath(url: string | null): string | null {
  if (!url || !URL.canParse(url)) return null
  const parts = new URL(url).pathname.split('/').filter(Boolean)
  return parts.length >= 2 && parts.slice(0, -1).some(p => BRANCH_SEGMENT.test(p)) ? `/${parts.join('/')}` : null
}
