# List of TODOs

- [ ] add functionality for admins to modify schools (media and name)
  - [ ] add the route
  - [ ] add the types
  - [ ] add to the adminApi
  - [ ] include functionality in the Schools page

- [x] Permitir dominos que no sean @northfield.edu.ar en el login de google
- [ ] Crear archivo .env.template
- [ ] Agregar botones de google en /login y /register del adminClient
- [ ] Ver que pasa con el push notification token que devuelve error
- [x] Revisar logo por si se puede usar o tiene licencia
- [ ] Enviar icono a Morena
- [ ] Agregar botón de configuración en la app
- [x] Actualizar servidor de producción
- [ ] Incluir en docker backup
- [ ] Incluir en docker servidor web de adminClient
- [ ] Agradecimiento por icono:
      <a href="https://www.flaticon.com/free-icons/infinity" title="infinity icons">Infinity icons created by Freepik - Flaticon</a>
- [ ] Revisar que solo los dominios autorizados puedan loguearse (northfield, faro...)
- [ ] Revisar google oauth en prod
- [ ] Revisar google oauth para web, que no funciona
- [ ] Agregar botón de olvide mi contraseña
- [ ] Ajustar padding de icono en el header
- [ ] Agregar versión web del carrusel de imágenes de un producto en la página de producto

- [x] Conseguir 3 dominios, uno para el admin, uno de loop para la landing y uno para la api
- [ ] Cambiar api url de la version androids
- [ ] Al publicar da error dice ha ocurrido un error al subir los arhcivos. Ver que archivo acepta el backend para que el frontend te lo diga antes de intentar subirlo.
- [x] Agregar uan forma de optimizar las iamgenes antes de subirlas, para que no sean tan pesadas y llenen todo el espacio de la vps
- [ ] Cambiaqr title en web
- [ ] probarlo en celu la web
- [ ] Dentro de un chat osea cuando abris el chat con alguien y esta vacio aparece un texto boca abajo
- [ ] En celu solo podes elegir la primera vez si las fotos salen de la camara o de la galeria
- [ ] Al menos en celu al borrar una publicacion no hay navegacion por lo que parece que el boton de borrar no hace nada
- [ ] Borrar usuario test

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
