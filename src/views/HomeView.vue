<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import becienciaLogo from '../assets/beciencia-circular.svg'
import { branding, loadBranding } from '../services/theme'
import { homeContent, loadHomeContent } from '../services/home'
import TrialBookingModal from '../components/TrialBookingModal.vue'
import { api, errorMessage } from '../services/api'

onMounted(() => { void loadBranding(); void loadHomeContent() })
const heroLines = computed(() => homeContent.value.hero_title.split(/\n|(?<=\.)\s+/).filter(Boolean))
const contactDetails = computed(() => [
  homeContent.value.whatsapp && `WhatsApp ${homeContent.value.whatsapp}`,
  homeContent.value.email && `Correo ${homeContent.value.email}`,
  homeContent.value.instagram && `Instagram ${homeContent.value.instagram}`,
].filter(Boolean))
const trialBookingOpen = ref(false)
const contactForm = reactive({ name: '', contact: '', need: 'Clases particulares', message: '' })
const contactSending = ref(false); const contactNotice = ref(''); const contactError = ref('')
async function sendContactRequest() {
  contactSending.value = true; contactNotice.value = ''; contactError.value = ''
  try { await api.post('/public/contact-requests', contactForm); contactNotice.value = 'Mensaje enviado. La academia se pondrá en contacto contigo pronto.'; contactForm.name = ''; contactForm.contact = ''; contactForm.message = '' }
  catch (cause) { contactError.value = errorMessage(cause) } finally { contactSending.value = false }
}
function askAboutGroups() {
  contactForm.need = 'Clases en grupo — PAU'
  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function scrollToTrialBooking() {
  document.getElementById('prueba')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="beciencia-home">
    <header class="bc-header bc-wrap"><RouterLink class="bc-brand" to="/" aria-label="Be Ciencia, inicio"><img :src="branding.logoUrl || becienciaLogo" alt="Be Ciencia" /><span><b>CIENCIA</b><small>ACADEMIA</small></span></RouterLink><nav><a href="#clases">Clases</a><a href="#quien">Quién soy</a><a href="#contacto">Contacto</a></nav><RouterLink class="bc-access" to="/login">Acceder</RouterLink></header>
    <main>
      <section class="bc-hero bc-wrap"><h1><template v-for="(line, index) in heroLines" :key="line"><em v-if="index === heroLines.length - 1">{{ line }}</em><template v-else>{{ line }}</template><br v-if="index < heroLines.length - 1" /></template></h1><p>{{ homeContent.hero_description }}</p><div class="bc-hero-actions"><a href="#clases" class="bc-button">Ver las clases</a><button type="button" class="bc-button outline" @click="scrollToTrialBooking">Clase de prueba gratis</button></div><div class="bc-subjects"><span class="chem">Química</span><span class="organic">Química orgánica</span><span class="physics">Física</span><span class="math">Matemáticas</span></div></section>
      <section id="metodo" class="bc-concerns bc-wrap bc-section"><div class="bc-section-number">01</div><h2>¿Te suena alguna de estas?</h2><div class="bc-concern-grid"><p v-for="concern in homeContent.concerns" :key="concern">— “{{ concern.replace(/^“|”$/g, '') }}”</p></div><p class="bc-conclusion">Casi siempre el problema no es que no estudies lo suficiente. Es que nadie te ha enseñado a leer un examen.</p></section>
      <section id="clases" class="bc-classes bc-section"><div class="bc-wrap"><div class="bc-section-number">02</div><h2>Clases particulares<br />o en grupo.</h2><p class="bc-section-lead">Online, por videollamada, con material propio y las clases grabadas para que las repases.</p><div class="bc-plan-grid"><article class="bc-plan featured"><p class="bc-plan-type">Uno a uno</p><h3>Clases particulares</h3><p>Todo el tiempo para ti, a tu ritmo y con tus exámenes encima de la mesa.</p><ul><li>Sesiones de 60 minutos por videollamada</li><li>100% personalizadas a lo que tú necesitas</li><li>Dudas resueltas entre clase y clase</li><li>Colección de ejercicios resueltos incluida</li><li>Primera clase de prueba gratuita</li></ul><div class="bc-price"><span>Bachillerato</span><b>{{ homeContent.particular_price_bach }}<small>/ hora</small></b><span>Universidad</span><b>{{ homeContent.particular_price_uni }}<small>/ hora</small></b></div><button type="button" class="bc-button" @click="trialBookingOpen = true">Reservar clase de prueba</button></article><article class="bc-plan"><p class="bc-plan-type">Grupo reducido</p><h3>Clases en grupo</h3><p>Grupos de preparación de PAU en Química, Matemáticas y Física, y grupos de Química Orgánica.</p><ul><li>3 horas de clase a la semana</li><li>Grupos del mismo curso y nivel</li><li>Dudas resueltas entre clase y clase</li><li>Colección de ejercicios resueltos incluida</li><li>Primera clase de prueba gratuita</li></ul><div class="bc-price"><span>PAU · Química, mates o física</span><b>Consultar</b><span>Química orgánica</span><b>Consultar</b></div><button type="button" class="bc-button outline" @click="askAboutGroups">Preguntar por los grupos</button></article></div></div></section>
      <section id="prueba" class="bc-booking bc-wrap"><div><p class="bc-plan-type">Clase de prueba gratuita</p><h2>Elige día y hora<br />y nos vemos.</h2><p>Una hora, sin compromiso y sin pagar nada. Sirve para ver por dónde andas y si nos entendemos.</p></div><button type="button" class="bc-button" @click="trialBookingOpen = true">Reservar <span>→</span></button></section>
      <section id="quien" class="bc-about bc-wrap bc-section"><div><p class="bc-section-number">03</p><h2>{{ homeContent.about_title }}</h2></div><div class="bc-about-copy"><div class="bc-portrait">Be</div><blockquote>“{{ homeContent.about_quote }}”</blockquote><p>{{ homeContent.about_text }}</p><small>Clases online · Atención cercana · Sin fórmulas mágicas</small></div></section>
      <section class="bc-newsletter"><div class="bc-wrap"><p class="bc-plan-type">La newsletter</p><h2>{{ homeContent.newsletter_title }}</h2><p>{{ homeContent.newsletter_text }}</p><form class="bc-inline-form" @submit.prevent><input aria-label="Tu correo electrónico" type="email" placeholder="Tu correo electrónico" /><button class="bc-button">Quiero recibirlo</button></form><small>Solo contenido de química. Puedes darte de baja cuando quieras.</small></div></section>
      <section class="bc-testimonials bc-wrap bc-section"><div class="bc-section-number">05</div><h2>Lo que dicen mis alumnos.</h2><div class="bc-testimonial-grid"><article><b>★★★★★</b><p>“Las recomendaciones aparecerán aquí cuando estén disponibles.”</p><small>Be Ciencia · Bachillerato</small></article><article><b>★★★★★</b><p>“Cada experiencia real tendrá su espacio en esta sección.”</p><small>Be Ciencia · Universidad</small></article><article><b>★★★★★</b><p>“Una academia cercana, con un método claro.”</p><small>Be Ciencia · PAU</small></article></div></section>
      <section id="contacto" class="bc-contact"><div class="bc-wrap"><div><p class="bc-section-number">06</p><h2>{{ homeContent.contact_title }}</h2><p>{{ homeContent.contact_text }}</p><ul><li v-for="detail in contactDetails" :key="detail">{{ detail }}</li><li>Respuesta en menos de 24 h</li><li>Clase de prueba gratuita, sin compromiso</li></ul></div><form class="bc-contact-form" @submit.prevent="sendContactRequest"><label>Nombre<input v-model="contactForm.name" placeholder="Nombre" required minlength="2" /></label><label>Correo o WhatsApp<input v-model="contactForm.contact" placeholder="Correo o WhatsApp" required /></label><label>Qué necesitas<select v-model="contactForm.need"><option>Clases particulares</option><option>Clases en grupo — PAU</option><option>Clases en grupo — Química Orgánica</option><option>Clase de prueba gratuita</option><option>Aún no lo sé</option></select></label><label>Cuéntame<textarea v-model="contactForm.message" rows="4" /></label><p v-if="contactError" class="alert">{{ contactError }}</p><p v-if="contactNotice" class="success-alert">{{ contactNotice }}</p><button class="bc-button" :disabled="contactSending">{{ contactSending ? 'Enviando…' : 'Enviar mensaje' }}</button></form></div></section>
      <section class="bc-closing"><div class="bc-wrap"><p class="bc-section-number">Antes de irte</p><h2>{{ homeContent.closing_title }}</h2><p>{{ homeContent.closing_text }}</p><form class="bc-closing-form" @submit.prevent><input type="email" aria-label="Tu correo electrónico" placeholder="Tu correo electrónico" /><button class="bc-button">Envíadmelo</button></form></div></section>
    </main>
    <footer class="bc-footer bc-wrap"><span>© {{ new Date().getFullYear() }} Be Ciencia</span><span>Academia de química</span><RouterLink to="/login">Acceso alumnos</RouterLink></footer>
    <TrialBookingModal v-if="trialBookingOpen" @close="trialBookingOpen = false" />
  </div>
</template>
