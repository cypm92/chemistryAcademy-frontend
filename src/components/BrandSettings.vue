<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api, errorMessage } from '../services/api'
import { applyThemeColor, branding, loadBranding } from '../services/theme'
import defaultLogo from '../assets/beciencia-circular.svg'
import LogoViewer from './LogoViewer.vue'
import HomeSettings from './HomeSettings.vue'

const emit = defineEmits<{ close: [] }>()
const color = ref(branding.value.primaryColor)
const logoFile = ref<File | null>(null)
const localPreview = ref('')
const saving = ref(false)
const error = ref('')
const notice = ref('')
const logoPreviewOpen = ref(false)
const homeSettingsOpen = ref(false)

function onKeydown(event: KeyboardEvent) { if (event.key === 'Escape') emit('close') }
function selectLogo(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  logoFile.value = file
  localPreview.value = file ? URL.createObjectURL(file) : ''
}
async function save() {
  saving.value = true; error.value = ''; notice.value = ''
  try {
    await api.patch('/admin/theme', { primary_color: color.value })
    applyThemeColor(color.value)
    if (logoFile.value) {
      const body = new FormData()
      body.append('file', logoFile.value)
      await api.put('/admin/branding/logo', body)
    }
    await loadBranding()
    logoFile.value = null
    notice.value = 'Identidad visual actualizada.'
  } catch (cause) { error.value = errorMessage(cause) }
  finally { saving.value = false }
}

onMounted(() => { document.addEventListener('keydown', onKeydown); document.body.classList.add('modal-open') })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeydown); document.body.classList.remove('modal-open'); if (localPreview.value) URL.revokeObjectURL(localPreview.value) })
</script>

<template>
  <div class="modal branding-modal" role="dialog" aria-modal="true" aria-label="Identidad visual" @click.self="emit('close')">
    <form class="branding-card" @submit.prevent="save">
      <header><div><p class="eyebrow">IDENTIDAD VISUAL</p><h2>BeCiencia</h2><p>Personaliza el logo y el color corporativo de toda la academia.</p></div><button class="icon-button" type="button" aria-label="Cerrar" @click="emit('close')">×</button></header>
      <div class="branding-body">
        <div class="branding-logo-preview"><img :src="localPreview || branding.logoUrl || defaultLogo" alt="Vista previa del logo" /></div>
        <label class="branding-upload">Cambiar logo<input type="file" accept="image/jpeg,image/png,image/webp" @change="selectLogo" /><span>JPG, PNG o WebP · máximo 5 MB</span></label>
        <label class="color-field">Color corporativo<input v-model="color" type="color" @input="applyThemeColor(color)" /><span>{{ color }}</span></label>
        <div class="branding-color-preview" :style="{ backgroundColor: color }"><b>BeCiencia</b><span>Muestra del color</span></div>
        <button class="branding-preview-button secondary" type="button" @click="logoPreviewOpen = true">Ver logo ampliado</button>
        <button class="branding-preview-button secondary" type="button" @click="homeSettingsOpen = true">Editar portada pública</button>
        <p v-if="error" class="alert">{{ error }}</p><p v-if="notice" class="success-alert">{{ notice }}</p>
      </div>
      <footer><button class="secondary" type="button" @click="emit('close')">Cerrar</button><button class="primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button></footer>
    </form>
    <LogoViewer v-if="logoPreviewOpen" :logo-src="localPreview || branding.logoUrl || defaultLogo" @close="logoPreviewOpen = false" />
    <HomeSettings v-if="homeSettingsOpen" @close="homeSettingsOpen = false" />
  </div>
</template>
