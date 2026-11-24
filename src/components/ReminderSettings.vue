<script setup lang="ts">
import { ref } from 'vue'
import { api, errorMessage } from '../services/api'
import AccessibleDialog from './AccessibleDialog.vue'
const dialog = ref<InstanceType<typeof AccessibleDialog> | null>(null)
const open = ref(false)
const busy = ref(false)
const loaded = ref(false)
const preset = ref('1440')
const minutes = ref<number | string>(1440)
const error = ref('')
const message = ref('')
function setValue(value: number) {
  minutes.value = value
  preset.value = [1440, 360, 120, 30].includes(value) ? String(value) : 'custom'
}
async function show() {
  open.value = true; busy.value = true; loaded.value = false; error.value = ''; message.value = ''
  try { const { data } = await api.get('/admin/notification-settings'); setValue(data.reminder_interval_minutes); loaded.value = true }
  catch (e) { error.value = errorMessage(e) }
  finally { busy.value = false }
}
async function save() {
  if (busy.value || !loaded.value) return
  const value = preset.value === 'custom' ? Number(minutes.value) : Number(preset.value)
  if ((preset.value === 'custom' && minutes.value === '') || !Number.isInteger(value) || value < 1 || value > 525600) { error.value = 'El intervalo debe ser un número entero entre 1 y 525600 minutos.'; return }
  dialog.value?.focusStable()
  busy.value = true; error.value = ''
  try {
    const { data } = await api.patch('/admin/notification-settings', { reminder_interval_minutes: value })
    setValue(data.reminder_interval_minutes); open.value = false; message.value = 'Configuración de alertas guardada.'
  } catch (e) { error.value = errorMessage(e) }
  finally { busy.value = false }
}
</script>
<template>
  <div class="reminder-settings">
    <button type="button" class="reminder-trigger" @click="show"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.86 3.22-.08-.02a1.7 1.7 0 0 0-1.8.64l-.05.07h-3.72l-.04-.07a1.7 1.7 0 0 0-1.81-.64l-.08.02-1.86-3.22.06-.06A1.7 1.7 0 0 0 8.9 15l-.08-.02v-3.72l.08-.02a1.7 1.7 0 0 0 .34-1.88l-.06-.06 1.86-3.22.08.02a1.7 1.7 0 0 0 1.81-.64L12.97 5h3.72l.04.07a1.7 1.7 0 0 0 1.81.64l.08-.02 1.86 3.22-.06.06a1.7 1.7 0 0 0-.34 1.88l.08.02v3.72Z" transform="translate(-1.5 -1)"/></svg><span>Alertas email</span></button>
    <p v-if="message" role="status">{{ message }}</p>
    <AccessibleDialog v-if="open" ref="dialog" title="Alertas email" :busy="busy" @close="open = false">
      <p>Los recordatorios se envían por correo a estudiantes con una clase confirmada.</p>
      <p v-if="busy" role="status">Procesando…</p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <form v-if="loaded" novalidate @submit.prevent="save">
        <label>Antelación del recordatorio<select v-model="preset" data-initial-focus :disabled="busy"><option value="1440">24 horas</option><option value="360">6 horas</option><option value="120">2 horas</option><option value="30">30 minutos</option><option value="custom">Personalizada</option></select></label>
        <label v-if="preset === 'custom'">Intervalo personalizado (minutos)<input v-model.number="minutes" type="number" min="1" max="525600" step="1" :disabled="busy" /><small>Entre 1 y 525600 minutos.</small></label>
        <button type="submit" class="primary" :disabled="busy">Guardar</button>
      </form>
    </AccessibleDialog>
  </div>
</template>
