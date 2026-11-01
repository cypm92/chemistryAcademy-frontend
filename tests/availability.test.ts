// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TrialBookingModal from '../src/components/TrialBookingModal.vue'
import ReservationsView from '../src/views/ReservationsView.vue'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, errorMessage: () => 'Error de red' }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const deferred = () => { let resolve!: (value: any) => void; let reject!: (reason: any) => void; const promise = new Promise<any>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-02T06:00:00Z')); session.user = { role: 'student' } as any })

describe('disponibilidad', () => {
  it('muestra el contador total junto a la primera sección visible y en resultados vacíos', async () => {
    session.user = { role: 'admin' } as any
    const base = { user_id: 1, user_name: 'Alumno', user_email: 'alumno@example.com', topic: 'Química', starts_at: '2026-11-03T10:00:00Z', materials: [], is_historical: false }
    get.mockResolvedValue({ data: [{ ...base, id: 1, status: 'requested' }, { ...base, id: 2, status: 'confirmed' }] } as any)
    const wrapper = mount(ClassesView, { global: { stubs: { MaterialViewer: true } } }); await flushPromises()
    const heading = () => wrapper.find('.class-section-heading')
    expect(heading().text()).toContain('Solicitudes pendientes')
    expect(heading().text()).toContain('2 clases')
    const cards = wrapper.findAll('.class-card')
    expect(cards[0].get('.class-status').text()).toBe('Reservada')
    expect(cards[1].get('.class-status').text()).toBe('Confirmada')
    expect(cards[0].find('.class-main-title .eyebrow').exists()).toBe(false)
    expect(cards[0].findAll('.request-decision')).toHaveLength(2)
    const status = wrapper.findAll('.class-filters select').find(select => select.text().includes('Confirmadas'))!
    await status.setValue('confirmed')
    expect(heading().text()).toContain('Clases e historial')
    expect(heading().text()).toContain('1 clase')
    await status.setValue('cancelled')
    expect(heading().text()).toContain('0 clases')
    wrapper.unmount()
  })
  it('permite cambiar la vista desde la cabecera del calendario', async () => {
    get.mockResolvedValue({ data: [] } as any)
    const wrapper = mount(ReservationsView); await flushPromises()
    const buttons = wrapper.findAll('.calendar-head .calendar-view-toggle button')
    expect(buttons.map(button => button.text())).toEqual(['Semana', 'Mes', 'Año'])
    for (const [index, selector] of ['.week-calendar', '.month-calendar', '.year-calendar'].entries()) {
      await buttons[index].trigger('click')
      expect(buttons[index].attributes('aria-pressed')).toBe('true')
      expect(wrapper.find(selector).exists()).toBe(true)
    }
    expect(wrapper.find('.calendar-head-actions .calendar-nav').exists()).toBe(true)
    wrapper.unmount()
  })
  it('bloquea el modal mientras carga y después de fallo, y permite reintentar', async () => {
    const request = deferred(); get.mockReturnValueOnce(request.promise)
    const wrapper = mount(TrialBookingModal, { global: { stubs: { RouterLink: true } } })
    expect((wrapper.find('.trial-slots button').element as HTMLButtonElement).disabled).toBe(true)
    request.reject(new Error('red')); await flushPromises()
    expect((wrapper.find('.trial-slots button').element as HTMLButtonElement).disabled).toBe(true)
    get.mockResolvedValueOnce({ data: [] } as any)
    await wrapper.get('[data-testid="retry-availability"]').trigger('click'); await flushPromises()
    expect((wrapper.find('.trial-slots button').element as HTMLButtonElement).disabled).toBe(false)
    wrapper.unmount()
  })
  it('bloquea los selectores de alumno hasta una carga correcta y tras un error', async () => {
    const request = deferred(); get.mockReturnValueOnce(request.promise)
    const wrapper = mount(ReservationsView)
    const start = () => wrapper.get('.range-selectors select').element as HTMLSelectElement
    expect(start().disabled).toBe(true)
    request.reject(new Error('red')); await flushPromises()
    expect(start().disabled).toBe(true)
    get.mockResolvedValueOnce({ data: [] } as any)
    await wrapper.get('[data-testid="retry-availability"]').trigger('click'); await flushPromises()
    expect(start().disabled).toBe(false)
    expect(post).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('rechaza datos parciales en lugar de anunciar huecos libres', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 1, status: 'confirmed' }] } as any)
    const wrapper = mount(TrialBookingModal, { global: { stubs: { RouterLink: true } } }); await flushPromises()
    expect((wrapper.find('.trial-slots button').element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.find('[data-testid="retry-availability"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('una carga de alumnos fallida no invalida la agenda del administrador', async () => {
    session.user = { role: 'admin' } as any
    get.mockImplementation((url) => url === '/bookings' ? Promise.resolve({ data: [] }) : Promise.reject(new Error('usuarios')))
    const wrapper = mount(ReservationsView); await flushPromises()
    expect(wrapper.text()).toContain('No se pudieron cargar los alumnos')
    expect(wrapper.text()).not.toContain('No se pudo cargar el calendario')
    wrapper.unmount()
  })

  it('no duplica una reserva mientras el POST está en vuelo', async () => {
    get.mockResolvedValue({ data: [] } as any)
    const pending = deferred(); post.mockReturnValueOnce(pending.promise)
    const wrapper = mount(ReservationsView); await flushPromises()
    await wrapper.get('.topic-input select').setValue('Química ESO')
    const selects = wrapper.findAll('.range-selectors select')
    await selects[0].setValue('10:00'); await selects[1].setValue('10:30')
    const button = wrapper.get('.reserve-range')
    await button.trigger('click'); await button.trigger('click')
    expect(post).toHaveBeenCalledTimes(1)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
    pending.resolve({ data: {} }); await flushPromises(); wrapper.unmount()
  })

})
