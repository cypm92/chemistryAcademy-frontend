<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import axios from 'axios'
import { api, errorMessage } from '../services/api'
import { permissionMutationPending, permissionTimeoutToast } from '../services/permissionTimeoutToast'
import type { Material, StudentMaterialAccess, Tag, User } from '../types'

const props = defineProps<{ student: User }>()
const requestTimeout = { timeout: 30000 }
function isRequestTimeout(e: unknown) { return axios.isAxiosError(e) && (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || e.code === 'ERR_NETWORK' || [502, 503, 504].includes(e.response?.status ?? 0)) }
class PartialGrantError extends Error {}
const emit = defineEmits<{ close: []; changed: [] }>()
const rows = ref<StudentMaterialAccess[]>([])
type StudentTagGrant = { id: number; tag: Tag; starts_at: string; expires_at: string; can_download: boolean }
const tagGrants = ref<StudentTagGrant[]>([])
const materials = ref<Material[]>([])
const tags = ref<Tag[]>([])
const loading = ref(true)
let initialLoadCompleted = false
const accessLoadFailed = ref(false)
const busy = ref(false)
function closeDialog() { if (!busy.value) emit('close') }
const error = ref('')
const notice = ref('')
const selectionWarning = ref('')
const closeButton = ref<HTMLButtonElement | null>(null)
const dates = ref<Record<number, string>>({})
const directDownloadDrafts = ref<Record<number, boolean>>({})
const tagDates = ref<Record<number, string>>({})
const tagDownloadDrafts = ref<Record<number, boolean>>({})
const form = ref({ scope: 'material', material_id: 0, tag_ids: [] as number[], duration: 'week', expires_at: '', can_download: false })
const materialSearch = ref('')
const materialPickerOpen = ref(false)
const materialPickerButton = ref<HTMLButtonElement | null>(null)
const materialSearchInput = ref<HTMLInputElement | null>(null)
const selectedMaterial = computed(() => materials.value.find(material => material.id === form.value.material_id))
const filteredMaterials = computed(() => materials.value.filter(material => material.title.toLocaleLowerCase('es').includes(materialSearch.value.trim().toLocaleLowerCase('es'))))
function materialLabel(material: Material) { return `${material.title} (${material.kind === 'video' ? 'VIDEO' : 'PDF'})` }
function toggleMaterials() { materialPickerOpen.value = !materialPickerOpen.value; if (materialPickerOpen.value) void nextTick(() => materialSearchInput.value?.focus()) }
function closeMaterials() { materialPickerOpen.value = false; void nextTick(() => materialPickerButton.value?.focus()) }
function chooseMaterial(material: Material) { form.value.material_id = material.id; materialSearch.value = ''; closeMaterials() }
function keepModalFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  if (busy.value) { event.preventDefault(); closeButton.value?.focus(); return }
  const focusable = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])')].filter(element => {
    if (element.closest('[hidden], [inert]')) return false
    let parent = element.parentElement
    while (parent) {
      if (parent instanceof HTMLDetailsElement && !parent.open && !(element.tagName === 'SUMMARY' && element.parentElement === parent)) return false
      parent = parent.parentElement
    }
    return true
  })
  if (!focusable.length) { event.preventDefault(); return }
  const first = focusable[0]!, last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function openCalendar(event: Event) {
  const input = (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLInputElement>('input')
  if (!input) return
  try { if (typeof input.showPicker === 'function') input.showPicker(); else input.focus() } catch { input.focus() }
}
function calendarKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab' || event.key === 'Escape') return
  event.preventDefault()
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
    const input = event.currentTarget as HTMLInputElement
    try { input.showPicker?.() } catch { input.focus() }
  }
}
const directRows = computed(() => rows.value.filter(row => row.direct))
const tagGroups = computed(() => {
  const groups = new Map(tagGrants.value.map(grant => [grant.tag.id, { tag: grant.tag, grant, materials: [] as StudentMaterialAccess[] }]))
  for (const row of rows.value) for (const tag of row.tags) {
    groups.get(tag.id)?.materials.push(row)
  }
  return [...groups.values()].sort((a, b) => a.tag.name.localeCompare(b.tag.name, 'es'))
})
function localDateTime(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }
function directLabel(row: StudentMaterialAccess) {
  if (!row.direct) return ''
  if (new Date(row.direct.expires_at).getTime() <= Date.now()) return 'Directo caducado'
  if (new Date(row.direct.starts_at).getTime() > Date.now()) return 'Directo pendiente'
  return 'Directo'
}
async function loadRows(isCurrent: () => boolean = () => true) {
  try {
    const [materialResponse, tagResponse] = await Promise.all([api.get(`/admin/users/${props.student.id}/material-access`, requestTimeout), api.get(`/admin/users/${props.student.id}/tag-grants`, requestTimeout)])
    if (!isCurrent()) return
    const nextRows: StudentMaterialAccess[] = materialResponse.data
    const nextTags: StudentTagGrant[] = tagResponse.data
    dates.value = Object.fromEntries(nextRows.filter(row => row.direct).map(row => [row.direct!.id, localDateTime(row.direct!.expires_at)]))
    directDownloadDrafts.value = Object.fromEntries(nextRows.filter(row => row.direct).map(row => [row.direct!.id, row.direct!.can_download]))
    tagDates.value = Object.fromEntries(nextTags.map(grant => [grant.id, localDateTime(grant.expires_at)]))
    tagDownloadDrafts.value = Object.fromEntries(nextTags.map(grant => [grant.id, grant.can_download]))
    rows.value = nextRows; tagGrants.value = nextTags; accessLoadFailed.value = false
  } catch (e) { if (isCurrent()) { rows.value = []; tagGrants.value = []; accessLoadFailed.value = true }; throw e }
}
async function load() {
  closeButton.value?.focus()
  loading.value = true; error.value = ''
  let current = true
  try {
    const [, materialResponse, tagResponse] = await Promise.all([loadRows(() => current), api.get('/admin/materials', requestTimeout), api.get('/admin/tags', requestTimeout)])
    const removedTags = tags.value.filter(tag => form.value.tag_ids.includes(tag.id) && !tagResponse.data.some((current: Tag) => current.id === tag.id))
    materials.value = materialResponse.data; tags.value = tagResponse.data
    if (removedTags.length === 1) selectionWarning.value = `Se descartó la etiqueta ${removedTags[0]!.name} porque ya no está disponible.`
    else if (removedTags.length > 1) selectionWarning.value = `Se descartaron las etiquetas ${removedTags.map(tag => tag.name).join(', ')} porque ya no están disponibles.`
    else selectionWarning.value = ''
    form.value.tag_ids = form.value.tag_ids.filter(id => tags.value.some(tag => tag.id === id))
    if (!initialLoadCompleted) form.value.material_id = materials.value[0]?.id || 0
    else if (form.value.material_id && !materials.value.some(material => material.id === form.value.material_id)) form.value.material_id = 0
    initialLoadCompleted = true
  } catch (e) { current = false; rows.value = []; tagGrants.value = []; accessLoadFailed.value = true; error.value = isRequestTimeout(e) ? 'No se pudieron cargar los accesos.' : `No se pudieron cargar los accesos: ${errorMessage(e)}` } finally { loading.value = false }
}
async function run(action: () => Promise<unknown>, message: string, restoreDraft?: () => void) {
  if (busy.value || permissionMutationPending.value) return
  closeButton.value?.focus()
  let failure: string | undefined
  let actionConfirmed = false
  busy.value = true; permissionMutationPending.value = true; error.value = ''; notice.value = ''; selectionWarning.value = ''
  try { await action(); actionConfirmed = true; notice.value = message; emit('changed'); closeButton.value?.focus(); loading.value = true; await loadRows() }
  catch (e) { closeButton.value?.focus(); failure = e instanceof PartialGrantError ? e.message : errorMessage(e); if (actionConfirmed) failure = isRequestTimeout(e) ? 'No se pudieron recargar los accesos.' : `No se pudieron recargar los accesos: ${failure}`; else if (isRequestTimeout(e)) { failure = 'Internal error, please reload the page'; permissionTimeoutToast.value = failure; rows.value = []; tagGrants.value = []; accessLoadFailed.value = true } else restoreDraft?.(); error.value = failure } finally { busy.value = false; permissionMutationPending.value = false; loading.value = false }
}
async function addAccess() {
  notice.value = ''
  if (form.value.scope === 'material' && !form.value.material_id) { error.value = 'Selecciona un material.'; return }
  if (form.value.scope === 'tag' && !form.value.tag_ids.length) { error.value = 'Selecciona al menos una etiqueta.'; return }
  const end = new Date()
  if (form.value.duration === 'week') end.setDate(end.getDate() + 7)
  else if (form.value.duration === 'month') end.setMonth(end.getMonth() + 1)
  else end.setTime(new Date(form.value.expires_at).getTime())
  if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) { error.value = 'Selecciona una fecha futura.'; return }
  const common = { user_id: props.student.id, expires_at: end.toISOString(), can_download: form.value.can_download }
  await run(async () => {
    if (form.value.scope === 'material') { await api.post('/admin/grants', { ...common, material_id: form.value.material_id }, requestTimeout); form.value.material_id = 0 }
    else {
      let completed = 0
      try { for (const tag_id of form.value.tag_ids) { await api.post('/admin/tag-grants', { ...common, tag_id }, requestTimeout); completed++ }; form.value.tag_ids = [] }
      catch (e) {
        if (isRequestTimeout(e)) {
          if (completed) {
            const granted = form.value.tag_ids.slice(0, completed)
            const grantedNames = granted.map(id => tags.value.find(tag => tag.id === id)?.name || String(id)).join(', ')
            form.value.tag_ids = form.value.tag_ids.filter(id => !granted.includes(id))
            notice.value = `Se concedieron ${completed} etiquetas (${grantedNames}) antes del fallo.`
            emit('changed')
          }
          throw e
        }
        if (completed) {
          const granted = form.value.tag_ids.slice(0, completed)
          const grantedNames = granted.map(id => tags.value.find(tag => tag.id === id)?.name || String(id)).join(', ')
          form.value.tag_ids = form.value.tag_ids.filter(id => !granted.includes(id))
          emit('changed')
          loading.value = true
          try { await loadRows() } catch (reloadError) { notice.value = `Se concedieron ${completed} etiquetas (${grantedNames}).`; throw new PartialGrantError(`${errorMessage(e)}. No se pudieron recargar los accesos: ${errorMessage(reloadError)}`) }
          throw new PartialGrantError(`Se concedieron ${completed} etiquetas (${grantedNames}). ${errorMessage(e)}`)
        }
        throw e
      }
    }
  }, 'Acceso compartido correctamente.')
}
async function saveDirect(row: StudentMaterialAccess) {
  notice.value = ''
  if (!row.direct) return
  const direct = row.direct
  const date = new Date(dates.value[direct.id])
  if (Number.isNaN(date.getTime())) { directDownloadDrafts.value[direct.id] = direct.can_download; error.value = 'Selecciona una fecha válida.'; return }
  await run(() => api.patch(`/admin/grants/${direct.id}`, { expires_at: date.toISOString(), can_download: directDownloadDrafts.value[direct.id] }, requestTimeout), 'Acceso directo actualizado.', () => { dates.value[direct.id] = localDateTime(direct.expires_at); directDownloadDrafts.value[direct.id] = direct.can_download })
}
async function removeDirect(row: StudentMaterialAccess) {
  if (!row.direct || !window.confirm(`¿Retirar el acceso directo a «${row.material.title}»? Puede conservar acceso por etiquetas.`)) return
  await run(() => api.delete(`/admin/grants/${row.direct!.id}`, requestTimeout), 'Acceso directo retirado.')
}
async function removeTag(tag: Tag) {
  if (!window.confirm(`¿Retirar a ${props.student.name} el acceso por la etiqueta «${tag.name}»? Afectará a todos los archivos compartidos por esa etiqueta; se conservarán los accesos directos y por otras etiquetas.`)) return
  await run(() => api.delete(`/admin/users/${props.student.id}/tag-grants/${tag.id}`, requestTimeout), 'Acceso por etiqueta retirado.')
}
function tagStatus(grant: StudentTagGrant) {
  if (new Date(grant.expires_at).getTime() <= Date.now()) return 'Caducada'
  if (new Date(grant.starts_at).getTime() > Date.now()) return 'Pendiente'
  return 'Activa'
}
async function saveTag(grant: StudentTagGrant) {
  notice.value = ''
  const date = new Date(tagDates.value[grant.id])
  if (Number.isNaN(date.getTime())) { tagDownloadDrafts.value[grant.id] = grant.can_download; error.value = 'Selecciona una fecha válida.'; return }
  if (!window.confirm(`¿Actualizar el acceso por la etiqueta «${grant.tag.name}»? Afectará a todos los archivos actuales y futuros de esa etiqueta para ${props.student.name}; se conservan los accesos directos y por otras etiquetas.`)) {
    tagDates.value[grant.id] = localDateTime(grant.expires_at)
    tagDownloadDrafts.value[grant.id] = grant.can_download
    return
  }
  await run(() => api.patch(`/admin/users/${props.student.id}/tag-grants/${grant.tag.id}`, { grant_id: grant.id, expires_at: date.toISOString(), can_download: tagDownloadDrafts.value[grant.id] }, requestTimeout), 'Acceso por etiqueta actualizado.', () => { tagDates.value[grant.id] = localDateTime(grant.expires_at); tagDownloadDrafts.value[grant.id] = grant.can_download })
}
onMounted(async () => { await nextTick(); closeButton.value?.focus(); await load() })
</script>

<template>
  <div class="modal student-access-overlay" @click.self="closeDialog" @keydown="keepModalFocus" @keydown.esc.stop="closeDialog">
    <section class="student-materials-modal" role="dialog" aria-modal="true" :aria-label="`Materiales de ${student.name}`">
      <header><div><p class="eyebrow">MATERIALES COMPARTIDOS</p><h2>{{ student.name }}</h2><small>{{ student.email }}</small></div><button ref="closeButton" class="icon-button" type="button" aria-label="Cerrar materiales" :aria-disabled="busy" @click="closeDialog">×</button></header>
      <p v-if="busy" role="status">Guardando cambios… Espera a que termine la operación.</p>
      <div class="access-body" :inert="busy ? true : undefined">
        <p v-if="error" class="alert" role="alert">{{ error }} <button v-if="accessLoadFailed && !permissionTimeoutToast" type="button" class="secondary small" @click="load">Reintentar carga</button></p><p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="selectionWarning" role="status">{{ selectionWarning }}</p>
        <p v-if="loading" class="modal-empty">Cargando materiales…</p>
        <template v-else-if="!accessLoadFailed && !permissionTimeoutToast">
          <details class="add-access"><summary>Compartir material o etiquetas</summary><form @submit.prevent="addAccess">
            <label>Compartir<select v-model="form.scope"><option value="material">Un archivo</option><option value="tag">Una o varias etiquetas</option></select></label>
            <div v-if="form.scope === 'material'" class="material-picker"><span>Material</span><button ref="materialPickerButton" type="button" class="material-picker-trigger" aria-label="Elegir material" :aria-expanded="materialPickerOpen" @click="toggleMaterials"><span>{{ selectedMaterial ? materialLabel(selectedMaterial) : 'Selecciona un material' }}</span><span aria-hidden="true">⌄</span></button><div v-if="materialPickerOpen" class="material-options" @keydown.esc.stop.prevent="closeMaterials"><input ref="materialSearchInput" v-model="materialSearch" aria-label="Buscar material" placeholder="Buscar material" @keydown.enter.prevent /><div v-if="filteredMaterials.length" class="material-options-list"><button v-for="m in filteredMaterials" :key="m.id" type="button" :aria-label="`Seleccionar ${materialLabel(m)}`" @click="chooseMaterial(m)">{{ materialLabel(m) }}</button></div><small v-else>No hay materiales disponibles.</small></div></div>
            <fieldset v-else><legend>Etiquetas</legend><p v-if="!tags.length">No hay etiquetas todavía.</p><label v-for="tag in tags" :key="tag.id" class="check"><input v-model="form.tag_ids" type="checkbox" :value="tag.id" /> {{ tag.name }}</label><small>Incluye los archivos actuales y futuros de cada etiqueta.</small></fieldset>
            <label>Duración<select v-model="form.duration"><option value="week">Una semana</option><option value="month">Un mes</option><option value="custom">Fecha concreta</option></select></label>
            <label v-if="form.duration === 'custom'">Fin<input v-model="form.expires_at" type="datetime-local" required /></label>
            <label class="check download-check"><input v-model="form.can_download" type="checkbox" /> Permitir descarga</label><button class="primary small" :disabled="busy">Guardar acceso</button>
          </form></details>
          <h3>Archivos</h3><div v-if="directRows.length" class="student-grant-list"><article v-for="row in directRows" :key="row.material.id" class="student-grant-row"><div class="grant-file-icon">{{ row.material.kind === 'video' ? '▶' : 'PDF' }}</div><div class="grant-file-main"><b>{{ row.material.title }}</b><small>{{ row.material.filename }}</small><small>{{ directLabel(row) }}<template v-if="row.tags.length"> · {{ row.tags.map(tag => `Etiqueta: ${tag.name}`).join(' · ') }}</template></small></div><template v-if="row.direct"><div class="expiry-control"><label>Caducidad de acceso al fichero<input v-model="dates[row.direct.id]" type="datetime-local" :aria-label="`Caducidad de ${row.material.title}`" @keydown="calendarKeydown" @paste.prevent @drop.prevent @wheel.prevent /></label><button type="button" class="calendar-button" :aria-label="`Abrir calendario de ${row.material.title}`" @click="openCalendar">📅</button></div><label class="check download-check"><input v-model="directDownloadDrafts[row.direct.id]" type="checkbox" /> Permitir descarga</label><button class="primary small save-direct" :disabled="busy" @click="saveDirect(row)">Guardar</button><button class="remove-button" :disabled="busy" :aria-label="`Retirar acceso directo a ${row.material.title}`" @click="removeDirect(row)">Eliminar</button></template></article></div><p v-else>Sin accesos directos.</p>
          <h3>Etiquetas</h3><p v-if="tagGroups.length"><small>Los ajustes corresponden a la concesión por etiqueta; otras vías pueden conservar el acceso o la descarga.</small></p><div v-if="tagGroups.length" class="tag-groups"><div v-for="group in tagGroups" :key="group.tag.id" class="tag-group"><details><summary>Etiqueta: {{ group.tag.name }} · {{ group.materials.length }} {{ group.materials.length === 1 ? 'archivo' : 'archivos' }}{{ tagStatus(group.grant) !== 'Activa' ? ' con acceso activo' : '' }} · {{ tagStatus(group.grant) }}</summary><ul><li v-for="row in group.materials" :key="row.material.id">{{ row.material.title }} ({{ row.material.kind === 'video' ? 'VIDEO' : 'PDF' }})<small v-if="row.direct"> · Acceso directo también</small></li></ul></details><div class="tag-controls"><div class="expiry-control"><label>Caducidad de acceso por etiqueta<input v-model="tagDates[group.grant.id]" type="datetime-local" :aria-label="`Caducidad de etiqueta ${group.tag.name}`" @keydown="calendarKeydown" @paste.prevent @drop.prevent @wheel.prevent /></label><button type="button" class="calendar-button" :aria-label="`Abrir calendario de etiqueta ${group.tag.name}`" @click="openCalendar">📅</button></div><label class="check download-check"><input v-model="tagDownloadDrafts[group.grant.id]" type="checkbox" :aria-label="`Permitir descarga por etiqueta ${group.tag.name}`" /> Permitir descarga</label><button class="primary small save-tag" :disabled="busy" :aria-label="`Guardar etiqueta ${group.tag.name}`" @click="saveTag(group.grant)">Guardar</button><button class="remove-button" :disabled="busy" :aria-label="`Retirar etiqueta ${group.tag.name}`" @click="removeTag(group.tag)">Eliminar</button></div></div></div><p v-else>Sin concesiones por etiqueta.</p>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.student-access-overlay { z-index: 80; }
.student-materials-modal { width: min(900px, 100%); min-width: 0; }
.student-materials-modal header > div { min-width: 0; overflow-wrap: anywhere; }
.access-body { padding: 20px 24px; }
.access-body h3 { margin: 22px 0 10px; }
.add-access { border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
.add-access summary, .tag-group summary { cursor: pointer; font-weight: 700; }
.add-access form { display: grid; gap: 10px; margin-top: 12px; }
.add-access label:not(.check) { display: grid; gap: 4px; }
.add-access fieldset { border: 1px solid var(--line); display: grid; gap: 6px; }
.material-picker, .material-options { display: grid; gap: 6px; min-width: 0; }
.material-picker-trigger { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%; min-width: 0; margin-top: 5px; border: 1px solid var(--line); border-radius: 10px; background: white; padding: 12px; color: var(--ink); font: inherit; text-align: left; overflow-wrap: anywhere; cursor: pointer; }
.material-picker-trigger:focus-visible { outline: 2px solid var(--brand-green); outline-offset: 2px; }
.material-options-list { display: grid; max-height: 150px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; }
.material-options-list button { min-height: 44px; text-align: left; overflow-wrap: anywhere; padding: 8px 12px; border: 0; background: transparent; color: var(--ink); cursor: pointer; }
.material-options-list button:hover, .material-options-list button:focus-visible { background: var(--mint); }
.student-grant-list { padding: 0; }
.student-grant-row { min-height: 88px; padding: 14px; gap: 12px; }
.student-grant-row .grant-file-main b { font-size: 15px; }
.student-grant-row .grant-file-main small, .student-grant-row label { font-size: 13px; line-height: 1.4; }
.download-check { display: inline-flex; align-items: center; gap: 8px; padding: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
.download-check input[type="checkbox"] { width: 19px; height: 19px; flex: 0 0 19px; accent-color: var(--brand-green); cursor: pointer; }
.expiry-control { display: flex; align-items: end; gap: 6px; min-width: 0; }
.expiry-control label { display: grid; gap: 5px; min-width: 0; font-size: 13px; font-weight: 700; }
.expiry-control input { min-width: 0; font-size: 13px; }
.calendar-button { border: 1px solid var(--line); border-radius: 8px; background: var(--paper); padding: 7px; font-size: 16px; cursor: pointer; }
.student-access-overlay .remove-button { width: auto; height: auto; border-radius: 8px; padding: 7px 10px; font-size: 12px; font-weight: 700; }
.student-grant-row .save-direct, .save-tag { width: auto; height: auto; border: 0; border-radius: 8px; padding: 7px 10px; background: var(--mint); color: var(--green); font-size: 12px; font-weight: 700; }
.tag-groups { display: grid; gap: 8px; }
.tag-group { display: grid; grid-template-columns: 44px minmax(130px, 1fr) 185px auto auto auto; gap: 12px; align-items: center; padding: 14px; border: 1px solid var(--line); border-radius: 12px; }
.tag-group details { grid-column: span 2; min-width: 0; }
.tag-controls { display: contents; }
.tag-group .expiry-control input { margin-top: 4px; padding: 7px; font-size: 11px; }
.tag-group .download-check { white-space: nowrap; }
.tag-group li { overflow-wrap: anywhere; }
@media (max-width: 900px) {
  .tag-group { grid-template-columns: 44px 1fr 185px auto; }
  .tag-group .download-check { grid-column: 2; }
}
@media (max-width: 600px) {
  .student-access-overlay { padding: 12px; }
  .access-body { padding: 16px; }
  .student-grant-row, .tag-group { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .student-grant-row .grant-file-icon { grid-column: 1; }
  .student-grant-row .grant-file-main { grid-column: 2; min-width: 0; overflow-wrap: anywhere; }
  .student-grant-row .expiry-control, .tag-group .expiry-control { grid-column: 1 / -1; }
  .student-grant-row .download-check, .tag-group .download-check { grid-column: 1 / -1; white-space: normal; }
  .tag-group details { grid-column: 1 / -1; }
  .expiry-control label { flex: 1; }
  .expiry-control input { width: 100%; max-width: 100%; }
}
</style>
