<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { AcademyClass, Material } from "../types";
import { api, errorMessage } from "../services/api";
import { session } from "../services/session";
import MaterialViewer from "../components/MaterialViewer.vue";

const classes = ref<AcademyClass[]>([]);
const loading = ref(true);
const uploadingId = ref<number | null>(null);
const selectedMaterial = ref<Material | null>(null);
const editingClass = ref<AcademyClass | null>(null);
const error = ref("");
const success = ref("");
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
const students = computed(() =>
  [...new Map(classes.value.map((item) => [item.user_id, item])).values()].sort(
    (a, b) => a.user_name.localeCompare(b.user_name),
  ),
);
const filtered = computed(() =>
  classes.value.filter((item) => {
    const search = filters.search.trim().toLocaleLowerCase();
    const starts = new Date(item.starts_at);
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
      !filters.student || item.user_id === Number(filters.student);
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesFrom =
      !filters.dateFrom || starts >= new Date(`${filters.dateFrom}T00:00`);
    const matchesTo =
      !filters.dateTo || starts <= new Date(`${filters.dateTo}T23:59:59`);
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
function statusLabel(status: AcademyClass["status"]) {
  return {
    requested: "Reservada",
    confirmed: "Confirmada",
    declined: "Denegada",
    cancelled: "Cancelada",
  }[status];
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
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
  return (
    item.status === "requested" ||
    (item.status === "confirmed" &&
      new Date(item.starts_at).getTime() - Date.now() >= 24 * 60 * 60 * 1000)
  );
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get(
      isAdmin.value ? "/admin/classes" : "/classes",
    );
    classes.value = data;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
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
    error.value = errorMessage(err);
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
    error.value = errorMessage(err);
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
  } catch (err) {
    error.value = errorMessage(err);
  }
}
async function updateBookingStatus(
  item: AcademyClass,
  nextStatus: "confirmed" | "declined",
) {
  error.value = "";
  success.value = "";
  try {
    const { data } = await api.patch(`/admin/bookings/${item.id}`, {
      status: nextStatus,
    });
    classes.value = classes.value.map((current) =>
      current.id === item.id ? { ...current, status: data.status } : current,
    );
    success.value =
      nextStatus === "confirmed"
        ? "Reserva aceptada. La clase ya figura como confirmada."
        : "Reserva denegada.";
  } catch (err) {
    error.value = errorMessage(err);
  }
}
async function cancelBooking(item: AcademyClass) {
  error.value = "";
  success.value = "";
  try {
    await api.post(`/bookings/${item.id}/cancel`);
    classes.value = classes.value.map((current) =>
      current.id === item.id ? { ...current, status: "cancelled" } : current,
    );
    success.value = "La reserva se ha cancelado.";
  } catch (err) {
    error.value = errorMessage(err);
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
    error.value = errorMessage(err);
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
  editForm.date = date.toISOString().slice(0, 10);
  editForm.time = date.toTimeString().slice(0, 5);
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
    const starts = new Date(`${editForm.date}T${editForm.time}`);
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
    error.value = errorMessage(err);
  }
}
async function cancelAdminClass(item: AcademyClass) {
  if (
    !window.confirm(
      `¿Cancelar la clase de ${item.user_name}? El alumno verá la cancelación.`,
    )
  )
    return;
  try {
    const { data } = await api.post(`/admin/classes/${item.id}/cancel`);
    classes.value = classes.value.map((current) =>
      current.id === item.id ? data : current,
    );
    success.value = "Clase cancelada.";
  } catch (err) {
    error.value = errorMessage(err);
  }
}
onMounted(load);
</script>

<template>
  <section class="page classes-page">
    <div class="classes-heading">
      <div>
        <p class="eyebrow">
          {{ isAdmin ? "GESTIÓN ACADÉMICA" : "MIS CLASES" }}
        </p>
        <h1>Mis clases</h1>
        <p>
          {{
            isAdmin
              ? "Consulta el historial de clases y adjunta materiales para cada alumno."
              : "Consulta tus clases y los archivos que tu profesora ha compartido contigo."
          }}
        </p>
      </div>
      <span>{{ filtered.length }} clases</span>
    </div>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="success" class="success-alert">{{ success }}</p>
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
          :key="student.user_id"
          :value="student.user_id"
        >
          {{ student.user_name }}
        </option></select
      ><select v-if="isAdmin" v-model="filters.historical">
        <option value="current">Clases habituales</option>
        <option value="historical">Solo histórico</option>
        <option value="all">Todas las clases</option></select
      ><select v-model="filters.status">
        <option value="">Todos los estados</option>
        <option value="requested">Reservadas</option>
        <option value="confirmed">Confirmadas</option>
        <option value="declined">Denegadas</option>
        <option value="cancelled">Canceladas</option></select
      ><select v-model="filters.material">
        <option value="">Cualquier material</option>
        <option value="attached">Con archivos</option>
        <option value="none">Sin archivos</option></select
      ><label>Desde<input v-model="filters.dateFrom" type="date" /></label
      ><label>Hasta<input v-model="filters.dateTo" type="date" /></label>
    </section>
    <p v-if="loading" class="classes-empty">Cargando clases...</p>
    <p v-else-if="!filtered.length" class="classes-empty">
      No hay clases que coincidan con estos filtros.
    </p>
    <div v-else class="class-sections">
      <section
        v-for="section in classSections"
        :key="section.id"
        class="class-section"
      >
        <h2>{{ section.title }}</h2>
        <div class="class-list">
          <article
            v-for="item in section.items"
            :key="item.id"
            class="class-card"
          >
            <div class="class-date">
              <b>{{
                new Date(item.starts_at).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                })
              }}</b
              ><small>{{
                new Date(item.starts_at).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }}</small>
            </div>
            <div class="class-main">
              <div class="class-main-title">
                <div>
                  <p class="eyebrow">
                    {{
                      item.is_historical
                        ? "HISTÓRICA"
                        : statusLabel(item.status)
                    }}
                  </p>
                  <h2>{{ item.topic }}</h2>
                </div>
                <span
                  :class="[
                    'class-status',
                    item.is_historical ? 'historical' : item.status,
                  ]"
                  >{{
                    item.is_historical ? "Histórica" : statusLabel(item.status)
                  }}</span
                >
              </div>
              <p class="class-student">
                <b>{{ isAdmin ? item.user_name : "Tu clase" }}</b
                ><template v-if="isAdmin"> · {{ item.user_email }}</template> ·
                {{ formatDate(item.starts_at) }}
              </p>
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
              <p v-if="item.admin_comment" class="class-comment">
                <b>Información de la profesora:</b> {{ item.admin_comment }}
              </p>
              <div
                v-if="
                  isAdmin && item.status === 'requested' && !item.is_historical
                "
                class="class-request-actions"
              >
                <button
                  class="request-decision accept"
                  title="Aceptar reserva"
                  @click="updateBookingStatus(item, 'confirmed')"
                >
                  ✓</button
                ><button
                  class="request-decision decline"
                  title="Denegar reserva"
                  @click="updateBookingStatus(item, 'declined')"
                >
                  ×
                </button>
              </div>
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
                Para cancelar una clase con menos de 24 horas, contacta con la
                administradora.
              </p>
              <div v-if="isAdmin" class="class-actions">
              <label
                v-if="item.status === 'confirmed'"
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
              <p v-else class="attach-hint">
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
        <div class="edit-class-fields">
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
