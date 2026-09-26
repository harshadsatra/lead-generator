<script setup lang="ts">
import type { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { SegmentInput } from '#shared/segment'

const toast = useToast()
const { data: segments, refresh } = await useFetch('/api/segments', { default: () => [] })

type Row = typeof segments.value[number]
const empty = () => ({ name: '', signals: '', service: '', case_studies: '', icp: '', min_budget: undefined as number | undefined })
const form = reactive(empty())
const editing = ref<Row | null>(null)
const panelOpen = ref(false)
const saving = ref(false)
const deleting = ref<Row | null>(null)

function openNew() {
  editing.value = null
  Object.assign(form, empty())
  panelOpen.value = true
}
function openEdit(s: Row) {
  editing.value = s
  Object.assign(form, { ...empty(), ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? (k === 'min_budget' ? undefined : '')])) })
  panelOpen.value = true
}

const message = (err: unknown, fallback: string) => (err as { data?: { message?: string } }).data?.message ?? fallback

async function onSubmit(e: FormSubmitEvent<z.output<typeof SegmentInput>>) {
  saving.value = true
  try {
    const body = e.data
    if (editing.value) await $fetch(`/api/segments/${editing.value.id}`, { method: 'PATCH', body })
    else await $fetch('/api/segments', { method: 'POST', body })
    toast.add({ title: `Segment "${e.data.name}" ${editing.value ? 'updated' : 'created'}`, color: 'success' })
    panelOpen.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: message(err, 'Could not save segment'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const s = deleting.value!
  try {
    await $fetch(`/api/segments/${s.id}`, { method: 'DELETE' })
    toast.add({ title: `Segment "${s.name}" deleted`, color: 'neutral' })
    await refresh()
  } catch (err) {
    toast.add({ title: message(err, 'Could not delete segment'), color: 'error' })
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="segments">
    <template #header>
      <UDashboardNavbar title="Segments">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="New segment" icon="i-lucide-plus" @click="openNew" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UEmpty
        v-if="!segments.length"
        icon="i-lucide-shapes"
        title="No segments yet"
        description="A segment is the type of business a campaign targets, with the service you'd sell them."
      />
      <div v-else class="divide-y divide-default">
        <div v-for="s in segments" :key="s.id" class="flex items-start justify-between gap-3 py-3 px-2">
          <div class="min-w-0 space-y-0.5">
            <p class="font-medium">
              {{ s.name }}
            </p>
            <p v-if="s.service" class="text-sm">
              <span class="text-muted">Service:</span> {{ s.service }}
            </p>
            <p v-if="s.case_studies" class="text-sm">
              <span class="text-muted">Case studies:</span> {{ s.case_studies }}
            </p>
            <p v-if="s.signals" class="text-sm text-muted truncate">
              Looks for: {{ s.signals }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UBadge color="neutral" variant="subtle">
              {{ s.campaigns }} campaign{{ s.campaigns === 1 ? '' : 's' }}
            </UBadge>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Edit"
              @click="openEdit(s)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Delete"
              @click="deleting = s"
            />
          </div>
        </div>
      </div>

      <USlideover v-model:open="panelOpen" :title="editing ? `Edit ${editing.name}` : 'New segment'">
        <template #body>
          <UForm
            :schema="SegmentInput"
            :state="form"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField label="Name" name="name" required>
              <UInput v-model="form.name" placeholder="Dental clinics" class="w-full" />
            </UFormField>
            <UFormField label="Signals to look for" name="signals" help="What makes a business in this segment a good lead">
              <UTextarea
                v-model="form.signals"
                :rows="2"
                placeholder="Poor mobile site, no online booking"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Service you'd sell" name="service">
              <UInput v-model="form.service" placeholder="Website + booking + WhatsApp integration" class="w-full" />
            </UFormField>
            <UFormField label="Case studies to cite" name="case_studies" help="Shown on each lead's plan">
              <UInput v-model="form.case_studies" placeholder="Health tech projects" class="w-full" />
            </UFormField>
            <UFormField label="Ideal customer notes" name="icp">
              <UTextarea v-model="form.icp" :rows="3" class="w-full" />
            </UFormField>
            <UFormField label="Minimum project budget" name="min_budget" help="Leave empty to use the global default">
              <UInputNumber
                v-model="form.min_budget"
                :min="0"
                :step="5000"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="panelOpen = false"
              />
              <UButton type="submit" :label="editing ? 'Save' : 'Create'" :loading="saving" />
            </div>
          </UForm>
        </template>
      </USlideover>

      <UModal
        :open="!!deleting"
        :title="`Delete ${deleting?.name}?`"
        :description="deleting?.campaigns ? `It is used by ${deleting.campaigns} campaign(s), so it can't be deleted until they use another segment.` : 'This cannot be undone.'"
        @update:open="v => { if (!v) deleting = null }"
      >
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="deleting = null"
            />
            <UButton
              label="Delete"
              color="error"
              :disabled="!!deleting?.campaigns"
              @click="confirmDelete"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
