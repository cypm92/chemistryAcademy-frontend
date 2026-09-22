<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '../services/api'
import type { Folder, Material, Tag, User } from '../types'
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
const folderForm = ref({ name: '', parent_id: '' })
const editingFolderId = ref<number | null>(null)
const folderSearch = ref('')
const expandedFolderIds = ref<number[]>([])
const activeSection = ref<'students' | 'folders'>('students')
const studentsRefreshKey = ref(0)
const contactRequests = ref<Array<{ id: number; name: string; contact: string; need: string; message: string; created_at: string }>>([])
const grant = ref({ user_id: 0, material_id: 0, tag_ids: [] as number[], scope: 'material', duration: 'week', expires_at: '', can_download: false })
const guests = computed(() => users.value.filter((u) => u.role !== 'admin'))
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

async function load() {
  const [u, m, f, t, contacts] = await Promise.all([api.get('/admin/users'), api.get('/admin/materials'), api.get('/admin/folders'), api.get('/admin/tags'), api.get('/admin/contact-requests')])
  users.value = u.data; materials.value = m.data; folders.value = f.data; tags.value = t.data
  contactRequests.value = contacts.data
  if (!folderSelection.value || !folders.value.some(folder => String(folder.id) === folderSelection.value)) {
    folderSelection.value = String(folders.value.find(folder => folder.name === 'Sin clasificar' && folder.parent_id === null)?.id || '')
  }
  if (!grant.value.user_id && guests.value[0]) grant.value.user_id = guests.value[0].id
  if (!grant.value.material_id && materials.value[0]) grant.value.material_id = materials.value[0].id
  if (!grant.value.tag_ids.length && tags.value[0]) grant.value.tag_ids = [tags.value[0].id]
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
function saveFolder() {
  const editing = editingFolderId.value
  const currentColor = editing ? folders.value.find(folder => folder.id === editing)?.color || null : null
  const payload = { name: folderForm.value.name, parent_id: folderForm.value.parent_id ? Number(folderForm.value.parent_id) : null, color: currentColor }
  return act(() => editing ? api.patch(`/admin/folders/${editing}`, payload) : api.post('/admin/folders', payload), editing ? 'Carpeta actualizada correctamente.' : 'Carpeta creada correctamente.').then(() => cancelEditFolder())
}
function editFolder(folder: Folder) { editingFolderId.value = folder.id; folderForm.value = { name: folder.name, parent_id: folder.parent_id ? String(folder.parent_id) : '' } }
function cancelEditFolder() { editingFolderId.value = null; folderForm.value = { name: '', parent_id: '' } }
function toggleFolder(folderId: number) {
  expandedFolderIds.value = expandedFolderIds.value.includes(folderId)
    ? expandedFolderIds.value.filter((id) => id !== folderId)
    : [...expandedFolderIds.value, folderId]
}
function removeFolder(folder: Folder) {
  if (!window.confirm(`¿Eliminar la carpeta “${folder.path}”? Sus subcarpetas también se eliminarán. Los archivos quedarán sin carpeta.`)) return
  return act(() => api.delete(`/admin/folders/${folder.id}`), 'Carpeta eliminada correctamente.')
}
onMounted(() => load().catch((e) => error.value = errorMessage(e)))
</script>

<template>
  <section :class="['page', 'admin-page', { 'admin-page-students': activeSection === 'students', 'admin-page-folders': activeSection === 'folders' }]">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <div class="admin-tabs" role="tablist" aria-label="Secciones de administración"><button :class="{ active: activeSection === 'students' }" type="button" role="tab" :aria-selected="activeSection === 'students'" @click="activeSection = 'students'">Gestión de alumnos</button><button :class="{ active: activeSection === 'folders' }" type="button" role="tab" :aria-selected="activeSection === 'folders'" @click="activeSection = 'folders'">Gestión de carpetas</button></div>
    <div class="admin-tab-grid">
      <form v-if="activeSection === 'students'" class="panel" @submit.prevent="createUser"><h2>Crear estudiante</h2><p>También pueden registrarse por sí mismos como invitados.</p><label>Nombre<input v-model="newUser.name" required minlength="2" /></label><label>Email<input v-model="newUser.email" type="email" required /></label><label>Contraseña temporal<input v-model="newUser.password" type="password" required minlength="8" /></label><button class="primary">Crear usuario</button></form>
      <form v-if="activeSection === 'folders'" class="panel" @submit.prevent="uploadFile"><h2>Subir material</h2><p>PDF, MP4, WebM o MOV. Elige una carpeta creada previamente.</p><label>Título<input v-model="upload.title" required /></label><label>Carpeta<select v-model="folderSelection" required><option value="" disabled>Selecciona una carpeta</option><option v-for="folder in folders" :key="folder.id" :value="String(folder.id)">{{ folder.path }}</option></select></label><label>Etiquetas<input v-model="upload.tags" placeholder="Ej. ESO, FORMULACIÓN, EXAMEN" @input="upload.tags = upload.tags.toUpperCase()" /><small>Sepáralas con comas. Se guardan siempre en mayúsculas.</small></label><label>Descripción<textarea v-model="upload.description" rows="3" /></label><label class="file-input">Archivo<input type="file" accept=".pdf,video/*" required @change="upload.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label><button class="primary">Subir material</button></form>
      <form v-if="activeSection === 'students'" class="panel" @submit.prevent="grantAccess"><h2>Compartir con un estudiante</h2><p>Comparte un archivo concreto o todos los materiales que lleven una o varias etiquetas.</p><label>Estudiante<select v-model="grant.user_id" required><option v-for="u in guests" :key="u.id" :value="u.id">{{ u.name }} · {{ u.email }}</option></select></label><label>Compartir<select v-model="grant.scope"><option value="material">Un archivo</option><option value="tag">Una o varias etiquetas</option></select></label><label v-if="grant.scope === 'material'">Material<select v-model="grant.material_id" required><option v-for="m in materials" :key="m.id" :value="m.id">{{ m.title }}</option></select></label><fieldset v-else class="tag-selector"><legend>Etiquetas</legend><p v-if="!tags.length">No hay etiquetas todavía.</p><label v-for="tag in tags" :key="tag.id" class="check"><input v-model="grant.tag_ids" type="checkbox" :value="tag.id" /> {{ tag.name }}</label><small>Incluye los archivos actuales y futuros con cualquiera de las etiquetas seleccionadas.</small></fieldset><label>Duración<select v-model="grant.duration"><option value="week">Una semana</option><option value="month">Un mes</option><option value="custom">Fecha concreta</option></select></label><label v-if="grant.duration === 'custom'">Fin<input v-model="grant.expires_at" type="datetime-local" required /></label><label class="check"><input v-model="grant.can_download" type="checkbox" /> Permitir descarga a este usuario</label><button class="primary">Guardar acceso</button></form>
      <section v-if="activeSection === 'folders'" class="panel folders-admin-panel">
        <h2>Crear carpeta</h2><p>Añade una carpeta raíz o una subcarpeta a la biblioteca.</p>
        <form @submit.prevent="saveFolder"><label>Nombre<input v-model="folderForm.name" required placeholder="Ej. Formulación" /></label><label>Dentro de<select v-model="folderForm.parent_id"><option value="">Carpeta raíz</option><option v-for="folder in folders.filter(item => item.id !== editingFolderId)" :key="folder.id" :value="String(folder.id)">{{ folder.path }}</option></select></label><div class="folder-form-actions"><button class="primary">{{ editingFolderId ? 'Guardar cambios' : 'Crear carpeta' }}</button><button v-if="editingFolderId" type="button" class="secondary" @click="cancelEditFolder">Cancelar</button></div></form>
      </section>
    </div>
    <StudentsView v-if="activeSection === 'students'" embedded :refresh-key="studentsRefreshKey" />
    <section v-if="activeSection === 'students'" class="contact-requests-panel">
      <div class="contact-requests-head"><div><p class="eyebrow">NUEVOS CONTACTOS</p><h2>Solicitudes desde la portada</h2><p>Mensajes enviados por personas que todavía no tienen cuenta.</p></div><span>{{ contactRequests.length }}</span></div>
      <div v-if="contactRequests.length" class="contact-requests-list"><article v-for="request in contactRequests" :key="request.id"><div><b>{{ request.name }}</b><small>{{ request.contact }} · {{ request.need }}</small></div><p>{{ request.message || 'Sin mensaje adicional.' }}</p><time>{{ new Date(request.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) }}</time></article></div>
      <p v-else class="contact-requests-empty">No hay solicitudes de contacto nuevas.</p>
    </section>
    <section v-if="activeSection === 'folders'" class="folders-explorer-panel">
      <div class="folders-explorer-head"><div><h2>Carpetas</h2><p>Busca, despliega, edita o elimina cualquier carpeta de la biblioteca.</p></div><span>{{ folders.length }} {{ folders.length === 1 ? 'carpeta' : 'carpetas' }}</span></div>
      <label class="folder-search"><span>⌕</span><input v-model="folderSearch" placeholder="Buscar carpeta..." /></label>
      <div class="folder-admin-list">
        <article v-for="row in folderRows" :key="row.folder.id" :style="{ '--folder-level': row.depth }">
          <button v-if="row.hasChildren" class="folder-toggle" type="button" @click="toggleFolder(row.folder.id)">{{ expandedFolderIds.includes(row.folder.id) ? '⌄' : '›' }}</button><span v-else class="folder-toggle empty">·</span>
          <span class="folder-color-dot" :style="{ backgroundColor: row.folder.effective_color || 'var(--brand-green)' }"></span><span class="folder-row-name"><b>{{ row.folder.name }}</b><small v-if="folderSearch">{{ row.folder.path }}</small></span>
          <div v-if="!(row.folder.name === 'Sin clasificar' && row.folder.parent_id === null)" class="folder-row-actions"><button class="edit-button" @click="editFolder(row.folder)">Editar</button><button class="remove-button" title="Eliminar carpeta" @click="removeFolder(row.folder)">×</button></div>
        </article>
        <p v-if="!folderRows.length" class="folder-no-results">No se han encontrado carpetas.</p>
      </div>
    </section>
  </section>
</template>
