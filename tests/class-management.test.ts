// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'
import { readFileSync } from 'node:fs'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }, errorMessage: () => 'Error de red' }))
const base = { id: 1, starts_at: '2026-11-04T10:00:00Z', ends_at: '2026-11-04T11:00:00Z', status: 'requested', management_status: null, is_historical: false, topic: 'Química', admin_comment: '', user_id: null, user_name: 'Invitada', user_email: 'invitada@example.com', materials: [] }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T12:00:00Z')); session.user = { role: 'admin' } as any; vi.mocked(api.get).mockResolvedValue({ data: [{ ...base }] }); vi.mocked(api.patch).mockReset() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
it('permite aprobar una reserva invitada desde su chip', async () => {
  vi.mocked(api.patch).mockResolvedValue({ data: { status: 'confirmed' } })
  const wrapper = mount(ClassesView)
  await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Aprobar')!.trigger('click')
  expect(api.patch).toHaveBeenCalledWith('/admin/bookings/1', { status: 'confirmed' })
  expect(wrapper.text()).toContain('Confirmada')
  expect(wrapper.text()).toContain('Invitada')
  wrapper.unmount()
})

it('resalta y habilita la gestión justo al terminar la clase', async () => {
  vi.setSystemTime(new Date('2026-11-04T10:59:59Z'))
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed' }] })
  const wrapper = mount(ClassesView)
  await flushPromises()
  expect(wrapper.find('button.class-status').exists()).toBe(false)
  expect(wrapper.get('.class-card').classes()).not.toContain('needs-management')
  await vi.advanceTimersByTimeAsync(1000)
  expect(wrapper.get('.class-card').classes()).toContain('needs-management')
  expect(wrapper.get('button.class-status').text()).toBe('Confirmada · Pendiente de gestión')
  wrapper.unmount()
})

it('guarda y permite cambiar la gestión de pago', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed' }] })
  vi.mocked(api.patch).mockResolvedValueOnce({ data: { ...base, status: 'confirmed', management_status: 'paid' } }).mockResolvedValueOnce({ data: { ...base, status: 'confirmed', management_status: 'pending_payment' } })
  const wrapper = mount(ClassesView)
  await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Pagada')!.trigger('click')
  await flushPromises()
  expect(api.patch).toHaveBeenCalledWith('/admin/classes/1/management', { management_status: 'paid' })
  expect(wrapper.get('button.class-status').text()).toBe('Pagada')
  expect(wrapper.get('.class-card').classes()).not.toContain('needs-management')
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Pendiente de pago')!.trigger('click')
  await flushPromises()
  expect(wrapper.get('button.class-status').text()).toBe('Pendiente de pago')
  wrapper.unmount()
})

it.each(['paid', 'pending_payment'])('restablece %s solo tras confirmar y recupera la alerta', async (management_status) => {
  const item = { ...base, status: 'confirmed', management_status }
  vi.mocked(api.get).mockResolvedValue({ data: [item] })
  vi.mocked(api.patch).mockResolvedValue({ data: { ...item, management_status: null } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Volver a confirmada')!.trigger('click')
  expect(api.patch).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(b => b.text() === 'Volver a confirmada')!.trigger('click'); await flushPromises()
  expect(api.patch).toHaveBeenCalledWith('/admin/classes/1/management', { management_status: null })
  expect(wrapper.get('.class-card').classes()).toContain('needs-management')
  expect(wrapper.get('button.class-status').text()).toBe('Confirmada · Pendiente de gestión')
  confirm.mockRestore(); wrapper.unmount()
})

it('filtra por el estado visible de pago', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed', management_status: 'paid' }, { ...base, id: 2, topic: 'Física', status: 'confirmed', management_status: 'pending_payment' }] })
  const wrapper = mount(ClassesView)
  await flushPromises()
  const filter = wrapper.findAll('select').find(s => s.find('option[value=paid]').exists())!
  await filter.setValue('paid')
  expect(wrapper.text()).toContain('Química')
  expect(wrapper.text()).not.toContain('Física')
  wrapper.unmount()
})

it('aplica fondo naranja claro a tarjeta y chip sin gestionar', async () => {
  const css = readFileSync('src/assets/main.css', 'utf8')
  const style = document.createElement('style'); style.textContent = css.slice(css.lastIndexOf('.class-card.needs-management')); document.head.appendChild(style)
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed' }] })
  const wrapper = mount(ClassesView, { attachTo: document.body })
  await flushPromises()

  expect(getComputedStyle(wrapper.get('.class-card').element).backgroundColor).toBe('rgb(255, 244, 232)')
  expect(getComputedStyle(wrapper.get('button.class-status').element).backgroundColor).toBe('rgb(255, 226, 196)')
  wrapper.unmount(); style.remove()
})

it('mantiene el estado y muestra el error si falla la gestión', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed' }] })
  vi.mocked(api.patch).mockRejectedValue(new Error('fallo'))
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Pagada')!.trigger('click'); await flushPromises()
  expect(wrapper.get('.alert').text()).toContain('Error de red')
  expect(wrapper.get('button.class-status').text()).toBe('Confirmada · Pendiente de gestión')
  wrapper.unmount()
})
it('el alumnado no ve controles ni filtros de gestión', async () => {
  session.user = { role: 'student' } as any
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed', management_status: 'paid' }] })
  const wrapper = mount(ClassesView); await flushPromises()
  expect(api.get).toHaveBeenCalledWith('/classes')
  expect(wrapper.find('button.class-status').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('Pagada')
  expect(wrapper.find('option[value=paid]').exists()).toBe(false)
  wrapper.unmount()
})
it('cancelar desde gestión requiere confirmación y usa el endpoint existente', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed' }] })
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: { ...base, status: 'cancelled' } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Cancelada')!.trigger('click')
  expect(api.post).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(b => b.text() === 'Cancelada')!.trigger('click'); await flushPromises()
  expect(api.post).toHaveBeenCalledWith('/admin/classes/1/cancel')
  expect(wrapper.get('.class-status').text()).toBe('Cancelada')
  confirm.mockRestore(); wrapper.unmount()
})

it.each(['paid', 'pending_payment'])('advierte antes de cancelar una clase %s', async (management_status) => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed', management_status }] })
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: { ...base, status: 'cancelled', management_status: null } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Cancelada')!.trigger('click')
  expect(confirm.mock.calls[0][0]).toMatch(/dejará de contar.*informes futuros/i)
  expect(confirm.mock.calls[0][0]).toMatch(/ya enviados.*no.*modific/i)
  expect(api.post).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(b => b.text() === 'Cancelada')!.trigger('click'); await flushPromises()
  expect(api.post).toHaveBeenCalledWith('/admin/classes/1/cancel')
  expect(wrapper.get('.class-status').text()).toBe('Cancelada')
  confirm.mockRestore(); wrapper.unmount()
})

it('permite gestionar una clase histórica y filtrar por su estado visible', async () => {
  const historical = { ...base, status: 'confirmed', is_historical: true }
  vi.mocked(api.get).mockResolvedValue({ data: [historical] })
  vi.mocked(api.patch).mockResolvedValue({ data: { ...historical, management_status: 'paid' } })
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.findAll('select').find(s => s.find('option[value=historical]').exists())!.setValue('historical')
  expect(wrapper.get('button.class-status').text()).toBe('Confirmada · Pendiente de gestión')
  expect(wrapper.text()).toContain('Histórica')
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Pagada')!.trigger('click'); await flushPromises()
  expect(api.patch).toHaveBeenCalledWith('/admin/classes/1/management', { management_status: 'paid' })
  expect(wrapper.get('button.class-status').text()).toBe('Pagada')
  await wrapper.findAll('select').find(s => s.find('option[value=paid]').exists())!.setValue('paid')
  expect(wrapper.get('button.class-status').text()).toBe('Pagada')
  wrapper.unmount()
})

it('permite decidir una reserva histórica', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, is_historical: true }] })
  vi.mocked(api.patch).mockResolvedValue({ data: { status: 'confirmed' } })
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.findAll('select').find(s => s.find('option[value=historical]').exists())!.setValue('historical')
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Aprobar')!.trigger('click')
  expect(api.patch).toHaveBeenCalledWith('/admin/bookings/1', { status: 'confirmed' })
  wrapper.unmount()
})


it('abre las opciones junto al chip sin filas adicionales', async () => {
  const wrapper = mount(ClassesView); await flushPromises()
  const chip = wrapper.get('button.class-status')
  await chip.trigger('click')
  const menu = wrapper.get('.class-status-menu')
  expect(chip.element.parentElement).toBe(menu.element.parentElement)
  expect(menu.findAll('button').map(button => button.text())).toEqual(['Aprobar', 'Rechazar'])
  expect(wrapper.find('.class-request-actions').exists()).toBe(false)
  expect(wrapper.find('.class-management-actions').exists()).toBe(false)
  wrapper.unmount()
})


it('cierra con Escape y devuelve el foco, y cierra al pulsar fuera', async () => {
  const wrapper = mount(ClassesView, { attachTo: document.body }); await flushPromises()
  const chip = wrapper.get('button.class-status'); (chip.element as HTMLButtonElement).focus()
  await chip.trigger('click')
  expect(chip.attributes('aria-expanded')).toBe('true')
  expect(chip.attributes('aria-controls')).toBe(wrapper.get('.class-status-menu').attributes('id'))
  const option = wrapper.get('.class-status-menu button'); (option.element as HTMLButtonElement).focus()
  await option.trigger('keydown', { key: 'Escape' }); await flushPromises()
  expect(wrapper.find('.class-status-menu').exists()).toBe(false)
  expect(document.activeElement).toBe(chip.element)
  await chip.trigger('click'); document.body.click(); await flushPromises()
  expect(chip.attributes('aria-expanded')).toBe('false')
  wrapper.unmount()
})

it('impide duplicar cambios mientras espera la respuesta', async () => {
  let resolve!: (value: any) => void
  vi.mocked(api.patch).mockReturnValue(new Promise(r => { resolve = r }))
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  const approve = wrapper.get('.class-status-menu button')
  await approve.trigger('click')
  expect(approve.attributes('disabled')).toBeDefined()
  await approve.trigger('click')
  expect(api.patch).toHaveBeenCalledTimes(1)
  resolve({ data: { status: 'confirmed' } }); await flushPromises()
  expect(wrapper.find('.class-status-menu').exists()).toBe(false)
  wrapper.unmount()
})

it('muestra las opciones de gestión terminada en el mismo menú', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...base, status: 'confirmed', management_status: 'paid' }] })
  const wrapper = mount(ClassesView); await flushPromises()
  const chip = wrapper.get('button.class-status'); await chip.trigger('click')
  const menu = wrapper.get('.class-status-menu')
  expect(chip.element.parentElement).toBe(menu.element.parentElement)
  expect(menu.findAll('button').map(button => button.text())).toEqual(['Pagada', 'Pendiente de pago', 'Volver a confirmada', 'Cancelada'])
  expect(wrapper.find('.class-management-actions').exists()).toBe(false)
  wrapper.unmount()
})


it('no cierra el menú de otra clase cuando termina una petición anterior', async () => {
  let resolve!: (value: any) => void
  vi.mocked(api.get).mockResolvedValue({ data: [base, { ...base, id: 2, topic: 'Física' }] })
  vi.mocked(api.patch).mockReturnValue(new Promise(r => { resolve = r }))
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.get('#class-status-1').trigger('click')
  await wrapper.get('#class-status-options-1 button').trigger('click')
  await wrapper.get('#class-status-2').trigger('click')
  resolve({ data: { status: 'declined' } }); await flushPromises()
  expect(wrapper.find('#class-status-options-2').exists()).toBe(true)
  wrapper.unmount()
})


it('devuelve el foco a la tarjeta si el chip deja de ser interactivo', async () => {
  vi.mocked(api.patch).mockResolvedValue({ data: { status: 'declined' } })
  const wrapper = mount(ClassesView, { attachTo: document.body }); await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  const reject = wrapper.findAll('.class-status-menu button').find(b => b.text() === 'Rechazar')!
  ;(reject.element as HTMLButtonElement).focus()
  await reject.trigger('click'); await flushPromises()
  expect(wrapper.find('button.class-status').exists()).toBe(false)
  expect(document.activeElement).toBe(wrapper.get('.class-card').element)
  wrapper.unmount()
})


it('conserva los datos de una edición terminada durante la gestión de pago', async () => {
  const item = { ...base, status: 'confirmed', topic: 'Química ESO' }
  let resolve!: (value: any) => void
  vi.mocked(api.get).mockResolvedValue({ data: [item] })
  vi.mocked(api.patch).mockImplementation((url: any) => url.endsWith('/management')
    ? new Promise(r => { resolve = r })
    : Promise.resolve({ data: { ...item, topic: 'Física ESO' } }))
  const wrapper = mount(ClassesView); await flushPromises()
  await wrapper.get('button.class-status').trigger('click')
  await wrapper.findAll('.class-status-menu button').find(b => b.text() === 'Pagada')!.trigger('click')
  await wrapper.get('.edit-button').trigger('click')
  await wrapper.get('.edit-class-card select[required]').setValue('Física ESO')
  await wrapper.get('.edit-class-card').trigger('submit'); await flushPromises()
  expect(wrapper.get('.class-main-title h2').text()).toBe('Física ESO')
  resolve({ data: { ...item, management_status: 'paid' } }); await flushPromises()
  expect(wrapper.get('.class-main-title h2').text()).toBe('Física ESO')
  expect(wrapper.get('button.class-status').text()).toBe('Pagada')
  wrapper.unmount()
})
