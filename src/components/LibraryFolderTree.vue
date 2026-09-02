<script setup lang="ts">
import { ref } from 'vue'
import type { Material } from '../types'

export interface LibraryFolderNode {
  id: number | null
  name: string
  path: string
  parentId: number | null
  ownColor: string | null
  materials: Material[]
  children: LibraryFolderNode[]
  materialCount: number
  color: string | null
}

defineOptions({ name: 'LibraryFolderTree' })
const props = withDefaults(defineProps<{ nodes: LibraryFolderNode[]; selectedPath: string; admin?: boolean; depth?: number; maxDepth?: number }>(), { admin: false, depth: 0, maxDepth: 1 })
const emit = defineEmits<{ select: [path: string]; editColor: [node: LibraryFolderNode] }>()
const expandedRoots = ref<string[]>([])
function choose(node: LibraryFolderNode) {
  emit('select', node.path)
  if (props.depth === 0 && node.children.length) {
    expandedRoots.value = expandedRoots.value.includes(node.path)
      ? expandedRoots.value.filter((path) => path !== node.path)
      : [...expandedRoots.value, node.path]
  }
}
function isOpen(node: LibraryFolderNode) { return props.depth > 0 || expandedRoots.value.includes(node.path) }
</script>

<template>
  <ul class="folder-nav-list" :style="{ '--folder-depth': props.depth }">
    <li v-for="node in nodes" :key="node.path">
      <button :class="['folder-nav-item', { active: selectedPath === node.path }]" :style="{ '--folder-color': node.color || 'var(--brand-green)' }" @click="choose(node)">
        <span class="folder-nav-icon">⌑</span><span>{{ node.name }}</span><small>{{ node.materialCount }}</small>
        <span v-if="props.depth === 0 && node.children.length" class="folder-nav-toggle">{{ isOpen(node) ? '⌄' : '›' }}</span>
      </button>
      <button v-if="admin && node.id && !(node.name === 'Sin clasificar' && node.parentId === null)" class="folder-nav-color" type="button" :aria-label="`Editar color de ${node.name}`" title="Editar color" :style="{ '--folder-color': node.color || 'var(--brand-green)' }" @click.stop="emit('editColor', node)"><span></span></button>
      <LibraryFolderTree v-if="node.children.length && props.depth < props.maxDepth && isOpen(node)" :nodes="node.children" :selected-path="selectedPath"
        :admin="admin" :depth="props.depth + 1" :max-depth="props.maxDepth" @select="emit('select', $event)" @edit-color="emit('editColor', $event)" />
    </li>
  </ul>
</template>
