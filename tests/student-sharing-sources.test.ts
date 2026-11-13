// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StudentsView from '../src/views/StudentsView.vue'
const get = vi.hoisted(() => vi.fn())
vi.mock('../src/services/api', () => ({ api: { get }, errorMessage: String }))
describe('materiales compartidos por etiqueta', () => {
  it('identifica el acceso directo aún no iniciado', async () => {
    const user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest', is_active: true }
    const direct = { id: 1, starts_at: '2098-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', can_download: false }
    get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [user] : [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct, tags: [] }] }))
    const wrapper = mount(StudentsView); await flushPromises()
    await wrapper.get('.materials-button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Directo pendiente')
  })
  it('distingue un acceso directo caducado de un acceso activo por etiqueta', async () => {
    const user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest', is_active: true }
    const direct = { id: 1, starts_at: '2020-01-01T00:00:00Z', expires_at: '2021-01-01T00:00:00Z', can_download: false }
    get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [user] : [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct, tags: [{ id: 2, name: 'QUIMICA' }] }] }))
    const wrapper = mount(StudentsView); await flushPromises()
    await wrapper.get('.materials-button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Directo caducado')
    expect(wrapper.text()).toContain('Etiqueta: QUIMICA')
  })
  it('muestra el archivo y sus vías una sola vez', async () => {
    const user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest', is_active: true }
    const direct = { id: 1, starts_at: '2020-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', can_download: false }
    get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [user] : [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct, tags: [{ id: 2, name: 'QUIMICA' }] }] }))
    const wrapper = mount(StudentsView); await flushPromises()
    await wrapper.get('.materials-button').trigger('click'); await flushPromises()
    expect(wrapper.findAll('.student-grant-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('QUIMICA')
    expect(wrapper.text()).toContain('Directo')
    expect(wrapper.text()).toContain('Descarga directa')
  })
})
