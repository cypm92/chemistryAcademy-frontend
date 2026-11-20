<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { api, apiUrl, errorMessage } from '../services/api'
import type { Folder, Tag } from '../types'
import FolderTreePicker from '../components/FolderTreePicker.vue'
import MaterialTagPicker from '../components/MaterialTagPicker.vue'
import StudentsView from './StudentsView.vue'
import MicrosoftIntegration from '../components/MicrosoftIntegration.vue'
import HomeSettings from '../components/HomeSettings.vue'

const folders = ref<Folder[]>([])
const tags = ref<Tag[]>([])
const notice = ref('')
const error = ref('')

const upload = ref({ title: '', description: '', tags: '', file: null as File | null })
const uploadTags = ref<string[]>([])
const uploadPendingTag = ref('')
const uploadTagSelectorOpen = ref(false)
const folderSelection = ref<number | null>(null)
const folderForm = ref<{ name: string; parent_id: number | null }>({ name: '', parent_id: null })
const editingFolderId = ref<number | null>(null)
const folderNameInput = ref<HTMLInputElement | null>(null)
const folderModalOpen = ref(false)
const folderReturnFocus = ref<HTMLElement | null>(null)
const deletingFolder = ref<Folder | null>(null)
const folderDeleteBusy = ref(false)
const folderDeleteError = ref('')
const cancelFolderDeleteButton = ref<HTMLButtonElement | null>(null)
const confirmFolderDeleteButton = ref<HTMLButtonElement | null>(null)
const newFolderButton = ref<HTMLButtonElement | null>(null)
let folderDeleteOrigin: HTMLElement | null = null
const folderSearch = ref('')
const expandedFolderIds = ref<number[]>([])
const activeSection = ref<'students' | 'folders' | 'resources' | 'settings'>(new URLSearchParams(window.location.search).has('microsoft') ? 'settings' : 'students')
const notificationSettings = ref({ reminder_interval_minutes: 1440 })
type PublicResource = { id: number; title: string; description: string; subject: string; file_url?: string; url?: string; community?: string; exam_year?: number; exam_part?: 'statement' | 'solutions' }
const publicResources = ref<{ exams: PublicResource[]; forms: PublicResource[]; videos: PublicResource[]; documents: PublicResource[] }>({ exams: [], forms: [], videos: [], documents: [] })
const publicExam = ref({ title: '', description: '', subject: 'quimica', community: 'Madrid', exam_year: new Date().getFullYear(), exam_part: 'statement' as 'statement' | 'solutions', file: null as File | null })
const publicDocument = ref({ title: '', description: '', subject: 'quimica', file: null as File | null })
const publicVideo = ref({ title: '', description: '', subject: 'quimica', url: '' })
const publicSubjects = [{ value: 'quimica', label: 'Química' }, { value: 'organica', label: 'Química orgánica' }, { value: 'fisica', label: 'Física' }, { value: 'matematicas', label: 'Matemáticas' }]
const publicExamSubjects = publicSubjects.filter(subject => subject.value !== 'organica')
const publicCommunities = ['Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria', 'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'C. Valenciana', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco']
const resourcesLoading = ref(false)
const resourceBusy = ref(false)
const resourceTabs = ['exam', 'document', 'video'] as const
const resourceTab = ref<(typeof resourceTabs)[number]>('exam')
function resourceTabKeydown(event: KeyboardEvent) {
  const index = resourceTabs.indexOf(resourceTab.value)
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % resourceTabs.length
  else if (event.key === 'ArrowLeft') next = (index + resourceTabs.length - 1) % resourceTabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = resourceTabs.length - 1
  else return
  event.preventDefault()
  resourceTab.value = resourceTabs[next]!
  void nextTick(() => document.getElementById(`resource-tab-${resourceTab.value}`)?.focus())
}
const reminderPreset = ref('1440')

const contactRequests = ref<Array<{ id: number; name: string; contact: string; need: string; message: string; created_at: string }>>([])

const editingFolder = computed(() => folders.value.find((folder) => folder.id === editingFolderId.value))
const folderRows = computed(() => {
  const search = folderSearch.value.trim().toLocaleLowerCase()
  const byId = new Map(folders.value.map((folder) => [folder.id, folder]))
  const hasChildren = new Set(folders.value.filter((folder) => folder.parent_id !== null).map((folder) => folder.parent_id!))
  return [...folders.value].sort((a, b) => a.path.localeCompare(b.path, 'es')).filter((folder) => {
    if (search) return folder.path.toLocaleLowerCase().includes(search)
    let parentId = folder.parent_id
    while (parentId !== null) {
      if (!expandedFolderIds.value.includes(parentId)) return false
      parentId = byId.get(parentId)?.parent_id ?? null
    }
    return true
  }).map((folder) => ({ folder, hasChildren: hasChildren.has(folder.id), depth: folder.path.split(' / ').length - 1 }))
})

async function loadNotificationSettings() {
  const { data } = await api.get('/admin/notification-settings')
  notificationSettings.value = { reminder_interval_minutes: data.reminder_interval_minutes }
  reminderPreset.value = [1440, 360, 120, 30].includes(data.reminder_interval_minutes) ? String(data.reminder_interval_minutes) : 'custom'
}

async function saveNotificationSettings() {
  error.value = ''; notice.value = ''
  const minutes = reminderPreset.value === 'custom' ? notificationSettings.value.reminder_interval_minutes : Number(reminderPreset.value)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 525600) { error.value = 'El intervalo debe ser un número entero entre 1 y 525600 minutos.'; return }

  try {
    const { data } = await api.patch('/admin/notification-settings', { reminder_interval_minutes: minutes })
    notificationSettings.value = { reminder_interval_minutes: data.reminder_interval_minutes }
    reminderPreset.value = [1440, 360, 120, 30].includes(data.reminder_interval_minutes) ? String(data.reminder_interval_minutes) : 'custom'
    notice.value = 'Configuración de notificaciones guardada.'
  } catch (e) { error.value = errorMessage(e) }
}
async function load() {
  const [f, t, contacts] = await Promise.all([api.get('/admin/folders'), api.get('/admin/tags'), api.get('/admin/contact-requests')])
  folders.value = f.data; tags.value = t.data
  contactRequests.value = contacts.data
  if (folderSelection.value === null || !folders.value.some(folder => folder.id === folderSelection.value)) {
    folderSelection.value = folders.value.find(folder => folder.name === 'Sin clasificar' && folder.parent_id === null)?.id ?? null
  }

}
async function loadPublicResources() {
  resourcesLoading.value = true
  try {
    const { data } = await api.get('/admin/public-resources')
    publicResources.value = data
  } finally { resourcesLoading.value = false }
}
async function uploadPublicExam() {
  error.value = ''; notice.value = ''
  const { title, description, subject, community, exam_year, exam_part, file } = publicExam.value
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) { error.value = 'Selecciona un archivo PDF.'; return }
  const body = new FormData()
  body.append('title', title); body.append('description', description); body.append('subject', subject); body.append('community', community); body.append('exam_year', String(exam_year)); body.append('exam_part', exam_part); body.append('file', file)
  resourceBusy.value = true
  try { await api.post('/admin/public-resources/exams', body); publicExam.value = { title: '', description: '', subject: 'quimica', community: 'Madrid', exam_year: new Date().getFullYear(), exam_part: 'statement', file: null }; await loadPublicResources(); notice.value = 'Examen añadido a Recursos.' }
  catch (e) { error.value = errorMessage(e) } finally { resourceBusy.value = false }
}
async function uploadPublicDocument() {
  error.value = ''; notice.value = ''
  const { title, description, subject, file } = publicDocument.value
  if (!file) { error.value = 'Selecciona un archivo PDF.'; return }
  if (file.size > 20 * 1024 * 1024) { error.value = 'El PDF no puede superar 20 MB.'; return }
  if (!file.name.toLowerCase().endsWith('.pdf')) { error.value = 'El archivo debe tener formato PDF.'; return }
  const body = new FormData()
  body.append('title', title); body.append('description', description); body.append('subject', subject); body.append('file', file)
  resourceBusy.value = true
  try {
    await api.post('/admin/public-resources/forms', body)
    publicDocument.value = { title: '', description: '', subject: 'quimica', file: null }
    await loadPublicResources()
    notice.value = 'PDF añadido a Recursos.'
  } catch (e) { error.value = errorMessage(e) } finally { resourceBusy.value = false }
}
async function addInstagramVideo() {
  error.value = ''; notice.value = ''; resourceBusy.value = true
  try {
    await api.post('/admin/public-resources/videos', publicVideo.value)
    publicVideo.value = { title: '', description: '', subject: 'quimica', url: '' }
    await loadPublicResources()
    notice.value = 'Enlace de Instagram añadido a Recursos.'
  } catch (e) { error.value = errorMessage(e) } finally { resourceBusy.value = false }
}
async function removePublicResource(item: PublicResource) {
  if (!window.confirm(`¿Eliminar «${item.title}» de Recursos?`)) return
  error.value = ''; notice.value = ''; resourceBusy.value = true
  try {
    await api.delete(`/admin/public-resources/${item.id}`)
    await loadPublicResources()
    notice.value = 'Recurso eliminado.'
  } catch (e) { error.value = errorMessage(e) } finally { resourceBusy.value = false }
}
async function act(task: () => Promise<unknown>, message: string) {
  error.value = ''; notice.value = ''
  try { await task(); notice.value = message; await load() } catch (e) { error.value = errorMessage(e) }
}

function uploadFile() {
  const file = upload.value.file
  if (!file) return
  if (uploadPendingTag.value.trim()) { error.value = 'Añade la etiqueta escrita antes de subir'; return }
  return act(async () => {
    if (folderSelection.value === null || !folders.value.some(folder => folder.id === folderSelection.value)) throw new Error('Selecciona una carpeta')
    const body = new FormData()
    body.append('title', upload.value.title); body.append('description', upload.value.description)
    body.append('folder_id', String(folderSelection.value)); body.append('tags', uploadTags.value.join(',')); body.append('file', file)
    await api.post('/admin/materials', body)
  }, 'Material subido correctamente.')
}
function tagDeleted(tag: Tag) {
  tags.value = tags.value.filter(item => item.id !== tag.id)
}
async function saveFolder() {
  const editing = editingFolderId.value
  const currentColor = editingFolder.value?.color || null
  const payload = { name: folderForm.value.name, parent_id: folderForm.value.parent_id, color: currentColor }
  error.value = ''; notice.value = ''
  try {
    if (editing) await api.patch(`/admin/folders/${editing}`, payload)
    else await api.post('/admin/folders', payload)
    notice.value = editing ? 'Carpeta actualizada correctamente.' : 'Carpeta creada correctamente.'
    await load()
    cancelEditFolder()
  } catch (e) { error.value = errorMessage(e) }
}
async function openCreateFolder(event: Event) {
  folderReturnFocus.value = event.currentTarget as HTMLElement
  editingFolderId.value = null
  folderForm.value = { name: '', parent_id: null }
  folderModalOpen.value = true
  await nextTick()
  folderNameInput.value?.focus()
}
async function editFolder(folder: Folder, event: Event) {
  folderReturnFocus.value = event.currentTarget as HTMLElement
  editingFolderId.value = folder.id
  folderForm.value = { name: folder.name, parent_id: folder.parent_id }
  folderModalOpen.value = true
  await nextTick()
  folderNameInput.value?.focus()
  folderNameInput.value?.select()
}
function cancelEditFolder() {
  editingFolderId.value = null
  folderForm.value = { name: '', parent_id: null }
  folderModalOpen.value = false
  void nextTick(() => folderReturnFocus.value?.focus())
}
function folderModalKeydown(event: KeyboardEvent, close: () => void) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
  if (event.key !== 'Tab') return
  const focusable = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
  if (!focusable.length) return
  const first = focusable[0]!, last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function folderBranchIds(folderId: number): Set<number> {
  const ids = new Set([folderId])
  const pending = [folderId]
  while (pending.length) {
    const parentId = pending.pop()
    for (const folder of folders.value) {
      if (folder.parent_id !== parentId) continue
      ids.add(folder.id)
      pending.push(folder.id)
    }
  }
  return ids
}
function toggleFolder(folderId: number) {
  if (!expandedFolderIds.value.includes(folderId)) {
    expandedFolderIds.value = [...expandedFolderIds.value, folderId]
    return
  }
  const branchIds = folderBranchIds(folderId)
  expandedFolderIds.value = expandedFolderIds.value.filter((id) => !branchIds.has(id))
}
function openFolderDelete(folder: Folder, event: Event) {
  folderDeleteOrigin = event.currentTarget as HTMLElement
  deletingFolder.value = folder; folderDeleteError.value = ''
  void nextTick(() => cancelFolderDeleteButton.value?.focus())
}
function cancelFolderDelete() {
  if (folderDeleteBusy.value) return
  deletingFolder.value = null
  void nextTick(() => folderDeleteOrigin?.focus())
}
function folderDeleteKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Escape') { event.preventDefault(); cancelFolderDelete(); return }
  if (event.key !== 'Tab') return
  if (event.shiftKey && document.activeElement === cancelFolderDeleteButton.value) { event.preventDefault(); confirmFolderDeleteButton.value?.focus() }
  else if (!event.shiftKey && document.activeElement === confirmFolderDeleteButton.value) { event.preventDefault(); cancelFolderDeleteButton.value?.focus() }
}
async function confirmFolderDelete() {
  if (!deletingFolder.value || folderDeleteBusy.value) return
  const folder = deletingFolder.value
  folderDeleteBusy.value = true; folderDeleteError.value = ''
  try {
    await api.delete(`/admin/folders/${folder.id}`)
    await load()
    notice.value = 'Carpeta eliminada correctamente.'
    deletingFolder.value = null
    void nextTick(() => {
      if (folderDeleteOrigin?.isConnected) folderDeleteOrigin.focus()
      else newFolderButton.value?.focus()
    })
  } catch (e) { folderDeleteError.value = errorMessage(e) }
  finally { folderDeleteBusy.value = false }
}
onMounted(() => Promise.all([load(), loadNotificationSettings(), loadPublicResources()]).catch((e) => error.value = errorMessage(e)))
</script>

<template>
  <section :class="['page', 'admin-page', { 'admin-page-students': activeSection === 'students', 'admin-page-folders': activeSection === 'folders', 'admin-page-settings': activeSection === 'settings', 'admin-page-resources': activeSection === 'resources' }]">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <div class="admin-layout"><nav class="admin-tabs" role="tablist" aria-label="Secciones de administración"><button :class="{ active: activeSection === 'students' }" type="button" role="tab" :aria-selected="activeSection === 'students'" @click="activeSection = 'students'">Usuarios</button><button :class="{ active: activeSection === 'folders' }" type="button" role="tab" :aria-selected="activeSection === 'folders'" @click="activeSection = 'folders'">Carpetas y Archivos</button><button :class="{ active: activeSection === 'resources' }" type="button" role="tab" :aria-selected="activeSection === 'resources'" @click="activeSection = 'resources'">Gestionar Web inicio</button><button :class="{ active: activeSection === 'settings' }" type="button" role="tab" :aria-selected="activeSection === 'settings'" @click="activeSection = 'settings'">Notificaciones</button></nav><main class="admin-content">
    <div v-if="activeSection === 'folders'" class="admin-tab-grid">

      <form class="panel folders-upload-panel" @submit.prevent="uploadFile"><h2>Subir material</h2><p>PDF, MP4, WebM o MOV. Elige una carpeta creada previamente.</p><label>Título<input v-model="upload.title" required /></label><label>Carpeta<FolderTreePicker v-model="folderSelection" :folders="folders" :allow-root="false" /></label><MaterialTagPicker v-model="uploadTags" v-model:pending="uploadPendingTag" v-model:open="uploadTagSelectorOpen" :available="tags" @deleted="tagDeleted" /><label>Descripción<textarea v-model="upload.description" rows="3" /></label><label class="file-input">Archivo<input type="file" accept=".pdf,video/*" required @change="upload.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label><button class="primary">Subir material</button></form>

      <section class="panel folders-explorer-panel">
        <div class="folders-explorer-head"><div><h2>Carpetas</h2><p>Busca, despliega, edita o elimina cualquier carpeta de la biblioteca.</p></div><div class="folders-explorer-head-actions"><span>{{ folders.length }} {{ folders.length === 1 ? 'carpeta' : 'carpetas' }}</span><button ref="newFolderButton" class="primary small new-folder-button" type="button" @click="openCreateFolder($event)">Nueva carpeta</button></div></div>
        <label class="folder-search"><span>⌕</span><input v-model="folderSearch" placeholder="Buscar carpeta..." /></label>
        <div class="folder-admin-list">
          <article v-for="row in folderRows" :key="row.folder.id" :style="{ '--folder-level': row.depth }">
            <button v-if="row.hasChildren" class="folder-toggle" type="button" @click="toggleFolder(row.folder.id)">{{ expandedFolderIds.includes(row.folder.id) ? '⌄' : '›' }}</button><span v-else class="folder-toggle-placeholder" aria-hidden="true"></span>
            <span class="folder-color-dot" :style="{ backgroundColor: row.folder.effective_color || 'var(--brand-green)' }"></span><span class="folder-row-name"><b>{{ row.folder.name }}</b><small v-if="folderSearch">{{ row.folder.path }}</small></span>
            <div v-if="!(row.folder.name === 'Sin clasificar' && row.folder.parent_id === null)" class="folder-row-actions"><button class="edit-button" :aria-label="`Editar la carpeta ${row.folder.name}`" @click="editFolder(row.folder, $event)">Editar</button><button class="remove-button" title="Eliminar carpeta" :aria-label="`Eliminar la carpeta ${row.folder.name}`" @click="openFolderDelete(row.folder, $event)">Eliminar</button></div>
          </article>
          <p v-if="!folderRows.length" class="folder-no-results">No se han encontrado carpetas.</p>
        </div>
      </section>
    </div>

    <div v-if="activeSection === 'folders' && folderModalOpen" class="modal folder-modal-overlay" @click.self="cancelEditFolder" @keydown="folderModalKeydown($event, cancelEditFolder)">
      <section class="folder-modal" role="dialog" aria-modal="true" aria-labelledby="folder-modal-title">
        <header>
          <div><h2 id="folder-modal-title">{{ editingFolderId ? 'Editar carpeta' : 'Crear carpeta' }}</h2><p>{{ editingFolder ? `Cambia el nombre o la ubicación de «${editingFolder.path}».` : 'Añade una carpeta raíz o una subcarpeta a la biblioteca.' }}</p></div>
          <button type="button" class="icon-button" aria-label="Cerrar formulario de carpeta" @click="cancelEditFolder">×</button>
        </header>
        <form class="folder-modal-form" @submit.prevent="saveFolder">
          <label>Nombre<input ref="folderNameInput" v-model="folderForm.name" required placeholder="Ej. Formulación" /></label>
          <label>Dentro de
            <FolderTreePicker :key="editingFolderId ?? 'create'" v-model="folderForm.parent_id" :folders="folders" :excluded-folder-id="editingFolderId" />
            <small>Despliega una carpeta para ver sus subcarpetas.</small>
          </label>
          <div class="folder-form-actions">
            <button class="primary">{{ editingFolderId ? 'Guardar cambios' : 'Crear carpeta' }}</button>
            <button type="button" class="secondary" @click="cancelEditFolder">Cancelar</button>
          </div>
        </form>
      </section>
    </div>
    <div v-if="deletingFolder" class="modal folder-color-modal folder-delete-modal" role="dialog" aria-modal="true" aria-label="Eliminar carpeta" @keydown="folderDeleteKeydown" @click.self="cancelFolderDelete">
      <section class="folder-color-card folder-delete-card">
        <header><h2>¿Eliminar la carpeta «{{ deletingFolder.path }}»?</h2></header>
        <div class="folder-color-body">
          <p>Sus subcarpetas también se eliminarán. Los archivos quedarán sin carpeta.</p>
          <p v-if="folderDeleteError" class="alert" role="alert">{{ folderDeleteError }}</p>
        </div>
        <footer>
          <button ref="cancelFolderDeleteButton" type="button" class="secondary" :disabled="folderDeleteBusy" @click="cancelFolderDelete">Cancelar</button>
          <button ref="confirmFolderDeleteButton" type="button" class="danger" :disabled="folderDeleteBusy" @click="confirmFolderDelete">{{ folderDeleteBusy ? 'Eliminando…' : 'Eliminar carpeta' }}</button>
        </footer>
      </section>
    </div>
    <div v-if="activeSection === 'resources'" class="resource-admin-grid">
      <section class="panel resource-upload-card">
        <div class="admin-tabs resource-upload-tabs" role="tablist" aria-label="Tipo de recurso" @keydown="resourceTabKeydown">
          <button v-for="tab in resourceTabs" :id="`resource-tab-${tab}`" :key="tab" :class="{ active: resourceTab === tab }" type="button" role="tab" :aria-selected="resourceTab === tab" :aria-controls="`resource-panel-${tab}`" :tabindex="resourceTab === tab ? 0 : -1" @click="resourceTab = tab">{{ tab === 'exam' ? 'Examen PAU' : tab === 'document' ? 'Formulario PDF' : 'Instagram' }}</button>
        </div>
      <form v-show="resourceTab === 'exam'" id="resource-panel-exam" role="tabpanel" aria-labelledby="resource-tab-exam" @submit.prevent="uploadPublicExam">
        <h2>Subir examen PAU</h2><p>El examen aparecerá en la pestaña Recursos, visible antes de iniciar sesión. Máximo 20 MB.</p>
        <label>Título<input v-model="publicExam.title" required maxlength="180" /></label>
        <label>Asignatura<select v-model="publicExam.subject"><option v-for="subject in publicExamSubjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option></select></label>
        <label>Comunidad<select v-model="publicExam.community" required><option v-for="community in publicCommunities" :key="community" :value="community">{{ community }}</option></select></label><label>Año<input v-model.number="publicExam.exam_year" type="number" min="2000" max="2100" required /></label><label>Tipo<select v-model="publicExam.exam_part"><option value="statement">Enunciado</option><option value="solutions">Soluciones</option></select></label><label>Descripción<textarea v-model="publicExam.description" rows="3" maxlength="5000" /></label>
        <label>Archivo PDF<input type="file" accept="application/pdf,.pdf" required @change="publicExam.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label>
        <button class="primary" :disabled="resourceBusy">{{ resourceBusy ? 'Guardando…' : 'Subir PDF' }}</button>
      </form>
      <form v-show="resourceTab === 'document'" id="resource-panel-document" role="tabpanel" aria-labelledby="resource-tab-document" @submit.prevent="uploadPublicDocument">
        <h2>Subir formulario PDF</h2><p>Documento público por asignatura.</p>
        <label>Título<input v-model="publicDocument.title" required maxlength="180" /></label>
        <label>Asignatura<select v-model="publicDocument.subject"><option v-for="subject in publicSubjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option></select></label>
        <label>Descripción<textarea v-model="publicDocument.description" rows="3" maxlength="5000" /></label>
        <label>Archivo PDF<input type="file" accept="application/pdf,.pdf" required @change="publicDocument.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label>
        <button class="primary" :disabled="resourceBusy">Subir formulario</button>
      </form>
      <form v-show="resourceTab === 'video'" id="resource-panel-video" role="tabpanel" aria-labelledby="resource-tab-video" @submit.prevent="addInstagramVideo">
        <h2>Añadir publicación de Instagram</h2><p>No se suben vídeos: pega el enlace permanente de una publicación o reel público.</p>
        <label>Título<input v-model="publicVideo.title" required maxlength="180" /></label>
        <label>Asignatura<select v-model="publicVideo.subject"><option v-for="subject in publicSubjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option></select></label>
        <label>Enlace de Instagram<input v-model="publicVideo.url" type="url" required placeholder="https://www.instagram.com/reel/..." /></label>
        <label>Descripción<textarea v-model="publicVideo.description" rows="3" maxlength="5000" /></label>
        <button class="primary" :disabled="resourceBusy">{{ resourceBusy ? 'Guardando…' : 'Añadir enlace' }}</button>
      </form>
      </section>
      <HomeSettings />
      <section class="panel public-resource-list">
        <h2>Recursos publicados</h2><p>Estos elementos se muestran en la página pública de Recursos.</p>
        <p v-if="resourcesLoading" role="status">Cargando recursos…</p>
        <template v-else>
          <h3>Exámenes PAU · {{ publicResources.exams.length }}</h3>
          <article v-for="item in publicResources.exams" :key="`exam-${item.id}`" class="public-resource-row">
            <div><b>{{ item.title }}</b><small>{{ item.community }} · {{ item.subject }} · {{ item.exam_year }} · {{ item.exam_part === 'statement' ? 'Enunciado' : 'Soluciones' }}</small><p>{{ item.description || 'Sin descripción.' }}</p></div>
            <a v-if="item.file_url" :href="apiUrl(item.file_url)" target="_blank" rel="noopener noreferrer">Ver PDF ↗</a>
            <button type="button" class="remove-button" :disabled="resourceBusy" :aria-label="`Eliminar ${item.title}`" @click="removePublicResource(item)">×</button>
          </article>
          <p v-if="!publicResources.exams.length" class="resource-empty">Aún no hay exámenes.</p>
          <h3>Formularios PDF · {{ publicResources.forms.length }}</h3>
          <article v-for="item in publicResources.forms" :key="`doc-${item.id}`" class="public-resource-row">
            <div><b>{{ item.title }}</b><small>{{ publicSubjects.find(s => s.value === item.subject)?.label || item.subject }}</small><p>{{ item.description || 'Sin descripción.' }}</p></div>
            <a v-if="item.file_url" :href="apiUrl(item.file_url)" target="_blank" rel="noopener noreferrer">Ver PDF ↗</a>
            <button type="button" class="remove-button" :disabled="resourceBusy" :aria-label="`Eliminar ${item.title}`" @click="removePublicResource(item)">×</button>
          </article>
          <p v-if="!publicResources.forms.length" class="resource-empty">Aún no hay documentos.</p>
          <h3>Instagram · {{ publicResources.videos.length }}</h3>
          <article v-for="item in publicResources.videos" :key="`video-${item.id}`" class="public-resource-row">
            <div><b>{{ item.title }}</b><small>{{ publicSubjects.find(s => s.value === item.subject)?.label || item.subject }}</small><p>{{ item.description || 'Sin descripción.' }}</p></div>
            <a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer">Abrir ↗</a>
            <button type="button" class="remove-button" :disabled="resourceBusy" :aria-label="`Eliminar ${item.title}`" @click="removePublicResource(item)">×</button>
          </article>
          <p v-if="!publicResources.videos.length" class="resource-empty">Aún no hay enlaces de Instagram.</p>
        </template>
      </section>
    </div>
    <MicrosoftIntegration v-show="activeSection === 'settings'" />
    <form v-if="activeSection === 'settings'" class="panel notification-settings-panel" @submit.prevent="saveNotificationSettings">
      <h2>Recordatorios de reservas</h2><p>Los recordatorios se envían automáticamente al correo de cada estudiante con una clase confirmada.</p>

      <label>Antelación del recordatorio<select v-model="reminderPreset" @change="reminderPreset !== 'custom' && (notificationSettings.reminder_interval_minutes = Number(reminderPreset))"><option value="1440">24 horas</option><option value="360">6 horas</option><option value="120">2 horas</option><option value="30">30 minutos</option><option value="custom">Personalizado</option></select></label><label v-if="reminderPreset === 'custom'">Intervalo personalizado (minutos)<input v-model.number="notificationSettings.reminder_interval_minutes" type="number" min="1" max="525600" step="1" required /><small>Entre 1 minuto y 365 días (525600 minutos).</small></label>
      <button class="primary">Guardar configuración</button>
    </form>
    <StudentsView v-if="activeSection === 'students'" embedded />
    <section v-if="activeSection === 'settings'" class="contact-requests-panel">
      <div class="contact-requests-head"><div><h2>Solicitudes desde la portada</h2><p>Mensajes enviados por personas que todavía no tienen cuenta.</p></div><span>{{ contactRequests.length }} {{ contactRequests.length === 1 ? 'solicitud' : 'solicitudes' }}</span></div>
      <div v-if="contactRequests.length" class="contact-requests-list"><article v-for="request in contactRequests" :key="request.id"><div><b>{{ request.name }}</b><small>{{ request.contact }} · {{ request.need }}</small></div><p>{{ request.message || 'Sin mensaje adicional.' }}</p><time>{{ new Date(request.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) }}</time></article></div>
      <p v-else class="contact-requests-empty">No hay solicitudes de contacto nuevas.</p>
    </section>
    </main></div>
  </section>
</template>

<style scoped>
.admin-page { max-width: none; height: auto; margin: 0; padding: 12px 24px; }
.admin-layout { min-width: 0; }
.admin-tabs { height: auto; max-width: 900px; margin: 0 auto 8px; }
.admin-tabs button { min-width: 0; cursor: pointer; white-space: nowrap; }
.admin-content { min-width: 0; padding: 8px 0; }
.admin-page-resources .resource-admin-grid { max-height: none; overflow: visible; align-items: stretch; }
.resource-upload-tabs { margin: 0 auto 20px; }
@media (min-width: 901px) {
  .resource-admin-grid :deep(.home-settings-card) { height: 0; min-height: 100%; overflow-y: auto; }
}
@media (max-width: 900px) {
  .resource-admin-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (min-width: 801px) {
  .admin-page-students :deep(.students-embedded) { margin-top: 0; }
}
@media (max-width: 800px) { .admin-page { padding: 16px; } .admin-content { padding: 16px 0; } .admin-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } .admin-tabs button { padding: 10px 6px; white-space: normal; } }

/* Carpetas y Archivos: layout 30/70 en escritorio, apilado en pantallas estrechas.
   El .admin-page { height:auto } genérico de arriba (pensado para Usuarios/Ajustes,
   que crecen con su contenido) debe quedar anulado aquí para que esta sección vuelva
   a usar el alto fijo de .admin-page de main.css, sin scroll de página. */
@media (min-width: 901px) {
  .admin-page.admin-page-folders { height: calc(100dvh - 82px); overflow: hidden; display: flex; flex-direction: column; }
  .admin-page.admin-page-folders .admin-layout { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  /* .admin-tabs queda como hijo flex de .admin-layout en esta pestaña (no en las otras,
     que usan flujo de bloque normal). Con margin:0 auto, el stretch por defecto del eje
     cruzado queda desactivado por los márgenes auto (spec flexbox §8.1) y el ancho pasa
     a calcularse por contenido (~540px) en vez de llenar hasta max-width:900px como en
     flujo normal, encogiendo la barra y partiendo "Carpetas y Archivos"/"Recursos
     públicos" en dos líneas. width explícito (no "auto") evita ese stretch condicional
     y reproduce el mismo ancho resultante que en las otras 3 pestañas. */
  .admin-page.admin-page-folders .admin-tabs { flex: 0 0 auto; width: min(900px, 100%); }
  .admin-page.admin-page-folders .admin-content { flex: 1; min-height: 0; }
  /* .admin-tab-grid hereda aquí "height:calc(100% - 62px)" de main.css, pensado para
     cuando .admin-tab-grid es hermano directo de .admin-tabs. Aquí .admin-tab-grid está
     un nivel más anidado (dentro de .admin-content, que ya excluye el alto de .admin-tabs
     por el flex de arriba), así que esa resta de 62px sobra: debe ocupar el 100%. */
  .admin-page.admin-page-folders .admin-tab-grid { height: 100%; }
}
.folders-explorer-head { margin: 0; padding: 0 0 14px; border: 0; }
.folders-explorer-head-actions { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.new-folder-button { width: auto; margin: 0; white-space: nowrap; }
.folders-upload-panel { display: flex; flex-direction: column; }
/* t_edd6a519: reducir espaciados verticales de "Subir material" para intentar que quepa
   sin scroll interno propio, sin tocar layout 30/70 ni el popup de carpeta.
   La regla de <p> tenía margin-bottom:10px ADEMÁS del margin-top:10px del siguiente
   label: en flex column los márgenes de hermanos no colapsan, así que sumaban 20px
   en vez de 10px. Se quita ese margin-bottom (el espaciado lo da ya el label) y se
   recorta un poco el margin de cada label para ganar margen de seguridad. */
.folders-upload-panel { padding: 18px 22px; }
.folders-upload-panel h2 { margin: 0 0 4px; }
.folders-upload-panel > p { margin: 0; }
.folders-upload-panel label { margin: 8px 0 4px; }
.folders-upload-panel input, .folders-upload-panel select, .folders-upload-panel textarea { padding: 9px 10px; }
.folders-upload-panel textarea { min-height: 54px; }
.folders-upload-panel .primary { margin-top: 10px; padding: 11px 16px; }
.folders-upload-panel :deep(.material-tags-picker) { gap: 8px; margin: 2px 0; }
.folders-upload-panel :deep(.material-tags-picker label) { margin: 6px 0 4px; }

/* Botones de fila normalizados como en Gestión de usuarios (StudentsView .row-actions) */
.folder-row-actions .edit-button, .folder-row-actions .remove-button { width: auto; height: auto; flex: 0 0 auto; white-space: nowrap; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 7px 10px; }
.folder-row-actions .edit-button { background: #fff0c7; color: #704b00; }
.folder-row-actions .remove-button { background: #f3deda; color: var(--danger); }

/* Popup de crear/editar carpeta, mismo patrón que .new-student-overlay/.new-student-modal de StudentsView */
.folder-modal-overlay { z-index: 80; }
.folder-modal { width: min(520px, 100%); max-height: 90vh; overflow: auto; background: var(--paper); border-radius: 18px; }
.folder-modal header { display: flex; justify-content: space-between; gap: 20px; padding: 22px 24px; border-bottom: 1px solid var(--line); }
.folder-modal header h2 { margin: 0; }
.folder-modal header p { margin: 6px 0 0; }
.folder-modal-form { display: grid; gap: 14px; padding: 24px; }
.folder-modal-form label { display: grid; gap: 5px; }
.folder-modal .folder-parent-options { position: static; margin-top: 7px; }
.folder-modal-form label:has(.folder-parent-trigger[aria-expanded="true"]) > small { visibility: hidden; }
</style>
