import axios from 'axios'
import { logout } from './session'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('academy_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let redirectingAfterExpiredSession = false

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const authorization = error.config?.headers?.Authorization
    if (status === 401 && authorization && !redirectingAfterExpiredSession) {
      redirectingAfterExpiredSession = true
      logout()
      if (window.location.pathname !== '/login') {
        window.location.replace('/login?reason=session-expired')
      }
    }
    return Promise.reject(error)
  },
)

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.detail || 'No se pudo completar la operación'
  return 'Ha ocurrido un error inesperado'
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (api.defaults.baseURL || '').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function protectedBlobUrl(path: string): Promise<string> {
  const response = await api.get(path, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}
