<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const documents = {
  '/aviso-legal': { title: 'Aviso legal', eyebrow: 'INFORMACIÓN DEL TITULAR' },
  '/privacidad': { title: 'Política de privacidad', eyebrow: 'PROTECCIÓN DE DATOS' },
  '/cookies': { title: 'Política de cookies', eyebrow: 'TRANSPARENCIA DIGITAL' },
  '/terminos': { title: 'Términos y condiciones', eyebrow: 'SERVICIOS DE LA ACADEMIA' },
} as const
const document = computed(() => documents[route.path as keyof typeof documents] ?? documents['/aviso-legal'])
</script>

<template>
  <main class="legal-page">
    <header class="legal-header legal-wrap">
      <RouterLink class="legal-brand" to="/">Be Ciencia <small>Academia</small></RouterLink>
      <RouterLink to="/">Volver al inicio</RouterLink>
    </header>
    <article class="legal-wrap legal-content">
      <p class="legal-eyebrow">{{ document.eyebrow }}</p>
      <h1>{{ document.title }}</h1>
      <p class="legal-draft"><b>Texto de lanzamiento con datos de ejemplo.</b> Debe revisarse y sustituirse antes de la publicación definitiva por los datos reales de la titular.</p>

      <template v-if="route.path === '/aviso-legal'">
        <h2>1. Titular del sitio</h2>
        <p>Este sitio web es titularidad de Be Ciencia Educación, S.L., con CIF B-12345678 y domicilio en <span class="legal-placeholder">Calle Ejemplo 12, 35001 Las Palmas de Gran Canaria, España</span>.</p>
        <p>Contacto: <a href="mailto:privacidad@beciencia.es">privacidad@beciencia.es</a> · <span class="legal-placeholder">+34 600 000 000</span>. Si la titular estuviera inscrita en un registro público, se indicarán aquí el registro, tomo, folio y hoja correspondientes.</p>
        <h2>2. Objeto</h2>
        <p>Be Ciencia ofrece información sobre clases particulares y en grupo, así como un espacio privado de recursos académicos para alumnado autorizado.</p>
        <h2>3. Propiedad intelectual</h2>
        <p>Los contenidos, materiales, vídeos, diseños y marcas de este sitio pertenecen a Be Ciencia o se utilizan con autorización. No se permite su reproducción, distribución o comunicación pública fuera del uso personal del alumnado sin autorización previa por escrito.</p>
        <h2>4. Responsabilidad</h2>
        <p>La titular procura mantener la información actualizada, pero no garantiza la ausencia absoluta de errores ni la disponibilidad ininterrumpida del sitio. Los enlaces externos, si los hubiera, son responsabilidad de sus respectivos titulares.</p>
      </template>

      <template v-else-if="route.path === '/privacidad'">
        <h2>1. Responsable y contacto</h2>
        <p>Responsable: Be Ciencia Educación, S.L. CIF: B-12345678. Correo para privacidad: <a href="mailto:privacidad@beciencia.es">privacidad@beciencia.es</a>.</p>
        <h2>2. Datos, finalidades y base jurídica</h2>
        <ul><li><b>Contacto y clase de prueba:</b> nombre, correo o teléfono, materia y mensaje, para atender la consulta y organizar la reserva solicitada.</li><li><b>Cuenta de alumno:</b> nombre, email, contraseña cifrada, reservas y actividad académica, para prestar el servicio contratado o solicitado y gestionar el acceso.</li><li><b>Comunicaciones comerciales:</b> solo con consentimiento separado y revocable. Actualmente no se envían newsletters desde la plataforma.</li></ul>
        <p>La base jurídica será la aplicación de medidas precontractuales o la ejecución de la relación de servicios; cuando proceda, el consentimiento de la persona usuaria. No se venden datos personales ni se elaboran perfiles automatizados.</p>
        <h2>3. Destinatarios y transferencias</h2>
        <p>Los datos se alojarán con OVHcloud, como encargado del tratamiento. Podrán intervenir proveedores estrictamente necesarios para correo, copias de seguridad o videollamadas, que deberán figurar actualizados en esta política. Las fuentes de Google se cargan actualmente desde Google Fonts; antes de producción se recomienda alojarlas localmente para evitar esa comunicación técnica.</p>
        <h2>4. Conservación</h2>
        <p>Las consultas se conservarán durante <span class="legal-placeholder">12 meses (ejemplo)</span>; los datos de alumnado, mientras dure la relación y durante los plazos legales aplicables. Las reservas se conservarán el tiempo necesario para su gestión y trazabilidad. Después se eliminarán o bloquearán de forma segura.</p>
        <h2>5. Derechos</h2>
        <p>Puedes solicitar acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:privacidad@beciencia.es">privacidad@beciencia.es</a>. También puedes reclamar ante la Agencia Española de Protección de Datos, <a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>.</p>
        <h2>6. Menores de edad</h2>
        <p>La academia se dirige principalmente a alumnado de Bachillerato y universidad. Si la base del tratamiento es el consentimiento, las personas menores de 14 años deberán contar con autorización de padre, madre o tutor legal. La contratación de clases por menores requerirá la intervención de su representante legal cuando corresponda.</p>
      </template>

      <template v-else-if="route.path === '/cookies'">
        <h2>1. Qué usamos actualmente</h2>
        <p>La plataforma no utiliza actualmente cookies de analítica, publicidad ni redes sociales. Para mantener la sesión iniciada del alumnado se guarda en el navegador información técnica esencial mediante almacenamiento local: <code>academy_token</code> y <code>academy_user</code>.</p>
        <h2>2. Finalidad y duración</h2>
        <p>Estos elementos son necesarios para identificar la sesión y mostrar el espacio privado. Se eliminan al cerrar sesión desde la aplicación o al borrar los datos del navegador. No se emplean para crear perfiles publicitarios.</p>
        <h2>3. Consentimiento</h2>
        <p>Al ser tecnología técnica imprescindible para el inicio de sesión, no se solicita un consentimiento separado en este momento. Si se incorporan analítica, publicidad, píxeles o cookies no necesarias, se mostrará antes un panel con opciones equivalentes para aceptar, rechazar y configurar dichas finalidades.</p>
        <h2>4. Servicios de terceros</h2>
        <p>Las fuentes tipográficas se solicitan actualmente a Google Fonts. No son cookies, pero esta solicitud puede comunicar datos técnicos como la dirección IP. Antes de producción se recomienda servir las fuentes desde el propio servidor.</p>
      </template>

      <template v-else>
        <h2>1. Servicio</h2>
        <p>Be Ciencia ofrece clases particulares y en grupo de materias científicas, junto con recursos académicos para el alumnado autorizado. La reserva de una clase de prueba es una solicitud y queda sujeta a confirmación de la academia.</p>
        <h2>2. Precios, pagos y facturación</h2>
        <p>Los precios aplicables se comunicarán antes de contratar. Debe completarse aquí la información real sobre si los precios incluyen impuestos, medios de pago, facturación y condiciones de renovación de bonos o mensualidades.</p>
        <h2>3. Cambios y cancelaciones</h2>
        <p><span class="legal-placeholder">Ejemplo pendiente de validar: las cancelaciones o cambios deben solicitarse con al menos 24 horas de antelación.</span> La política definitiva deberá indicar cómo se recuperan clases, qué ocurre con ausencias y las excepciones aplicables.</p>
        <h2>4. Normas de uso</h2>
        <p>El alumnado debe usar la plataforma de forma diligente, mantener su contraseña confidencial y no compartir materiales, acceso o grabaciones sin autorización. La academia podrá suspender el acceso ante un uso fraudulento o contrario a estas condiciones.</p>
        <h2>5. Menores y grabaciones</h2>
        <p>Cuando participe una persona menor de edad, la contratación y autorizaciones necesarias corresponderán a su representante legal. Cualquier grabación de clase requerirá una información específica y la base jurídica o autorización que corresponda.</p>
        <h2>6. Legislación aplicable</h2>
        <p>Estas condiciones se rigen por la legislación española. Si la persona usuaria es consumidora, serán competentes los juzgados y tribunales que establezca la normativa de consumo aplicable.</p>
      </template>
    </article>
    <footer class="legal-footer legal-wrap"><RouterLink to="/aviso-legal">Aviso legal</RouterLink><RouterLink to="/privacidad">Privacidad</RouterLink><RouterLink to="/cookies">Cookies</RouterLink><RouterLink to="/terminos">Términos</RouterLink></footer>
  </main>
</template>
