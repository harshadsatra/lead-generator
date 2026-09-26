const UA = 'Mozilla/5.0 (compatible; ShwezSiteAudit/1.0; +https://shwezstudio.in)'

export async function fetchPage(url: string) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) })
    return { ok: true as const, status: res.status, url: res.url, html: (await res.text()).slice(0, 2_000_000) }
  } catch (err) {
    return { ok: false as const, error: String((err as { cause?: { code?: string } }).cause?.code ?? (err as Error).message) }
  }
}
