<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '../services/api'
import { saveSession } from '../services/session'
import becienciaLogo from '../assets/beciencia-circular.svg'
import LogoViewer from '../components/LogoViewer.vue'
import { branding, loadBranding } from '../services/theme'
import LegalConsent from '../components/LegalConsent.vue'

const router = useRouter()
const route = useRoute()
const mode = ref<'login' | 'register'>(route.query.mode === 'register' ? 'register' : 'login')
const showPassword = ref(false)
watch(mode, () => { showPassword.value = false })
const form = ref({ name: '', email: '', password: '' })
const busy = ref(false)
const error = ref('')
const logoOpen = ref(false)

onMounted(() => { void loadBranding() })

async function submit() {
  busy.value = true; error.value = ''
  try {
    if (mode.value === 'register') {
      await api.post('/auth/register', form.value)
      mode.value = 'login'
    } else {
      const { data } = await api.post('/auth/login', { email: form.value.email, password: form.value.password })
      saveSession(data.access_token, data.user)
      router.push(data.user.role === 'admin' ? '/admin' : '/library')
    }
  } catch (e) { error.value = errorMessage(e) }
  finally { busy.value = false }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-intro">
      <button class="brand light" type="button" aria-label="Ampliar logo de BeCiencia Academia" @click="logoOpen = true">
        <img class="brand-logo" :src="branding.logoUrl || becienciaLogo" alt="" />
      </button>
      <p class="eyebrow">APRENDE · EXPERIMENTA · COMPRENDE</p>
      <h1>La química deja de ser difícil cuando puedes <em>verla.</em></h1>
      <p>Clases, explicaciones y recursos preparados para que avances a tu ritmo.</p>
      <div class="molecule">H<sub>2</sub>O <span>·</span> CO<sub>2</sub> <span>·</span> NaCl</div>
    </div>
    <form class="auth-card" @submit.prevent="submit">
      <p class="eyebrow">{{ mode === 'login' ? 'BIENVENIDA DE NUEVO' : 'NUEVA CUENTA' }}</p>
      <h2>{{ mode === 'login' ? 'Continúa aprendiendo' : 'Únete a la academia' }}</h2>
      <p>{{ mode === 'login' ? 'Accede a tus clases y materiales.' : 'La administradora activará tus materiales.' }}</p>
      <p v-if="route.query.reason === 'session-expired'" class="auth-session-notice">Tu sesión ha caducado. Inicia sesión de nuevo para continuar.</p>
      <label v-if="mode === 'register'">Nombre<input v-model="form.name" required minlength="2" /></label>
      <label>Email<input v-model="form.email" type="email" required placeholder="tu@email.com" /></label>
      <label>Contraseña<span class="password-field"><input v-model="form.password" :type="showPassword ? 'text' : 'password'" required minlength="8" /><button v-if="mode === 'register'" type="button" class="password-toggle" :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="showPassword" d="M4 4l16 16"/></svg></button></span></label>
      <LegalConsent v-if="mode === 'register'" purpose="crear y gestionar mi cuenta de alumno" />
      <label v-if="mode === 'register'" class="legal-consent"><input type="checkbox" required /><span>Confirmo que tengo al menos 14 años o que actúo con autorización de mi madre, padre o tutor legal.</span></label>
      <p v-if="error" class="alert">{{ error }}</p>
      <button class="primary" :disabled="busy">{{ busy ? 'Un momento…' : mode === 'login' ? 'Entrar en mi espacio' : 'Crear cuenta' }}</button>
      <button type="button" class="link-button" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '¿Primera vez? Crear cuenta de invitado' : 'Ya tengo cuenta' }}
      </button>
      <RouterLink class="auth-back-home" to="/">← Volver a la página principal</RouterLink>
    </form>
    <LogoViewer v-if="logoOpen" :logo-src="branding.logoUrl" @close="logoOpen = false" />
  </section>
</template>

<style scoped>
.password-field { position: relative; display: flex; align-items: center; }
.password-field input { width: 100%; padding-right: 44px; }
.password-toggle { position: absolute; right: 8px; display: grid; place-items: center; border: 0; background: transparent; color: var(--green); padding: 5px; cursor: pointer; }
.auth-card :deep(.legal-consent) { font-size: 14px !important; line-height: 1.5; color: var(--ink) !important; }
</style>
