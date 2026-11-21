<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps<{ title: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLElement | null>(null)
const origin = document.activeElement as HTMLElement | null
const originContainer = origin?.parentElement
function focusInitial() {
  const target = dialog.value?.querySelector<HTMLButtonElement>('[data-initial-focus]:not(:disabled)')
  ;(target ?? dialog.value)?.focus()
}
function focusStable() { dialog.value?.focus() }
defineExpose({ focusStable })
onMounted(() => { document.addEventListener('keydown', keydown, true); nextTick(focusInitial) })
watch(() => props.busy, (busy, wasBusy) => {
  if (!busy && wasBusy && document.activeElement === dialog.value) nextTick(focusInitial)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keydown, true)
  nextTick(() => {
    if (origin?.isConnected && !origin.hasAttribute('disabled')) origin.focus()
    else originContainer?.querySelector<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]')?.focus()
  })
})
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); if (!props.busy) emit('close'); return }
  if (event.key !== 'Tab') return
  const items = Array.from(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])
  if (!items.length) { event.preventDefault(); dialog.value?.focus(); return }
  const index = items.indexOf(document.activeElement as HTMLElement)
  if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1]?.focus() }
  else if (!event.shiftKey && (index === -1 || index === items.length - 1)) { event.preventDefault(); items[0]?.focus() }
}
</script>
<template>
  <div class="modal dialog-overlay" @click.self="!busy && emit('close')">
    <section ref="dialog" class="panel dialog-card" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
      <h2>{{ title }}</h2>
      <slot />
    </section>
  </div>
</template>
<style scoped>
.dialog-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 1rem; background: rgba(0,0,0,.5); }
.dialog-card { width: min(100%, 32rem); max-height: 90vh; overflow: auto; }
</style>
