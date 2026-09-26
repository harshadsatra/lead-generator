// Node-only (reads process.env): import via "@lead/shared/directus", never from browser code.
export function directus(token: string | undefined) {
  const base = process.env.DIRECTUS_URL
  if (!base || !token) throw new Error('DIRECTUS_URL and a Directus token must be set in .env')
  return async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const json = res.status === 204 ? {} : await res.json() as { data?: T, errors?: unknown }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify((json as { errors?: unknown }).errors)}`)
    return (json as { data: T }).data
  }
}

export const q = (filter: unknown) => encodeURIComponent(JSON.stringify(filter))
