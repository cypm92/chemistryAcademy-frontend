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
  it('mantiene una sola navegación superior para todas las secciones', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/public-resources' ? { exams: [], forms: [], videos: [], documents: [] } : url === '/admin/notification-settings' ? { reminder_interval_minutes: 1440 } : [] }) as any)
    const wrapper = mount(AdminView, { global: { stubs: { StudentsView: true, FolderTreePicker: true } } })
    await flushPromises()
    const nav = wrapper.get('nav.admin-tabs[aria-label="Secciones de administración"]')
    expect(wrapper.find('aside.admin-sidebar').exists()).toBe(false)
    const tabs = nav.findAll('[role="tab"]')
    expect(tabs.map(tab => tab.text())).toEqual(['Usuarios', 'Carpetas y Archivos', 'Gestionar Web inicio'])
    for (const tab of tabs) {
      await tab.trigger('click')
      expect(tab.attributes('aria-selected')).toBe('true')
      expect(tabs.filter(item => item.attributes('aria-selected') === 'true')).toHaveLength(1)
    }
    wrapper.unmount()
  })
  it('no carga solicitudes ni recordatorios en administración', async () => {
    vi.mocked(api.get).mockClear()
    vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/public-resources' ? { exams: [], forms: [], videos: [], documents: [] } : [] }) as any)
    const wrapper = mount(AdminView, { global: { stubs: { StudentsView: true, FolderTreePicker: true } } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Solicitudes desde la portada')
    expect(api.get).not.toHaveBeenCalledWith('/admin/contact-requests')
    expect(api.get).not.toHaveBeenCalledWith('/admin/notification-settings')
    wrapper.unmount()
  })
})

it('impide seleccionar orgánica para exámenes sin retirarla de formularios y vídeos', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/public-resources' ? { exams: [], forms: [], videos: [], documents: [] } : url === '/admin/notification-settings' ? { reminder_interval_minutes: 1440 } : [] }) as any)
  const wrapper = mount(AdminView, { global: { stubs: { StudentsView: true, FolderTreePicker: true } } })
  await flushPromises()
  await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'Gestionar Web inicio')!.trigger('click')
  const selects = wrapper.findAll('.resource-admin-grid select').filter(select => select.text().includes('Química'))
  expect(selects).toHaveLength(3)
  expect(selects[0].findAll('option').map(option => option.attributes('value'))).toEqual(['quimica', 'fisica', 'matematicas'])
  expect(selects[1].text()).toContain('Química orgánica')
  expect(selects[2].text()).toContain('Química orgánica')
  wrapper.unmount()
})
