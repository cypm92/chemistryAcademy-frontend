// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), delete: vi.fn() }, errorMessage: () => 'Error de red' }))
beforeEach(() => { vi.resetAllMocks(); session.user = { role: 'admin' } as any })
it('avisa al administrador sin mostrar detalles de las incidencias', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/teams/unlinked-incidents' ? { count: 2, incidents: [{ job_id: 123, reason: 'secret', starts_at: null }] } : [] }) as any)
  const wrapper = mount(ClassesView); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Hay 2 incidencias de reuniones asociadas a clases eliminadas. Revisa Outlook y contacta con soporte.')
  expect(wrapper.text()).not.toContain('secret')
  wrapper.unmount()
})

it('no muestra aviso con cero incidencias', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/teams/unlinked-incidents' ? { count: 0, incidents: [] } : [] }) as any)
  const w = mount(ClassesView); await flushPromises(); expect(w.find('[role=alert]').exists()).toBe(false); w.unmount()
})
it('muestra error accesible y permite reintentar', async () => {
  let fail = true
  vi.mocked(api.get).mockImplementation(async (url) => { if (url === '/admin/teams/unlinked-incidents' && fail) throw new Error('private'); return { data: url === '/admin/teams/unlinked-incidents' ? { count: 1, incidents: [] } : [] } as any })
  const w = mount(ClassesView); await flushPromises(); expect(w.get('[role=alert]').text()).toContain('No se pudieron comprobar incidencias de reuniones'); expect(w.text()).not.toContain('private')
  fail = false; await w.get('[role=alert] button').trigger('click'); await flushPromises(); expect(w.get('[role=alert]').text()).toContain('Hay 1 incidencias'); w.unmount()
})
it('no consulta incidencias para alumnos', async () => {
  session.user = { role: 'student' } as any; vi.mocked(api.get).mockResolvedValue({ data: [] } as any)
  const w = mount(ClassesView); await flushPromises(); expect(api.get).not.toHaveBeenCalledWith('/admin/teams/unlinked-incidents'); expect(w.find('[role=alert]').exists()).toBe(false); w.unmount()
})
it('vuelve a consultar tras eliminar una clase', async () => {
  const item = { id: 5, starts_at: '2099-01-01T10:00:00Z', ends_at: '2099-01-01T11:00:00Z', status: 'confirmed', is_historical: false, topic: 'Química', user_id: 1, user_name: 'Alumna', user_email: 'a@example.com', materials: [] }
  let count = 0
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/teams/unlinked-incidents' ? { count, incidents: [] } : [item] }) as any)
  vi.mocked(api.delete).mockImplementation(async () => { count = 3; return {} as any })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const w = mount(ClassesView); await flushPromises(); await w.findAll('button').find(b => b.text() === 'Eliminar clase')!.trigger('click'); await flushPromises()
  expect(api.delete).toHaveBeenCalledWith('/admin/classes/5'); expect(w.get('[role=alert]').text()).toContain('Hay 3 incidencias'); confirm.mockRestore(); w.unmount()
})
