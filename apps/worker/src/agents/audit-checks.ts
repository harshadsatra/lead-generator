export type NoSiteReason = 'no_website' | 'social_only' | 'unreachable' | 'parked' | 'under_construction' | 'default_page' | 'soft_404' | 'http_error'

export interface HtmlFacts {
  viewport: boolean
  contactForm: boolean
  cms: string | null
  cmsVersion: string | null
  noSite: NoSiteReason | null
  textLength: number
}

export interface Metrics extends Partial<HtmlFacts> {
  noSite: NoSiteReason | null
  hasSsl: boolean | null
  psiMobile: number | null
  psiDesktop: number | null
  lcpMs: number | null
  cls: number | null
  outdatedCms: boolean
}

export interface Issue {
  key: keyof Metrics
  text: string
}

const has = (html: string, re: RegExp) => re.test(html)

export function analyzeHtml(html: string, status: number): HtmlFacts {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = text.toLowerCase()
  const short = text.length < 3000

  let noSite: NoSiteReason | null = null
  if (status >= 400) noSite = 'http_error'
  else if (/domain (name )?(is|may be) for sale|buy this domain|this domain is parked|parked free|hugedomains|sedoparking|domain has expired/.test(lower)) noSite = 'parked'
  else if (/welcome to nginx|apache2? .*default page|it works!|index of \/|default web site page|website coming soon.*cpanel/.test(lower) && short) noSite = 'default_page'
  else if (/under construction|coming soon|launching soon|site is under maintenance|website is being built/.test(lower) && short) noSite = 'under_construction'
  else if (/\b404\b|page not found/.test(lower) && text.length < 1500) noSite = 'soft_404'

  const generator = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']generator["']/i)?.[1]
  let cms: string | null = null
  let cmsVersion: string | null = null
  if (has(html, /wp-content|wp-includes/i) || /wordpress/i.test(generator ?? '')) {
    cms = has(html, /woocommerce/i) ? 'WooCommerce' : 'WordPress'
    cmsVersion = generator?.match(/WordPress\s+([\d.]+)/i)?.[1] ?? html.match(/wp-includes\/[^"']*\?ver=(\d+\.\d+(\.\d+)?)/i)?.[1] ?? null
  } else if (has(html, /cdn\.shopify\.com|Shopify\.theme/i)) cms = 'Shopify'
  else if (has(html, /static\.wixstatic\.com|wix\.com website builder/i)) cms = 'Wix'
  else if (has(html, /squarespace/i)) cms = 'Squarespace'
  else if (has(html, /webflow/i)) cms = 'Webflow'
  else if (/joomla/i.test(generator ?? '')) cms = 'Joomla'

  const forms = html.match(/<form[\s\S]*?<\/form>/gi) ?? []
  const contactForm = forms.some(f => /type=["']?(email|tel)|<textarea|name=["'][^"']*(email|phone|message|enquiry|inquiry)/i.test(f))
    || has(html, /wpcf7|wpforms|gform_wrapper|elementor-form|typeform\.com|forms\.gle|jotform|hsforms/i)

  return {
    viewport: has(html, /<meta[^>]+name=["']?viewport/i),
    contactForm,
    cms,
    cmsVersion,
    noSite,
    textLength: text.length
  }
}

// ponytail: fixed cutoff; bump when WordPress 7 is the norm.
export const isOutdatedCms = (cms: string | null, version: string | null) =>
  (cms === 'WordPress' || cms === 'WooCommerce') && version !== null && Number.parseInt(version, 10) < 6

const NO_SITE_TEXT: Record<NoSiteReason, string> = {
  no_website: 'No website listed: customers searching online can only find the Google listing',
  social_only: 'Only a social media page, no website of their own',
  unreachable: 'Website does not load (the domain did not respond)',
  parked: 'Domain shows a parked / for-sale page instead of a website',
  under_construction: 'Website is stuck on an "under construction" / "coming soon" page',
  default_page: 'Domain shows a default server page, not a real website',
  soft_404: 'Homepage shows a "page not found" error',
  http_error: 'Homepage returns an error instead of loading'
}

// Ranked by business impact; every issue points at the metric that proves it.
export function buildIssues(m: Metrics): Issue[] {
  const out: Issue[] = []
  if (m.noSite) out.push({ key: 'noSite', text: NO_SITE_TEXT[m.noSite] })
  const lcp = m.lcpMs !== null ? `${(m.lcpMs / 1000).toFixed(1)}s` : null
  if (m.psiMobile !== null && m.psiMobile < 50) {
    out.push({ key: 'psiMobile', text: `Slow on phones: Google PageSpeed mobile score ${m.psiMobile}/100${lcp ? `, main content takes ${lcp} to appear` : ''}` })
  }
  if (!m.noSite && m.hasSsl === false) out.push({ key: 'hasSsl', text: 'No HTTPS: browsers mark the site "Not secure"' })
  if (!m.noSite && m.viewport === false) out.push({ key: 'viewport', text: 'Not built for mobile: the page does not adapt to phone screens' })
  if (!m.noSite && m.contactForm === false) out.push({ key: 'contactForm', text: 'No enquiry form on the homepage: visitors have no quick way to get in touch' })
  if (m.outdatedCms) out.push({ key: 'cmsVersion', text: `Runs an old WordPress (${m.cmsVersion}): security and speed updates are missing` })
  if (m.psiMobile !== null && m.psiMobile >= 50 && m.psiMobile < 70) {
    out.push({ key: 'psiMobile', text: `Could be faster on phones: PageSpeed mobile score ${m.psiMobile}/100` })
  }
  if (m.lcpMs !== null && m.lcpMs > 4000 && !out.some(i => i.key === 'psiMobile')) {
    out.push({ key: 'lcpMs', text: `Main content takes ${lcp} to appear on phones` })
  }
  return out.slice(0, 3)
}
