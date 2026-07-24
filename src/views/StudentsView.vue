<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, errorMessage } from '../services/api'
import type { User } from '../types'

const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const editingId = ref<number | null>(null)
const draft = ref({ name: '', email: '', password: '', is_active: true })

async function load() { users.value = (await api.get('/admin/users')).data }
function startEdit(user: User) { editingId.value = user.id; draft.value = { name: user.name, email: user.email, password: '', is_active: user.is_active } }
function cancelEdit() { editingId.value = null }
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
onMounted(async () => { try { await load() } catch (e) { error.value = errorMessage(e) } finally { loading.value = false } })
</script>

<template>
  <section class="page students-page">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Cargando alumnos…</p>
    <div v-else class="students-panel">
      <div class="students-panel-head"><div><h1>Alumnos</h1><p>Gestiona los usuarios registrados y su acceso a la plataforma.</p></div><span>{{ users.length }} {{ users.length === 1 ? 'usuario' : 'usuarios' }}</span></div>
      <div class="students-table-wrap"><table class="students-table"><thead><tr><th>Alumno</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        <template v-for="user in users" :key="user.id">
          <tr v-if="editingId !== user.id"><td><b>{{ user.name }}</b><small>{{ user.email }}</small></td><td><span class="role-badge">{{ user.role === 'admin' ? 'Administradora' : 'Alumno' }}</span></td><td><span :class="['status-badge', { inactive: !user.is_active }]">{{ user.is_active ? 'Activo' : 'Inactivo' }}</span></td><td class="row-actions"><button class="edit-button" @click="startEdit(user)">Editar</button><button class="remove-button" :disabled="user.role === 'admin'" title="Eliminar alumno" @click="remove(user)">×</button></td></tr>
          <tr v-else class="student-edit-row"><td colspan="4"><div class="student-edit-form"><label>Nombre<input v-model="draft.name" /></label><label>Email<input v-model="draft.email" type="email" /></label><label>Nueva contraseña <small>(opcional)</small><input v-model="draft.password" type="password" minlength="8" /></label><label class="check"><input v-model="draft.is_active" type="checkbox" /> Cuenta activa</label><div class="edit-actions"><button class="primary small" @click="save(user.id)">Guardar</button><button class="secondary small" @click="cancelEdit">Cancelar</button></div></div></td></tr>
        </template>
      </tbody></table></div>
    </div>
  </section>
</template>
