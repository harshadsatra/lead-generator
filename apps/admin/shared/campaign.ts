import { z } from 'zod'

// Shared by the New campaign form and the server route.
export const CampaignInput = z.object({
  name: z.string().trim().min(3, 'Give the campaign a name').max(80),
  segment_id: z.uuid('Pick a segment'),
  country: z.string().regex(/^[A-Z]{2}$/, 'Pick a country'),
  query: z.string().trim().min(3, 'What should Google search for?').max(80),
  areas: z.array(z.string().trim().min(2).max(100)).min(1, 'Add at least one area').max(20, 'At most 20 areas per campaign'),
  is_test: z.boolean().default(false)
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
