<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { api } from '../services/api'
import TeamsModal from './TeamsModal.vue'

const props = defineProps<{ classId: number; revision?: number | null; status: string; disabled: boolean }>()
const emit = defineEmits<{ reviewed: []; conflict: [] }>()
const open = ref(false), busy = ref(false), checked = ref(false), message = ref('')
const opener = ref<HTMLButtonElement | null>(null)
const canReview = computed(() => !props.disabled && !busy.value && ['confirmed', 'cancelled'].includes(props.status) && typeof props.revision === 'number' && Number.isSafeInteger(props.revision) && props.revision >= 0)
function show() { if (!canReview.value) return; checked.value = false; message.value = ''; open.value = true }
function close() { if (busy.value) return; open.value = false; nextTick(() => opener.value?.focus()) }
async function review() {
  if (!canReview.value || !checked.value) return
  busy.value = true; message.value = ''
  try {
    await api.post(`/admin/classes/${props.classId}/teams/patch-review`, { expected_revision: props.revision, acknowledge_checked: true, acknowledge_late_risk: true })
    busy.value = false; open.value = false; emit('reviewed')
  } catch (error: unknown) {
    busy.value = false
    if ((error as { response?: { status?: number } })?.response?.status === 409) { open.value = false; emit('conflict') }
    else message.value = 'No se pudo marcar como revisada. Comprueba la conexión y vuelve a intentarlo.'
  }
}
</script>
<template>
  <button ref="opener" type="button" :disabled="!canReview" @click="show">He comprobado Outlook</button>
  <TeamsModal v-if="open" :labelledby="`review-title-${classId}`" @close="close">
        <h2 :id="`review-title-${classId}`">Confirmar revisión en Outlook</h2>
        <p v-if="status === 'confirmed'">Comprueba que el evento y su horario coinciden con la clase actual en Outlook.</p>
        <p v-else>Comprueba en Outlook que el evento de esta clase cancelada no existe.</p>
        <p>Una solicitud anterior podría terminar más tarde y cambiar el calendario. Marcar como revisada no crea ni elimina eventos automáticamente.</p>
        <label><input v-model="checked" type="checkbox" :disabled="busy"> He comprobado Outlook y acepto el riesgo de cambios tardíos.</label>
        <p v-if="message" role="alert">{{ message }}</p>
        <div><button type="button" :disabled="busy" @click="close">Cancelar</button>
        <button type="button" :disabled="!canReview || !checked" @click="review">{{ busy ? 'Guardando…' : 'Marcar como revisada' }}</button></div>
  </TeamsModal>
</template>
