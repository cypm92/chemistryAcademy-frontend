// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminView from '../src/views/AdminView.vue'

const mocks = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('../src/services/api', () => ({
  api: {
    get: vi.fn((path: string) => Promise.resolve({ data: path === '/admin/public-resources' ? { exams: [{ id: 5, title: 'Examen', subject: 'quimica' }], forms: [], videos: [], documents: [] } : path === '/admin/notification-settings' ? { reminder_interval_minutes: 1440 } : path === '/home-content' ? { content: {} } : [] })),
    post: mocks.post, patch: mocks.patch, delete: mocks.delete,
  },
  apiUrl: (path: string) => path,
  errorMessage: () => 'Error de prueba',
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.post.mockResolvedValue({})
  mocks.patch.mockImplementation((_path, body) => Promise.resolve({ data: body }))
  mocks.delete.mockResolvedValue({})
})

async function open() {
  const wrapper = mount(AdminView, { attachTo: document.body, global: { stubs: { StudentsView: true, MicrosoftIntegration: true } } })
  await flushPromises()
  await wrapper.findAll('.admin-tabs button').find(button => button.text() === 'Gestionar Web inicio')!.trigger('click')
  await flushPromises()
  return wrapper
}

it('permite navegar pestañas con teclado y conserva los campos y archivos', async () => {
  const wrapper = await open()
  const exam = wrapper.get('#resource-tab-exam')
  expect(exam.attributes('aria-selected')).toBe('true')
  expect(wrapper.get('#resource-panel-exam').attributes('aria-labelledby')).toBe('resource-tab-exam')
  await wrapper.get('#resource-panel-exam input').setValue('Título conservado')
  const input = wrapper.get('#resource-panel-exam input[type=file]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['x'], 'examen.pdf')] })
  await input.trigger('change')
  await exam.trigger('keydown', { key: 'ArrowRight' })
  expect(document.activeElement?.id).toBe('resource-tab-document')
  expect(wrapper.get('#resource-tab-document').attributes('aria-selected')).toBe('true')
  expect(wrapper.get('#resource-panel-exam').isVisible()).toBe(false)
  await wrapper.get('#resource-tab-document').trigger('keydown', { key: 'End' })
  expect(document.activeElement?.id).toBe('resource-tab-video')
  await wrapper.get('#resource-tab-video').trigger('keydown', { key: 'Home' })
  expect(document.activeElement?.id).toBe('resource-tab-exam')
  expect((wrapper.get('#resource-panel-exam input').element as HTMLInputElement).value).toBe('Título conservado')
  await wrapper.get('#resource-panel-exam').trigger('submit'); await flushPromises()
  expect(mocks.post.mock.calls[0]![0]).toBe('/admin/public-resources/exams')
  expect(mocks.post.mock.calls[0]![1].get('file').name).toBe('examen.pdf')
  wrapper.unmount()
})

it('guarda portada embebida y mantiene el borrado de recursos', async () => {
  const wrapper = await open()
  expect(wrapper.find('.home-settings-card[role=dialog]').exists()).toBe(false)
  expect(wrapper.find('.home-settings-card button[type=button]').exists()).toBe(false)
  await wrapper.get('.home-settings-card textarea').setValue('Nuevo titular')
  await wrapper.get('.home-settings-card').trigger('submit'); await flushPromises()
  expect(mocks.patch.mock.calls[0]![0]).toBe('/admin/home-content')
  expect(mocks.patch.mock.calls[0]![1].content.hero_title).toBe('Nuevo titular')
  expect(wrapper.text()).toContain('Textos de la portada actualizados.')
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await wrapper.get('[aria-label="Eliminar Examen"]').trigger('click'); await flushPromises()
  expect(mocks.delete).toHaveBeenCalledWith('/admin/public-resources/5')
  vi.restoreAllMocks()
  wrapper.unmount()
})
