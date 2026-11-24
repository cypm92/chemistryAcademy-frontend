// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }, errorMessage: () => 'Error' }))
const item = (id: number, starts_at: string, extra = {}) => ({ id, starts_at, ends_at: new Date(Date.parse(starts_at) + 3600000).toISOString(), status: 'requested', management_status: null, is_historical: false, topic: `Clase ${id}`, admin_comment: '', user_id: 2, user_name: 'Alumna', user_email: 'test@example.com', materials: [], ...extra })
const tab = (wrapper: any, index: number) => wrapper.findAll('[role=tab]')[index].trigger('click')
const ids = (wrapper: any) => wrapper.findAll('.class-card').map((card: any) => card.attributes('id'))
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-29T21:59:30Z')); session.user = { role: 'admin' } as any; vi.mocked(api.get).mockReset(); vi.mocked(api.delete).mockReset(); vi.mocked(api.patch).mockReset() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it.each(['admin', 'student'])('clasifica frontera de Madrid y cambio de hora para %s, y actualiza al cambiar el día', async role => {
  session.user = { role } as any
  vi.mocked(api.get).mockResolvedValue({ data: [item(1, '2026-03-28T22:59:59Z', { is_historical: true }), item(2, '2026-03-28T23:00:00Z', { is_historical: true }), item(3, '2026-03-29T00:30:00Z'), item(4, '2026-03-29T01:30:00Z'), item(5, '2026-03-29T22:00:00Z')] })
  const w = mount(ClassesView); await flushPromises()
  // Hoy ordena ascendente por inicio (al revés que Historial/Futuras, que mantienen el orden descendente).
  expect(ids(w)).toEqual(['class-card-2', 'class-card-3', 'class-card-4'])
  await tab(w, 0); expect(ids(w)).toEqual(['class-card-1'])
  await tab(w, 2); expect(ids(w)).toEqual(['class-card-5'])
  await tab(w, 1); await vi.advanceTimersByTimeAsync(30000)
  expect(ids(w)).toEqual(['class-card-5'])
  w.unmount()
})
it.each(['admin', 'student'])('mantiene filtros por rol y navega pestañas con teclado: %s', async role => {
  session.user = { role } as any
  vi.mocked(api.get).mockResolvedValue({ data: [] })
  const w = mount(ClassesView, { attachTo: document.body }); await flushPromises()
  const filters = w.get('.class-filters')
  expect(filters.classes().includes('class-filters-admin')).toBe(role === 'admin')
  expect(filters.findAll('select')).toHaveLength(role === 'admin' ? 3 : 2)
  expect(filters.element.lastElementChild?.classList.contains('class-count')).toBe(true)
  const tabs = w.findAll('[role=tab]')
  const check = (index: number) => {
    expect(tabs.map(t => t.attributes('tabindex'))).toEqual(tabs.map((_, i) => i === index ? '0' : '-1'))
    expect(tabs[index].attributes('aria-selected')).toBe('true')
    expect(w.get('[role=tabpanel]').attributes('aria-labelledby')).toBe(tabs[index].attributes('id'))
    expect(document.activeElement).toBe(tabs[index].element)
  }
  tabs[1].element.focus()
  await tabs[1].trigger('keydown', { key: 'ArrowRight' }); check(2)
  await tabs[2].trigger('keydown', { key: 'ArrowRight' }); check(0)
  await tabs[0].trigger('keydown', { key: 'ArrowLeft' }); check(2)
  await tabs[2].trigger('keydown', { key: 'Home' }); check(0)
  await tabs[0].trigger('keydown', { key: 'End' }); check(2)
  w.unmount()
})
it('clasifica correctamente la hora repetida del cambio de otoño', async () => {
  vi.setSystemTime(new Date('2026-10-25T12:00:00Z'))
  vi.mocked(api.get).mockResolvedValue({ data: [item(1, '2026-10-24T21:59:59Z'), item(2, '2026-10-24T22:00:00Z'), item(3, '2026-10-25T00:30:00Z'), item(4, '2026-10-25T01:30:00Z'), item(5, '2026-10-25T23:00:00Z')] })
  const w = mount(ClassesView); await flushPromises()
  // Hoy ordena ascendente por inicio; Historial/Futuras conservan el orden descendente anterior.
  expect(ids(w)).toEqual(['class-card-2', 'class-card-3', 'class-card-4'])
  await tab(w, 0); expect(ids(w)).toEqual(['class-card-1'])
  await tab(w, 2); expect(ids(w)).toEqual(['class-card-5'])
  w.unmount()
})
it('muestra todas las clases ordenadas y conserva los filtros entre pestañas sin paginación', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: Array.from({ length: 12 }, (_, i) => item(12 - i, '2026-03-29T10:00:00Z', { topic: i < 7 ? 'Química' : 'Física' })) })
  const w = mount(ClassesView); await flushPromises()
  expect(ids(w)).toEqual(Array.from({ length: 12 }, (_, i) => `class-card-${i + 1}`))
  expect(w.get('.class-count').text()).toBe('12 clases')
  expect(w.find('.class-pagination').exists()).toBe(false)
  expect(w.text()).not.toMatch(/Clases por página|Página \d+ de|Anterior|Siguiente/)
  await w.get('.classes-search input').setValue('Química')
  expect(w.get('.class-count').text()).toBe('7 clases'); expect(ids(w)).toHaveLength(7)
  await tab(w, 0); expect(w.get('.classes-empty').exists()).toBe(true); expect(w.get('.class-filters .class-count').text()).toBe('0 clases')
  await tab(w, 1); expect(ids(w)).toHaveLength(7)
  w.unmount()
})
it('abre ambos selectores nativos y conserva la entrada manual y los filtros', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [item(1, '2026-03-29T10:00:00Z')] })
  const picker = vi.fn()
  const w = mount(ClassesView); await flushPromises()
  const inputs = w.findAll('.class-filters input[type=date]')
  expect(inputs).toHaveLength(2)
  expect(w.find('.class-filters button').exists()).toBe(false)
  for (const input of inputs) Object.defineProperty(input.element, 'showPicker', { configurable: true, value: picker })
  await inputs[0].trigger('click')
  await inputs[1].trigger('click')
  expect(picker).toHaveBeenCalledTimes(2)
  expect(picker.mock.instances).toEqual([inputs[0].element, inputs[1].element])
  await inputs[0].setValue('2026-03-30'); expect(w.get('.class-count').text()).toBe('0 clases')
  await inputs[0].setValue(''); await inputs[1].setValue('2026-03-28'); expect(ids(w)).toHaveLength(0)
  await inputs[1].setValue('2026-03-29'); expect(ids(w)).toHaveLength(1)
  Object.defineProperty(inputs[0].element, 'showPicker', { configurable: true, value: undefined })
  await inputs[0].trigger('click')
  Object.defineProperty(inputs[0].element, 'showPicker', { configurable: true, value: () => { throw new Error('no disponible') } })
  await inputs[0].trigger('click')
  w.unmount()
})
it('actualiza el listado tras borrar y editar una clase a otro día', async () => {
  const items = Array.from({ length: 6 }, (_, i) => item(i + 1, '2026-03-29T10:00:00Z', { topic: 'Química ESO', status: 'declined' }))
  vi.mocked(api.get).mockResolvedValue({ data: items }); vi.mocked(api.delete).mockResolvedValue({}); vi.spyOn(window, 'confirm').mockReturnValue(true)
  const w = mount(ClassesView); await flushPromises()
  await w.get('#class-card-6 .delete-class-button').trigger('click'); await flushPromises()
  expect(ids(w)).toHaveLength(5); expect(ids(w)).not.toContain('class-card-6')
  w.unmount()
  const editable = items.map(x => ({ ...x, status: 'requested' }))
  vi.mocked(api.get).mockResolvedValue({ data: editable }); vi.mocked(api.patch).mockResolvedValue({ data: { ...editable[5], starts_at: '2026-03-30T10:00:00Z' } })
  const v = mount(ClassesView); await flushPromises()
  await v.get('#class-card-6 .edit-button').trigger('click'); await v.get('.edit-class-card').trigger('submit'); await flushPromises()
  expect(ids(v)).toHaveLength(5); expect(ids(v)).not.toContain('class-card-6')
  await tab(v, 2); expect(ids(v)).toEqual(['class-card-6'])
  v.unmount()
})
it('ordena Hoy ascendente con entradas desordenadas y empates, conservando Historial/Futuras y los filtros', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: [
      item(3, '2026-03-29T18:00:00Z'),
      item(1, '2026-03-29T08:00:00Z'),
      item(5, '2026-03-29T08:00:00Z', { user_id: 3, user_name: 'Otro', user_email: 'otro@example.com' }),
      item(2, '2026-03-29T12:00:00Z'),
      item(10, '2026-03-28T10:00:00Z', { is_historical: true }),
      item(11, '2026-03-28T09:00:00Z', { is_historical: true }),
      item(20, '2026-03-30T10:00:00Z'),
      item(21, '2026-03-30T09:00:00Z'),
    ],
  })
  const w = mount(ClassesView); await flushPromises()
  // Hoy (pestaña activa por defecto): ascendente por inicio; empate 1/5 (mismo instante) se desempata por id ascendente.
  expect(ids(w)).toEqual(['class-card-1', 'class-card-5', 'class-card-2', 'class-card-3'])
  await tab(w, 0) // Historial: conserva el orden descendente anterior
  expect(ids(w)).toEqual(['class-card-10', 'class-card-11'])
  await tab(w, 2) // Futuras: conserva el orden descendente anterior
  expect(ids(w)).toEqual(['class-card-20', 'class-card-21'])
  await tab(w, 1)
  // Un filtro no altera el criterio de orden de la pestaña activa.
  const studentSelect = w.findAll('.class-filters select').find(select => select.text().includes('Todos los alumnos'))!
  await studentSelect.setValue('user:2')
  expect(ids(w)).toEqual(['class-card-1', 'class-card-2', 'class-card-3'])
  w.unmount()
})
it('acciones administrativas ordenadas, sin histórico; alumnado sin acciones administrativas', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [item(1, '2026-03-29T10:00:00Z', { status: 'confirmed', is_historical: true })] })
  const w = mount(ClassesView); await flushPromises()
  expect(w.get('.class-actions').text()).toMatch(/Adjuntar PDF o vídeo\s*Editar clase\s*Cancelar clase/)
  expect(w.text()).not.toMatch(/Mover a histórico|Restaurar clase|Clases habituales/)
  w.unmount(); session.user = { role: 'student' } as any
  const v = mount(ClassesView); await flushPromises(); expect(v.find('.class-actions').exists()).toBe(false); v.unmount()
})
