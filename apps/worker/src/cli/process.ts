// pnpm le:process --campaign "<name>" [--concurrency 3]
// Enriches, audits and scores every lead in the campaign still in the pipeline. Safe to re-run.
// Don't run it while `pnpm le:worker` is working the same campaign.
import { parseArgs } from 'node:util'
import { one } from '../lib/db'
import { processCampaign, type Segment } from '../pipeline'

const { values } = parseArgs({ options: { campaign: { type: 'string' }, concurrency: { type: 'string', default: '3' } } })
if (!values.campaign) {
  console.error('Usage: pnpm le:process --campaign "<name>" [--concurrency 3]')
  process.exit(1)
}

async function main() {
  const campaign = await one<{ id: string, segment_id: Segment | null }>('le_campaigns', { name: { _eq: values.campaign } }, 'id,segment_id.id,segment_id.service,segment_id.case_studies')
  if (!campaign) throw new Error(`Campaign "${values.campaign}" not found`)
  const { total, tally } = await processCampaign(campaign, console.log, Number(values.concurrency))
  console.log(`\n${total} leads processed:`, tally)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
