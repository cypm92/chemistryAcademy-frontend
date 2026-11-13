// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
// Tests run in Node; the app tsconfig intentionally excludes Node types.
// @ts-expect-error Node types are not part of the browser tsconfig.
import { readFileSync } from 'node:fs'
import LibraryView from '../src/views/LibraryView.vue'

const f = vi.hoisted(() => ({ role: 'admin', patch: vi.fn(), get: vi.fn() }))
vi.mock('../src/services/session', () => ({ session: { get user() { return { role: f.role } } } }))
vi.mock('../src/services/api', () => ({ api: { get: f.get, patch: f.patch }, errorMessage: (e: Error) => e.message, protectedBlobUrl: vi.fn() }))
const folder = { id: 1, name: 'Química', path: 'Química', parent_id: null, color: null, effective_color: null }
const item = { id: 7, title: 'Original', description: '', folder, kind: 'pdf', filename: 'original.pdf', content_type: 'application/pdf', size_bytes: 100, can_download: true, tags: [{ id: 1, name: 'QUIMICA' }], is_favorite: false, grants: [] }
async function open() {
  const wrapper = mount(LibraryView, { attachTo: document.body, global: { stubs: { MaterialViewer: true } } })
  await flushPromises()
  return wrapper
}
async function edit(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('button[aria-label="Editar material Original"]').trigger('click')
  return wrapper.get('[role="dialog"][aria-label="Editar material"]')
}
beforeEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  f.role = 'admin'; f.patch.mockReset(); f.get.mockReset()
  f.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/folders' ? [folder] : url === '/admin/tags' ? [{ id: 1, name: 'QUIMICA' }, { id: 2, name: 'BIOLOGIA' }, { id: 3, name: 'FISICA' }] : [item] }))
  f.patch.mockImplementation((_url: string, data: { title: string; tags: string[] }) => Promise.resolve({ data: { ...item, title: data.title, tags: data.tags.map((name, id) => ({ id, name })) } }))
})
describe('edición de materiales', () => {
  it('permite que el diálogo se encoja dentro de la ventana', () => {
    const modalSource = readFileSync('src/components/MaterialEditModal.vue', 'utf8') as string
    expect(/\.folder-color-modal\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(modalSource)).toBe(true)
    expect(/\.material-edit-card\s*\{[^}]*min-width:\s*0/.test(modalSource)).toBe(true)
  })
  it('Escape cierra primero el selector y conserva la edición', async () => {
    const wrapper = await open(); const dialog = await edit(wrapper); await flushPromises()
    await dialog.get('input[name="title"]').setValue('Título editado')
    await dialog.get('button[aria-label="Mostrar etiquetas existentes"]').trigger('click')
    await dialog.get('input[aria-label="Buscar etiquetas existentes"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(dialog.find('input[aria-label="Buscar etiquetas existentes"]').exists()).toBe(false)
    expect((dialog.get('input[name="title"]').element as HTMLInputElement).value).toBe('Título editado')
    await dialog.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('mantiene el foco entre los controles del diálogo con Tab', async () => {
    const wrapper = await open(); const dialog = await edit(wrapper); await flushPromises()
    const first = dialog.get('button[aria-label="Cerrar"]').element as HTMLElement
    const last = dialog.get('button[type="submit"]').element as HTMLElement
    first.focus(); await dialog.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    last.focus(); await dialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    wrapper.unmount()
  })
  it('busca y selecciona etiquetas existentes sin duplicarlas', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = await open(); const dialog = await edit(wrapper); await flushPromises()
    await dialog.get('button[aria-label="Mostrar etiquetas existentes"]').trigger('click')
    await dialog.get('input[aria-label="Buscar etiquetas existentes"]').setValue('bio')
    await dialog.get('button[aria-label="Seleccionar etiqueta BIOLOGIA"]').trigger('click')
    await dialog.get('input[name="tag"]').setValue('quimica')
    await dialog.get('button[aria-label="Añadir etiqueta"]').trigger('click')
    expect(dialog.findAll('button[aria-label="Quitar etiqueta QUIMICA"]')).toHaveLength(1)
    await dialog.get('form').trigger('submit'); await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(f.patch).toHaveBeenCalledWith('/admin/materials/7', { title: 'Original', tags: ['QUIMICA', 'BIOLOGIA'] })
    wrapper.unmount()
  })
  it('permite reintentar si falla el catálogo sin perder el título', async () => {
    f.get.mockImplementation((url: string) => url === '/admin/tags' ? Promise.reject(new Error('Error catálogo')) : Promise.resolve({ data: url === '/admin/folders' ? [folder] : [item] }))
    const wrapper = await open(); const dialog = await edit(wrapper); await flushPromises()
    await dialog.get('input[name="title"]').setValue('Cambio')
    expect(dialog.text()).toContain('Error catálogo')
    f.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/tags' ? [{ id: 2, name: 'BIOLOGIA' }] : url === '/admin/folders' ? [folder] : [item] }))
    await dialog.get('button[aria-label="Reintentar cargar etiquetas"]').trigger('click'); await flushPromises()
    expect((dialog.get('input[name="title"]').element as HTMLInputElement).value).toBe('Cambio')
    await dialog.get('button[aria-label="Mostrar etiquetas existentes"]').trigger('click')
    expect(dialog.text()).toContain('BIOLOGIA')
    wrapper.unmount()
  })
  it('informa de carga y catálogo vacío sin impedir crear una etiqueta', async () => {
    let resolve!: (value: unknown) => void
    f.get.mockImplementation((url: string) => url === '/admin/tags' ? new Promise(done => { resolve = done }) : Promise.resolve({ data: url === '/admin/folders' ? [folder] : [item] }))
    const wrapper = await open(); const dialog = await edit(wrapper)
    expect(dialog.text()).toContain('Cargando etiquetas')
    resolve({ data: [] }); await flushPromises()
    await dialog.get('button[aria-label="Mostrar etiquetas existentes"]').trigger('click')
    expect(dialog.text()).toContain('No hay etiquetas disponibles')
    await dialog.get('input[name="tag"]').setValue('NUEVA')
    await dialog.get('button[aria-label="Añadir etiqueta"]').trigger('click')
    expect(dialog.find('button[aria-label="Quitar etiqueta NUEVA"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('permite seleccionar varias etiquetas y no muestra las ya añadidas', async () => {
    const wrapper = await open(); const dialog = await edit(wrapper); await flushPromises()
    await dialog.get('button[aria-label="Mostrar etiquetas existentes"]').trigger('click')
    expect(dialog.find('button[aria-label="Seleccionar etiqueta QUIMICA"]').exists()).toBe(false)
    await dialog.get('button[aria-label="Seleccionar etiqueta BIOLOGIA"]').trigger('click')
    await dialog.get('button[aria-label="Seleccionar etiqueta FISICA"]').trigger('click')
    expect(dialog.find('button[aria-label="Quitar etiqueta BIOLOGIA"]').exists()).toBe(true)
    expect(dialog.find('button[aria-label="Quitar etiqueta FISICA"]').exists()).toBe(true)
    expect(dialog.find('button[aria-label="Seleccionar etiqueta BIOLOGIA"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('no ofrece edición a usuarios no administradores', async () => {
    f.role = 'guest'; const wrapper = await open()
    expect(wrapper.find('button[aria-label^="Editar material"]').exists()).toBe(false)
    expect(f.get).not.toHaveBeenCalledWith('/admin/tags')
    wrapper.unmount()
  })
  it('precarga, cancela sin guardar y permite Escape', async () => {
    const wrapper = await open(); let dialog = await edit(wrapper)
    expect((dialog.get('input[name="title"]').element as HTMLInputElement).value).toBe('Original')
    expect(dialog.text()).toContain('QUIMICA')
    await dialog.get('input[name="title"]').setValue('Cambio')
    await dialog.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(f.patch).not.toHaveBeenCalled()
    dialog = await edit(wrapper)
    expect((dialog.get('input[name="title"]').element as HTMLInputElement).value).toBe('Original')
    wrapper.unmount()
  })
  it('guarda solo título sin aviso y actualiza la tarjeta con la respuesta', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const wrapper = await open(); const dialog = await edit(wrapper)
    await dialog.get('input[name="title"]').setValue('Nuevo título')
    await dialog.get('form').trigger('submit'); await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(f.patch).toHaveBeenCalledWith('/admin/materials/7', { title: 'Nuevo título', tags: ['QUIMICA'] })
    expect(wrapper.get('.material-card h3').text()).toBe('Nuevo título')
    wrapper.unmount()
  })
  it('confirma el cambio de etiquetas y cancelar no envía solicitud', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const wrapper = await open(); const dialog = await edit(wrapper)
    await dialog.get('button[aria-label="Quitar etiqueta QUIMICA"]').trigger('click')
    await dialog.get('input[name="tag"]').setValue('BIOLOGIA')
    await dialog.get('button[aria-label="Añadir etiqueta"]').trigger('click')
    await dialog.get('form').trigger('submit'); await flushPromises()
    expect(f.patch).not.toHaveBeenCalled()
    expect(dialog.text()).toContain('BIOLOGIA')
    expect(confirm.mock.calls[0][0]).toMatch(/acceso/i)
    await dialog.get('form').trigger('submit'); await flushPromises()
    expect(f.patch).toHaveBeenCalledWith('/admin/materials/7', { title: 'Original', tags: ['BIOLOGIA'] })
    expect(wrapper.get('.material-tags').text()).toContain('BIOLOGIA')
    wrapper.unmount()
  })
  it('conserva datos editados y muestra el error si falla la petición', async () => {
    f.patch.mockRejectedValueOnce(new Error('No se pudo guardar'))
    const wrapper = await open(); const dialog = await edit(wrapper)
    await dialog.get('input[name="title"]').setValue('Sin perder')
    await dialog.get('form').trigger('submit'); await flushPromises()
    expect(dialog.text()).toContain('No se pudo guardar')
    expect((dialog.get('input[name="title"]').element as HTMLInputElement).value).toBe('Sin perder')
    expect(wrapper.get('.material-card h3').text()).toBe('Original')
    wrapper.unmount()
  })
  it('conserva permisos y descarga mostrados al recibir MaterialOut sin grants', async () => {
    const original = { ...item, grants: [{ id: 8, user_id: 2, material_id: 7, starts_at: '2026-01-01T00:00:00Z', expires_at: '2028-01-01T00:00:00Z', can_download: true, user: { id: 2, name: 'Alumno', email: 'test@example.invalid', role: 'guest', is_active: true, has_avatar: false } }] }
    f.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/folders' ? [folder] : [original] }))
    f.patch.mockResolvedValue({ data: { ...item, title: 'Nuevo título', can_download: false, grants: undefined } })
    const wrapper = await open(); const dialog = await edit(wrapper)
    await dialog.get('input[name="title"]').setValue('Nuevo título')
    await dialog.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('Alumno')
    expect(wrapper.text()).toContain('Descargar')
    wrapper.unmount()
  })
  it('mantiene el diálogo abierto y bloquea controles mientras guarda', async () => {
    let resolve!: (value: unknown) => void
    f.patch.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const wrapper = await open(); const dialog = await edit(wrapper)
    await dialog.get('form').trigger('submit')
    expect(dialog.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await dialog.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    resolve({ data: item }); await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('sitúa el foco al abrir y lo devuelve al cerrar', async () => {
    const wrapper = await open()
    const button = wrapper.get('button[aria-label="Editar material Original"]')
    ;(button.element as HTMLElement).focus()
    const dialog = await edit(wrapper); await flushPromises()
    expect(document.activeElement).toBe(dialog.get('input[name="title"]').element)
    await dialog.get('button').trigger('click')
    expect(document.activeElement).toBe(button.element)
    wrapper.unmount()
  })
})
