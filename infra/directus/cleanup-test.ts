// Deletes every is_test campaign (leads, events, messages, replies, members cascade)
// plus businesses no real campaign uses. Keeps suppression and llm_usage rows.
// Dry run by default; pass --apply to delete. Run: pnpm le:cleanup-test [--apply]
import { fileURLToPath } from 'node:url'
import { directus, q } from './api.ts'

export function businessesToDelete(testLeadBusinesses: string[], businessesWithRealLeads: string[]): string[] {
  const keep = new Set(businessesWithRealLeads)
  return [...new Set(testLeadBusinesses)].filter(id => !keep.has(id))
}

async function main() {
  const apply = process.argv.includes('--apply')
  const api = directus(process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_SETUP_TOKEN)
  const count = async (collection: string, filter: unknown) =>
    Number((await api<{ count: number }[]>('GET', `/items/${collection}?aggregate[count]=*&filter=${q(filter)}`))[0]?.count ?? 0)

  const campaigns = await api<{ id: string, name: string, is_test: boolean }[]>('GET', `/items/le_campaigns?limit=-1&fields=id,name,is_test&filter=${q({ is_test: { _eq: true } })}`)
  if (campaigns.some(c => c.is_test !== true)) throw new Error('Refusing: filter returned a non-test campaign')
  const ids = campaigns.map(c => c.id)
  if (ids.length === 0) {
    console.log('No test campaigns. Nothing to delete.')
    return
  }

  const testLeads = await api<{ business_id: string }[]>('GET', `/items/le_leads?limit=-1&fields=business_id&filter=${q({ campaign_id: { _in: ids } })}`)
  const candidates = [...new Set(testLeads.map(l => l.business_id))]
  const realLeads = candidates.length
    ? await api<{ business_id: string }[]>('GET', `/items/le_leads?limit=-1&fields=business_id&filter=${q({ _and: [{ business_id: { _in: candidates } }, { campaign_id: { _nin: ids } }] })}`)
    : []
  const businesses = businessesToDelete(candidates, realLeads.map(l => l.business_id))
  const leadFilter = { lead_id: { campaign_id: { _in: ids } } }

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: test campaigns (${ids.length}): ${campaigns.map(c => c.name).join(', ')}`)
  console.log(`  leads ${testLeads.length}, events ${await count('le_events', leadFilter)}, messages ${await count('le_messages', leadFilter)}, replies ${await count('le_replies', leadFilter)}`)
  console.log(`  businesses only used by test campaigns: ${businesses.length} (kept because a real campaign uses them: ${candidates.length - businesses.length})`)
  if (!apply) {
    console.log('\nNothing deleted. Re-run with --apply.')
    return
  }
  await api('DELETE', '/items/le_campaigns', ids)
  if (businesses.length) await api('DELETE', '/items/le_businesses', businesses)
  console.log('\nDeleted.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
