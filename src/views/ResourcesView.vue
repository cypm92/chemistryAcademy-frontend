<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import becienciaLogo from '../assets/beciencia-circular.svg'
import { branding, loadBranding } from '../services/theme'
import { session } from '../services/session'
import '../assets/resources.css'

type Subject = 'quimica' | 'organica' | 'fisica' | 'matematicas'
type Resource = { title: string; subject: Subject; label: string; detail: string; description: string; url?: string }

const subjectOptions: { key: Subject; label: string }[] = [
  { key: 'quimica', label: 'Química' },
  { key: 'fisica', label: 'Física' },
  { key: 'matematicas', label: 'Matemáticas II' },
]
const communities = [
  'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
  'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'C. Valenciana',
  'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco',
]
const videos: { title: string; subject: Subject; label: string; url?: string }[] = [
  { title: 'Ajustar una redox en medio básico', subject: 'quimica', label: 'Química' },
  { title: 'pH de una disolución reguladora', subject: 'quimica', label: 'Química' },
  { title: 'Tiro parabólico: el error del signo', subject: 'fisica', label: 'Física' },
  { title: 'Límite 0/0 sin L’Hôpital', subject: 'matematicas', label: 'Matemáticas II' },
  { title: '¿R o S? Carbono quiral en un minuto', subject: 'organica', label: 'Química Orgánica' },
  { title: 'Kc y Kp sin liarte con los moles', subject: 'quimica', label: 'Química' },
  { title: 'Campo eléctrico de dos cargas', subject: 'fisica', label: 'Física' },
  { title: 'Rango de una matriz con parámetro', subject: 'matematicas', label: 'Matemáticas II' },
]
const forms: Resource[] = [
  { title: 'Formulario de Química PAU', subject: 'quimica', label: 'Química', detail: 'PDF · 2 páginas', description: 'Constantes, equilibrio, ácido-base, redox y termoquímica.' },
  { title: 'Tabla periódica BeCiencia', subject: 'quimica', label: 'Química', detail: 'PDF · 1 página', description: 'Con masas, electronegatividades y estados de oxidación habituales.' },
  { title: 'Formulación inorgánica', subject: 'quimica', label: 'Química', detail: 'PDF · 2 páginas', description: 'Las normas IUPAC que piden en la PAU, con ejemplos.' },
  { title: 'Nomenclatura y reacciones orgánicas', subject: 'organica', label: 'Química Orgánica', detail: 'PDF · 2 páginas', description: 'Grupos funcionales, prioridades y tipos de reacción.' },
  { title: 'Formulario de Física PAU', subject: 'fisica', label: 'Física', detail: 'PDF · 2 páginas', description: 'Gravitación, campo eléctrico y magnético, ondas, óptica y física moderna.' },
  { title: 'Formulario de Matemáticas II', subject: 'matematicas', label: 'Matemáticas II', detail: 'PDF · 2 páginas', description: 'Derivadas, integrales, matrices, geometría y probabilidad.' },
]

// Los archivos del mockup son de ejemplo. Al disponer de PDFs y vídeos reales,
// añadir sus URL aquí y a las entradas correspondientes para activar cada enlace.
const pauFiles: Record<string, { enunciado?: string; soluciones?: string }> = {}
const selectedSubject = ref<Subject>('quimica')
const selectedCommunity = ref('Madrid')
const videoFilter = ref<Subject | 'todas'>('todas')
const visibleVideos = computed(() => videos.filter(video => videoFilter.value === 'todas' || video.subject === videoFilter.value))
const subjectLabel = computed(() => subjectOptions.find(option => option.key === selectedSubject.value)?.label || '')
const communityTitle = computed(() => selectedCommunity.value === 'Madrid' ? 'Comunidad de Madrid' : selectedCommunity.value)
const modelYears = [2027, 2026, 2025, 2024, 2023]
const currentFiles = computed(() => (year: number) => pauFiles[`${selectedSubject.value}:${selectedCommunity.value}:${year}`] || {})
const currentCommunityName = computed(() => selectedCommunity.value === 'Madrid' ? 'la Comunidad de Madrid' : selectedCommunity.value)
const accessPath = computed(() => session.user ? (session.user.role === 'admin' ? '/admin' : '/library') : '/login')

onMounted(() => { void loadBranding() })
</script>

<template>
  <div class="resources-page">
    <div class="resources-stripe" aria-hidden="true"><i v-for="subject in ['quimica','organica','fisica','matematicas']" :key="subject" :class="subject" /></div>
    <header class="resources-header"><div class="resources-wrap resources-nav">
      <RouterLink class="resources-logo" to="/" aria-label="Be Ciencia, inicio"><img :src="branding.logoUrl || becienciaLogo" alt="" /><span><b>CIENCIA</b><small>ACADEMIA</small></span></RouterLink>
      <nav aria-label="Navegación principal"><RouterLink class="resources-nav-secondary" :to="{ path: '/', hash: '#clases' }">Clases</RouterLink><RouterLink class="active" to="/recursos" aria-current="page">Recursos</RouterLink><RouterLink class="resources-nav-secondary" :to="{ path: '/', hash: '#quien' }">Quién soy</RouterLink><RouterLink class="resources-nav-secondary" :to="{ path: '/', hash: '#contacto' }">Contacto</RouterLink><RouterLink class="resources-access" :to="accessPath">{{ session.user ? 'Mi espacio' : 'Acceder' }}</RouterLink></nav>
    </div></header>

    <main>
      <div class="resources-wrap resources-hero"><span class="resources-eyebrow">Recursos gratuitos</span><h1>Exámenes, vídeos<br />y formularios.<br /><em>Gratis.</em></h1><p>Los modelos de examen de la PAU de Química, Física y Matemáticas de todas las comunidades, con sus soluciones. Y ejercicios cortos en vídeo para cuando tienes cinco minutos. Sin registrarte.</p>
        <div class="resources-index"><a href="#pau"><span>01</span><b>Modelos PAU</b><small>17 comunidades · enunciados y soluciones en PDF</small></a><a href="#videos"><span>02</span><b>Ejercicios en vídeo</b><small>Un problema, un minuto. Los mismos de Instagram y TikTok</small></a><a href="#formularios"><span>03</span><b>Formularios</b><small>Para imprimir y tener delante mientras estudias</small></a></div>
      </div>

      <section id="pau" class="resources-section"><div class="resources-wrap"><div class="resources-section-head"><span>01</span><div><h2>El modelo de la PAU de tu comunidad.</h2><p>Elige asignatura y comunidad. Cada modelo tiene su enunciado y sus soluciones, resueltas a mano paso a paso.</p></div></div>
        <div class="resources-indent"><div class="resources-filter-group"><span class="resources-label">Asignatura</span><div class="resources-subject-filters"><button v-for="subject in subjectOptions" :key="subject.key" type="button" :class="['resources-subject', subject.key]" :aria-pressed="selectedSubject === subject.key" @click="selectedSubject = subject.key"><i />{{ subject.label }}</button></div></div>
          <div class="resources-filter-group"><span class="resources-label">Comunidad</span><div class="resources-communities"><button v-for="community in communities" :key="community" type="button" :class="selectedSubject" :aria-pressed="selectedCommunity === community" @click="selectedCommunity = community">{{ community }}</button></div></div>
          <div :class="['resources-result', selectedSubject]" aria-live="polite"><div class="resources-result-head"><div><span class="resources-label">{{ subjectLabel }}</span><h3>{{ communityTitle }}</h3></div><span class="resources-pill">Soluciones a mano</span></div>
            <ul class="resources-model-list"><li v-for="year in modelYears" :key="year" class="resources-model-row"><span class="resources-year">{{ year }}</span><span>Modelo<small>curso {{ year - 1 }}-{{ String(year).slice(-2) }}</small></span><div class="resources-model-actions"><template v-if="currentFiles(year).enunciado || currentFiles(year).soluciones"><a v-if="currentFiles(year).enunciado" :href="currentFiles(year).enunciado" class="resources-download" target="_blank" rel="noopener noreferrer">↓ Enunciado</a><a v-if="currentFiles(year).soluciones" :href="currentFiles(year).soluciones" class="resources-download" target="_blank" rel="noopener noreferrer">↓ Soluciones</a></template><span v-else class="resources-pending">{{ year === 2027 ? 'Lo subo en cuanto se publique' : 'Próximamente' }}</span></div></li></ul>
            <div class="resources-locked"><span aria-hidden="true">▢</span><div><b>Convocatorias ordinaria y extraordinaria, resueltas</b><small>Todos los exámenes reales de tu comunidad estarán en el área de alumnos.</small></div><RouterLink :to="{ path: '/', hash: '#clases' }" class="resources-button outline small">Ver las clases</RouterLink></div>
            <p class="resources-source">Enunciados publicados por los organismos oficiales de {{ currentCommunityName }}. Las soluciones resueltas a mano serán de Be Ciencia. <span>Fuente oficial pendiente</span></p>
          </div>
          <div class="resources-cta"><div><h3>¿Te atascas con un examen? Lo resolvemos juntos.</h3><p>Trae el que se te resista a la clase de prueba. Es gratis y sin compromiso.</p></div><RouterLink :to="{ path: '/', hash: '#prueba' }" class="resources-button">Reservar clase de prueba</RouterLink></div>
        </div></div></section>

      <section id="videos" class="resources-section"><div class="resources-wrap"><div class="resources-section-head"><span>02</span><div><h2>Un ejercicio, un minuto.</h2><p>Problemas cortos resueltos en vídeo, con el error que casi todo el mundo comete. Son los que publico en Instagram y TikTok, ordenados por asignatura para que no tengas que hacer scroll.</p></div></div>
        <div class="resources-indent"><div class="resources-video-filters"><button v-for="filter in [{ key: 'todas', label: 'Todas' }, { key: 'quimica', label: 'Química' }, { key: 'organica', label: 'Orgánica' }, { key: 'fisica', label: 'Física' }, { key: 'matematicas', label: 'Matemáticas' }] as const" :key="filter.key" type="button" :aria-pressed="videoFilter === filter.key" @click="videoFilter = filter.key">{{ filter.label }}</button></div>
          <div class="resources-video-grid"><article v-for="video in visibleVideos" :key="video.title" :class="['resources-video', video.subject]"><component :is="video.url ? 'a' : 'div'" :href="video.url" :target="video.url ? '_blank' : undefined" :rel="video.url ? 'noopener noreferrer' : undefined" class="resources-video-cover"><span>{{ video.label }}</span><strong>{{ video.title }}</strong><span class="resources-video-foot"><span class="resources-play" aria-hidden="true">▶</span><b>Be</b></span></component><small>{{ video.url ? 'Ver vídeo ↗' : 'Próximamente' }}</small></article></div>
          <p class="resources-social">Salen vídeos nuevos cada semana en <span>Instagram y TikTok · enlaces próximamente</span></p>
        </div></div></section>

      <section id="formularios" class="resources-section"><div class="resources-wrap"><div class="resources-section-head"><span>03</span><div><h2>Formularios para tener delante.</h2><p>Una o dos páginas por asignatura, con lo que entra en la PAU y nada más. Pensados para imprimir.</p></div></div>
        <div class="resources-indent"><ul class="resources-form-list"><li v-for="form in forms" :key="form.title" :class="['resources-form', form.subject]"><i aria-hidden="true" /><div><b>{{ form.title }}</b><small>{{ form.label }} · {{ form.detail }}</small><p>{{ form.description }}</p></div><a v-if="form.url" :href="form.url" class="resources-download" target="_blank" rel="noopener noreferrer">↓ Descargar</a><span v-else class="resources-pill pending">Próximamente</span></li></ul></div>
      </div></section>
    </main>

    <div class="resources-stripe" aria-hidden="true"><i v-for="subject in ['quimica','organica','fisica','matematicas']" :key="subject" :class="subject" /></div>
    <footer class="resources-footer resources-wrap"><div><RouterLink :to="{ path: '/', hash: '#clases' }">Clases</RouterLink><RouterLink class="active" to="/recursos">Recursos</RouterLink><RouterLink :to="{ path: '/', hash: '#quien' }">Quién soy</RouterLink><RouterLink :to="{ path: '/', hash: '#contacto' }">Contacto</RouterLink><RouterLink :to="accessPath">{{ session.user ? 'Mi espacio' : 'Acceder' }}</RouterLink></div><div><RouterLink to="/aviso-legal">Aviso legal</RouterLink><RouterLink to="/privacidad">Privacidad</RouterLink><RouterLink to="/cookies">Cookies</RouterLink></div><span>Be Ciencia</span></footer>
  </div>
</template>
