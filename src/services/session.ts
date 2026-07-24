import { reactive } from 'vue'
import type { User } from '../types'

const saved = localStorage.getItem('academy_user')

export const session = reactive<{ user: User | null }>({
  user: saved ? JSON.parse(saved) : null,
})

export function saveSession(token: string, user: User) {
  localStorage.setItem('academy_token', token)
  localStorage.setItem('academy_user', JSON.stringify(user))
  session.user = user
}

export function logout() {
  localStorage.removeItem('academy_token')
  localStorage.removeItem('academy_user')
  session.user = null
}

