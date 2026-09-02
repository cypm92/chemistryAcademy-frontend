<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { protectedBlobUrl } from './services/api'
import { logout, session } from './services/session'
import becienciaLogo from './assets/beciencia-circular.svg'
import LogoViewer from './components/LogoViewer.vue'
import BrandSettings from './components/BrandSettings.vue'
import { branding, loadBranding } from './services/theme'

const router = useRouter()
const menuOpen = ref(false)
const avatarUrl = ref('')
const logoOpen = ref(false)
const brandSettingsOpen = ref(false)

watch(() => session.user, async (user) => {
  if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value)
  avatarUrl.value = ''
  if (!user?.has_avatar) return
  try { avatarUrl.value = await protectedBlobUrl('/auth/me/avatar') } catch { /* Avatar no disponible. */ }
}, { immediate: true })

onBeforeUnmount(() => { if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value) })
onMounted(() => { void loadBranding() })

function handleBrandClick() {
  if (session.user?.role === 'admin') brandSettingsOpen.value = true
  else logoOpen.value = true
}

function leave() {
  menuOpen.value = false
  logout()
  router.push('/')
}
</script>

<template>
  <div class="app-shell">
    <header v-if="session.user" class="topbar">
      <button class="brand" type="button" :aria-label="session.user.role === 'admin' ? 'Editar identidad visual' : 'Ampliar logo de BeCiencia Academia'" @click="handleBrandClick">
        <img class="brand-logo" :src="branding.logoUrl || becienciaLogo" alt="" />
      </button>
      <nav>
        <RouterLink to="/library">Mi biblioteca</RouterLink>
        <RouterLink to="/reservations">Mis reservas</RouterLink>
        <RouterLink to="/classes">Mis clases</RouterLink>
        <RouterLink v-if="session.user.role === 'admin'" to="/admin">Administración</RouterLink>
      </nav>
      <div class="account-menu">
        <button class="account" type="button" :aria-expanded="menuOpen" aria-haspopup="menu" @click="menuOpen = !menuOpen">
          <span><b>{{ session.user.name }}</b><small>{{ session.user.role === 'admin' ? 'Administradora' : 'Estudiante' }}</small></span>
          <span class="profile-avatar"><img v-if="avatarUrl" :src="avatarUrl" alt="Foto de perfil" /><b v-else>{{ session.user.name.slice(0, 1).toUpperCase() }}</b></span>
          <span class="account-chevron">⌄</span>
        </button>
        <div v-if="menuOpen" class="account-dropdown" role="menu">
          <RouterLink to="/profile" role="menuitem" @click="menuOpen = false">Mi perfil</RouterLink>
          <button type="button" role="menuitem" @click="leave">Cerrar sesión</button>
        </div>
      </div>
    </header>
    <main><RouterView /></main>
    <LogoViewer v-if="logoOpen" :logo-src="branding.logoUrl" @close="logoOpen = false" />
    <BrandSettings v-if="brandSettingsOpen" @close="brandSettingsOpen = false" />
  </div>
</template>
