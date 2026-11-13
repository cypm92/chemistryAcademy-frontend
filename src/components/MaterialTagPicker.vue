<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Tag } from '../types'

const props = withDefaults(defineProps<{ modelValue: string[]; pending: string; open: boolean; available: Tag[]; loading?: boolean; catalogError?: string; disabled?: boolean }>(), { loading: false, catalogError: '', disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; 'update:pending': [value: string]; 'update:open': [value: boolean]; retry: [] }>()
const search = ref('')
const error = ref('')
const selectorButton = ref<HTMLButtonElement | null>(null)
const normalize = (value: string) => value.trim().toUpperCase()
const matching = computed(() => props.available.filter(tag => !props.modelValue.some(value => normalize(value) === normalize(tag.name)) && normalize(tag.name).includes(normalize(search.value))))
function select(name: string) {
  if (!props.modelValue.some(value => normalize(value) === normalize(name))) emit('update:modelValue', [...props.modelValue, name])
  search.value = ''
}
function add() {
  const names = props.pending.split(',').map(normalize).filter(Boolean)
  if (names.some(name => name.length > 80)) { error.value = 'Cada etiqueta debe tener como máximo 80 caracteres.'; return }
  const values = [...props.modelValue]
  for (const name of names) if (!values.some(value => normalize(value) === name)) values.push(name)
  emit('update:modelValue', values); emit('update:pending', ''); error.value = ''
}
function closeSelector() { emit('update:open', false); void nextTick(() => selectorButton.value?.focus()) }
defineExpose({ closeSelector })
</script>

<template>
  <div class="material-tags-picker">
    <div><b>Etiquetas</b><div class="material-edit-tags"><span v-for="tag in modelValue" :key="tag">{{ tag }} <button type="button" :aria-label="`Quitar etiqueta ${tag}`" :disabled="disabled" @click="emit('update:modelValue', modelValue.filter(value => value !== tag))">×</button></span><small v-if="!modelValue.length">Sin etiquetas</small></div></div>
    <div class="material-tag-picker">
      <button ref="selectorButton" type="button" class="secondary" aria-label="Mostrar etiquetas existentes" :aria-expanded="open" :disabled="disabled || loading || !!catalogError" @click="emit('update:open', !open)">{{ loading ? 'Cargando etiquetas…' : 'Elegir etiquetas existentes' }} ▾</button>
      <div v-if="catalogError" class="alert material-tag-error" role="alert"><span>No se pudieron cargar las etiquetas. {{ catalogError }}</span><button class="secondary" type="button" aria-label="Reintentar cargar etiquetas" :disabled="disabled" @click="emit('retry')">Reintentar</button></div>
      <div v-if="open" class="tag-selector-options" @keydown.esc.stop.prevent="closeSelector">
        <input :value="search" aria-label="Buscar etiquetas existentes" placeholder="Buscar etiquetas" :disabled="disabled" @input="search = ($event.target as HTMLInputElement).value" @keydown.enter.prevent />
        <div v-if="matching.length" class="tag-selector-list"><button v-for="tag in matching" :key="tag.id" type="button" :aria-label="`Seleccionar etiqueta ${tag.name}`" :disabled="disabled" @click="select(tag.name)">{{ tag.name }}</button></div>
        <small v-else>No hay etiquetas disponibles.</small>
      </div>
    </div>
    <label>Nueva etiqueta<input :value="pending" name="tag" maxlength="80" :disabled="disabled" @input="emit('update:pending', ($event.target as HTMLInputElement).value)" @keydown.enter.prevent="add" /></label>
    <button type="button" class="secondary" aria-label="Añadir etiqueta" :disabled="disabled || !pending.trim()" @click="add">Añadir etiqueta</button>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.material-tags-picker { display: grid; gap: 14px }
.material-tags-picker label { display: grid; gap: 6px; font-weight: 700 }
.material-edit-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px }
.material-edit-tags span { background: var(--mint); border-radius: 8px; padding: 5px 8px; overflow-wrap: anywhere }
.material-edit-tags button { border: 0; background: transparent; color: var(--ink); cursor: pointer; font-size: 1.1em }
.material-tag-picker > button { width: 100%; text-align: left }
.material-tag-picker > button:disabled { opacity: .6; cursor: not-allowed }
.material-tag-error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px }
.tag-selector-options { display: grid; gap: 6px; margin-top: 8px }
.tag-selector-list { display: grid; max-height: 150px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px }
.tag-selector-list button { min-height: 44px; text-align: left; padding: 8px 12px; border: 0; background: transparent; color: var(--ink); cursor: pointer }
.tag-selector-list button:hover, .tag-selector-list button:focus-visible { background: var(--mint) }
.tag-selector-list button:focus-visible, .material-edit-tags button:focus-visible { outline: 2px solid var(--brand-green); outline-offset: -2px }
</style>