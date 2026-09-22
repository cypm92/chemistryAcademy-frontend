import { ref } from 'vue'
import { api } from './api'

export type HomeContent = {
  hero_title: string; hero_description: string; concerns: string[]
  particular_price_bach: string; particular_price_uni: string
  about_title: string; about_quote: string; about_text: string
  newsletter_title: string; newsletter_text: string
  contact_title: string; contact_text: string; whatsapp: string; email: string; instagram: string
  closing_title: string; closing_text: string
}

export const defaultHomeContent: HomeContent = {
  hero_title: 'La química no se memoriza. Se entiende.',
  hero_description: 'Clases particulares y en grupo reducido, online, para 2º de Bachillerato y universitarios de química, física y matemáticas.',
  concerns: ['Estudio horas y luego en el examen me quedo en blanco.', 'Entiendo la teoría, pero no sé por dónde empezar el problema.', 'Apruebo raspado y necesito subir la nota para entrar donde quiero.', 'Llevo dos convocatorias con orgánica y no hay manera.', 'Voy perdido y no sé si voy a llegar a la PAU.'],
  particular_price_bach: '22 €', particular_price_uni: '27 €',
  about_title: 'Hola, soy Be Ciencia.', about_quote: 'La química deja de ser un muro cuando alguien te enseña a mirarla bien.', about_text: 'Clases cercanas, claras y pensadas para que entiendas lo que haces antes de memorizarlo.',
  newsletter_title: 'Un ejercicio resuelto en tu correo, cada semana.', newsletter_text: 'Un problema tipo examen explicado paso a paso, con el error que casi todo el mundo comete en él.',
  contact_title: 'Hablamos.', contact_text: 'Escríbeme y reservamos tu clase de prueba gratuita. Te contesto yo, no un formulario automático.', whatsapp: '', email: '', instagram: '',
  closing_title: 'Antes de irte, llévate el método.', closing_text: 'Empieza con una clase de prueba gratuita y descubre una forma distinta de estudiar química.',
}

export const homeContent = ref<HomeContent>({ ...defaultHomeContent })

export async function loadHomeContent() {
  try { const { data } = await api.get('/home-content'); homeContent.value = { ...defaultHomeContent, ...data.content } } catch { homeContent.value = { ...defaultHomeContent } }
  return homeContent.value
}

export async function saveHomeContent(content: HomeContent) {
  const { data } = await api.patch('/admin/home-content', { content })
  homeContent.value = { ...defaultHomeContent, ...data.content }
}
