// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryFolderTree, { type LibraryFolderNode } from '../src/components/LibraryFolderTree.vue'

const child: LibraryFolderNode = { id: 2, name: 'Orgánica', path: 'Química / Orgánica', parentId: 1, ownColor: null, materials: [], children: [], materialCount: 12, color: '#123456' }
const folder: LibraryFolderNode = { id: 1, name: 'Química', path: 'Química', parentId: null, ownColor: '#123456', materials: [], children: [child], materialCount: 123, color: '#123456' }
const unclassified: LibraryFolderNode = { id: 3, name: 'Sin clasificar', path: 'Sin clasificar', parentId: null, ownColor: null, materials: [], children: [], materialCount: 0, color: null }

describe('navegación de carpetas de biblioteca', () => {
  it('muestra un lápiz accesible para editar sin seleccionar la carpeta', async () => {
    const wrapper = mount(LibraryFolderTree, { props: { nodes: [folder], selectedPath: '', expandedPaths: [], admin: true } })
    const edit = wrapper.get('button[aria-label="Editar color de Química"]')
    expect(edit.find('svg').exists()).toBe(true)
    await edit.trigger('click')
    expect(wrapper.emitted('editColor')?.[0]).toEqual([folder])
    expect(wrapper.emitted('select')).toBeUndefined()
    await wrapper.get('.folder-nav-item').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([folder])
  })

  it('mantiene los contadores en una columna y el indicador de subcarpetas separado', () => {
    const wrapper = mount(LibraryFolderTree, { props: { nodes: [folder, unclassified], selectedPath: '', expandedPaths: [], admin: true } })
    expect(wrapper.findAll('.folder-nav-count').map(el => el.text())).toEqual(['123', '0'])
    expect(wrapper.get('.folder-nav-toggle').text()).toBe('›')
  })

  it('no ofrece el editor a alumnos ni a la carpeta raíz Sin clasificar', () => {
    const props = { nodes: [folder, unclassified], selectedPath: '', expandedPaths: [] }
    expect(mount(LibraryFolderTree, { props }).findAll('.folder-nav-color')).toHaveLength(0)
    const admin = mount(LibraryFolderTree, { props: { ...props, admin: true } })
    expect(admin.findAll('.folder-nav-color')).toHaveLength(1)
    expect(admin.find('[aria-label="Editar color de Sin clasificar"]').exists()).toBe(false)
  })

  it('propaga la edición de una subcarpeta expandida', async () => {
    const wrapper = mount(LibraryFolderTree, { props: { nodes: [folder], selectedPath: '', expandedPaths: ['Química'], admin: true } })
    await wrapper.get('[aria-label="Editar color de Orgánica"]').trigger('click')
    expect(wrapper.emitted('editColor')?.[0]).toEqual([child])
    expect(wrapper.get('[title="Química"]').attributes('aria-expanded')).toBe('true')
  })
})
