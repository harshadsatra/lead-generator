import { z } from 'zod'

const text = (max: number) => z.string().trim().max(max).nullish().transform(v => v || null)

// Shared by the Segments page form and the server routes.
export const SegmentInput = z.object({
  name: z.string().trim().min(3, 'Give the segment a name').max(80),
  signals: text(500),
  service: text(200),
  case_studies: text(500),
  icp: text(2000),
  min_budget: z.number().int().min(0).nullish().transform(v => v ?? null)
})
export type SegmentInput = z.input<typeof SegmentInput>

export const SEGMENT_FIELDS = 'id,name,signals,service,case_studies,icp,min_budget'
