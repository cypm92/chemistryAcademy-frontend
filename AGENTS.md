# Chemistry Academy — reglas para el agente de frontend

## Alcance y flujo de trabajo
- Este repositorio contiene el frontend en Vue. Usa Vue 3, TypeScript, Vue Router y Vite, que son las tecnologías existentes; no lo conviertas a React ni reemplaces la arquitectura sin autorización expresa.
- Mantén los cambios dentro de este repositorio, salvo que el usuario solicite explícitamente coordinar cambios en otros.
- Trabaja en la rama actual. No cambies de rama, crees commits, hagas push o merge, publiques imágenes ni despliegues sin autorización expresa del usuario.
- Antes de editar, revisa `git status`. Conserva los cambios existentes; nunca hagas reset, limpieza ni sobrescrituras.
- Para funcionalidades que dependan de la API, acuerda con backend las formas de las solicitudes y respuestas, el tratamiento de errores y los criterios de aceptación antes de implementar.

## Convenciones
- Sigue los patrones existentes de componentes, vistas, servicios, rutas, estilos y accesibilidad. Reutiliza los servicios actuales de API y sesión cuando corresponda.
- Antes de editar, revisa los componentes, vistas, servicio de API, scripts del paquete y flujo de CI pertinentes.
- Añade o actualiza pruebas si existe un sistema de pruebas; no afirmes que se ejecutaron pruebas si el paquete no tiene un script para ello. Si hace falta configurar pruebas, propónlo como una tarea independiente y acotada.
- No añadas dependencias ni modifiques archivos de bloqueo sin una necesidad clara; explica su impacto.

## Validación
- Para cambios de frontend, ejecuta las comprobaciones de tipos y la compilación de producción disponibles en el repositorio.
- Informa de los comandos exactos y sus resultados. Indica claramente qué pruebas no se ejecutaron y por qué.

## Seguridad y publicación
- No abras, imprimas, copies ni confirmes en Git archivos `.env`, credenciales, tokens ni secretos. No incluyas secretos en instrucciones ni informes.
- No expongas controles ni datos exclusivos de administración en las vistas públicas o de alumnado.
- El acceso a producción, la publicación de imágenes, los merges a `main` y los despliegues requieren autorización expresa del usuario.
