// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }, apiUrl: (s: string) => s, errorMessage: () => 'Error de red' }))
const item = (extra = {}) => ({ id: 1, starts_at: '2026-11-04T10:00:00Z', ends_at: '2026-11-04T11:00:00Z', status: 'confirmed', management_status: null, is_historical: false, topic: 'Química', admin_comment: '', user_id: 2, user_name: 'Alumna', user_email: 'a@example.com', materials: [], teams_status: 'needs_review', teams_review_reason: 'creation_result_unknown', teams_action: 'upsert', teams_revision: 7, teams_unresolved_attempts: 1, ...extra })
async function setup(extra = {}, role = 'admin') {
  session.user = { role } as any
  vi.mocked(api.get).mockResolvedValue({ data: [item(extra)] } as any)
  const w = mount(ClassesView, { attachTo: document.body }); await flushPromises(); return w
}
function button(text: string) { return [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))! }
afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks() })

it('confirma explícitamente antes de solicitar una nueva creación', async () => {
  const w = await setup(); button('Comprobar Outlook').click(); await flushPromises()
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(document.body.textContent).toContain('duplicados')
  expect(api.post).not.toHaveBeenCalled()
  button('He comprobado que no existe; crear de nuevo').click(); await flushPromises()
  expect(api.post).toHaveBeenCalledWith('/admin/classes/1/teams/recreate', { expected_revision: 7, confirm_absent: true })
  expect(document.body.textContent).toContain('solicitado')
  w.unmount()
})

it('permite cancelar con Escape y devuelve el foco', async () => {
  const w = await setup(); const opener = button('Comprobar Outlook'); opener.focus(); opener.click(); await flushPromises()
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  expect(document.activeElement).toBe(dialog)
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await flushPromises()
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(opener); expect(api.post).not.toHaveBeenCalled(); w.unmount()
})
it('atrapa el foco y cancelar no envía nada', async () => {
  const w = await setup(); button('Comprobar Outlook').click(); await flushPromises()
  const cancel = document.querySelector<HTMLButtonElement>('[role="dialog"] button')!, confirm = button('He comprobado')
  confirm.focus(); const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); confirm.dispatchEvent(tab)
  expect(tab.defaultPrevented).toBe(true); expect(document.activeElement).toBe(cancel)
  cancel.click(); await flushPromises(); expect(api.post).not.toHaveBeenCalled(); expect(document.querySelector('[role="dialog"]')).toBeNull(); w.unmount()
})
it('avisa de la actualización incierta sin ofrecer crear otra reunión', async () => {
  const w = await setup({ teams_review_reason: 'patch_result_unknown' })
  const status = w.get('.class-teams[role="status"]')
  expect(status.text()).toContain('No se ha podido confirmar la actualización de la reunión. Revisa el evento y su horario en Outlook; contacta con soporte si la incidencia continúa.')
  expect(status.text()).toContain('1 incidencia pendiente')
  expect(status.text()).not.toMatch(/resultado de creación incierto|eliminad/i)
  expect(button('Comprobar Outlook')).toBeUndefined()
  expect(api.post).not.toHaveBeenCalled()
  w.unmount()
})

it('mantiene el aviso de creación incierta y su control', async () => {
  const w = await setup()
  expect(w.get('.class-teams[role="status"]').text()).toContain('Resultado de creación incierto: puede que el evento ya exista.')
  expect(button('Comprobar Outlook').disabled).toBe(false)
  w.unmount()
})

it.each(['creation_result_unknown', 'event_missing'])('permite revisar %s', async reason => {
  const w = await setup({ teams_review_reason: reason }); expect(button('Comprobar Outlook').disabled).toBe(false); w.unmount()
})
it.each([{ status: 'cancelled' }, { status: 'requested' }, { status: 'declined' }, { teams_action: 'delete' }, { teams_action: null }, { teams_revision: undefined }, { teams_revision: null }])('deshabilita la creación sin condiciones seguras: %j', async extra => {
  const w = await setup(extra); expect(button('Comprobar Outlook').disabled).toBe(true); expect(api.post).not.toHaveBeenCalled(); w.unmount()
})
it('oculta el control y las incidencias a alumnos', async () => {
  const w = await setup({}, 'guest'); expect(button('Comprobar Outlook')).toBeUndefined(); expect(w.text()).not.toContain('incidencia pendiente'); w.unmount()
})
it.each([[1, 'incidencia pendiente'], [2, 'incidencias pendientes']])('aclara la reunión principal preparada con %i incidencias', async (count, label) => {
  const w = await setup({ teams_status: 'ready', teams_unresolved_attempts: count })
  const status = w.get('.class-teams[role="status"]')
  expect(status.text()).toContain(`La reunión principal de Teams está preparada, pero hay ${count} ${label} de revisión. Examina Outlook por posibles duplicados.`)
  expect(status.text().match(/Examina Outlook/g)).toHaveLength(1)
  expect(button('Comprobar Outlook')).toBeUndefined()
  w.unmount()
})
it('mantiene el mensaje habitual sin incidencias', async () => {
  const w = await setup({ teams_status: 'ready', teams_unresolved_attempts: 0 })
  expect(w.get('.class-teams[role="status"]').text()).toBe('Reunión de Teams preparada.')
  w.unmount()
})
it('ante un conflicto actualiza la clase y no comunica éxito', async () => {
  vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409 } })
  const w = await setup(); button('Comprobar Outlook').click(); await flushPromises(); button('He comprobado').click(); await flushPromises()
  expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === '/admin/classes')).toHaveLength(2); expect(w.text()).toContain('No se ha podido autorizar'); expect(w.text()).not.toContain('Se ha solicitado'); w.unmount()
})
it('sanitiza errores y evita envíos simultáneos', async () => {
  let reject!: (reason: unknown) => void
  vi.mocked(api.post).mockImplementationOnce(() => new Promise((_, r) => { reject = r }))
  const w = await setup(); button('Comprobar Outlook').click(); await flushPromises(); const confirm = button('He comprobado'); confirm.click(); confirm.click(); await flushPromises()
  expect(api.post).toHaveBeenCalledTimes(1); expect(confirm.disabled).toBe(true)
  reject({ response: { status: 500, data: { detail: 'SECRET ACCOUNT' } } }); await flushPromises()
  expect(document.body.textContent).toContain('No se pudo solicitar'); expect(document.body.textContent).not.toContain('SECRET ACCOUNT'); expect(w.text()).not.toContain('Se ha solicitado'); w.unmount()
})
it('conserva el reintento ordinario', async () => {
  const w = await setup({ teams_status: 'error' }); button('Reintentar Teams').click(); await flushPromises(); expect(api.post).toHaveBeenCalledWith('/admin/classes/1/teams/retry'); w.unmount()
})


it.each([409, 200])('si falla la recarga tras resultado %s, bloquea hasta actualizar', async status => {
  if (status === 409) vi.mocked(api.post).mockRejectedValueOnce({ response: { status, data: { detail: 'SECRET ACCOUNT' } } })
  const w = await setup()
  vi.mocked(api.get).mockRejectedValueOnce(new Error('network'))
  button('Comprobar Outlook').click(); await flushPromises(); button('He comprobado').click(); await flushPromises()
  expect(w.text()).toContain('actualizar')
  expect(document.body.textContent).not.toContain('SECRET ACCOUNT')
  expect(button('Comprobar Outlook').disabled).toBe(true)
  button('Actualizar clases').click(); await flushPromises()
  expect(button('Comprobar Outlook').disabled).toBe(false)
  w.unmount()
})
