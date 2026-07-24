<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '../services/api'
import type { Folder, Material, User } from '../types'

const users = ref<User[]>([])
const materials = ref<Material[]>([])
const folders = ref<Folder[]>([])
const notice = ref(''); const error = ref('')
const newUser = ref({ name: '', email: '', password: '', role: 'guest' })
const upload = ref({ title: '', description: '', file: null as File | null })
const folderSelection = ref('')
const newFolder = ref({ name: '', parent_id: '' })
const grant = ref({ user_id: 0, material_id: 0, duration: 'week', expires_at: '', can_download: false })
const guests = computed(() => users.value.filter((u) => u.role !== 'admin'))
const creatingFolder = computed(() => folderSelection.value === '__new__')

async function load() {
  const [u, m, f] = await Promise.all([api.get('/admin/users'), api.get('/admin/materials'), api.get('/admin/folders')])
  users.value = u.data; materials.value = m.data; folders.value = f.data
  if (!folderSelection.value) {
    const defaultFolder = folders.value.find((folder) => folder.name === 'Sin clasificar' && folder.parent_id === null)
    if (defaultFolder) folderSelection.value = String(defaultFolder.id)
  }
  if (!grant.value.user_id && guests.value[0]) grant.value.user_id = guests.value[0].id
  if (!grant.value.material_id && materials.value[0]) grant.value.material_id = materials.value[0].id
}
async function act(task: () => Promise<unknown>, message: string) {
  error.value = ''; notice.value = ''
  try { await task(); notice.value = message; await load() }
  catch (e) { error.value = errorMessage(e) }
}
function createUser() { return act(() => api.post('/admin/users', newUser.value), 'Usuario creado correctamente.') }
function uploadFile() {
  const file = upload.value.file
  if (!file) return
  return act(async () => {
    let folderId = folderSelection.value
    if (creatingFolder.value) {
      const { data } = await api.post('/admin/folders', {
        name: newFolder.value.name,
        parent_id: newFolder.value.parent_id ? Number(newFolder.value.parent_id) : null,
      })
      folderId = String(data.id)
    }
    if (!folderId) throw new Error('Selecciona o crea una carpeta')
    const body = new FormData()
    body.append('title', upload.value.title); body.append('description', upload.value.description)
    body.append('folder_id', folderId); body.append('file', file)
    await api.post('/admin/materials', body)
    folderSelection.value = folderId
    newFolder.value = { name: '', parent_id: '' }
  }, 'Material subido correctamente.')
}
function grantAccess() {
  const end = new Date()
  if (grant.value.duration === 'week') end.setDate(end.getDate() + 7)
  else if (grant.value.duration === 'month') end.setMonth(end.getMonth() + 1)
  else end.setTime(new Date(grant.value.expires_at).getTime())
  return act(() => api.post('/admin/grants', { user_id: grant.value.user_id, material_id: grant.value.material_id,
    expires_at: end.toISOString(), can_download: grant.value.can_download }), 'Acceso actualizado.')
}
onMounted(() => load().catch((e) => error.value = errorMessage(e)))
</script>

<template>
  <section class="page admin-page">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <div class="admin-grid">
      <form class="panel" @submit.prevent="createUser">
        <h2>Crear estudiante</h2><p>También pueden registrarse por sí mismos como invitados.</p>
        <label>Nombre<input v-model="newUser.name" required minlength="2" /></label>
        <label>Email<input v-model="newUser.email" type="email" required /></label>
        <label>Contraseña temporal<input v-model="newUser.password" type="password" required minlength="8" /></label>
        <button class="primary">Crear usuario</button>
      </form>
      <form class="panel" @submit.prevent="uploadFile">
        <h2>Subir material</h2><p>PDF, MP4, WebM o MOV. Subirlo no lo comparte automáticamente: después completa el paso 03.</p>
        <label>Título<input v-model="upload.title" required /></label>
        <label>Carpeta<select v-model="folderSelection" required><option v-for="folder in folders" :key="folder.id" :value="String(folder.id)">{{ folder.path }}</option><option value="__new__">+ Crear nueva carpeta…</option></select></label>
        <template v-if="creatingFolder">
          <label>Nombre de la carpeta<input v-model="newFolder.name" required placeholder="Ej. Formulación" /></label>
          <label>Dentro de<select v-model="newFolder.parent_id"><option value="">Carpeta raíz</option><option v-for="folder in folders" :key="folder.id" :value="String(folder.id)">{{ folder.path }}</option></select></label>
        </template>
        <label>Descripción<textarea v-model="upload.description" rows="3" /></label>
        <label class="file-input">Archivo<input type="file" accept=".pdf,video/*" required @change="upload.file = ($event.target as HTMLInputElement).files?.[0] || null" /></label>
        <button class="primary">Subir material</button>
      </form>
      <form class="panel" @submit.prevent="grantAccess">
        <h2>Compartir con un estudiante</h2><p>Selecciona usuario, material y duración; después pulsa «Guardar acceso».</p>
        <label>Estudiante<select v-model="grant.user_id" required><option v-for="u in guests" :key="u.id" :value="u.id">{{ u.name }} · {{ u.email }}</option></select></label>
        <label>Material<select v-model="grant.material_id" required><option v-for="m in materials" :key="m.id" :value="m.id">{{ m.title }}</option></select></label>
        <label>Duración<select v-model="grant.duration"><option value="week">Una semana</option><option value="month">Un mes</option><option value="custom">Fecha concreta</option></select></label>
        <label v-if="grant.duration === 'custom'">Fin<input v-model="grant.expires_at" type="datetime-local" required /></label>
        <label class="check"><input v-model="grant.can_download" type="checkbox" /> Permitir descarga a este usuario</label>
        <button class="primary">Guardar acceso</button>
      </form>
    </div>
  </section>
</template>
