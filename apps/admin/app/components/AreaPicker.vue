<script setup lang="ts">
/// <reference types="google.maps" />
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import type { Area } from '@lead/shared/places'

const props = defineProps<{ country: string }>()
const areas = defineModel<Area[]>({ default: () => [] })

const name = (a: Area) => (typeof a === 'string' ? a : a.name)
const add = (a: Area) => {
  if (!name(a).trim() || areas.value.some(x => name(x).toLowerCase() === name(a).toLowerCase())) return
  areas.value = [...areas.value, a]
}
const remove = (i: number) => {
  areas.value = areas.value.filter((_, j) => j !== i)
}

// State -> city/locality suggestions (countries-states-cities data); any typed text can be added as-is.
const { data: states } = await useFetch('/api/geo/states', { query: { country: toRef(props, 'country') }, default: () => [] })
const stateCode = ref<string>()
watch(() => props.country, () => (stateCode.value = undefined))
const state = computed(() => states.value.find(s => s.code === stateCode.value))
const stateItems = computed(() => states.value.map(s => ({ label: s.name, value: s.code })))

const term = ref('')
const debounced = refDebounced(term, 250)
const { data: cities, status: cityStatus } = await useFetch('/api/geo/cities', {
  query: { country: toRef(props, 'country'), state: stateCode, q: debounced },
  immediate: false,
  watch: [stateCode, debounced],
  default: () => []
})
const cityItems = computed(() => cities.value.map(c => c.name))
const withState = (city: string) => (state.value ? `${city}, ${state.value.name}` : city)
function pickCity(city: unknown) {
  if (typeof city !== 'string' || !city) return
  add(withState(city))
  term.value = ''
}

// Map picker: the visible map rectangle becomes the area; scans search only inside it.
const config = useRuntimeConfig()
const mapOpen = ref(false)
const mapEl = ref<HTMLElement>()
const mapName = ref('')
const tooBig = ref(false)
let map: google.maps.Map | undefined

const center = () => {
  const city = cities.value.find(c => c.name.toLowerCase() === term.value.toLowerCase())
  if (city) return { lat: city.lat, lng: city.lng, zoom: 13 }
  if (state.value) return { lat: state.value.lat, lng: state.value.lng, zoom: 9 }
  const pts = states.value.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  if (!pts.length) return { lat: 20, lng: 0, zoom: 2 }
  return { lat: pts.reduce((n, s) => n + s.lat, 0) / pts.length, lng: pts.reduce((n, s) => n + s.lng, 0) / pts.length, zoom: 5 }
}

async function openMap() {
  mapName.value = term.value ? withState(term.value) : `Map area ${areas.value.length + 1}`
  mapOpen.value = true
  await nextTick()
  setOptions({ key: config.public.googleMapsKey, v: 'weekly' })
  const { Map } = await importLibrary('maps')
  const c = center()
  map = new Map(mapEl.value!, { center: { lat: c.lat, lng: c.lng }, zoom: c.zoom, mapTypeControl: false, streetViewControl: false })
  map.addListener('idle', () => {
    const b = map!.getBounds()
    tooBig.value = !!b && b.toSpan().lat() > 0.3
  })
}

function addMapArea() {
  const b = map?.getBounds()
  if (!b) return
  const sw = b.getSouthWest()
  const ne = b.getNorthEast()
  add({ name: mapName.value.trim() || `Map area ${areas.value.length + 1}`, bounds: { low: { lat: sw.lat(), lng: sw.lng() }, high: { lat: ne.lat(), lng: ne.lng() } } })
  mapOpen.value = false
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="areas.length" class="flex flex-wrap gap-1.5">
      <UBadge
        v-for="(a, i) in areas"
        :key="name(a)"
        color="neutral"
        variant="subtle"
        class="gap-1"
      >
        <UIcon v-if="typeof a !== 'string'" name="i-lucide-map" class="size-3.5" />
        {{ name(a) }}
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="link"
          class="p-0"
          :aria-label="`Remove ${name(a)}`"
          @click="remove(i)"
        />
      </UBadge>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <USelectMenu
        v-model="stateCode"
        :items="stateItems"
        value-key="value"
        placeholder="State / region"
        class="w-full"
      />
      <UInputMenu
        v-model:search-term="term"
        :items="cityItems"
        :loading="cityStatus === 'pending'"
        ignore-filter
        create-item="always"
        :placeholder="stateCode ? 'City or locality' : 'Type an area, e.g. Covent Garden, London'"
        class="w-full"
        @update:model-value="pickCity"
        @create="pickCity"
      />
    </div>

    <UButton
      label="Pick on map"
      icon="i-lucide-map"
      size="xs"
      color="neutral"
      variant="outline"
      :disabled="!config.public.googleMapsKey"
      :title="config.public.googleMapsKey ? '' : 'Set NUXT_PUBLIC_GOOGLE_MAPS_KEY to enable the map'"
      @click="openMap"
    />

    <UModal
      v-model:open="mapOpen"
      title="Pick an area on the map"
      description="Pan and zoom until the visible map covers the area, then add it."
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <div ref="mapEl" class="h-[60vh] w-full rounded-md" />
        <p v-if="tooBig" class="text-sm text-warning mt-2">
          This view is large. Google returns at most 60 businesses per area, so zoom in to a neighbourhood for better coverage.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full items-center gap-2">
          <UInput v-model="mapName" placeholder="Name this area" class="flex-1" />
          <UButton label="Add this view" icon="i-lucide-plus" @click="addMapArea" />
        </div>
      </template>
    </UModal>
  </div>
</template>
