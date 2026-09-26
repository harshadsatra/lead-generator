declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: string | null
    isAdmin: boolean
  }

  // Server-only: never sent to the browser.
  interface SecureSessionData {
    accessToken: string
    refreshToken: string
    expiresAt: number
  }
}

export {}
