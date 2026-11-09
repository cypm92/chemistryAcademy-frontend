// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MaterialViewer from '../src/components/MaterialViewer.vue'
import { protectedBlobUrl } from '../src/services/api'
import type { Material } from '../src/types'

const pdfMocks = vi.hoisted(() => ({ getDocument: vi.fn(), viewers: [] as Array<any>, viewerConstructorError: null as Error | null }))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: pdfMocks.getDocument,
}))
vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  EventBus: class { on() {} off() {} dispatch() {} },
  LinkTarget: { BLANK: 2 },
  PDFLinkService: class {
    setDocument() {}
    setViewer() {}
  },
  PDFViewer: class {
    private viewer: HTMLDivElement
    private scale = 'auto'
    firstPagePromise: Promise<void> = Promise.resolve()
    setDocument = vi.fn((pdfDocument: { numPages: number } | null) => {
      this.viewer.innerHTML = ''
      if (!pdfDocument) return
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        const page = document.createElement('div')
        page.className = 'page'
        page.dataset.pageNumber = String(pageNumber)
        page.append(document.createElement('canvas'))
        const textLayer = document.createElement('div')
        textLayer.className = 'textLayer'
        textLayer.textContent = 'Texto PDF seleccionable'
        page.append(textLayer)
        this.viewer.append(page)
      }
    })
    constructor({ viewer }: { viewer: HTMLDivElement }) {
      if (pdfMocks.viewerConstructorError) throw pdfMocks.viewerConstructorError
      this.viewer = viewer
      pdfMocks.viewers.push(this)
    }
    set currentScaleValue(value: string) { this.scale = value }
    get currentScaleValue() { return this.scale }
  },
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'mock-worker.mjs' }))
vi.mock('../src/services/api', () => ({ protectedBlobUrl: vi.fn() }))

const makeMaterial = (id: number, kind: Material['kind'] = 'pdf'): Material => ({
  id,
  title: `Documento ${id}`,
  description: '',
  folder: null,
  kind,
  filename: `documento-${id}.${kind === 'pdf' ? 'pdf' : 'mp4'}`,
  content_type: kind === 'pdf' ? 'application/pdf' : 'video/mp4',
  size_bytes: 1024,
  can_download: false,
  tags: [],
  is_favorite: false,
})

function makePdf(pageCount = 2) {
  const pages = Array.from({ length: pageCount }, () => ({
    getViewport: vi.fn(({ scale }: { scale: number }) => ({
      width: 600 * scale,
      height: 800 * scale,
      scale,
      transform: [1, 0, 0, -1, 0, 800 * scale],
    })),
    getTextContent: vi.fn(async () => ({ items: [{ str: 'Texto PDF seleccionable' }] })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  }))
  const document = {
    numPages: pageCount,
    getPage: vi.fn(async (pageNumber: number) => pages[pageNumber - 1]),
    destroy: vi.fn(async () => undefined),
  }
  return { document, pages }
}

function setPdf(document: ReturnType<typeof makePdf>['document']) {
  const task = {
    promise: Promise.resolve(document),
    destroy: vi.fn(async () => undefined),
  }
  pdfMocks.getDocument.mockReturnValue(task)
  return task
}

const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')

beforeEach(() => {
  vi.mocked(protectedBlobUrl).mockImplementation(async (path) => `blob:${path}`)
  pdfMocks.getDocument.mockReset()
  pdfMocks.viewers.length = 0
  pdfMocks.viewerConstructorError = null
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  vi.clearAllMocks()
  if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl)
  else delete (URL as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL
})

describe('visor PDF.js', () => {
  it('renderiza todas las páginas y la capa de texto desde la URL protegida', async () => {
    const pdf = makePdf(3)
    setPdf(pdf.document)
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()

    expect(pdfMocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: 'blob:/materials/1/content' }))
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.findAll('.pdfViewer .page')).toHaveLength(3)
    expect(wrapper.findAll('.pdfViewer canvas')).toHaveLength(3)
    expect(wrapper.findAll('.pdfViewer .textLayer')).toHaveLength(3)
    expect(wrapper.get('.pdfViewer .textLayer').text()).toContain('Texto PDF seleccionable')
    expect(wrapper.get('[aria-label="Nivel de zoom"]').text()).toBe('100%')
    wrapper.unmount()
  })

  it('aplica el zoom al renderizado de PDF.js en pasos de 10%', async () => {
    const pdf = makePdf(1)
    setPdf(pdf.document)
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()

    expect(pdfMocks.viewers[0].currentScaleValue).toBe('1')
    await wrapper.get('button[aria-label="Aumentar zoom"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="Nivel de zoom"]').text()).toBe('110%')
    expect(pdfMocks.viewers[0].currentScaleValue).toBe('1.1')

    await wrapper.get('button[aria-label="Disminuir zoom"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="Nivel de zoom"]').text()).toBe('100%')
    expect(pdfMocks.viewers[0].currentScaleValue).toBe('1')
    wrapper.unmount()
  })

  it('limita el zoom a 50–200%', async () => {
    const pdf = makePdf(1)
    setPdf(pdf.document)
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()

    const decrease = wrapper.get('button[aria-label="Disminuir zoom"]')
    const increase = wrapper.get('button[aria-label="Aumentar zoom"]')
    for (let index = 0; index < 10; index++) await decrease.trigger('click')
    expect(wrapper.get('[aria-label="Nivel de zoom"]').text()).toBe('50%')
    expect(decrease.attributes('disabled')).toBeDefined()
    expect(increase.attributes('disabled')).toBeUndefined()

    for (let index = 0; index < 15; index++) await increase.trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="Nivel de zoom"]').text()).toBe('200%')
    expect(increase.attributes('disabled')).toBeDefined()
    expect(decrease.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('conserva la página intermedia y su desplazamiento relativo después del zoom', async () => {
    const pdf = makePdf(3)
    setPdf(pdf.document)
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()

    const pdfViewer = pdfMocks.viewers[0]
    const visiblePage = wrapper.get('.pdfViewer .page[data-page-number="2"]').element
    const scroller = wrapper.get('.pdf-scroll').element as HTMLElement
    scroller.scrollTop = 900

    await wrapper.get('button[aria-label="Aumentar zoom"]').trigger('click')
    await flushPromises()

    expect(pdfMocks.viewers).toHaveLength(1)
    expect(pdfMocks.viewers[0]).toBe(pdfViewer)
    expect(wrapper.get('.pdfViewer .page[data-page-number="2"]').element).toBe(visiblePage)
    expect(pdfViewer.currentScaleValue).toBe('1.1')
    wrapper.unmount()
  })

  it('libera el documento anterior al cambiar de material y carga el nuevo', async () => {
    const first = makePdf(1)
    const second = makePdf(2)
    const firstTask = setPdf(first.document)
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()

    setPdf(second.document)
    await wrapper.setProps({ material: makeMaterial(2) })
    await flushPromises()

    expect(firstTask.destroy).toHaveBeenCalledOnce()
    expect(pdfMocks.getDocument).toHaveBeenLastCalledWith(expect.objectContaining({ url: 'blob:/materials/2/content' }))
    expect(wrapper.findAll('.pdfViewer .page')).toHaveLength(2)
    wrapper.unmount()
  })

  it('restablece el zoom a 100% al abrir otro PDF', async () => {
    const first = makePdf(1)
    const second = makePdf(2)
    setPdf(first.document)
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()
    await wrapper.get('button[aria-label="Aumentar zoom"]').trigger('click')
    await flushPromises()
    expect(pdfMocks.viewers[0].currentScaleValue).toBe('1.1')

    setPdf(second.document)
    await wrapper.setProps({ material: makeMaterial(2) })
    await flushPromises()

    expect(pdfMocks.viewers.at(-1).currentScaleValue).toBe('1')
    expect(wrapper.findAll('.pdfViewer .page')).toHaveLength(2)
    wrapper.unmount()
  })

  it('ignora una URL protegida obsoleta que termina después de la carga nueva', async () => {
    let resolveLate!: (url: string) => void
    vi.mocked(protectedBlobUrl).mockReset()
    vi.mocked(protectedBlobUrl)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLate = resolve }))
      .mockImplementationOnce(async () => 'blob:/materials/2/content')
    const pdf = makePdf(1)
    setPdf(pdf.document)
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await wrapper.setProps({ material: makeMaterial(2) })
    await flushPromises()
    resolveLate('blob:stale')
    await flushPromises()

    expect(pdfMocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: 'blob:/materials/2/content' }))
    expect(pdfMocks.getDocument).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'blob:stale' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stale')
    wrapper.unmount()
  })

  it('muestra un error legible si PDF.js no puede abrir el archivo', async () => {
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF')),
      destroy: vi.fn(async () => undefined),
    })
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('PDF')
    expect(wrapper.get('.viewer-head').exists()).toBe(true)
    wrapper.unmount()
  })

  it('muestra error y permite cerrar si PDFViewer no puede inicializarse', async () => {
    pdfMocks.viewerConstructorError = new Error('container must be absolutely positioned')
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('visor')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await wrapper.get('.viewer-head .icon-button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('activa pantalla completa en el contenedor PDF', async () => {
    const pdf = makePdf(1)
    setPdf(pdf.document)
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    const originalRequest = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen')
    const originalFullscreenElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
    const originalExitFullscreen = Object.getOwnPropertyDescriptor(document, 'exitFullscreen')
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen })
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null })
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen })

    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()
    const viewer = wrapper.get('.pdf-viewer').element
    await wrapper.get('button[aria-label="Pantalla completa"]').trigger('click')
    expect(requestFullscreen.mock.contexts[0]).toBe(viewer)
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => viewer })
    await wrapper.get('button[aria-label="Pantalla completa"]').trigger('click')
    expect(exitFullscreen).toHaveBeenCalledOnce()
    wrapper.unmount()
    if (originalRequest) Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', originalRequest)
    else delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen
    if (originalFullscreenElement) Object.defineProperty(document, 'fullscreenElement', originalFullscreenElement)
    else Reflect.deleteProperty(document, 'fullscreenElement')
    if (originalExitFullscreen) Object.defineProperty(document, 'exitFullscreen', originalExitFullscreen)
    else delete (document as Partial<Document>).exitFullscreen
  })

  it('mantiene disponible el PDF si el navegador rechaza pantalla completa', async () => {
    const pdf = makePdf(1)
    setPdf(pdf.document)
    const originalRequest = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen')
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('fullscreen no disponible')),
    })

    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1) } })
    await flushPromises()
    await wrapper.get('button[aria-label="Pantalla completa"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.pdfViewer').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
    if (originalRequest) Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', originalRequest)
    else delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen
  })

  it('emite cierre al pulsar la X', async () => {
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1, 'video') } })
    await flushPromises()

    await wrapper.get('.viewer-head .icon-button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emite cierre al pulsar fuera de la tarjeta', async () => {
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1, 'video') } })
    await flushPromises()

    await wrapper.get('.modal').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emite cierre al pulsar Escape', async () => {
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(1, 'video') } })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('mantiene los controles de vídeo sin visor PDF.js', async () => {
    const wrapper = mount(MaterialViewer, { props: { material: makeMaterial(2, 'video') } })
    await flushPromises()

    expect(wrapper.find('.pdf-viewer').exists()).toBe(false)
    expect(wrapper.find('.video-player').exists()).toBe(true)
    expect(wrapper.find('.fullscreen-button').exists()).toBe(true)
    wrapper.unmount()
  })
})
