// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryMaterialCard from '../src/components/LibraryMaterialCard.vue'
import { permissionTimeoutToast } from '../src/services/permissionTimeoutToast'
vi.mock('../src/services/session', () => ({ session: { user: { role: 'admin' } } }))
vi.mock('../src/services/api', () => ({ api: {}, errorMessage: String, protectedBlobUrl: vi.fn() }))
describe('vías de acceso en biblioteca', () => {
  it('muestra una sola vez el alumno con acceso directo y por etiqueta', async () => {
    const user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest', is_active: true, has_avatar: false }
    const direct = { id: 1, user_id: 3, material_id: 7, starts_at: '2026-01-01T00:00:00Z', expires_at: '2029-01-01T00:00:00Z', can_download: false }
    const item = { id: 7, title: 'Archivo', description: '', folder: null, kind: 'pdf', filename: 'a.pdf', content_type: 'application/pdf', size_bytes: 1, can_download: false, tags: [], is_favorite: false, grants: [], sharing: [{ user, direct, tags: [{ id: 5, name: 'QUIMICA' }] }] }
    const wrapper = mount(LibraryMaterialCard, { props: { item } })
    await wrapper.get('button[aria-label="Compartido con: Archivo"]').trigger('click')
    expect(wrapper.findAll('.share-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('QUIMICA')
    expect(wrapper.text()).toContain('Directo')
  })
  it('propaga un cambio notificado por el modal de materiales', async () => {
    const user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
    const item = { id: 7, title: 'Archivo', description: '', folder: null, kind: 'pdf' as const, filename: 'a.pdf', content_type: 'application/pdf', size_bytes: 1, can_download: false, tags: [], is_favorite: false, grants: [], sharing: [{ user, direct: null, tags: [] }] }
    const wrapper = mount(LibraryMaterialCard, { props: { item }, global: { stubs: { StudentMaterialsModal: { template: '<button class="fake-change" @click="$emit(\'changed\')">Cambio</button>' } } } })
    await wrapper.get('button[aria-label="Compartido con: Archivo"]').trigger('click')
    await wrapper.get('button[aria-label="Editar accesos de Alumna"]').trigger('click')
    await wrapper.get('.fake-change').trigger('click')
    expect(wrapper.emitted('changed')).toHaveLength(1)
    wrapper.unmount()
  })
  it('oculta accesos anteriores en Biblioteca cuando el resultado es desconocido', async () => {
    const user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
    const item = { id: 7, title: 'Archivo', description: '', folder: null, kind: 'pdf' as const, filename: 'a.pdf', content_type: 'application/pdf', size_bytes: 1, can_download: false, tags: [], is_favorite: false, grants: [], sharing: [{ user, direct: null, tags: [{ id: 5, name: 'QUIMICA' }] }] }
    permissionTimeoutToast.value = ''
    const wrapper = mount(LibraryMaterialCard, { props: { item } })
    await wrapper.get('button[aria-label="Compartido con: Archivo"]').trigger('click')
    expect(wrapper.find('.share-row').exists()).toBe(true)
    permissionTimeoutToast.value = 'Internal error, please reload the page'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.share-row').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Compartido con: Archivo"]').attributes('disabled')).toBeDefined()
    wrapper.unmount(); permissionTimeoutToast.value = ''
  })
})
