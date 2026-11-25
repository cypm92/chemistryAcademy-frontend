<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { Tag } from '../types'

const props = defineProps<{ modelValue: string[]; available: Tag[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const open = ref(false)
const triggerButton = ref<HTMLButtonElement | null>(null)

function togglePopup() { open.value = !open.value }
function closePopup() { open.value = false; void nextTick(() => triggerButton.value?.focus()) }
function toggleTag(name: string) {
  emit('update:modelValue', props.modelValue.includes(name) ? props.modelValue.filter(value => value !== name) : [...props.modelValue, name])
}
function panelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closePopup() }
}
</script>

<template>
  <div class="library-tag-filter">
    <button ref="triggerButton" type="button" class="secondary small library-tag-trigger" aria-label="Mostrar etiquetas disponibles" :aria-expanded="open" @click="togglePopup">Etiquetas ▾</button>
    <div v-if="modelValue.length" class="library-tag-chips">
      <span v-for="tag in modelValue" :key="tag" class="library-tag-chip">{{ tag }}<button type="button" :aria-label="`Quitar etiqueta ${tag}`" @click="toggleTag(tag)">×</button></span>
    </div>
    <div v-if="open" class="library-tag-popup" role="group" aria-label="Etiquetas disponibles" @keydown="panelKeydown">
      <p v-if="!available.length" class="library-tag-empty">No tienes etiquetas disponibles todavía.</p>
      <button v-for="tag in available" :key="tag.id" type="button" class="library-tag-option" :aria-pressed="modelValue.includes(tag.name)" @click="toggleTag(tag.name)">{{ tag.name }}</button>
    </div>
  </div>
</template>

<style scoped>
.library-tag-filter { position: relative; display: flex; align-items: center; gap: 8px; flex-wrap: wrap }
.library-tag-chips { display: flex; flex-wrap: wrap; gap: 6px }
.library-tag-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--mint); color: var(--ink); border-radius: 20px; padding: 5px 6px 5px 10px; font-size: 12px; font-weight: 600 }
.library-tag-chip button { border: 0; background: transparent; color: var(--ink); font-size: 14px; line-height: 1; padding: 2px; cursor: pointer }
.library-tag-popup { position: absolute; top: calc(100% + 8px); left: 0; z-index: 10; display: grid; gap: 4px; min-width: 220px; max-height: 260px; overflow-y: auto; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); box-shadow: 0 16px 34px #10251d24 }
.library-tag-option { text-align: left; border: 0; border-radius: 8px; background: transparent; padding: 8px 10px; color: var(--ink); font-size: 13px }
.library-tag-option:hover, .library-tag-option[aria-pressed="true"] { background: var(--mint) }
.library-tag-empty { margin: 0; padding: 6px 4px; color: var(--muted); font-size: 12px }
</style>
