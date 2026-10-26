<script setup lang="ts">
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
const props = withDefaults(defineProps<{ nodes: LibraryFolderNode[]; selectedPath: string; expandedPaths: string[]; admin?: boolean; depth?: number }>(), { admin: false, depth: 0 })
const emit = defineEmits<{ select: [node: LibraryFolderNode]; editColor: [node: LibraryFolderNode] }>()
function isOpen(node: LibraryFolderNode) { return props.expandedPaths.includes(node.path) }
</script>

<template>
  <ul class="folder-nav-list" :style="{ '--folder-depth': props.depth > 0 ? 1 : 0 }">
    <li v-for="node in nodes" :key="node.path">
      <button :class="['folder-nav-item', { active: selectedPath === node.path }]" :style="{ '--folder-color': node.color || 'var(--brand-green)' }" :aria-expanded="node.children.length ? isOpen(node) : undefined" :title="node.path" @click="emit('select', node)">
        <span class="folder-nav-icon">⌑</span><span>{{ node.name }}</span><small>{{ node.materialCount }}</small>
        <span v-if="node.children.length" class="folder-nav-toggle">{{ isOpen(node) ? '⌄' : '›' }}</span>
      </button>
      <button v-if="admin && node.id && !(node.name === 'Sin clasificar' && node.parentId === null)" class="folder-nav-color" type="button" :aria-label="`Editar color de ${node.name}`" title="Editar color" :style="{ '--folder-color': node.color || 'var(--brand-green)' }" @click.stop="emit('editColor', node)"><span></span></button>
      <LibraryFolderTree v-if="node.children.length && isOpen(node)" :nodes="node.children" :selected-path="selectedPath" :expanded-paths="expandedPaths"
        :admin="admin" :depth="props.depth + 1" @select="emit('select', $event)" @edit-color="emit('editColor', $event)" />
    </li>
  </ul>
</template>
