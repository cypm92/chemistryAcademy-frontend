<script setup lang="ts">
import { ref } from 'vue'
import type { Material } from '../types'

export interface LibraryFolderNode {
  name: string
  path: string
  materials: Material[]
  children: LibraryFolderNode[]
  materialCount: number
}

defineOptions({ name: 'LibraryFolderTree' })
const props = withDefaults(defineProps<{ nodes: LibraryFolderNode[]; selectedPath: string; depth?: number; maxDepth?: number }>(), { depth: 0, maxDepth: 1 })
const emit = defineEmits<{ select: [path: string] }>()
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
      <button :class="['folder-nav-item', { active: selectedPath === node.path }]" @click="choose(node)">
        <span class="folder-nav-icon">⌑</span><span>{{ node.name }}</span><small>{{ node.materialCount }}</small>
        <span v-if="props.depth === 0 && node.children.length" class="folder-nav-toggle">{{ isOpen(node) ? '⌄' : '›' }}</span>
      </button>
      <LibraryFolderTree v-if="node.children.length && props.depth < props.maxDepth && isOpen(node)" :nodes="node.children" :selected-path="selectedPath"
        :depth="props.depth + 1" :max-depth="props.maxDepth" @select="emit('select', $event)" />
    </li>
  </ul>
</template>
