<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { api, apiUrl, errorMessage } from '../services/api'
import type { Folder, Material, Tag, User } from '../types'
import FolderTreePicker from '../components/FolderTreePicker.vue'
import StudentsView from './StudentsView.vue'

const users = ref<User[]>([])
const materials = ref<Material[]>([])
const folders = ref<Folder[]>([])
const tags = ref<Tag[]>([])
const notice = ref('')
const error = ref('')
const newUser = ref({ name: '', email: '', password: '', role: 'guest' })
const upload = ref({ title: '', description: '', tags: '', file: null as File | null })
const folderSelection = ref('')
const folderForm = ref<{ name: string; parent_id: number | null }>({ name: '', parent_id: null })
const editingFolderId = ref<number | null>(null)
const folderNameInput = ref<HTMLInputElement | null>(null)
const folderSearch = ref('')
const expandedFolderIds = ref<number[]>([])
const activeSection = ref<'students' | 'folders' | 'resources' | 'settings'>('students')
const notificationSettings = ref({ reminder_interval_minutes: 1440 })
type PublicResource = { id: number; title: string; description: string; subject: string; file_url?: string; url?: string; community?: string; exam_year?: number; exam_part?: 'statement' | 'solutions' }
const publicResources = ref<{ exams: PublicResource[]; forms: PublicResource[]; videos: PublicResource[]; documents: PublicResource[] }>({ exams: [], forms: [], videos: [], documents: [] })
const publicExam = ref({ title: '', description: '', subject: 'quimica', community: 'Madrid', exam_year: new Date().getFullYear(), exam_part: 'statement' as 'statement' | 'solutions', file: null as File | null })
const publicDocument = ref({ title: '', description: '', subject: 'quimica', file: null as File | null })
const publicVideo = ref({ title: '', description: '', subject: 'quimica', url: '' })
const publicSubjects = [{ value: 'quimica', label: 'Química' }, { value: 'organica', label: 'Química orgánica' }, { value: 'fisica', label: 'Física' }, { value: 'matematicas', label: 'Matemáticas' }]
const publicCommunities = ['Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria', 'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'C. Valenciana', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco']
const resourcesLoading = ref(false)
const resourceBusy = ref(false)
const reminderPreset = ref('1440')
const studentsRefreshKey = ref(0)
const contactRequests = ref<Array<{ id: number; name: string; contact: string; need: string; message: string; created_at: string }>>([])
const grant = ref({ user_id: 0, material_id: 0, tag_ids: [] as number[], scope: 'material', duration: 'week', expires_at: '', can_download: false })
const guests = computed(() => users.value.filter((u) => u.role !== 'admin'))
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
  const [u, m, f, t, contacts] = await Promise.all([api.get('/admin/users'), api.get('/admin/materials'), api.get('/admin/folders'), api.get('/admin/tags'), api.get('/admin/contact-requests')])
  users.value = u.data; materials.value = m.data; folders.value = f.data; tags.value = t.data
  contactRequests.value = contacts.data
  if (!folderSelection.value || !folders.value.some(folder => String(folder.id) === folderSelection.value)) {
    folderSelection.value = String(folders.value.find(folder => folder.name === 'Sin clasificar' && folder.parent_id === null)?.id || '')
  }
  if (!guests.value.some((user) => user.id === grant.value.user_id)) grant.value.user_id = guests.value[0]?.id || 0
  if (!grant.value.material_id && materials.value[0]) grant.value.material_id = materials.value[0].id
  if (!grant.value.tag_ids.length && tags.value[0]) grant.value.tag_ids = [tags.value[0].id]
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
function createUser() { return act(() => api.post('/admin/users', newUser.value), 'Usuario creado correctamente.').then(() => { studentsRefreshKey.value += 1 }) }
function uploadFile() {
  const file = upload.value.file
  if (!file) return
  return act(async () => {
    if (!folderSelection.value) throw new Error('Selecciona una carpeta')
    const body = new FormData()
    body.append('title', upload.value.title); body.append('description', upload.value.description)
    body.append('folder_id', folderSelection.value); body.append('tags', upload.value.tags); body.append('file', file)
    await api.post('/admin/materials', body)
  }, 'Material subido correctamente.')
}
function grantAccess() {
  const end = new Date()
  if (grant.value.duration === 'week') end.setDate(end.getDate() + 7)
  else if (grant.value.duration === 'month') end.setMonth(end.getMonth() + 1)
  else end.setTime(new Date(grant.value.expires_at).getTime())
  if (grant.value.scope === 'tag') {
    if (!grant.value.tag_ids.length) { error.value = 'Selecciona al menos una etiqueta'; return }
    return act(() => Promise.all(grant.value.tag_ids.map((tag_id) => api.post('/admin/tag-grants', {
      user_id: grant.value.user_id, tag_id, expires_at: end.toISOString(), can_download: grant.value.can_download,
    }))), 'Etiquetas compartidas correctamente.')
  }
  return act(() => api.post('/admin/grants', { user_id: grant.value.user_id, material_id: grant.value.material_id, expires_at: end.toISOString(), can_download: grant.value.can_download }), 'Acceso actualizado.')
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
async function editFolder(folder: Folder) {
  editingFolderId.value = folder.id
  folderForm.value = { name: folder.name, parent_id: folder.parent_id }
  await nextTick()
  folderNameInput.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  folderNameInput.value?.focus({ preventScroll: true })
  folderNameInput.value?.select()
}
function cancelEditFolder() { editingFolderId.value = null; folderForm.value = { name: '', parent_id: null } }
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
function removeFolder(folder: Folder) {
  if (!window.confirm(`¿Eliminar la carpeta “${folder.path}”? Sus subcarpetas también se eliminarán. Los archivos quedarán sin carpeta.`)) return
  return act(() => api.delete(`/admin/folders/${folder.id}`), 'Carpeta eliminada correctamente.')
}
onMounted(() => Promise.all([load(), loadNotificationSettings(), loadPublicResources()]).catch((e) => error.value = errorMessage(e)))
</script>

<template>
  <section :class="['page', 'admin-page', { 'admin-page-students': activeSection === 'students', 'admin-page-folders': activeSection === 'folders', 'admin-page-settings': activeSection === 'settings', 'admin-page-resources': activeSection === 'resources' }]">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <div class="admin-tabs" role="tablist" aria-label="Secciones de administración"><button :class="{ active: activeSection === 'students' }" type="button" role="tab" :aria-selected="activeSection === 'students'" @click="activeSection = 'students'">Gestión de alumnos</button><button :class="{ active: activeSection === 'folders' }" type="button" role="tab" :aria-selected="activeSection === 'folders'" @click="activeSection = 'folders'">Gestión de carpetas</button><button :class="{ active: activeSection === 'resources' }" type="button" role="tab" :aria-selected="activeSection === 'resources'" @click="activeSection = 'resources'">Recursos públicos</button><button :class="{ active: activeSection === 'settings' }" type="button" role="tab" :aria-selected="activeSection === 'settings'" @click="activeSection = 'settings'">Notificaciones</button></div>
    <div class="admin-tab-grid">
      <form v-if="activeSection === 'students'" class="panel" @submit.prevent="createUser"><h2>Crear estudiante</h2><p>También pueden registrarse por sí mismos como invitados.</p><label>Nombre<input v-model="newUser.name" required minlength="2" /></label><label>Email<input v-model="newUser.email" type="email" required /></label><label>Contraseña temporal<input v-model="newUser.password" type="password" required minlength="8" /></label><button class="primary">Crear usuario</button></form>
      <form v-if="activeSection === 'folders'" class="panel" @submit.prevent="uploadFile"><h2>Subir material</h2><p>PDF, MP4, WebM o MOV. Elige una carpeta creada previamente.</p><label>Título<input v-model="upload.title" required /></label><label>Carpeta<select v-model="folderSelection" required><option value="" disabled>Selecciona una carpeta</option><option v-for="folder in folders" :key="folder.id" :value="String(folder.id)">{{ folder.path }}</option></select></label><label>Etiquetas<input v-model="upload.tags" placeholder="Ej. ESO, FORMULACIÓN, EXAMEN" @input="upload.tags = upload.tags.toUpperCase()" /><small>Sepáralas con comas. Se guardan siempre en mayúsculas.</small></label><label>Descripción<textarea v-model="upload.description" rows="3" /></label><label class="file-input">Archivo<input type="file" accept=".pdf,video/*" required @change="upload.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label><button class="primary">Subir material</button></form>
      <form v-if="activeSection === 'students'" class="panel" @submit.prevent="grantAccess"><h2>Compartir con un estudiante</h2><p>Comparte un archivo concreto o todos los materiales que lleven una o varias etiquetas.</p><label>Estudiante<select v-model="grant.user_id" required><option v-for="u in guests" :key="u.id" :value="u.id">{{ u.name }} · {{ u.email }}</option></select></label><label>Compartir<select v-model="grant.scope"><option value="material">Un archivo</option><option value="tag">Una o varias etiquetas</option></select></label><label v-if="grant.scope === 'material'">Material<select v-model="grant.material_id" required><option v-for="m in materials" :key="m.id" :value="m.id">{{ m.title }}</option></select></label><fieldset v-else class="tag-selector"><legend>Etiquetas</legend><p v-if="!tags.length">No hay etiquetas todavía.</p><label v-for="tag in tags" :key="tag.id" class="check"><input v-model="grant.tag_ids" type="checkbox" :value="tag.id" /> {{ tag.name }}</label><small>Incluye los archivos actuales y futuros con cualquiera de las etiquetas seleccionadas.</small></fieldset><label>Duración<select v-model="grant.duration"><option value="week">Una semana</option><option value="month">Un mes</option><option value="custom">Fecha concreta</option></select></label><label v-if="grant.duration === 'custom'">Fin<input v-model="grant.expires_at" type="datetime-local" required /></label><label class="check"><input v-model="grant.can_download" type="checkbox" /> Permitir descarga a este usuario</label><button class="primary">Guardar acceso</button></form>
      <section v-if="activeSection === 'folders'" class="panel folders-admin-panel">
        <h2>{{ editingFolderId ? 'Editar carpeta' : 'Crear carpeta' }}</h2><p>{{ editingFolder ? `Cambia el nombre o la ubicación de «${editingFolder.path}».` : 'Añade una carpeta raíz o una subcarpeta a la biblioteca.' }}</p>
        <form @submit.prevent="saveFolder">
          <label>Nombre<input ref="folderNameInput" v-model="folderForm.name" required placeholder="Ej. Formulación" /></label>
          <label>Dentro de
            <FolderTreePicker :key="editingFolderId ?? 'create'" v-model="folderForm.parent_id" :folders="folders" :excluded-folder-id="editingFolderId" />
            <small>Despliega una carpeta para ver sus subcarpetas.</small>
          </label>
          <div class="folder-form-actions">
            <button class="primary">{{ editingFolderId ? 'Guardar cambios' : 'Crear carpeta' }}</button>
            <button v-if="editingFolderId" type="button" class="secondary" @click="cancelEditFolder">Cancelar</button>
          </div>
        </form>
      </section>
    </div>
    <div v-if="activeSection === 'resources'" class="resource-admin-grid">
      <form class="panel" @submit.prevent="uploadPublicExam">
        <h2>Subir examen PAU</h2><p>El examen aparecerá en la pestaña Recursos, visible antes de iniciar sesión. Máximo 20 MB.</p>
        <label>Título<input v-model="publicExam.title" required maxlength="180" /></label>
        <label>Asignatura<select v-model="publicExam.subject"><option v-for="subject in publicSubjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option></select></label>
        <label>Comunidad<select v-model="publicExam.community" required><option v-for="community in publicCommunities" :key="community" :value="community">{{ community }}</option></select></label><label>Año<input v-model.number="publicExam.exam_year" type="number" min="2000" max="2100" required /></label><label>Tipo<select v-model="publicExam.exam_part"><option value="statement">Enunciado</option><option value="solutions">Soluciones</option></select></label><label>Descripción<textarea v-model="publicExam.description" rows="3" maxlength="5000" /></label>
        <label>Archivo PDF<input type="file" accept="application/pdf,.pdf" required @change="publicExam.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label>
        <button class="primary" :disabled="resourceBusy">{{ resourceBusy ? 'Guardando…' : 'Subir PDF' }}</button>
      </form>
      <form class="panel" @submit.prevent="uploadPublicDocument">
        <h2>Subir formulario PDF</h2><p>Documento público por asignatura.</p>
        <label>Título<input v-model="publicDocument.title" required maxlength="180" /></label>
        <label>Asignatura<select v-model="publicDocument.subject"><option v-for="subject in publicSubjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option></select></label>
        <label>Descripción<textarea v-model="publicDocument.description" rows="3" maxlength="5000" /></label>
        <label>Archivo PDF<input type="file" accept="application/pdf,.pdf" required @change="publicDocument.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label>
        <button class="primary" :disabled="resourceBusy">Subir formulario</button>
      </form>
      <form class="panel" @submit.prevent="addInstagramVideo">
        <h2>Añadir publicación de Instagram</h2><p>No se suben vídeos: pega el enlace permanente de una publicación o reel público.</p>
        <label>Título<input v-model="publicVideo.title" required maxlength="180" /></label>
        <label>Asignatura<select v-model="publicVideo.subject"><option v-for="subject in publicSubjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option></select></label>
        <label>Enlace de Instagram<input v-model="publicVideo.url" type="url" required placeholder="https://www.instagram.com/reel/..." /></label>
        <label>Descripción<textarea v-model="publicVideo.description" rows="3" maxlength="5000" /></label>
        <button class="primary" :disabled="resourceBusy">{{ resourceBusy ? 'Guardando…' : 'Añadir enlace' }}</button>
      </form>
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
    <form v-if="activeSection === 'settings'" class="panel notification-settings-panel" @submit.prevent="saveNotificationSettings">
      <h2>Recordatorios de reservas</h2><p>Los recordatorios se envían automáticamente al correo de cada estudiante con una clase confirmada.</p>

      <label>Antelación del recordatorio<select v-model="reminderPreset" @change="reminderPreset !== 'custom' && (notificationSettings.reminder_interval_minutes = Number(reminderPreset))"><option value="1440">24 horas</option><option value="360">6 horas</option><option value="120">2 horas</option><option value="30">30 minutos</option><option value="custom">Personalizado</option></select></label><label v-if="reminderPreset === 'custom'">Intervalo personalizado (minutos)<input v-model.number="notificationSettings.reminder_interval_minutes" type="number" min="1" max="525600" step="1" required /><small>Entre 1 minuto y 365 días (525600 minutos).</small></label>
      <button class="primary">Guardar configuración</button>
    </form>
    <StudentsView v-if="activeSection === 'students'" embedded :refresh-key="studentsRefreshKey" />
    <section v-if="activeSection === 'settings'" class="contact-requests-panel">
      <div class="contact-requests-head"><div><h2>Solicitudes desde la portada</h2><p>Mensajes enviados por personas que todavía no tienen cuenta.</p></div><span>{{ contactRequests.length }} {{ contactRequests.length === 1 ? 'solicitud' : 'solicitudes' }}</span></div>
      <div v-if="contactRequests.length" class="contact-requests-list"><article v-for="request in contactRequests" :key="request.id"><div><b>{{ request.name }}</b><small>{{ request.contact }} · {{ request.need }}</small></div><p>{{ request.message || 'Sin mensaje adicional.' }}</p><time>{{ new Date(request.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) }}</time></article></div>
      <p v-else class="contact-requests-empty">No hay solicitudes de contacto nuevas.</p>
    </section>
    <section v-if="activeSection === 'folders'" class="folders-explorer-panel">
      <div class="folders-explorer-head"><div><h2>Carpetas</h2><p>Busca, despliega, edita o elimina cualquier carpeta de la biblioteca.</p></div><span>{{ folders.length }} {{ folders.length === 1 ? 'carpeta' : 'carpetas' }}</span></div>
      <label class="folder-search"><span>⌕</span><input v-model="folderSearch" placeholder="Buscar carpeta..." /></label>
      <div class="folder-admin-list">
        <article v-for="row in folderRows" :key="row.folder.id" :style="{ '--folder-level': row.depth }">
          <button v-if="row.hasChildren" class="folder-toggle" type="button" @click="toggleFolder(row.folder.id)">{{ expandedFolderIds.includes(row.folder.id) ? '⌄' : '›' }}</button><span v-else class="folder-toggle-placeholder" aria-hidden="true"></span>
          <span class="folder-color-dot" :style="{ backgroundColor: row.folder.effective_color || 'var(--brand-green)' }"></span><span class="folder-row-name"><b>{{ row.folder.name }}</b><small v-if="folderSearch">{{ row.folder.path }}</small></span>
          <div v-if="!(row.folder.name === 'Sin clasificar' && row.folder.parent_id === null)" class="folder-row-actions"><button class="edit-button" @click="editFolder(row.folder)">Editar</button><button class="remove-button" title="Eliminar carpeta" @click="removeFolder(row.folder)">×</button></div>
        </article>
        <p v-if="!folderRows.length" class="folder-no-results">No se han encontrado carpetas.</p>
      </div>
    </section>
  </section>
</template>
