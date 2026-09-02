# Loop — Auditoría integral y hoja de ruta

> **Fecha:** 2026-09-01 · **Commit base:** `d9fffd6` · **Reemplaza a:** `ANALYSIS.md` (2026-06-04, desactualizado)
> **Método:** revisión de código en modo lectura (API, migraciones, cliente Expo, admin, infra, tests). Cada hallazgo cita `archivo:línea`. Los marcados "(a confirmar)" son sospechas fuertes no reproducidas en runtime.
> **Cómo usar este documento:** cada hallazgo tiene un ID estable (`SEC-01`, `ECO-03`, `INF-02`…). En sesiones futuras, tomar un ID o un bloque de la hoja de ruta (§9) y llevarlo como cambio SDD (`/sdd-new <id>`). Al cerrar uno, marcarlo en §10.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Lo que está bien (no tocar sin motivo)](#2-lo-que-está-bien)
3. [Seguridad y configuración (SEC)](#3-seguridad-y-configuración-sec)
4. [Economía de créditos y lógica de negocio (ECO)](#4-economía-de-créditos-y-lógica-de-negocio-eco)
5. [Infraestructura, delivery y observabilidad (INF)](#5-infraestructura-delivery-y-observabilidad-inf)
6. [Cliente Expo (CLI)](#6-cliente-expo-cli)
7. [Panel de administración y landing (ADM)](#7-panel-de-administración-y-landing-adm)
8. [Producto: de "app de una red educativa" a "app para cualquier comunidad" (PROD)](#8-producto-de-app-de-una-red-educativa-a-app-para-cualquier-comunidad-prod)
9. [Hoja de ruta propuesta](#9-hoja-de-ruta-propuesta)
10. [Registro de avance](#10-registro-de-avance)
11. [Anexo: estado de `ANALYSIS.md` (junio 2026)](#11-anexo-estado-de-analysismd-junio-2026)

---

## 1. Resumen ejecutivo

**Estado general:** el proyecto tiene una base técnica seria en el lugar más difícil (aislamiento multi-comunidad con RLS, migraciones con checksum, E2E dockerizado) y deuda concentrada en cuatro frentes que hoy impiden ofrecerlo con confianza a una segunda comunidad:

| Frente | Problema central | Riesgo |
|---|---|---|
| **Economía de créditos** | Todos los movimientos de saldo son "leer → calcular en Node → sobrescribir", sin `FOR UPDATE`, sin `CHECK >= 0` y sin ledger (solo el admin escribe `wallet_transactions`). Dos requests concurrentes duplican o destruyen créditos y no hay forma de auditarlo. | Integridad del producto |
| **Hardening de producción** | `JWT_SECRET` con default público, un solo secreto para tokens de usuario y admin, sin validación de entorno al arrancar, sin rate limiting, login que enumera cuentas, uploads públicos, token de verificación de email en claro y sin expiración. | Seguridad |
| **Delivery** | Sin CI. La imagen de producción de la API no contiene ni `tsx` ni `server/migrations`: no hay forma reproducible de migrar en prod. Scripts de build raíz apuntan a un Dockerfile inexistente y a un nombre de imagen que `compose.yml` no consume. Sin `--platform` para un host ARM64. Backups sin restore probado y sin incluir `uploads/`. | Operación |
| **Legal / tiendas** | La landing se eliminó en `b1bd13f`: no hay URL pública de política de privacidad ni de borrado de cuenta (requisito de App Store / Play y, con menores, requisito legal). `POST /me/delete-request` quedó sin cliente. Términos hardcodean "La Red Itinere". | Publicación |

**Para multi-comunidad**, el bloqueo más grande es de modelo, no de código: el registro exige al menos una escuela (`validations.ts:223`), los colegios exigen logo, misiones y categorías son globales, la economía no es configurable (`communities.meta` está vacío), y el vocabulario ("colegio", "útiles", "loopies", correo institucional) está repartido en cliente, API y mails. Un barrio cerrado o un municipio **no puede operar hoy** aunque se le cree la comunidad.

**Del `ANALYSIS.md` de junio** quedaban 105 ítems pendientes; hoy siguen abiertos aproximadamente 70 (ver §11), incluidos los 5 críticos del cliente. La sección "Resueltos" tenía al menos un error (`StepRequired` sigue devolviendo 200).

**Qué hacer YA (esta semana, orden sugerido):** §9 Fase 0 — son 8 cambios pequeños que cierran los agujeros con peor relación riesgo/esfuerzo.

---

## 2. Lo que está bien

Vale dejarlo escrito para no "arreglar" lo que funciona:

- **Multi-tenancy en tres capas** — predicado `community_id` en cada query, FKs compuestas `(id, community_id)` (`0004`), RLS fail-closed con `WITH CHECK` sobre 13 tablas y dos roles (`loop_app` sin BYPASSRLS, `loop_app_unscoped` con) (`0007`). `withClient` exige `inCommunity(id)` o `unscoped(reason)`; el GUC se fija antes de `BEGIN` y se limpia al liberar (`postgresClient.ts:121-124`). `assertDbHardening()` aborta el arranque en producción si algo falta. **No se encontró ninguna ruta de usuario que lea o escriba fuera de su comunidad.**
- **Admin scoping** — la comunidad sale siempre del token, nunca del body (`parseAdminToken.ts:55-77`); `requireSuperAdmin` en catálogos; invariante super_admin ⇔ sin comunidad como `CHECK` en DB (`0006`); rol heredado de la allowlist.
- **Runner de migraciones** (`server/api/src/scripts/migrate.ts`) — orden, SHA-256 con abort si cambió, transacción por migración, pragma `-- migrate:no-transaction`, advisory lock, secretos vía `set_config`.
- **E2E autocontenido** (`docker-compose.e2e.yml`, `scripts/run-e2e.sh`) — 40 tests, 5 de aislamiento entre comunidades, `down -v` garantizado. Además `rls.test.ts` prueba fail-closed a nivel SQL (pero está desactivado por defecto, ver INF-06).
- **Auth** — bcrypt, cookies `httpOnly`/`secure`, token admin de 30 min, invitaciones con `FOR UPDATE` y consumo único, verificación de email después de validar contraseña (no filtra cuentas), respuestas uniformes en `resend-verification` y `delete-request`.
- **Uploads** — allowlist MIME, 15 MB, re-encode con sharp, nombre UUID (sin path traversal). El cliente redimensiona a 1600 px antes de subir.
- **Cliente** — capas claras (`app/` → `screens` → hooks → `api/loop.ts`), modo demo aislado con `axios.getAdapter()` correcto, tema por comunidad con tests de contraste, limpieza de caché y tema al hacer logout.
- **Admin** — gestión de comunidades completa (slug, dominios, tema, logo, activa), sistema `ui/` nuevo con estados de carga/vacío/error, borrado de cuenta con doble confirmación, TS estricto sin `any`.
- **Herramientas de repo** — `check-sql-arity.py`, `.dockerignore` correcto, seed que se niega a correr en producción sin `--force`, `PublicUser` sin email/teléfono/saldo.

---

## 3. Seguridad y configuración (SEC)

| ID | Sev | Hallazgo | Evidencia | Fix |
|---|---|---|---|---|
| SEC-01 | **Crítico** | Secretos con default y sin validación de entorno. `JWT_SECRET = "jwt_secret_dev"`; contraseñas de DB caen a la del superusuario o a `"loop_app_dev"`. Un deploy sin la variable arranca en silencio; cualquiera forja un `admin_token` con `adminRole: "super_admin"`. | `server/api/src/config.ts:22, 74-77`; `index.ts` sin validación | Esquema Zod sobre `process.env` al arrancar; en producción abortar si faltan `JWT_SECRET`, `DB_APP_PASSWORD`, `DB_UNSCOPED_PASSWORD`, `FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `WEB_GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_CLIENT_ID`. |
| SEC-02 | **Alto** | Un solo secreto firma tokens de usuario y de admin; la separación depende solo del claim. | `services/jwt.ts:30, 60` | `ADMIN_JWT_SECRET` independiente. |
| SEC-03 | **Alto** | Sin rate limiting en ningún endpoint; sin `helmet`. Login distingue `USER_NOT_FOUND` / `INVALID_CREDENTIALS` (enumeración por código y por tiempo: no corre bcrypt si el usuario no existe). Contraseña mínima 6. `resend-verification` y `register` permiten spam de mails (cuota Resend). | `index.ts`; `models/auth.ts:270-278`; `models/admin.ts:161-167`; `validations.ts:12`; `models/auth.ts:327-354` | `express-rate-limit` por IP+email en `/auth/*`, `/admin/login`, `/me/delete-request`, `/messages`; respuesta única "credenciales inválidas" con bcrypt ficticio; mínimo 8; `helmet`. |
| SEC-04 | **Alto** | Verificación de Google sin `audience` si falta la env (google-auth-library omite el check de `aud`). `ANDROID_/IOS_GOOGLE_CLIENT_ID` se leen y no se usan. Google-login vincula por email a cuentas con contraseña y marca `email_verified`. *(a confirmar con la versión instalada)* | `models/auth.ts:366`; `models/admin.ts:216-219`; `config.ts:29-30` | Exigir las variables (SEC-01) y pasar los tres client IDs como `audience`. |
| SEC-05 | **Alto** | `users.email` sin UNIQUE; duplicado chequeado fuera de la transacción. Dos registros simultáneos crean dos filas; el login devuelve una arbitraria. | `database_creation.sql:30`; `models/auth.ts:155-161` | Migración: deduplicar + `CREATE UNIQUE INDEX ON users (lower(email))`; mapear `23505` → 409. |
| SEC-06 | Medio | `PATCH /me` acepta `password` sin pedir la actual; `POST /me/change-password` verifica la vieja pero no valida la nueva (`""` se hashea). Un token robado (30 días) toma la cuenta para siempre. | `validations.ts:256`; `models/self.ts:115-118`; `controllers/self.ts:294-308` | Quitar `password` de `updateSelfSchema`; `passwordSchema` en `newPassword`; invalidar sesiones al cambiar (requiere versión de token o `password_changed_at`). |
| SEC-07 | Medio | Endpoints admin sin esquema: `modifyUserCredits` (`amount` negativo con `positive:true` resta), `resetUserPassword` (comentario "No hay validaciones porque es administrador"; `undefined` → 500), `sendNotification` (`type` fuera del enum → 500; `payload` libre persistido), `createSchool`/`updateSchool`. | `controllers/admin.ts:177-216, 246-284, 355-368` | Zod por endpoint: `z.number().int().positive()`, `passwordSchema`, `z.enum` + esquema por tipo de payload. |
| SEC-08 | Medio | Uploads servidos con `express.static` sin sesión: cualquier URL filtrada es accesible desde fuera de la comunidad, para siempre. | `routes/uploads.ts`; `index.ts:97` | Handler con `tokenMiddleware` que verifique `media.community_id`, o URLs firmadas con expiración. |
| SEC-09 | Medio | `loop_app` tiene DML sobre tablas sin RLS (`admins`, `admin_valid_emails`, `invitations`, `communities`, `community_email_domains`). Defensa en profundidad: una inyección desde el camino scopeado leería hashes de admin. | `0007_db_roles_and_rls.sql:46-52, 106-110` | `REVOKE` para `loop_app`, dejando `SELECT` en `communities`/`community_email_domains`. |
| SEC-10 | Medio | Token de verificación de email guardado en claro y sin expiración. | `models/auth.ts:174, 341`; `0008:10` | Guardar `sha256(token)` + `expires_at` (24 h). *(ya registrado como diferido en memoria de sesión 2026-08-31)* |
| SEC-11 | Medio | No existe "olvidé mi contraseña" para usuarios; solo reset por admin, que fija la contraseña en claro por body. | `routes/admin.ts` | Flujo por email con token hasheado y expiración, reutilizando `services/email.ts`. |
| SEC-12 | Medio | `sendPushNotification` sin `await` ni `catch`: un rechazo es `unhandledRejection` y en Node 22 termina el proceso *(a confirmar)*. | `services/expoNotifications.ts:20-28` | `await` + `try/catch` + log. |
| SEC-13 | Bajo | `ORDER BY ${sort} ${order}` interpolado (mitigado por allowlist). LIKE sin escapar `%`/`_`. `trimBody` solo nivel superior. | `queries.ts:327, 387, 568, 840`; `middlewares/trimBody.ts` | Mapear a constantes SQL; escapar comodines; trim recursivo. |
| SEC-14 | Bajo | CORS prod `[FRONTEND_URL ?? "", ADMIN_FRONTEND_URL ?? ""]` y cookies `sameSite: "none"`; sin token CSRF (mitigado porque solo se parsea JSON). | `index.ts:51`; `config.ts:144-150` | Cubierto por SEC-01; evaluar `sameSite: "lax"` si front y API comparten sitio; nunca agregar `express.urlencoded` sin CSRF. |
| SEC-15 | Bajo | `StepRequired` responde 200 (ANALYSIS lo daba por corregido). `/status` expone `NODE_ENV`; no hay `/health` con DB. `express.json()` sin `limit` explícito. | `middlewares/errors.ts:45`; `index.ts:66` | 400/409; `/health` con `SELECT 1` y check de RLS. |
| SEC-16 | Bajo | Logs con PII: `email.ts:16, 32` loguean destinatario; `:41` imprime el link de verificación completo si falta `RESEND_API_KEY`. Correo personal hardcodeado en `admin_valid_emails` (`database_creation.sql:160`). `page` sin máximo (`validations.ts:263`). `profileMediaId` y `linkMediaToListing` no verifican `uploaded_by`. Admin creado por Google que intenta login con contraseña → `comparePasswords(x, null)` → 500 *(a confirmar)*. `TOKEN_EXP` como string numérico se interpreta en ms *(a confirmar)*. Fallback de tokens v1 sin fecha de retiro (`parseToken.ts:20-45`). | — | Limpieza puntual, cada uno es un cambio de una línea. |

---

## 4. Economía de créditos y lógica de negocio (ECO)

### 4.1 Máquina de estados actual

```
published ──POST /offer (comprador)───────► offered
offered   ──DELETE /offer (comprador)─────► published   (refund total)
offered   ──POST /offer/reject (vendedor)─► published   (refund total)
offered   ──POST /offer/accept (vendedor)─► accepted    (recalcula bloqueo; trades)
accepted  ──POST /receive (comprador)─────► received    (paga al vendedor, suma stats)
accepted  ──cancelListing (vendedor)──────► published   ← IMPLEMENTADO, SIN RUTA
```

- Minting de créditos: **solo** misiones y admin. `INITIAL_CREDITS = 0` (`config.ts:36`) no crea saldo, solo se pinta en la respuesta del registro.
- Ledger `wallet_transactions`: lo escribe **únicamente** `modifyUserCredits` (`queries.ts:857`, único call site `models/admin.ts:353`). Loops, misiones y donaciones no dejan rastro. `balance_after` siempre NULL. `deleteSelf` borra el ledger del usuario.
- `listing_trades` nunca se escribe (`storeTrade`, `queries.ts:455`, sin llamadas).
- Misiones: templates globales; al registrarse se asignan todas (incluidas inactivas); progreso solo por "publicar listing" y "foto de perfil"; `total` se deriva del sufijo numérico del `key`.

### 4.2 Hallazgos

| ID | Sev | Hallazgo | Evidencia | Fix |
|---|---|---|---|---|
| ECO-01 | **Crítico** | Saldos no atómicos: cada flujo hace `SELECT` → cálculo JS → `UPDATE users SET credits_balance=$1, credits_locked=$2` (valor absoluto), dentro de transacción pero sin `FOR UPDATE`. Dos ofertas o dos donaciones simultáneas del mismo usuario pisan el saldo. Sin `CHECK >= 0` en DB; `decreaseUserBalance` (admin) sin piso. | `models/listings.ts:365, 414, 500, 647-660, 724-751, 859-881`; `models/users.ts:87-93`; `helpersDb.ts:669-678`; `queries.ts:448-453, 860-871`; `database_creation.sql:33-34` | `UPDATE users SET credits_balance = credits_balance - $1 WHERE id = $2 AND credits_balance >= $1 RETURNING *` (o `SELECT … FOR UPDATE` al inicio del tx); migración con `CHECK (credits_balance >= 0 AND credits_locked >= 0)`. |
| ECO-02 | **Crítico** | Sin ledger para loop/misión/donación: imposible auditar, reconciliar o mostrar "mis movimientos". Sin invariante `balance + locked == Σ ledger`. | ver 4.1 | Insertar `wallet_transactions` en la misma transacción de cada mutación, con `balance_after`; conservar ledger al borrar usuario (`user_id` nullable / anonimizado). Agregar job de reconciliación. |
| ECO-03 | **Alto** | `newOffer` no exige `listing_status = 'published' AND buyer_id IS NULL` en el `UPDATE`; el check es solo en memoria. Dos compradores simultáneos: el segundo pisa al primero, cuyos créditos quedan bloqueados sin listing que los libere. | `queries.ts:427-432` | Añadir la condición al `UPDATE` y tratar 0 filas como 409. |
| ECO-04 | **Alto** | `acceptOffer` no valida que los listings ofrecidos en trueque estén `published`, sean del comprador y no tengan comprador; `markListingAsSold` pisa `buyer_id`/estado de un tercero. `tradingListingIds` no pasa por Zod. | `models/listings.ts:549-562, 641-645`; `queries.ts:475-480` | `listing_status='published' AND seller_id=$buyer AND buyer_id IS NULL` con `FOR UPDATE`; escribir `listing_trades`. |
| ECO-05 | **Alto** | `cancelListing` sin ruta y, aunque existiera, no deshace trades ni el bloqueo del vendedor. No hay cancelación del comprador después de `accepted`, ni expiración: un loop `accepted` con contraparte inactiva bloquea créditos de por vida. El cliente muestra un botón "Cancelar" sin `onPress` (`ListingButtons.tsx:108-110`). | `models/listings.ts:824-914`; `routes/listings.ts` | `POST /listings/:id/cancel` con reglas por rol; revertir trades y `locked` de ambos lados; job de expiración configurable por comunidad. |
| ECO-06 | **Alto** | Borrar usuario no libera créditos de terceros: elimina sus listings `offered/accepted` (el comprador queda con `locked` huérfano) y republica los que compraba sin devolver `locked` del vendedor. En el path admin, marcar `completed` y borrar no comparten transacción. | `models/self.ts:481-522`; `queries.ts:978-1063`; `models/accountDeletion.ts:120-130` | Antes de borrar: rechazar ofertas recibidas (refund) y cancelar compras en curso con la lógica de ECO-05; una sola transacción. |
| ECO-07 | Medio | Oferta por debajo del precio sin trades nunca puede aceptarse (`TOTAL_PRICE_EXCEEDED`): el comprador puede ofertar `0..price` pero el vendedor no puede aceptar un descuento. Regla implícita y confusa. | `models/listings.ts:604-606` | Decisión de producto: precio fijo (rechazar `offered < price` al ofertar) **o** el vendedor acepta lo ofertado. |
| ECO-08 | Medio | `createListing` no transaccional; no valida categoría, rango de precio (`INVALID_PRICE_FOR_CATEGORY` existe sin uso) ni que los `mediaIds` sean del usuario. `makeOffer`/`donate` admiten decimales sobre columnas INTEGER → 500. | `models/listings.ts:118-178`; `controllers/listings.ts:53-71, 156`; `controllers/users.ts:72` | `transaction: true`; `z.number().int().positive().max()`; validar contra `min/max_price_credits` y `media.uploaded_by`. |
| ECO-09 | Medio | `DELETE /listings/:id` falla con 500 si el listing fue adjuntado a un mensaje (FK compuesta sin `ON DELETE`). Listing imborrable. | `queries.ts:217-221`; `0004:107` | `ON DELETE SET NULL` en `messages.attached_listing_id` o borrado lógico (`disabled` existe sin uso). |
| ECO-10 | Medio | Donación sin mínimo/máximo/límite diario y sin ledger: vía trivial para mover créditos entre cuentas (lavado de recompensas de misión). | `models/users.ts:68-110` | Reglas por comunidad (ver PROD-02) + ledger `donation`. |
| ECO-11 | Medio | Misiones: `completed_at` se pisa en cada progreso; templates inactivos también se asignan; `createMissionTemplate` asigna a todos los usuarios de todas las comunidades con N+1 sin lock; `moveUserToCommunity` borra `user_missions` y no reasigna. | `queries.ts:595`; `helpersDb.ts:641-802`; `admin.ts:687-691, 1029-1084` | `COALESCE(completed_at, …)`; filtrar `active`; `INSERT … SELECT … ON CONFLICT DO NOTHING`; reasignar tras mover. |
| ECO-12 | Bajo | `listing_sold` se emite pero no existe en `NOTIFICATION_TEXTS.LOOP_NOTIFICATION` (push sin título). `getSchoolsByIds` descarta colegios sin media y `getNotificationsByUserId` descarta notificaciones cuyo listing/usuario ya no existe (datos "desaparecen"). Índices: `0005` cubre parte; no se auditó por consulta. | `config.ts:181-206`; `helpersDb.ts:130-137, 523-614` | Agregar texto; devolver `media: null`; snapshot en payload de notificación. |

---

## 5. Infraestructura, delivery y observabilidad (INF)

| ID | Sev | Hallazgo | Evidencia | Fix |
|---|---|---|---|---|
| INF-01 | **Crítico** | Migraciones no ejecutables en producción: la etapa `production` de `Dockerfile.api` copia solo `dist/` e instala `--omit=dev` (sin `tsx`), no copia `server/migrations`; `compose.yml` no tiene servicio `migrate` (el e2e sí). A la vez, la API hace `process.exit(1)` en prod si RLS no está activa → crash-loop en un deploy limpio o con migración nueva. `MIGRACION-COMUNIDADES.md:6-8` reconoce que "nada de esto se ejecutó todavía". | `Dockerfile.api:49-68`; `compose.yml`; `index.ts:120-125` | Compilar `migrate.ts` a `dist/scripts/`, copiar `server/migrations` a la imagen, servicio `migrate` en `compose.yml` con `api.depends_on.migrate.condition: service_completed_successfully`. Documentar el runbook. |
| INF-02 | **Crítico** | Sin CI (`.github/workflows` no existe). Nada ejecuta lint, typecheck, `check-sql`, unit, RLS ni E2E automáticamente. | — | Pipeline mínimo (§5.2). |
| INF-03 | **Alto** | Build raíz roto e inconsistente: `package.json:27` y `scripts/docker-build.js:53` usan `api.Dockerfile` (inexistente) y etiquetan `ezemastro/loop`; `compose.yml` consume `ezemastro/loop-api|web|admin`. El camino real son tres `publish.js` duplicados. `docker-build.js:63-69` commitea `package.json` solo. `server/docker-compose.prod.yml` usa `ezemastro/loop:latest` y expone `5432`. | — | Borrar `build:server`, `docker-build.js`, `docker-push.js`, `server/docker-compose.prod.yml`; un solo script con `docker buildx`. |
| INF-04 | **Alto** | Sin `--platform`/`buildx`: ningún build es multi-arch y el host de deploy es ARM64 *(a confirmar dónde se construyen hoy)*. | `*/publish.js` | `docker buildx build --platform linux/amd64,linux/arm64 --push`. |
| INF-05 | **Alto** | Backups: imagen sin tag, retención 7 días, destino `./backups` en el mismo host, sin cifrado, sin off-site, sin restore documentado ni probado; `./uploads` no se respalda. | `compose.yml:38, 62-78` | Fijar tag; sincronizar `backups/` y `uploads/` a bucket externo; runbook de restore ensayado. |
| INF-06 | **Alto** | Tests del API no verdes ni herméticos: suite `api` de Jest desactualizada (`users.test.ts` sin token → 401; `roles.test.ts` ruta inexistente; `setupAfterEnv.ts` abre pools y `app.listen` reales); `models/self.test.ts` mockea `postgresClient` sin exportar `withClient`/`inCommunity` (rompe); `rls.test.ts` se salta salvo `RUN_DB_TESTS=1`. `client` usa `jest --watchAll` (no termina en CI). `adminClient` sin ningún test. Sin `collectCoverage`. | `server/api/src/tests/*`; `models/self.test.ts:1-8`; `client/package.json:11` | Eliminar/migrar tests obsoletos a `e2e/`; replicar el patrón de `auth.test.ts` en `self.test.ts`; `RUN_DB_TESTS=1` en CI con Postgres; `"test": "jest --ci"`. |
| INF-07 | **Alto** | Vulnerabilidades (`npm audit`, sin `--fix`): raíz 4 high (`concurrently`, `brace-expansion`, `js-yaml`, `shell-quote`); API `sharp` <0.35 high (fix 0.35.4, semver-major); client 53 (2 críticas `tar`, `shell-quote`; `axios` SSRF; `expo`/`metro` con fix solo en Expo 57); `adminClient` no auditable (sin lockfile). | — | Subir `sharp`, `axios`, `concurrently`; lockfile en `adminClient`; planificar Expo 57. |
| INF-08 | Medio | Prod sin healthchecks, sin `depends_on.condition`, sin límites de recursos, sin rotación de logs; imágenes `:latest` + `--pull always` (sin rollback trazable); Node 20 (build) vs 22-alpine (prod) vs 24 (devcontainer), sin `.nvmrc`/`engines`; `npm install` en vez de `npm ci`; `.gitignore:4` excluye el lockfile de la API del repo. | `compose.yml`; `Dockerfile.*`; `.gitignore` | Healthchecks (ya existen en dev/e2e), pins por digest o tag semver, `.nvmrc` 22, `npm ci`, lockfiles versionados. |
| INF-09 | Medio | `Caddyfile:13` → `admin:3002`, pero el contenedor escucha en 80 (`3002:80` es solo mapeo al host) *(a confirmar si Caddy es el proxy activo; el host usa Coolify)*. `proxy-network` externa creada a mano. Dominios hardcodeados. | `Caddyfile`; `compose.yml:80-82` | `admin:80`; documentar red. |
| INF-10 | Medio | Observabilidad nula: solo `console.*`, `morgan` solo en dev, sin request id, sin Sentry/APM, sin métricas, sin uptime/alerting; `/status` no toca la DB. | `middlewares/errors.ts:41, 52`; `index.ts:59-68` | `pino` + request id; Sentry (API + Expo + admin); `/health`; uptime externo. |
| INF-11 | Medio | Env desalineado: `FRONTEND_URL`/`ADMIN_FRONTEND_URL` (CORS prod) no están en ningún `.env.template`; `PORT` vs `API_PORT`; `POSTGRES_PORT` ignorado (`5432` hardcodeado en `migrate.ts:207`, `postgresClient.ts:47`); `server/.env.template` sin `DB_APP_*`/`DB_UNSCOPED_*`. `client/.env` está versionado pese a `.gitignore`. | ver columna | Un solo `.env.template` raíz completo, generado/validado contra el esquema de SEC-01. `git rm --cached client/.env`. |
| INF-12 | Bajo | Docs desfasadas: `AGENTS.md` describe proyectos Playwright `api/admin/fullstack` que ya no existen; `server/README.md` (3 líneas); `TODO.md` mezcla idiomas y tiene ítems cumplidos; SQL sueltos en `server/` (`google_oauth_migration.sql` obsoleto; `create_categories.sql` aplicado solo en e2e; `assignMissionsToAllUsers.sql` sin referencia). Lint raíz roto (`eslint.shared.config.js` importa plugins no instalados en raíz; `--workspace` sin `workspaces`). | — | Limpieza; decidir si se adoptan npm workspaces (resolvería lint, lockfiles y zod desalineado de un golpe). |

### 5.2 Pipeline CI mínimo propuesto

- **Prerrequisitos:** `.nvmrc` (22), `engines`, lockfiles en los 4 paquetes, `npm ci`.
- **lint+typecheck** (matriz api/client/admin): `eslint .`, `tsc --noEmit`, `check-sql-arity.py`.
- **unit:** `server/api` `jest --selectProjects unit`; `client` `jest --ci`.
- **api-integration:** servicio `postgres:16` → `database_creation.sql` + `create_categories.sql` + `npm run migrate` → `RUN_DB_TESTS=1 jest src/tests/rls.test.ts`.
- **e2e:** `bash scripts/run-e2e.sh`.
- **docker:** `buildx --platform linux/amd64,linux/arm64`, push solo en tag `v*`; `npm audit --audit-level=high` informativo.

---

## 6. Cliente Expo (CLI)

| ID | Sev | Hallazgo | Evidencia | Fix |
|---|---|---|---|---|
| CLI-01 | **Crítico** | JWT persistido en `AsyncStorage` (web: `localStorage`) y credential crudo de Google guardado en disco. | `stores/session.ts:96`; `GoogleSignInButton.tsx:76` | `expo-secure-store` como storage de `persist` en nativo; credential de Google solo en memoria. |
| CLI-02 | **Crítico** | `usesCleartextTraffic: true` y permiso `RECORD_AUDIO` sin uso. | `app.json:32, 58` | Eliminar; cleartext solo en perfil dev vía `expo-build-properties`. |
| CLI-03 | **Crítico** | Diez hooks de query devuelven `undefined` en `catch` salvo `AxiosError` → React Query lo trata como éxito y las pantallas hacen `page!.data!` → crash; `useSelf` no dispara logout. | `useSelf`, `useListings`, `useListing`, `useMyListings`, `useMessages`, `useUser`, `useMissions`, `usePublicWishes`, `useChats`, `useUsers`; `screens/Search.tsx:42`, `Messages.tsx:28` | `throw parseApiError(error)` sin condicional (como ya hacen las mutaciones). |
| CLI-04 | **Alto** | Auto-logout ante cualquier 401 (incluidos `/auth/login` incorrecto y endpoints públicos); sin manejo de expiración de token más allá del header oportunista `x-refreshed-token`. | `api/loop.ts:51-66`; `useSelf.ts:36-40` | Solo si el request llevaba `Authorization` y no es `/auth/*`; aviso previo a expiración. |
| CLI-05 | **Alto** | Notificaciones no accionables: el tap solo hace `console.log`; las tarjetas no son presionables. | `contexts/notification.tsx:60-62`; `cards/Notification.tsx` | Mapear `categoryIdentifier`+data → `/listing/[id]`, `/messages/[userId]`. |
| CLI-06 | **Alto** | Módulo demo y `DEMO_PASSWORD = "Demo1234!"` van al bundle de producción (`@/demo` importado incondicionalmente). Si el seed demo existe en prod, la credencial viaja en el bundle *(a confirmar)*. | `api/loop.ts:3`; `stores/session.ts:7`; `shared/demo-data/buildCommunity.ts:139` | `require` condicional por `EXPO_PUBLIC_DEMO_MODE` o entrada separada. |
| CLI-07 | **Alto** | Query key inconsistente al editar listing: invalida `["listing", {listingId}]` pero el hook usa `["listing", id]`; funciona por accidente (`router.back()` remonta). `withCredentials: true` innecesario. `FILE_BASE_URL` concatena `undefined`; `console.log` en cada arranque. | `ModifyListing.tsx:130-132`; `useListing.ts:22`; `api/loop.ts:8`; `config.ts:43-45` | Unificar keys; quitar `withCredentials`; fallar en build si falta `EXPO_PUBLIC_API_URL`. |
| CLI-08 | Medio | Polling: chat cada 5 s sobre `useInfiniteQuery` (refetchea **todas** las páginas cargadas); badges cada 30 s. `CustomRefresh` invalida todo lo activo y nunca muestra spinner. | `useMessages.ts:31`; `useUnread*.ts:13`; `CustomRefresh.tsx:11-15` | Endpoint "since" con `useQuery`; pausar sin foco; a mediano plazo SSE/WebSocket. |
| CLI-09 | Medio | Pantalla `/debug` pública en prod (muestra `API_URL`, fetches libres). Service worker cache-first sobre todo GET `basic` (si web y API compartieran origen, cachearía `/me`). `Alert.alert` en rutas web (no-op en RN-web): el usuario no ve nada en `ReportButton`, `AllowedDomainsNotice`, `useMailComposer`. | `app/_layout.tsx:93`; `public/sw.js:22-38`; `ReportButton.tsx:84` | Proteger `/debug`; excluir `/api` del SW; abstracción `showAlert` cross-platform. |
| CLI-10 | Medio | Dependencias: `expo-auth-session`/`expo-clipboard` de SDK 55 sobre Expo 54; `react-test-renderer` 19.0 vs React 19.1; `@gorhom/bottom-sheet` y `react-native-modal` sin uso; `zustand` 4 (v5 disponible); zod 4.1.5 vs 4.0.17 (API) vs 4.3.5 (admin); `forceCodeForRefreshToken` deprecado. | `client/package.json`; `services/googleOauth.ts:15` | Alinear al SDK; podar; alinear zod en los tres paquetes. |
| CLI-11 | Medio | `Home` renderiza el feed completo sin virtualización (`Feed.tsx` mapea todo dentro de un `View`); `sections` recreado por render; clase literal `"false"` inyectada; hijos comunican "tengo datos" vía `setState` del padre. `useInfiniteQuery` en endpoints no paginados. `setNotificationHandler` a nivel de módulo. `Dimensions.get` estático en `ImagesSelector`. `createObjectURL` sin revoke. Permisos de imagen pedidos dos veces. 38 non-null assertions; `any` en `useMessages` y `ResourceSelectorModal`. | `Home.tsx:19-73`; `Feed.tsx:29-35`; ver ANALYSIS 2.x | Virtualizar el grid; derivar `show` de los hooks; limpieza. |
| CLI-12 | Medio | Tests: `jest --watchAll` no termina en CI; los 7 archivos son guardias por regex sobre el código fuente y funciones puras; cero tests de hooks, stores, interceptores, demo adapter o pantallas; sin `@testing-library/react-native`. | `client/__tests__/*`; `package.json:11` | `"test": "jest --ci"`; empezar por `api/loop.ts`, `stores/session.ts`, `demo/router.ts`. |
| CLI-13 | Bajo | Accesibilidad casi nula (2 de 133 `.tsx` con `accessibilityLabel`; sin `maxFontSizeMultiplier`). Sin `<title>` por ruta en web. Registro mezclado ("Ingrese" / "Escribí"). TODOs y código comentado; assets huérfanos (`SpaceMono-Regular.ttf`, `ChatGPT Image Aug 30….png`). `"[object Object]"` en `registerPushNotifications.ts:32`; división por cero en `cards/Mission.tsx:30`. `eas.json` con IP LAN y dominio `duckdns`. Contraseña mínima 6 (`validations.ts:22`). `orientation: portrait` en una PWA de escritorio. | — | Limpieza incremental. |

---

## 7. Panel de administración y landing (ADM)

### 7.1 Capacidades para operar múltiples comunidades

| Capacidad | Estado |
|---|---|
| Crear/editar comunidad (nombre, slug, logo, tema, dominios, activa) | ✅ Existe |
| Eliminar comunidad | ❌ Falta |
| Métricas por comunidad | ⚠️ Tarjetas básicas; el Dashboard no filtra por comunidad aunque la API lo admite |
| Colegios: crear/editar | ✅ · eliminar / paginar (`Schools.tsx:54` solo página 1) ❌ |
| Usuarios: listar/buscar, créditos, reset password | ✅ |
| Usuarios: detalle, editar, deshabilitar/banear, eliminar, mover de comunidad (API existe, UI no) | ❌ |
| Usuarios: columna/filtro de comunidad para super admin | ❌ |
| Créditos con auditoría (motivo, qué admin) | ⚠️ Se registra la transacción, sin `meta` ni `admin_id` |
| Categorías / misiones por comunidad | ❌ (por diseño: catálogo global) · eliminar ❌ |
| Notificación a un usuario | ✅ · masiva (comunidad/colegio) e historial ❌ |
| Solicitudes de borrado | ✅ |
| Invitaciones | ✅ (sin paginación) |
| Autorizar admin | ⚠️ Roto para super admin (ADM-02) |
| Listar admins, revocar, ver allowlist, promover | ❌ |
| Logout real (invalidar cookie) | ❌ |
| Bloqueo/reporte/moderación de contenido | ❌ (no existe en ninguna capa: `rg block|report|moderat` vacío en `server/api/src`) |

### 7.2 Hallazgos

| ID | Sev | Hallazgo | Evidencia | Fix |
|---|---|---|---|---|
| ADM-01 | **Crítico** | Sin política de privacidad pública ni formulario público de borrado de cuenta (la landing Astro se eliminó en `b1bd13f`). `POST /me/delete-request` quedó sin consumidor. Requisito de App Store / Play; con menores, requisito legal. Términos hardcodean "La Red Itinere" (`Terms.tsx:37, 76`) y la aceptación se guarda solo en el cliente (sin trazabilidad). | `git show b1bd13f`; `index.ts:72`; `client/components/screens/Terms.tsx` | Rutas web públicas `/privacidad`, `/terminos`, `/borrar-cuenta` (en el cliente Expo web o landing mínima); enlazar desde `app.json` y tiendas; persistir `terms_accepted_at` por usuario; términos con nombre de comunidad dinámico. |
| ADM-02 | **Alto** | El super admin no puede autorizar admins: `AuthorizeAdmin.tsx:27` no envía `role` ni `communityId` → backend lanza `COMMUNITY_REQUIRED`. Muestra `err.response.data.error` crudo. | `AuthorizeAdmin.tsx:27, 37`; `controllers/admin.ts:31-35, 140-153` | Selector de rol (solo super admin) + `CommunityFilter allowAll=false`; `getErrorMessage`. |
| ADM-03 | **Alto** | Paginación de usuarios rota: UI calcula `total / 20`, API pagina de a 10 → la mitad de los usuarios es inalcanzable. | `Users.tsx:33`; `config.ts:156` | Exponer `pageSize` en la respuesta o en tipo compartido. |
| ADM-04 | **Alto** | Seis modales legacy con `bg-black bg-opacity-50` (eliminado en Tailwind v4) → fondo negro opaco. | `ModifyCreditsModal.tsx:77`, `ResetPasswordModal.tsx:81`, `CreateSchoolModal.tsx:139`, `EditSchoolModal.tsx:146`, `CategoryFormModal.tsx:150`, `MissionFormModal.tsx:119` | Migrar al `ui/Modal` existente (`bg-black/50`). |
| ADM-05 | **Alto** | Logos de comunidad rotos: la API devuelve nombre de archivo y las comunidades lo usan como `src` sin `getUrl` (los colegios sí lo hacen). *(a confirmar en runtime)* | `Communities.tsx:110`; `CommunityFormModal.tsx:89, 109, 217` | `getUrl(...)`. |
| ADM-06 | **Alto** | Sesión: sin `POST /admin/logout` (la cookie httpOnly sigue válida 30 min tras "salir"), sin interceptor 401 (la cookie expira y el panel queda "logueado" fallando en silencio). | `api/loop.ts`; `Layout.tsx:13-21`; `Aside.tsx:45-48` | Endpoint de logout que borre la cookie; interceptor 401 → `logout()` + `/login`. |
| ADM-07 | **Alto** | Ningún test del admin (unit ni E2E; `e2e/README.md:105` documenta que se borraron). | — | Al menos smoke E2E de login + comunidades + usuarios. |
| ADM-08 | Medio | Auditoría de créditos incompleta (sin motivo ni `admin_id`). Acciones destructivas sin confirmación (revocar invitación, quitar dominio, rechazar solicitud). PII persistida en `localStorage` (`session.ts:33-37`). `console.log` de usuarios con PII (`Users.tsx:27`) y de `API_URL`. | ver columna | Campo motivo obligatorio + `admin_id`; confirmaciones; `partialize` a `isLoggedIn`/`role`/`communityId`. |
| ADM-09 | Medio | Dos sistemas de UI conviven (`ui/` nuevo vs Tailwind inline legacy con paleta distinta y manejo de error duplicado en 8 archivos). Sin responsive (`Aside` `w-60` fijo). Dashboard muestra claves crudas de `global_stats`. Sin 404. | `Aside.tsx:58`; `Dashboard.tsx:33-63`; `main.tsx:65` | Terminar la migración a `ui/`; layout colapsable; dashboard con métricas de negocio por comunidad. |
| ADM-10 | Bajo | `adminClient/.gitignore` excluye `package-lock.json`; `@types/axios` y `@types/react-router@5` innecesarios; sin `build.rollupOptions`; React Compiler sobre rolldown-vite sin verificar *(a confirmar con un build)*. DOM directo en `Login`/`Register`; `Register` navega a `/`; `Home` monta `GoogleLoginButton` sin `onError`; `publish.js:14` relativo al CWD; `icon` en formData sin input; `index.html` con `lang="en"` y favicon de Vite; README plantilla; 27 `<label>` sin `htmlFor`; emojis en navegación (decisión registrada, pero rompe neutralidad de marca). | — | Limpieza incremental. |

### 7.3 Landing

Hoy la "landing" es la pantalla pre-login del cliente Expo web (`client/components/screens/Landing.tsx`): pitch exclusivamente escolar ("útiles del colegio", "correo institucional", "un colegio más sostenible"), sin CTA "quiero Loop en mi comunidad", sin SEO (SPA estática sin `+html.tsx`, meta, OG ni sitemap), sin páginas legales por URL. `Caddyfile` solo enruta `loop.`, `api.` y `admin.reditinere.com`; el dominio de landing de `TODO.md:30` no está configurado. → ver PROD-06.

---

## 8. Producto: de "app de una red educativa" a "app para cualquier comunidad" (PROD)

### 8.1 Acoplamiento a la red original (inventario)

| Dónde | Qué |
|---|---|
| Modelo | `schools` obligatorio en registro (`validations.ts:223, 452`), en `moveUserToCommunity` y en el cliente (`SchoolSelection.tsx:75`); `schools.media_id NOT NULL` (logo obligatorio). |
| Datos sembrados | `0001_communities.sql` siembra `red-itinere` y sus dominios en **cualquier** instalación; `database_creation.sql:160` correo personal en `admin_valid_emails`; timezone `America/Argentina/Buenos_Aires`. `VALID_EMAIL_DOMAINS` con 6 dominios de Itinere sigue como código muerto (`config.ts:158-167`). |
| Config | `EMAIL_FROM = noreply@loop.reditinere.com` (`config.ts:39-42`); color fijo `#16a34a` en mails (`auth.ts:208`, `email.ts:53`); `CONTACT_EMAIL = loop@reditinere.com` (`client/config.ts:56`); `com.reditinere.loop` (`app.json:18, 29`); `eas.json` con `loopreditinere.duckdns.org`. |
| Copy | API: `ERROR_MESSAGES`, `NOTIFICATION_TEXTS`, push en rioplatense ("Revisá", "loopies", "equipo de Loop"). Cliente: "Colegios:", "Seleccionar escuela", "Buscar artículos escolares…", "correo institucional que te dio tu colegio", filtro "Escuela", `app.json:40`/`manifest.json:4` "Marketplace escolar - comprá y vendé entre alumnos". Términos: "La Red Itinere". Admin: "créditos"/"loopies" mezclados (17 ocurrencias). |
| Comportamiento | Stats ambientales (kg residuos / CO2 / agua) siempre activas y sumadas por colegio; Gmail asumido para contacto en web (`emailComposer.ts:15-18`); header con logo Loop estático aunque `Community.media` exista. |
| Catálogos | Categorías y misiones globales, iguales para toda comunidad; sin override. |

### 8.2 Gaps de producto

**Necesario para que una segunda comunidad (no escolar) pueda usar Loop:**

| ID | Gap | Notas |
|---|---|---|
| PROD-01 | **Sub-grupos opcionales y renombrables.** "Escuela" pasa a ser un `group` genérico (etiqueta configurable: colegio, barrio, sector, sede), opcional por comunidad, con logo opcional. | Toca registro, `moveUserToCommunity`, filtros de búsqueda, stats, admin. Es el cambio de modelo más grande y conviene hacerlo antes de sumar comunidades. |
| PROD-02 | **Economía configurable por comunidad** en `communities.meta` (o tabla `community_settings`): créditos iniciales, recompensas, nombre de la moneda, límites de donación, política de precio (ECO-07), expiración de loops (ECO-05), stats ambientales on/off. | Hoy `INITIAL_CREDITS` es inerte y `meta` está vacío. Depende de ECO-01/02 para ser confiable. |
| PROD-03 | **Catálogos por comunidad**: categorías y misiones con `community_id` nullable (NULL = global) y override; misiones con `event_type`/`target` en vez de derivar de la `key`; respetar `active`. | ECO-11. |
| PROD-04 | **Convivencia y moderación**: bloquear usuario, reportar listing/usuario/mensaje, ocultar listing (`disabled` existe sin uso), suspender usuario desde admin, cola de moderación. | Hoy no existe nada. Imprescindible con menores y con comunidades abiertas (municipio). |
| PROD-05 | **Legal**: privacidad/términos por URL pública, aceptación persistida con fecha y versión, borrado de cuenta público, tratamiento de menores (consentimiento, edad mínima), export "mis datos". | ADM-01. |
| PROD-06 | **Landing y alta de comunidades**: pitch neutral con casos (red educativa / barrio / municipio / club / empresa), CTA "quiero Loop en mi comunidad" → formulario o `invitations` de tipo comunidad; SEO básico. | Hoy el único alta es por dominio o invitación de usuario. |
| PROD-07 | **Externalizar marca y copy**: remitente y color de mails por comunidad, `CONTACT_EMAIL` por comunidad, logo de comunidad en header, vocabulario centralizado (`copy.ts` por dominio en API y cliente) preparando i18n. | Sin traducir todavía; primero centralizar. |
| PROD-08 | **Onboarding de una comunidad nueva sin SQL**: hoy es crear comunidad + dominios (admin ✅) + colegios con logo (admin ✅) + categorías/misiones globales (super admin) + autorizar admin (roto, ADM-02) + seed manual de `create_categories.sql`. Debería ser un asistente en el admin. | Depende de ADM-02 y PROD-03. |
| PROD-09 | **Recuperación de contraseña** y **cambio de email** (mueve de comunidad por dominio). | SEC-11; diferido en `loop-settings`. |
| PROD-10 | **Historial de movimientos** en la app y en admin (requiere ECO-02). | |

**Deseable (después):**

- Estado "entregado" por el vendedor + ventana de expiración de `accepted` + disputa antes de `received`.
- Preferencias de notificación por usuario (gate del push token), preferencias de email, privacidad de perfil, lista de bloqueados (ya relevado en `loop-settings`).
- Notificaciones masivas por comunidad/colegio con historial (admin).
- Chat con tabla de hilo propia (borrar, silenciar, adjuntos múltiples) y transporte en tiempo real (SSE/WebSocket) en lugar de polling.
- Analytics por comunidad (usuarios activos, loops cerrados, tiempo a cierre) en dashboard.
- i18n real (es/en/pt) una vez centralizado el copy.
- `updated_at` por trigger, `deleted_at` para soft delete de users/listings.
- Feature flags por comunidad (stats ambientales, trueques, donaciones, misiones).
- Facturación/planes si se ofrece como servicio.

---

## 9. Hoja de ruta propuesta

Cada bloque está pensado como uno o pocos cambios SDD. Orden por relación riesgo/esfuerzo; dentro de cada fase el orden es sugerido.

### Fase 0 — Cerrar agujeros (1 semana, cambios chicos e independientes)

1. **SEC-01 + SEC-02 + INF-11** — validación de entorno con Zod al arrancar, `ADMIN_JWT_SECRET`, `.env.template` completo.
2. **ECO-03** — `newOffer` con `listing_status='published' AND buyer_id IS NULL` → 409.
3. **ECO-01 (parte DB)** — migración `CHECK (credits_balance >= 0 AND credits_locked >= 0)` + `UNIQUE (lower(email))` (SEC-05). *La app deja de poder corromper saldos aunque el código siga igual.*
4. **SEC-03** — `express-rate-limit` + `helmet` + respuesta uniforme de login + mínimo 8 caracteres.
5. **CLI-02 + CLI-03 + CLI-07** — `app.json`, `throw parseApiError` en los 10 hooks, quitar `withCredentials`, unificar query keys.
6. **ADM-02 + ADM-03 + ADM-04 + ADM-05** — cuatro bugs de una tarde en el admin.
7. **SEC-07 + SEC-12 + SEC-15** — Zod en endpoints admin, `await` en push, `StepRequired` → 400, `/health`.
8. **INF-07 (parcial)** — subir `sharp`, `axios`, `concurrently`; lockfile en `adminClient`.

### Fase 1 — Poder desplegar con confianza (1–2 semanas)

1. **INF-01** — migraciones en la imagen + servicio `migrate` + runbook.
2. **INF-03 + INF-04** — un solo script de build con `buildx` multi-arch; borrar scripts muertos.
3. **INF-06** — tests del API verdes y herméticos; `rls.test.ts` corriendo; `jest --ci` en client.
4. **INF-02** — CI mínimo (§5.2).
5. **INF-05** — backups con `uploads/`, off-site, restore ensayado.
6. **INF-10** — `pino` + request id + Sentry + `/health` + uptime.
7. **INF-08** — healthchecks, pins, `.nvmrc`, `npm ci`.

### Fase 2 — Integridad de la economía (2 semanas, un solo cambio SDD grande)

1. **ECO-01 + ECO-02** — updates relativos / `FOR UPDATE`, ledger en cada mutación, `balance_after`, job de reconciliación, test de concurrencia.
2. **ECO-04 + ECO-05 + ECO-06** — trades validados y persistidos, `POST /listings/:id/cancel`, borrado de usuario que libera créditos de terceros.
3. **ECO-07** (decisión de producto) + **ECO-08 + ECO-09 + ECO-10**.
4. **PROD-10** — pantalla "mis movimientos".

### Fase 3 — Legal y publicable (1 semana)

1. **ADM-01 / PROD-05** — rutas públicas de privacidad, términos y borrado; aceptación persistida; términos con comunidad dinámica.
2. **CLI-01 + CLI-06 + CLI-09** — SecureStore, demo fuera del bundle, `/debug` protegido, SW sin `/api`.
3. **SEC-10 + SEC-11 + SEC-06** — verificación con hash+expiración, olvidé mi contraseña, cambio de contraseña seguro.
4. **ADM-06** — logout real + interceptor 401.

### Fase 4 — Multi-comunidad real (3–4 semanas, varios SDD)

1. **PROD-01** — grupos opcionales/renombrables (modelo + registro + cliente + admin).
2. **PROD-02 + PROD-03** — `community_settings` + catálogos por comunidad; quitar seed de `red-itinere` de `0001`.
3. **PROD-07** — centralizar copy y marca; `CONTACT_EMAIL`/`EMAIL_FROM` por comunidad; logo de comunidad en header.
4. **PROD-04** — bloqueo, reporte, ocultar, suspender + cola en admin.
5. **PROD-08** — asistente de alta de comunidad en admin; gestión de admins (listar/revocar/promover).
6. **PROD-06** — landing neutral con CTA y SEO.

### Fase 5 — Calidad sostenida (continuo)

- CLI-05, CLI-08, CLI-11, CLI-12, CLI-13; ADM-07, ADM-08, ADM-09, ADM-10; INF-12; SEC-08, SEC-09, SEC-13, SEC-16; ECO-11, ECO-12.
- Decidir npm workspaces (cierra lint raíz, lockfiles, zod desalineado, `publish.js` ×3).
- Expo 57 cuando esté estable (cierra la mayoría de INF-07 en client).

---

## 10. Registro de avance

| Fecha | IDs cerrados | Commit / cambio SDD | Notas |
|---|---|---|---|
| 2026-09-01 | — | — | Auditoría inicial. |

---

## 11. Anexo: estado de `ANALYSIS.md` (junio 2026)

Resumen por sección (detalle completo en los informes de cada área; este documento los absorbe):

| Sección | Resueltos | Pendientes / parciales | Notas |
|---|---|---|---|
| 1.x API | 1.10, 1.12, 1.16 | 1.1–1.9, 1.11, 1.13–1.15, 1.19, 1.20 (parcial) | "StepRequired → 400" figuraba como resuelto y **no lo está** (`errors.ts:45`). |
| 2.x Client | 2.1, 2.7, 2.17, 2.21, 2.24, 2.38 | 2.2–2.6, 2.8–2.10, 2.13–2.16, 2.18–2.20, 2.22, 2.23, 2.25–2.37 | 2.11 no reproducido; 2.12 no aplica. |
| 3.x Admin | 3.1 (Login), 3.2 (Login), 3.3, 3.4, 3.11, 3.16, 3.26 | 3.5 (agravado: ADM-03), 3.6–3.9, 3.12, 3.15, 3.17–3.25 | 3.10 se mantiene por decisión; 3.13 no aplica; 3.14 sin verificar. |
| 4.x Docker | 4.4, 4.7 (en `compose.yml`), 4.8 | 4.1, 4.2, 4.3, 4.5, 4.6, 4.9, 4.10 | |
| 5.x Shared | 5.1, 5.4 (parcial) | 5.2, 5.3, 5.6 | 5.5 sin verificar. |

`ANALYSIS.md` y `TODO.md` quedan como referencia histórica; este documento es la fuente de verdad a partir de ahora.
