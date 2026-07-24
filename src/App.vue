<script setup lang="ts">
import { useRouter } from 'vue-router'
import { logout, session } from './services/session'

const router = useRouter()
function leave() {
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <header v-if="session.user" class="topbar">
      <RouterLink to="/" class="brand">
        <span class="brand-mark">Å</span>
        <span><b>ÁTOMO</b><small>Academia de química</small></span>
      </RouterLink>
      <nav>
        <RouterLink to="/">Mi biblioteca</RouterLink>
        <RouterLink v-if="session.user.role === 'admin'" to="/admin">Administración</RouterLink>
      </nav>
      <div class="account">
        <span><b>{{ session.user.name }}</b><small>{{ session.user.role === 'admin' ? 'Administradora' : 'Estudiante' }}</small></span>
        <button class="icon-button" title="Cerrar sesión" @click="leave">↗</button>
      </div>
    </header>
    <main><RouterView /></main>
  </div>
</template>

