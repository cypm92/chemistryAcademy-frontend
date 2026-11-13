// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminView from '../src/views/AdminView.vue'

const fixtures = vi.hoisted(() => ({
  folders: [
    { id: 1, name: 'Sin clasificar', path: 'Sin clasificar', parent_id: null, color: null, effective_color: null },
    { id: 2, name: 'Química', path: 'Química', parent_id: null, color: null, effective_color: null },
    { id: 3, name: 'Orgánica', path: 'Química / Orgánica', parent_id: 2, color: null, effective_color: null },
  ] as Array<{ id: number; name: string; path: string; parent_id: number | null; color: null; effective_color: null }>,
  post: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('../src/services/api', () => ({
  api: {
    get: vi.fn((path: string) => Promise.resolve({ data: path === '/admin/folders' ? fixtures.folders : path === '/admin/tags' ? [{ id: 1, name: 'QUIMICA' }, { id: 2, name: 'BIOLOGIA' }] : path === '/admin/notification-settings' ? { reminder_interval_minutes: 1440 } : path === '/admin/public-resources' ? { exams: [], forms: [], videos: [], documents: [] } : [] })),
    post: fixtures.post,
    delete: fixtures.delete,
  },
  apiUrl: (path: string) => path,
  errorMessage: (error: Error) => error.message,
}))

async function openUpload() {
  const wrapper = mount(AdminView, { global: { stubs: { StudentsView: true, MicrosoftIntegration: true } } })
  await flushPromises()
  await wrapper.findAll('.admin-tabs button').find(button => button.text() === 'Gestión de carpetas')!.trigger('click')
  const form = wrapper.findAll('form').find(form => form.text().includes('Subir material'))!
  const file = new File(['pdf'], 'archivo.pdf', { type: 'application/pdf' })
  const input = form.get('input[type=file]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
  return { wrapper, form }
}

describe('selección de carpeta al subir material', () => {
  beforeEach(() => { fixtures.post.mockReset(); fixtures.post.mockResolvedValue({ data: {} }); fixtures.delete.mockReset(); fixtures.delete.mockResolvedValue({}); fixtures.folders = [
    { id: 1, name: 'Sin clasificar', path: 'Sin clasificar', parent_id: null, color: null, effective_color: null },
    { id: 2, name: 'Química', path: 'Química', parent_id: null, color: null, effective_color: null },
    { id: 3, name: 'Orgánica', path: 'Química / Orgánica', parent_id: 2, color: null, effective_color: null },
  ] })

  it('confirma antes de eliminar globalmente una etiqueta desde subida', async () => {
    const { form, wrapper } = await openUpload()
    await form.get('button[aria-label="Mostrar etiquetas existentes"]').trigger('click')
    await form.get('button[aria-label="Eliminar etiqueta BIOLOGIA"]').trigger('click')
    expect(fixtures.delete).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('permisos')
    await wrapper.get('button[data-confirm-delete-tag]').trigger('click')
    await flushPromises()
    expect(fixtures.delete).toHaveBeenCalledWith('/admin/tags/2')
    expect(form.find('button[aria-label="Eliminar etiqueta BIOLOGIA"]').exists()).toBe(false)
  })

  it('selecciona etiquetas existentes y nuevas y las envía sin duplicados', async () => {
    const { form } = await openUpload()
    await form.get('button[aria-label="Mostrar etiquetas existentes"]').trigger('click')
    await form.get('input[aria-label="Buscar etiquetas existentes"]').setValue('bio')
    await form.get('button[aria-label="Seleccionar etiqueta BIOLOGIA"]').trigger('click')
    await form.get('input[name="tag"]').setValue('NUEVA, BIOLOGIA')
    await form.get('button[aria-label="Añadir etiqueta"]').trigger('click')
    await form.trigger('submit'); await flushPromises()
    const call = fixtures.post.mock.calls.find(args => args[0] === '/admin/materials')!
    expect(call[1].get('tags')).toBe('BIOLOGIA,NUEVA')
    expect(call[1].get('folder_id')).toBe('1')
    expect(call[1].get('file').name).toBe('archivo.pdf')
  })

  it('no sube si hay texto de etiqueta pendiente de añadir', async () => {
    const { form, wrapper } = await openUpload()
    await form.get('input[name="tag"]').setValue('NUEVA')
    await form.trigger('submit'); await flushPromises()
    expect(fixtures.post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Añade la etiqueta escrita antes de subir')
  })

  it('ofrece el árbol y mantiene Sin clasificar como carpeta predeterminada', async () => {
    const { form } = await openUpload()
    expect(form.get('.folder-parent-trigger').text()).toContain('Sin clasificar')
    await form.get('.folder-parent-trigger').trigger('click')
    expect(form.find('.folder-parent-option.root').exists()).toBe(false)
    await form.get('[aria-label="Desplegar Química"]').trigger('click')
    expect(form.text()).toContain('Orgánica')
  })

  it('envía el identificador de la subcarpeta seleccionada', async () => {
    const { form } = await openUpload()
    await form.get('.folder-parent-trigger').trigger('click')
    await form.get('[aria-label="Desplegar Química"]').trigger('click')
    await form.findAll('.folder-parent-option').find(button => button.text().includes('Orgánica'))!.trigger('click')
    await form.trigger('submit')
    await flushPromises()
    const call = fixtures.post.mock.calls.find(args => args[0] === '/admin/materials')!
    expect(call[1].get('folder_id')).toBe('3')
  })

  it('no envía material si no hay carpeta disponible', async () => {
    fixtures.folders = []
    const { wrapper, form } = await openUpload()
    await form.trigger('submit')
    await flushPromises()
    expect(fixtures.post.mock.calls.some(args => args[0] === '/admin/materials')).toBe(false)
    expect(wrapper.text()).toContain('Selecciona una carpeta')
  })
})
