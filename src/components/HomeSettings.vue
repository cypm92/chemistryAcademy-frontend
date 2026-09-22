<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { errorMessage } from '../services/api'
import { homeContent, loadHomeContent, saveHomeContent, type HomeContent } from '../services/home'

const emit = defineEmits<{ close: [] }>()
const form = ref<HomeContent>({ ...homeContent.value, concerns: [...homeContent.value.concerns] })
const saving = ref(false); const error = ref(''); const notice = ref('')
onMounted(async () => { await loadHomeContent(); form.value = { ...homeContent.value, concerns: [...homeContent.value.concerns] } })
async function save() { saving.value = true; error.value = ''; notice.value = ''; try { await saveHomeContent(form.value); notice.value = 'Textos de la portada actualizados.' } catch (cause) { error.value = errorMessage(cause) } finally { saving.value = false } }
</script>
<template>
  <div class="modal home-settings-modal" role="dialog" aria-modal="true" aria-label="Editar portada" @click.self="emit('close')"><form class="home-settings-card" @submit.prevent="save">
    <header><div><p class="eyebrow">PORTADA PÚBLICA</p><h2>Editar textos</h2><p>Estos cambios se muestran al momento en la página de inicio.</p></div><button class="icon-button" type="button" @click="emit('close')">×</button></header>
    <div class="home-settings-body"><label>Titular principal<textarea v-model="form.hero_title" rows="2" /></label><label>Descripción principal<textarea v-model="form.hero_description" rows="3" /></label><label>Frases de alumnos o necesidades <small>Una por línea</small><textarea :value="form.concerns.join('\n')" rows="6" @input="form.concerns = ($event.target as HTMLTextAreaElement).value.split('\n').map(value => value.trim()).filter(Boolean)" /></label><div class="home-settings-grid"><label>Precio Bachillerato<input v-model="form.particular_price_bach" /></label><label>Precio Universidad<input v-model="form.particular_price_uni" /></label></div><label>Presentación: título<input v-model="form.about_title" /></label><label>Presentación: frase<textarea v-model="form.about_quote" rows="2" /></label><label>Presentación: texto<textarea v-model="form.about_text" rows="3" /></label><label>Newsletter: título<textarea v-model="form.newsletter_title" rows="2" /></label><label>Newsletter: texto<textarea v-model="form.newsletter_text" rows="3" /></label><label>Contacto: título<input v-model="form.contact_title" /></label><label>Contacto: texto<textarea v-model="form.contact_text" rows="3" /></label><div class="home-settings-grid"><label>WhatsApp<input v-model="form.whatsapp" placeholder="+34…" /></label><label>Correo<input v-model="form.email" placeholder="hola@…" /></label></div><label>Instagram<input v-model="form.instagram" placeholder="@…" /></label><label>Cierre: título<textarea v-model="form.closing_title" rows="2" /></label><label>Cierre: texto<textarea v-model="form.closing_text" rows="3" /></label><p v-if="error" class="alert">{{ error }}</p><p v-if="notice" class="success-alert">{{ notice }}</p></div>
    <footer><button class="secondary" type="button" @click="emit('close')">Cerrar</button><button class="primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar portada' }}</button></footer>
  </form></div>
</template>
