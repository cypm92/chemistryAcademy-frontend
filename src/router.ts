import { createRouter, createWebHistory } from 'vue-router'
import LoginView from './views/LoginView.vue'
import LibraryView from './views/LibraryView.vue'
import AdminView from './views/AdminView.vue'
import StudentsView from './views/StudentsView.vue'
import ProfileView from './views/ProfileView.vue'
import ReservationsView from './views/ReservationsView.vue'
import ClassesView from './views/ClassesView.vue'
import { session } from './services/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/', component: LibraryView },
    { path: '/admin', component: AdminView, meta: { admin: true } },
    { path: '/students', component: StudentsView, meta: { admin: true } },
    { path: '/profile', component: ProfileView },
    { path: '/reservations', component: ReservationsView },
    { path: '/classes', component: ClassesView },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.public && !localStorage.getItem('academy_token')) return '/login'
  if (to.meta.admin && session.user?.role !== 'admin') return '/'
  if (to.path === '/login' && localStorage.getItem('academy_token')) return '/'
})

export default router
