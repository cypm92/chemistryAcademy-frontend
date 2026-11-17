// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api, downloadMaterial } from '../src/services/api'
import { session } from '../src/services/session'

vi.mock('../src/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  downloadMaterial: vi.fn(),
  errorMessage: () => 'Error de red',
}))

const baseMaterial = {
  id: 1,
  starts_at: '2026-11-04T10:00:00Z',
  ends_at: '2026-11-04T11:00:00Z',
  status: 'confirmed',
  management_status: null,
  is_historical: false,
  topic: 'Química',
  admin_comment: '',
  user_id: 1,
  user_name: 'Test User',
  user_email: 'test@example.com',
  teams_status: undefined,
  teams_action: undefined,
  teams_review_reason: undefined,
  teams_revision: 0,
  teams_unresolved_attempts: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  session.user = null
  vi.mocked(api.get).mockResolvedValue({
    data: [{
      ...baseMaterial,
      materials: [
        {
          id: 101,
          title: 'PDF Document',
          filename: 'document.pdf',
          kind: 'pdf',
          can_download: true,
        },
        {
          id: 102,
          title: 'Video Lecture',
          filename: 'lecture.mp4',
          kind: 'video',
          can_download: false,
        },
      ],
    }],
  })
})

it('admin sees download and delete buttons with visible text', async () => {
  // Mock admin user
  session.user = { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'admin' } as any

  const wrapper = mount(ClassesView, {
    global: {
      stubs: {
        MaterialViewer: true,
        TeamsRecreate: true,
        TeamsPatchReview: true,
      },
    },
  })

  await flushPromises()

  const resources = wrapper.findAll('article.class-resource')
  expect(resources.length).toBe(2)

  // First resource: PDF - admin should see both download and delete buttons with visible text
  const pdfResource = resources[0]
  const pdfActionContainer = pdfResource.find('.class-resource-actions')
  expect(pdfActionContainer.exists()).toBe(true)
  
  // Check for visible text buttons
  const downloadButton = pdfActionContainer.find('button.class-resource-download-attachment')
  const deleteButton = pdfActionContainer.find('button.delete-attachment')
  expect(downloadButton.exists()).toBe(true)
  expect(downloadButton.text()).toContain('Descargar')
  expect(deleteButton.exists()).toBe(true)
  expect(deleteButton.text()).toContain('Eliminar')

  // Second resource: Video - admin should see delete button only
  const videoResource = resources[1]
  const videoActionContainer = videoResource.find('.class-resource-actions')
  expect(videoActionContainer.exists()).toBe(true)
  const videoDownloadBtn = videoActionContainer.find('button.class-resource-download-attachment')
  const videoDeleteBtn = videoActionContainer.find('button.delete-attachment')
  expect(videoDownloadBtn.exists()).toBe(false) // no download button for video
  expect(videoDeleteBtn.exists()).toBe(true)
  expect(videoDeleteBtn.text()).toContain('Eliminar')

  wrapper.unmount()
})

it('student sees only download button with visible text', async () => {
  // Mock student user (not admin)
  session.user = { id: 2, name: 'Student User', email: 'student@example.com', role: 'student' } as any

  const wrapper = mount(ClassesView, {
    global: {
      stubs: {
        MaterialViewer: true,
        TeamsRecreate: true,
        TeamsPatchReview: true,
      },
    },
  })

  await flushPromises()

  const resources = wrapper.findAll('article.class-resource')
  const pdfResource = resources[0]
  const pdfActionContainer = pdfResource.find('.class-resource-actions')
  expect(pdfActionContainer.exists()).toBe(true)
  
  // Student should only see the download button
  const downloadButton = pdfActionContainer.find('button.class-resource-download-attachment')
  expect(downloadButton.exists()).toBe(true)
  expect(downloadButton.text()).toContain('Descargar')
  
  // Verify no delete button is visible for student
  const deleteButton = pdfActionContainer.find('button.delete-attachment')
  expect(deleteButton.exists()).toBe(false)

  await downloadButton.trigger('click')

  // Verify downloadMaterial was called with correct parameters
  expect(vi.mocked(downloadMaterial)).toHaveBeenCalledWith(101, 'document.pdf')

  wrapper.unmount()
})

it('download and delete buttons work correctly with long material titles', async () => {
  // Mock admin user with long material title (> 60 chars)
  session.user = { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'admin' } as any

  vi.mocked(api.get).mockResolvedValue({
    data: [{
      ...baseMaterial,
      materials: [
        {
          id: 104,
          title: 'Esta es una guía muy larga sobre la química orgánica y sus reacciones más complejas',
          filename: 'long-title.pdf',
          kind: 'pdf',
          can_download: true,
        },
      ],
    }],
  })

  const wrapper = mount(ClassesView, {
    global: {
      stubs: {
        MaterialViewer: true,
        TeamsRecreate: true,
        TeamsPatchReview: true,
      },
    },
  })

  await flushPromises()

  const resources = wrapper.findAll('article.class-resource')
  expect(resources.length).toBe(1)
  
  const resource = resources[0]
  const actionContainer = resource.find('.class-resource-actions')
  const downloadButton = actionContainer.find('button.class-resource-download-attachment')
  expect(downloadButton.exists()).toBe(true)
  expect(downloadButton.text()).toContain('Descargar')
  
  // Verify the action container exists and buttons are properly laid out
  expect(actionContainer.exists()).toBe(true)
  const deleteBtn = actionContainer.find('button.delete-attachment')
  expect(deleteBtn.exists()).toBe(true)

  wrapper.unmount()
})
