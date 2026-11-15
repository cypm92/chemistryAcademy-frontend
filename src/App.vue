<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { protectedBlobUrl } from './services/api'
import { logout, session } from './services/session'
import becienciaLogo from './assets/beciencia-circular.svg'
import LogoViewer from './components/LogoViewer.vue'
import BrandSettings from './components/BrandSettings.vue'
import { branding, loadBranding } from './services/theme'
import { permissionMutationPending, permissionTimeoutToast } from './services/permissionTimeoutToast'

const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
const avatarUrl = ref('')
const logoOpen = ref(false)
const brandSettingsOpen = ref(false)
const removeNavigationGuard = router.beforeEach(() => !permissionMutationPending.value)
const blockedEvents = ['click', 'keydown', 'pointerdown', 'mousedown', 'touchstart', 'change', 'input', 'submit', 'paste', 'drop', 'wheel', 'contextmenu']
function blockBackground(event: Event) { if (permissionMutationPending.value && (!(event.target instanceof Element) || !event.target.closest('.student-access-overlay'))) { event.preventDefault(); event.stopImmediatePropagation() } }
function beforeUnload(event: BeforeUnloadEvent) { if (permissionMutationPending.value && session.user) { event.preventDefault(); event.returnValue = '' } }

watch(() => session.user, async (user) => {
  if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value)
  avatarUrl.value = ''
  if (!user?.has_avatar) return
  try { avatarUrl.value = await protectedBlobUrl('/auth/me/avatar') } catch { /* Avatar no disponible. */ }
}, { immediate: true })

onBeforeUnmount(() => { removeNavigationGuard(); window.removeEventListener('beforeunload', beforeUnload); for (const event of blockedEvents) document.removeEventListener(event, blockBackground, true); if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value) })
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); for (const event of blockedEvents) document.addEventListener(event, blockBackground, { capture: true, passive: false }); void loadBranding() })

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
    <header v-if="session.user && route.path !== '/recursos'" class="topbar">
      <button class="brand" type="button" :aria-label="session.user.role === 'admin' ? 'Editar identidad visual' : 'Ampliar logo de BeCiencia Academia'" @click="handleBrandClick">
        <img class="brand-logo" :src="branding.logoUrl || becienciaLogo" alt="" />
      </button>
      <nav>
        <RouterLink to="/library">Biblioteca</RouterLink>
        <RouterLink to="/reservations">Reservas</RouterLink>
        <RouterLink to="/classes">Clases</RouterLink>
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
      <button class="mobile-logout" type="button" @click="leave"><span aria-hidden="true">↪</span> Cerrar sesión</button>
    </header>
    <main><RouterView /></main>
    <div v-if="permissionTimeoutToast" class="permission-timeout-toast" role="alert">{{ permissionTimeoutToast }}</div>
    <LogoViewer v-if="logoOpen" :logo-src="branding.logoUrl" @close="logoOpen = false" />
    <BrandSettings v-if="brandSettingsOpen" @close="brandSettingsOpen = false" />
  </div>
</template>

<style scoped>
.permission-timeout-toast { position: fixed; right: 1rem; bottom: 1rem; z-index: 100000; padding: 1rem; border-radius: 0.5rem; background: var(--danger); color: white; box-shadow: 0 4px 16px #0004; }
</style>
