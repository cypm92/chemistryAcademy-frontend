<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '../services/api'

type PublicBooking = { id: number; starts_at: string; ends_at: string; status: string }
const emit = defineEmits<{ close: [] }>()
const events = ref<PublicBooking[]>([]); const selectedDate = ref(new Date()); const start = ref(''); const name = ref(''); const email = ref(''); const subject = ref(''); const error = ref(''); const message = ref(''); const saving = ref(false)
const subjects = ['Química ESO', 'Química Bachiller', 'Química Universidad', 'Física ESO', 'Física Bachiller', 'Matemáticas ESO', 'Matemáticas Bachiller']
const slots = Array.from({ length: 24 }, (_, index) => `${String(9 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
const days = computed(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + index); return date }))
function key(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function label(date: Date) { return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) }
function dateFor(slot: string) { const [hour, minute] = slot.split(':').map(Number); const date = new Date(selectedDate.value); date.setHours(hour, minute, 0, 0); return date }
function available(slot: string) { const starts = dateFor(slot); const ends = new Date(starts.getTime() + 60 * 60 * 1000); return starts > new Date() && !events.value.some(event => new Date(event.starts_at) < ends && new Date(event.ends_at) > starts) }
async function load() { try { events.value = (await api.get('/public/bookings')).data } catch (cause) { error.value = errorMessage(cause) } }
async function reserve() { if (!start.value || !subject.value) { error.value = 'Elige una asignatura y una hora disponible.'; return }; saving.value = true; error.value = ''; try { await api.post('/public/trial-bookings', { name: name.value, email: email.value, subject: subject.value, starts_at: dateFor(start.value).toISOString() }); message.value = 'Tu clase de prueba queda solicitada. Te confirmaremos la cita muy pronto.'; start.value = ''; await load() } catch (cause) { error.value = errorMessage(cause) } finally { saving.value = false } }
onMounted(load)
</script>
<template>
  <div class="modal trial-booking-modal" role="dialog" aria-modal="true" aria-label="Reservar clase de prueba" @click.self="emit('close')"><section class="trial-booking-card"><header><div><p class="eyebrow">CLASE DE PRUEBA GRATUITA</p><h2>Elige día y hora.</h2><p>La sesión dura una hora y se reserva en la misma agenda que las clases de la academia.</p></div><button class="icon-button" type="button" aria-label="Cerrar" @click="emit('close')">×</button></header><div class="trial-booking-body"><div class="trial-days"><button v-for="day in days" :key="key(day)" type="button" :class="{ active: key(day) === key(selectedDate) }" @click="selectedDate = day; start = ''">{{ label(day) }}</button></div><section><p class="eyebrow">HORAS DISPONIBLES · 1 HORA</p><div class="trial-slots"><button v-for="slot in slots" :key="slot" type="button" :disabled="!available(slot)" :class="{ active: start === slot }" @click="start = slot">{{ slot }}</button></div></section><form class="trial-form" @submit.prevent="reserve"><label>Nombre<input v-model="name" required minlength="2" /></label><label>Correo electrónico<input v-model="email" type="email" required /></label><label>Asignatura<select v-model="subject" required><option value="">Selecciona una asignatura…</option><option v-for="item in subjects" :key="item" :value="item">{{ item }}</option></select></label><p v-if="error" class="alert">{{ error }}</p><p v-if="message" class="success-alert">{{ message }}</p><button class="primary" :disabled="saving || !!message">{{ saving ? 'Reservando…' : 'Reservar clase de prueba' }}</button></form></div></section></div>
</template>
