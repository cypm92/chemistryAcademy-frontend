<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '../services/api'
import { saveSession } from '../services/session'

const router = useRouter()
const mode = ref<'login' | 'register'>('login')
const form = ref({ name: '', email: '', password: '' })
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true; error.value = ''
  try {
    if (mode.value === 'register') {
      await api.post('/auth/register', form.value)
      mode.value = 'login'
    } else {
      const { data } = await api.post('/auth/login', { email: form.value.email, password: form.value.password })
      saveSession(data.access_token, data.user)
      router.push(data.user.role === 'admin' ? '/admin' : '/')
    }
  } catch (e) { error.value = errorMessage(e) }
  finally { busy.value = false }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-intro">
      <div class="brand light"><span class="brand-mark">Å</span><span><b>ÁTOMO</b><small>Academia de química</small></span></div>
      <p class="eyebrow">APRENDE · EXPERIMENTA · COMPRENDE</p>
      <h1>La química deja de ser difícil cuando puedes <em>verla.</em></h1>
      <p>Clases, explicaciones y recursos preparados para que avances a tu ritmo.</p>
      <div class="molecule">H<sub>2</sub>O <span>·</span> CO<sub>2</sub> <span>·</span> NaCl</div>
    </div>
    <form class="auth-card" @submit.prevent="submit">
      <p class="eyebrow">{{ mode === 'login' ? 'BIENVENIDA DE NUEVO' : 'NUEVA CUENTA' }}</p>
      <h2>{{ mode === 'login' ? 'Continúa aprendiendo' : 'Únete a la academia' }}</h2>
      <p>{{ mode === 'login' ? 'Accede a tus clases y materiales.' : 'La administradora activará tus materiales.' }}</p>
      <label v-if="mode === 'register'">Nombre<input v-model="form.name" required minlength="2" /></label>
      <label>Email<input v-model="form.email" type="email" required placeholder="tu@email.com" /></label>
      <label>Contraseña<input v-model="form.password" type="password" required minlength="8" /></label>
      <p v-if="error" class="alert">{{ error }}</p>
      <button class="primary" :disabled="busy">{{ busy ? 'Un momento…' : mode === 'login' ? 'Entrar en mi espacio' : 'Crear cuenta' }}</button>
      <button type="button" class="link-button" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '¿Primera vez? Crear cuenta de invitado' : 'Ya tengo cuenta' }}
      </button>
    </form>
  </section>
</template>

