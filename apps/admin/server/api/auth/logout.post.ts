export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (session.secure?.refreshToken) await directusLogout(session.secure.refreshToken)
  await clearUserSession(event)
  return { ok: true }
})
