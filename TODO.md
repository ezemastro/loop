# TODO

Ítems abiertos, en español. Los cumplidos se sacaron de esta lista (ver git history si hace falta
el rastro). Trabajo real y no trivial debería vivir como issue, no acá — esta lista es para
recordatorios chicos.

- [ ] Eliminar usuario TEST (dato de prueba en la base, no relacionado con el seed de demo)
- [ ] Agregar funcionalidad para que los admins modifiquen colegios (media y nombre): ruta, tipos,
      `adminApi`, y la pantalla de Schools
- [ ] Agregar botones de Google en `/login` y `/register` del adminClient
- [ ] Investigar por qué falla el push notification token en algunos casos
- [ ] Enviar ícono a Morena
- [ ] Agregar botón de configuración en la app
- [ ] Incluir el servicio de backup y el servidor web de adminClient en el flujo de Docker de dev
- [ ] Agradecimiento por ícono:
      <a href="https://www.flaticon.com/free-icons/infinity" title="infinity icons">Infinity icons created by Freepik - Flaticon</a>
- [ ] Revisar que solo los dominios autorizados puedan loguearse (northfield, faro...)
- [ ] Revisar Google OAuth en producción y en web (hoy no funciona en web)
- [ ] Agregar botón de "olvidé mi contraseña"
- [ ] Ajustar padding del ícono en el header
- [ ] Agregar versión web del carrusel de imágenes de un producto en la página de producto
- [ ] Cambiar la API URL de la versión Android
- [ ] Al publicar aparece "ha ocurrido un error al subir los archivos" sin detalle — mostrar en el
      frontend qué tipo de archivo rechaza el backend antes de intentar subirlo
- [ ] Cambiar el `title` de la pestaña en web
- [ ] Probar la versión web en celular
- [ ] Chat vacío: cuando se abre un chat sin mensajes aparece un texto invertido (boca abajo)
- [ ] En celular solo se puede elegir cámara/galería la primera vez que se sube una foto
- [ ] En celular, al borrar una publicación no hay navegación de vuelta — parece que el botón no
      hizo nada

## Endpoints y métodos de admin faltantes

**Categories**
- `DELETE /admin/categories/:categoryId` — eliminar categoría (no existe en el backend)
- `GET /admin/missions` — listar mission templates (`adminApi.getMissionTemplates()` asume que existe)
- `DELETE /admin/missions/:missionTemplateId` — eliminar mission template

**Notifications**
- `GET /admin/notifications` — historial de notificaciones enviadas
- `GET /admin/notifications/user/:userId` — notificaciones de un usuario específico

**Users**
- `PATCH /admin/users/:userId` — actualizar datos de usuario (email, nombre, etc.)
- `DELETE /admin/users/:userId` — eliminar/desactivar usuario
- `GET /admin/users/:userId` — detalle completo de un usuario

**Schools**
- `PATCH /admin/schools/:schoolId` — actualizar nombre o logo de escuela
- `DELETE /admin/schools/:schoolId` — eliminar escuela

**Stats/Dashboard**
- `GET /admin/schools/stats` existe pero solo devuelve datos ambientales por escuela

**Admin Authorization**
- Falta la página `/authorize-admin` para el endpoint `POST /admin/authorize`, que ya existe

## Error observado en producción (sin triage aún)

```
api | Servidor corriendo. Entorno: production en el puerto 3000
api | Datos de entrada inválidos
api | ZodError: [{ "code": "invalid_format", "format": "uuid", "path": [], "message": "Invalid UUID" }]
api |   at validateId (/app/dist/services/validations.js:41:51)
api |   at getUserById (/app/dist/controllers/users.js:51:42)
```

Un `:userId` no-UUID llega hasta `getUserById` y el `ZodError` no se atrapa antes de loguearse
crudo. Falta reproducir con el input real que lo dispara.

📋 Endpoints y Métodos Faltantes
Categories
❌ DELETE /admin/categories/:categoryId - Eliminar categoría (no existe en el backend)
❌ GET /admin/missions - Listar mission templates (agregué el método getMissionTemplates() en adminApi asumiendo que el endpoint existe)
❌ DELETE /admin/missions/:missionTemplateId - Eliminar mission template
Notifications
❌ GET /admin/notifications - Obtener historial de notificaciones enviadas
❌ GET /admin/notifications/user/:userId - Ver notificaciones de un usuario específico
Users
❌ PATCH /admin/users/:userId - Actualizar datos de usuario (email, nombre, etc.)
❌ DELETE /admin/users/:userId - Eliminar/desactivar usuario
❌ GET /admin/users/:userId - Obtener detalles completos de un usuario
Schools
❌ PATCH /admin/schools/:schoolId - Actualizar nombre o logo de escuela
❌ DELETE /admin/schools/:schoolId - Eliminar escuela
Stats/Dashboard
⚠️ GET /admin/schools/stats - Existe pero solo devuelve datos ambientales por escuela
Admin Authorization
❌ Falta página /authorize-admin para el endpoint POST /admin/authorize que ya existe

- [ ] Revisar el siguiente error:
      api | Servidor corriendo. Entorno: production en el puerto 3000
      api | Datos de entrada inválidos
      api | Datos de entrada inválidos
      api | Datos de entrada inválidos
      api | /app/dist/services/validations.js:41
      api | const validateId = (data) => zod_1.default.uuid().parseAsync(data);
      api | ^
      api |
      api | ZodError: [
      api | {
      api | "origin": "string",
      api | "code": "invalid_format",
      api | "format": "uuid",
      api | "pattern": "/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$/",
      api | "path": [],
      api | "message": "Invalid UUID"
      api | }
      api | ]
      api | at validateId (/app/dist/services/validations.js:41:51)
      api | at getUserById (/app/dist/controllers/users.js:51:42)
      api | at Layer.handleRequest (/app/node_modules/router/lib/layer.js:152:17)
      api | at next (/app/node_modules/router/lib/route.js:157:13)
      api | at Route.dispatch (/app/node_modules/router/lib/route.js:117:3)
      api | at handle (/app/node_modules/router/index.js:435:11)
      api | at Layer.handleRequest (/app/node_modules/router/lib/layer.js:152:17)
      api | at /app/node_modules/router/index.js:295:15
      api | at param (/app/node_modules/router/index.js:600:14)
      api | at param (/app/node_modules/router/index.js:610:14)
      api |
      api | Node.js v22.21.1
