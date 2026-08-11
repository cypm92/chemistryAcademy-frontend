<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { protectedBlobUrl } from './services/api'
import { logout, session } from './services/session'

const router = useRouter()
const menuOpen = ref(false)
const avatarUrl = ref('')

watch(() => session.user, async (user) => {
  if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value)
  avatarUrl.value = ''
  if (!user?.has_avatar) return
  try { avatarUrl.value = await protectedBlobUrl('/auth/me/avatar') } catch { /* Avatar no disponible. */ }
}, { immediate: true })

onBeforeUnmount(() => { if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value) })

function leave() {
  menuOpen.value = false
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <header v-if="session.user" class="topbar">
      <RouterLink to="/" class="brand">
        <span class="brand-mark">Á</span>
        <span><b>ÁTOMO</b><small>Academia de química</small></span>
      </RouterLink>
      <nav>
        <RouterLink to="/">Mi biblioteca</RouterLink>
        <RouterLink to="/reservations">Mis reservas</RouterLink>
        <RouterLink to="/classes">Mis clases</RouterLink>
        <RouterLink v-if="session.user.role === 'admin'" to="/students">Alumnos</RouterLink>
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
  </div>
</template>
