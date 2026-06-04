# Loop - Análisis Completo del Codebase

> **Fecha:** 2026-06-04
> **Alcance:** API, Client (Expo), Admin Panel, Landing Page, Docker/Deploy, Shared Types
> **Nota:** Este documento NO modifica código. Solo documenta hallazgos.

---

## Tabla de Contenidos

1. [API (server/api/)](#1-api-serverapi)
2. [Client (client/)](#2-client-client)
3. [Admin Panel (adminClient/)](#3-admin-panel-adminclient)
4. [Landing (landing/)](#4-landing-landing)
5. [Docker / Deploy](#5-docker--deploy)
6. [Shared Types / Root Config](#6-shared-types--root-config)
7. [Resumen por Severidad](#7-resumen-por-severidad)
8. [Plan de Acción Recomendado](#8-plan-de-acción-recomendado)

---

## 1. API (server/api/)

### CRÍTICOS

#### 1.1 Password logueado en consola en login fallido
- **Archivo:** `server/api/src/models/auth.ts:156`
- **Problema:** `console.log(password)` imprime la contraseña en texto plano cuando el login falla. Aparece en logs, agregadores y sistemas de monitoreo.
- **Fix:** Eliminar esta línea inmediatamente.

#### 1.2 SQL Injection potencial en ORDER BY dinámicos
- **Archivos:** `server/api/src/services/queries.ts:187, 243, 400`
- **Problema:** `ORDER BY ${sort} ${order}` interpola valores directamente en SQL. Aunque usan allowlists, el patrón es frágil.
- **Fix:** Usar expresiones CASE parametrizadas como ya hace `searchSchools` (línea 200-208).

#### 1.3 `rejectOffer` sin transacción y no restaura créditos
- **Archivo:** `server/api/src/models/listings.ts:516-563`
- **Problema:** 
  - No llama `client.begin()` pero hace mutaciones DB
  - No restaura los créditos bloqueados del comprador (a diferencia de `deleteOffer`)
  - Si la notificación falla, la oferta ya fue eliminada sin rollback
- **Fix:** Envolver en transacción completa + agregar lógica de restauración de créditos.

#### 1.4 Operaciones de créditos no atómicas (race condition)
- **Archivos:** `server/api/src/models/users.ts:114-123`, `listings.ts:401-405, 461-464, 689-703, 780-803`
- **Problema:** Usan `UPDATE users SET credits_balance = $1` con valor pre-calculado. Entre el SELECT y el UPDATE, requests concurrentes causan lost updates.
- **Fix:** Usar operaciones atómicas: `UPDATE users SET credits_balance = credits_balance + $1 WHERE id = $2` (ya implementado en `admin.increaseUserBalance`/`decreaseUserBalance`).

#### 1.5 Registro de admin sin rate limiting
- **Archivo:** `server/api/src/routes/admin.ts:9`
- **Problema:** Sin rate limiting, un atacante puede brute-forcear emails autorizados o crear muchas cuentas.
- **Fix:** Agregar `express-rate-limit` en endpoints de auth.

### ALTOS

#### 1.6 `cancelListing` existe pero no está expuesto como ruta
- **Archivo:** `server/api/src/models/listings.ts:872-967`
- **Problema:** Método existe pero no hay ruta. Un vendedor no puede cancelar una listing aceptada, dejando créditos bloqueados indefinidamente.
- **Fix:** Agregar ruta DELETE o PATCH, o eliminar el método.

#### 1.7 JWT_SECRET puede ser undefined
- **Archivo:** `server/api/src/services/jwt.ts:5`
- **Problema:** `JWT_SECRET as string` suprime el error de tipo. Si no está set, firma JWT con `"undefined"`.
- **Fix:** Agregar check en startup que lance error si `JWT_SECRET` no está definido.

#### 1.8 `sendPushNotification` fire-and-forget
- **Archivo:** `server/api/src/services/expoNotifications.ts:20`
- **Problema:** Promise no awaited, errores se silencian silenciosamente.
- **Fix:** `await` la llamada o agregar `.catch()` para logging.

#### 1.9 `trimBody` solo trimmea propiedades top-level
- **Archivo:** `server/api/src/middlewares/trimBody.ts:3-11`
- **Problema:** Objetos anidados y arrays no se trimmean.
- **Fix:** Agregar trimming recursivo.

#### 1.10 Race condition en registro de admin (email duplicado)
- **Archivo:** `server/api/src/models/admin.ts:66-68`
- **Problema:** Check de existencia + insert no son atómicos. Dos requests concurrentes pueden crear admins duplicados.
- **Fix:** Agregar UNIQUE constraint en `admins.email` y manejar el error.

#### 1.11 Archivos subidos accesibles sin autenticación
- **Archivo:** `server/api/src/routes/uploads.ts:17`
- **Problema:** `express.static(UPLOAD_DIR)` hace todos los archivos públicamente accesibles.
- **Fix:** Evaluar si deben ser públicos; al mínimo validar filenames contra path traversal.

#### 1.12 `modifyUserCredits` acepta monto negativo sin validación
- **Archivo:** `server/api/src/controllers/admin.ts:121-138`
- **Problema:** `amount` se pasa directo al modelo. Un monto negativo con `positive: true` disminuye créditos.
- **Fix:** Validar `amount > 0` en el controller.

#### 1.13 `resetUserPassword` sin validación de fuerza
- **Archivo:** `server/api/src/controllers/admin.ts:353`
- **Problema:** Admin puede setear contraseñas arbitrariamente débiles.
- **Fix:** Aplicar misma validación (mínimo 8 chars) que en registro de usuarios.

#### 1.14 `tokenMiddleware` permite admin token en rutas de usuario
- **Archivo:** `server/api/src/middlewares/parseToken.ts:16-36`
- **Problema:** Cuando ambos tokens están presentes, se mergean. Un admin token podría acceder rutas de usuario con privilegios elevados.
- **Fix:** Asegurar que admin tokens no puedan usarse en rutas solo-usuario, o strippear `isAdmin` del merged session.

### MEDIOS

#### 1.15 N+1 queries en múltiples endpoints de listings
- **Archivos:** `models/listings.ts:63-86`, `models/self.ts:210-231`, `models/users.ts:40-44`
- **Problema:** Por cada listing, queries separadas para seller, buyer, category, media. Con 10 listings = 40+ queries.
- **Fix:** Usar JOINs o batch queries (`WHERE id IN (...)`).

#### 1.16 N+1 en `getMediasByListingId`
- **Archivo:** `utils/helpersDb.ts:168-173`
- **Problema:** Cada media item dispara query separada.
- **Fix:** Single `WHERE id IN (...)` query.

#### 1.17 N+1 en `getUserMissionsByUserId`
- **Archivo:** `utils/helpersDb.ts:383-389`
- **Problema:** Cada user mission dispara query separada para su template.
- **Fix:** Batch-fetch templates.

#### 1.18 `createListing` no está en transacción
- **Archivo:** `models/listings.ts:96-179`
- **Problema:** Si media linking falla, se crea listing huérfano.
- **Fix:** Envolver en `begin`/`commit`/`rollback`.

#### 1.19 `deleteListing` no limpia media asociado
- **Archivo:** `models/listings.ts:283-311`
- **Problema:** Rows de `listing_media` no se eliminan, archivos en disco tampoco.
- **Fix:** Agregar cleanup o usar CASCADE en DB.

#### 1.20 `acceptOffer` missing `return` en Promise.all
- **Archivo:** `models/listings.ts:678-681`
- **Problema:** `client.query()` sin `return`, las promises resuelven `undefined` y queries pueden no completarse antes de `commit`.
- **Fix:** Agregar `return` antes de `client.query(...)`.

#### 1.21 `updateSelf` falla silenciosamente en input inválido
- **Archivo:** `models/self.ts:114-127`
- **Problema:** Email inválido usa el viejo silenciosamente en vez de retornar error de validación.
- **Fix:** Retornar errores de validación para campos inválidos.

#### 1.22 `config.ts` IIFE async no bloquea exports
- **Archivo:** `config.ts:5-16`
- **Problema:** dotenv loading es async IIFE, pero los exports son sincrónicos. Otro módulo puede importar config antes que dotenv termine.
- **Fix:** Usar `dotenv.config()` sincrónico.

#### 1.23 CORS permite origins vacíos en producción
- **Archivo:** `index.ts:28-31`
- **Problema:** Si `FRONTEND_URL` no está set, `""` se incluye en CORS origins.
- **Fix:** Throw en startup si no están set en producción.

#### 1.24 `usersRouter` expone datos sin autenticación
- **Archivo:** `routes/users.ts:7-9`
- **Problema:** `GET /users` y `GET /users/:userId` son públicos. Cualquiera puede enumerar usuarios y ver emails/teléfonos.
- **Fix:** Considerar si el listado público es intencional; si sí, asegurar que campos sensibles no se expongan.

#### 1.25 `PublicUser` incluye email (PII)
- **Archivo:** `services/validations.ts:55-63`
- **Problema:** El schema público incluye `email`, exponiendo PII a llamadores no autenticados.
- **Fix:** Remover email de respuesta pública o hacerlo opcional.

#### 1.26 `createCategory`/`updateCategory` sin validación Zod
- **Archivos:** `controllers/admin.ts:174-201, 204-238`
- **Problema:** A diferencia de `createMissionTemplate`, no validan request body.
- **Fix:** Agregar schemas Zod para category create/update.

#### 1.27 Connection pool sin configuración
- **Archivo:** `services/postgresClient.ts:5-11`
- **Problema:** Usa defaults: sin `max` connections, sin `idleTimeoutMillis`, sin `connectionTimeoutMillis`.
- **Fix:** Configurar `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`.

#### 1.28 `PostgresSession.rollback()` puede throw sin transacción activa
- **Archivo:** `services/postgresClient.ts:33-35`
- **Problema:** Si `rollback()` se llama sin `begin()` previo, throwea.
- **Fix:** Trackear estado de transacción o usar try/catch alrededor de rollback.

#### 1.29 `sendNotification` payload no validado
- **Archivo:** `models/admin.ts:565-605`
- **Problema:** `payload` es `Record<string, unknown>` sin validación.
- **Fix:** Agregar validación Zod basada en tipo de notificación.

#### 1.30 `StepRequired` retorna HTTP 200
- **Archivo:** `middlewares/errors.ts:32-34`
- **Problema:** Retorna 200 para condición de error, confunde clientes.
- **Fix:** Usar 400 o 422.

#### 1.31 `successResponse` con body en 204
- **Archivos:** `controllers/self.ts:160, 205`
- **Problema:** HTTP 204 no debe tener body.
- **Fix:** Usar `res.status(204).send()` sin body.

### BAJOS

#### 1.32 Lógica duplicada de School-Media fetching
- **Archivos:** `models/auth.ts:89-101, 167-183`, `utils/helpersDb.ts:53-66, 105-118, 697-720`
- **Problema:** Patrón duplicado 5+ veces.
- **Fix:** Extraer en helper compartido.

#### 1.33 `parseListingBaseFromDb` convierte null a 0
- **Archivo:** `utils/parseDb.ts:187`
- **Problema:** `Number(null)` = `0`, no distingue "no offer" de "offer de 0".
- **Fix:** Manejar null explícitamente.

#### 1.34 `getOrderValue` defaultea cualquier cosa a "desc"
- **Archivo:** `utils/sortOptions.ts:18-21`
- **Problema:** Input basura como "DROP TABLE" defaultea a "desc" silenciosamente.
- **Fix:** Validar contra `["asc", "desc"]` explícitamente.

#### 1.35 Test mocks referencian columnas inexistentes
- **Archivo:** `tests/utils.ts:48-49`
- **Problema:** `school_id` y `role_id` no existen en schema actual.
- **Fix:** Actualizar mocks al schema real.

#### 1.36 `databaseQueryMock` tiene branch duplicado inalcanzable
- **Archivo:** `tests/utils.ts:277-279`
- **Problema:** Segundo check de `queries.mediaById` después de líneas 244-270, código muerto.
- **Fix:** Remover duplicado.

#### 1.37 `parseDateToDb` sin uso
- **Archivo:** `utils/parseDb.ts:7-9`
- **Problema:** Función definida pero nunca importada.
- **Fix:** Remover código muerto.

#### 1.38 `config.ts` loguea emoji a consola
- **Archivo:** `config.ts:11`
- **Problema:** Emojis pueden causar problemas de encoding en log aggregators.
- **Fix:** Remover emoji o usar texto plano.

#### 1.39 No health check más allá de `/status`
- **Archivo:** `index.ts:42-44`
- **Problema:** `/status` solo retorna environment, no verifica DB connectivity.
- **Fix:** Agregar endpoint `/health` que verifique DB y servicios críticos.

#### 1.40 `acceptOffer` notification type `listing_sold` no definido
- **Archivo:** `models/listings.ts:733`
- **Problema:** Tipo no está en `NOTIFICATION_TEXTS.LOOP_NOTIFICATION`, causará runtime error.
- **Fix:** Agregar `listing_sold` a notification texts.

#### 1.41 Sin rate limiting en ningún endpoint
- **Problema:** Auth, donaciones, mensajes todos vulnerables a abuso.
- **Fix:** Agregar `express-rate-limit`, especialmente en `/auth/*`, `/users/:userId/donate`, `/messages/*`.

#### 1.42 Índices faltantes recomendados
- `listings(seller_id, listing_status)`
- `listings(category_id, listing_status)`
- `messages(sender_id, recipient_id, created_at)`
- `notifications(user_id, is_read, created_at)`
- `user_schools(user_id, school_id)` composite
- `admins(email)` UNIQUE

---

## 2. Client (client/)

### CRÍTICOS

#### 2.1 Archivos corruptos (5 archivos con contenido mezclado)
- **Archivos:** `components/screens/Offer.tsx:56-57`, `components/cards/Listing.tsx:70`, `components/bases/SearchBarBase.tsx:4`, `components/buttons/DeleteListingButton.tsx:4`, `components/modals/ImageSourceSelectorModal.tsx:48`, `components/bases/ResourceSelectorModal.tsx:1`, `components/bases/TextTitle.tsx:13`
- **Problema:** Contenido de archivos diferentes mezclado dentro de cada archivo. Causará crashes en runtime.
- **Fix:** Restaurar contenido correcto de cada archivo.

#### 2.2 `withCredentials: true` redundante con JWT Bearer
- **Archivo:** `api/loop.ts:7`
- **Problema:** La API usa Bearer tokens en Authorization header, no cookies. `withCredentials: true` puede causar problemas CORS en web.
- **Fix:** Remover `withCredentials: true` a menos que auth por cookie también se use.

#### 2.3 Google OAuth credential almacenado en AsyncStorage
- **Archivo:** `components/buttons/GoogleSignInButton.tsx:82`
- **Problema:** Token crudo persistido en `@google_credential`. Si dispositivo comprometido, token extraíble.
- **Fix:** Usar secure storage o limpiar inmediatamente después de uso.

#### 2.4 Permiso `RECORD_AUDIO` innecesario
- **Archivo:** `app.json:32`
- **Problema:** App es marketplace, no tiene feature de audio. Triggera warnings en app stores.
- **Fix:** Remover permiso.

#### 2.5 `usesCleartextTraffic: true` en Android
- **Archivo:** `app.json:48`
- **Problema:** Permite tráfico HTTP sin encriptar. Habilita ataques MITM.
- **Fix:** Remover en producción.

### ALTOS

#### 2.6 16 catch blocks sin return/re-throw
- **Archivos:** `hooks/useSelf.ts:12-19`, `useListings.ts`, `useListing.ts`, `useMyListings.ts`, `useMessages.ts`, `useUser.ts`, `useMissions.ts`, `useDonate.ts`, `usePublicWishes.ts`, `useListingAcceptOffer.ts`, `useListingDeleteOffer.ts`, `useListingMarkReceived.ts`, `useListingNewOffer.ts`, `useListingRejectOffer.ts`, `useMessageRead.ts`, `useLoginForm.ts`
- **Problema:** Catch block no retorna/re-lanza, función retorna `undefined` en error. `useQuery` ve `undefined` como dato exitoso.
- **Fix:** Agregar `throw error` o `return undefined` explícito en cada catch.

#### 2.7 Import inválido en `useLoginForm`
- **Archivo:** `hooks/useLoginForm.ts:5`
- **Problema:** `ERROR_MESSAGES` importado de `react-native-reanimated/lib/typescript/common` - path interno que puede no existir.
- **Fix:** Remover import no usado o corregir path.

#### 2.8 Debug `console.log` en producción
- **Archivos:** `hooks/useLoginForm.ts:49`, `config.ts:29-30`, `contexts/notification.tsx:54-56`
- **Problema:** Statements de debug dejados en código de producción.
- **Fix:** Remover todos los console.log de debug.

#### 2.9 Null crash potencial en `useRegisterForm`
- **Archivo:** `hooks/useRegisterForm.ts:58`
- **Problema:** `formData.schools!.map()` con non-null assertion. Si `schools` es null, crash en runtime.
- **Fix:** Validar antes de mapear o usar optional chaining.

#### 2.10 Unsafe null access en `Chat.tsx`
- **Archivos:** `components/screens/Chat.tsx:38, 53-62, 126`
- **Problema:** `page!.data!.messages` y `currentUser!` con non-null assertions. Crash si data es null.
- **Fix:** Validar null antes de acceder.

#### 2.11 `listingId as string` sin validación
- **Archivos:** `components/screens/Listing.tsx:27`, `Offer.tsx:73`, `OtherUser.tsx:10`, `UpdateListing.tsx:6`
- **Problema:** `useLocalSearchParams` retorna `string | string[] | undefined`. Cast a string sin validar puede fallar.
- **Fix:** Validar que sea string antes de usar.

#### 2.12 Race condition en `ModifyListing`
- **Archivo:** `components/ModifyListing.tsx:156-157`
- **Problema:** `setForm` es async, pero `body` se construye del estado VIEJO de `form`. `mediaIds` usa datos stale de imágenes.
- **Fix:** Construir body con los nuevos valores directamente, no con estado.

#### 2.13 Off-by-one counter bug en `ModifyListing`
- **Archivo:** `components/ModifyListing.tsx:151`
- **Problema:** Variable `c` empieza en 0 y se incrementa DESPUÉS de mapear. `results[c - 1]` accede `results[-1]` para primera imagen nueva.
- **Fix:** Incrementar antes de acceder o ajustar índice.

#### 2.14 Missing break/return en switch de `ListingButtons`
- **Archivo:** `components/ListingButtons.tsx:92`
- **Problema:** Case `"offered"` falls through a `"accepted"`. Cuando status es "offered" y usuario no es seller ni buyer, ejecuta lógica de "accepted".
- **Fix:** Agregar `break` o `return`.

#### 2.15 `FILE_BASE_URL` crash si `API_URL` undefined
- **Archivo:** `config.ts:28`
- **Problema:** `API_URL + "/uploads/"` = `undefined/uploads/` = `"undefined/uploads/"`.
- **Fix:** Agregar guard para env var faltante.

#### 2.16 `forceCodeForRefreshToken: true` deprecated
- **Archivo:** `services/googleOauth.ts:15`
- **Problema:** Deprecated y innecesario para la mayoría de usos. Puede causar issues con versiones nuevas de Google Sign-In.
- **Fix:** Remover.

#### 2.17 `Dimensions.get("window").width` stale
- **Archivos:** `components/ImageGallery.tsx:8`, `selectors/ImagesSelector.tsx:14`
- **Problema:** Llamado a module load time. En web con layouts responsivos o window resize, valor se vuelve stale.
- **Fix:** Usar `useWindowDimensions()` hook o listener de resize.

#### 2.18 Response interceptor auto-logout agresivo
- **Archivo:** `api/loop.ts:20-27`
- **Problema:** Cualquier 401 (incluso de request cacheada stale) loguea al usuario inmediatamente.
- **Fix:** Distinguir entre 401 de auth endpoints y otros 401s.

### MEDIOS

#### 2.19 `QueryClient` creado dentro de componente
- **Archivo:** `app/_layout.tsx:11`
- **Problema:** Nuevo `QueryClient` en cada render de `RootLayout`. Debe ser memoizado con `useState` o `useMemo`.
- **Fix:** `const [queryClient] = useState(() => new QueryClient())`.

#### 2.20 `setNotificationHandler` llamado a nivel de módulo
- **Archivo:** `app/(main)/_layout.tsx:8-24`
- **Problema:** Se ejecuta cada vez que el módulo se evalúa (hot reload, navegación).
- **Fix:** Mover a `useEffect` o inicialización de app.

#### 2.21 Polling agresivo para mensajes y notificaciones
- **Archivos:** `hooks/useMessages.ts:31` (5s), `useUnreadMessages.ts:13` (30s), `useUnreadNotifications.ts:13` (30s)
- **Problema:** 4 API calls cada 30s solo para badge counts. `useMessages` poll cada 5s carga innecesaria en API.
- **Fix:** Considerar WebSocket o aumentar intervalos.

#### 2.22 `invalidateQueries({ type: "active" })` excesivo
- **Archivo:** `components/CustomRefresh.tsx:11-13`
- **Problema:** Invalida TODAS las queries activas en cada pull-to-refresh.
- **Fix:** Invalidar solo queries relevantes.

#### 2.23 Home feed muestra solo listings del usuario actual
- **Archivos:** `components/Feed.tsx:15-18`, `screens/Search.tsx:17-19`
- **Problema:** `useListings` con `userId: user?.id` filtra listings solo del usuario actual. Parece error de lógica - debería mostrar todos o los de la escuela.
- **Fix:** Remover filtro `userId` o usar school-based filtering.

#### 2.24 `readAllNotifications` llamado en cada render
- **Archivo:** `components/screens/Notifications.tsx:17-23`
- **Problema:** Marca todas como leídas inmediatamente al abrir pantalla, usuarios nunca ven indicadores de no leídas.
- **Fix:** Llamar solo cuando usuario interactúa o usar botón "mark all read".

#### 2.25 Doble filtrado en `Messages.tsx`
- **Archivo:** `components/screens/Messages.tsx:29-36`
- **Problema:** `useUsers` ya acepta `searchTerm` para server-side filtering, pero luego `localFilteredUsers` hace client-side filtering de nuevo.
- **Fix:** Usar solo server-side o solo client-side.

#### 2.26 `chatsToShow` lógica confusa
- **Archivo:** `components/screens/Messages.tsx:37`
- **Problema:** `hasNextPage ? chats : localFilteredChats` - cuando hay más páginas, muestra chats sin filtrar; cuando no hay más, muestra filtrados. Probablemente bug.
- **Fix:** Filtrar siempre aplicar.

#### 2.27 Hooks llamados incondicionalmente en `ListingButtons`
- **Archivo:** `components/ListingButtons.tsx:21-30`
- **Problema:** `useListingNewOffer`, `useListingDeleteOffer`, `useListingMarkReceived` se llaman aunque el status no los necesite.
- **Fix:** Mover hooks dentro de componentes condicionales o usar lazy initialization.

#### 2.28 Memory leak en web con `URL.createObjectURL`
- **Archivo:** `hooks/useOptimizedImagePicker.ts:76`
- **Problema:** Blob URLs nunca se revocan.
- **Fix:** Llamar `URL.revokeObjectURL(uri)` cuando imagen ya no se necesita.

#### 2.29 Permission requests redundantes
- **Archivos:** `components/ProfileImage.tsx:62, 81`, `selectors/ImagesSelector.tsx:78, 96`
- **Problema:** `ImagePicker.requestMediaLibraryPermissionsAsync()` llamado después de ya verificar/request permission via `useMediaLibraryPermissions`.
- **Fix:** Remover llamadas redundantes.

#### 2.30 Errores gramaticales en notificaciones
- **Archivo:** `components/cards/Notification.tsx:39, 63`
- **Problema:** "Haz completado" debería ser "Has completado". "Haz entregado" debería ser "Has entregado".
- **Fix:** Corregir gramática.

#### 2.31 Non-null assertions peligrosas
- **Archivos:** `hooks/useCategories.ts:7`, `useSchools.ts:12`, `screens/Search.tsx:27`, `MyListingsList.tsx:15`, `MyPendingList.tsx:52`
- **Problema:** `page!.data!.listings` puede crash si page data es null.
- **Fix:** Validar null antes de acceder.

#### 2.32 Zod version mismatch
- **Archivos:** `package.json:61` (client: 4.1.5, API: 4.0.17, admin: 4.3.5)
- **Problema:** Puede causar incompatibilidades de tipos con `z.email()` y `z.uuid()`.
- **Fix:** Alinear versiones de Zod en todos los paquetes.

#### 2.33 Debug screen accesible en producción
- **Archivo:** `components/screens/Debug.tsx:18`
- **Problema:** Página debug accesible via long-press en logo. Debería estar protegida por `NODE_ENV !== "production"`.
- **Fix:** Agregar guard de ambiente o remover.

#### 2.34 `REPORT_EMAIL` puede ser undefined
- **Archivo:** `components/ReportButton.tsx:114`
- **Problema:** Si env var no está set, mailto URL es inválido.
- **Fix:** Agregar fallback o validación.

#### 2.35 `mutationKey` y `queryKey` con objetos params
- **Archivos:** `hooks/useListingAcceptOffer.ts:24-28`, `useListingDeleteOffer.ts:23-27`, `useListingNewOffer.ts:24-28`, `useListingRejectOffer.ts:23-27`, `useSchools.ts:19`, `useUsers.ts:27`
- **Problema:** Objetos en keys causan referential instability, creando nuevos entries en cada render.
- **Fix:** Usar valores primitivos o `JSON.stringify(params)` para keys.

#### 2.36 `sections` arrays recreados en cada render
- **Archivos:** `screens/Home.tsx:26-53`, `MyListings.tsx:18-37`, `AllMyPendingList.tsx:19-79`, `UserPage.tsx:51-211`, `ModifyListing.tsx:183-316`, `Offer.tsx:126-218`, `Listing.tsx:37-137`, `PendingWithUser.tsx:27-95`
- **Problema:** Crea nuevas funciones de componente en cada render, causando re-renders innecesarios.
- **Fix:** Memoizar con `useMemo` o extraer como componentes estables.

#### 2.37 `useRegisterPushToken` hook llamado en cada render del provider
- **Archivo:** `contexts/notification.tsx:29`
- **Problema:** Mutation hook llamado cada vez que provider renderiza. `savePushToken` referencia cambia en cada render, causando re-run de useEffect.
- **Fix:** Memoizar `savePushToken` con `useCallback`.

#### 2.38 `BackHandler.exitApp()` no funciona en iOS/web
- **Archivo:** `components/screens/Terms.tsx:24`
- **Problema:** Solo funciona en Android. En iOS no se puede salir programáticamente, en web no hace nada.
- **Fix:** Usar navegación de vuelta o condicional por plataforma.

#### 2.39 Error message concatenación incorrecta
- **Archivo:** `services/registerPushNotifications.ts:32`
- **Problema:** `"Error getting push token: " + error` - `error` es objeto, produce `[object Object]`.
- **Fix:** Usar `error.message` o `String(error)`.

#### 2.40 Sin guard de mensaje vacío en ChatInput
- **Archivo:** `components/ChatInput.tsx:20-23`
- **Problema:** Botón send siempre habilitado, permite enviar mensajes vacíos.
- **Fix:** Deshabilitar botón si mensaje está vacío.

#### 2.41 División por cero en Mission progress
- **Archivo:** `components/cards/Mission.tsx:30`
- **Problema:** Si `mission.progress.total` es 0, width percentage se vuelve `NaN%`.
- **Fix:** Validar `total > 0` antes de calcular porcentaje.

#### 2.42 Trim validation pero envía datos sin trim
- **Archivo:** `hooks/useRegisterForm.ts:53-58`
- **Problema:** `parsedFromData` se trimmea para validación, pero `register()` envía `formData` original sin trim.
- **Fix:** Enviar datos trimmeados.

#### 2.43 `fetchNextPage()` sin check de `hasNextPage`
- **Archivo:** `components/screens/Messages.tsx:89`
- **Problema:** Puede causar API calls innecesarias al final de la lista.
- **Fix:** Verificar `hasNextPage` antes de llamar.

#### 2.44 `resolverMainFields` incluye `"browser"`
- **Archivo:** `metro.config.js:6`
- **Problema:** Puede causar que bundler seleccione browser-specific entry points para packages con implementaciones nativas diferentes.
- **Fix:** Remover `"browser"` de `resolverMainFields`.

#### 2.45 `useInfiniteQuery` para endpoints no paginados
- **Archivos:** `hooks/useChats.ts:21-28`, `useNotifications.ts:10-15`
- **Problema:** `/me/messages` probablemente retorna todos los chats; `useInfiniteQuery` es overkill.
- **Fix:** Usar `useQuery` si API no soporta paginación.

### BAJOS

#### 2.46 Nombres de componentes no PascalCase
- **Archivos:** `app/(auth)/schoolSelection.tsx:2` (`schoolSelectionPage`), `app/(main)/listing/[listingId]/offer.tsx:3` (`offer`)
- **Fix:** Renombrar a `SchoolSelectionPage`, `OfferPage`.

#### 2.47 Imports de `React` no usados
- **Archivos:** `components/UserPage.tsx:2`, `cards/Listing.tsx:2`, `cards/ProductStatusBadge.tsx:2`, `cards/ChatCard.tsx:2`, `modals/ImageSourceSelectorModal.tsx:2`, `modals/CloseModalButton.tsx:2`, `Missions.tsx:2`, `bases/ResourceSelectorModal.tsx:2`
- **Fix:** Remover imports no usados (React 17+ no necesita import React para JSX).

#### 2.48 Imports de `ERROR_NAMES` no usados
- **Archivos:** `hooks/useLoginForm.ts:6`, `screens/Login.tsx:6`, `screens/Register.tsx:7`
- **Fix:** Remover imports no usados.

#### 2.49 Código comentado sin remover
- **Archivos:** `components/ModifyListing.tsx:244-246`, `components/bases/CustomModal.tsx:1-2`
- **Fix:** Limpiar código comentado.

#### 2.50 `parseErrorName` podría usar Map lookup
- **Archivo:** `services/errors.ts:7-18`
- **Problema:** if/else chain en vez de Map/object lookup.
- **Fix:** Refactorizar a Map.

#### 2.51 `sameDay.ts` muta parámetros de input
- **Archivo:** `utils/sameDay.ts:1-8`
- **Problema:** `d1 = new Date(d1)` reasigna parámetro.
- **Fix:** Usar nombres de variables diferentes.

#### 2.52 `onHasResults` prop no usada
- **Archivo:** `components/MyListingsList.tsx:7-9`
- **Fix:** Remover prop no usada o implementar.

#### 2.53 `CreateListing` wrapper fino
- **Archivo:** `components/screens/CreateListing.tsx:1`
- **Problema:** Solo renderiza `ModifyListing` con `action="create"`. Podría inlinearse.
- **Fix:** Considerar inline o remover.

#### 2.54 `SortOptions` y `OrderOptions` sin importar
- **Archivo:** `components/screens/Search.tsx:35`
- **Problema:** Tipos referenciados pero no importados, depende de declaraciones globales.
- **Fix:** Importar explícitamente.

#### 2.55 CSS `hidden` class puede no funcionar en NativeWind
- **Archivo:** `components/screens/Home.tsx:67`
- **Problema:** NativeWind puede no soportar `hidden` consistentemente.
- **Fix:** Usar conditional rendering.

---

## 3. Admin Panel (adminClient/)

### CRÍTICOS

#### 3.1 No se almacena token de autenticación
- **Archivo:** `src/stores/session.ts:11-33`
- **Problema:** Session store solo persiste `isLoggedIn`, `email`, `fullName` pero nunca almacena el JWT token. Usuario logueado cuya sesión expiró en servidor verá UI rota sin forma de recuperar excepto logout manual.
- **Fix:** Almacenar token o implementar verificación de sesión al startup.

#### 3.2 Login navega a `/` en vez de `/dashboard`
- **Archivo:** `src/pages/Login.tsx:47`
- **Problema:** `navigate("/")` va a Home, que inmediatamente redirige a `/dashboard`. Causa redirect chain innecesario.
- **Fix:** Navegar directamente a `/dashboard`.

#### 3.3 Auto-login post-registro sin auth guard
- **Archivo:** `src/pages/Register.tsx:52-58`
- **Problema:** Registrar admin nuevo lo loguea client-side sin verificar que sesión server-side se estableció. Si cookie falla al setearse, usuario en estado roto.
- **Fix:** Verificar sesión post-registro antes de auto-login.

#### 3.4 Reset password sin confirmación
- **Archivo:** `src/components/ResetPasswordModal.tsx:39`
- **Problema:** Sin diálogo de confirmación, password visible en DevTools network tab.
- **Fix:** Agregar confirmación modal y ofuscar password en UI.

#### 3.5 Sin auth guard a nivel de ruta
- **Archivo:** `src/components/Layout.tsx:7`
- **Problema:** Layout solo renderiza Aside condicionalmente, pero **todas las páginas son accesibles sin autenticación**. Usuario no autenticado puede navegar a `/users`, `/schools`, etc. y las páginas renderizan (solo reciben 401 de API).
- **Fix:** Agregar route guard que redirija a `/login` si no autenticado.

#### 3.6 `console.log(API_URL)` en producción
- **Archivo:** `src/api/loop.ts:10`
- **Problema:** Leakea API base URL en consola del browser.
- **Fix:** Remover debug statement.

### ALTOS

#### 3.7 Stale state en `MissionFormModal`
- **Archivo:** `src/components/MissionFormModal.tsx:18-24`
- **Problema:** `useState` initializer corre solo una vez. Si modal se reusa para diferentes misiones, el form muestra datos de la misión anterior.
- **Fix:** Agregar `useEffect` para sincronizar `formData` cuando `mission` cambia.

#### 3.8 Stale state en `EditSchoolModal`
- **Archivo:** `src/components/EditSchoolModal.tsx:20`
- **Problema:** Mismo bug de stale state. Si modal se abre, cierra, luego abre con escuela diferente antes que effect corra, datos stale se muestran.
- **Fix:** Sincronizar estado con prop `school`.

#### 3.9 Lógica frágil de matching school-stats
- **Archivo:** `src/pages/Schools.tsx:48-52`
- **Problema:** Usa `parseInt(school.id)` en UUID (produce `NaN`), fallback a name matching no confiable. La mayoría de stats no matchean.
- **Fix:** Usar ID string directamente para matching.

#### 3.10 Non-unique keys en rendering recursivo de categorías
- **Archivo:** `src/components/CategoriesTable.tsx:38, 93`
- **Problema:** `category.id` como key en `flatMap`. Si categoría se mueve a diferente padre, mismo `id` key puede causar bugs de reconciliación.
- **Fix:** Usar key compuesto como `${parentId}-${category.id}`.

#### 3.11 Optional chaining redundante en GoogleLoginButton
- **Archivo:** `src/components/GoogleLoginButton.tsx:31-32`
- **Problema:** `response.data?.admin.email` después de ya chequear `response.data?.admin`. Si `admin` es null, `login()` recibe `undefined, undefined`.
- **Fix:** Validar `admin` existe antes de llamar `login()`.

#### 3.12 Page size hardcoded
- **Archivo:** `src/pages/Users.tsx:33`
- **Problema:** `Math.ceil(total / 20)` asume 20 items por página. Debería venir de `pagination.pageSize` del response.
- **Fix:** Usar valor del response o constante nombrada.

#### 3.13 `parseInt` sin radix (3 ocurrencias)
- **Archivos:** `ModifyCreditsModal.tsx:28`, `CategoryFormModal.tsx:82-83`, `MissionFormModal.tsx:48`
- **Problema:** `parseInt(amount)` sin radix. Strings como `"08"` o `"09"` pueden parsearse como octal.
- **Fix:** Usar `parseInt(amount, 10)` o `Number(amount)`.

#### 3.14 Direct DOM access via `form.email.value`
- **Archivos:** `pages/Login.tsx:24-26`, `pages/Register.tsx:25-29`
- **Problema:** Bypassea patrón de controlled components de React. Si estructura de form cambia, rompe silenciosamente.
- **Fix:** Usar `useState` controlled inputs.

#### 3.15 Sin null check en `school.media`
- **Archivos:** `SchoolsTable.tsx:44`, `EditSchoolModal.tsx:156-162`
- **Problema:** `getUrl(school.media.url)` throwea si `school.media` es null/undefined.
- **Fix:** Agregar null check o optional chaining.

#### 3.16 Zustand persist almacena PII en localStorage
- **Archivo:** `src/stores/session.ts:31`
- **Problema:** `email` y `fullName` en `localStorage` bajo `session-storage`. Expone PII a vulnerabilidades XSS.
- **Fix:** Considerar `sessionStorage` o encryptar estado persistido.

### MEDIOS

#### 3.17 Missing `return` después de navegación en Home
- **Archivo:** `src/pages/Home.tsx:11-15`
- **Problema:** Después de `navigate("/dashboard")`, componente sigue renderizando login page. Usuario brevemente ve login page antes que navegación complete.
- **Fix:** Retornar `null` después de navegación.

#### 3.18 Errores de Google login solo logueados a consola
- **Archivo:** `src/pages/Login.tsx:100`
- **Problema:** `onError={(err) => console.log(err)}` - errores no se muestran al usuario.
- **Fix:** Mostrar error en UI.

#### 3.19 `alert()` para feedback de éxito (6 ocurrencias)
- **Archivos:** `CreateSchoolModal.tsx:58`, `EditSchoolModal.tsx:73`, `CategoryFormModal.tsx:92, 97`, `MissionFormModal.tsx:55, 59`, `ModifyCreditsModal.tsx:38`, `ResetPasswordModal.tsx:42`
- **Problema:** `alert()` es pobre UX.
- **Fix:** Usar inline success state como otros modales hacen para errores.

#### 3.20 `console.log(response)` en producción
- **Archivo:** `src/pages/Users.tsx:27`
- **Problema:** Debug logging statement.
- **Fix:** Remover.

#### 3.21 Emojis en labels de navegación
- **Archivo:** `src/components/Aside.tsx:21-41`
- **Problema:** Emojis pueden no renderizar consistentemente y son problemas de accesibilidad (screen readers los anuncian).
- **Fix:** Usar iconos SVG o texto plano con aria-labels.

#### 3.22 Título de página incorrecto
- **Archivo:** `index.html:7`
- **Problema:** `<title>client</title>` debería ser "Loop Admin".
- **Fix:** Corregir título.

#### 3.23 `FILE_BASE_URL` puede ser undefined
- **Archivo:** `src/config.ts:4`
- **Problema:** Si `VITE_API_URL` no está set, `FILE_BASE_URL` se vuelve `"undefined/uploads/"`.
- **Fix:** Agregar validación o fallback.

#### 3.24 Sin URL normalization en `getUrl`
- **Archivo:** `src/services/getUrl.ts:3-4`
- **Problema:** Si `path` ya empieza con `/`, resultado es `API_URL/uploads//path`.
- **Fix:** Normalizar URL.

#### 3.25 Sin debounce en búsqueda de usuarios
- **Archivo:** `src/pages/Notifications.tsx:17-37`
- **Problema:** Cada Enter key press dispara búsqueda completa de API.
- **Fix:** Agregar debounce o loading indicator en input.

#### 3.26 React Compiler + rolldown-vite compatibilidad
- **Archivo:** `vite.config.ts:9-13`
- **Problema:** React Compiler es babel plugin aplicado via Vite React plugin. Con `rolldown-vite` (fork no estándar), compatibilidad no garantizada.
- **Fix:** Verificar compatibilidad o revertir a Vite estándar.

#### 3.27 Sin build optimization config
- **Archivo:** `vite.config.ts`
- **Problema:** Sin `build.rollupOptions`, sin code splitting, sin chunk size warnings.
- **Fix:** Agregar configuración de build optimization.

#### 3.28 String concatenation para className en Layout
- **Archivo:** `src/components/Layout.tsx:7`
- **Problema:** Cuando no logueado, grid layout class se aplica pero sin display `grid`, causando problemas de layout.
- **Fix:** Usar conditional classes apropiadas.

#### 3.29 `export default` redundante en adminApi
- **Archivo:** `src/api/adminApi.ts:239`
- **Problema:** `adminApi` ya exportado como named. Default export no se usa.
- **Fix:** Remover default export.

#### 3.30 `publish.js` path relativo
- **Archivo:** `publish.js:14`
- **Problema:** `./package.json` resuelve relativo a CWD, no al directorio del script.
- **Fix:** Usar `path.join(__dirname, 'package.json')`.

#### 3.31 Sin null handling para nombres en UsersTable
- **Archivo:** `src/components/UsersTable.tsx:38`
- **Problema:** `{user.firstName} {user.lastName}` - si alguno es null/undefined, renderiza "undefined undefined".
- **Fix:** Usar optional chaining o fallback.

#### 3.32 `fullName` puede ser null en Aside
- **Archivo:** `src/components/Aside.tsx:17`
- **Problema:** `{fullName}` renderiza string vacío cuando null.
- **Fix:** Agregar fallback como "Admin".

### BAJOS

#### 3.33 Dashboard page vacío
- **Archivo:** `src/pages/Dashboard.tsx`
- **Problema:** Ruta `/dashboard` referenciada en Aside y Home navigation pero página vacía.
- **Fix:** Implementar contenido o remover ruta.

#### 3.34 Icon field comentado pero aún en formData
- **Archivo:** `src/components/CategoryFormModal.tsx:169-179`
- **Problema:** Campo icon comentado pero aún existe en `formData` state y se submite.
- **Fix:** Remover de formData o descomentar campo.

#### 3.35 `@types/axios` innecesario
- **Archivo:** `package.json:26`
- **Problema:** Axios shippea con sus propios tipos desde v1.0. Paquete deprecated.
- **Fix:** Remover `@types/axios`.

#### 3.36 `@types/react-router` es para v5
- **Archivo:** `package.json:30`
- **Problema:** Proyecto usa `react-router` v7, pero `@types/react-router@5.1.20` es para v5. React Router v7 tiene sus propios tipos.
- **Fix:** Remover `@types/react-router`.

#### 3.37 Upload button disabled después de upload exitoso
- **Archivo:** `src/components/CreateSchoolModal.tsx:151`
- **Problema:** `!uploadedMediaId` condition significa que no se puede re-subir imagen diferente sin cerrar y reabrir modal.
- **Fix:** Permitir re-upload.

#### 3.38 `flattenCategories` recreado en cada render
- **Archivo:** `src/components/CategoryFormModal.tsx:121-131`
- **Problema:** Definido dentro del componente, llamado en cada render.
- **Fix:** `useMemo` o mover afuera.

#### 3.39 `.join(", ")` en arrays potencialmente grandes
- **Archivo:** `src/components/UsersTable.tsx:42`
- **Problema:** Si usuario pertenece a muchas escuelas, contenido de celda overflow.
- **Fix:** Agregar truncación o tooltip.

#### 3.40 `PostMediaResponse` type no importado explícitamente
- **Archivo:** `src/api/commonApi.ts:18`
- **Problema:** Usa tipo global de `apiCalls.d.ts`. Funciona pero es implícito.
- **Fix:** Importar explícitamente.

#### 3.41 `React` import no necesario en React 17+
- **Archivo:** `src/components/Layout.tsx:4`
- **Problema:** Con React 19 y `jsx: "react-jsx"`, import React no necesario pero `React.ReactNode` se usa.
- **Fix:** Importar `type { ReactNode } from "react"`.

---

## 4. Landing (landing/)

### CRÍTICOS

#### 4.1 CSRF / Account Deletion sin autenticación
- **Archivo:** `landing/src/pages/borrar-cuenta.astro:41-113`
- **Problema:** Formulario POST envía request **sin CSRF token, sin autenticación, y sin paso de confirmación**. Cualquier página puede craftear form malicioso que auto-submita al `deleteEndpoint`. URL del endpoint expuesta en client-side JavaScript via `define:vars`.
- **Fix:** Agregar validación CSRF, requerir autenticación (email verification link), agregar checkbox de confirmación, mover endpoint a server-side Astro API route.

#### 4.2 Sin rate limiting o bot protection en formulario de deletion
- **Archivo:** `landing/src/pages/borrar-cuenta.astro:41-71`
- **Problema:** Sin CAPTCHA, honeypot field, o rate limiting. Puede ser spameado.
- **Fix:** Agregar honeypot field mínimo; integrar reCAPTCHA/hCaptcha; implementar rate limiting en API endpoint.

### ALTOS

#### 4.3 Missing `initial-scale` en viewport meta
- **Archivo:** `landing/src/layouts/Layout.astro:20`
- **Problema:** Sin `initial-scale=1` puede causar zoom inconsistente en iOS Safari.
- **Fix:** `content="width=device-width, initial-scale=1"`.

#### 4.4 Sin Open Graph / Social Meta Tags
- **Archivo:** `landing/src/layouts/Layout.astro:18-26`
- **Problema:** Sin `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`, `twitter:title`. Links compartidos en social media renderizan sin previews.
- **Fix:** Agregar Open Graph y Twitter Card meta tags al Layout.

#### 4.5 Sin `site` URL en Astro config
- **Archivo:** `landing/astro.config.mjs:7`
- **Problema:** Sin configuración `site` rompe canonical URL generation, sitemap creation, RSS feeds.
- **Fix:** Agregar `site: import.meta.env.PUBLIC_SITE_URL ?? 'https://loop.app'`.

#### 4.6 ESLint no lintea archivos `.astro`
- **Archivo:** `landing/eslint.config.js:4-8`
- **Problema:** Shared config `files` glob es `**/*.{js,mjs,cjs,ts,tsx,mts,cts}` — **excluye archivos `.astro` completamente**. Landing page tiene cero cobertura de linting.
- **Fix:** Agregar `eslint-plugin-astro` y extender su config recomendado.

#### 4.7 Fuentes referenciadas pero no cargadas
- **Archivo:** `landing/src/styles/global.css:20`
- **Problema:** `Space Grotesk` y `Manrope` referenciados pero **nunca importados o linkeados**. Silenciosamente fallback a `Segoe UI` / `sans-serif`.
- **Fix:** Agregar `<link>` tags en `Layout.astro` head o `@import` en CSS para cargar desde Google Fonts, o remover nombres de fuentes.

#### 4.8 Welcome.astro es scaffold code muerto
- **Archivo:** `landing/src/components/Welcome.astro`
- **Problema:** Template starter de Astro 6 sin modificar — linkea a `astro.build`, Discord, Astro blog. **No importado por ninguna página** pero shippea como parte del source tree.
- **Fix:** Eliminar archivo y `src/assets/astro.svg`, `src/assets/background.svg`.

### MEDIOS

#### 4.9 Fallback store URLs genéricos
- **Archivo:** `landing/src/pages/index.astro:4-5`
- **Problema:** Fallback URLs apuntan a **homepages de stores**, no a las páginas reales de Loop App.
- **Fix:** Usar URLs reales de app como fallbacks, o renderizar estado disabled cuando env vars faltan.

#### 4.10 Sin canonical link tag
- **Archivo:** `landing/src/layouts/Layout.astro:18-26`
- **Problema:** Sin `<link rel="canonical">`. Contenido duplicado en HTTP/HTTPS o www/non-www no se resuelve.
- **Fix:** Agregar `<link rel="canonical" href={Astro.url} />` en Layout head.

#### 4.11 Sin Structured Data (JSON-LD)
- **Archivo:** `landing/src/pages/index.astro`
- **Problema:** Sin `application/ld+json` script para `Organization`, `SoftwareApplication`, o `WebSite` schema.
- **Fix:** Agregar JSON-LD structured data a la index page.

#### 4.12 Sin `aria-label` en navegación
- **Archivo:** `landing/src/pages/index.astro:46`
- **Problema:** Sin `aria-label` en `<nav>`. Screen readers no pueden distinguirlo de otras regiones de navegación.
- **Fix:** `aria-label="Navegación principal"` o `aria-label="Footer navigation"`.

#### 4.13 Navegación duplicada
- **Archivo:** `landing/src/pages/index.astro:46-50` y `249-253`
- **Problema:** Mismos tres links (Contacto, Privacidad, Borrar cuenta) **copy-pasteados** en header nav y footer.
- **Fix:** Extraer en componente reutilizable o Astro partial.

#### 4.14 Sin `hreflang` tags para contenido en español
- **Archivo:** `landing/src/layouts/Layout.astro`
- **Problema:** Todo contenido en español (`lang="es"`) pero sin `<link rel="alternate" hreflang="es">` tags.
- **Fix:** Agregar hreflang tags si targeting regiones específicas de habla hispana.

#### 4.15 `impactRows` usa acceso posicional de array
- **Archivo:** `landing/src/pages/index.astro:18-22, 233-238`
- **Problema:** Indexación posicional (`row[0]`, `row[1]`, `row[2]`) es propensa a errores y poco legible.
- **Fix:** Usar objetos: `{ label, primary, secondary }`.

#### 4.16 Link styling remueve diferenciación visual
- **Archivo:** `landing/src/styles/global.css:28-30`
- **Problema:** Todos los links heredan color del padre y sin underline. **Visualmente indistinguibles** del texto circundante.
- **Fix:** Agregar focus/visible underline o cambio de color, o asegurar que todos los links tengan hover/focus states explícitos.

#### 4.17 Sin `prefers-reduced-motion` para hover animations
- **Archivo:** `landing/src/pages/index.astro` (múltiples instancias)
- **Problema:** `hover:-translate-y-0.5` con `transition` aplicado sin respetar `prefers-reduced-motion`.
- **Fix:** Agregar `@media (prefers-reduced-motion: reduce)` rule en global CSS.

### BAJOS

#### 4.18 Scoped Layout style duplica global reset
- **Archivo:** `landing/src/layouts/Layout.astro:32-38`
- **Problema:** `html, body { margin: 0; width: 100%; min-height: 100%; }` es global reset que pertenece en `global.css`.
- **Fix:** Mover a `global.css`.

#### 4.19 Sin scripts `lint` / `typecheck`
- **Archivo:** `landing/package.json:8-12`
- **Problema:** A diferencia de API, admin, y client, landing no tiene scripts de lint, format, o typecheck.
- **Fix:** Agregar `"lint": "eslint src/", "typecheck": "astro check"`.

#### 4.20 `<pre>` dentro de `<code>` semánticamente invertido
- **Archivo:** `landing/src/components/Welcome.astro:14`
- **Problema:** Orden correcto es `<pre><code>...</code></pre>`. (Baja prioridad ya que archivo debería eliminarse).
- **Fix:** Corregir orden si se mantiene.

#### 4.21 Sin `robots.txt` o `sitemap.xml` integration
- **Archivo:** `landing/astro.config.mjs`
- **Problema:** Sin `@astrojs/sitemap` integration o generación de `robots.txt`.
- **Fix:** Agregar `@astrojs/sitemap` y configurar robots.txt.

#### 4.22 Hardcoded CSS blur values en Hero Section
- **Archivo:** `landing/src/pages/index.astro:31-33`
- **Problema:** Tres blur divs decorativos con tamaños y posiciones hardcodeados.
- **Fix:** Consolidar en single CSS class o SVG background.

#### 4.23 `package.json` Node engine muy específico
- **Archivo:** `landing/package.json:6`
- **Problema:** `"node": ">=22.12.0"` pinneado a versión patch-level.
- **Fix:** Considerar `">=22.0.0"` a menos que haya razón específica.

---

## 5. Docker / Deploy

### ALTOS

#### 5.1 `api.Dockerfile` referenciado pero no existe
- **Archivo:** `package.json:27` (`build:server`), `scripts/docker-build.js:53`
- **Problema:** Scripts referencian `api.Dockerfile` pero el archivo real es `Dockerfile.api`. `npm run build:server` fallará.
- **Fix:** Corregir referencia a `Dockerfile.api` o renombrar archivo.

#### 5.2 Red externa `proxy-network` requerida manualmente
- **Archivo:** `compose.yml:74-75`, `compose.caddy.yml:17-18`
- **Problema:** `proxy-network: external: true` requiere que red se cree manualmente (`docker network create proxy-network`). No documentado en README.
- **Fix:** Agregar a documentación o crear red automáticamente en script de setup.

#### 5.3 Dockerfile usa Node 20 en build, Node 22 en producción
- **Archivo:** `Dockerfile.api:2, 48`
- **Problema:** Etapa de build usa `node:20-slim`, producción usa `node:22-alpine`. Diferencia de versión puede causar incompatibilidades.
- **Fix:** Alinear versiones de Node entre etapas.

#### 5.4 `Dockerfile.web` exporta a `dist` pero compose usa imagen pre-construida
- **Archivo:** `Dockerfile.web:27`, `compose.yml:38-43`
- **Problema:** `Dockerfile.web` compila web export con `npx expo export --platform web`, pero `compose.yml` usa imagen `ezemastro/loop-web:latest` que puede no estar actualizada.
- **Fix:** Asegurar que pipeline de build actualice imagen web correctamente.

### MEDIOS

#### 5.5 Sin healthcheck en servicios Docker
- **Archivos:** `compose.yml`, `server/docker-compose.prod.yml`
- **Problema:** Sin `healthcheck` en servicios `api` o `db`. `depends_on` solo espera que container inicie, no que servicio esté ready.
- **Fix:** Agregar healthchecks con `test: ["CMD", "curl", "-f", "http://localhost:3000/status"]`.

#### 5.6 Backup volume sin restricción de acceso
- **Archivo:** `compose.yml:55-71`
- **Problema:** Backups de PostgreSQL se almacenan en `./backups` sin restricciones de acceso. Contienen datos sensibles.
- **Fix:** Restringir permisos de directorio de backups.

#### 5.7 `compose.yml` expone puerto de DB al host
- **Archivo:** `server/docker-compose.yml:6`, `server/docker-compose.prod.yml:7`
- **Problema:** `"${POSTGRES_PORT:-5432}:5432"` expone puerto de DB al host. En producción esto es riesgo de seguridad.
- **Fix:** Remover port mapping en producción; solo API necesita acceso a DB.

#### 5.8 Sin `.dockerignore`
- **Problema:** Sin archivo `.dockerignore`, `node_modules`, archivos de desarrollo, y secrets pueden incluirse en context de build.
- **Fix:** Crear `.dockerignore` con `node_modules`, `.env`, `.git`, etc.

### BAJOS

#### 5.9 `compose.yml` usa `latest` tag para imágenes
- **Archivo:** `compose.yml:18, 39, 47`
- **Problema:** `ezemastro/loop-api:latest`, `ezemastro/loop-web:latest`, `ezemastro/loop-admin:latest` — sin version pinning, deploy puede usar imagen inesperada.
- **Fix:** Usar tags de versión específicos en producción.

#### 5.10 `Caddyfile` hardcodea dominio
- **Archivo:** `Caddyfile:2, 7, 12`
- **Problema:** `loop.reditinere.com`, `api.loop.reditinere.com`, `admin.loop.reditinere.com` hardcodeados.
- **Fix:** Usar variables de ambiente o template para dominios configurables.

---

## 6. Shared Types / Root Config

### MEDIOS

#### 6.1 Shared types solo incluidos en API tsconfig
- **Archivo:** `server/api/tsconfig.json:45`
- **Problema:** `"../../shared/types/**/*.ts"` solo en API tsconfig. Client y admin tienen sus propias definiciones de tipos, riesgo de drift.
- **Fix:** Incluir shared types en tsconfig de client y admin, o usar package con build step.

#### 6.2 Zod versions desalineadas entre paquetes
- **Archivos:** `server/api/package.json:33` (4.0.17), `adminClient/package.json:21` (4.3.5), `client/package.json:61` (^4.1.5)
- **Problema:** APIs de Zod 4.x (`z.email()`, `z.uuid()`) pueden diferir entre versiones.
- **Fix:** Alinear a versión única en todos los paquetes.

#### 6.3 Root `package.json` sin `workspaces` field
- **Archivo:** `package.json`
- **Problema:** Scripts de lint usan `--workspace` flags que silenciosamente fallan y fallback a comandos secuenciales.
- **Fix:** Agregar `workspaces` field o corregir scripts para no usar `--workspace`.

#### 6.4 Sin lockfile en root
- **Archivo:** `.gitignore:4`
- **Problema:** `server/**/package-lock.json` ignorado. Sin lockfile root, instalaciones pueden ser inconsistentes.
- **Fix:** Generar y committear lockfile root, o usar `package-lock.json` por paquete.

### BAJOS

#### 6.5 Prettier config en root pero no aplicado uniformemente
- **Archivo:** `.prettierrc`
- **Problema:** Config en root pero algunos paquetes pueden tener overrides locales no detectados.
- **Fix:** Verificar que todos los paquetes usan la misma config.

#### 6.6 Scripts de deploy (`publish.js`) en múltiples paquetes
- **Archivos:** `server/api/publish.js`, `client/publish.js`, `adminClient/publish.js`, `landing/publish.js`
- **Problema:** Cada paquete tiene su propio `publish.js`. Lógica probablemente duplicada.
- **Fix:** Consolidar en script root único.

---

## 7. Resumen por Severidad

| Categoría | Crítico | Alto | Medio | Bajo |
|-----------|---------|------|-------|------|
| **API** | 5 | 9 | 16 | 12 |
| **Client** | 5 | 18 | 27 | 9 |
| **Admin** | 6 | 10 | 16 | 9 |
| **Landing** | 2 | 6 | 9 | 6 |
| **Docker/Deploy** | 0 | 4 | 4 | 2 |
| **Shared/Root** | 0 | 0 | 4 | 2 |
| **TOTAL** | **18** | **47** | **76** | **40** |

---

## 8. Plan de Acción Recomendado

### Fase 1: Críticos (resolver inmediatamente)

1. **API:** Remover `console.log(password)` en `models/auth.ts:156`
2. **API:** Corregir `rejectOffer` - agregar transacción + restauración de créditos
3. **API:** Hacer operaciones de créditos atómicas (`credits_balance = credits_balance + $1`)
4. **API:** Validar ORDER BY con CASE expressions parametrizadas
5. **API:** Agregar rate limiting en endpoints de auth
6. **Client:** Restaurar 5+ archivos corruptos con contenido mezclado
7. **Client:** Fix 16 catch blocks sin return/re-throw
8. **Client:** Remover `usesCleartextTraffic: true` y permiso `RECORD_AUDIO`
9. **Client:** Fix race condition en `ModifyListing` (stale state + off-by-one)
10. **Client:** Fix switch fallthrough en `ListingButtons`
11. **Admin:** Agregar route-level auth guard
12. **Admin:** Fix stale state en `MissionFormModal` y `EditSchoolModal`
13. **Admin:** Agregar confirmación para reset password
14. **Landing:** Asegurar account deletion form con CSRF + auth + confirmación
15. **Docker:** Corregir referencia a `api.Dockerfile` → `Dockerfile.api`

### Fase 2: Altos (resolver esta semana)

1. **API:** JWT_SECRET validation en startup
2. **API:** Fix `acceptOffer` missing `return` en Promise.all
3. **API:** `trimBody` recursivo
4. **API:** UNIQUE constraint en `admins.email`
5. **API:** Archivos subidos - evaluar acceso público
6. **API:** Validar `amount > 0` en `modifyUserCredits`
7. **API:** Password strength validation en `resetUserPassword`
8. **API:** Fix `tokenMiddleware` admin token leakage
9. **Client:** Fix null access en `Chat.tsx`, `Search.tsx`, etc.
10. **Client:** Validar `listingId` como string antes de usar
11. **Client:** `QueryClient` memoizado con `useState`
12. **Client:** Remover debug console.logs
13. **Client:** Fix polling agresivo (5s messages)
14. **Client:** Fix home feed mostrando solo listings propios
15. **Admin:** Fix school-stats matching (parseInt en UUID)
16. **Admin:** `parseInt` con radix en 3 ocurrencias
17. **Admin:** Controlled inputs en Login/Register
18. **Admin:** Null checks en `school.media`
19. **Landing:** Agregar Open Graph meta tags
20. **Landing:** Cargar Google Fonts o remover referencias
21. **Landing:** Agregar `eslint-plugin-astro`
22. **Docker:** Alinear Node versions en Dockerfile
23. **Docker:** Agregar healthchecks a servicios

### Fase 3: Medios (resolver este sprint)

1. **API:** N+1 queries → JOINs o batch queries
2. **API:** `createListing` en transacción
3. **API:** `deleteListing` cleanup de media
4. **API:** `config.ts` sincrónico
5. **API:** CORS origins validation en producción
6. **API:** Connection pool configuration
7. **API:** Zod validation en `createCategory`/`updateCategory`
8. **API:** Health check endpoint `/health`
9. **Client:** `useInfiniteQuery` → `useQuery` donde apropiado
10. **Client:** Memoizar `sections` arrays
11. **Client:** Fix `mutationKey`/`queryKey` referential instability
12. **Client:** Memory leak `URL.createObjectURL`
13. **Client:** Zod version alignment
14. **Admin:** Debounce en búsqueda de usuarios
15. **Admin:** Build optimization config
16. **Admin:** React Compiler + rolldown-vite compatibilidad check
17. **Landing:** Canonical link, structured data, sitemap
18. **Landing:** `prefers-reduced-motion` support
19. **Docker:** `.dockerignore` file
20. **Docker:** Healthchecks y port restrictions
21. **Shared:** Incluir shared types en client/admin tsconfig
22. **Shared:** Alinear Zod versions

### Fase 4: Bajos (mejoras continuas)

1. Limpiar imports no usados (React, ERROR_NAMES, etc.)
2. Remover código comentado
3. Corregir nombres de componentes a PascalCase
4. Agregar `lint`/`typecheck` scripts a landing
5. Consolidar `publish.js` scripts
6. Agregar workspaces field a root package.json
7. Mejorar test coverage
8. Documentar setup y deployment

---

## 9. E2E Tests - Plan de Implementación

> **Nota:** La sección de E2E tests se detalla en archivo separado `E2E_TESTS.md` con implementación completa.

### Stack Recomendado
- **Playwright** - Soporta web, mobile emulation, y puede interactuar con API directamente
- **Vitest** como test runner (ya presente en ecosistema)
- **Testcontainers** para PostgreSQL aislado (opcional)

### Escenarios a cubrir
1. **Auth Flow:** Register → Login → Google Login → Logout
2. **Listings Flow:** Create → Edit → Delete → Search → Filter
3. **Offers Flow:** Make offer → Accept → Reject → Receive
4. **Messages Flow:** Send message → Read messages → Unread count
5. **Admin Flow:** Login → Manage users → Manage schools → Manage categories
6. **Cross-package:** Client creates listing → Admin sees it → API processes offer

### Ejecución Local
```bash
# 1. Iniciar servicios requeridos
docker compose -f server/docker-compose.yml up -d

# 2. Esperar a que API esté lista
# 3. Ejecutar tests
npx playwright test
```
