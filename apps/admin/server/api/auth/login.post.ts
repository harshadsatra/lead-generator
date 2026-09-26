import { z } from 'zod'
import { canUseLeadEngine } from '@lead/shared'

const Body = z.object({
  email: z.email(),
  password: z.string().min(1),
  otp: z.string().trim().min(1).optional()
})

interface Me {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: { name: string } | null
}

export default defineEventHandler(async (event) => {
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid email or password' })
  const body = parsed.data

  let tokens
  try {
    tokens = await directusLogin(body)
  } catch (err) {
    const code = directusErrorCode(err)
    if (code === 'INVALID_OTP') {
      throw createError({ statusCode: 401, message: body.otp ? 'Invalid authenticator code' : 'Enter your authenticator code', data: { otpRequired: true } })
    }
    if (code === 'INVALID_CREDENTIALS' || code === 'INVALID_PAYLOAD') {
      throw createError({ statusCode: 401, message: 'Invalid email or password' })
    }
    if (code === 'REQUESTS_EXCEEDED') {
      throw createError({ statusCode: 429, message: 'Too many attempts, try again in a minute' })
    }
    throw createError({ statusCode: 502, message: 'Could not reach Directus' })
  }

  const [me, globals] = await Promise.all([
    directusGet<Me>(tokens.accessToken, '/users/me', { fields: 'id,email,first_name,last_name,role.name' }),
    directusGet<{ admin_access?: boolean }>(tokens.accessToken, '/policies/me/globals')
  ])
  const isAdmin = globals.admin_access === true
  const role = me.role?.name ?? null

  if (!canUseLeadEngine({ adminAccess: isAdmin, roleName: role })) {
    await directusLogout(tokens.refreshToken)
    throw createError({ statusCode: 403, message: 'This account does not have Lead Engine access' })
  }

  await setUserSession(event, {
    user: {
      id: me.id,
      email: me.email,
      name: [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email,
      role,
      isAdmin
    },
    secure: tokens
  })
  return { ok: true }
})
