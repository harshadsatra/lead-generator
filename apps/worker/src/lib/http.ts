// A normal browser UA: many small-business hosts refuse unknown bots, which would look like a broken site.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

export async function fetchPage(url: string) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, 'accept': 'text/html,application/xhtml+xml', 'accept-language': 'en-GB,en;q=0.9' }, signal: AbortSignal.timeout(15_000) })
    return { ok: true as const, status: res.status, url: res.url, html: (await res.text()).slice(0, 2_000_000) }
  } catch (err) {
    return { ok: false as const, error: String((err as { cause?: { code?: string } }).cause?.code ?? (err as Error).message) }
  }
}
