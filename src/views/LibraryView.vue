<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MaterialViewer from '../components/MaterialViewer.vue'
import { api, errorMessage, protectedBlobUrl } from '../services/api'
import { session } from '../services/session'
import type { Material } from '../types'

const materials = ref<Material[]>([])
const selected = ref<Material | null>(null)
const error = ref('')
const notice = ref('')
const loading = ref(true)
const editingGrant = ref<number | null>(null)
const editExpiry = ref<Record<number, string>>({})

function formatSize(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function expiry(value?: string) {
  if (session.user?.role === 'admin') return 'Acceso administrador'
  return value ? `Hasta ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))}` : ''
}
async function download(item: Material) {
  const url = await protectedBlobUrl(`/materials/${item.id}/content?download=true`)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = item.filename; anchor.click()
  URL.revokeObjectURL(url)
}
function localDateTime(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
function beginEdit(grantId: number, expiresAt: string) {
  editingGrant.value = grantId
  editExpiry.value[grantId] = localDateTime(expiresAt)
}
async function loadMaterials() {
  const endpoint = session.user?.role === 'admin' ? '/admin/materials' : '/materials'
  materials.value = (await api.get(endpoint)).data
}
async function saveGrant(grantId: number) {
  error.value = ''; notice.value = ''
  try {
    await api.patch(`/admin/grants/${grantId}`, {
      expires_at: new Date(editExpiry.value[grantId]).toISOString(),
    })
    editingGrant.value = null
    notice.value = 'Fecha de acceso actualizada.'
    await loadMaterials()
  } catch (e) { error.value = errorMessage(e) }
}
async function removeGrant(grantId: number, studentName: string) {
  if (!window.confirm(`¿Retirar el acceso de ${studentName} a este archivo?`)) return
  error.value = ''; notice.value = ''
  try {
    await api.delete(`/admin/grants/${grantId}`)
    notice.value = `Acceso de ${studentName} eliminado.`
    await loadMaterials()
  } catch (e) { error.value = errorMessage(e) }
}
onMounted(async () => {
  try { await loadMaterials() }
  catch (e) { error.value = errorMessage(e) }
  finally { loading.value = false }
})
</script>

<template>
  <section class="page">
    <div class="hero">
      <div><p class="eyebrow">TU ESPACIO DE ESTUDIO</p><h1>Mi biblioteca</h1><p>Todo lo que necesitas para dominar la química, a tu ritmo.</p></div>
      <div class="hero-formula">C<sub>6</sub>H<sub>12</sub>O<sub>6</sub></div>
    </div>
    <p v-if="notice" class="success-alert">{{ notice }}</p>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Cargando tu biblioteca…</p>
    <div v-else-if="materials.length" class="material-grid">
      <article v-for="item in materials" :key="item.id" class="material-card">
        <div :class="['material-cover', item.kind]"><span>{{ item.kind === 'video' ? '▶' : 'PDF' }}</span><small>{{ item.kind === 'video' ? 'CLASE EN VÍDEO' : 'APUNTES' }}</small></div>
        <div class="material-info">
          <div class="material-meta"><span>{{ formatSize(item.size_bytes) }}</span><span>{{ expiry(item.expires_at) }}</span></div>
          <h3>{{ item.title }}</h3><p>{{ item.description || 'Material de estudio de la academia.' }}</p>
          <div v-if="session.user?.role === 'admin'" class="sharing">
            <div class="sharing-title">
              <b>Compartido con</b>
              <span>{{ item.grants?.length || 0 }} {{ item.grants?.length === 1 ? 'alumno' : 'alumnos' }}</span>
            </div>
            <div v-if="item.grants?.length" class="share-list">
              <div v-for="grant in item.grants" :key="grant.id" class="share-row">
                <div class="student-avatar">{{ grant.user.name.slice(0, 1).toUpperCase() }}</div>
                <div class="share-person">
                  <b>{{ grant.user.name }}</b>
                  <small>{{ grant.user.email }}</small>
                  <template v-if="editingGrant === grant.id">
                    <input v-model="editExpiry[grant.id]" class="date-editor" type="datetime-local" />
                    <div class="edit-actions">
                      <button class="text-action" @click="saveGrant(grant.id)">Guardar</button>
                      <button class="text-action muted" @click="editingGrant = null">Cancelar</button>
                    </div>
                  </template>
                  <small v-else>Caduca {{ new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(grant.expires_at)) }}</small>
                </div>
                <div class="share-actions">
                  <button class="edit-button" title="Editar caducidad" @click="beginEdit(grant.id, grant.expires_at)">Editar</button>
                  <button class="remove-button" title="Retirar acceso" @click="removeGrant(grant.id, grant.user.name)">×</button>
                </div>
              </div>
            </div>
            <p v-else class="not-shared">Todavía no está compartido con ningún alumno.</p>
          </div>
          <div class="card-actions">
            <button class="primary small" @click="selected = item">Abrir material</button>
            <button v-if="item.can_download" class="secondary small" @click="download(item)">Descargar</button>
          </div>
        </div>
      </article>
    </div>
    <div v-else class="empty"><b>Aún no tienes materiales activos.</b><p>Tu profesora te dará acceso cuando estén preparados.</p></div>
    <MaterialViewer :material="selected" @close="selected = null" />
  </section>
</template>
