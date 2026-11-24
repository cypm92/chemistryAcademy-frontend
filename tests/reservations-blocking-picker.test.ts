// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ReservationsView from '../src/views/ReservationsView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, errorMessage: () => 'Error de red' }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-02T06:00:00Z'))
  vi.mocked(api.get).mockResolvedValue({ data: [] } as any)
  session.user = { role: 'student' } as any
})

it('abre los selectores de fecha de bloqueo con el fallback nativo', async () => {
  session.user = { role: 'admin' } as any
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.agenda-block-panel select').setValue('block')
  const inputs = wrapper.findAll('.agenda-block-panel input[type="date"]')
  expect(inputs).toHaveLength(2)
  const picker = vi.fn()
  for (const input of inputs) Object.defineProperty(input.element, 'showPicker', { configurable: true, value: picker })
  await inputs[0].trigger('click'); await inputs[1].trigger('click')
  expect(picker).toHaveBeenCalledTimes(2)
  expect(picker.mock.instances).toEqual([inputs[0].element, inputs[1].element])
  Object.defineProperty(inputs[0].element, 'showPicker', { configurable: true, value: undefined })
  await inputs[0].trigger('click')
  Object.defineProperty(inputs[0].element, 'showPicker', { configurable: true, value: () => { throw new Error('no disponible') } })
  await inputs[0].trigger('click')
  wrapper.unmount()
})

it('no arrastra un rango de administración seleccionado al cambiar de día', async () => {
  session.user = { role: 'admin' } as any
  const wrapper = mount(ReservationsView); await flushPromises()
  const [start, end] = wrapper.get('.agenda-block-panel form').findAll('.range-selectors select')
  await start.setValue('10:00')
  await end.setValue('10:30')
  expect((start.element as HTMLSelectElement).value).toBe('10:00')
  // Elegir otro día en la vista semanal (chooseDate) debe limpiar el rango seleccionado,
  // igual que lo hacía la navegación de día en la vista móvil ya retirada.
  const otherDay = wrapper.findAll('.week-day').find(day => !day.classes('selected'))!
  await otherDay.trigger('click')
  expect((start.element as HTMLSelectElement).value).toBe('')
  expect((end.element as HTMLSelectElement).value).toBe('')
  expect((wrapper.get('.agenda-block-panel form button.primary').element as HTMLButtonElement).disabled).toBe(true)
  wrapper.unmount()
})

const HALF_HOUR_OPTIONS = ['', ...Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
)]

it('el selector de hora de bloquear una franja solo ofrece minutos en punto o y media', async () => {
  session.user = { role: 'admin' } as any
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.agenda-block-panel select').setValue('block')
  const [startTime, endTime] = wrapper.get('.agenda-block-panel form').findAll('.range-selectors select')
  expect(startTime.findAll('option').map(option => option.element.value)).toEqual(HALF_HOUR_OPTIONS)
  expect(endTime.findAll('option').map(option => option.element.value)).toEqual(HALF_HOUR_OPTIONS)
  wrapper.unmount()
})

it('el navegador rechaza forzar un minuto fuera de la cuadrícula en el selector (no es texto libre)', async () => {
  session.user = { role: 'admin' } as any
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.agenda-block-panel select').setValue('block')
  const [startTime] = wrapper.get('.agenda-block-panel form').findAll('.range-selectors select')
  const el = startTime.element as HTMLSelectElement
  el.value = '10:15' // no hay <option> con ese valor
  expect(el.value).toBe('') // HTMLSelectElement ignora valores sin opción coincidente, por espec.
  wrapper.unmount()
})

it('impide bloquear si la hora de inicio no es anterior a la de fin, con mensaje accesible', async () => {
  session.user = { role: 'admin' } as any
  vi.mocked(api.post).mockResolvedValue({ data: {} } as any)
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.agenda-block-panel select').setValue('block')
  const form = wrapper.get('.agenda-block-panel form')
  const [startDate, endDate] = form.findAll('input[type="date"]')
  const [startTime, endTime] = form.findAll('.range-selectors select')
  await startDate.setValue('2026-11-10')
  await startTime.setValue('10:00')
  await endDate.setValue('2026-11-10')
  await endTime.setValue('10:00') // igual al inicio: no es un rango válido
  await form.trigger('submit'); await flushPromises()
  expect(api.post).not.toHaveBeenCalled()
  expect(wrapper.get('[role="alert"]').text()).toContain('anterior')
  await endTime.setValue('09:30') // anterior al inicio
  await form.trigger('submit'); await flushPromises()
  expect(api.post).not.toHaveBeenCalled()
  expect(wrapper.get('[role="alert"]').text()).toContain('anterior')
  await endTime.setValue('10:30') // ahora el fin es posterior al inicio
  await form.trigger('submit'); await flushPromises()
  expect(api.post).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

it('permite bloquear un rango que cruza la medianoche y envía el payload UTC exacto', async () => {
  session.user = { role: 'admin' } as any
  vi.mocked(api.post).mockResolvedValue({ data: {} } as any)
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.agenda-block-panel select').setValue('block')
  const form = wrapper.get('.agenda-block-panel form')
  const [startDate, endDate] = form.findAll('input[type="date"]')
  const [startTime, endTime] = form.findAll('.range-selectors select')
  await startDate.setValue('2026-11-10')
  await startTime.setValue('23:30')
  await endDate.setValue('2026-11-11')
  await endTime.setValue('00:30')
  await form.trigger('submit'); await flushPromises()
  expect(api.post).toHaveBeenCalledWith('/admin/bookings/block', expect.objectContaining({
    starts_at: '2026-11-10T22:30:00.000Z',
    ends_at: '2026-11-10T23:30:00.000Z',
    status: 'blocked',
  }))
  wrapper.unmount()
})

it('rechaza con mensaje accesible las horas de bloqueo inexistentes o ambiguas por el cambio de hora de Madrid', async () => {
  session.user = { role: 'admin' } as any
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.agenda-block-panel select').setValue('block')
  const form = wrapper.get('.agenda-block-panel form')
  const [startDate, endDate] = form.findAll('input[type="date"]')
  const [startTime, endTime] = form.findAll('.range-selectors select')
  // 2026-03-29: el reloj de Madrid salta de 02:00 a 03:00; las 02:30 no existen esa noche.
  await startDate.setValue('2026-03-29')
  await startTime.setValue('02:30')
  await endDate.setValue('2026-03-29')
  await endTime.setValue('04:00')
  await form.trigger('submit'); await flushPromises()
  expect(api.post).not.toHaveBeenCalled()
  expect(wrapper.get('[role="alert"]').text()).toContain('no existe')
  // 2026-10-25: el reloj retrocede de 03:00 a 02:00; las 02:30 ocurren dos veces, son ambiguas.
  await startDate.setValue('2026-10-25')
  await startTime.setValue('02:30')
  await endDate.setValue('2026-10-25')
  await endTime.setValue('04:00')
  await form.trigger('submit'); await flushPromises()
  expect(api.post).not.toHaveBeenCalled()
  expect(wrapper.get('[role="alert"]').text()).toContain('ambigua')
  wrapper.unmount()
})

const historicalBlock = {
  id: 42,
  starts_at: '2026-11-03T19:15:00Z', // 20:15 en Madrid (invierno, UTC+1): fuera de la cuadrícula de media hora
  ends_at: '2026-11-03T20:15:00Z', // 21:15 en Madrid
  status: 'blocked' as const,
  note: 'Histórico',
  admin_comment: '',
  user_id: null,
  user_name: null,
  is_mine: false,
}

it('conserva editable un bloqueo histórico fuera de la cuadrícula sin forzarlo a cambiar', async () => {
  session.user = { role: 'admin' } as any
  vi.mocked(api.get).mockResolvedValue({ data: [historicalBlock] } as any)
  vi.mocked(api.patch).mockResolvedValue({ data: historicalBlock } as any)
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.week-event').trigger('click')
  const form = wrapper.get('.block-manage-card')
  const [startTime, endTime] = form.findAll('.calendar-manage-fields select')
  expect((startTime.element as HTMLSelectElement).value).toBe('20:15')
  expect((endTime.element as HTMLSelectElement).value).toBe('21:15')
  // Guardar sin tocar la hora conserva exactamente el instante histórico, sin redondear a la cuadrícula.
  await form.trigger('submit'); await flushPromises()
  expect(api.patch).toHaveBeenCalledWith('/admin/bookings/42/block', expect.objectContaining({
    starts_at: '2026-11-03T19:15:00.000Z',
    ends_at: '2026-11-03T20:15:00.000Z',
  }))
  wrapper.unmount()
})

it('al elegir una hora de la cuadrícula para un bloqueo histórico, la opción fuera de cuadrícula desaparece', async () => {
  session.user = { role: 'admin' } as any
  vi.mocked(api.get).mockResolvedValue({ data: [historicalBlock] } as any)
  const wrapper = mount(ReservationsView); await flushPromises()
  await wrapper.get('.week-event').trigger('click')
  const form = wrapper.get('.block-manage-card')
  const [startTime] = form.findAll('.calendar-manage-fields select')
  expect(startTime.findAll('option').map(option => option.element.value)).toContain('20:15')
  await startTime.setValue('09:00')
  expect(startTime.findAll('option').map(option => option.element.value)).not.toContain('20:15')
  expect((startTime.element as HTMLSelectElement).value).toBe('09:00')
  wrapper.unmount()
})
