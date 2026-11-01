<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { Booking, User } from "../types";
import { api, errorMessage } from "../services/api";
import { validAvailability } from "../services/availability";
import { session } from "../services/session";
import { MADRID, madridInput, madridToUtc, madridCalendarDate, shiftCalendarPeriod, mondayStart, isWeekend, canCancelBooking } from "../services/madridTime";

type CalendarView = "week" | "month" | "year";
const view = ref<CalendarView>("week");
const cursor = ref(madridCalendarDate());
const selectedDate = ref(madridCalendarDate());
const events = ref<Booking[]>([]);
const requests = ref<Booking[]>([]);
const loading = ref(true);
const availabilityReady = ref(false);
const availabilityError = ref("");
const saving = ref(false);
let loadVersion = 0;
const message = ref("");
const error = ref("");
const block = reactive({
  starts_at: "",
  ends_at: "",
  status: "blocked",
  note: "",
});
const agendaAction = ref<"class" | "block">("class");
const students = ref<User[]>([]);
const adminClass = reactive({
  user_id: 0,
  starts_at: "",
  duration_slots: 1,
  subject: "",
  admin_comment: "",
});
const calendarItem = ref<Booking | null>(null);
const calendarEdit = reactive({
  date: "",
  time: "",
  duration_slots: 1,
  subject: "",
  admin_comment: "",
});
const blockEdit = reactive({
  starts_at: "",
  ends_at: "",
  status: "blocked",
  note: "",
});
const subject = ref("");
const startSlot = ref("");
const endSlot = ref("");
const subjects = [
  "Química ESO",
  "Química Bachiller",
  "Química Universidad",
  "Física ESO",
  "Física Bachiller",
  "Matemáticas ESO",
  "Matemáticas Bachiller",
];

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const isAdmin = computed(() => session.user?.role === "admin");
const myBookings = computed(() =>
  events.value.filter((event) => event.is_mine),
);
const currentBookings = computed(() =>
  myBookings.value
    .filter(
      (event) =>
        new Date(event.starts_at) >= new Date() &&
        !["declined", "cancelled"].includes(event.status),
    )
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
);
const bookingHistory = computed(() =>
  myBookings.value
    .filter(
      (event) =>
        new Date(event.starts_at) < new Date() ||
        ["declined", "cancelled"].includes(event.status),
    )
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)),
);
const title = computed(() =>
  view.value === "year"
    ? String(cursor.value.getFullYear())
    : `${months[cursor.value.getMonth()]} ${cursor.value.getFullYear()}`,
);
const selectedLabel = computed(() =>
  selectedDate.value.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }),
);
const slots = computed(() =>
  Array.from({ length: 26 }, (_, index) => {
    const hour = 8 + Math.floor(index / 2);
    return `${String(hour).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
  }),
);

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function sameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}
function eventsForDay(date: Date) {
  return events.value.filter((event) =>
    sameDay(madridCalendarDate(event.starts_at), date),
  );
}
function slotEvent(slot: string) {
  return eventsForDay(selectedDate.value).find((event) => {
    return madridInput(event.starts_at).slice(11) === slot;
  });
}
function slotStart(slot: string) {
  return new Date(madridToUtc(`${dateKey(selectedDate.value)}T${slot}`));
}
const endOptions = computed(() => {
  if (!startSlot.value) return [];
  const starts = slotStart(startSlot.value);
  return [1, 2, 3, 4]
    .map((slots) => new Date(starts.getTime() + slots * 30 * 60 * 1000))
    .filter(
      (ends) =>
        Number(madridInput(ends).slice(11, 13)) < 21 ||
        (Number(madridInput(ends).slice(11, 13)) === 21 && Number(madridInput(ends).slice(14, 16)) === 0),
    )
    .map(
      (ends) =>
        `${String(Number(madridInput(ends).slice(11, 13))).padStart(2, "0")}:${String(Number(madridInput(ends).slice(14, 16))).padStart(2, "0")}`,
    );
});
const selectedDurationSlots = computed(() => {
  if (!startSlot.value || !endSlot.value) return 0;
  const [startHour, startMinute] = startSlot.value.split(":").map(Number);
  const [endHour, endMinute] = endSlot.value.split(":").map(Number);
  return (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 30;
});
function rangeIsUnavailable() {
  if (!startSlot.value || !endSlot.value) return false;
  const starts = slotStart(startSlot.value);
  const ends = slotStart(endSlot.value);
  return events.value.some(
    (event) =>
      !["declined", "cancelled"].includes(event.status) &&
      new Date(event.starts_at) < ends &&
      new Date(event.ends_at) > starts,
  );
}
function durationLabel(slots = selectedDurationSlots.value) {
  return slots === 1
    ? "30 minutos"
    : slots === 2
      ? "1 hora"
      : slots === 3
        ? "1 hora y 30 minutos"
        : slots === 4
          ? "2 horas"
          : "";
}
function chooseStart() {
  if (!endOptions.value.includes(endSlot.value)) endSlot.value = "";
}
function statusLabel(status: Booking["status"]) {
  return {
    requested: "Reservada",
    confirmed: "Ocupado",
    declined: "Denegada",
    cancelled: "Cancelada",
    blocked: "Ocupado",
    unavailable: "No disponible",
  }[status];
}
function eventClass(event?: Booking) {
  return event ? `booking-${event.status}${event.is_mine ? " mine" : ""}` : "";
}
function weekEventStyle(event: Booking) {
  const starts = new Date(event.starts_at);
  const ends = new Date(event.ends_at);
  const calendarStart = 8 * 60;
  const calendarEnd = 21 * 60;
  const startTime = madridInput(starts);
  const endTime = madridInput(ends);
  const eventStart = Number(startTime.slice(11, 13)) * 60 + Number(startTime.slice(14, 16));
  const eventEnd = startTime.slice(0, 10) === endTime.slice(0, 10)
    ? Number(madridInput(ends).slice(11, 13)) * 60 + Number(madridInput(ends).slice(14, 16))
    : calendarEnd;
  const visibleStart = Math.max(calendarStart, eventStart);
  const visibleEnd = Math.min(calendarEnd, eventEnd);
  if (visibleEnd <= visibleStart) return { display: "none" };
  return {
    top: `${((visibleStart - calendarStart) / 30) * 14}px`,
    height: `${Math.max(12, ((visibleEnd - visibleStart) / 30) * 14 - 2)}px`,
  };
}
function eventTime(event: Booking) {
  return new Date(event.starts_at).toLocaleTimeString("es-ES", {
    timeZone: MADRID,
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    timeZone: MADRID,
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function isCalendarClass(event: Booking | null) {
  return !!event && !["blocked", "unavailable"].includes(event.status);
}
const calendarItemIsClass = computed(() => isCalendarClass(calendarItem.value));
function monthDays(
  month = cursor.value.getMonth(),
  year = cursor.value.getFullYear(),
) {
  const first = new Date(year, month, 1);
  const gridStart = mondayStart(first);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    addDays(mondayStart(cursor.value), index),
  ),
);

async function load() {
  const version = ++loadVersion;
  loading.value = true;
  availabilityReady.value = false;
  availabilityError.value = "";
  startSlot.value = "";
  endSlot.value = "";
  try {
    const { data } = await api.get("/bookings");
    if (!validAvailability(data)) throw new Error("Invalid availability");
    if (version !== loadVersion) return;
    events.value = data;
    availabilityReady.value = true;
  } catch (err) {
    if (version !== loadVersion) return;
    availabilityError.value = errorMessage(err);
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
async function loadStudents() {
  if (!isAdmin.value) return;
  try {
    students.value = (await api.get("/admin/users")).data.filter((user: User) => user.role !== "admin");
    if (!adminClass.user_id && students.value[0]) adminClass.user_id = students.value[0].id;
  } catch (err) { error.value = `No se pudieron cargar los alumnos. ${errorMessage(err)}`; }
}
function changePeriod(direction: number) {
  cursor.value = shiftCalendarPeriod(cursor.value, view.value, direction);
}
function setView(value: string) {
  view.value = value as CalendarView;
}
function chooseDate(date: Date) {
  selectedDate.value = new Date(date);
  cursor.value = new Date(date);
  view.value = "week";
}
async function reserve() {
  if (!availabilityReady.value || saving.value) return;
  if (isWeekend(selectedDate.value)) {
    error.value = "No se pueden reservar clases los sábados ni los domingos.";
    return;
  }
  if (!startSlot.value || !endSlot.value) {
    error.value = "Selecciona la hora de inicio y de fin.";
    return;
  }
  if (rangeIsUnavailable()) {
    error.value = "El rango elegido ya no está disponible.";
    return;
  }
  const starts = slotStart(startSlot.value);
  error.value = "";
  message.value = "";
  if (!subject.value) {
    error.value = "Selecciona una asignatura para la clase.";
    return;
  }
  saving.value = true;
  try {
    await api.post("/bookings", {
      starts_at: starts.toISOString(),
      subject: subject.value,
      duration_slots: selectedDurationSlots.value,
    });
    subject.value = "";
    startSlot.value = "";
    endSlot.value = "";
    message.value = "Solicitud enviada. La administradora debe confirmarla.";
    await load();
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  } finally { saving.value = false; }
}
function canCancel(booking: Booking) {
  return canCancelBooking(booking.status, booking.starts_at);
}
async function cancel(booking: Booking) {
  if (!canCancel(booking)) { error.value = "Con 24 horas o menos, contacta con la profesora para cancelar."; return; }
  try {
    await api.post(`/bookings/${booking.id}/cancel`);
    await load();
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function decide(id: number, status: "confirmed" | "declined") {
  try {
    error.value = "";
    await api.patch(`/admin/bookings/${id}`, { status });
    calendarItem.value = null;
    message.value = status === "confirmed" ? "Reserva aceptada." : "Reserva denegada.";
    await load();
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function createBlock() {
  error.value = "";
  message.value = "";
  try {
    await api.post("/admin/bookings/block", {
      ...block,
      starts_at: madridToUtc(block.starts_at),
      ends_at: madridToUtc(block.ends_at),
    });
    block.starts_at = "";
    block.ends_at = "";
    block.note = "";
    message.value = "Rango bloqueado en el calendario.";
    await load();
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function removeBlock(booking: Booking) {
  try {
    await api.delete(`/admin/bookings/${booking.id}/block`);
    message.value = "Rango desbloqueado.";
    await load();
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
function openCalendarEvent(event: Booking) {
  if (!isAdmin.value) return;
  calendarItem.value = event;
  if (!isCalendarClass(event)) {
    blockEdit.starts_at = madridInput(event.starts_at);
    blockEdit.ends_at = madridInput(event.ends_at);
    blockEdit.status = event.status;
    blockEdit.note = event.note || "";
    return;
  }
  const starts = new Date(event.starts_at);
  calendarEdit.date = madridInput(starts).slice(0, 10);
  calendarEdit.time = madridInput(starts).slice(11);
  calendarEdit.duration_slots = Math.round(
    (new Date(event.ends_at).getTime() - starts.getTime()) / 1_800_000,
  );
  calendarEdit.subject = event.note || "";
  calendarEdit.admin_comment = event.admin_comment || "";
}
async function saveCalendarClass() {
  const event = calendarItem.value;
  if (!event || !calendarItemIsClass.value) return;
  try {
    const starts = new Date(madridToUtc(`${calendarEdit.date}T${calendarEdit.time}`));
    const { data } = await api.patch(`/admin/classes/${event.id}`, {
      starts_at: starts.toISOString(),
      duration_slots: Number(calendarEdit.duration_slots),
      subject: calendarEdit.subject,
      admin_comment: calendarEdit.admin_comment,
    });
    events.value = events.value.map((current) =>
      current.id === event.id
        ? { ...current, ...data, note: data.topic }
        : current,
    );
    calendarItem.value = null;
    message.value = "Clase actualizada.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function cancelCalendarClass() {
  const event = calendarItem.value;
  if (!event || !calendarItemIsClass.value) return;
  try {
    const { data } = await api.post(`/admin/classes/${event.id}/cancel`);
    events.value = events.value.map((current) =>
      current.id === event.id
        ? { ...current, ...data, note: data.topic }
        : current,
    );
    calendarItem.value = null;
    message.value = "Clase cancelada.";
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
async function unlockCalendarBlock() {
  const event = calendarItem.value;
  if (!event) return;
  await removeBlock(event);
  calendarItem.value = null;
}
async function saveCalendarBlock() {
  const event = calendarItem.value;
  if (!event || calendarItemIsClass.value) return;
  try {
    const { data } = await api.patch(`/admin/bookings/${event.id}/block`, {
      ...blockEdit,
      starts_at: madridToUtc(blockEdit.starts_at),
      ends_at: madridToUtc(blockEdit.ends_at),
    });
    events.value = events.value.map((current) => current.id === event.id ? data : current);
    calendarItem.value = null;
    message.value = "Bloqueo actualizado.";
  } catch (err) { error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err); }
}
async function createAdminClass() {
  try {
    await api.post("/admin/classes", {
      ...adminClass,
      starts_at: madridToUtc(adminClass.starts_at),
    });
    message.value = "Clase creada y confirmada.";
    adminClass.starts_at = "";
    adminClass.subject = "";
    adminClass.admin_comment = "";
    await load();
  } catch (err) {
    error.value = err instanceof Error && /hora (no existe|es ambigua)|fecha y hora válidas/.test(err.message) ? err.message : errorMessage(err);
  }
}
onMounted(() => { void load(); void loadStudents(); });
</script>

<template>
  <section class="page reservations-page">
    <div class="reservation-heading">
      <div>
        <p class="eyebrow">CLASES PARTICULARES</p>
        <h1>Mis reservas</h1>
        <p>Elige una franja de 30 minutos para solicitar una clase.</p>
      </div>
      <div class="calendar-view-toggle">
        <button
          v-for="item in ['week', 'month', 'year']"
          :key="item"
          :class="{ active: view === item }"
          @click="setView(item)"
        >
          {{ item === "week" ? "Semana" : item === "month" ? "Mes" : "Año" }}
        </button>
      </div>
    </div>
    <p v-if="isAdmin && availabilityError" class="alert" role="alert">No se pudo cargar el calendario. {{ availabilityError }} <button type="button" data-testid="retry-availability" @click="load">Reintentar</button></p>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="message" class="success-alert">{{ message }}</p>

    <div class="reservation-layout">
      <section class="calendar-panel">
        <header class="calendar-head">
          <button class="calendar-nav" @click="changePeriod(-1)">‹</button>
          <h2>{{ title }}</h2>
          <button class="calendar-nav" @click="changePeriod(1)">›</button>
        </header>
        <div v-if="view === 'week'" class="week-calendar">
          <div
            v-for="day in weekDays"
            :key="dateKey(day)"
            :class="[
              'week-day',
              {
                selected: sameDay(day, selectedDate),
                today: sameDay(day, madridCalendarDate()),
                weekend: isWeekend(day),
              },
            ]"
            @click="chooseDate(day)"
          >
            <span>{{ weekdays[(day.getDay() + 6) % 7] }}</span
            ><b>{{ day.getDate() }}</b
            ><small
              >{{
                eventsForDay(day).filter(
                  (event) => !["declined", "cancelled"].includes(event.status),
                ).length
              }}
              reservas</small
            >
            <div class="week-timeline">
              <span
                v-for="hour in [8, 10, 12, 14, 16, 18, 20]"
                :key="hour"
                class="timeline-hour"
                :style="{ top: `${(hour - 8) * 28}px` }"
                >{{ hour }}</span
              ><span
                v-for="hour in 13"
                :key="`line-${hour}`"
                class="timeline-line"
                :style="{ top: `${(hour - 1) * 28}px` }"
              ></span
              ><span
                v-for="event in eventsForDay(day).filter(
                  (event) => !['declined', 'cancelled'].includes(event.status),
                )"
                :key="event.id"
                :class="['week-event', eventClass(event)]"
                :style="weekEventStyle(event)"
                @click.stop="openCalendarEvent(event)"
                :title="`${eventTime(event)} · ${statusLabel(event.status)}`"
                >{{ eventTime(event) }} {{ statusLabel(event.status) }}</span
              >
            </div>
          </div>
        </div>
        <div v-else-if="view === 'month'" class="month-calendar">
          <span v-for="day in weekdays" :key="day" class="weekday-label">{{
            day
          }}</span
          ><button
            v-for="day in monthDays()"
            :key="dateKey(day)"
            :class="[
              'month-day',
              {
                muted: day.getMonth() !== cursor.getMonth(),
                selected: sameDay(day, selectedDate),
                today: sameDay(day, madridCalendarDate()),
                weekend: isWeekend(day),
              },
            ]"
            @click="chooseDate(day)"
          >
            <b>{{ day.getDate() }}</b
            ><span
              v-for="event in eventsForDay(day).slice(0, 3)"
              :key="event.id"
              :class="['month-event', eventClass(event)]"
              @click.stop="openCalendarEvent(event)"
              >{{
                event.is_mine
                  ? statusLabel(event.status)
                  : statusLabel(event.status)
              }}</span
            >
          </button>
        </div>
        <div v-else class="year-calendar">
          <button
            v-for="monthIndex in 12"
            :key="monthIndex"
            class="year-month"
            @click="
              cursor = new Date(cursor.getFullYear(), monthIndex - 1, 1);
              view = 'month';
            "
          >
            <b>{{ months[monthIndex - 1] }}</b
            ><span
              >{{
                events.filter((event) => {
                  const date = madridCalendarDate(event.starts_at);
                  return (
                    date.getFullYear() === cursor.getFullYear() &&
                    date.getMonth() === monthIndex - 1 &&
                    event.status !== "declined"
                  );
                }).length
              }}
              reservas</span
            >
          </button>
        </div>
      </section>

      <aside v-if="!isAdmin" class="slots-panel">
        <header>
          <p class="eyebrow">SOLICITAR UNA CLASE</p>
          <h2>{{ selectedLabel }}</h2>
          <p v-if="isWeekend(selectedDate)" class="slots-empty">No se pueden reservar clases los sábados ni los domingos.</p>
          <small>Selecciona un rango de 30 minutos a 2 horas</small
          ><label class="topic-input"
            >Asignatura<select v-model="subject" required>
              <option value="">Selecciona una asignatura…</option>
              <option v-for="item in subjects" :key="item" :value="item">
                {{ item }}
              </option>
            </select></label
          >
          <div class="range-selectors">
            <label
              >Desde<select v-model="startSlot" :disabled="!availabilityReady || saving" @change="chooseStart">
                <option value="">Hora de inicio</option>
                <option v-for="slot in slots" :key="slot" :value="slot">
                  {{ slot }}
                </option>
              </select></label
            ><label
              >Hasta<select v-model="endSlot" :disabled="!availabilityReady || saving || !startSlot">
                <option value="">Hora de fin</option>
                <option v-for="slot in endOptions" :key="slot" :value="slot">
                  {{ slot }}
                </option>
              </select></label
            >
          </div>
          <p
            v-if="selectedDurationSlots"
            :class="['range-summary', { unavailable: rangeIsUnavailable() }]"
          >
            {{
              rangeIsUnavailable()
                ? "Este rango no está disponible"
                : `Vas a reservar ${selectedDurationSlots} ${selectedDurationSlots === 1 ? "clase" : "clases"} · ${durationLabel()}`
            }}
          </p>
          <p class="madrid-time-notice">🕒 Horario de Madrid (España peninsular).</p>
          <button
            class="primary reserve-range"
            :disabled="
              !availabilityReady || saving || isWeekend(selectedDate) || !subject || !selectedDurationSlots || rangeIsUnavailable()
            "
            @click="reserve"
          >
            Reservar rango
          </button>
        </header>
        <p v-if="loading" class="slots-empty">Cargando calendario…</p>
        <p v-else-if="availabilityError" class="alert" role="alert">No se pudo cargar la disponibilidad. {{ availabilityError }} <button type="button" data-testid="retry-availability" @click="load">Reintentar</button></p>
        <div v-else class="availability-note">
          <b>Consulta el calendario semanal</b
          ><span
            >Las franjas ocupadas, reservadas y no disponibles aparecen marcadas
            por color.</span
          >
        </div>
      </aside>
      <aside v-if="isAdmin" class="slots-panel agenda-block-panel">
        <header>
          <p class="eyebrow">GESTIONAR AGENDA</p>
          <h2>
            {{
              agendaAction === "class" ? "Crear una clase" : "Bloquear agenda"
            }}
          </h2>
          <small>Marca los rangos en los que no atenderás clases.</small>
          <label
            >Acción<select v-model="agendaAction">
              <option value="class">Crear una clase</option>
              <option value="block">Bloquear una franja</option>
            </select></label
          >
          <form v-if="agendaAction === 'block'" @submit.prevent="createBlock">
            <label
              >Desde<input
                v-model="block.starts_at"
                type="datetime-local"
                required /></label
            ><label
              >Hasta<input
                v-model="block.ends_at"
                type="datetime-local"
                required /></label
            ><label
              >Estado<select v-model="block.status">
                <option value="blocked">Ocupado</option>
                <option value="unavailable">No disponible</option>
              </select></label
            ><label
              >Nota <small>(opcional)</small
              ><input v-model="block.note" maxlength="300" /></label>
            <p class="madrid-time-notice calendar-time-notice">🕒 Horario de Madrid (España peninsular).</p>
            <button class="primary">Bloquear rango</button>
          </form>
          <form v-else @submit.prevent="createAdminClass">
            <label
              >Alumno<select v-model="adminClass.user_id" required>
                <option
                  v-for="student in students"
                  :key="student.id"
                  :value="student.id"
                >
                  {{ student.name }} · {{ student.email }}
                </option>
              </select></label
            >
            <label
              >Fecha y hora<input
                v-model="adminClass.starts_at"
                type="datetime-local"
                required
            /></label>
            <label
              >Duración<select v-model="adminClass.duration_slots">
                <option :value="1">30 minutos</option>
                <option :value="2">1 hora</option>
                <option :value="3">1 hora y 30 minutos</option>
                <option :value="4">2 horas</option>
              </select></label
            >
            <label
              >Asignatura<select v-model="adminClass.subject" required>
                <option value="">Selecciona una asignatura</option>
                <option v-for="item in subjects" :key="item" :value="item">
                  {{ item }}
                </option>
              </select></label
            >
            <label
              >Comentarios / enlace de Teams<textarea
                v-model="adminClass.admin_comment"
                maxlength="1000"
                rows="3"
                placeholder="Enlace de Teams para la clase..."
              />
            </label>
            <p class="madrid-time-notice calendar-time-notice">🕒 Horario de Madrid (España peninsular).</p>
            <button class="primary">Crear clase</button>
          </form>
        </header>
      </aside>
    </div>

    <section v-if="false" class="student-booking-summary">
      <article class="student-booking-card">
        <div class="booking-card-head">
          <div>
            <p class="eyebrow">PRÓXIMAS CLASES</p>
            <h2>Reservas actuales</h2>
          </div>
          <span>{{ currentBookings.length }}</span>
        </div>
        <p v-if="!currentBookings.length" class="slots-empty">
          Aún no tienes clases reservadas.
        </p>
        <div v-else class="student-booking-list">
          <article v-for="booking in currentBookings" :key="booking.id">
            <time
              ><b>{{
                new Date(booking.starts_at).toLocaleDateString("es-ES", {
                  timeZone: MADRID,
                  day: "2-digit",
                  month: "short",
                })
              }}</b
              ><small>{{
                new Date(booking.starts_at).toLocaleTimeString("es-ES", {
                  timeZone: MADRID,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }}</small></time
            >
            <div>
              <b>{{ booking.note }}</b
              ><small>{{
                booking.status === "requested"
                  ? "Pendiente de confirmación de la administradora"
                  : "Reserva confirmada"
              }}</small
              ><small
                v-if="booking.status === 'confirmed' && !canCancel(booking)"
                class="cancel-help"
                >Para cancelar con 24 horas o menos, contacta con la
                profesora.</small
              >
            </div>
            <div class="booking-actions">
              <span :class="['booking-status', `booking-${booking.status}`]">{{
                statusLabel(booking.status)
              }}</span
              ><button
                v-if="canCancel(booking)"
                class="cancel-booking"
                @click="cancel(booking)"
              >
                Cancelar
              </button>
            </div>
          </article>
        </div>
      </article>
      <article class="student-booking-card">
        <div class="booking-card-head">
          <div>
            <p class="eyebrow">HISTÓRICO</p>
            <h2>Reservas anteriores</h2>
          </div>
          <span>{{ bookingHistory.length }}</span>
        </div>
        <p v-if="!bookingHistory.length" class="slots-empty">
          Aquí aparecerán tus clases pasadas, cancelaciones y solicitudes
          denegadas.
        </p>
        <div v-else class="student-booking-list history">
          <article v-for="booking in bookingHistory" :key="booking.id">
            <time
              ><b>{{
                new Date(booking.starts_at).toLocaleDateString("es-ES", {
                  timeZone: MADRID,
                  day: "2-digit",
                  month: "short",
                })
              }}</b
              ><small>{{
                new Date(booking.starts_at).toLocaleTimeString("es-ES", {
                  timeZone: MADRID,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }}</small></time
            >
            <div>
              <b>{{ booking.note }}</b
              ><small>{{
                booking.status === "declined"
                  ? "Solicitud no confirmada"
                  : booking.status === "cancelled"
                    ? "Reserva cancelada"
                    : booking.status === "requested" ? "Pendiente de confirmación" : "Clase realizada"
              }}</small>
            </div>
            <span :class="['booking-status', `booking-${booking.status}`]">{{
              statusLabel(booking.status)
            }}</span>
            <button v-if="canCancel(booking)" class="cancel-booking" @click="cancel(booking)">Cancelar</button>
          </article>
        </div>
      </article>
    </section>

    <section v-if="false" class="admin-booking-grid">
      <article class="booking-admin-card">
        <p class="eyebrow">SOLICITUDES</p>
        <h2>
          Reservas pendientes <span>{{ requests.length }}</span>
        </h2>
        <p v-if="!requests.length" class="slots-empty">
          No hay solicitudes pendientes.
        </p>
        <div v-else class="request-list">
          <article v-for="request in requests" :key="request.id">
            <div>
              <b>{{ request.user_name }}</b
              ><small>{{
                new Date(request.starts_at).toLocaleString("es-ES", {
                  timeZone: MADRID,
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              }}</small>
            </div>
            <div>
              <button
                class="secondary small"
                @click="decide(request.id, 'declined')"
              >
                Denegar</button
              ><button
                class="primary small"
                @click="decide(request.id, 'confirmed')"
              >
                Aceptar
              </button>
            </div>
          </article>
        </div>
      </article>
      <article class="booking-admin-card">
        <p class="eyebrow">BLOQUEAR AGENDA</p>
        <h2>Ocupado o no disponible</h2>
        <form @submit.prevent="createBlock">
          <label
            >Desde<input
              v-model="block.starts_at"
              type="datetime-local"
              required /></label
          ><label
            >Hasta<input
              v-model="block.ends_at"
              type="datetime-local"
              required /></label
          ><label
            >Estado<select v-model="block.status">
              <option value="blocked">Ocupado</option>
              <option value="unavailable">No disponible</option>
            </select></label
          ><label
            >Nota <small>(opcional)</small
            ><input v-model="block.note" maxlength="300" /></label
          ><button class="primary">Bloquear rango</button>
        </form>
      </article>
    </section>
    <section v-if="isAdmin" class="admin-agenda-tools">
      <article class="panel">
        <h2>
          {{ agendaAction === "class" ? "Crear una clase" : "Bloquear agenda" }}
        </h2>
        <p>
          {{
            agendaAction === "class"
              ? "Reserva una clase confirmada directamente para un alumno."
              : "Marca los rangos en los que no atenderás clases."
          }}
        </p>
        <label
          >Acción<select v-model="agendaAction">
            <option value="class">Crear una clase</option>
            <option value="block">Bloquear una franja</option>
          </select></label
        >
        <form
          v-if="agendaAction === 'class'"
          @submit.prevent="createAdminClass"
        >
          <label
            >Alumno<select v-model="adminClass.user_id" required>
              <option
                v-for="student in students"
                :key="student.id"
                :value="student.id"
              >
                {{ student.name }} · {{ student.email }}
              </option>
            </select></label
          ><label
            >Fecha y hora<input
              v-model="adminClass.starts_at"
              type="datetime-local"
              required /></label
          ><label
            >Duración<select v-model="adminClass.duration_slots">
              <option :value="1">30 minutos</option>
              <option :value="2">1 hora</option>
              <option :value="3">1 hora y 30 minutos</option>
              <option :value="4">2 horas</option>
            </select></label
          ><label
            >Asignatura<select v-model="adminClass.subject" required>
              <option value="">Selecciona una asignatura</option>
              <option v-for="item in subjects" :key="item" :value="item">
                {{ item }}
              </option>
            </select></label
          ><label
            >Comentarios / enlace de Teams<textarea
              v-model="adminClass.admin_comment"
              maxlength="1000"
              rows="3"
              placeholder="Enlace de Teams para la clase..."
            /></label
          ><button class="primary">Crear clase</button>
        </form>
        <form v-else @submit.prevent="createBlock">
          <label
            >Desde<input
              v-model="block.starts_at"
              type="datetime-local"
              required
          /></label>
          <label
            >Hasta<input v-model="block.ends_at" type="datetime-local" required
          /></label>
          <label
            >Estado<select v-model="block.status">
              <option value="blocked">Ocupado</option>
              <option value="unavailable">No disponible</option>
            </select></label
          >
          <label
            >Nota <small>(opcional)</small
            ><input v-model="block.note" maxlength="300"
          /></label>
          <button class="primary">Bloquear rango</button>
        </form>
      </article>
      <article class="panel">
        <h2>Bloqueos activos</h2>
        <p>Desbloquea aquí las franjas que ya no quieras mantener cerradas.</p>
        <div class="block-list">
          <div
            v-for="event in events.filter((event) =>
              ['blocked', 'unavailable'].includes(event.status),
            )"
            :key="event.id"
          >
            <span
              ><b>{{ statusLabel(event.status) }}</b
              ><small>{{ formatDate(event.starts_at) }}</small></span
            ><button class="secondary small" @click="removeBlock(event)">
              Desbloquear
            </button>
          </div>
          <p
            v-if="
              !events.some((event) =>
                ['blocked', 'unavailable'].includes(event.status),
              )
            "
            class="slots-empty"
          >
            No hay bloqueos activos.
          </p>
        </div>
      </article>
    </section>
    <div
      v-if="calendarItem && isAdmin"
      class="modal calendar-manage-modal"
      @click.self="calendarItem = null"
    >
      <form
        v-if="calendarItemIsClass"
        class="calendar-manage-card"
        @submit.prevent="saveCalendarClass"
      >
        <header>
          <div>
            <p class="eyebrow">GESTIONAR CLASE</p>
            <h2>{{ calendarItem.user_name || "Clase particular" }}</h2>
            <p>{{ formatDate(calendarItem.starts_at) }}</p>
            <p v-if="calendarItem.user_id === null">Invitado</p>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Cerrar"
            @click="calendarItem = null"
          >
            ×
          </button>
        </header>
        <p class="slots-empty">Horario peninsular español (Europe/Madrid).</p><p v-if="error" class="alert" role="alert">{{ error }}</p><div class="calendar-manage-fields">
          <label
            >Fecha<input
              v-model="calendarEdit.date"
              type="date"
              required /></label
          ><label
            >Hora de inicio<input
              v-model="calendarEdit.time"
              type="time"
              step="1800"
              required /></label
          ><label
            >Duración<select v-model.number="calendarEdit.duration_slots">
              <option :value="1">30 minutos</option>
              <option :value="2">1 hora</option>
              <option :value="3">1 hora y 30 minutos</option>
              <option :value="4">2 horas</option>
            </select></label
          ><label
            >Asignatura<select v-model="calendarEdit.subject" required>
              <option v-for="item in subjects" :key="item" :value="item">
                {{ item }}
              </option>
            </select></label
          ><label class="calendar-manage-comment"
            >Comentarios / enlace de Teams<textarea
              v-model="calendarEdit.admin_comment"
              rows="5"
              maxlength="1000"
              placeholder="Comparte aquí información o el enlace de Teams."
            />
          </label>
        </div>
        <footer>
          <button v-if="calendarItem.status === 'requested'" type="button" class="secondary" @click="decide(calendarItem.id, 'confirmed')">Aceptar</button>
          <button v-if="calendarItem.status === 'requested'" type="button" class="danger" @click="decide(calendarItem.id, 'declined')">Denegar</button>
          <button type="button" class="danger" @click="cancelCalendarClass">
            Cancelar clase</button
          ><span></span
          ><button type="button" class="secondary" @click="calendarItem = null">
            Cerrar</button
          ><button class="primary">Guardar cambios</button>
        </footer>
      </form>
      <form v-else class="calendar-manage-card block-manage-card" @submit.prevent="saveCalendarBlock">
        <header>
          <div>
            <p class="eyebrow">GESTIONAR BLOQUEO</p>
            <h2>{{ statusLabel(calendarItem.status) }}</h2>
            <p>
              {{ formatDate(calendarItem.starts_at) }} —
              {{ eventTime(calendarItem) }}
            </p>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Cerrar"
            @click="calendarItem = null"
          >
            ×
          </button>
        </header>
        <p class="slots-empty">Horario peninsular español (Europe/Madrid).</p><p v-if="error" class="alert" role="alert">{{ error }}</p><div class="calendar-manage-fields">
          <label>Desde<input v-model="blockEdit.starts_at" type="datetime-local" required /></label>
          <label>Hasta<input v-model="blockEdit.ends_at" type="datetime-local" required /></label>
          <label>Estado<select v-model="blockEdit.status"><option value="blocked">Ocupado</option><option value="unavailable">No disponible</option></select></label>
          <label>Nota <small>(opcional)</small><input v-model="blockEdit.note" maxlength="300" /></label>
        </div>
        <footer>
          <span></span
          ><button type="button" class="secondary" @click="calendarItem = null">Cerrar</button
          ><button type="button" class="danger" @click="unlockCalendarBlock">
            Desbloquear franja
          </button><button class="primary">Guardar cambios</button>
        </footer>
      </form>
    </div>
  </section>
</template>
