# Controles para el visor de PDF

## Intención
Añadir controles de pantalla completa y zoom al visor de PDF ya usado dentro de la plataforma, para que resulte más cómodo leer documentos desde Biblioteca y Clases.

## Alcance
- El visor compartido es `src/components/MaterialViewer.vue`, utilizado por `LibraryView.vue` y `ClassesView.vue`; el cambio se implementará allí una sola vez.
- Los enlaces PDF de Recursos y Administración abren el archivo directamente en otra pestaña y no usan este visor integrado, por lo que quedan fuera de este cambio.
- Solo afecta a PDF; los controles actuales de vídeo permanecen sin cambios.

## Enfoques considerados
1. **Visor nativo sin recrear el iframe:** cambia `#zoom=` en la URL existente, sin añadir dependencia y conservando el elemento. Rechazado tras la prueba visual: el visor nativo no aplica el zoom cambiado después de la carga.
2. **Visor nativo recreando el iframe:** reaplica `#zoom=` al cargar y mantiene la compatibilidad actual, pero reinicia la posición/página. Rechazado porque interrumpe la lectura al hacer zoom.
3. **Integrar PDF.js (elegido por el usuario):** usar el `PDFViewer` oficial junto con el worker; permite controlar escala, conserva el visor/página y aporta renderizado de páginas, capa de texto y anotaciones. Añade `pdfjs-dist` como dependencia de ejecución, su CSS y un asset worker al bundle; mayor peso y mantenimiento que el visor nativo. Se prefiere la clase oficial a reconstruir manualmente las capas/ciclo de renderizado.

## Comportamiento propuesto
- Mostrar una barra de controles propia sobre el PDF con botones accesibles «Disminuir zoom», «Aumentar zoom» y «Pantalla completa», además del porcentaje actual.
- Ajustar el zoom en pasos de 10%, con límites de 50% a 200%; los botones quedan deshabilitados al alcanzar los límites.
- Inicializar cada PDF en 100%. La pantalla completa se activa sobre el área de lectura y permite volver a la vista modal mediante el control/salida estándar del navegador.
- Mantener el mismo comportamiento en Biblioteca y Clases mediante el componente compartido. Renderizar el PDF en una secuencia desplazable de páginas; al cambiar zoom, volver a renderizar sin perder la página visible ni su posición relativa.
- La implementación usa el setter `PDFViewer.currentScaleValue` de la versión fijada `pdfjs-dist@6.5.438`; el código de esa versión actualiza la escala y vuelve a la ubicación documentada (`_location`) en la página actual.

## No objetivos
No cambiar permisos ni descarga de materiales, no cambiar cómo abren los enlaces PDF públicos que van a otra pestaña, no cambiar el contrato de API y no tocar infraestructura de producción. Mantener intacto el visor y los controles de vídeo.

## Verificación y entrega
Añadir pruebas de componente para los límites, incremento/decremento, conservación de página/posición durante zoom y controles condicionales PDF/vídeo. Bundlear el worker con Vite y probar PDFs largos, cambios repetidos de zoom, cambio de material y desmontaje. Ejecutar `pnpm run type-check`, `pnpm run build` y las pruebas pertinentes; después validar visualmente en el entorno local. No publicar, desplegar ni hacer push.

## Supuestos pendientes de confirmar
La ruta protegida actual entrega un `blob:` URL; PDF.js lee esos bytes mediante `fetch`, por lo que el sandbox local permite `blob:` en `connect-src`. El visor ya no incrusta iframes; tras comprobar que el proyecto no tiene consumidores `blob:` en marcos y recibir autorización del usuario, se retiró `blob:` de `frame-src` (queda `frame-src 'self'`). Debe cancelarse la carga y liberar el documento/recursos al cambiar de material o desmontar el visor.