// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ResourcesView from '../src/views/ResourcesView.vue'

vi.mock('../src/services/api', () => ({
  api: { get: vi.fn((path: string) => Promise.resolve({ data: path === '/public/resources' ? {
    exams: [
      { id: 1, title: 'Química Madrid', description: '', subject: 'quimica', community: 'Madrid', exam_year: 2025, exam_part: 'statement', file_url: '/exam.pdf' },
      { id: 2, title: 'Física Baleares', description: '', subject: 'fisica', community: 'Baleares', exam_year: 2024, exam_part: 'solutions', file_url: '/physics.pdf' },

    ],
    forms: [{ id: 3, title: 'Formulario orgánica', description: '', subject: 'organica' }],
    videos: [{ id: 4, title: 'Vídeo orgánica', description: '', subject: 'organica' }],
  } : { primary_color: '#1D6B4F', has_custom_logo: false } })) },
  apiUrl: (path: string) => `/api${path}`,
  errorMessage: () => 'Error de red',
}))

describe('recursos PAU', () => {
  it('ofrece solo las asignaturas de la PAU y permite seleccionar asignatura y comunidad', async () => {
    const wrapper = mount(ResourcesView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    const subjects = wrapper.findAll('.resources-subject')
    expect(subjects.map(button => button.text())).toEqual(['Química', 'Física', 'Matemáticas II'])
    expect(wrapper.get('.resources-result').text()).toContain('2025')
    await subjects[1].trigger('click')
    await wrapper.findAll('.resources-communities button').find(button => button.text() === 'Baleares')!.trigger('click')
    expect(wrapper.get('.resources-result').text()).toContain('2024')
    expect(wrapper.get('.resources-result').text()).toContain('Baleares')
    expect(wrapper.get('.resources-result a.resources-download').attributes('href')).toBe('/api/physics.pdf')
    wrapper.unmount()
  })

  it('mantiene los vídeos y formularios de química orgánica', async () => {
    const wrapper = mount(ResourcesView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await wrapper.findAll('.resources-video-filters button').find(button => button.text() === 'Orgánica')!.trigger('click')
    expect(wrapper.get('.resources-video-grid').text()).toContain('Vídeo orgánica')
    expect(wrapper.get('.resources-form-list').text()).toContain('Formulario orgánica')
    wrapper.unmount()
  })

})
