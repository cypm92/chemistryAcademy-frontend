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

it('ofrece la última prueba a las 20:00 y ninguna posterior', async () => {
  const wrapper = mount(TrialBookingModal, { global: { stubs: { RouterLink: true } } }); await flushPromises()
  const slots = wrapper.findAll('.trial-slots button')
  expect(slots.at(-1)?.text()).toBe('20:00')
  expect((slots.at(-1)?.element as HTMLButtonElement).disabled).toBe(false)
  wrapper.unmount()
})

it('impide crear clases que terminan después de las 21:00 y permite las 21:00', async () => {
  const wrapper = mount(ReservationsView); await flushPromises()
  const form = wrapper.get('.agenda-block-panel form')
  await form.get('input[type="datetime-local"]').setValue('2026-11-03T20:30')
  await form.findAll('select')[1].setValue('2')
  await form.trigger('submit'); await flushPromises()
  expect(api.post).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('21:00')
  await form.get('input[type="datetime-local"]').setValue('2026-11-03T20:00')
  await form.trigger('submit'); await flushPromises()
  expect(api.post).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

const item = { id: 1, user_id: 1, user_name: 'Alumno', user_email: 'alumno@example.com', topic: 'Química ESO', note: 'Química ESO', starts_at: '2026-11-03T19:00:00Z', ends_at: '2026-11-03T20:00:00Z', status: 'confirmed', materials: [], is_historical: false }

it.each(['calendar', 'classes'])('valida edición desde %s y conserva el comentario', async (view) => {
  vi.mocked(api.get).mockImplementation((url) => Promise.resolve({ data: url === '/admin/users' ? [] : [item] }) as any)
  vi.mocked(api.patch).mockResolvedValue({ data: item } as any)
  const wrapper = view === 'calendar' ? mount(ReservationsView) : mount(ClassesView, { global: { stubs: { MaterialViewer: true } } })
  await flushPromises()
  await wrapper.get(view === 'calendar' ? '.week-event' : '.edit-button').trigger('click')
  const form = wrapper.get(view === 'calendar' ? '.calendar-manage-card' : '.edit-class-card')
  await form.get('input[type="time"]').setValue('20:30')
  await form.trigger('submit'); await flushPromises()
  expect(api.patch).not.toHaveBeenCalled()
  expect(form.text()).toContain('21:00')
  await form.get('input[type="time"]').setValue('20:00')
  await form.get('textarea').setValue('Comentario conservado')
  await form.trigger('submit'); await flushPromises()
  expect(api.patch).toHaveBeenCalledWith('/admin/classes/1', expect.objectContaining({ admin_comment: 'Comentario conservado' }))
  wrapper.unmount()
})
