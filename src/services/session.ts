import { reactive } from 'vue'
import type { User } from '../types'

function tokenIsValid(token: string | null): boolean {
  if (!token) return false
  try {
    const payload = token.split('.')[1]
    if (!payload) return false
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const data = JSON.parse(atob(normalized)) as { exp?: unknown }
    return typeof data.exp === 'number' && data.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

function savedUser(): User | null {
  const token = localStorage.getItem('academy_token')
  const saved = localStorage.getItem('academy_user')
  if (!tokenIsValid(token) || !saved) {
    localStorage.removeItem('academy_token')
    localStorage.removeItem('academy_user')
    return null
  }
  try {
    return JSON.parse(saved) as User
  } catch {
    localStorage.removeItem('academy_token')
    localStorage.removeItem('academy_user')
    return null
  }
}

export const session = reactive<{ user: User | null }>({
  user: savedUser(),
})

export function hasActiveSession() {
  return tokenIsValid(localStorage.getItem('academy_token')) && session.user !== null
}

export function saveSession(token: string, user: User) {
  localStorage.setItem('academy_token', token)
  localStorage.setItem('academy_user', JSON.stringify(user))
  session.user = user
}

export function updateSessionUser(user: User) {
  localStorage.setItem('academy_user', JSON.stringify(user))
  session.user = user
}

export function logout() {
  localStorage.removeItem('academy_token')
  localStorage.removeItem('academy_user')
  session.user = null
}
