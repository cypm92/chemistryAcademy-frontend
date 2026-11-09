<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from 'pdfjs-dist'
import { EventBus, LinkTarget, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'

GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps<{ src: string }>()

const viewerRoot = ref<HTMLDivElement | null>(null)
const scrollContainer = ref<HTMLDivElement | null>(null)
const viewerElement = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref('')
const zoomPercent = ref(100)

let eventBus: EventBus | null = null
let linkService: PDFLinkService | null = null
let pdfViewer: PDFViewer | null = null
let loadingTask: PDFDocumentLoadingTask | null = null
let loadGeneration = 0

function initializeViewer() {
  if (!scrollContainer.value || !viewerElement.value) return

  eventBus = new EventBus()
  linkService = new PDFLinkService({
    eventBus,
    externalLinkTarget: LinkTarget.BLANK,
    externalLinkRel: 'noopener noreferrer',
  })
  pdfViewer = new PDFViewer({
    container: scrollContainer.value,
    viewer: viewerElement.value,
    eventBus,
    linkService,
    removePageBorders: true,
  })
  linkService.setViewer(pdfViewer)
}

async function clearDocument() {
  const task = loadingTask
  loadingTask = null
  pdfViewer?.setDocument(null)
  linkService?.setDocument(null)
  if (task) {
    try {
      await task.destroy()
    } catch {
      // La limpieza se ejecuta también al cancelar cargas en curso.
    }
  }
}

async function loadDocument(src: string) {
  const generation = ++loadGeneration
  await clearDocument()
  if (generation !== loadGeneration) return

  error.value = ''
  zoomPercent.value = 100
  if (!src || !pdfViewer || !linkService) {
    loading.value = false
    return
  }

  loading.value = true
  let task: PDFDocumentLoadingTask | null = null
  try {
    task = getDocument({ url: src })
    loadingTask = task
    const documentProxy = await task.promise
    if (generation !== loadGeneration || loadingTask !== task) return

    linkService.setDocument(documentProxy)
    pdfViewer.setDocument(documentProxy)
    const firstPage = pdfViewer.firstPagePromise
    if (firstPage) await firstPage
    if (generation !== loadGeneration || loadingTask !== task) return

    pdfViewer.currentScaleValue = String(zoomPercent.value / 100)
    loading.value = false
  } catch {
    if (generation === loadGeneration) {
      error.value = 'No se pudo abrir este PDF. Comprueba el archivo o vuelve a intentarlo.'
      loading.value = false
      await clearDocument()
    }
  }
}

async function dispose() {
  loadGeneration++
  await clearDocument()
}

defineExpose({ dispose })

function changeZoom(delta: number) {
  const next = Math.max(50, Math.min(200, zoomPercent.value + delta))
  if (next === zoomPercent.value) return
  zoomPercent.value = next
  if (pdfViewer && !loading.value && !error.value) {
    pdfViewer.currentScaleValue = String(next / 100)
  }
}

async function toggleFullscreen() {
  const target = viewerRoot.value
  if (!target) return
  try {
    if (document.fullscreenElement === target) {
      if (typeof document.exitFullscreen === 'function') await document.exitFullscreen()
    } else if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen()
    }
  } catch {
    // El PDF sigue disponible aunque el navegador no permita pantalla completa.
  }
}

onMounted(() => {
  try {
    initializeViewer()
    void loadDocument(props.src)
  } catch {
    error.value = 'No se pudo iniciar el visor PDF. Inténtalo de nuevo.'
    loading.value = false
  }
})

watch(() => props.src, (src) => {
  if (pdfViewer) void loadDocument(src)
}, { flush: 'sync' })

onBeforeUnmount(() => { void dispose() })
</script>

<template>
  <div ref="viewerRoot" class="pdf-viewer">
    <div class="pdf-controls" aria-label="Controles del PDF">
      <button type="button" aria-label="Disminuir zoom" title="Disminuir zoom" :disabled="loading || !!error || zoomPercent <= 50" @click="changeZoom(-10)">−</button>
      <span aria-label="Nivel de zoom">{{ zoomPercent }}%</span>
      <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" :disabled="loading || !!error || zoomPercent >= 200" @click="changeZoom(10)">+</button>
      <button type="button" aria-label="Pantalla completa" title="Pantalla completa" @click="toggleFullscreen">⛶</button>
    </div>
    <p v-if="loading" class="pdf-status" role="status">Cargando documento…</p>
    <p v-if="error" class="pdf-error" role="alert">{{ error }}</p>
    <div ref="scrollContainer" class="pdf-scroll" :aria-busy="loading">
      <div ref="viewerElement" class="pdfViewer" role="document" aria-label="Páginas del documento PDF" />
    </div>
  </div>
</template>
