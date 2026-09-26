<script setup lang="ts">
const toast = useToast()
const route = useRoute()
const router = useRouter()

const STATUSES = ['new', 'replied', 'dismissed'] as const
type Status = typeof STATUSES[number]
const status = computed<Status>({
  get: () => (STATUSES.includes(route.query.status as Status) ? route.query.status as Status : 'new'),
  set: v => router.replace({ query: { ...route.query, status: v } })
})
const tabs = [{ label: 'New', value: 'new' }, { label: 'Replied', value: 'replied' }, { label: 'Dismissed', value: 'dismissed' }]

const { data: posts, refresh } = await useFetch('/api/posts', { query: { status }, watch: [status], default: () => [] })
const { data: watch, refresh: refreshWatch } = await useFetch('/api/reddit-watch')

async function setStatus(id: string, to: Status) {
  try {
    await $fetch(`/api/posts/${id}`, { method: 'PATCH', body: { status: to } })
    await refresh()
  } catch (err) {
    toast.add({ title: (err as { data?: { message?: string } }).data?.message ?? 'Could not update', color: 'error' })
  }
}

const editing = ref(false)
const draft = reactive({ subreddits: '', phrases: '' })
const lines = (t: string) => t.split('\n').map(l => l.trim()).filter(Boolean)
function editWatch() {
  draft.subreddits = (watch.value?.subreddits ?? []).join('\n')
  draft.phrases = (watch.value?.phrases ?? []).join('\n')
  editing.value = true
}
async function saveWatch() {
  try {
    await $fetch('/api/reddit-watch', { method: 'PUT', body: { subreddits: lines(draft.subreddits), phrases: lines(draft.phrases) } })
    await refreshWatch()
    editing.value = false
    toast.add({ title: 'Watch list saved; the worker uses it on its next Reddit check', color: 'success' })
  } catch (err) {
    toast.add({ title: (err as { data?: { message?: string } }).data?.message ?? 'Could not save', color: 'error' })
  }
}

const ago = (iso: string | null) => {
  if (!iso) return ''
  const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}
</script>

<template>
  <UDashboardPanel id="reddit">
    <template #header>
      <UDashboardNavbar title="Reddit">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Watch list"
            icon="i-lucide-list-filter"
            color="neutral"
            variant="outline"
            @click="editWatch"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UTabs
          v-model="status"
          :items="tabs"
          :content="false"
          size="sm"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="watch && !watch.connected"
        color="warning"
        icon="i-lucide-plug"
        title="Reddit isn't connected"
        description="Add REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET and REDDIT_USERNAME to .env and restart the worker."
        class="mb-4"
      />
      <p class="text-sm text-muted mb-4">
        Posts asking for a website or developer. Reply in the thread as yourself; no DMs (spec). Checked every 15 minutes.
      </p>
      <UEmpty
        v-if="!posts.length"
        icon="i-simple-icons-reddit"
        :title="status === 'new' ? 'No new posts' : `No ${status} posts`"
        :description="watch ? `Watching ${watch.subreddits.length} subreddits for ${watch.phrases.length} phrases.` : ''"
      />
      <div v-else class="grid gap-4 lg:grid-cols-2">
        <UCard v-for="p in posts" :key="p.id">
          <template #header>
            <p class="font-medium">
              {{ p.title }}
            </p>
            <p class="text-sm text-muted">
              {{ p.community }} · u/{{ p.author }} · {{ ago(p.posted_at) }}
              <UBadge
                v-if="p.matched"
                color="neutral"
                variant="outline"
                size="sm"
                class="ms-1"
              >
                “{{ p.matched }}”
              </UBadge>
            </p>
          </template>
          <p v-if="p.body" class="text-sm whitespace-pre-line line-clamp-6">
            {{ p.body }}
          </p>
          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                :to="p.url"
                target="_blank"
                label="Open thread"
                icon="i-lucide-external-link"
                size="sm"
              />
              <UButton
                v-if="p.status !== 'replied'"
                label="Mark replied"
                icon="i-lucide-check"
                size="sm"
                color="neutral"
                variant="outline"
                @click="setStatus(p.id, 'replied')"
              />
              <UButton
                v-if="p.status !== 'dismissed'"
                label="Dismiss"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="setStatus(p.id, 'dismissed')"
              />
              <UButton
                v-if="p.status !== 'new'"
                label="Back to new"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="setStatus(p.id, 'new')"
              />
            </div>
          </template>
        </UCard>
      </div>

      <USlideover v-model:open="editing" title="Reddit watch list" description="Posts from the last 7 days that contain one of the phrases.">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Subreddits" help="One per line, without r/">
              <UTextarea v-model="draft.subreddits" :rows="8" class="w-full" />
            </UFormField>
            <UFormField label="Phrases" help="One per line; a post must contain one of these exactly">
              <UTextarea v-model="draft.phrases" :rows="8" class="w-full" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="editing = false"
              />
              <UButton label="Save" @click="saveWatch" />
            </div>
          </div>
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
