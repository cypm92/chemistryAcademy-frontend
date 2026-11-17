<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { api, errorMessage, downloadMaterial } from '../services/api'
import { session } from '../services/session'
import type { Material, User } from '../types'
import StudentMaterialsModal from './StudentMaterialsModal.vue'
import { permissionTimeoutToast } from '../services/permissionTimeoutToast'

const props = defineProps<{ item: Material; sharingPending?: boolean; sharingFailed?: boolean; canReorder?: boolean; first?: boolean; last?: boolean; ordering?: boolean }>()
const emit = defineEmits<{
  open: [item: Material]
  move: [item: Material]
  edit: [item: Material]
  changed: []
  notice: [message: string]
  error: [message: string]
  reorder: [item: Material, direction: 'up' | 'down']
  retrySharing: []
}>()
const sharingOpen = ref(false)
const sharingDialog = ref<HTMLElement | null>(null)
let sharingOrigin: HTMLElement | null = null
async function openSharing() {
  sharingOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null
  sharingOpen.value = true
  await nextTick()
  sharingDialog.value?.querySelector<HTMLElement>('button')?.focus()
}
function closeSharing() { sharingOpen.value = false; sharingOrigin?.focus() }
function sharingKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeSharing(); return }
  if (event.key !== 'Tab' || !sharingDialog.value) return
  const controls = [...sharingDialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
  const first = controls[0], last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
const selectedStudent = ref<User | null>(null)

let studentOrigin: HTMLElement | null = null
function openStudent(user: User) { studentOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null; selectedStudent.value = user }
async function closeStudent() { selectedStudent.value = null; await nextTick(); if (studentOrigin?.isConnected) studentOrigin.focus(); else sharingDialog.value?.querySelector<HTMLElement>('button')?.focus() }
const sharing = computed(() => props.item.sharing ?? (props.item.grants || []).map(grant => ({ user: grant.user, direct: grant, tags: [] })))

function formatSize(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function expiry(value?: string) {
  if (session.user?.role === 'admin') return 'Acceso administrador'
  return value ? `Hasta ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))}` : ''
}
async function download() {
  await downloadMaterial(props.item.id, props.item.filename)
}

async function deleteMaterial() {
  if (!window.confirm(`¿Eliminar “${props.item.title}”? Se borrarán el archivo y todos sus accesos. Esta acción no se puede deshacer.`)) return
  try { await api.delete(`/admin/materials/${props.item.id}`); emit('notice', `“${props.item.title}” se ha eliminado.`); emit('changed') }
  catch (e) { emit('error', errorMessage(e)) }
}
async function toggleFavorite() {
  try {
    await api[props.item.is_favorite ? 'delete' : 'post'](`/materials/${props.item.id}/favorite`)
    emit('notice', props.item.is_favorite ? 'Material eliminado de favoritos.' : 'Material añadido a favoritos.')
    emit('changed')
  } catch (e) { emit('error', errorMessage(e)) }
}
</script>

<template>
  <article class="material-card">
    <div :class="['material-cover', item.kind]"><span>{{ item.kind === 'video' ? '▶' : 'PDF' }}</span><small>{{ item.kind === 'video' ? 'CLASE EN VÍDEO' : 'APUNTES' }}</small></div>
    <div class="material-info">
      <div class="material-meta"><span>{{ formatSize(item.size_bytes) }}</span><span>{{ expiry(item.expires_at) }}</span></div>
      <h3>{{ item.title }}</h3><p>{{ item.description || 'Material de estudio de la academia.' }}</p>
      <div v-if="item.tags?.length" class="material-tags"><span v-for="tag in item.tags" :key="tag.id">{{ tag.name }}</span></div>
      <div v-if="session.user?.role === 'admin' && sharingOpen" v-show="!selectedStudent" ref="sharingDialog" class="modal folder-color-modal" role="dialog" aria-modal="true" :aria-label="`Compartido con: ${item.title}`" @click.self="closeSharing" @keydown="sharingKeydown">
        <div class="folder-color-card sharing-dialog"><header><h2>Compartido con</h2><button type="button" class="icon-button" aria-label="Cerrar" @click="closeSharing">×</button></header><div class="folder-color-body">
        <div class="sharing-title"><b>{{ item.title }}</b><span v-if="!permissionTimeoutToast && !sharingPending">{{ sharing.length }} {{ sharing.length === 1 ? 'alumno' : 'alumnos' }}</span></div>
        <p v-if="permissionTimeoutToast" role="status">Recarga la página para consultar los accesos.</p><p v-else-if="sharingPending" role="status">Actualizando accesos…</p><div v-else-if="sharing.length" class="share-list">
          <div v-for="entry in sharing" :key="entry.user.id" class="share-row">
            <div class="student-avatar">{{ entry.user.name.slice(0, 1).toUpperCase() }}</div>
            <div class="share-person"><b>{{ entry.user.name }}</b><small>{{ entry.user.email }}</small>
              <small>{{ [entry.direct ? 'Directo' : '', ...entry.tags.map(tag => `Etiqueta: ${tag.name}`)].filter(Boolean).join(' · ') }}</small>
              <small v-if="entry.direct">Caduca acceso directo {{ new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.direct.expires_at)) }}</small>
            </div>
            <div class="share-actions"><button class="edit-button" :aria-label="`Editar accesos de ${entry.user.name}`" @click="openStudent(entry.user)">Editar</button></div>
          </div>
        </div>
        <p v-else class="not-shared">Todavía no está compartido con ningún alumno.</p></div></div>
      </div>
      <StudentMaterialsModal v-if="selectedStudent" :student="selectedStudent" @close="closeStudent" @changed="emit('changed')" />
      <div class="card-actions">
        <button v-if="session.user?.role === 'admin' && sharingFailed && !permissionTimeoutToast" type="button" class="secondary small" :aria-label="`Reintentar accesos: ${item.title}`" @click="emit('retrySharing')">Reintentar accesos</button>
        <button v-else-if="session.user?.role === 'admin'" type="button" class="secondary small" :disabled="!!permissionTimeoutToast || sharingPending" :aria-label="`Compartido con: ${item.title}`" @click="openSharing">{{ permissionTimeoutToast ? 'Accesos no disponibles' : sharingPending ? 'Actualizando accesos…' : `Compartido con (${sharing.length})` }}</button>
        <button type="button" :class="['favorite-button', { active: item.is_favorite }]" :title="item.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'" :aria-label="item.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'" :aria-pressed="item.is_favorite" @click="toggleFavorite"><svg class="favorite-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg></button>
        <button class="primary small" @click="emit('open', item)">Abrir material</button>
        <button v-if="session.user?.role === 'admin'" type="button" class="secondary small" :aria-label="`Editar material ${item.title}`" @click="emit('edit', item)">Editar</button>
        <button v-if="session.user?.role === 'admin'" class="secondary small move-material-button" @click="emit('move', item)">Mover</button>
        <button v-if="item.can_download" class="secondary small" @click="download">Descargar</button>
        <button v-if="session.user?.role === 'admin'" class="danger small" @click="deleteMaterial">Eliminar</button>
        <template v-if="session.user?.role === 'admin' && canReorder"><button type="button" class="secondary small" :aria-label="`Subir ${item.title}`" :disabled="first || ordering" @click="emit('reorder', item, 'up')">↑</button><button type="button" class="secondary small" :aria-label="`Bajar ${item.title}`" :disabled="last || ordering" @click="emit('reorder', item, 'down')">↓</button></template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.sharing-dialog { min-width: 0; max-height: min(85vh, 800px); display: flex; flex-direction: column; }
.sharing-dialog .folder-color-body { min-height: 0; overflow-y: auto; overflow-x: hidden; }
.sharing-dialog .share-person { min-width: 0; overflow-wrap: anywhere; }
.folder-color-modal { grid-template-columns: minmax(0, 1fr); }
</style>
