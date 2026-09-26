// Calling code + whether a leading 0 is a domestic trunk prefix to drop.
// ponytail: hand-kept list; switch to libphonenumber-js if many more countries or edge cases appear.
const CALLING: Record<string, [code: string, trunk: boolean]> = {
  IN: ['91', true], GB: ['44', true], US: ['1', false], CA: ['1', false], AU: ['61', true], NZ: ['64', true],
  IE: ['353', true], AE: ['971', true], SG: ['65', false], DE: ['49', true], FR: ['33', true], NL: ['31', true],
  ES: ['34', false], IT: ['39', false], ZA: ['27', true]
}
export const SUPPORTED_COUNTRIES = Object.keys(CALLING)

export const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', GB: 'United Kingdom', US: 'United States', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand',
  IE: 'Ireland', AE: 'United Arab Emirates', SG: 'Singapore', DE: 'Germany', FR: 'France', NL: 'Netherlands',
  ES: 'Spain', IT: 'Italy', ZA: 'South Africa'
}

// E.164 ("+442078368427") so "020 7836 8427" and "+44 20 7836 8427" match.
export function normalizePhone(input: string | undefined, country: string): string | null {
  const first = (input ?? '').split(/[,;/]/)[0]!.trim()
  const digits = first.replace(/\D/g, '')
  if (digits.length < 7) return null
  if (first.startsWith('+')) return `+${digits}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  const c = CALLING[country]
  if (!c) return `+${digits}`
  const [code, trunk] = c
  if (trunk && digits.startsWith('0')) return `+${code}${digits.slice(1)}`
  if (digits.startsWith(code) && digits.length > 10) return `+${digits}`
  return `+${code}${digits}`
}
