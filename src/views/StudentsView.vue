<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '../services/api'
import type { StudentMaterialGrant, User } from '../types'

const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const searchQuery = ref('')
const editingId = ref<number | null>(null)
const draft = ref({ name: '', email: '', password: '', is_active: true })
const selectedStudent = ref<User | null>(null)
const grants = ref<StudentMaterialGrant[]>([])
const grantsLoading = ref(false)
const grantDates = ref<Record<number, string>>({})

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('es')
  if (!query) return users.value
  return users.value.filter((user) => `${user.name} ${user.email} ${user.role}`.toLocaleLowerCase('es').includes(query))
})
async function load() { users.value = (await api.get('/admin/users')).data }
function startEdit(user: User) { editingId.value = user.id; draft.value = { name: user.name, email: user.email, password: '', is_active: user.is_active } }
function cancelEdit() { editingId.value = null }
function localDateTime(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }
async function save(userId: number) {
  error.value = ''; notice.value = ''
  try {
    const payload: Record<string, string | boolean> = { name: draft.value.name, email: draft.value.email, is_active: draft.value.is_active }
    if (draft.value.password) payload.password = draft.value.password
    await api.patch(`/admin/users/${userId}`, payload)
    editingId.value = null; notice.value = 'Alumno actualizado correctamente.'; await load()
  } catch (e) { error.value = errorMessage(e) }
}
async function remove(user: User) {
  if (user.role === 'admin' || !window.confirm(`¿Eliminar a ${user.name}? También se eliminarán sus accesos a materiales.`)) return
  error.value = ''; notice.value = ''
  try { await api.delete(`/admin/users/${user.id}`); notice.value = 'Alumno eliminado.'; await load() }
  catch (e) { error.value = errorMessage(e) }
}
async function openMaterials(user: User) {
  selectedStudent.value = user; grantsLoading.value = true; error.value = ''
  try {
    grants.value = (await api.get(`/admin/users/${user.id}/grants`)).data
    grantDates.value = Object.fromEntries(grants.value.map((grant) => [grant.id, localDateTime(grant.expires_at)]))
  } catch (e) { error.value = errorMessage(e) } finally { grantsLoading.value = false }
}
async function saveGrant(grant: StudentMaterialGrant) {
  try {
    await api.patch(`/admin/grants/${grant.id}`, { expires_at: new Date(grantDates.value[grant.id]).toISOString(), can_download: grant.can_download })
    notice.value = 'Acceso actualizado.'; await openMaterials(selectedStudent.value!)
  } catch (e) { error.value = errorMessage(e) }
}
async function removeGrant(grant: StudentMaterialGrant) {
  if (!window.confirm(`¿Retirar el acceso a “${grant.material.title}”?`)) return
  try { await api.delete(`/admin/grants/${grant.id}`); notice.value = 'Acceso retirado.'; await openMaterials(selectedStudent.value!) }
  catch (e) { error.value = errorMessage(e) }
}
onMounted(async () => { try { await load() } catch (e) { error.value = errorMessage(e) } finally { loading.value = false } })
</script>

<template>
  <section class="page students-page">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Cargando alumnos…</p>
    <div v-else class="students-panel">
      <div class="students-panel-head"><div><h1>Alumnos</h1><p>Gestiona los usuarios registrados y su acceso a la plataforma.</p></div><span>{{ users.length }} {{ users.length === 1 ? 'usuario' : 'usuarios' }}</span></div>
      <div class="students-search"><span>⌕</span><input v-model="searchQuery" placeholder="Buscar por nombre o email…" /></div>
      <div class="students-table-wrap"><table class="students-table"><thead><tr><th>Alumno</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        <template v-for="user in filteredUsers" :key="user.id">
          <tr v-if="editingId !== user.id"><td><b>{{ user.name }}</b><small>{{ user.email }}</small></td><td><span class="role-badge">{{ user.role === 'admin' ? 'Administradora' : 'Alumno' }}</span></td><td><span :class="['status-badge', { inactive: !user.is_active }]">{{ user.is_active ? 'Activo' : 'Inactivo' }}</span></td><td class="row-actions"><button class="materials-button" @click="openMaterials(user)">Materiales</button><button class="edit-button" @click="startEdit(user)">Editar</button><button class="remove-button" :disabled="user.role === 'admin'" title="Eliminar alumno" @click="remove(user)">×</button></td></tr>
          <tr v-else class="student-edit-row"><td colspan="4"><div class="student-edit-form"><label>Nombre<input v-model="draft.name" /></label><label>Email<input v-model="draft.email" type="email" /></label><label>Nueva contraseña <small>(opcional)</small><input v-model="draft.password" type="password" minlength="8" /></label><label class="check"><input v-model="draft.is_active" type="checkbox" /> Cuenta activa</label><div class="edit-actions"><button class="primary small" @click="save(user.id)">Guardar</button><button class="secondary small" @click="cancelEdit">Cancelar</button></div></div></td></tr>
        </template>
        <tr v-if="!filteredUsers.length"><td colspan="4" class="no-users">No se han encontrado alumnos.</td></tr>
      </tbody></table></div>
    </div>
    <div v-if="selectedStudent" class="modal" @click.self="selectedStudent = null">
      <section class="student-materials-modal"><header><div><p class="eyebrow">MATERIALES COMPARTIDOS</p><h2>{{ selectedStudent.name }}</h2><small>{{ selectedStudent.email }}</small></div><button class="icon-button" @click="selectedStudent = null">×</button></header>
        <p v-if="grantsLoading" class="modal-empty">Cargando materiales…</p>
        <div v-else-if="grants.length" class="student-grant-list"><article v-for="grant in grants" :key="grant.id" class="student-grant-row"><div class="grant-file-icon">{{ grant.material.kind === 'video' ? '▶' : 'PDF' }}</div><div class="grant-file-main"><b>{{ grant.material.title }}</b><small>{{ grant.material.filename }}</small></div><label>Caduca<input v-model="grantDates[grant.id]" type="datetime-local" /></label><label class="check"><input v-model="grant.can_download" type="checkbox" /> Descarga</label><button class="primary small" @click="saveGrant(grant)">Guardar</button><button class="remove-button" title="Retirar acceso" @click="removeGrant(grant)">×</button></article></div>
        <p v-else class="modal-empty">Este alumno todavía no tiene materiales compartidos.</p>
      </section>
    </div>
  </section>
</template>
