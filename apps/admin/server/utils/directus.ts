import type { H3Event } from 'h3'

interface DirectusTokens {
  access_token: string
  refresh_token: string
  expires: number
}

type Query = Record<string, string | number | boolean>

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
export async function directusAsUser<T>(event: H3Event, path: string, query?: Query): Promise<T> {
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
  return directusGet<T>(tokens.accessToken, path, query)
}

export async function directusLogout(refreshToken: string) {
  await $fetch('/auth/logout', { baseURL: baseURL(), method: 'POST', body: { refresh_token: refreshToken, mode: 'json' } })
    .catch(() => {})
}

export async function directusGet<T>(accessToken: string, path: string, query?: Query) {
  const { data } = await $fetch<{ data: T }>(path, {
    baseURL: baseURL(),
    headers: { Authorization: `Bearer ${accessToken}` },
    query
  })
  return data
}
