// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'
vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }, apiUrl: (s: string) => s, errorMessage: () => 'Error de red' }))
const item = (extra = {}) => ({ id: 1, starts_at: '2026-11-04T10:00:00Z', ends_at: '2026-11-04T11:00:00Z', status: 'confirmed', management_status: null, is_historical: false, topic: 'Química', admin_comment: '', user_id: 2, user_name: 'Alumna', user_email: 'a@example.com', materials: [], teams_status: 'needs_review', teams_review_reason: 'patch_result_unknown', teams_action: 'upsert', teams_revision: 7, teams_unresolved_attempts: 1, ...extra })
async function setup(extra = {}, role = 'admin') { session.user = { role } as any; vi.mocked(api.get).mockResolvedValue({ data: [item(extra)] } as any); const w = mount(ClassesView, { attachTo: document.body }); await flushPromises(); return w }
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!
afterEach(() => { document.body.innerHTML = ''; vi.resetAllMocks() })
it('permite al administrador confirmar la revisión tras aceptar el riesgo', async () => {
 const w = await setup(); button('He comprobado Outlook').click(); await flushPromises()
 expect(document.querySelector('[role="dialog"]')).not.toBeNull()
 expect(document.body.textContent).toContain('horario')
 expect(document.body.textContent).toContain('más tarde')
 const confirm = button('Marcar como revisada'); expect(confirm.disabled).toBe(true)
 ;(document.querySelector('[role="dialog"] input[type="checkbox"]') as HTMLInputElement).click(); await flushPromises(); confirm.click(); await flushPromises()
 expect(api.post).toHaveBeenCalledWith('/admin/classes/1/teams/patch-review', { expected_revision: 7, acknowledge_checked: true, acknowledge_late_risk: true })
 expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === '/admin/classes')).toHaveLength(2); w.unmount()
})

it('oculta el control al alumnado', async () => { const w = await setup({}, 'guest'); expect(button('He comprobado Outlook')).toBeUndefined(); w.unmount() })
it('explica la ausencia para clases canceladas', async () => { const w = await setup({ status: 'cancelled' }); button('He comprobado Outlook').click(); await flushPromises(); expect(document.querySelector('[role=dialog]')?.textContent).toContain('no existe'); w.unmount() })
it('permite cancelar con teclado y restaura el foco', async () => { const w = await setup(); const opener = button('He comprobado Outlook'); opener.focus(); opener.click(); await flushPromises(); const dialog = document.querySelector<HTMLElement>('[role=dialog]')!; expect(document.activeElement).toBe(dialog); dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await flushPromises(); expect(document.activeElement).toBe(opener); expect(api.post).not.toHaveBeenCalled(); w.unmount() })
it('deshabilita revisiones sin revisión válida', async () => { const w = await setup({ teams_revision: null }); expect(button('He comprobado Outlook').disabled).toBe(true); w.unmount() })
it('previene duplicados y oculta datos maliciosos del servidor', async () => { let reject!: (value: unknown) => void; vi.mocked(api.post).mockImplementationOnce(() => new Promise((_, r) => { reject = r })); const w = await setup(); button('He comprobado Outlook').click(); await flushPromises(); (document.querySelector('[role=dialog] input') as HTMLInputElement).click(); await flushPromises(); const confirm = button('Marcar como revisada'); confirm.click(); confirm.click(); await flushPromises(); expect(api.post).toHaveBeenCalledTimes(1); reject({ response: { status: 500, data: { detail: '<img src=x onerror=alert(1)>SECRET' } } }); await flushPromises(); expect(document.body.textContent).not.toContain('SECRET'); expect(document.querySelector('img')).toBeNull(); w.unmount() })
it('ante conflicto recarga y muestra explicación sin filtrar respuesta', async () => { vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'SECRET' } } }); const w = await setup(); button('He comprobado Outlook').click(); await flushPromises(); (document.querySelector('[role=dialog] input') as HTMLInputElement).click(); await flushPromises(); button('Marcar como revisada').click(); await flushPromises(); expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === '/admin/classes')).toHaveLength(2); expect(w.text()).toContain('operación aún en curso'); expect(w.text()).not.toContain('SECRET'); w.unmount() })
it('bloquea datos obsoletos si falla la recarga', async () => { const w = await setup(); vi.mocked(api.get).mockRejectedValueOnce(new Error('network')); button('He comprobado Outlook').click(); await flushPromises(); (document.querySelector('[role=dialog] input') as HTMLInputElement).click(); await flushPromises(); button('Marcar como revisada').click(); await flushPromises(); expect(button('He comprobado Outlook').disabled).toBe(true); expect(w.text()).toContain('obsoletos'); w.unmount() })
it('mantiene el diálogo abierto con Escape durante el guardado', async () => {
 let resolve!: (value: any) => void
 vi.mocked(api.post).mockImplementationOnce(() => new Promise(r => { resolve = r }))
 const w = await setup(); button('He comprobado Outlook').click(); await flushPromises()
 const dialog = document.querySelector<HTMLElement>('[role=dialog]')!
 ;(dialog.querySelector('input') as HTMLInputElement).click(); await flushPromises(); button('Marcar como revisada').click(); await flushPromises()
 dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await flushPromises()
 expect(document.querySelector('[role=dialog]')).toBe(dialog); expect(api.post).toHaveBeenCalledTimes(1)
 resolve({ data: {} }); await flushPromises(); w.unmount()
})
it('atrapa el foco con tabulador', async () => { const w = await setup(); button('He comprobado Outlook').click(); await flushPromises(); const dialog = document.querySelector<HTMLElement>('[role=dialog]')!; const cancel = dialog.querySelector<HTMLButtonElement>('button')!; cancel.focus(); const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); cancel.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(document.activeElement).toBe(dialog.querySelector('input')); w.unmount() })
