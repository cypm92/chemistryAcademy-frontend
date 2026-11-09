# Plan de implementación: visor PDF con zoom que conserva la lectura

> **Para agentes:** subhabilidad obligatoria: usar `superpowers:executing-plans` para implementar este plan paso a paso. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Reemplazar el zoom nativo que no responde a cambios de fragmento por PDF.js, manteniendo zoom, pantalla completa y posición de lectura en Biblioteca y Clases.

**Arquitectura:** Añadir `pdfjs-dist@6.5.438` y empaquetar su worker con Vite. Un componente PDF dedicado carga el blob ya autorizado por la API y usa `PDFViewer` de PDF.js para páginas, scroll, texto, anotaciones y ciclo de renderizado. El control delega la escala en `currentScaleValue`, que conserva la ubicación actual. `MaterialViewer.vue` mantiene la rama de vídeo intacta.

**Tech Stack:** Vue 3, TypeScript, PDF.js 6.5.438 (Apache-2.0), Vite, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-09-pdf-viewer-controls-design.md`

## Global Constraints

- Zoom: inicio 100%, pasos de 10%, límites 50–200%, botones deshabilitados en los extremos.
- Mantener la página visible y su posición relativa al cambiar zoom; el PDF conserva selección de texto.
- Reutilizar `protectedBlobUrl()`; no cambiar el contrato de API, descargas ni permisos.
- Controles PDF solo para PDF; conservar vídeo y su pantalla completa sin cambios.
- Preservar los cambios de usuario, incluyendo backend local; no desplegar ni publicar producción.
- Usar el Docker Compose local existente; nunca leer ni exponer `.env.local`.

## Review Focus

- **Cambio de material durante carga/render:** la carga anterior se cancela y no reemplaza páginas del nuevo PDF.
- **Zoom con una página intermedia parcialmente visible:** tras renderizar, se conserva esa página y el mismo desplazamiento relativo.
- **PDF grande o página de dimensiones altas:** no dejar render tasks ni canvases viejos activos tras zoom/cambio de material.
- **PDF inválido o worker no disponible:** mostrar error legible y conservar funcional el cierre/otro material.
- **Selección de texto y vídeo:** la capa de texto sigue alineada tras zoom y la rama de vídeo no cambia.

---

### Task 1: Añadir PDF.js y visor de páginas

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `src/components/MaterialViewer.vue`
- Create: `src/components/PdfDocumentViewer.vue`
- Modify: `src/assets/main.css`
- Create: `tests/pdfjs-viewer.test.ts`

**Interfaces:**
- Dependency exacta: `pdfjs-dist@6.5.438`; worker importado como `pdfjs-dist/build/pdf.worker.min.mjs?url` y asignado a `GlobalWorkerOptions.workerSrc`. Importar también `pdfjs-dist/web/pdf_viewer.css` para las capas oficiales.
- `PdfDocumentViewer` recibe `src: string` (blob URL) y encapsula carga, renderizado, escala, scroll, error y limpieza.
- Instancia `EventBus`, `PDFLinkService` y `PDFViewer` de `pdfjs-dist/web/pdf_viewer.mjs`; renderizado virtualizado y capas oficiales de texto/anotación; sin iframe.
- El zoom cambia `PDFViewer.currentScaleValue` a `NN%`, manteniendo el mismo objeto/contendor. La implementación PDF.js 6.5.438 restaura página y coordenadas guardadas al escalar.
- Al cambiar `src` o desmontar, llama `PDFViewer.setDocument(null)` y destruye la tarea de carga; el padre no revoca el blob viejo hasta que el hijo haya limpiado el documento.

- [ ] **Paso 1: Añadir `pdfjs-dist@6.5.438` como dependencia directa** con pnpm, usando versión exacta y actualizando solo manifiesto/lockfile.
- [ ] **Paso 2: Escribir primero las pruebas** en `tests/pdfjs-viewer.test.ts` con PDF.js simulado y `protectedBlobUrl` simulado: render multipágina, inicialización a 100%, zoom +/− y límites, mismo PDFViewer/página al escalar, cambio de material y carreras de carga, error de carga, fullscreen sobre el contenedor, capa de texto y controles de vídeo intactos.
- [ ] **Paso 3: Ejecutar el test específico y confirmar RED**: `pnpm exec vitest run tests/pdfjs-viewer.test.ts`; debe fallar por el visor PDF.js aún no implementado.
- [ ] **Paso 4: Implementar `PdfDocumentViewer.vue`**: configurar worker, crear `EventBus`/`PDFLinkService`/`PDFViewer`, cargar `src`, delegar escala al visor oficial, mostrar estado/error y limpiar tareas/documento en cambios/unmount.
- [ ] **Paso 5: Integrar el componente en `MaterialViewer.vue`** sin modificar video; mantener botones accesibles, fullscreen, barra de zoom y estados de carga/error. Actualizar estilos en `main.css` para páginas, capa de texto y scroll responsive.
- [ ] **Paso 6: Ejecutar pruebas específicas y confirmar GREEN** con `pnpm exec vitest run tests/pdfjs-viewer.test.ts`.
- [ ] **Paso 7: Ejecutar type-check y build**: `pnpm run type-check && pnpm run build`; ambos deben terminar con código 0 y empaquetar el worker.

### Task 2: Verificar cambios existentes de la pasarela local

**Files:**
- Revisión sin cambios adicionales: `../backend/local-microsoft-sandbox/proxy.js`
- Test existente: `../backend/local-microsoft-sandbox/proxy.test.js`

**Interfaces:** La pasarela aplica CSP solo al sandbox local; el frontend usa `blob:` creado por `protectedBlobUrl()`. `connect-src 'self' blob:` es necesario para que PDF.js lea los bytes; no hay consumidor `blob:` en `frame-src`, así que se retiró con autorización expresa del usuario. Header local verificado tras reiniciar solo `beciencia-local-gateway-1`: `connect-src 'self' blob:; frame-src 'self'`.

- [x] **Paso 1: Ejecutar** `node --test local-microsoft-sandbox/proxy.test.js` desde `backend/`; los 2 tests pasan, incluido el rechazo de `blob:` en `frame-src`.
- [x] **Paso 2: Consultar solo el header local** en `http://127.0.0.1:5174/` y confirmar la política CSP efectiva; no inspeccionar variables de entorno ni secretos.

### Task 3: Revisar visualmente y entregar a revisión

- [x] **Paso 1: Comprobar estado de Docker local** sin reiniciar servicios; el stack `beciencia-local` está en uso y responde HTTP 200.
- [x] **Paso 2: Validación visual por el usuario**: confirma comportamiento correcto en frontend, PDF visible, escala/zoom y popup correctos. No detalló pruebas separadas de selección de texto ni vídeo.
- [x] **Paso 3: Ejecutar el conjunto CI de frontend**: 15 pruebas Node en cuatro zonas horarias (60/60) y los 10 archivos Vitest declarados por CI, incluido el test del visor PDF (108/108); type-check y build exit 0. Test de pasarela de backend 2/2.
- [x] **Paso 4: Solicitar revisión independiente de solo lectura** con proveedor distinto, sobre todos los cambios de frontend/backend; se resolvió el hallazgo Important de CI agregando `tests/pdfjs-viewer.test.ts` al comando Vitest.
- [ ] **Paso 5: Solo con revisión y validación visual satisfactorias, crear los commits de frontend y backend y subir sus ramas `develop`; verificar CI de GitHub en ambos repositorios. No hacer merge a `main` ni desplegar producción.**

## Self-review

- **Spec coverage:** componentes compartidos, zoom/rangos, ancla de posición, texto seleccionable, fullscreen, errores, vídeo, acceso a blob protegido, worker Vite, backend sandbox, CI y revisión visual están asignados a tareas.
- **Task interfaces:** Task 1 produce `PdfDocumentViewer(src)`; Task 2 valida el proxy local que sirve el entorno; Task 3 valida integración y publicación en `develop`.
- **Review focus:** cada riesgo de entrada/estado de la sección Review Focus tiene prueba o validación visual explícita.
- **Proportion:** tres tareas; solo una introduce código nuevo. No se toca backend de aplicación, infraestructura ni producción.