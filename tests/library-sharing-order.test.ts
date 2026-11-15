// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryView from '../src/views/LibraryView.vue'

const f = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../src/services/session', () => ({ session: { user: { role: 'admin' } } }))
vi.mock('../src/services/api', () => ({ api: { get: f.get, post: f.post }, errorMessage: (e: Error) => e.message, protectedBlobUrl: vi.fn() }))
const folder = { id: 1, name: 'Química', path: 'Química', parent_id: null, color: null, effective_color: null }
const base = { description: '', folder, kind: 'pdf', filename: 'a.pdf', size_bytes: 100, can_download: false, tags: [], is_favorite: false }
const items = [{ ...base, id: 1, title: 'Primero', sharing: [{ user: { id: 8, name: 'Alumna', email: 'alumna@example.test' }, direct: null, tags: [{ id: 1, name: 'QUÍMICA' }] }] }, { ...base, id: 2, title: 'Segundo', sharing: [] }]
beforeEach(() => {
  f.get.mockReset(); f.post.mockReset(); f.post.mockResolvedValue({})
  f.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/folders' ? [folder] : items }))
})
it('muestra accesos informativos y abre los materiales del alumno, volviendo al cerrar', async () => {
  const wrapper = mount(LibraryView, { attachTo: document.body, global: { stubs: { MaterialViewer: true, StudentMaterialsModal: { props: ['student'], template: '<button data-student-modal @click="$emit(\'close\')">{{ student.name }}</button>' } } } })
  await flushPromises()
  expect(wrapper.text()).not.toContain('Alumna')
  await wrapper.get('button[aria-label="Compartido con: Primero"]').trigger('click')
  expect(wrapper.get('[role="dialog"]').text()).toContain('Alumna')
  expect(wrapper.find('button[aria-label="Retirar acceso de Alumna"]').exists()).toBe(false)
  await wrapper.get('button[aria-label="Editar accesos de Alumna"]').trigger('click'); await flushPromises()
  expect(wrapper.get('[data-student-modal]').text()).toBe('Alumna')
  await wrapper.get('[data-student-modal]').trigger('click'); await flushPromises()
  expect(wrapper.get('[aria-label="Compartido con: Primero"]').isVisible()).toBe(true)
  expect(f.post).not.toHaveBeenCalled()
  wrapper.unmount()
})
it('permite subir un archivo de la carpeta', async () => {
  const wrapper = mount(LibraryView, { global: { stubs: { MaterialViewer: true } } }); await flushPromises()
  await wrapper.get('button[aria-label="Subir Segundo"]').trigger('click'); await flushPromises()
  expect(f.post).toHaveBeenCalledWith('/admin/materials/2/order', { direction: 'up' })
  wrapper.unmount()
})
it('muestra las flechas después de eliminar', async () => {
  const wrapper = mount(LibraryView, { global: { stubs: { MaterialViewer: true } } }); await flushPromises()
  const buttons = wrapper.findAll('.material-card')[0].findAll('.card-actions > button')
  const actions = buttons.map(button => button.attributes('aria-label') || button.text())
  expect(actions.slice(-3)).toEqual(['Eliminar', 'Subir Primero', 'Bajar Primero'])
  wrapper.unmount()
})
it('mueve el foco al diálogo y lo devuelve al cerrarlo con Escape', async () => {
  const wrapper = mount(LibraryView, { attachTo: document.body, global: { stubs: { MaterialViewer: true } } }); await flushPromises()
  const trigger = wrapper.get('button[aria-label="Compartido con: Primero"]')
  ;(trigger.element as HTMLElement).focus()
  await trigger.trigger('click'); await flushPromises()
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar')
  await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' }); await flushPromises()
  expect(document.activeElement).toBe(trigger.element)
  wrapper.unmount()
})
it('recarga los accesos efectivos después de editar las etiquetas', async () => {
  const wrapper = mount(LibraryView, { global: { stubs: { MaterialViewer: true, MaterialEditModal: true } } }); await flushPromises()
  await wrapper.get('button[aria-label="Editar material Primero"]').trigger('click')
  const previousLoads = f.get.mock.calls.filter(([url]) => url === '/admin/materials').length
  wrapper.getComponent({ name: 'MaterialEditModal' }).vm.$emit('saved', { ...items[0], tags: [{ id: 99, name: 'OTRA' }] })
  await flushPromises()
  expect(f.get.mock.calls.filter(([url]) => url === '/admin/materials').length).toBe(previousLoads + 1)
  wrapper.unmount()
})
it('no ofrece una lista desactualizada mientras se recargan los accesos', async () => {
  const wrapper = mount(LibraryView, { global: { stubs: { MaterialViewer: true, MaterialEditModal: true } } }); await flushPromises()
  await wrapper.get('button[aria-label="Editar material Primero"]').trigger('click')
  let resolve!: (value: unknown) => void
  f.get.mockImplementation((url: string) => url === '/admin/materials' ? new Promise(done => { resolve = done }) : Promise.resolve({ data: [folder] }))
  wrapper.getComponent({ name: 'MaterialEditModal' }).vm.$emit('saved', { ...items[0], tags: [{ id: 99, name: 'OTRA' }] })
  await wrapper.vm.$nextTick()
  expect((wrapper.get('button[aria-label="Compartido con: Primero"]').element as HTMLButtonElement).disabled).toBe(true)
  resolve({ data: items }); await flushPromises()
  expect((wrapper.get('button[aria-label="Compartido con: Primero"]').element as HTMLButtonElement).disabled).toBe(false)
  wrapper.unmount()
})
it('permite reintentar la carga de accesos cuando falla', async () => {
  const wrapper = mount(LibraryView, { global: { stubs: { MaterialViewer: true, MaterialEditModal: true } } }); await flushPromises()
  await wrapper.get('button[aria-label="Editar material Primero"]').trigger('click')
  f.get.mockImplementation((url: string) => url === '/admin/materials' ? Promise.reject(new Error('Error al cargar')) : Promise.resolve({ data: [folder] }))
  wrapper.getComponent({ name: 'MaterialEditModal' }).vm.$emit('saved', { ...items[0], tags: [{ id: 99, name: 'OTRA' }] })
  await flushPromises()
  expect(wrapper.text()).toContain('Error al cargar')
  f.get.mockResolvedValue({ data: items })
  await wrapper.get('button[aria-label="Reintentar accesos: Primero"]').trigger('click'); await flushPromises()
  expect(wrapper.find('button[aria-label="Compartido con: Primero"]').exists()).toBe(true)
  wrapper.unmount()
})
