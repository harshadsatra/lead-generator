<script setup lang="ts">
import { COUNTRY_NAMES } from '@lead/shared'
import { areaName } from '@lead/shared/places'
import { CAMPAIGN_STATUS, SOURCES } from '#shared/campaign'

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const { data: c, refresh } = await useFetch(`/api/campaigns/${id}`)
const isNews = computed(() => c.value?.scanners?.includes('news') ?? false)
const working = computed(() => ['scan_requested', 'scanning'].includes(c.value?.status ?? ''))
useIntervalFn(() => refresh(), 10_000)

const STAGES = [
  { label: 'Discovered', states: ['discovered'] },
  { label: 'Enriched / audited', states: ['enriched', 'audited', 'scored'] },
  { label: 'Awaiting approval', states: ['awaiting_approval'] },
  { label: 'To send', states: ['approved'] },
  { label: 'Sent', states: ['in_sequence', 'replied'] },
  { label: 'Outcomes', states: ['handed_to_admin', 'closed_lost', 'closed_no_response', 'suppressed'] },
  { label: 'Archived / rejected', states: ['archived', 'rejected'] }
]
const count = (states: string[]) => states.reduce((n, s) => n + (c.value?.counts[s] ?? 0), 0)

const preview = ref<Awaited<ReturnType<typeof runPreview>> | null>(null)
const busy = ref('')
async function runPreview() {
  return $fetch(`/api/campaigns/${id}/preview`, { method: 'POST' })
}
async function doPreview() {
  busy.value = 'preview'
  try {
    preview.value = await runPreview()
  } catch (err) {
    toast.add({ title: (err as { data?: { message?: string } }).data?.message ?? 'Preview failed', color: 'error' })
  } finally {
    busy.value = ''
  }
}
async function setStatus(action: 'launch' | 'pause' | 'resume') {
  busy.value = action
  try {
    await $fetch(`/api/campaigns/${id}/status`, { method: 'POST', body: { action } })
    await refresh()
    if (action === 'launch') toast.add({ title: 'Scan queued. It starts within 30 s if pnpm le:worker is running.', color: 'success' })
  } catch (err) {
    toast.add({ title: (err as { data?: { message?: string } }).data?.message ?? 'Could not update', color: 'error' })
  } finally {
    busy.value = ''
  }
}
const host = (url: string) => URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, '') : url
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <UDashboardPanel id="campaign">
    <template #header>
      <UDashboardNavbar :title="c?.name ?? 'Campaign'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge v-if="c?.is_test" color="neutral" variant="outline">
            test
          </UBadge>
          <UBadge v-if="c" :color="CAMPAIGN_STATUS[c.status]?.color ?? 'neutral'" variant="subtle">
            {{ CAMPAIGN_STATUS[c.status]?.label ?? c.status }}
          </UBadge>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="c" class="space-y-6 max-w-4xl">
        <UAlert
          v-if="c.status === 'scan_failed' && c.geography?.error"
          color="error"
          icon="i-lucide-circle-alert"
          title="Scan failed"
          :description="c.geography.error"
        />

        <UCard>
          <dl class="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt class="text-muted">
                Source
              </dt>
              <dd>{{ isNews ? SOURCES.news : SOURCES.gbp }}</dd>
            </div>
            <div>
              <dt class="text-muted">
                Segment
              </dt>
              <dd>{{ c.segment_id?.name ?? '–' }}</dd>
            </div>
            <div>
              <dt class="text-muted">
                Country
              </dt>
              <dd>{{ c.geography?.country ? COUNTRY_NAMES[c.geography.country] ?? c.geography.country : '–' }}</dd>
            </div>
            <div v-if="isNews">
              <dt class="text-muted">
                News checks
              </dt>
              <dd>
                Every 6 hours while active; each new funding headline costs 1 Google Maps search.
                <template v-if="c.geography?.news?.last">
                  Last check {{ day(c.geography.news.last) }}, {{ c.geography.news.seen?.length ?? 0 }} articles read.
                </template>
              </dd>
            </div>
            <template v-else>
              <div>
                <dt class="text-muted">
                  Search for
                </dt>
                <dd>{{ c.geography?.query ?? '–' }}</dd>
              </div>
              <div>
                <dt class="text-muted">
                  Areas
                </dt>
                <dd>
                  <span v-for="a in c.geography?.areas ?? []" :key="areaName(a)" class="flex items-center gap-1">
                    <UIcon v-if="typeof a !== 'string'" name="i-lucide-map" class="size-3.5 text-muted" />
                    {{ areaName(a) }}<span v-if="c.geography?.scanned?.[areaName(a)]" class="text-muted"> · scanned {{ day(c.geography.scanned[areaName(a)]) }}</span>
                  </span>
                </dd>
              </div>
            </template>
          </dl>
          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="!isNews"
                label="Preview first area"
                icon="i-lucide-search"
                color="neutral"
                variant="outline"
                :loading="busy === 'preview'"
                @click="doPreview"
              />
              <UButton
                v-if="['draft', 'active', 'paused', 'scan_failed'].includes(c.status)"
                :label="c.status === 'draft' ? (isNews ? 'Start watching news' : 'Launch scan') : (isNews ? 'Check news now' : 'Scan again')"
                icon="i-lucide-rocket"
                :loading="busy === 'launch' || working"
                @click="setStatus('launch')"
              />
              <UButton
                v-if="['active', 'scan_requested'].includes(c.status)"
                label="Pause"
                icon="i-lucide-pause"
                color="neutral"
                variant="outline"
                :loading="busy === 'pause'"
                @click="setStatus('pause')"
              />
              <UButton
                v-if="c.status === 'paused'"
                label="Resume"
                icon="i-lucide-play"
                color="neutral"
                variant="outline"
                :loading="busy === 'resume'"
                @click="setStatus('resume')"
              />
              <UButton
                :to="`/?campaign=${c.id}`"
                label="Open inbox"
                icon="i-lucide-inbox"
                color="neutral"
                variant="ghost"
              />
            </div>
          </template>
        </UCard>

        <UCard v-if="preview">
          <template #header>
            <p class="font-medium">
              Preview: “{{ preview.query }}”
            </p>
            <p class="text-sm text-muted">
              {{ preview.found }} businesses on the first page{{ preview.morePages ? ' (more pages available)' : '' }} ·
              {{ preview.withoutWebsite }} without a website · {{ preview.withWebsite }} with one{{ preview.closed ? ` · ${preview.closed} closed` : '' }}.
              A full scan runs up to {{ preview.maxSearches }} Google searches.
            </p>
          </template>
          <ul class="text-sm divide-y divide-default">
            <li v-for="p in preview.sample" :key="p.name" class="py-2 flex items-center justify-between gap-3">
              <span class="truncate">{{ p.name }}</span>
              <span class="text-muted shrink-0">
                {{ p.reviews ?? 0 }} reviews · {{ p.website ? host(p.website) : 'no website' }}
              </span>
            </li>
          </ul>
        </UCard>

        <div class="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          <UCard v-for="s in STAGES" :key="s.label" :ui="{ body: 'p-3 sm:p-3' }">
            <p class="text-2xl font-semibold">
              {{ count(s.states) }}
            </p>
            <p class="text-xs text-muted">
              {{ s.label }}
            </p>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
