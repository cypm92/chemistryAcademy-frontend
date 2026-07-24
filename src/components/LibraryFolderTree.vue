<script setup lang="ts">
import type { Material } from '../types'

export interface LibraryFolderNode {
  name: string
  path: string
  materials: Material[]
  children: LibraryFolderNode[]
  materialCount: number
}

defineOptions({ name: 'LibraryFolderTree' })
defineProps<{ nodes: LibraryFolderNode[]; selectedPath: string; depth?: number }>()
const emit = defineEmits<{ select: [path: string] }>()
</script>

<template>
  <ul class="folder-nav-list" :style="{ '--folder-depth': depth || 0 }">
    <li v-for="node in nodes" :key="node.path">
      <button :class="['folder-nav-item', { active: selectedPath === node.path }]" @click="emit('select', node.path)">
        <span class="folder-nav-icon">⌑</span><span>{{ node.name }}</span><small>{{ node.materialCount }}</small>
      </button>
      <LibraryFolderTree v-if="node.children.length" :nodes="node.children" :selected-path="selectedPath"
        :depth="(depth || 0) + 1" @select="emit('select', $event)" />
    </li>
  </ul>
</template>
