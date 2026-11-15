// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProfileView from '../src/views/ProfileView.vue'

const calls = vi.hoisted(() => ({ patch: vi.fn() }))
vi.mock('../src/services/api', () => ({ api: calls, errorMessage: (error: Error) => error.message, protectedBlobUrl: vi.fn() }))
vi.mock('../src/services/session', () => ({ session: { user: { name: 'Alumno', email: 'alumno@example.test', has_avatar: false } }, updateSessionUser: vi.fn() }))

it('muestra y oculta cada contraseña por separado sin enviar el formulario', async () => {
  const wrapper = mount(ProfileView)
  const inputs = wrapper.findAll('input[autocomplete="current-password"], input[autocomplete="new-password"]')
  expect(inputs.map(input => input.attributes('type'))).toEqual(['password', 'password', 'password'])
  const buttons = wrapper.findAll('.password-toggle')
  expect(buttons).toHaveLength(3)
  for (let index = 0; index < buttons.length; index++) {
    expect(buttons[index]!.attributes('type')).toBe('button')
    await buttons[index]!.trigger('click')
    expect(inputs.map(input => input.attributes('type'))).toEqual(inputs.map((_, i) => i === index ? 'text' : 'password'))
    expect(buttons[index]!.attributes('aria-pressed')).toBe('true')
    await buttons[index]!.trigger('click')
    expect(inputs[index]!.attributes('type')).toBe('password')
  }
  expect(calls.patch).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('al guardar limpia y vuelve a ocultar las contraseñas sin cambiar los datos enviados', async () => {
  calls.patch.mockResolvedValue({ data: { name: 'Alumno', email: 'alumno@example.test' } })
  const wrapper = mount(ProfileView)
  const inputs = wrapper.findAll('input[autocomplete="current-password"], input[autocomplete="new-password"]')
  await inputs[0]!.setValue('actual123')
  await inputs[1]!.setValue('nueva123')
  await inputs[2]!.setValue('nueva123')
  await wrapper.findAll('.password-toggle')[0]!.trigger('click')
  await wrapper.findAll('.password-toggle')[1]!.trigger('click')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(calls.patch).toHaveBeenCalledWith('/auth/me', { name: 'Alumno', email: 'alumno@example.test', current_password: 'actual123', new_password: 'nueva123' })
  expect(inputs.map(input => (input.element as HTMLInputElement).value)).toEqual(['', '', ''])
  expect(inputs.map(input => input.attributes('type'))).toEqual(['password', 'password', 'password'])
  wrapper.unmount()
})
