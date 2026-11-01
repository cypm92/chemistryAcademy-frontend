// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminView from '../src/views/AdminView.vue'
import { api } from '../src/services/api'

vi.mock('../src/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  apiUrl: (url: string) => url,
  errorMessage: () => 'Error de red',
}))

describe('solicitudes en notificaciones', () => {
  it('muestra las solicitudes solo en Notificaciones sin alterar los recordatorios', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/admin/contact-requests') return { data: [{ id: 1, name: 'Ejemplo', contact: 'ejemplo@example.com', need: 'Clases', message: 'Consulta de prueba', created_at: '2026-11-01T12:00:00Z' }] } as any
      if (url === '/admin/notification-settings') return { data: { reminder_interval_minutes: 1440 } } as any
      if (url === '/admin/public-resources') return { data: { exams: [], forms: [], videos: [], documents: [] } } as any
      return { data: [] } as any
    })
    const wrapper = mount(AdminView, { global: { stubs: { StudentsView: true, FolderTreePicker: true } } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Solicitudes desde la portada')
    const notificationsTab = wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'Notificaciones')!
    await notificationsTab.trigger('click')
    expect(wrapper.text()).toContain('Solicitudes desde la portada')
    expect(wrapper.text()).toContain('Consulta de prueba')
    expect(wrapper.text()).toContain('Recordatorios de reservas')
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'Gestión de alumnos')!.trigger('click')
    expect(wrapper.text()).not.toContain('Solicitudes desde la portada')
    wrapper.unmount()
  })
})
