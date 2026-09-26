// Directus is shared with other projects: only Directus admins and "LE ..." roles may use the Lead Engine.
export const LE_ROLE_PREFIX = 'LE '

export function canUseLeadEngine(user: { adminAccess: boolean, roleName: string | null }): boolean {
  return user.adminAccess || (user.roleName?.startsWith(LE_ROLE_PREFIX) ?? false)
}
