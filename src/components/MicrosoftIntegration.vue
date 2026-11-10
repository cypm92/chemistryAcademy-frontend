<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../services/api'

type Status = { configured: boolean; connected: boolean; account_label: string | null; needs_reconnect: boolean }
const status = ref<Status | null>(null)
const busy = ref(false)
const error = ref('')
const message = ref('')
async function refresh() {
  const { data } = await api.get('/admin/integrations/microsoft')
  status.value = data
}
const simulationEnabled = (import.meta.env.DEV || import.meta.env.VITE_LOCAL_SANDBOX_BUILD === 'true') && import.meta.env.VITE_MICROSOFT_SIMULATED === 'true' &&
  window.location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
async function connect() {
  busy.value = true; error.value = ''; message.value = ''
  try {
    const { data } = await api.post('/admin/integrations/microsoft/start')
    const url = new URL(data.authorization_url)
    const microsoft = url.protocol === 'https:' && url.hostname === 'login.microsoftonline.com' && !url.port
    const simulated = simulationEnabled && url.origin === window.location.origin &&
      /^\/fake\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/oauth2\/v2\.0\/authorize$/i.test(url.pathname)
    if (url.username || url.password || (!microsoft && !simulated)) throw new Error('URL inválida')
    window.location.assign(url.href)
  } catch { error.value = 'No se pudo iniciar la conexión con Microsoft.' } finally { busy.value = false }
}
async function disconnect() {
  if (!window.confirm('¿Desconectar la cuenta de Microsoft? Esta acción solo elimina la credencial almacenada en esta aplicación; no revoca los permisos en Microsoft. Puedes revocarlos directamente en Microsoft. Una operación en curso puede finalizar después de la desconexión. Después de desconectar, solo podrás reconectar con la misma cuenta de Microsoft.')) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    await api.post('/admin/integrations/microsoft/disconnect'); await refresh()
    if (status.value?.connected || status.value?.needs_reconnect) throw new Error('Desconexión no confirmada')
    message.value = 'Cuenta de Microsoft desconectada.'
  }
  catch { error.value = 'No se pudo desconectar o verificar la cuenta de Microsoft.' } finally { busy.value = false }
}
onMounted(async () => {
  const url = new URL(window.location.href)
  const callback = url.searchParams.get('microsoft')
  if (callback) { url.searchParams.delete('microsoft'); window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash) }
  busy.value = true
  try {
    await refresh()
    if (callback === 'connected') {
      if (status.value?.connected && !status.value.needs_reconnect) message.value = 'Cuenta de Microsoft conectada.'
      else error.value = 'No se pudo confirmar la conexión con Microsoft.'
    } else if (callback === 'error') error.value = 'No se pudo conectar la cuenta de Microsoft.'
  } catch { error.value = 'No se pudo consultar el estado de Microsoft.' } finally { busy.value = false }
})
</script>

<template>
  <section class="panel microsoft-panel" aria-labelledby="microsoft-heading">
    <h2 id="microsoft-heading">Microsoft Teams</h2>
    <p v-if="simulationEnabled" role="status"><b>Simulación local de Microsoft activada.</b></p>
    <p>Conecta la cuenta de la profesora para crear enlaces de reunión para las clases.</p>
    <p v-if="!status && busy" role="status">Consultando conexión…</p>
    <template v-if="status">
      <p v-if="!status.configured"><b>No configurada.</b> La integración de Microsoft no está disponible.</p>
      <p v-else-if="status.needs_reconnect"><b>Es necesario reconectar.</b> {{ status.account_label || '' }}</p>
      <p v-else-if="status.connected"><b>Conectada.</b> {{ status.account_label || '' }}</p>
      <p v-else><b>Desconectada.</b></p>
      <div class="microsoft-actions">
        <button v-if="status.configured && (!status.connected || status.needs_reconnect)" type="button" class="primary" :disabled="busy" @click="connect">{{ status.needs_reconnect ? 'Reconectar' : 'Conectar' }}</button>
        <button v-if="status.connected || status.needs_reconnect" type="button" class="secondary" :disabled="busy" @click="disconnect">Desconectar</button>
      </div>
    </template>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <p v-if="message" class="success-alert" role="status">{{ message }}</p>
  </section>
</template>
