<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Folder } from '../types'

const props = withDefaults(defineProps<{
  folders: Folder[]
  modelValue: number | null
  excludedFolderId?: number | null
  allowRoot?: boolean
}>(), { excludedFolderId: null, allowRoot: true })
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const open = ref(false)
const expandedIds = ref<number[]>([])
const selectedLabel = computed(() => {
  if (props.modelValue === null) return props.allowRoot ? 'Carpeta raíz' : 'Selecciona una carpeta'
  return props.folders.find(folder => folder.id === props.modelValue)?.path || 'Selecciona una carpeta'
})
const options = computed(() => {
  const childrenByParent = new Map<number | null, Folder[]>()
  for (const folder of props.folders) {
    const children = childrenByParent.get(folder.parent_id) || []
    children.push(folder)
    childrenByParent.set(folder.parent_id, children)
  }
  for (const children of childrenByParent.values()) children.sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const excluded = new Set<number>()
  if (props.excludedFolderId !== null) {
    const pending = [props.excludedFolderId]
    while (pending.length) {
      const id = pending.pop()!
      excluded.add(id)
      for (const child of childrenByParent.get(id) || []) pending.push(child.id)
    }
  }

  const rows: Array<{ folder: Folder; depth: number; hasChildren: boolean }> = []
  const visit = (parentId: number | null, depth: number) => {
    for (const folder of childrenByParent.get(parentId) || []) {
      if (excluded.has(folder.id)) continue
      const hasChildren = (childrenByParent.get(folder.id) || []).some(child => !excluded.has(child.id))
      rows.push({ folder, depth, hasChildren })
      if (expandedIds.value.includes(folder.id)) visit(folder.id, depth + 1)
    }
  }
  visit(null, 0)
  return rows
})

function toggle(folderId: number) {
  if (!expandedIds.value.includes(folderId)) {
    expandedIds.value = [...expandedIds.value, folderId]
    return
  }
  const descendants = new Set([folderId])
  const pending = [folderId]
  while (pending.length) {
    const id = pending.pop()!
    for (const folder of props.folders) {
      if (folder.parent_id !== id) continue
      descendants.add(folder.id)
      pending.push(folder.id)
    }
  }
  expandedIds.value = expandedIds.value.filter(id => !descendants.has(id))
}
function select(folderId: number | null) {
  emit('update:modelValue', folderId)
  open.value = false
}
</script>

<template>
  <div class="folder-parent-picker" @keydown.esc="open = false">
    <button class="folder-parent-trigger" type="button" :aria-expanded="open" aria-haspopup="tree" @click="open = !open">
      <span class="folder-parent-trigger-icon" aria-hidden="true">⌑</span>
      <span class="folder-parent-trigger-label">{{ selectedLabel }}</span>
      <span class="folder-parent-trigger-chevron" aria-hidden="true">{{ open ? '⌃' : '⌄' }}</span>
    </button>
    <div v-if="open" class="folder-parent-options" role="tree" aria-label="Árbol de carpetas">
      <header class="folder-picker-head"><span>ELIGE UNA UBICACIÓN</span><button type="button" aria-label="Cerrar selector" @click="open = false">×</button></header>
      <button v-if="allowRoot" class="folder-parent-option root" :class="{ selected: modelValue === null }" type="button" role="treeitem" @click="select(null)">
        <span class="folder-root-icon" aria-hidden="true">⌂</span><span>Carpeta raíz</span><b v-if="modelValue === null" aria-hidden="true">✓</b>
      </button>
      <div v-if="allowRoot" class="folder-picker-divider"></div>
      <div v-for="option in options" :key="option.folder.id" class="folder-parent-row" :style="{ '--folder-depth': option.depth }">
        <button v-if="option.hasChildren" class="folder-parent-toggle" type="button" :aria-label="`${expandedIds.includes(option.folder.id) ? 'Contraer' : 'Desplegar'} ${option.folder.name}`" @click="toggle(option.folder.id)">{{ expandedIds.includes(option.folder.id) ? '⌄' : '›' }}</button>
        <span v-else class="folder-parent-placeholder" aria-hidden="true"></span>
        <button class="folder-parent-option" :class="{ selected: modelValue === option.folder.id }" type="button" role="treeitem" :aria-level="option.depth + 1" @click="select(option.folder.id)">
          <span class="folder-color-dot" :style="{ backgroundColor: option.folder.effective_color || 'var(--brand-green)' }"></span>
          <span>{{ option.folder.name }}</span><b v-if="modelValue === option.folder.id" aria-hidden="true">✓</b>
        </button>
      </div>
    </div>
  </div>
</template>
