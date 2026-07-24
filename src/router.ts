import { createRouter, createWebHistory } from 'vue-router'
import LoginView from './views/LoginView.vue'
import LibraryView from './views/LibraryView.vue'
import AdminView from './views/AdminView.vue'
import { session } from './services/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/', component: LibraryView },
    { path: '/admin', component: AdminView, meta: { admin: true } },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.public && !localStorage.getItem('academy_token')) return '/login'
  if (to.meta.admin && session.user?.role !== 'admin') return '/'
  if (to.path === '/login' && localStorage.getItem('academy_token')) return '/'
})

export default router

