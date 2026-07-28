<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Material } from '../types'
import { protectedBlobUrl } from '../services/api'

const props = defineProps<{ material: Material | null }>()
const emit = defineEmits<{ close: [] }>()
const url = ref('')
const loading = ref(false)
const video = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const playbackRate = ref(1)

const progress = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0)

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

async function togglePlayback() {
  if (!video.value) return
  if (video.value.paused) await video.value.play()
  else video.value.pause()
}

function seekBy(seconds: number) {
  if (video.value) video.value.currentTime = Math.max(0, Math.min(video.value.duration || 0, video.value.currentTime + seconds))
}

function seek(event: Event) {
  if (video.value) video.value.currentTime = Number((event.target as HTMLInputElement).value)
}

function setVolume(event: Event) {
  if (!video.value) return
  volume.value = Number((event.target as HTMLInputElement).value) / 100
  video.value.volume = volume.value
}

function setPlaybackRate(rate: number) {
  playbackRate.value = rate
  if (video.value) video.value.playbackRate = rate
}

watch(() => props.material, async (material) => {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  playbackRate.value = 1
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
        <div v-else-if="material.kind === 'video'" class="video-player">
          <video ref="video" :src="url" controlsList="nodownload" disablePictureInPicture @click="togglePlayback"
            @loadedmetadata="duration = video?.duration || 0" @timeupdate="currentTime = video?.currentTime || 0"
            @canplay="video && (video.volume = volume, video.playbackRate = playbackRate)"
            @play="isPlaying = true" @pause="isPlaying = false" @ended="isPlaying = false" />
          <div class="video-controls" aria-label="Controles del vídeo">
            <button type="button" class="video-control-play" :aria-label="isPlaying ? 'Pausar vídeo' : 'Reproducir vídeo'" @click="togglePlayback">
              {{ isPlaying ? 'Ⅱ' : '▶' }}
            </button>
            <button type="button" class="video-control-button" aria-label="Retroceder 10 segundos" @click="seekBy(-10)">↶ 10</button>
            <button type="button" class="video-control-button" aria-label="Avanzar 10 segundos" @click="seekBy(10)">10 ↷</button>
            <span class="video-time">{{ formatTime(currentTime) }}</span>
            <input class="video-progress" type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime"
              aria-label="Progreso del vídeo" @input="seek" />
            <span class="video-time">{{ formatTime(duration) }}</span>
            <div class="video-speed" aria-label="Velocidad de reproducción"><button v-for="rate in [1, 1.5, 2]" :key="rate" type="button"
              :class="{ active: playbackRate === rate }" @click="setPlaybackRate(rate)">x{{ String(rate).replace('.', ',') }}</button></div>
            <span class="video-volume-icon">♬</span>
            <input class="video-volume" type="range" min="0" max="100" step="1" :value="volume * 100" aria-label="Volumen"
              :style="{ background: `linear-gradient(to right, #71b9ef 0%, #71b9ef ${volume * 100}%, #ffffff55 ${volume * 100}%, #ffffff55 100%)` }" @input="setVolume" />
            <span class="video-volume-value">{{ Math.round(volume * 100) }}%</span>
          </div>
        </div>
        <iframe v-else :src="`${url}#toolbar=0&navpanes=0`" title="Documento PDF" />
      </div>
      <p class="viewer-note">Contenido personal. El acceso queda sujeto a tu periodo activo.</p>
    </div>
  </div>
</template>
