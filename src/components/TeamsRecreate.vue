<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { api } from '../services/api'
import TeamsModal from './TeamsModal.vue'

const props = defineProps<{ classId: number; revision?: number | null; disabled: boolean }>()
const emit = defineEmits<{ requested: []; conflict: [] }>()
const open = ref(false), busy = ref(false), message = ref('')
const opener = ref<HTMLButtonElement | null>(null)
const canRecreate = computed(() => !props.disabled && typeof props.revision === 'number' && Number.isInteger(props.revision) && props.revision >= 0)
function show() { if (!canRecreate.value) return; message.value = ''; open.value = true }
function close() { if (busy.value) return; open.value = false; nextTick(() => opener.value?.focus()) }
async function recreate() {
  if (busy.value || !canRecreate.value) return
  busy.value = true; message.value = ''
  try {
    await api.post(`/admin/classes/${props.classId}/teams/recreate`, { expected_revision: props.revision, confirm_absent: true })
    busy.value = false; close(); emit('requested')
  } catch (error: unknown) {
    busy.value = false
    if ((error as { response?: { status?: number } })?.response?.status === 409) { close(); emit('conflict') }
    else message.value = 'No se pudo solicitar la creación. Comprueba la conexión o la cuenta de Microsoft y vuelve a intentarlo.'
  }
}
</script>
<template>
  <button ref="opener" type="button" :disabled="!canRecreate" @click="show">Comprobar Outlook</button>
  <TeamsModal v-if="open" :labelledby="`recreate-title-${classId}`" @close="close">
        <h2 :id="`recreate-title-${classId}`">Comprobar Outlook antes de crear otra reunión</h2>
        <p>Comprueba en Outlook que no existe el evento de esta clase. Solo entonces solicita un nuevo intento automático.</p>
        <p>Puede haber duplicados si una solicitud anterior termina más tarde. Revisa Outlook también después del nuevo intento.</p>
        <p v-if="message" role="alert">{{ message }}</p>
        <button type="button" :disabled="busy" @click="close">Cancelar</button>
        <button type="button" :disabled="busy" @click="recreate">{{ busy ? 'Solicitando…' : 'He comprobado que no existe; crear de nuevo' }}</button>
  </TeamsModal>
</template>
