// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryView from '../src/views/LibraryView.vue'

const mocks = vi.hoisted(() => ({ get: vi.fn(), role: 'admin' }))
vi.mock('../src/services/session', () => ({ session: { get user() { return { role: mocks.role } } } }))
vi.mock('../src/services/api', () => ({ api: { get: mocks.get, post: vi.fn() }, errorMessage: (e: Error) => e.message }))
const folders = [
  { id: 1, name: 'Química', path: 'Química', parent_id: null, color: null, effective_color: null },
  { id: 2, name: 'Physics', path: 'Physics', parent_id: null, color: null, effective_color: null },
]
const materials = [
  { id: 1, title: 'Ácidos', description: 'Reacción química', filename: 'acidos.pdf', folder: folders[0], kind: 'pdf', tags: [{ id: 1, name: 'Química' }], is_favorite: false },
  { id: 2, title: 'Óptica', description: 'Lentes y luz', filename: 'optica.pdf', folder: folders[1], kind: 'pdf', tags: [{ id: 2, name: 'Luz' }], is_favorite: false },
  { id: 3, title: 'Otro', description: 'Material extra', filename: 'Química_secreta.pdf', folder: folders[1], kind: 'pdf', tags: [{ id: 3, name: 'Química' }], is_favorite: false },
]
const studentMaterials = materials
beforeEach(() => {
  mocks.role = 'admin'
  mocks.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/folders' ? folders : url === '/admin/materials' || url === '/materials' ? studentMaterials : url === '/folders' ? folders : [] }))
})
async function view(role: 'admin' | 'student') {
  mocks.role = role
  const wrapper = mount(LibraryView, { global: { stubs: { MaterialViewer: true } } })
  await flushPromises()
  await wrapper.get('.folder-nav-item[title="Physics"]').trigger('click')
  await flushPromises()
  return wrapper
}
const titles = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.material-card h3').map(el => el.text())

it.each(['admin', 'student'] as const)('%s: búsqueda de texto parcial e insensible a mayúsculas', async role => {
  const wrapper = await view(role)
  const input = wrapper.get('input[type="search"]')
  for (const [query, result] of [['ÓPTI', ['Óptica']], ['lUz', ['Óptica']], ['OPTICA.PD', ['Óptica']], ['Physics', []], ['#', []]] as const) {
    await input.setValue(query)
    expect(titles(wrapper)).toEqual(result)
  }
  wrapper.unmount()
})
it.each(['admin', 'student'] as const)('%s: búsqueda por etiquetas, alcance y capacidad de reordenar', async role => {
  const wrapper = await view(role)
  const input = wrapper.get('input[type="search"]')
  const scope = wrapper.get('.search-scope input')
  const selectMode = async (mode: string) => {
    const button = wrapper.findAll('.search-mode button').find(candidate => candidate.text() === mode)
    expect(button, `mode button ${mode}`).toBeDefined()
    await button!.trigger('click')
    expect(button!.attributes('aria-pressed')).toBe('true')
  }
  await selectMode('Etiquetas')
  await input.setValue('Luz')
  expect(titles(wrapper)).toEqual(['Óptica'])
  await scope.setValue(true)
  await flushPromises()
  expect(titles(wrapper)).toEqual(['Óptica'])
  await input.setValue('Luz')
  expect(titles(wrapper)).toEqual(['Óptica'])
  await input.setValue('#Luz')
  expect(titles(wrapper)).toEqual(['Óptica'])
  await selectMode('Archivos')
  expect(titles(wrapper)).toEqual([])
  await input.setValue('Physics')
  expect(titles(wrapper)).toEqual([])
  await selectMode('Etiquetas')
  await input.setValue('Química')
  expect(titles(wrapper)).toEqual(['Ácidos', 'Otro'])
  await input.setValue('#')
  expect(titles(wrapper)).toEqual(['Ácidos', 'Óptica', 'Otro'])
  expect(wrapper.text()).not.toContain('No se han encontrado archivos.')
  expect(wrapper.findComponent({ name: 'LibraryMaterialCard' }).props('canReorder')).toBe(false)
  await scope.setValue(false)
  await input.setValue('#')
  expect(titles(wrapper)).toEqual(['Óptica', 'Otro'])
  expect(wrapper.findComponent({ name: 'LibraryMaterialCard' }).props('canReorder')).toBe(true)
  await scope.setValue(true)
  await selectMode('Archivos')
  await input.setValue('Reacción química')
  expect(titles(wrapper)).toEqual(['Ácidos'])
  await input.setValue('inexistente')
  expect(titles(wrapper)).toEqual([])
  expect(wrapper.text()).toContain('No se han encontrado archivos.')
  wrapper.unmount()
})
