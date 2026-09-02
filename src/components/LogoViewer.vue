<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import becienciaLogo from '../assets/beciencia-circular.svg'

defineProps<{ logoSrc?: string | null }>()
const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.classList.add('modal-open')
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('modal-open')
})
</script>

<template>
  <div class="logo-viewer" role="dialog" aria-modal="true" aria-label="Logo de BeCiencia Academia" @click.self="emit('close')">
    <div class="logo-viewer-card">
      <button class="logo-viewer-close" type="button" aria-label="Cerrar logo ampliado" @click="emit('close')">×</button>
      <img :src="logoSrc || becienciaLogo" alt="BeCiencia Academia" />
    </div>
  </div>
</template>
