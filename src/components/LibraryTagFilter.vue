<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import type { Tag } from '../types'

const props = defineProps<{ modelValue: string[]; available: Tag[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const triggerButton = ref<HTMLButtonElement | null>(null)
const search = ref('')
const normalize = (value: string) => value.trim().toLowerCase()
// Buscador interno del popup (I-3): filtra por subcadena insensible a mayúsculas, igual que
// MaterialTagPicker.vue, en vez de depender del scroll sobre el catálogo completo.
const filteredAvailable = computed(() => {
  const query = normalize(search.value)
  return query ? props.available.filter(tag => normalize(tag.name).includes(query)) : props.available
})

// Cierre al pulsar fuera: el listener se añade a document solo mientras el popup está abierto
// (togglePopup/closePopup) y se retira siempre al cerrar o desmontar, para no dejar listeners
// colgados. Comprueba que el clic no cayó dentro del elemento raíz del componente.
function clickOutside(event: MouseEvent) {
  if (root.value && event.target instanceof Node && !root.value.contains(event.target)) closePopup()
}
function togglePopup() {
  open.value = !open.value
  if (open.value) document.addEventListener('mousedown', clickOutside)
  else document.removeEventListener('mousedown', clickOutside)
}
function closePopup() {
  open.value = false; search.value = ''
  document.removeEventListener('mousedown', clickOutside)
  void nextTick(() => triggerButton.value?.focus())
}
onBeforeUnmount(() => document.removeEventListener('mousedown', clickOutside))
function toggleTag(name: string) {
  emit('update:modelValue', props.modelValue.includes(name) ? props.modelValue.filter(value => value !== name) : [...props.modelValue, name])
}
function panelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closePopup() }
}
</script>

<template>
  <div ref="root" class="library-tag-filter">
    <button ref="triggerButton" type="button" class="secondary small library-tag-trigger" aria-label="Mostrar etiquetas disponibles" :aria-expanded="open" @click="togglePopup">Etiquetas ▾</button>
    <div v-if="modelValue.length" class="library-tag-chips">
      <span v-for="tag in modelValue" :key="tag" class="library-tag-chip">{{ tag }}<button type="button" :aria-label="`Quitar etiqueta ${tag}`" @click="toggleTag(tag)">×</button></span>
    </div>
    <div v-if="open" class="library-tag-popup" role="group" aria-label="Etiquetas disponibles" @keydown="panelKeydown">
      <input v-if="available.length" v-model="search" type="search" class="library-tag-search" aria-label="Buscar etiquetas" placeholder="Buscar etiquetas…" />
      <p v-if="!available.length" class="library-tag-empty">No tienes etiquetas disponibles todavía.</p>
      <p v-else-if="!filteredAvailable.length" class="library-tag-empty">No hay etiquetas que coincidan con la búsqueda.</p>
      <button v-for="tag in filteredAvailable" :key="tag.id" type="button" class="library-tag-option" :aria-pressed="modelValue.includes(tag.name)" @click="toggleTag(tag.name)">{{ tag.name }}</button>
    </div>
  </div>
</template>

<style scoped>
.library-tag-filter { position: relative; display: flex; align-items: center; gap: 8px; flex-wrap: wrap }
.library-tag-chips { display: flex; flex-wrap: wrap; gap: 6px }
.library-tag-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--mint); color: var(--ink); border-radius: 20px; padding: 5px 6px 5px 10px; font-size: 12px; font-weight: 600 }
.library-tag-chip button { border: 0; background: transparent; color: var(--ink); font-size: 14px; line-height: 1; padding: 2px; cursor: pointer }
.library-tag-popup { position: absolute; top: calc(100% + 8px); left: 0; z-index: 10; display: grid; gap: 4px; min-width: 220px; max-height: 260px; overflow-y: auto; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); box-shadow: 0 16px 34px #10251d24 }
.library-tag-search { position: sticky; top: 0; margin-bottom: 4px; border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font-size: 12px; background: var(--paper); color: var(--ink) }
.library-tag-option { text-align: left; border: 0; border-radius: 8px; background: transparent; padding: 8px 10px; color: var(--ink); font-size: 13px }
.library-tag-option:hover, .library-tag-option[aria-pressed="true"] { background: var(--mint) }
.library-tag-empty { margin: 0; padding: 6px 4px; color: var(--muted); font-size: 12px }
</style>
