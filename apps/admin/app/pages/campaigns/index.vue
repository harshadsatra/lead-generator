<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { COUNTRY_NAMES } from '@lead/shared'
import { CAMPAIGN_STATUS, CampaignInput } from '#shared/campaign'

const toast = useToast()
const { data: campaigns } = await useFetch('/api/campaigns', { default: () => [] })
const { data: segments } = await useFetch('/api/segments', { default: () => [] })

const open = ref(false)
const saving = ref(false)
const form = reactive({ name: '', segment_id: '', country: 'GB', query: '', areasText: '', is_test: false })
const countryItems = Object.entries(COUNTRY_NAMES).map(([value, label]) => ({ label, value }))
const segmentItems = computed(() => segments.value.map(s => ({ label: s.name, value: s.id })))

const lines = (t: string) => t.split('\n').map(a => a.trim()).filter(Boolean)
const schema = CampaignInput.omit({ areas: true }).extend({
  areasText: z.string().refine(t => lines(t).length > 0, 'Add at least one area').refine(t => lines(t).length <= 20, 'At most 20 areas')
})

async function onSubmit(e: FormSubmitEvent<typeof form>) {
  const areas = lines(e.data.areasText)
  saving.value = true
  try {
    const c = await $fetch('/api/campaigns', { method: 'POST', body: { ...e.data, areasText: undefined, areas } })
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
              {{ [c.segment_id?.name, c.geography?.country && COUNTRY_NAMES[c.geography.country], c.geography?.areas?.length ? `${c.geography.areas.length} areas` : null].filter(Boolean).join(' · ') }}
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
            <UFormField label="Segment" name="segment_id">
              <USelect
                v-model="form.segment_id"
                :items="segmentItems"
                placeholder="Pick a segment"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Country" name="country">
              <USelect v-model="form.country" :items="countryItems" class="w-full" />
            </UFormField>
            <UFormField label="Search for" name="query" help="What you'd type into Google Maps, e.g. &quot;real estate agency&quot;">
              <UInput v-model="form.query" placeholder="real estate agency" class="w-full" />
            </UFormField>
            <UFormField label="Areas" name="areasText" help="One per line, e.g. &quot;Covent Garden, London&quot;. Up to 20; each area is up to 60 businesses.">
              <UTextarea
                v-model="form.areasText"
                :rows="4"
                placeholder="Covent Garden, London&#10;Soho, London"
                class="w-full"
              />
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
