import { createRouter, createWebHistory } from 'vue-router'
import LoginView from './views/LoginView.vue'
import LibraryView from './views/LibraryView.vue'
import AdminView from './views/AdminView.vue'
import ProfileView from './views/ProfileView.vue'
import ReservationsView from './views/ReservationsView.vue'
import ClassesView from './views/ClassesView.vue'
import HomeView from './views/HomeView.vue'
import { session } from './services/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView, meta: { public: true } },
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/library', component: LibraryView },
    { path: '/admin', component: AdminView, meta: { admin: true } },
    { path: '/students', redirect: '/admin' },
    { path: '/profile', component: ProfileView },
    { path: '/reservations', component: ReservationsView },
    { path: '/classes', component: ClassesView },
  ],
})

router.beforeEach((to) => {
  if (to.path === '/' && localStorage.getItem('academy_token')) return session.user?.role === 'admin' ? '/admin' : '/library'
  if (!to.meta.public && !localStorage.getItem('academy_token')) return '/login'
  if (to.meta.admin && session.user?.role !== 'admin') return '/library'
  if (to.path === '/login' && localStorage.getItem('academy_token')) return session.user?.role === 'admin' ? '/admin' : '/library'
})

export default router
