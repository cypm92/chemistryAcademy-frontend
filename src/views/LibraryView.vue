<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MaterialViewer from '../components/MaterialViewer.vue'
import LibraryFolderTree, { type LibraryFolderNode } from '../components/LibraryFolderTree.vue'
import { api, errorMessage } from '../services/api'
import { session } from '../services/session'
import type { Material } from '../types'

const materials = ref<Material[]>([])
const selected = ref<Material | null>(null)
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

async function loadMaterials() {
  const endpoint = session.user?.role === 'admin' ? '/admin/materials' : '/materials'
  materials.value = (await api.get(endpoint)).data
}
async function reloadMaterials() {
  try { await loadMaterials() } catch (e) { error.value = errorMessage(e) }
}
onMounted(async () => {
  try { await loadMaterials() } catch (e) { error.value = errorMessage(e) } finally { loading.value = false }
})
</script>

<template>
  <section class="page">
    <p v-if="notice" class="success-alert">{{ notice }}</p>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Cargando tu biblioteca…</p>
    <div v-else-if="materials.length" class="library-groups">
      <LibraryFolderTree :nodes="folderTree" @open="selected = $event" @changed="reloadMaterials"
        @notice="notice = $event" @error="error = $event" />
    </div>
    <div v-else class="empty"><b>Aún no tienes materiales activos.</b><p>Tu profesora te dará acceso cuando estén preparados.</p></div>
    <MaterialViewer :material="selected" @close="selected = null" />
  </section>
</template>
