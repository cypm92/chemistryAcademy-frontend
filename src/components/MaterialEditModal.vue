<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { api, errorMessage } from '../services/api'
import { session } from '../services/session'
import type { Material, Tag } from '../types'
import MaterialTagPicker from './MaterialTagPicker.vue'

const props = defineProps<{ item: Material }>()
const emit = defineEmits<{ close: []; saved: [item: Material] }>()
const title = ref(props.item.title)
const tags = ref(props.item.tags.map(tag => tag.name))
const pendingTag = ref('')
const saving = ref(false)
const error = ref('')
const dialog = ref<HTMLElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const tagPicker = ref<InstanceType<typeof MaterialTagPicker> | null>(null)
const availableTags = ref<Tag[]>([])
const catalogLoading = ref(false)
const catalogError = ref('')
const selectorOpen = ref(false)

const normalize = (values: string[]) => [...new Set(values.flatMap(value => value.split(',')).map(value => value.trim().toUpperCase()).filter(Boolean))].sort()
const tagsChanged = computed(() => JSON.stringify(normalize(tags.value)) !== JSON.stringify(normalize(props.item.tags.map(tag => tag.name))))

async function loadTags() {
  catalogLoading.value = true; catalogError.value = ''
  try { availableTags.value = (await api.get('/admin/tags')).data }
  catch (e) { catalogError.value = errorMessage(e) }
  finally { catalogLoading.value = false }
}

function close() { if (!saving.value) emit('close') }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (selectorOpen.value) tagPicker.value?.closeSelector()
    else close()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'))
  if (!controls.length) { event.preventDefault(); return }
  const first = controls[0]!, last = controls[controls.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(() => { void loadTags(); void nextTick(() => titleInput.value?.focus()) })
async function save() {
  if (saving.value || session.user?.role !== 'admin') return
  error.value = ''
  if (!title.value.trim() || title.value.length > 180) { error.value = 'Introduce un título de hasta 180 caracteres.'; return }
  if (pendingTag.value.trim()) { error.value = 'Añade la etiqueta escrita antes de guardar.'; return }
  if (tagsChanged.value && !window.confirm('Cambiar las etiquetas puede conceder o retirar acceso por etiqueta. Los accesos directos se conservan. ¿Quieres guardar los cambios?')) return
  saving.value = true
  try {
    const response = await api.patch(`/admin/materials/${props.item.id}`, { title: title.value, tags: tags.value })
    emit('saved', response.data)
  } catch (e) { error.value = errorMessage(e) }
  finally { saving.value = false }
}
</script>

<template>
  <div ref="dialog" class="modal folder-color-modal" role="dialog" aria-modal="true" aria-label="Editar material" @keydown="keydown" @click.self="close">
    <form class="folder-color-card material-edit-card" @submit.prevent="save">
      <header><div><p class="eyebrow">METADATOS DEL MATERIAL</p><h2>Editar material</h2></div><button class="icon-button" type="button" aria-label="Cerrar" :disabled="saving" @click="close">×</button></header>
      <div class="folder-color-body">
        <label>Título visible<input ref="titleInput" v-model="title" name="title" maxlength="180" required :disabled="saving" /></label>
        <MaterialTagPicker ref="tagPicker" v-model="tags" v-model:pending="pendingTag" v-model:open="selectorOpen" :available="availableTags" :loading="catalogLoading" :catalog-error="catalogError" :disabled="saving" @retry="loadTags" />
        <p v-if="tagsChanged" class="material-edit-warning">Cambiar etiquetas puede conceder o retirar acceso por etiqueta. Los accesos directos se conservan.</p>
        <p v-if="error" class="alert" role="alert">{{ error }}</p>
      </div>
      <footer><button class="secondary" type="button" :disabled="saving" @click="close">Cancelar</button><button class="primary" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button></footer>
    </form>
  </div>
</template>

<style scoped>
.folder-color-modal { grid-template-columns: minmax(0, 1fr) }
.material-edit-card { min-width: 0; max-width: 100%; max-height: 90vh; overflow-y: auto }
.material-edit-card .folder-color-body { gap: 14px }
.material-edit-card label { display: grid; gap: 6px; font-weight: 700 }
.material-edit-warning { line-height: 1.5; color: #754800 }
</style>
