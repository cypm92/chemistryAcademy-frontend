<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { api, errorMessage } from '../services/api'
import type { Tag } from '../types'

const props = withDefaults(defineProps<{ modelValue: string[]; pending: string; open: boolean; available: Tag[]; loading?: boolean; catalogError?: string; disabled?: boolean }>(), { loading: false, catalogError: '', disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; 'update:pending': [value: string]; 'update:open': [value: boolean]; retry: []; deleted: [tag: Tag] }>()
const search = ref('')
const error = ref('')
const selectorButton = ref<HTMLButtonElement | null>(null)
const deletingTag = ref<Tag | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const cancelDeleteButton = ref<HTMLButtonElement | null>(null)
const confirmDeleteButton = ref<HTMLButtonElement | null>(null)
let deleteOrigin: HTMLElement | null = null
const normalize = (value: string) => value.trim().toUpperCase()
const matching = computed(() => props.available.filter(tag => normalize(tag.name).includes(normalize(search.value))))
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
function openDelete(tag: Tag, event: Event) {
  deleteOrigin = event.currentTarget as HTMLElement
  deletingTag.value = tag; deleteError.value = ''
  void nextTick(() => cancelDeleteButton.value?.focus())
}
function cancelDelete() {
  if (deleting.value) return
  deletingTag.value = null
  void nextTick(() => deleteOrigin?.focus())
}
function deleteKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Escape') { event.preventDefault(); cancelDelete(); return }
  if (event.key !== 'Tab') return
  if (event.shiftKey && document.activeElement === cancelDeleteButton.value) { event.preventDefault(); confirmDeleteButton.value?.focus() }
  else if (!event.shiftKey && document.activeElement === confirmDeleteButton.value) { event.preventDefault(); cancelDeleteButton.value?.focus() }
}
async function confirmDelete() {
  if (!deletingTag.value || deleting.value) return
  const tag = deletingTag.value
  const equivalents = props.available.filter(item => normalize(item.name) === normalize(tag.name))
  if (equivalents.length > 1 && props.modelValue.some(value => normalize(value) === normalize(tag.name) && !equivalents.some(item => item.name === value))) {
    deleteError.value = 'Selección ambigua: quita primero la etiqueta pendiente del formulario para eliminarla con seguridad.'
    return
  }
  deleting.value = true; deleteError.value = ''
  try {
    await api.delete(`/admin/tags/${tag.id}`)
    emit('update:modelValue', props.modelValue.filter(value => equivalents.length === 1 ? normalize(value) !== normalize(tag.name) : value !== tag.name))
    emit('deleted', tag)
    deletingTag.value = null
    void nextTick(() => selectorButton.value?.focus())
  } catch (e) { deleteError.value = errorMessage(e) }
  finally { deleting.value = false }
}
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
        <div v-if="matching.length" class="tag-selector-list"><div v-for="tag in matching" :key="tag.id" class="tag-selector-row"><span v-if="modelValue.some(value => normalize(value) === normalize(tag.name))" class="tag-selected">{{ tag.name }} ✓</span><button v-else type="button" :aria-label="`Seleccionar etiqueta ${tag.name}`" :disabled="disabled" @click="select(tag.name)">{{ tag.name }}</button><button type="button" :aria-label="`Eliminar etiqueta ${tag.name}`" :disabled="disabled" @click="openDelete(tag, $event)">×</button></div></div>
        <small v-else>No hay etiquetas disponibles.</small>
      </div>
    </div>
    <label>Nueva etiqueta<input :value="pending" name="tag" maxlength="80" :disabled="disabled" @input="emit('update:pending', ($event.target as HTMLInputElement).value)" @keydown.enter.prevent="add" /></label>
    <button type="button" class="secondary" aria-label="Añadir etiqueta" :disabled="disabled || !pending.trim()" @click="add">Añadir etiqueta</button>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <div v-if="deletingTag" class="modal folder-color-modal tag-delete-modal" role="dialog" aria-modal="true" aria-label="Eliminar etiqueta" @keydown="deleteKeydown">
      <section class="folder-color-card tag-delete-card"><header><h2>¿Eliminar la etiqueta «{{ deletingTag.name }}»?</h2></header><div class="folder-color-body"><p>Se quitará de todos los archivos y se eliminarán los permisos concedidos mediante ella. Los archivos, los accesos directos y los accesos por otras etiquetas se conservan.</p><p v-if="deleteError" class="alert" role="alert">{{ deleteError }}</p></div><footer><button ref="cancelDeleteButton" type="button" class="secondary" :disabled="deleting" @click="cancelDelete">Cancelar</button><button ref="confirmDeleteButton" type="button" class="danger" data-confirm-delete-tag :disabled="deleting" @click="confirmDelete">Eliminar etiqueta</button></footer></section>
    </div>
  </div>
</template>

<style scoped>
.material-tags-picker { display: grid; gap: 14px }
.tag-delete-modal { grid-template-columns: minmax(0, 1fr) }
.tag-delete-card { min-width: 0; max-width: 100%; overflow-wrap: anywhere }
.tag-delete-card footer { flex-wrap: wrap }
.material-tags-picker label { display: grid; gap: 6px; font-weight: 700 }
.material-edit-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px }
.material-edit-tags span { background: var(--mint); border-radius: 8px; padding: 5px 8px; overflow-wrap: anywhere }
.material-edit-tags button { border: 0; background: transparent; color: var(--ink); cursor: pointer; font-size: 1.1em }
.material-tag-picker > button { width: 100%; text-align: left }
.material-tag-picker > button:disabled { opacity: .6; cursor: not-allowed }
.material-tag-error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px }
.tag-selector-options { display: grid; gap: 6px; margin-top: 8px }
.tag-selector-list { display: grid; max-height: 150px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px }
.tag-selector-row { display: flex; min-width: 0 }
.tag-selector-row button:first-child { flex: 1; min-width: 0; overflow-wrap: anywhere }
.tag-selected { flex: 1; min-width: 0; overflow-wrap: anywhere; padding: 8px 12px }
.tag-selector-list button { min-height: 44px; text-align: left; padding: 8px 12px; border: 0; background: transparent; color: var(--ink); cursor: pointer }
.tag-selector-list button:hover, .tag-selector-list button:focus-visible { background: var(--mint) }
.tag-selector-list button:focus-visible, .material-edit-tags button:focus-visible { outline: 2px solid var(--brand-green); outline-offset: -2px }
</style>