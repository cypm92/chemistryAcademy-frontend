// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassesView from '../src/views/ClassesView.vue'
import { api, downloadMaterial } from '../src/services/api'

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
  user_id: null,
  user_name: 'Test User',
  user_email: 'test@example.com',
}

beforeEach(() => {
  vi.clearAllMocks()
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

it('displays download button only for PDF materials in class attachments', async () => {
  const wrapper = mount(ClassesView, {
    global: {
      stubs: {
        MaterialViewer: true,
      },
    },
  })

  await flushPromises()

  const resources = wrapper.findAll('article.class-resource')
  expect(resources.length).toBe(2)

  // First resource: PDF - should have download button
  const pdfResource = resources[0]
  const pdfDownloadButtons = pdfResource.findAll('button.download-attachment')
  expect(pdfDownloadButtons.length).toBe(1)

  // Second resource: Video - should NOT have download button
  const videoResource = resources[1]
  const videoDownloadButtons = videoResource.findAll('button.download-attachment')
  expect(videoDownloadButtons.length).toBe(0)

  wrapper.unmount()
})

it('calls downloadMaterial when download button is clicked', async () => {
  const wrapper = mount(ClassesView, {
    global: {
      stubs: {
        MaterialViewer: true,
      },
    },
  })

  await flushPromises()

  const resources = wrapper.findAll('article.class-resource')
  const pdfResource = resources[0]
  const downloadButton = pdfResource.find('button.download-attachment')

  expect(downloadButton.exists()).toBe(true)

  await downloadButton.trigger('click')

  // Verify downloadMaterial was called with correct parameters
  expect(vi.mocked(downloadMaterial)).toHaveBeenCalledWith(101, 'document.pdf')

  wrapper.unmount()
})
