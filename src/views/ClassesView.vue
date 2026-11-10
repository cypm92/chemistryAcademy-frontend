<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import type { AcademyClass, Material } from "../types";
import { api, errorMessage } from "../services/api";
import { session } from "../services/session";
import { classEndsByMadridCutoff, MADRID, madridInput, madridToUtc, canCancelBooking } from "../services/madridTime";
import MaterialViewer from "../components/MaterialViewer.vue";
import TeamsRecreate from "../components/TeamsRecreate.vue";
import TeamsPatchReview from "../components/TeamsPatchReview.vue";

function commentParts(comment: string, status: string) {
  return comment.split(/(\s+)/).map(text => {
    let href = '';
    if (status === 'confirmed' && /^https?:\/\//i.test(text)) {
      try {
        const url = new URL(text);
        const teams = url.protocol === 'https:' && url.hostname === 'teams.microsoft.com' && !url.port;
        const simulated = (import.meta.env.DEV || import.meta.env.VITE_LOCAL_SANDBOX_BUILD === 'true') && import.meta.env.VITE_MICROSOFT_SIMULATED === 'true' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) &&
          url.origin === window.location.origin && /^\/fake\/meeting\/[A-Za-z0-9-]+$/.test(url.pathname);
        if (!url.username && !url.password && (teams || simulated)) href = text;
      } catch { /* Keep unparseable text as text. */ }
    }
    return { text, href };
  });
}

const classes = ref<AcademyClass[]>([]);
const loading = ref(true);
const classesStale = ref(true);
const uploadingId = ref<number | null>(null);
const selectedMaterial = ref<Material | null>(null);
const editingClass = ref<AcademyClass | null>(null);
const error = ref("");
const success = ref("");
const openStatusId = ref<number | null>(null);
const statusBusy = ref(false);
const teamsBusy = ref<number[]>([]);
async function retryTeams(item: AcademyClass) {
  if (teamsBusy.value.includes(item.id)) return;
  teamsBusy.value = [...teamsBusy.value, item.id];
  error.value = '';
  try {
    await api.post(`/admin/classes/${item.id}/teams/retry`);
    await load();
  } catch { error.value = item.teams_action === 'delete' ? 'No se pudo reintentar la eliminación del evento de Teams.' : 'No se pudo reintentar la creación de la reunión de Teams.'; }
  finally { teamsBusy.value = teamsBusy.value.filter(id => id !== item.id); }
}
function closeStatus(restoreFocus = false) {
  const id = openStatusId.value;
  openStatusId.value = null;
  if (restoreFocus && id !== null) nextTick(() => (document.getElementById('class-status-' + id) || document.getElementById('class-card-' + id) || document.querySelector<HTMLElement>('.classes-search input'))?.focus());
}
function onStatusOutside(event: MouseEvent) {
  if (openStatusId.value !== null && !(event.target as Element).closest?.('.class-status-control')) closeStatus();
}
function onStatusKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && openStatusId.value !== null) { event.preventDefault(); closeStatus(true); }
}
function onStatusFocusOut(event: FocusEvent) {
  const control = event.currentTarget as HTMLElement;
  if (!control.contains(event.relatedTarget as Node | null)) closeStatus();
}
onMounted(() => { document.addEventListener('click', onStatusOutside); document.addEventListener('keydown', onStatusKey); });
onUnmounted(() => { document.removeEventListener('click', onStatusOutside); document.removeEventListener('keydown', onStatusKey); });

const now = ref(Date.now());
let clockTimer: ReturnType<typeof setTimeout> | undefined;
function refreshClock() {
  now.value = Date.now();
  if (clockTimer) clearTimeout(clockTimer);
  const next = classes.value
    .filter(item => item.status === 'confirmed')
    .map(item => new Date(item.ends_at).getTime())
    .filter(end => end > now.value)
    .sort((a, b) => a - b)[0];
  if (next !== undefined) clockTimer = setTimeout(refreshClock, Math.min(next - now.value, 2_147_483_647));
}
watch(classes, refreshClock);
onMounted(() => { window.addEventListener('focus', refreshClock); document.addEventListener('visibilitychange', refreshClock); });
onUnmounted(() => { if (clockTimer) clearTimeout(clockTimer); window.removeEventListener('focus', refreshClock); document.removeEventListener('visibilitychange', refreshClock); });
function hasEnded(item: AcademyClass) {
  return new Date(item.ends_at).getTime() <= now.value;
}
function needsManagement(item: AcademyClass) {
  return item.status === 'confirmed' && hasEnded(item) && !item.management_status;
}
function visibleStatus(item: AcademyClass) {
  return isAdmin.value && item.status === 'confirmed' && hasEnded(item) && item.management_status
    ? item.management_status : item.status;
}
const filters = reactive({
  search: "",
  student: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  material: "",
  historical: "current",
});
const editForm = reactive({
  date: "",
  time: "",
  duration_slots: 1,
  subject: "",
  admin_comment: "",
});
const subjects = [
  "Química ESO",
  "Química Bachiller",
  "Química Universidad",
  "Física ESO",
  "Física Bachiller",
  "Matemáticas ESO",
  "Matemáticas Bachiller",
];
const isAdmin = computed(() => session.user?.role === "admin");
const unlinkedCount = ref(0);
const unlinkedError = ref(false);
let unlinkedRequest = 0;
async function loadUnlinkedIncidents() {
  if (!isAdmin.value) return;
  const request = ++unlinkedRequest;
  try {
    const { data } = await api.get('/admin/teams/unlinked-incidents');
    if (request !== unlinkedRequest) return;
    unlinkedCount.value = data.count;
    unlinkedError.value = false;
  } catch {
    if (request === unlinkedRequest) unlinkedError.value = true;
  }
}
function classPersonKey(item: AcademyClass) {
  return item.user_id === null ? `guest:${item.user_email.trim().toLowerCase()}` : `user:${item.user_id}`;
}
const students = computed(() =>
  [...new Map(classes.value.map((item) => [classPersonKey(item), item])).values()].sort(
    (a, b) => a.user_name.localeCompare(b.user_name),
  ),
);
const filtered = computed(() =>
  classes.value.filter((item) => {
    const search = filters.search.trim().toLocaleLowerCase();
    const starts = madridInput(item.starts_at).slice(0, 10);
    const matchesSearch =
      !search ||
      [
        item.topic,
        item.user_name,
        item.user_email,
        ...item.materials.map((material) => material.title),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search);
    const matchesStudent =
      !filters.student || classPersonKey(item) === filters.student;
    const matchesStatus = !filters.status || visibleStatus(item) === filters.status;
    const matchesFrom =
      !filters.dateFrom || starts >= filters.dateFrom;
    const matchesTo =
      !filters.dateTo || starts <= filters.dateTo;
    const matchesMaterial =
      !filters.material ||
      (filters.material === "attached"
        ? item.materials.length > 0
        : filters.material === "none"
          ? item.materials.length === 0
          : item.materials.some(
              (material) => material.id === Number(filters.material),
            ));
    const matchesHistorical =
      !isAdmin.value ||
      filters.historical === "all" ||
      (filters.historical === "historical"
        ? item.is_historical
        : !item.is_historical);
    return (
      matchesSearch &&
      matchesStudent &&
      matchesStatus &&
      matchesFrom &&
      matchesTo &&
      matchesMaterial &&
      matchesHistorical
    );
  }),
);
const classSections = computed(() => {
  const pending = filtered.value.filter((item) => item.status === "requested");
  const remaining = filtered.value.filter(
    (item) => item.status !== "requested",
  );
  return [
    ...(pending.length
      ? [
          {
            id: "pending",
            title: isAdmin.value
              ? "Solicitudes pendientes"
              : "Reservas pendientes de confirmación",
            items: pending,
          },
        ]
      : []),
    ...(remaining.length
      ? [{ id: "classes", title: "Clases e historial", items: remaining }]
      : []),
  ];
});
function statusLabel(status: AcademyClass["status"] | 'paid' | 'pending_payment') {
  return {
    requested: "Reservada",
    confirmed: "Confirmada",
    declined: "Rechazada",
    cancelled: "Cancelada",
    paid: "Pagada",
    pending_payment: "Pendiente de pago",
  }[status];
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    timeZone: MADRID,
    dateStyle: "full",
    timeStyle: "short",
  });
}
function canDelete(item: AcademyClass) {
  return (
    item.status === "declined" ||
    new Date(item.starts_at).getTime() > Date.now()
  );
}
function canCancel(item: AcademyClass) {
  return canCancelBooking(item.status, item.starts_at);
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const classesRequest = api.get(
      isAdmin.value ? "/admin/classes" : "/classes",
    );
    void loadUnlinkedIncidents();
    const { data } = await classesRequest;
    classes.value = data;
    classesStale.value = false;
  } catch (err) {
    classesStale.value = true;
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  } finally {
    loading.value = false;
  }
}
async function recreateResult(conflict: boolean, id: number) {
  success.value = '';
  await load();
  if (conflict) error.value = 'No se ha podido autorizar; comprueba el estado de la cuenta y que la clase siga confirmada, y vuelve a cargar los datos.';
  else success.value = 'Se ha solicitado un nuevo intento automático de creación.';
  if (classesStale.value) error.value += ' No se pudieron actualizar las clases; los datos mostrados pueden estar obsoletos. Actualiza las clases antes de volver a intentarlo.';
  await nextTick();
  (document.getElementById('class-card-' + id) || document.querySelector<HTMLElement>('.classes-search input'))?.focus();
}
async function patchReviewResult(conflict: boolean, id: number) {
  success.value = '';
  await load();
  if (conflict) error.value = 'No puede resolverse si hay una operación aún en curso; vuelva a cargar o contacte con soporte.';
  else success.value = 'La actualización se ha marcado como revisada.';
  if (classesStale.value) error.value += ' No se pudieron actualizar las clases; los datos mostrados pueden estar obsoletos. Actualiza las clases antes de volver a intentarlo.';
  await nextTick();
  (document.getElementById('class-card-' + id) || document.querySelector<HTMLElement>('.classes-search input'))?.focus();
}
async function uploadAttachment(item: AcademyClass, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = "";
  success.value = "";
  uploadingId.value = item.id;
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name.replace(/\.[^.]+$/, ""));
    const { data } = await api.post(
      `/admin/classes/${item.id}/attachments`,
      form,
    );
    classes.value = classes.value.map((current) =>
      current.id === item.id ? data : current,
    );
    success.value =
      "Archivo adjuntado y compartido automáticamente con el alumno.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  } finally {
    uploadingId.value = null;
    input.value = "";
  }
}
async function setHistorical(item: AcademyClass, isHistorical: boolean) {
  error.value = "";
  success.value = "";
  try {
    const { data } = await api.patch(`/admin/classes/${item.id}/historical`, {
      is_historical: isHistorical,
    });
    classes.value = classes.value.map((current) =>
      current.id === item.id ? data : current,
    );
    success.value = isHistorical
      ? "Clase movida al histórico."
      : "Clase restaurada a la vista habitual.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function deleteClass(item: AcademyClass) {
  if (
    !window.confirm(
      `Vas a eliminar la clase de ${item.user_name} (${item.user_email}).\n\nLa clase se cancelará en la plataforma. Gestiona la comunicación con el alumno para avisarle de la cancelación.\n\n¿Quieres continuar?`,
    )
  )
    return;
  error.value = "";
  success.value = "";
  try {
    await api.delete(`/admin/classes/${item.id}`);
    classes.value = classes.value.filter((current) => current.id !== item.id);
    success.value = "Clase eliminada de la plataforma.";
    void loadUnlinkedIncidents();
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function updateBookingStatus(
  item: AcademyClass,
  nextStatus: "confirmed" | "declined",
) {
  if (statusBusy.value) return;
  statusBusy.value = true;
  error.value = "";
  success.value = "";
  try {
    const { data } = await api.patch(`/admin/bookings/${item.id}`, {
      status: nextStatus,
    });
    classes.value = classes.value.map((current) =>
      current.id === item.id ? { ...current, status: data.status } : current,
    );
    if (openStatusId.value === item.id) closeStatus(true);
    success.value =
      nextStatus === "confirmed"
        ? "Reserva aceptada. La clase ya figura como confirmada."
        : "Reserva denegada.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  } finally { statusBusy.value = false; }
}
async function updateManagement(item: AcademyClass, status: 'paid' | 'pending_payment' | null) {
  if (statusBusy.value || !isAdmin.value || item.status !== 'confirmed' || !hasEnded(item)) return;
  if (status === null && (!item.management_status || !window.confirm('¿Volver esta clase a confirmada? Se quitará su estado de pago y podrás corregir el horario.'))) return;
  statusBusy.value = true;
  error.value = '';
  success.value = '';
  try {
    const { data } = await api.patch(`/admin/classes/${item.id}/management`, { management_status: status });
    classes.value = classes.value.map(current => current.id === item.id ? { ...current, management_status: data.management_status } : current);
    if (openStatusId.value === item.id) closeStatus(true);
    success.value = 'Gestión de la clase actualizada.';
  } catch (err) {
    error.value = errorMessage(err);
  } finally { statusBusy.value = false; }
}
async function cancelBooking(item: AcademyClass) {
  if (!canCancel(item)) { error.value = "Con 24 horas o menos, contacta con la profesora para cancelar."; return; }
  error.value = "";
  success.value = "";
  try {
    await api.post(`/bookings/${item.id}/cancel`);
    classes.value = classes.value.map((current) =>
      current.id === item.id ? { ...current, status: "cancelled" } : current,
    );
    success.value = "La reserva se ha cancelado.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function deleteAttachment(
  item: AcademyClass,
  materialId: number,
  title: string,
) {
  if (
    !window.confirm(
      `¿Eliminar el archivo “${title}”? Esta acción también lo quitará del acceso del alumno.`,
    )
  )
    return;
  error.value = "";
  success.value = "";
  try {
    await api.delete(`/admin/materials/${materialId}`);
    classes.value = classes.value.map((current) =>
      current.id === item.id
        ? {
            ...current,
            materials: current.materials.filter(
              (material) => material.id !== materialId,
            ),
          }
        : current,
    );
    success.value = "Archivo eliminado correctamente.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
function openAttachment(material: AcademyClass["materials"][number]) {
  selectedMaterial.value = {
    ...material,
    description: "",
    folder: null,
    content_type: material.kind === "pdf" ? "application/pdf" : "video/mp4",
    size_bytes: 0,
    can_download: false,
    tags: [],
    is_favorite: false,
  };
}
function editClass(item: AcademyClass) {
  const date = new Date(item.starts_at);
  editForm.date = madridInput(date).slice(0, 10);
  editForm.time = madridInput(date).slice(11);
  editForm.duration_slots = Math.round(
    (new Date(item.ends_at).getTime() - date.getTime()) / 1_800_000,
  );
  editForm.subject = item.topic;
  editForm.admin_comment = item.admin_comment || "";
  editingClass.value = item;
}
async function saveClassEdit() {
  const item = editingClass.value;
  if (!item) return;
  error.value = "";
  success.value = "";
  try {
    const starts = new Date(madridToUtc(`${editForm.date}T${editForm.time}`));
    if (!classEndsByMadridCutoff(starts, Number(editForm.duration_slots))) { error.value = "La clase debe terminar como máximo a las 21:00 (hora de Madrid)."; return; }
    const { data } = await api.patch(`/admin/classes/${item.id}`, {
      starts_at: starts.toISOString(),
      duration_slots: Number(editForm.duration_slots),
      subject: editForm.subject,
      admin_comment: editForm.admin_comment,
    });
    classes.value = classes.value.map((current) =>
      current.id === item.id ? data : current,
    );
    success.value = "Clase actualizada.";
    editingClass.value = null;
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function cancelAdminClass(item: AcademyClass) {
  if (statusBusy.value) return;
  if (
    !window.confirm(
      `¿Cancelar la clase de ${item.user_name}? El alumno verá la cancelación.${item.management_status ? ' La clase dejará de contar como pagada o pendiente de pago en los informes futuros. Los informes ya enviados no se modificarán.' : ''}`,
    )
  )
    return;
  statusBusy.value = true;
  error.value = "";
  success.value = "";
  try {
    const { data } = await api.post(`/admin/classes/${item.id}/cancel`);
    classes.value = classes.value.map((current) =>
      current.id === item.id ? data : current,
    );
    if (openStatusId.value === item.id) closeStatus(true);
    success.value = "Clase cancelada.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  } finally { statusBusy.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="page classes-page">

    <p v-if="isAdmin && unlinkedCount > 0" class="alert" role="alert">Hay {{ unlinkedCount }} incidencias de reuniones asociadas a clases eliminadas. Revisa Outlook y contacta con soporte.</p>
    <div v-if="isAdmin && unlinkedError" class="alert" role="alert">No se pudieron comprobar incidencias de reuniones. <button type="button" @click="loadUnlinkedIncidents">Reintentar</button></div>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="success" class="success-alert">{{ success }}</p>
    <button v-if="classesStale && !loading" type="button" @click="load">Actualizar clases</button>
    <section class="class-filters">
      <label class="classes-search"
        ><span>⌕</span
        ><input
          v-model="filters.search"
          placeholder="Buscar por tema, alumno o archivo..." /></label
      ><select v-if="isAdmin" v-model="filters.student">
        <option value="">Todos los alumnos</option>
        <option
          v-for="student in students"
          :key="classPersonKey(student)"
          :value="classPersonKey(student)"
        >
          {{ student.user_name }}{{ student.user_id === null ? ` · ${student.user_email} (invitado)` : "" }}
        </option></select
      ><select v-if="isAdmin" v-model="filters.historical">
        <option value="current">Clases habituales</option>
        <option value="historical">Solo histórico</option>
        <option value="all">Todas las clases</option></select
      ><select v-model="filters.status">
        <option value="">Todos los estados</option>
        <option value="requested">Reservadas</option>
        <option value="confirmed">Confirmadas</option>
        <option v-if="isAdmin" value="paid">Pagadas</option>
        <option v-if="isAdmin" value="pending_payment">Pendientes de pago</option>
        <option value="declined">Rechazadas</option>
        <option value="cancelled">Canceladas</option></select
      ><select v-model="filters.material">
        <option value="">Cualquier material</option>
        <option value="attached">Con archivos</option>
        <option value="none">Sin archivos</option></select
      ><label>Desde<input v-model="filters.dateFrom" type="date" /></label
      ><label>Hasta<input v-model="filters.dateTo" type="date" /></label>
    </section>
    <p v-if="loading" class="classes-empty">Cargando clases...</p>
    <div v-else-if="!filtered.length" class="class-section-heading">
      <p class="classes-empty">No hay clases que coincidan con estos filtros.</p>
      <span class="class-count">0 clases</span>
    </div>
    <div v-else class="class-sections">
      <section
        v-for="(section, index) in classSections"
        :key="section.id"
        class="class-section"
      >
        <div class="class-section-heading">
          <h2>{{ section.title }}</h2>
          <span v-if="index === 0" class="class-count">{{ filtered.length }} {{ filtered.length === 1 ? 'clase' : 'clases' }}</span>
        </div>
        <div class="class-list">
          <article
            v-for="item in section.items"
            :key="item.id"
            :id="'class-card-' + item.id" tabindex="-1"
            class="class-card"
            :class="{ 'needs-management': isAdmin && needsManagement(item) }"
          >
            <div class="class-date">
              <b>{{
                new Date(item.starts_at).toLocaleDateString("es-ES", {
                  timeZone: MADRID,
                  day: "2-digit",
                  month: "short",
                })
              }}</b
              ><small>{{
                new Date(item.starts_at).toLocaleTimeString("es-ES", {
                  timeZone: MADRID,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }}</small>
              <small class="class-time-zone">Hora de Madrid</small>
            </div>
            <div class="class-main">
              <div class="class-main-title">
                <div>
                  <h2>{{ item.topic }}</h2>
                </div>
                <div v-if="isAdmin && (item.status === 'requested' || (item.status === 'confirmed' && hasEnded(item)))" class="class-status-control" @focusout="onStatusFocusOut">
                  <button :id="'class-status-' + item.id" type="button"
                    :class="['class-status', item.status, { 'needs-management': needsManagement(item) }]"
                    :aria-expanded="openStatusId === item.id" :aria-controls="'class-status-options-' + item.id"
                    @click="openStatusId = openStatusId === item.id ? null : item.id">{{ statusLabel(visibleStatus(item)) }}{{ needsManagement(item) ? ' · Pendiente de gestión' : '' }}</button>
                  <div v-if="openStatusId === item.id" :id="'class-status-options-' + item.id" class="class-status-menu" role="group" aria-label="Cambiar estado">
                    <template v-if="item.status === 'requested'">
                      <button type="button" :disabled="statusBusy" @click="updateBookingStatus(item, 'confirmed')">Aprobar</button>
                      <button type="button" :disabled="statusBusy" @click="updateBookingStatus(item, 'declined')">Rechazar</button>
                    </template>
                    <template v-else>
                      <button type="button" :disabled="statusBusy" @click="updateManagement(item, 'paid')">Pagada</button>
                      <button type="button" :disabled="statusBusy" @click="updateManagement(item, 'pending_payment')">Pendiente de pago</button>
                      <button v-if="item.management_status" type="button" :disabled="statusBusy" @click="updateManagement(item, null)">Volver a confirmada</button>
                      <button type="button" :disabled="statusBusy" @click="cancelAdminClass(item)">Cancelada</button>
                    </template>
                  </div>
                </div>
                <span v-else :class="['class-status', item.status]">{{ statusLabel(item.status) }}</span>
                <span v-if="item.is_historical" class="class-status historical">Histórica</span>

              </div>
              <p class="class-student">
                <b>{{ isAdmin ? item.user_name : "Tu clase" }}</b
                ><template v-if="isAdmin"> · {{ item.user_email }}<template v-if="item.user_id === null"> · Invitado</template></template> ·
                {{ formatDate(item.starts_at) }}
              </p>
              <div v-if="isAdmin && (item.teams_status || item.teams_unresolved_attempts)" class="class-teams" role="status">
                <span v-if="item.teams_status === 'needs_review' && item.teams_review_reason === 'patch_result_unknown'">No se ha podido confirmar la actualización de la reunión. Revisa el evento y su horario en Outlook; contacta con soporte si la incidencia continúa.</span>
                <span v-else-if="item.teams_status === 'needs_review' && item.teams_review_reason === 'event_missing'">No se encuentra el evento en Microsoft. Comprueba el calendario y contacta con soporte antes de crear otro.</span>
                <span v-else-if="item.teams_status === 'needs_review' && item.teams_review_reason === 'recreation_account_mismatch'">La cuenta de Microsoft no coincide con la autorizada para crear la reunión. Revisa la cuenta y contacta con soporte antes de continuar.</span>
                <span v-else-if="item.teams_status === 'needs_review'">Resultado de creación incierto: puede que el evento ya exista. Revisa el calendario de Microsoft y contacta con soporte si necesitas intervención. Esta operación sigue pendiente de revisión; no crees otra reunión sin revisar el posible duplicado.</span>
                <span v-else-if="item.teams_status === 'error'">{{ item.teams_action === 'delete' ? 'Error al eliminar el evento de Teams.' : 'Error al sincronizar la reunión de Teams.' }}</span>
                <span v-else-if="item.teams_status === 'pending'">Reunión de Teams pendiente.</span>
                <span v-else-if="item.teams_status === 'not_configured'">Microsoft Teams no está configurado.</span>
                <span v-else-if="item.teams_status === 'ready' && item.teams_unresolved_attempts">La reunión principal de Teams está preparada, pero hay {{ item.teams_unresolved_attempts }} {{ item.teams_unresolved_attempts === 1 ? 'incidencia pendiente' : 'incidencias pendientes' }} de revisión. Examina Outlook por posibles duplicados.</span>
                <span v-else-if="item.teams_status === 'ready'">Reunión de Teams preparada.</span>
                <button v-if="item.teams_status === 'error'" type="button" :disabled="teamsBusy.includes(item.id)" @click="retryTeams(item)">{{ teamsBusy.includes(item.id) ? 'Reintentando…' : item.teams_action === 'delete' ? 'Reintentar eliminación' : 'Reintentar Teams' }}</button>
                <span v-if="item.teams_unresolved_attempts && item.teams_status !== 'ready'">{{ item.teams_unresolved_attempts }} {{ item.teams_unresolved_attempts === 1 ? 'incidencia pendiente' : 'incidencias pendientes' }} de revisión. Examina Outlook por posibles duplicados.</span>
                <TeamsRecreate v-if="item.teams_status === 'needs_review' && ['creation_result_unknown', 'event_missing'].includes(item.teams_review_reason || '')" :class-id="item.id" :revision="item.teams_revision" :disabled="classesStale || loading || item.status !== 'confirmed' || item.teams_action !== 'upsert'" @requested="recreateResult(false, item.id)" @conflict="recreateResult(true, item.id)" />
                <TeamsPatchReview v-if="item.teams_status === 'needs_review' && item.teams_review_reason === 'patch_result_unknown'" :class-id="item.id" :revision="item.teams_revision" :status="item.status" :disabled="classesStale || loading || teamsBusy.includes(item.id)" @reviewed="patchReviewResult(false, item.id)" @conflict="patchReviewResult(true, item.id)" />
              </div>
              <section class="class-materials">
                <div class="class-materials-heading">
                  <b>Materiales de la clase</b
                  ><span v-if="item.materials.length"
                    >{{ item.materials.length }}
                    {{
                      item.materials.length === 1 ? "archivo" : "archivos"
                    }}</span
                  >
                </div>
                <p v-if="!item.materials.length" class="no-materials">
                  Esta clase todavía no tiene archivos adjuntos.
                </p>
                <div v-else class="class-resource-list">
                  <article
                    v-for="material in item.materials"
                    :key="material.id"
                    class="class-resource"
                  >
                    <button
                      class="class-resource-open"
                      :title="`Abrir ${material.title}`"
                      @click="openAttachment(material)"
                    >
                      <span :class="['class-resource-icon', material.kind]">{{
                        material.kind === "video" ? "▶" : "PDF"
                      }}</span
                      ><span class="class-resource-details"
                        ><b>{{ material.title }}</b
                        ><small
                          >{{
                            material.kind === "video"
                              ? "Vídeo de la clase"
                              : "Documento PDF"
                          }}
                          · Pulsa para abrir</small
                        ></span
                      ><span class="class-resource-arrow">›</span></button
                    ><button
                      v-if="isAdmin"
                      class="delete-attachment"
                      :title="`Eliminar ${material.title}`"
                      @click="
                        deleteAttachment(item, material.id, material.title)
                      "
                    >
                      ×
                    </button>
                  </article>
                </div>
              </section>
              <p v-if="item.admin_comment" class="class-comment" style="white-space: pre-wrap; overflow-wrap: anywhere">
                <b>Información de la profesora:</b> <template v-for="(part, index) in commentParts(item.admin_comment, item.status)" :key="index"><a v-if="part.href" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a><template v-else>{{ part.text }}</template></template>
              </p>
              <button
                v-if="!isAdmin && canCancel(item)"
                class="cancel-class-button"
                @click="cancelBooking(item)"
              >
                Cancelar reserva
              </button>
              <p
                v-else-if="!isAdmin && item.status === 'confirmed'"
                class="cancel-class-help"
              >
                Para cancelar una clase con 24 horas o menos, contacta con la
                profesora.
              </p>
              <div v-if="isAdmin" class="class-actions">
              <label
                v-if="item.user_id !== null && item.status === 'confirmed'"
                class="class-upload"
                :class="{ uploading: uploadingId === item.id }"
                ><span>{{
                  uploadingId === item.id
                    ? "Adjuntando..."
                    : "Adjuntar PDF o vídeo"
                }}</span
                ><input
                  type="file"
                  accept=".pdf,application/pdf,video/*"
                  :disabled="uploadingId !== null"
                  @change="uploadAttachment(item, $event)"
              /></label>
              <p v-else-if="item.user_id !== null" class="attach-hint">
                Los archivos se podrán adjuntar cuando la reserva esté
                confirmada.
              </p>
              <button
                v-if="['requested', 'confirmed'].includes(item.status)"
                class="edit-button"
                @click="editClass(item)"
              >
                Editar clase</button
              ><button
                v-if="['requested', 'confirmed'].includes(item.status)"
                class="delete-class-button"
                @click="cancelAdminClass(item)"
              >
                Cancelar clase</button
              ><button
                v-if="true"
                class="historical-button"
                @click="setHistorical(item, !item.is_historical)"
              >
                {{
                  item.is_historical ? "Restaurar clase" : "Mover a histórico"
                }}</button
              ><button
                v-if="canDelete(item)"
                class="delete-class-button"
                @click="deleteClass(item)"
              >
                Eliminar clase
              </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
    <MaterialViewer
      :material="selectedMaterial"
      @close="selectedMaterial = null"
    />
    <div
      v-if="editingClass"
      class="modal edit-class-modal"
      @click.self="editingClass = null"
    >
      <form class="edit-class-card" @submit.prevent="saveClassEdit">
        <header>
          <div>
            <p class="eyebrow">EDITAR CLASE</p>
            <h2>{{ editingClass.user_name }}</h2>
            <p>{{ editingClass.user_email }}</p>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Cerrar"
            @click="editingClass = null"
          >
            ×
          </button>
        </header>
        <p>Horario peninsular español (Europe/Madrid).</p><p v-if="error" class="alert" role="alert">{{ error }}</p><div class="edit-class-fields">
          <label
            >Fecha<input v-model="editForm.date" type="date" required
          /></label>
          <label
            >Hora de inicio<input
              v-model="editForm.time"
              type="time"
              step="1800"
              required
          /></label>
          <label
            >Duración<select v-model.number="editForm.duration_slots">
              <option :value="1">30 minutos</option>
              <option :value="2">1 hora</option>
              <option :value="3">1 hora y 30 minutos</option>
              <option :value="4">2 horas</option>
            </select></label
          >
          <label
            >Asignatura<select v-model="editForm.subject" required>
              <option
                v-for="subject in subjects"
                :key="subject"
                :value="subject"
              >
                {{ subject }}
              </option>
            </select></label
          >
          <label class="edit-comment-field"
            >Comentarios para el alumno / enlace de Teams<textarea
              v-model="editForm.admin_comment"
              rows="5"
              maxlength="1000"
              placeholder="Por ejemplo, pega aquí el enlace de Teams de esta clase."
            />
          </label>
        </div>
        <footer>
          <button type="button" class="secondary" @click="editingClass = null">
            Cancelar</button
          ><button class="primary">Guardar cambios</button>
        </footer>
      </form>
    </div>
  </section>
</template>
