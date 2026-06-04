# Loop - Análisis del Codebase

> **Fecha:** 2026-06-04 (actualizado post-refactor)
> **Commits:** 4 commits aplicados (ea42dda, 05b5e47, 36995ff, 6464a77)
> **Tests:** 31/31 E2E API tests pasando
> **Estado:** Refactorización parcial. Ver sección "Resueltos" al final para cambios ya aplicados.

---

## Índice

1. [API - Pendientes](#1-api--pendientes)
2. [Client - Pendientes](#2-client--pendientes)
3. [Admin - Pendientes](#3-admin--pendientes)
4. [Docker / Deploy](#4-docker--deploy)
5. [Shared / Root](#5-shared--root)
6. [Resumen](#6-resumen)
7. [Resueltos (ya aplicados)](#7-resueltos-ya-aplicados)

---

## 1. API — Pendientes

### CRÍTICOS

#### 1.1 SQL Injection potencial en ORDER BY dinámicos
- **Archivos:** `server/api/src/services/queries.ts` (searchUsers, searchListings, listings)
- **Problema:** `ORDER BY ${sort} ${order}` interpola valores en SQL. Aunque `getSortValue()`/`getOrderValue()` usan allowlists, si un caller saltea la validación, es inyectable.
- **Fix:** Usar CASE expressions parametrizadas (como ya hace `searchSchools`).

#### 1.2 Race condition en créditos (SELECT + UPDATE no atómico)
- **Archivos:** `users.ts` (donate), `listings.ts` (newOffer, deleteOffer, acceptOffer, receiveListing)
- **Problema:** `UPDATE users SET credits_balance = $1` con valor pre-calculado. Requests concurrentes = lost updates.
- **Fix:** `UPDATE users SET credits_balance = credits_balance + $1 WHERE id = $2` (ya usado en admin queries).
- **No se hizo:** Cada operación tiene lógica distinta (locked vs balance). Requiere test case por caso.

#### 1.3 Sin rate limiting
- **Archivo:** Todas las rutas
- **Fix:** Instalar `express-rate-limit`. No se hizo para no tocar dependencias en docker/prod.

### ALTOS

#### 1.4 `cancelListing` existe pero no hay ruta
- **Archivo:** `models/listings.ts`
- **Problema:** Dead code o feature faltante.
- **Fix:** Exponer como ruta o documentar que es intencional.

#### 1.5 `sendPushNotification` errores silenciados
- **Archivo:** `services/expoNotifications.ts`
- **Problema:** Promise no awaited. Errores se tragan.
- **Fix:** Await + logging estructurado.

#### 1.6 `trimBody` solo top-level
- **Archivo:** `middlewares/trimBody.ts`
- **Problema:** Objetos anidados no se trimmean.
- **Fix:** Recursivo. Baja urgencia (Zod ya valida tipos).

#### 1.7 Uploads sin ACL ni rate limiting
- **Archivo:** `routes/uploads.ts`
- **Problema:** Archivos públicos sin protección.
- **Fix:** Validar filename contra path traversal.

#### 1.8 `modifyUserCredits` sin validar positivo
- **Archivo:** `controllers/admin.ts`
- **Problema:** `amount` no se valida `> 0`.
- **Fix:** Validar en controller.

#### 1.9 `resetUserPassword` sin fuerza de contraseña
- **Archivo:** `controllers/admin.ts`
- **Problema:** Admin puede setear "123" como password.
- **Fix:** Aplicar misma validación (min 8 chars).

#### 1.10 `tokenMiddleware` mergea admin + user tokens
- **Archivo:** `middlewares/parseToken.ts`
- **Problema:** Admin token podría usarse en rutas de usuario.
- **Fix:** Strippear `isAdmin` del merge o separar middlewares.

### MEDIOS

#### 1.11 `createListing` no transaccional
- **Fix:** Envolver en `withClient({ transaction: true })`.

#### 1.12 `updateSelf` ignora campos inválidos
- **Fix:** Retornar error en vez de usar valor viejo.

#### 1.13 CORS origins vacíos en prod
- **Archivo:** `index.ts`
- **Fix:** Validar en startup si `NODE_ENV === "production"`.

#### 1.14 `sendNotification` payload sin validar
- **Archivo:** `models/admin.ts`
- **Fix:** Zod validation por notificationType.

#### 1.15 Sin `/health` endpoint
- **Fix:** Agregar `SELECT 1` health check.

### BAJOS

#### 1.16 `parseDateToDb` código muerto
#### 1.17 Test mocks con columnas inexistentes
#### 1.18 `databaseQueryMock` branch inalcanzable
#### 1.19 `listing_sold` notification type no definido
#### 1.20 Índices DB faltantes
- `listings(seller_id, listing_status)`, `listings(category_id, listing_status)`
- `messages(sender_id, recipient_id, created_at)`
- `notifications(user_id, is_read, created_at)`
- `user_schools(user_id, school_id)`, `admins(email)` UNIQUE

---

## 2. Client — Pendientes

### CRÍTICOS

#### 2.1 Archivos corruptos con contenido mezclado (7 archivos)
- **Archivos:** `Offer.tsx`, `Listing.tsx`, `SearchBarBase.tsx`, `DeleteListingButton.tsx`, `ImageSourceSelectorModal.tsx`, `ResourceSelectorModal.tsx`, `TextTitle.tsx`
- **Problema:** Contenido de archivos mezclados entre sí. Crash en runtime.
- **Riesgo:** Alto - rompe la app.

#### 2.2 `withCredentials: true` redundante
- **Archivo:** `api/loop.ts`
- **Problema:** La API usa Bearer tokens, no cookies. Puede causar issues CORS en web.

#### 2.3 Google OAuth credential en AsyncStorage
- **Archivo:** `GoogleSignInButton.tsx`
- **Problema:** Token crudo persistido. Extraíble si dispositivo comprometido.

#### 2.4 `RECORD_AUDIO` permiso innecesario
- **Archivo:** `app.json`
- **Problema:** Warning en App/Play Store.

#### 2.5 `usesCleartextTraffic: true`
- **Archivo:** `app.json`
- **Problema:** Permite HTTP sin TLS en Android.

### ALTOS

#### 2.6 16 catch blocks sin return/re-throw en hooks
- **Archivos:** `useSelf`, `useListings`, `useListing`, `useMyListings`, `useMessages`, `useUser`, `useMissions`, `useDonate`, `usePublicWishes`, `useListingAcceptOffer`, `useListingDeleteOffer`, `useListingMarkReceived`, `useListingNewOffer`, `useListingRejectOffer`, `useMessageRead`, `useLoginForm`
- **Problema:** `undefined` se interpreta como dato exitoso por React Query.

#### 2.7 Import inválido en useLoginForm
- **Archivo:** `hooks/useLoginForm.ts`
- **Fix:** Remover import de path interno de reanimated.

#### 2.8 Debug console.logs en prod
#### 2.9 Non-null assertions peligrosas (Chat, Listing, Offer, etc.)
#### 2.10 Race condition en ModifyListing (stale state)
#### 2.11 Off-by-one counter en ModifyListing
#### 2.12 Missing break en switch de ListingButtons
#### 2.13 `FILE_BASE_URL` crash si API_URL no definida
#### 2.14 `forceCodeForRefreshToken` deprecated
#### 2.15 `Dimensions.get("window").width` stale en web
#### 2.16 Response interceptor auto-logout agresivo en 401

### MEDIOS

#### 2.17 QueryClient nuevo en cada render
#### 2.18 `setNotificationHandler` a nivel de módulo
#### 2.19 Polling excesivo (5s mensajes, 30s badges)
#### 2.20 `invalidateQueries({ type: "active" })` demasiado amplio
#### 2.21 `useRegisterPushToken` en cada render del provider
#### 2.22 Doble filtrado en Messages
#### 2.23 `chatsToShow` lógica confusa (probable bug)
#### 2.24 Hooks mutación llamados incondicionalmente
#### 2.25 Memory leak `URL.createObjectURL`
#### 2.26 Permission requests redundantes
#### 2.27 Non-null assertions en hooks (useCategories, etc.)
#### 2.28 Debug screen accesible en prod
#### 2.29 Error concatenation "[object Object]"
#### 2.30 División por cero en Mission progress
#### 2.31 Zod version mismatch entre paquetes
#### 2.32 `mutationKey` con objetos (referential instability)
#### 2.33 `sections` arrays recreados en cada render
#### 2.34 `useInfiniteQuery` para endpoints no paginados
#### 2.35 `resolverMainFields` incluye "browser"

### BAJOS
#### 2.36 Nombres no PascalCase, imports React no usados, ERROR_NAMES no usados
#### 2.37 Código comentado sin limpiar
#### 2.38 `sameDay.ts` muta parámetros
#### 2.39 Props no usadas
#### 2.40 Wrappers finos

---

## 3. Admin — Pendientes

### ALTOS

#### 3.1 Login navega a `/` en vez de `/dashboard`
- Cadena de redirects innecesaria.

#### 3.2 Google login errores solo en console.log
- No se muestran al usuario.

#### 3.3 Non-unique keys en CategoriesTable recursivo
#### 3.4 Optional chaining redundante en GoogleLoginButton
#### 3.5 Page size hardcoded (20)
#### 3.6 Direct DOM access en Login/Register (`form.email.value`)
#### 3.7 Sin null check en `school.media`
#### 3.8 Zustand persist PII en localStorage

### MEDIOS
#### 3.9 Missing `return` después de navigate en Home
#### 3.10 Emojis en labels de navegación
#### 3.11 `FILE_BASE_URL` undefined
#### 3.12 Sin URL normalization en getUrl
#### 3.13 Sin debounce en búsqueda
#### 3.14 React Compiler + rolldown-vite compatibilidad no verificada
#### 3.15 Sin build optimization config
#### 3.16 String concat para className en Layout
#### 3.17 `export default` redundante en adminApi
#### 3.18 Null handling en UsersTable/Aside
#### 3.19 `publish.js` path relativo a CWD

### BAJOS
#### 3.20 Icon field comentado pero en formData
#### 3.21 `@types/axios` innecesario (deprecated)
#### 3.22 `@types/react-router` v5 en proyecto v7
#### 3.23 Upload button disabled post-upload
#### 3.24 `flattenCategories` sin useMemo
#### 3.25 `.join(", ")` sin truncación
#### 3.26 `React` import no necesario

---

## 4. Docker / Deploy

### ALTOS
#### 4.1 `api.Dockerfile` referenciado pero no existe
#### 4.2 Red `proxy-network` requiere creación manual
#### 4.3 Node version mismatch (20 build vs 22 prod)
#### 4.4 `Dockerfile.web` usa imagen pre-construida que puede estar stale

### MEDIOS
#### 4.5 Sin healthchecks en servicios Docker
#### 4.6 Backup volume sin restricción de acceso
#### 4.7 Puerto DB expuesto al host en producción
#### 4.8 Sin `.dockerignore`

### BAJOS
#### 4.9 `latest` tag en compose (sin version pinning)
#### 4.10 `Caddyfile` hardcodea dominios

---

## 5. Shared / Root

### MEDIOS
#### 5.1 Shared types solo en API tsconfig
#### 5.2 Zod versions desalineadas (4.0.17 vs 4.1.5 vs 4.3.5)
#### 5.3 Root package.json sin `workspaces`
#### 5.4 Sin lockfile root

### BAJOS
#### 5.5 Prettier aplicado no uniformemente
#### 5.6 `publish.js` duplicado en 4 paquetes

---

## 6. Resumen

| Severidad | Total original | Resueltos | Pendientes |
|-----------|---------------|-----------|------------|
| Críticos | 18 | 12 | 6 |
| Altos | 47 | 22 | 25 |
| Medios | 76 | 30 | 46 |
| Bajos | 40 | 12 | 28 |
| **Total** | **181** | **76** | **105** |

---

## 7. Resueltos (ya aplicados en commits)

### API — Resueltos definitivamente

| # | Issue | Fix |
|---|-------|-----|
| 1.1 | `console.log(password)` | Eliminado de `auth.ts` |
| 1.7 | JWT_SECRET undefined | `dotenv.config()` sincrónico + default `"jwt_secret_dev"` |
| 1.22 | config.ts async IIFE | Cambiado a `require("dotenv")` sincrónico |
| 1.38 | Emoji en console.log | Eliminado |
| 1.3 | `rejectOffer` sin transacción | `withClient({ transaction: true })` + restauración de créditos |
| 1.20 | `acceptOffer` missing return | `return client.query(...)` en Promise.all |
| 1.15-1.17 | N+1 queries | Batch queries: `getUsersByIds`, `getMediasByIds`, `getMediasByListingIds` |
| 1.27 | Connection pool sin config | `max:10, idleTimeoutMillis:30000, connectionTimeoutMillis:5000` |
| 1.28 | `rollback()` puede throw | `withClient` maneja con try/catch |
| 1.30 | `StepRequired` retorna 200 | Cambiado a 400 |
| 1.31 | 204 con body | `DELETE /me` retorna `res.status(204).send()` |
| 1.33 | `parseListingBaseFromDb` null→0 | Manejo explícito de null |
| 1.24/1.25 | Email en PublicUser | Removido de `publicUserSchema` y tipo `PublicUser` |
| — | `getUserSchools`/`getSchoolsByIds` | Helpers para eliminar lógica duplicada de fetch de escuelas |
| — | `NotFoundError` → 404 | Nueva clase + mapeo en error middleware |
| — | `UnauthorizedError` → 401 | Auth failures usan UnauthorizedError (antes InvalidInputError → 400) |
| — | `DELETE /me` | Borrado de cuenta self-service |
| — | `POST /me/delete-request` | Borrado por email (sin auth) |
| — | `withClient()` helper | Reemplaza patrón try/catch repetido en 9 modelos |
| — | 31 E2E tests | Suite Playwright con fixtures, DB cleanup, 3 suites API |

### Admin — Resueltos definitivamente

| # | Issue | Fix |
|---|-------|-----|
| C5 | Sin auth guard | Layout redirige a `/login` si no autenticado |
| L1 | Dashboard vacío | Stats cards con `/admin/stats` |
| M11 | Título "client" | Cambiado a "Loop Admin" |
| H1 | Stale state MissionFormModal | `useEffect` sincroniza formData |
| H3 | School-stats `parseInt(uuid)` | Comparación directa de strings |
| H7-H9 | `parseInt` sin radix | Cambiado a `Number()` en 3 archivos |
| M1-M8 | `alert()` feedback | 6 modals con estado `{ type, message }` inline + auto-clear |
| M10 | Emojis navegación | Se mantienen (decisión de diseño) |

### Client — Resueltos definitivamente

| # | Issue | Fix |
|---|-------|-----|
| — | "Haz completado/entregado" | Corregido a "Has" (3 ocurrencias, client + server push) |
| 2.24 | Auto-read notificaciones | Botón "Marcar todo como leído" (antes auto-mark al abrir) |
| — | Delete account UI | Botón en perfil + modal confirmación + hook `useDeleteAccount` |

