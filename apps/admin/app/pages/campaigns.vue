<template>
  <UDashboardPanel id="campaigns">
    <template #header>
      <UDashboardNavbar title="Campaigns">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UEmpty
        icon="i-lucide-megaphone"
        title="No campaigns yet"
        description="Campaigns set the segment, area, budget and team for each run."
      />
    </template>
  </UDashboardPanel>
</template>
