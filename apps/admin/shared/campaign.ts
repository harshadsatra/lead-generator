import { z } from 'zod'

const LatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
// Plain text ("Andheri, Maharashtra") or a named map rectangle (searched inside its bounds).
export const Area = z.union([
  z.string().trim().min(2).max(100),
  z.object({ name: z.string().trim().min(2).max(100), bounds: z.object({ low: LatLng, high: LatLng }) })
])

export const SOURCES = { gbp: 'Google Maps', news: 'Startup news (Inc42, YourStory)' } as const

// Shared by the New campaign form and the server route.
export const CampaignInput = z.object({
  name: z.string().trim().min(3, 'Give the campaign a name').max(80),
  source: z.enum(['gbp', 'news']).default('gbp'),
  segment_id: z.uuid('Pick a segment'),
  country: z.string().regex(/^[A-Z]{2}$/, 'Pick a country'),
  query: z.string().trim().max(80).optional(),
  areas: z.array(Area).max(20, 'At most 20 areas per campaign').optional(),
  is_test: z.boolean().default(false)
}).superRefine((c, ctx) => {
  if (c.source !== 'gbp') return
  if (!c.query || c.query.length < 3) ctx.addIssue({ code: 'custom', path: ['query'], message: 'What should Google search for?' })
  if (!c.areas?.length) ctx.addIssue({ code: 'custom', path: ['areas'], message: 'Add at least one area' })
})
export type CampaignInput = z.infer<typeof CampaignInput>

export const CAMPAIGN_STATUS: Record<string, { label: string, color: 'neutral' | 'info' | 'success' | 'warning' | 'error' }> = {
  draft: { label: 'Draft', color: 'neutral' },
  scan_requested: { label: 'Scan queued', color: 'info' },
  scanning: { label: 'Scanning', color: 'info' },
  active: { label: 'Active', color: 'success' },
  paused: { label: 'Paused', color: 'warning' },
  scan_failed: { label: 'Scan failed', color: 'error' }
}
