<script setup lang="ts">
import { onMounted, ref } from 'vue'
defineProps<{ labelledby: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLElement | null>(null)
onMounted(() => dialog.value?.focus())
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
  if (!controls.length) { event.preventDefault(); dialog.value.focus(); return }
  const first = controls[0]!, last = controls[controls.length - 1]!
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
</script>
<template>
  <Teleport to="body">
    <div class="teams-recreate-backdrop">
      <section ref="dialog" class="teams-recreate-dialog" role="dialog" aria-modal="true" :aria-labelledby="labelledby" tabindex="-1" @keydown="keydown"><slot /></section>
    </div>
  </Teleport>
</template>
<style scoped>
.teams-recreate-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(18, 30, 39, .55); display: grid; place-items: center; padding: 1rem; }
.teams-recreate-dialog { background: white; color: #24343b; border-radius: 14px; padding: 1.5rem; width: min(100%, 36rem); max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px #0003; }
.teams-recreate-dialog :deep(button) { margin: .5rem .5rem 0 0; }
</style>
