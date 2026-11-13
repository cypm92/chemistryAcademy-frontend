// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryMaterialCard from '../src/components/LibraryMaterialCard.vue'
vi.mock('../src/services/session', () => ({ session: { user: { role: 'admin' } } }))
vi.mock('../src/services/api', () => ({ api: {}, errorMessage: String, protectedBlobUrl: vi.fn() }))
describe('vías de acceso en biblioteca', () => {
  it('muestra una sola vez el alumno con acceso directo y por etiqueta', () => {
    const user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest', is_active: true, has_avatar: false }
    const direct = { id: 1, user_id: 3, material_id: 7, starts_at: '2026-01-01T00:00:00Z', expires_at: '2029-01-01T00:00:00Z', can_download: false }
    const item = { id: 7, title: 'Archivo', description: '', folder: null, kind: 'pdf', filename: 'a.pdf', content_type: 'application/pdf', size_bytes: 1, can_download: false, tags: [], is_favorite: false, grants: [], sharing: [{ user, direct, tags: [{ id: 5, name: 'QUIMICA' }] }] }
    const wrapper = mount(LibraryMaterialCard, { props: { item } })
    expect(wrapper.findAll('.share-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('QUIMICA')
    expect(wrapper.text()).toContain('Directo')
  })
})
