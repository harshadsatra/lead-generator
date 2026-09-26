import type { H3Event } from 'h3'

interface DirectusTokens {
  access_token: string
  refresh_token: string
  expires: number
}

type Query = Record<string, string | number | boolean>
interface Req { method?: 'GET' | 'POST' | 'PATCH', query?: Query, body?: Record<string, unknown> }

const baseURL = () => useRuntimeConfig().directusUrl

export function directusErrorCode(err: unknown): string | undefined {
  return (err as { data?: { errors?: { extensions?: { code?: string } }[] } }).data?.errors?.[0]?.extensions?.code
}

const toTokens = (d: DirectusTokens) => ({ accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: Date.now() + d.expires })

export async function directusLogin(body: { email: string, password: string, otp?: string }) {
  const { data } = await $fetch<{ data: DirectusTokens }>('/auth/login', {
    baseURL: baseURL(),
    method: 'POST',
    body: { ...body, mode: 'json' }
  })
  return toTokens(data)
}

// Directus rotates refresh tokens, so parallel requests must share one refresh.
const refreshing = new Map<string, Promise<ReturnType<typeof toTokens>>>()

function refresh(refreshToken: string) {
  let p = refreshing.get(refreshToken)
  if (!p) {
    p = $fetch<{ data: DirectusTokens }>('/auth/refresh', {
      baseURL: baseURL(),
      method: 'POST',
      body: { refresh_token: refreshToken, mode: 'json' }
    }).then(r => toTokens(r.data)).finally(() => setTimeout(() => refreshing.delete(refreshToken), 30_000))
    refreshing.set(refreshToken, p)
  }
  return p
}

// Calls Directus as the signed-in user, so their LE role's permissions apply.
export async function directusAsUser<T>(event: H3Event, path: string, req: Req = {}): Promise<T> {
  const session = await requireUserSession(event)
  let tokens = session.secure!
  if (tokens.expiresAt - Date.now() < 60_000) {
    try {
      tokens = await refresh(tokens.refreshToken)
    } catch {
      await clearUserSession(event)
      throw createError({ statusCode: 401, message: 'Session expired, sign in again' })
    }
    await setUserSession(event, { secure: tokens })
  }
  try {
    return await request<T>(tokens.accessToken, path, req)
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 403) throw createError({ statusCode: 403, message: 'Your role is not allowed to do this' })
    throw err
  }
}

export async function directusLogout(refreshToken: string) {
  await $fetch('/auth/logout', { baseURL: baseURL(), method: 'POST', body: { refresh_token: refreshToken, mode: 'json' } })
    .catch(() => {})
}

async function request<T>(accessToken: string, path: string, req: Req) {
  const { data } = await $fetch<{ data: T }>(path, {
    baseURL: baseURL(),
    method: req.method ?? 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    query: req.query,
    body: req.body
  })
  return data
}

export const directusGet = <T>(accessToken: string, path: string, query?: Query) => request<T>(accessToken, path, { query })
