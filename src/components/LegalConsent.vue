<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
defineProps<{ purpose?: string }>()
</script>

<template>
  <label class="legal-consent">
    <input v-model="model" type="checkbox" required />
    <span>He leído la <RouterLink to="/privacidad" target="_blank">Política de privacidad</RouterLink>{{ purpose ? ` y acepto el tratamiento de mis datos para ${purpose}.` : '.' }}</span>
  </label>
</template>
