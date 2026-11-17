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

it('admin sees download and delete buttons in class-resource-actions container', async () => {
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

  // First resource: PDF - admin should see both download and delete buttons in class-resource-actions
  const pdfResource = resources[0]
  const pdfActionContainer = pdfResource.find('.class-resource-actions')
  expect(pdfActionContainer.exists()).toBe(true)
  const pdfActionButtons = pdfActionContainer.findAll('button')
  expect(pdfActionButtons.length).toBe(2) // download + delete

  // Second resource: Video - admin should see delete button in class-resource-actions
  const videoResource = resources[1]
  const videoActionContainer = videoResource.find('.class-resource-actions')
  expect(videoActionContainer.exists()).toBe(true)
  const videoActionButtons = videoActionContainer.findAll('button')
  expect(videoActionButtons.length).toBe(1) // delete only

  wrapper.unmount()
})

it('student sees only download button in class-resource-actions', async () => {
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

  await downloadButton.trigger('click')

  // Verify downloadMaterial was called with correct parameters
  expect(vi.mocked(downloadMaterial)).toHaveBeenCalledWith(101, 'document.pdf')

  wrapper.unmount()
})
