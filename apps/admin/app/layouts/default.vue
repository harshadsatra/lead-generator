<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)
const close = () => {
  open.value = false
}

const links = [[{
  label: 'Approval inbox',
  icon: 'i-lucide-inbox',
  to: '/',
  onSelect: close
}, {
  label: 'Campaigns',
  icon: 'i-lucide-megaphone',
  to: '/campaigns',
  onSelect: close
}], [{
  label: 'Team & settings',
  icon: 'i-lucide-settings',
  to: 'https://cms.shwezstudio.in/admin',
  target: '_blank'
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
    >
      <template #header="{ collapsed }">
        <span v-if="!collapsed" class="font-semibold truncate">Shwez Lead Engine</span>
        <UIcon v-else name="i-lucide-radar" class="size-5 mx-auto" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
