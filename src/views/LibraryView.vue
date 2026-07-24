<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MaterialViewer from '../components/MaterialViewer.vue'
import LibraryFolderTree, { type LibraryFolderNode } from '../components/LibraryFolderTree.vue'
import LibraryMaterialCard from '../components/LibraryMaterialCard.vue'
import { api, errorMessage } from '../services/api'
import { session } from '../services/session'
import type { Material } from '../types'

const materials = ref<Material[]>([])
const selected = ref<Material | null>(null)
const selectedFolderPath = ref('')
const searchQuery = ref('')
const searchAllFolders = ref(false)
const error = ref('')
const notice = ref('')
const loading = ref(true)

const folderTree = computed<LibraryFolderNode[]>(() => {
  const nodes = new Map<string, LibraryFolderNode>()
  for (const material of materials.value) {
    const parts = (material.folder?.path || 'Sin clasificar').split(' / ')
    let parentPath = ''
    for (const name of parts) {
      const path = parentPath ? `${parentPath} / ${name}` : name
      if (!nodes.has(path)) nodes.set(path, { name, path, materials: [], children: [], materialCount: 0 })
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

function selectFolder(path: string) { selectedFolderPath.value = path }
async function loadMaterials() {
  const endpoint = session.user?.role === 'admin' ? '/admin/materials' : '/materials'
  materials.value = (await api.get(endpoint)).data
  if (!selectedFolderPath.value || !findFolder(folderTree.value, selectedFolderPath.value)) {
    selectedFolderPath.value = folderTree.value[0]?.path || ''
  }
}
async function reloadMaterials() { try { await loadMaterials() } catch (e) { error.value = errorMessage(e) } }
onMounted(async () => { try { await loadMaterials() } catch (e) { error.value = errorMessage(e) } finally { loading.value = false } })
</script>

<template>
  <section class="page library-page">
    <p v-if="notice" class="success-alert">{{ notice }}</p><p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Cargando tu biblioteca…</p>
    <div v-else-if="materials.length && activeFolder" class="file-manager">
      <aside class="file-sidebar"><div class="file-sidebar-head"><span class="file-sidebar-mark">⌑</span><b>Mis carpetas</b></div><LibraryFolderTree :nodes="folderTree" :selected-path="selectedFolderPath" @select="selectFolder" /></aside>
      <main class="file-workspace">
        <div class="workspace-top"><div><div class="breadcrumbs"><button v-for="(crumb, index) in breadcrumbs" :key="index" @click="selectFolder(breadcrumbs.slice(0, index + 1).join(' / '))">{{ crumb }}</button></div><h1>{{ activeFolder.name }}</h1><p>{{ activeFolder.materialCount }} {{ activeFolder.materialCount === 1 ? 'material disponible' : 'materiales disponibles' }}</p></div><div class="workspace-summary"><b>{{ activeFolder.children.length }}</b><span>{{ activeFolder.children.length === 1 ? 'subcarpeta' : 'subcarpetas' }}</span></div></div>
        <div class="file-search"><span>⌕</span><input v-model="searchQuery" placeholder="Buscar archivos…" /><label><input v-model="searchAllFolders" type="checkbox" /> Buscar en todas las carpetas</label></div>
        <section v-if="!searchQuery && activeFolder.children.length" class="folder-section"><div class="section-label">Carpetas</div><div class="folder-tiles"><button v-for="folder in activeFolder.children" :key="folder.path" class="folder-tile" @click="selectFolder(folder.path)"><span class="tile-folder-icon">⌑</span><span><b>{{ folder.name }}</b><small>{{ folder.materialCount }} {{ folder.materialCount === 1 ? 'archivo' : 'archivos' }}</small></span><span class="tile-arrow">›</span></button></div></section>
        <section class="file-section"><div class="section-label">{{ fileSectionTitle }}</div><div v-if="filteredMaterials.length" class="file-list"><LibraryMaterialCard v-for="item in filteredMaterials" :key="item.id" :item="item" @open="selected = $event" @changed="reloadMaterials" @notice="notice = $event" @error="error = $event" /></div><div v-else class="file-empty">{{ searchQuery ? 'No se han encontrado archivos.' : 'Esta carpeta no contiene archivos directamente.' }}</div></section>
      </main>
    </div>
    <div v-else class="empty"><b>Aún no tienes materiales activos.</b><p>Tu profesora te dará acceso cuando estén preparados.</p></div>
    <MaterialViewer :material="selected" @close="selected = null" />
  </section>
</template>
