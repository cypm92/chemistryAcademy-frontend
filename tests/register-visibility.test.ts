// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LoginView from '../src/views/LoginView.vue'

const mocks = vi.hoisted(() => ({ post: vi.fn(), push: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { mode: 'register' } }), useRouter: () => ({ push: mocks.push }) }))
vi.mock('../src/services/api', () => ({ api: { post: mocks.post }, errorMessage: (error: Error) => error.message }))
vi.mock('../src/services/session', () => ({ saveSession: vi.fn() }))
vi.mock('../src/services/theme', () => ({ branding: { logoUrl: '' }, loadBranding: vi.fn() }))

it('mantiene los consentimientos obligatorios y permite mostrar y ocultar la contraseña sin enviar', async () => {
  const wrapper = mount(LoginView, { global: { stubs: { RouterLink: true } } })
  const password = wrapper.get('input[minlength="8"]')
  const checkbox = wrapper.findAll('input[type="checkbox"]')
  expect(checkbox).toHaveLength(2)
  expect(checkbox.every(input => (input.element as HTMLInputElement).required)).toBe(true)
  expect(password.attributes('type')).toBe('password')
  const toggle = wrapper.get('button[aria-label="Mostrar contraseña"]')
  expect(toggle.attributes('type')).toBe('button')
  await toggle.trigger('click')
  expect(password.attributes('type')).toBe('text')
  expect(wrapper.get('button[aria-label="Ocultar contraseña"]').attributes('aria-pressed')).toBe('true')
  await wrapper.get('button[aria-label="Ocultar contraseña"]').trigger('click')
  expect(password.attributes('type')).toBe('password')
  expect(mocks.post).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('al completar el registro envía los mismos datos y oculta la contraseña al volver a entrar', async () => {
  mocks.post.mockResolvedValue({})
  const wrapper = mount(LoginView, { global: { stubs: { RouterLink: true } } })
  const inputs = wrapper.findAll('form input:not([type="checkbox"])')
  await inputs[0]!.setValue('Alumno')
  await inputs[1]!.setValue('alumno@example.test')
  await inputs[2]!.setValue('password123')
  await wrapper.get('button[aria-label="Mostrar contraseña"]').trigger('click')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(mocks.post).toHaveBeenCalledWith('/auth/register', { name: 'Alumno', email: 'alumno@example.test', password: 'password123' })
  expect(wrapper.get('input[minlength="8"]').attributes('type')).toBe('password')
  wrapper.unmount()
})
