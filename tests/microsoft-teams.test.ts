// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminView from '../src/views/AdminView.vue'
import ClassesView from '../src/views/ClassesView.vue'
import MicrosoftIntegration from '../src/components/MicrosoftIntegration.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }, apiUrl: (s: string) => s, errorMessage: () => 'Error de red' }))
const status = { configured: true, connected: false, account_label: null, needs_reconnect: false }
const item = { id: 1, starts_at: '2026-11-04T10:00:00Z', ends_at: '2026-11-04T11:00:00Z', status: 'confirmed', management_status: null, is_historical: false, topic: 'Química', admin_comment: '', user_id: 2, user_name: 'Alumna', user_email: 'a@example.com', materials: [], teams_status: 'error' }
beforeEach(() => { session.user = { role: 'admin' } as any; vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/integrations/microsoft' ? status : url === '/admin/public-resources' ? { exams: [], forms: [], videos: [], documents: [] } : url === '/admin/notification-settings' ? { reminder_interval_minutes: 1440 } : url === '/admin/classes' ? [item] : [] }) as any) })
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); window.history.replaceState({}, '', '/') })
it('ofrece conectar Microsoft en Notificaciones', async () => {
  const w = mount(AdminView, { global: { stubs: { StudentsView: true, FolderTreePicker: true } } }); await flushPromises()
  await w.findAll('[role="tab"]').find(x => x.text() === 'Notificaciones')!.trigger('click')
  expect(w.text()).toContain('Microsoft Teams'); expect(w.text()).toContain('Desconectada'); expect(w.text()).toContain('Conectar')
  w.unmount()
})
it('muestra el fallo y reintenta Teams solo para administración', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: {} })
  const w = mount(ClassesView); await flushPromises()
  expect(w.text()).toContain('Error al sincronizar la reunión de Teams')
  await w.findAll('button').find(b => b.text() === 'Reintentar Teams')!.trigger('click'); await flushPromises()
  expect(api.post).toHaveBeenCalledWith('/admin/classes/1/teams/retry'); w.unmount()
  session.user = { role: 'guest' } as any
  vi.mocked(api.get).mockResolvedValue({ data: [item] })
  const guest = mount(ClassesView); await flushPromises(); expect(guest.text()).not.toContain('Reintentar Teams'); expect(guest.text()).not.toContain('Error al crear la reunión de Teams'); guest.unmount()
})

it('no confirma el callback sin verificar el estado y limpia el parámetro', async () => {
  window.history.replaceState({}, '', '/admin?microsoft=connected&other=1')
  const w = mount(MicrosoftIntegration); await flushPromises()
  expect(w.text()).toContain('No se pudo confirmar la conexión')
  expect(window.location.search).toBe('?other=1')
  w.unmount()
})
it('permite el OAuth simulado local solo con activación explícita', async () => {
  vi.stubEnv('VITE_MICROSOFT_SIMULATED', 'true')
  vi.mocked(api.post).mockResolvedValue({ data: { authorization_url: `${window.location.origin}/fake/12345678-1234-1234-1234-123456789abc/oauth2/v2.0/authorize?state=abc` } })
  const w = mount(MicrosoftIntegration); await flushPromises()
  expect(w.text()).toContain('Simulación')
  await w.get('button').trigger('click'); await flushPromises()
  expect(w.text()).not.toContain('No se pudo iniciar la conexión')
  w.unmount(); vi.unstubAllEnvs()
})
it('permite simulación explícita en build local servido por Nginx', async () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_MICROSOFT_SIMULATED', 'true')
  vi.stubEnv('VITE_LOCAL_SANDBOX_BUILD', 'true')
  const w = mount(MicrosoftIntegration); await flushPromises()
  expect(w.text()).toContain('Simulación local de Microsoft activada')
  w.unmount()
})
it.each([
  ['flag desactivado', false, true, '/fake/12345678-1234-1234-1234-123456789abc/oauth2/v2.0/authorize'],
  ['build de producción', true, false, '/fake/12345678-1234-1234-1234-123456789abc/oauth2/v2.0/authorize'],
  ['otro origen', true, true, 'http://127.0.0.1:9999/fake/12345678-1234-1234-1234-123456789abc/oauth2/v2.0/authorize'],
  ['ruta incorrecta', true, true, '/fake/no-uuid/oauth2/v2.0/authorize'],
  ['credenciales', true, true, `http://user:pass@${window.location.host}/fake/12345678-1234-1234-1234-123456789abc/oauth2/v2.0/authorize`],
])('rechaza OAuth simulado con %s', async (_label, enabled, dev, path) => {
  vi.stubEnv('VITE_MICROSOFT_SIMULATED', enabled ? 'true' : 'false'); vi.stubEnv('DEV', dev)
  vi.mocked(api.post).mockResolvedValue({ data: { authorization_url: new URL(path as string, window.location.origin).href } })
  const w = mount(MicrosoftIntegration); await flushPromises()
  await w.get('button').trigger('click'); await flushPromises()
  expect(w.text()).toContain('No se pudo iniciar la conexión')
  w.unmount()
})
it('rechaza simulación en un host público aunque el flag esté activo', async () => {
  vi.stubEnv('VITE_MICROSOFT_SIMULATED', 'true')
  vi.stubEnv('VITE_LOCAL_SANDBOX_BUILD', 'true')
  const realWindow = window
  const location = new URL('http://public.example/admin')
  vi.stubGlobal('window', new Proxy(realWindow, { get(target, key) { return key === 'location' ? location : Reflect.get(target, key, target) } }))
  try {
    vi.mocked(api.post).mockResolvedValue({ data: { authorization_url: 'http://public.example/fake/12345678-1234-1234-1234-123456789abc/oauth2/v2.0/authorize' } })
    const w = mount(MicrosoftIntegration); await flushPromises()
    await w.get('button').trigger('click'); await flushPromises()
    expect(w.text()).not.toContain('Simulación local')
    expect(w.text()).toContain('No se pudo iniciar la conexión')
    w.unmount()
  } finally { vi.unstubAllGlobals() }
})
it('rechaza una URL de autorización fuera de Microsoft', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { authorization_url: 'https://login.microsoftonline.com.evil.example/' } })
  const w = mount(MicrosoftIntegration); await flushPromises()
  await w.get('button').trigger('click'); await flushPromises()
  expect(w.text()).toContain('No se pudo iniciar la conexión')
  w.unmount()
})
it('solicita confirmación antes de desconectar', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { configured: true, connected: true, account_label: 'Profesora', needs_reconnect: false } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const w = mount(MicrosoftIntegration); await flushPromises()
  await w.get('button').trigger('click')
  expect(api.post).not.toHaveBeenCalled()
  expect(confirm).toHaveBeenCalledOnce()
  const text = confirm.mock.calls[0]![0]!
  expect(text).toContain('solo elimina la credencial almacenada en esta aplicación')
  expect(text).toContain('no revoca los permisos en Microsoft')
  expect(text).toContain('revocarlos directamente en Microsoft')
  expect(text).toContain('operación en curso puede finalizar')
  confirm.mockRestore(); w.unmount()
})


it('permite reintentar la eliminación fallida de una clase cancelada', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/admin/classes' ? [{ ...item, status: 'cancelled', teams_action: 'delete' }] : [] }) as any)
  vi.mocked(api.post).mockRejectedValueOnce(new Error('fallo'))
  const w = mount(ClassesView); await flushPromises()
  expect(w.text()).toContain('Error al eliminar el evento de Teams')
  expect(w.text()).not.toContain('Error al crear la reunión de Teams')
  expect(w.text()).not.toContain('Reintentar Teams')
  await w.findAll('button').find(b => b.text() === 'Reintentar eliminación')!.trigger('click'); await flushPromises()
  expect(api.post).toHaveBeenCalledWith('/admin/classes/1/teams/retry')
  expect(w.text()).toContain('No se pudo reintentar la eliminación del evento de Teams')
  w.unmount()
})


it('advierte en la confirmación que solo se puede reconectar con la misma cuenta', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { configured: true, connected: true, account_label: null, needs_reconnect: false } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const w = mount(MicrosoftIntegration); await flushPromises()
  await w.get('button').trigger('click')
  expect(confirm.mock.calls[0]![0]).toContain('solo podrás reconectar con la misma cuenta de Microsoft')
  confirm.mockRestore(); w.unmount()
})
