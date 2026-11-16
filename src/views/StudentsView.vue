<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { api, errorMessage } from '../services/api'
import type { Tag, User } from '../types'
import StudentMaterialsModal from '../components/StudentMaterialsModal.vue'
import { permissionTimeoutToast } from '../services/permissionTimeoutToast'

const props = withDefaults(defineProps<{ embedded?: boolean; refreshKey?: number }>(), { embedded: false, refreshKey: 0 })

const users = ref<User[]>([])
const summaries = ref<Record<number, { tags: Tag[]; file_count: number }>>({})
const visibleSummaries = computed(() => permissionTimeoutToast.value ? {} : summaries.value)
const summaryError = ref('')
let summaryRequest = 0
const loading = ref(true)
const error = ref('')
const notice = ref('')
const searchQuery = ref('')
const selectedRole = ref<User['role']>('guest')
const statusFilter = ref<'active' | 'inactive'>('active')
const editingId = ref<number | null>(null)
const deletingUser = ref<User | null>(null)
const deleteBusy = ref(false)
const deleteError = ref('')
const editError = ref('')
const editBusy = ref(false)
const showPassword = ref(false)
const showEditPassword = ref(false)
const editName = ref<HTMLInputElement | null>(null)
const cancelDeleteButton = ref<HTMLButtonElement | null>(null)
let returnFocus: HTMLElement | null = null
const draft = ref({ name: '', email: '', password: '', is_active: true })
const selectedStudent = ref<User | null>(null)
const createOpen = ref(false)
const createRole = ref<User['role']>('guest')
const creating = ref(false)
const createError = ref('')
const newStudent = ref({ name: '', email: '', password: '', role: 'guest' })
const newStudentButton = ref<HTMLButtonElement | null>(null)
const newStudentName = ref<HTMLInputElement | null>(null)
async function openCreate() { createRole.value = selectedRole.value; showPassword.value = false; createError.value = ''; createOpen.value = true; await nextTick(); newStudentName.value?.focus() }
async function closeCreate() { if (creating.value) return; createOpen.value = false; showPassword.value = false; newStudent.value = { name: '', email: '', password: '', role: 'guest' }; await nextTick(); newStudentButton.value?.focus() }
async function createStudent() {
  creating.value = true; createError.value = ''
  try {
    await api.post('/admin/users', { ...newStudent.value, role: createRole.value })
    createOpen.value = false; newStudent.value = { name: '', email: '', password: '', role: 'guest' }
    notice.value = 'Usuario creado correctamente.'
    try { await load() } catch (e) { error.value = `Usuario creado, pero no se pudo actualizar la tabla: ${errorMessage(e)}` }
    await nextTick(); newStudentButton.value?.focus()
  } catch (e) { createError.value = errorMessage(e) }
  finally { creating.value = false }
}

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('es')
  return users.value.filter(user => user.role === selectedRole.value
    && user.is_active === (statusFilter.value === 'active')
    && `${user.name} ${user.email}`.toLocaleLowerCase('es').includes(query))
})
const page = ref(1)
const pageSize = 10
const rowHeight = 44
const pageCount = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize)))
const pageUsers = computed(() => filteredUsers.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const emptyRows = computed(() => pageSize - Math.max(1, pageUsers.value.length))
watch([searchQuery, selectedRole, statusFilter], () => { page.value = 1 }, { flush: 'sync' })
watch(pageCount, count => { if (page.value > count) page.value = count }, { flush: 'sync' })
async function loadSummary() {
  const request = ++summaryRequest
  summaries.value = {}; summaryError.value = ''
  try {
    const { data } = await api.get('/admin/users/access-summary')
    if (request === summaryRequest) summaries.value = Object.fromEntries(data.map((row: { user_id: number; tags: Tag[]; file_count: number }) => [row.user_id, row]))
  } catch (e) { if (request === summaryRequest) summaryError.value = `No se pudo cargar el resumen de accesos: ${errorMessage(e)}` }
}
async function load() { users.value = (await api.get('/admin/users')).data; await loadSummary() }
function startEdit(user: User, event: Event) { returnFocus = event.currentTarget as HTMLElement; showEditPassword.value = false; editError.value = ''; editingId.value = user.id; draft.value = { name: user.name, email: user.email, password: '', is_active: user.is_active }; void nextTick(() => editName.value?.focus()) }
function cancelEdit() { if (editBusy.value) return; editingId.value = null; showEditPassword.value = false; draft.value.password = ''; void nextTick(() => returnFocus?.focus()) }
function selectRole(role: User['role']) { selectedRole.value = role; cancelEdit() }
function modalKeydown(event: KeyboardEvent, close: () => void) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
  if (event.key !== 'Tab') return
  const focusable = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
  if (!focusable.length) return
  const first = focusable[0]!, last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

async function save(userId: number) {
  editError.value = ''; notice.value = ''
  const user = users.value.find((item) => item.id === userId)
  if (!user || editBusy.value) return
  editBusy.value = true
  try {
    const payload: Record<string, string | boolean> = { name: draft.value.name, email: draft.value.email, is_active: draft.value.is_active }
    if (draft.value.password) payload.password = draft.value.password
    await api.patch(`/admin/users/${userId}`, payload)
    editingId.value = null; draft.value.password = ''; notice.value = 'Usuario actualizado correctamente.'
    try { await load() } catch (e) { error.value = `Usuario actualizado, pero no se pudo actualizar la tabla: ${errorMessage(e)}` }
    await nextTick(); returnFocus?.focus()
  } catch (e) { editError.value = errorMessage(e) } finally { editBusy.value = false }
}
function requestRemove(user: User, event: Event) { if (user.role === 'admin') return; returnFocus = event.currentTarget as HTMLElement; deleteError.value = ''; deletingUser.value = user; void nextTick(() => cancelDeleteButton.value?.focus()) }
function cancelRemove() { if (deleteBusy.value) return; deletingUser.value = null; void nextTick(() => returnFocus?.focus()) }
async function remove() {
  if (!deletingUser.value || deleteBusy.value) return
  deleteBusy.value = true; deleteError.value = ''; notice.value = ''
  try { await api.delete(`/admin/users/${deletingUser.value.id}`); deletingUser.value = null; notice.value = 'Alumno eliminado.'; try { await load() } catch (e) { error.value = `Alumno eliminado, pero no se pudo actualizar la tabla: ${errorMessage(e)}` }; await nextTick(); newStudentButton.value?.focus() }
  catch (e) { deleteError.value = errorMessage(e) } finally { deleteBusy.value = false }
}
function openMaterials(user: User, event: Event) { if (permissionTimeoutToast.value) return; returnFocus = event.currentTarget as HTMLElement; selectedStudent.value = user }
function closeMaterials() { selectedStudent.value = null; void nextTick(() => { if (returnFocus?.isConnected && !(returnFocus as HTMLButtonElement).disabled) returnFocus.focus(); else newStudentButton.value?.focus() }) }
onMounted(async () => { try { await load() } catch (e) { error.value = errorMessage(e) } finally { loading.value = false } })
watch(() => props.refreshKey, () => { void load() })
</script>

<template>
  <section :class="props.embedded ? 'students-embedded' : 'page students-page'">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Cargando alumnos…</p>
    <div v-else class="students-panel">
      <div class="students-panel-head"><div><h1>{{ selectedRole === 'guest' ? 'Alumnos' : 'Administradores' }}</h1><p>Gestiona los usuarios registrados y su acceso a la plataforma.</p></div><div class="role-switch" aria-label="Tipo de usuario"><button type="button" aria-label="Ver alumnos" :aria-pressed="selectedRole === 'guest'" @click="selectRole('guest')">Alumnos</button><button type="button" aria-label="Ver administradores" :aria-pressed="selectedRole === 'admin'" @click="selectRole('admin')">Administradores</button></div><div class="student-head-actions"><span>{{ filteredUsers.length }} {{ filteredUsers.length === 1 ? 'usuario' : 'usuarios' }}</span><button ref="newStudentButton" class="primary small new-student-button" type="button" @click="openCreate">{{ selectedRole === 'guest' ? 'Nuevo alumno' : 'Nuevo administrador' }}</button></div></div>
      <div class="users-toolbar"><div class="students-search"><span>⌕</span><input v-model="searchQuery" aria-label="Buscar por nombre o email" placeholder="Buscar por nombre o email…" /></div><div class="status-filter" role="group" aria-label="Filtrar por estado"><button type="button" class="active-filter" aria-label="Ver activos" :aria-pressed="statusFilter === 'active'" @click="statusFilter = 'active'">Activos</button><button type="button" class="inactive-filter" aria-label="Ver inactivos" :aria-pressed="statusFilter === 'inactive'" @click="statusFilter = 'inactive'">Inactivos</button></div></div>
      <p v-if="summaryError && selectedRole === 'guest'" class="alert" role="alert">{{ summaryError }} <button type="button" class="secondary small" @click="loadSummary">Reintentar</button></p>

      <div class="students-table-wrap"><table class="students-table" :class="selectedRole === 'guest' ? 'student-columns' : 'admin-columns'"><colgroup><col class="name-column" /><col class="email-column" /><col v-if="selectedRole === 'guest'" class="tags-column" /><col v-if="selectedRole === 'guest'" class="files-column" /><col class="actions-column" /></colgroup><thead><tr><th>{{ selectedRole === 'guest' ? 'Alumno' : 'Administrador' }}</th><th>Email</th><th v-if="selectedRole === 'guest'">Etiquetas</th><th v-if="selectedRole === 'guest'">Archivos</th><th>Acciones</th></tr></thead><tbody>
        <template v-for="user in pageUsers" :key="user.id">
          <tr class="user-row"><td class="user-name"><b>{{ user.name }}</b></td><td class="user-email" data-label="Email">{{ user.email }}</td><td v-if="selectedRole === 'guest'" class="user-tags-cell" data-label="Etiquetas"><div v-if="visibleSummaries[user.id]" class="user-tags"><span v-for="tag in visibleSummaries[user.id]!.tags" :key="tag.id">{{ tag.name }}</span></div><span v-else>—</span></td><td v-if="selectedRole === 'guest'" class="user-files-cell" data-label="Archivos"><span class="file-count">{{ visibleSummaries[user.id]?.file_count ?? '—' }}</span></td><td class="user-actions-cell"><div class="row-actions"><button v-if="user.role === 'guest'" class="materials-button" :disabled="!!permissionTimeoutToast" @click="openMaterials(user, $event)">Materiales</button><button class="edit-button" @click="startEdit(user, $event)">Editar</button><button v-if="user.role === 'guest'" class="remove-button" :aria-label="`Eliminar a ${user.name}`" @click="requestRemove(user, $event)">×</button></div></td></tr>
        </template>
        <tr v-if="!filteredUsers.length"><td :colspan="selectedRole === 'guest' ? 5 : 3" class="no-users">No se han encontrado {{ selectedRole === 'guest' ? 'alumnos' : 'administradores' }}.</td></tr>
        <tr v-if="emptyRows" class="table-spacer" aria-hidden="true"><td :colspan="selectedRole === 'guest' ? 5 : 3" :style="{ height: `${emptyRows * rowHeight}px` }"></td></tr>
      </tbody></table></div>
      <nav class="users-pagination" aria-label="Paginación de usuarios"><button type="button" class="secondary small" aria-label="Página anterior" :disabled="page <= 1" @click="page--">Anterior</button><span aria-live="polite">Página {{ page }} de {{ pageCount }}</span><button type="button" class="secondary small" aria-label="Página siguiente" :disabled="page >= pageCount" @click="page++">Siguiente</button></nav>
    </div>
    <div v-if="createOpen" class="modal new-student-overlay" @click.self="closeCreate" @keydown="modalKeydown($event, closeCreate)">
      <section class="new-student-modal" role="dialog" aria-modal="true" aria-labelledby="new-student-title">
        <header><div><h2 id="new-student-title">{{ createRole === 'guest' ? 'Crear estudiante' : 'Crear administrador' }}</h2><p>{{ createRole === 'guest' ? 'También pueden registrarse por sí mismos como invitados.' : 'Tendrá acceso de administración a toda la plataforma.' }}</p></div><button type="button" class="icon-button" :aria-label="createRole === 'guest' ? 'Cerrar alta de alumno' : 'Cerrar alta de administrador'" :disabled="creating" @click="closeCreate">×</button></header>
        <form class="new-student-form" @submit.prevent="createStudent">
          <p v-if="createError" class="alert" role="alert">{{ createError }}</p>
          <label>Nombre<input ref="newStudentName" v-model="newStudent.name" name="student-name" required minlength="2" /></label>
          <label>Email<input v-model="newStudent.email" name="student-email" type="email" required /></label>
          <label>Contraseña temporal<span class="password-field"><input v-model="newStudent.password" name="student-password" :type="showPassword ? 'text' : 'password'" required minlength="8" /><button type="button" class="password-toggle" :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="showPassword" d="M4 4l16 16"/></svg></button></span></label>
          <button class="primary" :disabled="creating">{{ creating ? 'Creando…' : 'Crear usuario' }}</button>
        </form>
      </section>
    </div>
    <div v-if="editingId !== null" class="modal new-student-overlay" @click.self="cancelEdit" @keydown="modalKeydown($event, cancelEdit)"><section class="new-student-modal user-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title"><header><h2 id="edit-user-title">{{ selectedRole === 'guest' ? 'Editar alumno' : 'Editar administrador' }}</h2><button type="button" class="icon-button" aria-label="Cerrar edición" :disabled="editBusy" @click="cancelEdit">×</button></header><form class="new-student-form user-edit-form" @submit.prevent="save(editingId!)"><p v-if="editError" class="alert" role="alert">{{ editError }}</p><label>Nombre<input ref="editName" v-model="draft.name" required minlength="2" /></label><label>Email<input v-model="draft.email" type="email" required /></label><label>Nueva contraseña <small>(opcional)</small><span class="password-field"><input v-model="draft.password" name="edit-password" :type="showEditPassword ? 'text' : 'password'" minlength="8" /><button type="button" class="password-toggle" :aria-label="showEditPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="showEditPassword" @click="showEditPassword = !showEditPassword"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="showEditPassword" d="M4 4l16 16"/></svg></button></span></label><label>Estado<select v-model="draft.is_active" aria-label="Estado de la cuenta"><option :value="true">Activo</option><option :value="false">Inactivo</option></select></label><div class="edit-actions"><button type="button" class="secondary small" :disabled="editBusy" @click="cancelEdit">Cancelar</button><button class="primary small" :disabled="editBusy">Guardar</button></div></form></section></div>
    <div v-if="deletingUser" class="modal new-student-overlay" @click.self="cancelRemove" @keydown="modalKeydown($event, cancelRemove)"><section class="new-student-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title"><header><h2 id="delete-user-title">¿Eliminar a {{ deletingUser.name }}?</h2></header><div class="new-student-form"><p>Se eliminará su cuenta y sus accesos a materiales. Esta acción no se puede deshacer.</p><p v-if="deleteError" class="alert" role="alert">{{ deleteError }}</p><div class="edit-actions"><button ref="cancelDeleteButton" type="button" class="secondary small" data-cancel-delete :disabled="deleteBusy" @click="cancelRemove">Cancelar</button><button type="button" class="danger small" data-confirm-delete :disabled="deleteBusy" @click="remove">Eliminar alumno</button></div></div></section></div>
    <StudentMaterialsModal v-if="selectedStudent" :student="selectedStudent" @changed="loadSummary" @close="closeMaterials" />
  </section>
</template>

<style scoped>
.students-table-wrap { overflow-x: auto; }
.students-table { table-layout: fixed; min-width: 666px; }
.students-table thead th, .students-table tbody td { text-align: center; }
.student-columns .name-column { width: calc(22% - 52.8px); }
.student-columns .email-column { width: calc(48% - 115.2px); }
.student-columns .tags-column { width: calc(17% - 40.8px); }
.student-columns .files-column { width: calc(13% - 31.2px); }
.student-columns .actions-column { width: 240px; }
.admin-columns .name-column { width: calc(33% - 52.8px); }
.admin-columns .email-column { width: calc(67% - 107.2px); }
.admin-columns .actions-column { width: 160px; }
.row-actions { justify-content: center; }
.students-table tbody tr:not(.table-spacer) { height: 44px; }
.students-table td { padding-top: 4px; padding-bottom: 4px; font-size: 14px; overflow-wrap: anywhere; }
.students-table .table-spacer td { padding: 0; border: 0; }
.students-table td small { font-size: 13px; overflow-wrap: anywhere; }
.students-table .user-email { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.users-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 8px 24px; flex-wrap: wrap; }
.users-pagination button:disabled { opacity: .5; cursor: not-allowed; }
.user-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.user-tags span, .file-count { display: inline-block; border-radius: 8px; padding: 4px 8px; background: var(--mint); overflow-wrap: anywhere; }

.student-head-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.students-panel-head { flex-wrap: wrap; gap: 12px; padding: 12px 24px; }
.users-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 8px 24px; }
.users-toolbar .students-search { flex: 1 1 240px; margin: 0; }
.status-filter { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 10px; }
.status-filter button { border: 0; border-radius: 7px; padding: 8px 12px; background: transparent; color: var(--ink); cursor: pointer; }
.status-filter .active-filter[aria-pressed="true"] { background: var(--brand-green); color: white; }
.status-filter .inactive-filter[aria-pressed="true"] { background: #a32f35; color: white; }
.row-actions .materials-button, .row-actions .edit-button, .row-actions .remove-button { width: auto; height: auto; flex: 0 0 auto; white-space: nowrap; border-radius: 8px; background: var(--mint); color: var(--green); font-size: 12px; font-weight: 700; padding: 7px 10px; }
.row-actions .materials-button { background: #dceefa; color: #18547a; }
.row-actions .edit-button { background: #fff0c7; color: #704b00; }
.row-actions .remove-button { background: #f3deda; color: var(--danger); }
.role-switch { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 10px; }
.role-switch button { border: 0; border-radius: 7px; padding: 8px 12px; background: transparent; color: var(--brand-green); }
.role-switch button[aria-pressed="true"] { background: var(--brand-green); color: white; }
.new-student-overlay { z-index: 80; }
.new-student-modal { width: min(520px, 100%); max-height: 90vh; overflow: auto; background: var(--paper); border-radius: 18px; }
.user-edit-modal { width: min(760px, 100%); }
.user-edit-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.user-edit-form .alert, .user-edit-form .edit-actions { grid-column: 1 / -1; }
.user-edit-form label { min-width: 0; }
@media (min-width: 701px) and (max-width: 900px) {
  .students-table th, .students-table td { padding-left: 6px; padding-right: 6px; }
  .row-actions { gap: 4px; }
  .row-actions .materials-button, .row-actions .edit-button, .row-actions .remove-button { padding-left: 8px; padding-right: 8px; }
}
@media (max-width: 700px) {
  .students-table-wrap { overflow-x: visible; background: var(--cream); padding: 12px; }
  .students-table, .students-table tbody, .students-table tbody tr, .students-table tbody td { display: block; width: 100%; }
  .students-table { min-width: 0; }
  .students-table thead { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  .students-table tbody tr.user-row { height: auto; box-sizing: border-box; margin-bottom: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 13px; background: var(--paper); }
  .students-table tbody td { box-sizing: border-box; padding: 4px 0; border: 0; text-align: left; }
  .students-table .user-name { font-size: 15px; color: var(--green); }
  .students-table .user-email { white-space: normal; overflow-wrap: anywhere; overflow: visible; }
  .students-table [data-label]::before { content: attr(data-label) ': '; color: var(--muted); font-weight: 600; }
  .students-table .user-tags-cell { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .user-tags { justify-content: flex-start; }
  .row-actions { justify-content: flex-start; flex-wrap: wrap; }
  .students-table tbody tr.table-spacer { display: none; }
}
@media (max-width: 600px) { .user-edit-form { grid-template-columns: minmax(0, 1fr); } }
.new-student-modal header { display: flex; justify-content: space-between; gap: 20px; padding: 22px 24px; border-bottom: 1px solid var(--line); }
.new-student-modal header h2 { margin: 0; }
.new-student-modal header p { margin: 6px 0 0; }
.new-student-form { display: grid; gap: 14px; padding: 24px; }
.new-student-form label { display: grid; gap: 5px; }
.edit-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.password-field { display: flex; align-items: center; position: relative; }
.password-field input { width: 100%; padding-right: 44px; }
.password-toggle { position: absolute; right: 8px; display: grid; place-items: center; border: 0; background: transparent; color: var(--green); padding: 5px; cursor: pointer; }
</style>
