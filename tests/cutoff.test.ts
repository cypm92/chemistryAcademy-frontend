// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TrialBookingModal from '../src/components/TrialBookingModal.vue'
import ReservationsView from '../src/views/ReservationsView.vue'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, errorMessage: () => 'Error' }))
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-02T06:00:00Z')); vi.mocked(api.get).mockResolvedValue({ data: [] } as any); session.user = { role: 'admin' } as any })
afterEach(() => vi.useRealTimers())

it('ofrece la última prueba a las 21:00 y ninguna posterior', async () => {
  const wrapper = mount(TrialBookingModal, { global: { stubs: { RouterLink: true } } }); await flushPromises()
  const slots = wrapper.findAll('.trial-slots button')
  expect(slots.at(-1)?.text()).toBe('21:00')
  expect((slots.at(-1)?.element as HTMLButtonElement).disabled).toBe(false)
  wrapper.unmount()
})

it('impide crear clases que terminan después de las 22:00 y permite las 22:00', async () => {
  const wrapper = mount(ReservationsView); await flushPromises()
  const form = wrapper.get('.agenda-block-panel form')
  await form.get('input[type="datetime-local"]').setValue('2026-11-03T21:30')
  await form.findAll('select')[1].setValue('2')
  await form.trigger('submit'); await flushPromises()
  expect(api.post).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('22:00')
  await form.get('input[type="datetime-local"]').setValue('2026-11-03T21:00')
  await form.trigger('submit'); await flushPromises()
  expect(api.post).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

const item = { id: 1, user_id: 1, user_name: 'Alumno', user_email: 'alumno@example.com', topic: 'Química ESO', note: 'Química ESO', starts_at: '2026-11-03T19:00:00Z', ends_at: '2026-11-03T20:00:00Z', status: 'confirmed', materials: [], is_historical: false }

it('permite al alumno solicitar de 21:30 a 22:00 sin ofrecer finales posteriores', async () => {
  session.user = { role: 'student' } as any
  vi.mocked(api.post).mockResolvedValue({ data: {} } as any)
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.topic-input select').setValue('Química ESO')
  const [start, end] = wrapper.findAll('.range-selectors select')
  await start!.setValue('21:30')
  expect(end!.findAll('option').map(option => option.element.value)).toEqual(['', '22:00'])
  await end!.setValue('22:00')
  await wrapper.get('.reserve-range').trigger('click'); await flushPromises()
  expect(api.post).toHaveBeenCalledWith('/bookings', expect.objectContaining({ starts_at: '2026-11-02T20:30:00.000Z', duration_slots: 1 }))
  wrapper.unmount()
})

it('representa una clase de 21:00 a 22:00 en la vista semanal', async () => {
  const late = { ...item, starts_at: '2026-11-03T20:00:00Z', ends_at: '2026-11-03T21:00:00Z' }
  vi.mocked(api.get).mockImplementation((url) => Promise.resolve({ data: url === '/admin/users' ? [] : [late] }) as any)
  const wrapper = mount(ReservationsView); await flushPromises()
  const event = wrapper.get('.week-event')
  expect(wrapper.findAll('.timeline-hour').map(label => label.text())).toContain('22')
  expect(event.attributes('style')).toContain('top: 364px')
  expect(event.attributes('style')).toContain('height: 26px')
  expect(event.attributes('style')).not.toContain('display: none')
  wrapper.unmount()
})

it.each(['calendar', 'classes'])('valida edición desde %s y conserva el comentario', async (view) => {
  vi.mocked(api.get).mockImplementation((url) => Promise.resolve({ data: url === '/admin/users' ? [] : [item] }) as any)
  vi.mocked(api.patch).mockResolvedValue({ data: item } as any)
  const wrapper = view === 'calendar' ? mount(ReservationsView) : mount(ClassesView, { global: { stubs: { MaterialViewer: true } } })
  await flushPromises()
  await wrapper.get(view === 'calendar' ? '.week-event' : '.edit-button').trigger('click')
  const form = wrapper.get(view === 'calendar' ? '.calendar-manage-card' : '.edit-class-card')
  await form.get('input[type="time"]').setValue('21:30')
  await form.trigger('submit'); await flushPromises()
  expect(api.patch).not.toHaveBeenCalled()
  expect(form.text()).toContain('22:00')
  await form.get('input[type="time"]').setValue('21:00')
  await form.get('textarea').setValue('Comentario conservado')
  await form.trigger('submit'); await flushPromises()
  expect(api.patch).toHaveBeenCalledWith('/admin/classes/1', expect.objectContaining({ admin_comment: 'Comentario conservado' }))
  wrapper.unmount()
})
