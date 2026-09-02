<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import becienciaLogo from '../assets/beciencia-circular.svg'
import heroImage from '../assets/beciencia-hero.png'
import { branding, loadBranding } from '../services/theme'

onMounted(() => { void loadBranding() })

const topics = [
  ['01', 'Química general', 'Estequiometría, formulación, estructura atómica y enlace químico.'],
  ['02', 'Química orgánica', 'Nomenclatura, reactividad y mecanismos explicados paso a paso.'],
  ['03', 'Equilibrio y energía', 'Ácido-base, redox, termodinámica y cinética sin fórmulas sueltas.'],
]
</script>

<template>
  <div class="home-page">
    <header class="home-header">
      <RouterLink class="home-brand" to="/" aria-label="Be Ciencia, inicio"><img :src="branding.logoUrl || becienciaLogo" alt="Be Ciencia" /><span><b>Be Ciencia</b><small>ACADEMIA DE QUÍMICA</small></span></RouterLink>
      <nav aria-label="Navegación principal"><a href="#metodo">El método</a><a href="#materias">Materias</a><a href="#contacto">Cómo funciona</a></nav>
      <div class="home-access"><RouterLink class="home-login" to="/login">Iniciar sesión</RouterLink><RouterLink class="home-register" to="/login?mode=register">Crear cuenta</RouterLink></div>
    </header>
    <main>
      <section class="home-hero">
        <img :src="heroImage" alt="Profesora de química explicando un modelo molecular a dos estudiantes" /><div class="hero-shade"></div>
        <div class="home-hero-copy"><p class="home-eyebrow"><span>Be</span> QUÍMICA QUE SE ENTIENDE</p><h1>Haz que la química<br /><em>encaje.</em></h1><p class="home-lead">Clases particulares de química desde Bachillerato para comprender, practicar y llegar seguro a cada examen.</p><div class="hero-actions"><RouterLink class="home-cta" to="/login?mode=register">Quiero empezar <span>→</span></RouterLink><a class="home-text-link" href="#metodo">Conoce el método <span>↓</span></a></div></div>
        <aside class="hero-note"><b>Be</b><span>El elemento que transforma el “no entiendo” en “ya lo veo”.</span></aside>
      </section>
      <section id="metodo" class="home-intro section-wrap"><p class="home-eyebrow dark">UNA ACADEMIA, UN PLAN HECHO PARA TI</p><div class="intro-grid"><h2>No memorizas química.<br />Aprendes a <em>pensarla.</em></h2><div><p>En Be Ciencia cada clase parte de tu nivel y de lo que necesitas ahora. Convertimos los temas que se atascan en un método claro que puedes repetir por tu cuenta.</p><RouterLink to="/login?mode=register" class="underlined-link">Conocer las clases <span>→</span></RouterLink></div></div><div class="benefit-grid"><article><span class="benefit-number">01</span><h3>Tu ritmo</h3><p>Clases individuales o en grupos reducidos, con objetivos realistas y cercanos.</p></article><article><span class="benefit-number">02</span><h3>Tu mapa</h3><p>Materiales organizados, ejercicios seleccionados y seguimiento en cada bloque.</p></article><article><span class="benefit-number">03</span><h3>Tu confianza</h3><p>Aprendes a razonar para enfrentarte a problemas nuevos sin depender de una plantilla.</p></article></div></section>
      <section id="materias" class="subjects-section"><div class="section-wrap"><p class="home-eyebrow">LO QUE TRABAJAMOS</p><div class="subjects-heading"><h2>Todos los temas,<br /><em>con sentido.</em></h2><p>Desde los fundamentos de Bachillerato hasta la preparación específica de pruebas de acceso y primeros cursos universitarios.</p></div><div class="topic-list"><article v-for="([number, title, description]) in topics" :key="number"><span>{{ number }}</span><div><h3>{{ title }}</h3><p>{{ description }}</p></div><b>↗</b></article></div></div></section>
      <section id="contacto" class="home-final section-wrap"><p class="home-eyebrow dark">EMPIEZA CUANDO QUIERAS</p><h2>Tu próxima clase puede<br />ser el principio de algo <em>grande.</em></h2><p>Regístrate para acceder a tu espacio personal, materiales y clases. La academia se adapta a ti desde el primer día.</p><RouterLink class="home-cta" to="/login?mode=register">Crear mi cuenta <span>→</span></RouterLink></section>
    </main>
    <footer class="home-footer"><span>© {{ new Date().getFullYear() }} Be Ciencia</span><span>Academia de química · Bachillerato y Universidad</span><RouterLink to="/login">Acceso alumnos</RouterLink></footer>
  </div>
</template>
