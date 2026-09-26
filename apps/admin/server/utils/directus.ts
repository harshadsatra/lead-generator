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

export async function directusLogin(body: { email: string, password: string, otp?: string }) {
  const { data } = await $fetch<{ data: DirectusTokens }>('/auth/login', {
    baseURL: baseURL(),
    method: 'POST',
    body: { ...body, mode: 'json' }
  })
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires }
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
