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
  { id: 3, title: 'Otro', description: 'Material extra', filename: 'Química_secreta.pdf', folder: folders[1], kind: 'pdf', tags: [{ id: 1, name: 'Química' }, { id: 3, name: 'Extra' }], is_favorite: false },
]
// Catálogo admin con una etiqueta ("SoloAdmin") que no aparece en ningún material: debe verse en
// el popup de un admin (ve /admin/tags) pero no en el de un alumno (solo ve tags de sus materiales).
const tagCatalog = [{ id: 1, name: 'Química' }, { id: 2, name: 'Luz' }, { id: 3, name: 'Extra' }, { id: 4, name: 'SoloAdmin' }]
const studentMaterials = materials
beforeEach(() => {
  mocks.role = 'admin'
  mocks.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/folders' ? folders : url === '/admin/materials' || url === '/materials' ? studentMaterials : url === '/admin/tags' ? tagCatalog : url === '/folders' ? folders : [] }))
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
async function selectMode(wrapper: ReturnType<typeof mount>, mode: string) {
  const button = wrapper.findAll('.search-mode button').find(candidate => candidate.text() === mode)
  expect(button, `mode button ${mode}`).toBeDefined()
  await button!.trigger('click')
  expect(button!.attributes('aria-pressed')).toBe('true')
}

it.each(['admin', 'student'] as const)('%s: búsqueda de texto parcial e insensible a mayúsculas', async role => {
  const wrapper = await view(role)
  const input = wrapper.get('input[type="search"]')
  for (const [query, result] of [['ÓPTI', ['Óptica']], ['lUz', ['Óptica']], ['OPTICA.PD', ['Óptica']], ['Physics', []], ['#', []]] as const) {
    await input.setValue(query)
    expect(titles(wrapper)).toEqual(result)
  }
  wrapper.unmount()
})

it.each(['admin', 'student'] as const)('%s: popup de etiquetas con chips, filtro AND y alcance', async role => {
  const wrapper = await view(role)
  const scope = wrapper.get('.search-scope input')
  const chooseTag = async (name: string) => {
    const option = wrapper.findAll('.library-tag-option').find(el => el.text() === name)
    expect(option, `tag option ${name}`).toBeDefined()
    await option!.trigger('click')
  }
  await selectMode(wrapper, 'Etiquetas')
  // El input de texto desaparece en modo Etiquetas; el popup lo sustituye.
  expect(wrapper.find('input[type="search"]').exists()).toBe(false)
  await wrapper.get('button[aria-label="Mostrar etiquetas disponibles"]').trigger('click')
  const optionNames = wrapper.findAll('.library-tag-option').map(el => el.text())
  expect(optionNames).toEqual(expect.arrayContaining(['Química', 'Luz', 'Extra']))
  expect(optionNames.includes('SoloAdmin')).toBe(role === 'admin')

  // Carpeta Physics -> Óptica(Luz), Otro(Química+Extra). Filtro AND por una etiqueta.
  await chooseTag('Química')
  expect(titles(wrapper)).toEqual(['Otro'])
  expect(wrapper.get('.library-tag-chip').text()).toContain('Química')
  expect(wrapper.findComponent({ name: 'LibraryMaterialCard' }).props('canReorder')).toBe(false)

  await scope.setValue(true)
  await flushPromises()
  expect(titles(wrapper)).toEqual(['Ácidos', 'Otro'])

  // AND real: añadir una segunda etiqueta reduce el resultado, no lo amplía (no es OR).
  await chooseTag('Extra')
  expect(titles(wrapper)).toEqual(['Otro'])

  await wrapper.get('button[aria-label="Quitar etiqueta Química"]').trigger('click')
  expect(titles(wrapper)).toEqual(['Otro'])
  await wrapper.get('button[aria-label="Quitar etiqueta Extra"]').trigger('click')
  expect(titles(wrapper)).toEqual(['Ácidos', 'Óptica', 'Otro'])
  expect(wrapper.find('.library-tag-chip').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('No se han encontrado archivos.')
  await scope.setValue(false)
  await flushPromises()
  expect(wrapper.findComponent({ name: 'LibraryMaterialCard' }).props('canReorder')).toBe(true)

  // Cambiar a modo Archivos y volver no pierde la selección de chips (decisión explícita: persiste).
  await chooseTag('Luz')
  expect(titles(wrapper)).toEqual(['Óptica'])
  await selectMode(wrapper, 'Archivos')
  await selectMode(wrapper, 'Etiquetas')
  expect(wrapper.get('.library-tag-chip').text()).toContain('Luz')
  expect(titles(wrapper)).toEqual(['Óptica'])
  wrapper.unmount()
})

it('alumno sin etiquetas en sus materiales ve un estado vacío claro en el popup', async () => {
  mocks.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/materials' ? materials.map(material => ({ ...material, tags: [] })) : url === '/admin/folders' ? folders : [] }))
  const wrapper = await view('student')
  await selectMode(wrapper, 'Etiquetas')
  await wrapper.get('button[aria-label="Mostrar etiquetas disponibles"]').trigger('click')
  expect(wrapper.find('.library-tag-option').exists()).toBe(false)
  expect(wrapper.get('.library-tag-empty').text()).not.toBe('')
  wrapper.unmount()
})
