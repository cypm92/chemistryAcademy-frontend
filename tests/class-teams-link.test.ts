// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }, errorMessage: () => 'Error' }))
const item = { id: 1, starts_at: '2026-11-04T10:00:00Z', ends_at: '2026-11-04T11:00:00Z', status: 'confirmed', management_status: null, is_historical: false, topic: 'Química', user_id: 2, user_name: 'Alumna', user_email: 'a@example.com', materials: [] }
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
it.each(['student', 'admin'])('muestra el comentario y permite abrir Teams para %s', async role => {
  session.user = { role } as any
  const comment = 'Preparar ejercicio\nEnlace de Teams: https://teams.microsoft.com/l/meetup-join/a?x=1&y=2'
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...item, admin_comment: comment }] })
  const wrapper = mount(ClassesView); await flushPromises()
  const p = wrapper.get('.class-comment')
  expect(p.element.textContent).toContain(comment)
  const link = p.get('a')
  expect(link.attributes('href')).toBe('https://teams.microsoft.com/l/meetup-join/a?x=1&y=2')
  expect(link.attributes('target')).toBe('_blank')
  expect(link.attributes('rel')).toBe('noopener noreferrer')
  wrapper.unmount()
})
it('conserva texto no fiable sin convertirlo en HTML ni enlaces', async () => {
  session.user = { role: 'student' } as any
  const comment = '<img src=x onerror=alert(1)> javascript:alert(1) https://teams.microsoft.com.evil.test/x https://teams.microsoft.com@evil.test/x http://teams.microsoft.com/x https://user@teams.microsoft.com/x'
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...item, admin_comment: comment }] })
  const wrapper = mount(ClassesView); await flushPromises()
  expect(wrapper.get('.class-comment').element.textContent).toContain(comment)
  expect(wrapper.find('.class-comment a').exists()).toBe(false)
  expect(wrapper.find('.class-comment img').exists()).toBe(false)
  wrapper.unmount()
})
it.each([['true', true, true], ['false', true, false], ['true', false, false]])('solo permite la reunión local con simulación explícita y desarrollo: %s %s', async (flag, dev, allowed) => {
  vi.stubEnv('DEV', dev); vi.stubEnv('VITE_MICROSOFT_SIMULATED', flag)
  session.user = { role: 'student' } as any
  const url = `${window.location.origin}/fake/meeting/abc-123`
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...item, admin_comment: url }] })
  const wrapper = mount(ClassesView); await flushPromises()
  expect(wrapper.find('.class-comment a').exists()).toBe(allowed)
  wrapper.unmount()
})
it('no deja activo un enlace obsoleto después de cancelar', async () => {
  session.user = { role: 'student' } as any
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...item, status: 'cancelled', admin_comment: 'https://teams.microsoft.com/old' }] })
  const wrapper = mount(ClassesView); await flushPromises()
  expect(wrapper.get('.class-comment').text()).toContain('https://teams.microsoft.com/old')
  expect(wrapper.find('.class-comment a').exists()).toBe(false)
  wrapper.unmount()
})
it('avisa al administrador cuando la cuenta de Microsoft no coincide', async () => {
  session.user = { role: 'admin' } as any
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...item, admin_comment: '', teams_status: 'needs_review', teams_review_reason: 'recreation_account_mismatch', teams_action: 'upsert' }] })
  const wrapper = mount(ClassesView); await flushPromises()
  expect(wrapper.get('.class-teams').text()).toMatch(/cuenta.*Microsoft/i)
  expect(wrapper.find('.class-teams button').exists()).toBe(false)
  wrapper.unmount()
})
