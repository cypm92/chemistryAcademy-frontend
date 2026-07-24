import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('academy_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.detail || 'No se pudo completar la operación'
  return 'Ha ocurrido un error inesperado'
}

export async function protectedBlobUrl(path: string): Promise<string> {
  const response = await api.get(path, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}
