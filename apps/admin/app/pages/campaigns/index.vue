<script setup lang="ts">
import { z } from 'zod'
import type { Area } from '@lead/shared/places'
import type { FormSubmitEvent } from '@nuxt/ui'
import { COUNTRY_NAMES } from '@lead/shared'
import { CAMPAIGN_STATUS, SOURCES } from '#shared/campaign'

const toast = useToast()
const { data: campaigns } = await useFetch('/api/campaigns', { default: () => [] })
const { data: segments } = await useFetch('/api/segments', { default: () => [] })

const open = ref(false)
const saving = ref(false)
const form = reactive({ name: '', source: 'gbp' as 'gbp' | 'news', segment_id: '', country: 'GB', query: '', areas: [] as Area[], is_test: false })
const sourceItems = Object.entries(SOURCES).map(([value, label]) => ({ label, value }))
const countryItems = Object.entries(COUNTRY_NAMES).map(([value, label]) => ({ label, value }))
const segmentItems = computed(() => segments.value.map(s => ({ label: s.name, value: s.id })))

const schema = z.object({
  name: z.string().trim().min(3, 'Give the campaign a name'),
  source: z.enum(['gbp', 'news']),
  segment_id: z.string().min(1, 'Pick a segment'),
  country: z.string().min(2, 'Pick a country'),
  query: z.string(),
  areas: z.array(z.custom<Area>()),
  is_test: z.boolean()
}).superRefine((f, ctx) => {
  if (f.source !== 'gbp') return
  if (f.query.trim().length < 3) ctx.addIssue({ code: 'custom', path: ['query'], message: 'What should Google search for?' })
  if (!f.areas.length) ctx.addIssue({ code: 'custom', path: ['areas'], message: 'Add at least one area' })
  if (f.areas.length > 20) ctx.addIssue({ code: 'custom', path: ['areas'], message: 'At most 20 areas' })
})

async function onSubmit(e: FormSubmitEvent<typeof form>) {
  saving.value = true
  try {
    const body = e.data.source === 'gbp' ? e.data : { ...e.data, query: undefined, areas: undefined }
    const c = await $fetch('/api/campaigns', { method: 'POST', body })
    open.value = false
    await navigateTo(`/campaigns/${c.id}`)
  } catch (err) {
    toast.add({ title: (err as { data?: { message?: string } }).data?.message ?? 'Could not create campaign', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="campaigns">
    <template #header>
      <UDashboardNavbar title="Campaigns">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="New campaign" icon="i-lucide-plus" @click="open = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UEmpty
        v-if="!campaigns.length"
        icon="i-lucide-megaphone"
        title="No campaigns yet"
        description="Create one to scan an area on Google Maps for leads."
      />
      <div v-else class="divide-y divide-default">
        <NuxtLink
          v-for="c in campaigns"
          :key="c.id"
          :to="`/campaigns/${c.id}`"
          class="flex items-center justify-between gap-3 py-3 hover:bg-elevated/50 px-2 rounded"
        >
          <div class="min-w-0">
            <p class="font-medium truncate">
              {{ c.name }}
            </p>
            <p class="text-sm text-muted truncate">
              {{ [c.scanners?.includes('news') ? 'Startup news' : 'Google Maps', c.segment_id?.name, c.geography?.country && COUNTRY_NAMES[c.geography.country], c.geography?.areas?.length ? `${c.geography.areas.length} areas` : null].filter(Boolean).join(' · ') }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UBadge v-if="c.is_test" color="neutral" variant="outline">
              test
            </UBadge>
            <UBadge :color="CAMPAIGN_STATUS[c.status]?.color ?? 'neutral'" variant="subtle">
              {{ CAMPAIGN_STATUS[c.status]?.label ?? c.status }}
            </UBadge>
          </div>
        </NuxtLink>
      </div>

      <UModal v-model:open="open" title="New campaign" description="Scans Google Maps for businesses in each area. Nothing runs until you launch it.">
        <template #body>
          <UForm
            :schema="schema"
            :state="form"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField label="Name" name="name">
              <UInput v-model="form.name" placeholder="London agencies P0" class="w-full" />
            </UFormField>
            <UFormField label="Source" name="source">
              <USelect v-model="form.source" :items="sourceItems" class="w-full" />
            </UFormField>
            <UFormField label="Segment" name="segment_id">
              <USelect
                v-model="form.segment_id"
                :items="segmentItems"
                placeholder="Pick a segment"
                class="w-full"
              />
              <UButton
                to="/segments"
                label="Manage segments"
                variant="link"
                size="xs"
                class="px-0 mt-1"
              />
            </UFormField>
            <UFormField label="Country" name="country">
              <USelect v-model="form.country" :items="countryItems" class="w-full" />
            </UFormField>
            <UFormField
              v-if="form.source === 'gbp'"
              label="Search for"
              name="query"
              help="What you'd type into Google Maps, e.g. &quot;real estate agency&quot;"
            >
              <UInput v-model="form.query" placeholder="real estate agency" class="w-full" />
            </UFormField>
            <UFormField
              v-if="form.source === 'gbp'"
              label="Areas"
              name="areas"
              help="Up to 20. Google returns at most 60 businesses per area, so neighbourhoods beat whole cities."
            >
              <AreaPicker v-model="form.areas" :country="form.country" />
            </UFormField>
            <UCheckbox v-model="form.is_test" label="Test campaign (never sends; removed by le:cleanup-test)" />
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="open = false"
              />
              <UButton type="submit" label="Create" :loading="saving" />
            </div>
          </UForm>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
