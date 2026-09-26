<script setup lang="ts">
import { REJECT_REASONS, ReplyClass } from '@lead/shared'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const { data: campaigns } = await useFetch('/api/campaigns', { default: () => [] })

const VIEWS = ['awaiting', 'to_send', 'sent', 'outcomes', 'archived'] as const
type View = typeof VIEWS[number]
const campaign = computed({
  get: () => (route.query.campaign as string | undefined) ?? campaigns.value[0]?.id,
  set: v => router.replace({ query: { ...route.query, campaign: v } })
})
const view = computed<View>({
  get: () => (VIEWS.includes(route.query.view as View) ? route.query.view as View : 'awaiting'),
  set: v => router.replace({ query: { ...route.query, view: v } })
})

const campaignItems = computed(() => campaigns.value.map(c => ({ label: c.is_test ? `${c.name} (test)` : c.name, value: c.id })))
const tabs = [
  { label: 'Awaiting approval', value: 'awaiting' },
  { label: 'To send', value: 'to_send' },
  { label: 'Sent', value: 'sent' },
  { label: 'Outcomes', value: 'outcomes' },
  { label: 'Archived', value: 'archived' }
]
const EMPTY: Record<View, string> = {
  awaiting: 'No leads awaiting approval',
  to_send: 'Nothing to send: approve leads first',
  sent: 'No leads in sequence',
  outcomes: 'No outcomes yet',
  archived: 'No archived or rejected leads'
}
const OFFER_LABEL: Record<string, string> = { audit_pdf: 'Offer: full audit PDF', mockup: 'Offer: free homepage mockup', call_only: 'Offer: call ask only' }
const REPLY_LABEL: Record<ReplyClass, string> = {
  interested: 'Interested / asked a question',
  referral: 'Referred someone else',
  later: 'Not now / later',
  out_of_office: 'Out of office',
  not_interested: 'Not interested',
  unsubscribe: 'Unsubscribe / angry',
  bounce: 'Bounced'
}
const REPLY_CLASSES = ReplyClass.options
const STATE_LABEL: Record<string, string> = {
  handed_to_admin: 'Handed to closer',
  closed_lost: 'Closed: lost',
  closed_no_response: 'Closed: no response',
  suppressed: 'Suppressed',
  rejected: 'Rejected',
  archived: 'Archived'
}

const { data: leads, status, refresh } = await useFetch('/api/leads', {
  query: { campaign, view },
  immediate: !!campaign.value,
  watch: [campaign, view],
  default: () => []
})
const { data: stats, refresh: refreshStats } = await useFetch('/api/stats', {
  query: { campaign },
  immediate: !!campaign.value,
  watch: [campaign]
})
const gate = computed(() => {
  const s = stats.value
  if (!s) return null
  if (s.sent < 50) return { color: 'neutral' as const, label: `Gate: ${s.sent}/50 sent` }
  return s.positivePct >= 2 ? { color: 'success' as const, label: 'Gate passed (≥ 2% positive)' } : { color: 'error' as const, label: 'Below 2% positive' }
})

const offers = reactive<Record<string, 'audit_pdf' | 'mockup' | 'call_only'>>({})
const busy = ref<string | null>(null)
const offerItems = (band: string | null) => [
  { label: 'Full audit PDF', value: 'audit_pdf' },
  { label: 'Free homepage mockup', value: 'mockup', disabled: band !== 'hot' },
  { label: 'Call ask only', value: 'call_only' }
]

async function act(id: string, action: 'decision' | 'sent' | 'reply' | 'close', body: Record<string, string>, done: string) {
  busy.value = id
  try {
    await $fetch(`/api/leads/${id}/${action}`, { method: 'POST', body })
    toast.add({ title: done, color: 'success' })
    await Promise.all([refresh(), refreshStats()])
  } catch (err) {
    toast.add({ title: (err as { data?: { message?: string } }).data?.message ?? 'Could not save', color: 'error' })
  } finally {
    busy.value = null
  }
}

const sentSteps = (lead: { messages: { step: number, status: string, sent_at: string | null }[] }) =>
  lead.messages.filter(m => m.status === 'sent').sort((a, b) => a.step - b.step)
const stepName = (step: number) => (step === 0 ? 'First email' : `Follow-up ${step}`)
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '')
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
        <template #left>
          <UTabs
            v-model="view"
            :items="tabs"
            :content="false"
            size="sm"
          />
        </template>
        <template #right>
          <div v-if="stats" class="hidden md:flex items-center gap-3 text-sm text-muted">
            <span>Sent {{ stats.sent }}</span>
            <span>Replies {{ stats.anyReply }} ({{ stats.anyReplyPct }}%)</span>
            <span>Positive {{ stats.positive }} ({{ stats.positivePct }}%)</span>
            <span>Bounce {{ stats.bouncePct }}%</span>
            <UBadge v-if="gate" :color="gate.color" variant="subtle">
              {{ gate.label }}
            </UBadge>
          </div>
        </template>
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
        :title="EMPTY[view]"
        description="Import with pnpm le:import, then run pnpm le:process to audit and score."
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

            <UBadge v-if="lead.offer && view !== 'awaiting'" color="primary" variant="subtle">
              {{ OFFER_LABEL[lead.offer] }}
            </UBadge>

            <p v-if="sentSteps(lead).length" class="text-muted">
              <span v-for="(m, i) in sentSteps(lead)" :key="m.step">{{ i ? ' · ' : '' }}{{ stepName(m.step) }} {{ day(m.sent_at) }}</span>
            </p>
            <p v-if="lead.replies.length" class="text-muted">
              Reply: {{ lead.replies.map(r => REPLY_LABEL[r.classification as ReplyClass] ?? r.classification).join(', ') }}
            </p>
            <p v-if="(view === 'outcomes' || view === 'archived')" class="text-muted">
              {{ STATE_LABEL[lead.state] ?? lead.state }}<template v-if="lead.closed_reason">
                : {{ lead.closed_reason }}
              </template>
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
                >{{ lead.primary_contact_id.verified_status === 'invalid' ? 'invalid' : 'unverified' }}</UBadge>
              </span>
              <span v-if="lead.primary_contact_id?.phone" class="flex items-center gap-1">
                <UIcon name="i-lucide-phone" />{{ lead.primary_contact_id.phone }}
              </span>
              <span v-if="!lead.primary_contact_id">No contact</span>
            </div>

            <div v-if="view === 'awaiting'" class="mt-3 flex flex-wrap items-center gap-2">
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
                @click="act(lead.id, 'decision', { action: 'approve', offer: offers[lead.id] ?? 'audit_pdf' }, `${lead.business_id.name}: approved`)"
              />
              <UDropdownMenu :items="REJECT_REASONS.map(reason => ({ label: reason, onSelect: () => act(lead.id, 'decision', { action: 'reject', reason }, `${lead.business_id.name}: rejected`) }))">
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

            <div v-else-if="view === 'to_send' || view === 'sent'" class="mt-3 flex flex-wrap items-center gap-2">
              <UButton
                :label="`Mark ${stepName(sentSteps(lead).length).toLowerCase()} as sent`"
                icon="i-lucide-send"
                size="sm"
                :loading="busy === lead.id"
                @click="act(lead.id, 'sent', {}, `${lead.business_id.name}: ${stepName(sentSteps(lead).length).toLowerCase()} recorded`)"
              />
              <template v-if="view === 'sent'">
                <UDropdownMenu :items="REPLY_CLASSES.map(c => ({ label: REPLY_LABEL[c], onSelect: () => act(lead.id, 'reply', { classification: c }, `${lead.business_id.name}: reply logged`) }))">
                  <UButton
                    label="Log reply"
                    icon="i-lucide-reply"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    :disabled="busy === lead.id"
                  />
                </UDropdownMenu>
                <UButton
                  label="Close: no response"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  :disabled="busy === lead.id"
                  @click="act(lead.id, 'close', {}, `${lead.business_id.name}: closed`)"
                />
              </template>
            </div>
          </template>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
