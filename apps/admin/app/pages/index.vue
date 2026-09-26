<script setup lang="ts">
import { REJECT_REASONS } from '@lead/shared'

const route = useRoute()
const router = useRouter()

const { data: campaigns } = await useFetch('/api/campaigns', { default: () => [] })

const campaign = computed({
  get: () => (route.query.campaign as string | undefined) ?? campaigns.value[0]?.id,
  set: v => router.replace({ query: { ...route.query, campaign: v } })
})
const state = computed({
  get: () => (['approved', 'archived'].includes(route.query.state as string) ? route.query.state as string : 'awaiting_approval'),
  set: v => router.replace({ query: { ...route.query, state: v } })
})

const campaignItems = computed(() => campaigns.value.map(c => ({ label: c.is_test ? `${c.name} (test)` : c.name, value: c.id })))
const tabs = [{ label: 'Awaiting approval', value: 'awaiting_approval' }, { label: 'Approved', value: 'approved' }, { label: 'Archived', value: 'archived' }]
const OFFER_LABEL: Record<string, string> = { audit_pdf: 'Offer: full audit PDF', mockup: 'Offer: free homepage mockup', call_only: 'Offer: call ask only' }

const { data: leads, status } = await useFetch('/api/leads', {
  query: { campaign, state },
  immediate: !!campaign.value,
  watch: [campaign, state],
  default: () => []
})

const toast = useToast()
const offers = reactive<Record<string, 'audit_pdf' | 'mockup' | 'call_only'>>({})
const busy = ref<string | null>(null)
const offerItems = (band: string | null) => [
  { label: 'Full audit PDF', value: 'audit_pdf' },
  { label: 'Free homepage mockup', value: 'mockup', disabled: band !== 'hot' },
  { label: 'Call ask only', value: 'call_only' }
]

async function decideLead(id: string, name: string, body: Record<string, string>) {
  busy.value = id
  try {
    await $fetch(`/api/leads/${id}/decision`, { method: 'POST', body })
    leads.value = leads.value.filter(l => l.id !== id)
    toast.add({ title: `${name}: ${body.action === 'approve' ? 'approved' : 'rejected'}`, color: body.action === 'approve' ? 'success' : 'neutral' })
  } catch (err) {
    toast.add({ title: (err as { data?: { message?: string } }).data?.message ?? 'Could not save decision', color: 'error' })
  } finally {
    busy.value = null
  }
}

const bandColor = (band: string | null) => (band === 'hot' ? 'error' : band === 'warm' ? 'warning' : 'neutral')
const psiColor = (n: number | null) => (n === null ? 'neutral' : n < 50 ? 'error' : n < 90 ? 'warning' : 'success')
</script>

<template>
  <UDashboardPanel id="approval-inbox">
    <template #header>
      <UDashboardNavbar title="Approval inbox">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <USelect
            v-if="campaignItems.length"
            v-model="campaign"
            :items="campaignItems"
            placeholder="Campaign"
            class="w-56"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UTabs
          v-model="state"
          :items="tabs"
          :content="false"
          size="sm"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <UEmpty
        v-if="!campaignItems.length"
        icon="i-lucide-megaphone"
        title="No campaigns yet"
        description="Import leads with pnpm le:import to create one."
      />
      <UEmpty
        v-else-if="status !== 'pending' && !leads.length"
        icon="i-lucide-inbox"
        :title="state === 'archived' ? 'No archived leads' : state === 'approved' ? 'No approved leads yet' : 'No leads awaiting approval'"
        description="Run pnpm le:process for this campaign to audit and score imported leads."
      />
      <div v-else class="grid gap-4 lg:grid-cols-2">
        <UCard v-for="lead in leads" :key="lead.id">
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold truncate">
                  {{ lead.business_id.name }}
                </p>
                <p class="text-sm text-muted truncate">
                  {{ [lead.business_id.category, lead.business_id.city].filter(Boolean).join(' · ') }}
                  <template v-if="lead.business_id.review_count !== null">
                    · {{ lead.business_id.review_count }} reviews
                  </template>
                </p>
              </div>
              <UBadge :color="bandColor(lead.band)" variant="subtle" size="lg">
                {{ lead.score ?? '–' }} {{ lead.band }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-3 text-sm">
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="lead.business_id.domain"
                :to="`https://${lead.business_id.domain}`"
                target="_blank"
                icon="i-lucide-external-link"
                size="xs"
                variant="soft"
                color="neutral"
                :label="lead.business_id.domain"
              />
              <UBadge v-else color="error" variant="soft">
                No website
              </UBadge>
              <UBadge v-if="lead.audit?.psi_mobile != null" :color="psiColor(lead.audit.psi_mobile)" variant="soft">
                Mobile {{ lead.audit.psi_mobile }}
              </UBadge>
              <UBadge v-if="lead.audit?.psi_desktop != null" :color="psiColor(lead.audit.psi_desktop)" variant="soft">
                Desktop {{ lead.audit.psi_desktop }}
              </UBadge>
              <UBadge v-if="lead.audit?.has_ssl === false" color="error" variant="soft">
                No HTTPS
              </UBadge>
              <UBadge v-if="lead.audit?.cms" color="neutral" variant="soft">
                {{ lead.audit.cms }}
              </UBadge>
            </div>

            <ol v-if="lead.plan?.issues?.length" class="list-decimal ps-5 space-y-1">
              <li v-for="issue in lead.plan.issues" :key="issue.key">
                {{ issue.text }}
              </li>
            </ol>
            <p v-else class="text-muted">
              No issues found.
            </p>

            <UBadge v-if="state === 'approved' && lead.offer" color="primary" variant="subtle">
              {{ OFFER_LABEL[lead.offer] }}
            </UBadge>

            <p v-if="state === 'archived' && lead.closed_reason" class="text-muted">
              Archived: {{ lead.closed_reason }}
            </p>
          </div>

          <template #footer>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span v-if="lead.primary_contact_id?.email" class="flex items-center gap-1">
                <UIcon name="i-lucide-mail" />{{ lead.primary_contact_id.email }}
                <UBadge
                  v-if="lead.primary_contact_id.verified_status !== 'valid'"
                  size="sm"
                  variant="outline"
                  color="neutral"
                >unverified</UBadge>
              </span>
              <span v-if="lead.primary_contact_id?.phone" class="flex items-center gap-1">
                <UIcon name="i-lucide-phone" />{{ lead.primary_contact_id.phone }}
              </span>
              <span v-if="!lead.primary_contact_id">No contact</span>
            </div>
            <div v-if="state === 'awaiting_approval'" class="mt-3 flex flex-wrap items-center gap-2">
              <USelect
                :model-value="offers[lead.id] ?? 'audit_pdf'"
                :items="offerItems(lead.band)"
                size="sm"
                class="w-48"
                @update:model-value="v => offers[lead.id] = v as 'audit_pdf' | 'mockup' | 'call_only'"
              />
              <UButton
                label="Approve"
                icon="i-lucide-check"
                size="sm"
                :loading="busy === lead.id"
                @click="decideLead(lead.id, lead.business_id.name, { action: 'approve', offer: offers[lead.id] ?? 'audit_pdf' })"
              />
              <UDropdownMenu :items="REJECT_REASONS.map(reason => ({ label: reason, onSelect: () => decideLead(lead.id, lead.business_id.name, { action: 'reject', reason }) }))">
                <UButton
                  label="Reject"
                  icon="i-lucide-x"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :disabled="busy === lead.id"
                />
              </UDropdownMenu>
            </div>
          </template>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
