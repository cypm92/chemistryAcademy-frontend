<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Material } from '../types'
import { protectedBlobUrl } from '../services/api'

const props = defineProps<{ material: Material | null }>()
const emit = defineEmits<{ close: [] }>()
const url = ref('')
const loading = ref(false)

watch(() => props.material, async (material) => {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  if (!material) return
  loading.value = true
  try { url.value = await protectedBlobUrl(`/materials/${material.id}/content`) }
  finally { loading.value = false }
}, { immediate: true })
onBeforeUnmount(() => { if (url.value) URL.revokeObjectURL(url.value) })
</script>

<template>
  <div v-if="material" class="modal" @click.self="emit('close')">
    <div class="viewer-card">
      <div class="viewer-head">
        <div><span class="eyebrow">{{ material.kind }}</span><h2>{{ material.title }}</h2></div>
        <button class="icon-button" @click="emit('close')">×</button>
      </div>
      <div class="viewer-body" @contextmenu.prevent>
        <p v-if="loading">Preparando material…</p>
        <video v-else-if="material.kind === 'video'" :src="url" controls controlsList="nodownload" disablePictureInPicture />
        <iframe v-else :src="`${url}#toolbar=0&navpanes=0`" title="Documento PDF" />
      </div>
      <p class="viewer-note">Contenido personal. El acceso queda sujeto a tu periodo activo.</p>
    </div>
  </div>
</template>

