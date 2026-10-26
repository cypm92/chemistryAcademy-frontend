<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MaterialViewer from '../components/MaterialViewer.vue'
import LibraryFolderTree, { type LibraryFolderNode } from '../components/LibraryFolderTree.vue'
import LibraryMaterialCard from '../components/LibraryMaterialCard.vue'
import FolderTreePicker from '../components/FolderTreePicker.vue'
import { api, errorMessage } from '../services/api'
import { session } from '../services/session'
import type { Folder, Material } from '../types'

const materials = ref<Material[]>([])
const folders = ref<Folder[]>([])
const selected = ref<Material | null>(null)
const selectedFolderPath = ref('')
const expandedFolderPaths = ref<string[]>([])
const searchQuery = ref('')
const searchAllFolders = ref(false)
const error = ref('')
const notice = ref('')
const loading = ref(true)
const colorFolder = ref<LibraryFolderNode | null>(null)
const colorForm = ref({ useOwnColor: true, color: '#1D6B4F' })
const savingColor = ref(false)
const movingMaterial = ref<Material | null>(null)
const moveTargetId = ref<number | null>(null)
const savingMove = ref(false)
const moveError = ref('')

const folderTree = computed<LibraryFolderNode[]>(() => {
  const nodes = new Map<string, LibraryFolderNode>()
  for (const folder of folders.value) {
    nodes.set(folder.path, { id: folder.id, name: folder.name, path: folder.path, parentId: folder.parent_id, ownColor: folder.color, materials: [], children: [], materialCount: 0, color: folder.effective_color })
  }
  for (const material of materials.value) {
    const materialFolderPath = material.folder?.path || 'Sin clasificar'
    const parts = materialFolderPath.split(' / ')
    let parentPath = ''
    for (const name of parts) {
      const path = parentPath ? `${parentPath} / ${name}` : name
      const isMaterialFolder = path === materialFolderPath
      if (!nodes.has(path)) nodes.set(path, { id: isMaterialFolder ? material.folder?.id || null : null, name, path, parentId: isMaterialFolder ? material.folder?.parent_id || null : null, ownColor: isMaterialFolder ? material.folder?.color || null : null, materials: [], children: [], materialCount: 0, color: material.folder?.effective_color || null })
      else if (!nodes.get(path)?.color && material.folder?.effective_color) nodes.get(path)!.color = material.folder.effective_color
      parentPath = path
    }
    nodes.get(parentPath)?.materials.push(material)
  }
  const roots: LibraryFolderNode[] = []
  for (const node of nodes.values()) {
    const separator = node.path.lastIndexOf(' / ')
    const parent = separator === -1 ? undefined : nodes.get(node.path.slice(0, separator))
    if (parent) parent.children.push(node); else roots.push(node)
  }
  const sortAndCount = (node: LibraryFolderNode): number => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    node.materialCount = node.materials.length + node.children.reduce((total, child) => total + sortAndCount(child), 0)
    return node.materialCount
  }
  roots.sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(sortAndCount)
  const favorites = materials.value.filter((material) => material.is_favorite)
  if (favorites.length) roots.unshift({ id: null, name: 'Favoritos', path: '__favorites__', parentId: null, ownColor: null, materials: favorites, children: [], materialCount: favorites.length, color: null })
  return roots
})

function findFolder(nodes: LibraryFolderNode[], path: string): LibraryFolderNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    const nested = findFolder(node.children, path)
    if (nested) return nested
  }
  return null
}
const activeFolder = computed(() => findFolder(folderTree.value, selectedFolderPath.value))
const breadcrumbs = computed(() => activeFolder.value?.path.split(' / ') || [])
const filteredMaterials = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('es')
  const source = searchAllFolders.value ? materials.value : (activeFolder.value?.materials || [])
  if (!query) return source
  return source.filter((material) => [material.title, material.description, material.filename, material.folder?.path]
    .some((value) => value?.toLocaleLowerCase('es').includes(query)))
})
const fileSectionTitle = computed(() => searchQuery.value.trim() && searchAllFolders.value ? 'Resultados en todas las carpetas' : 'Archivos')

function ancestorPaths(path: string): string[] {
  const parts = path.split(' / ')
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join(' / '))
}
function selectFolder(path: string, expandSelected = false) {
  selectedFolderPath.value = path
  expandedFolderPaths.value = [...ancestorPaths(path), ...(expandSelected ? [path] : [])]
}
function chooseSidebarFolder(node: LibraryFolderNode) {
  const expandSelected = node.children.length > 0 && !expandedFolderPaths.value.includes(node.path)
  selectFolder(node.path, expandSelected)
}
function openMoveMaterial(material: Material) {
  if (session.user?.role !== 'admin') return
  movingMaterial.value = material
  moveTargetId.value = material.folder?.id ?? null
  moveError.value = ''
}
async function saveMoveMaterial() {
  if (!movingMaterial.value || moveTargetId.value === null || session.user?.role !== 'admin') return
  const destination = folders.value.find((folder) => folder.id === moveTargetId.value)
  if (!destination || movingMaterial.value.folder?.id === destination.id) return
  savingMove.value = true; moveError.value = ''
  try {
    const title = movingMaterial.value.title
    await api.patch(`/admin/materials/${movingMaterial.value.id}/folder`, { folder_id: destination.id })
    await loadMaterials()
    selectFolder(destination.path, true)
    searchQuery.value = ''
    searchAllFolders.value = false
    movingMaterial.value = null
    notice.value = `«${title}» se ha movido a «${destination.path}».`
  } catch (e) { moveError.value = errorMessage(e) }
  finally { savingMove.value = false }
}
function editFolderColor(folder: LibraryFolderNode) {
  if (!folder.id || session.user?.role !== 'admin') return
  colorFolder.value = folder
  colorForm.value = { useOwnColor: Boolean(folder.ownColor), color: folder.ownColor || folder.color || '#1D6B4F' }
}
async function saveFolderColor() {
  if (!colorFolder.value?.id) return
  savingColor.value = true; error.value = ''
  try {
    await api.patch(`/admin/folders/${colorFolder.value.id}`, {
      name: colorFolder.value.name,
      parent_id: colorFolder.value.parentId,
      color: colorForm.value.useOwnColor ? colorForm.value.color : null,
    })
    colorFolder.value = null
    notice.value = 'Color de la carpeta actualizado.'
    await loadMaterials()
  } catch (e) { error.value = errorMessage(e) }
  finally { savingColor.value = false }
}
async function loadMaterials() {
  const endpoint = session.user?.role === 'admin' ? '/admin/materials' : '/materials'
  const [materialResponse, folderResponse] = await Promise.all([
    api.get(endpoint),
    session.user?.role === 'admin' ? api.get('/admin/folders') : Promise.resolve({ data: [] }),
  ])
  materials.value = materialResponse.data
  folders.value = folderResponse.data
  if (!selectedFolderPath.value || !findFolder(folderTree.value, selectedFolderPath.value)) {
    selectFolder(folderTree.value[0]?.path || '')
  }
}
async function reloadMaterials() { try { await loadMaterials() } catch (e) { error.value = errorMessage(e) } }
onMounted(async () => { try { await loadMaterials() } catch (e) { error.value = errorMessage(e) } finally { loading.value = false } })
</script>

<template>
  <section class="page library-page">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Cargando tu biblioteca…</p>
    <div v-else-if="folderTree.length && activeFolder" class="file-manager">
      <aside class="file-sidebar"><div class="file-sidebar-head"><span class="file-sidebar-mark">⌑</span><b>Mis carpetas</b></div><LibraryFolderTree :nodes="folderTree" :selected-path="selectedFolderPath" :expanded-paths="expandedFolderPaths" :admin="session.user?.role === 'admin'" @select="chooseSidebarFolder" @edit-color="editFolderColor" /></aside>
      <main class="file-workspace">
        <div class="workspace-top"><div><div class="breadcrumbs"><button v-for="(crumb, index) in breadcrumbs" :key="index" @click="selectFolder(breadcrumbs.slice(0, index + 1).join(' / '))">{{ crumb }}</button></div><h1>{{ activeFolder.name }}</h1><p>{{ activeFolder.materialCount }} {{ activeFolder.materialCount === 1 ? 'material disponible' : 'materiales disponibles' }}</p></div><div class="workspace-summary"><b>{{ activeFolder.children.length }}</b><span>{{ activeFolder.children.length === 1 ? 'subcarpeta' : 'subcarpetas' }}</span></div></div>
        <div class="file-search"><span>⌕</span><input v-model="searchQuery" placeholder="Buscar archivos…" /><label><input v-model="searchAllFolders" type="checkbox" /> Buscar en todas las carpetas</label></div>
        <section v-if="!searchQuery && activeFolder.children.length" class="folder-section"><div class="section-label">Carpetas</div><div class="folder-tiles"><article v-for="folder in activeFolder.children" :key="folder.path" class="folder-tile" :style="{ '--folder-color': folder.color || 'var(--brand-green)' }"><button v-if="session.user?.role === 'admin' && folder.id && !(folder.name === 'Sin clasificar' && folder.parentId === null)" class="folder-tile-color" type="button" :aria-label="`Editar color de ${folder.name}`" title="Editar color" @click.stop="editFolderColor(folder)"><span></span></button><button class="folder-tile-open" @click="selectFolder(folder.path, folder.children.length > 0)"><span class="tile-folder-icon">⌑</span><span><b>{{ folder.name }}</b><small>{{ folder.materialCount }} {{ folder.materialCount === 1 ? 'archivo' : 'archivos' }}</small></span><span class="tile-arrow">›</span></button></article></div></section>
        <section class="file-section"><div class="section-label">{{ fileSectionTitle }}</div><div v-if="filteredMaterials.length" class="file-list"><LibraryMaterialCard v-for="item in filteredMaterials" :key="item.id" :item="item" @open="selected = $event" @move="openMoveMaterial" @changed="reloadMaterials" @notice="notice = $event" @error="error = $event" /></div><div v-else class="file-empty">{{ searchQuery ? 'No se han encontrado archivos.' : 'Esta carpeta no contiene archivos directamente.' }}</div></section>
      </main>
    </div>
    <div v-else class="empty"><b>Aún no tienes materiales activos.</b><p>Tu profesora te dará acceso cuando estén preparados.</p></div>
    <MaterialViewer :material="selected" @close="selected = null" />
    <div v-if="movingMaterial" class="modal folder-color-modal" role="dialog" aria-modal="true" aria-label="Mover material" @click.self="movingMaterial = null">
      <form class="folder-color-card folder-move-card" @submit.prevent="saveMoveMaterial">
        <header><div><p class="eyebrow">UBICACIÓN DEL MATERIAL</p><h2>Mover material</h2><small>{{ movingMaterial.title }}</small></div><button class="icon-button" type="button" aria-label="Cerrar" @click="movingMaterial = null">×</button></header>
        <div class="folder-color-body"><p class="folder-move-current">Ubicación actual: <strong>{{ movingMaterial.folder?.path || 'Sin clasificar' }}</strong></p><label>Nueva carpeta<FolderTreePicker v-model="moveTargetId" :folders="folders" :allow-root="false" /><small>Despliega una carpeta para ver sus subcarpetas.</small></label><p v-if="moveError" class="alert">{{ moveError }}</p></div>
        <footer><button class="secondary" type="button" @click="movingMaterial = null">Cancelar</button><button class="primary" :disabled="savingMove || moveTargetId === null || moveTargetId === movingMaterial.folder?.id">{{ savingMove ? 'Moviendo…' : 'Mover material' }}</button></footer>
      </form>
    </div>
    <div v-if="colorFolder" class="modal folder-color-modal" role="dialog" aria-modal="true" aria-label="Editar color de carpeta" @click.self="colorFolder = null">
      <form class="folder-color-card" @submit.prevent="saveFolderColor"><header><div><p class="eyebrow">COLOR DE CARPETA</p><h2>{{ colorFolder.name }}</h2><small>{{ colorFolder.path }}</small></div><button class="icon-button" type="button" aria-label="Cerrar" @click="colorFolder = null">×</button></header><div class="folder-color-body"><label class="check"><input v-model="colorForm.useOwnColor" type="checkbox" /> Usar un color propio</label><label v-if="colorForm.useOwnColor" class="color-field">Color<input v-model="colorForm.color" type="color" /><span>{{ colorForm.color }}</span></label><p v-else>La carpeta heredará el color de su carpeta superior.</p><div class="folder-color-preview" :style="{ '--preview-color': colorForm.useOwnColor ? colorForm.color : colorFolder.color || 'var(--brand-green)' }"><span>⌑</span><b>{{ colorFolder.name }}</b></div></div><footer><button class="secondary" type="button" @click="colorFolder = null">Cancelar</button><button class="primary" :disabled="savingColor">{{ savingColor ? 'Guardando…' : 'Guardar color' }}</button></footer></form>
    </div>
  </section>
</template>
