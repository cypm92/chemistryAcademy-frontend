<script setup lang="ts">
import type { Material } from '../types'
import LibraryMaterialCard from './LibraryMaterialCard.vue'

export interface LibraryFolderNode {
  name: string
  path: string
  materials: Material[]
  children: LibraryFolderNode[]
  materialCount: number
}

defineOptions({ name: 'LibraryFolderTree' })
defineProps<{ nodes: LibraryFolderNode[]; depth?: number }>()
const emit = defineEmits<{
  open: [item: Material]
  changed: []
  notice: [message: string]
  error: [message: string]
}>()
</script>

<template>
  <details v-for="node in nodes" :key="node.path" class="folder-tree-node"
    :style="{ '--folder-depth': depth || 0 }" :open="(depth || 0) === 0">
    <summary class="folder-tree-heading"><span class="folder-chevron">›</span><span class="folder-icon">⌑</span><span class="folder-name">{{ node.name }}</span><small>{{ node.materialCount }} {{ node.materialCount === 1 ? 'material' : 'materiales' }}</small></summary>
    <div class="folder-tree-content">
      <div v-if="node.materials.length" class="material-grid">
        <LibraryMaterialCard v-for="item in node.materials" :key="item.id" :item="item" @open="emit('open', $event)" @changed="emit('changed')" @notice="emit('notice', $event)" @error="emit('error', $event)" />
      </div>
      <LibraryFolderTree v-if="node.children.length" :nodes="node.children" :depth="(depth || 0) + 1"
        @open="emit('open', $event)" @changed="emit('changed')" @notice="emit('notice', $event)" @error="emit('error', $event)" />
    </div>
  </details>
</template>
