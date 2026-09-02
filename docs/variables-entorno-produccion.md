# Variables de entorno de producción

Referencia autoritativa de las variables que necesita el stack de producción (`compose.yml`).

**Por qué existe este documento.** El `.env.template` de la raíz (y `server/.env.template`) están
desactualizados: no incluyen las variables que `sec-hardening-api` volvió obligatorias, y siguen
listando nombres que el código ya no lee (`API_PORT` como puerto del contenedor, `DB_PASSWORD` como
fallback de las credenciales de la app). `TESTING-MANUAL.md` (secciones 7 de los bloques A y G) deja
constancia de que esos archivos no se pudieron editar en la sesión que introdujo los cambios.

Hasta que alguien actualice `.env.template` con el bloque de la sección 5 de este documento, **esta
página es la lista autoritativa**. La fuente de verdad del código es
[`server/api/src/env.ts`](../server/api/src/env.ts) (esquema Zod: defaults y chequeo estricto de
producción) más [`server/api/src/config.ts`](../server/api/src/config.ts) (las que se leen directo
de `process.env` sin pasar por el esquema).

En este documento **nunca** hay valores reales. Donde dice `<generar: ...>` hay que generar el valor
en el host y no versionarlo.

---

## 1. Cómo aborta la API si falta algo

`server/api/src/index.ts:37` llama a `assertProductionEnv()` de forma síncrona, antes de
`app.listen`. Con `NODE_ENV=production`, esa función valida `strictSchema` y, si falla, imprime
**todas** las variables faltantes o inválidas de una sola vez y hace `process.exit(1)`.

Consecuencias prácticas:

- No hace falta reiniciar variable por variable: el primer arranque fallido lista todo lo que falta.
- Fuera de producción no valida nada: el esquema permisivo tiene un default de desarrollo para cada
  variable, así que un `.env` incompleto en local arranca igual (con un `console.warn` por variable
  que cayó al default).
- El chequeo vive en el entrypoint, no en `config.ts`, a propósito: `scripts/migrate.ts` y
  `scripts/seed.ts` importan `config.ts` y corren con otro juego de variables, y no deben abortar
  solo por importarlo.

Además del "falta la variable", `strictSchema` rechaza en producción:

1. **Valores centinela de desarrollo.** Copiar el valor de dev al `.env` de producción se trata
   exactamente igual que no setearla. Los siete centinelas prohibidos son los de `DEV_SENTINELS`
   (`env.ts:19-27`): `jwt_secret_dev_only`, `admin_jwt_secret_dev_only`, `admin_pass_token_dev_only`,
   `loop_app_dev`, `loop_unscoped_dev`, `web-google-client-id-dev`, `admin-google-client-id-dev`.
2. **`RATE_LIMIT_ENABLED=false`.** En producción el rate limiting no se puede apagar; el proceso
   aborta si se intenta.

---

## 2. Obligatorias en producción — la API no arranca sin ellas

Son las nueve que `strictSchema` (`env.ts:115-127`) redeclara **sin default**.

| Variable | Para qué sirve | Cómo generar / elegir el valor | Qué falla si falta |
|---|---|---|---|
| `JWT_SECRET` | Firma y verifica los JWT de sesión de usuario. | `openssl rand -hex 32` | Sin el chequeo estricto arrancaría con el default público `jwt_secret_dev_only` y cualquiera que lea el repo puede forjar un token de cualquier usuario. Hoy: `process.exit(1)` al arrancar. |
| `ADMIN_JWT_SECRET` | Firma los JWT del panel de admin. Es un secreto **distinto** de `JWT_SECRET`: no reutilizarlo. | `openssl rand -hex 32` | `process.exit(1)`. Ojo con el deploy: al ser una clave nueva, **todas las sesiones de admin activas se cierran** la primera vez que se setea. |
| `ADMIN_PASS_TOKEN` | Token de paso que habilita el login del panel de admin (`config.ts:39`). | `openssl rand -hex 32` | `process.exit(1)`. Con el centinela de dev, el acceso al panel queda abierto a quien conozca el valor público. |
| `DB_APP_PASSWORD` | Contraseña del rol `loop_app` (el rol sujeto a RLS, el que atiende todo el tráfico de usuarios). | `openssl rand -base64 32` | `process.exit(1)` en la API. Además, la migración `0007_db_roles_and_rls.sql` hace `RAISE` y aborta el deploy si llega vacía, así que también rompe el servicio `migrate`. |
| `DB_UNSCOPED_PASSWORD` | Contraseña del rol `loop_app_unscoped` (`BYPASSRLS`, solo para login, resolución de comunidad por dominio y panel de admin). | `openssl rand -base64 32` | Igual que la anterior: `process.exit(1)` en la API y `RAISE` en la migración `0007`. |
| `FRONTEND_URL` | Origen permitido por CORS para la web de usuarios; base de los links de invitación cuando no hay `APP_BASE_URL`. | La URL pública real, con esquema: `https://loop.tu-dominio.com` | `process.exit(1)`. Si el valor es una URL mal formada, el error de Zod la nombra. |
| `ADMIN_FRONTEND_URL` | Origen permitido por CORS para el panel de admin. | `https://admin.tu-dominio.com` | `process.exit(1)`. Si queda mal, el panel recibe error de CORS en cada request. |
| `WEB_GOOGLE_CLIENT_ID` | `aud` esperado al verificar el ID token de Google del login web. | Client ID OAuth de tipo *Web application* en Google Cloud Console. Formato `<numero>-<hash>.apps.googleusercontent.com`. | `process.exit(1)`. Es la vulnerabilidad concreta que este chequeo cierra: sin client ID el login de Google **no valida el `aud`**, y un token emitido para otra app se acepta. |
| `ADMIN_GOOGLE_CLIENT_ID` | `aud` esperado al verificar el ID token de Google del panel de admin. | Otro Client ID OAuth *Web application* (el del panel). | Igual que el anterior, pero sobre el panel de admin. |

### 2.1 Obligatorias de hecho, pero que el esquema **no** valida

Están declaradas como `.optional()` en `env.ts`, así que la API arranca sin ellas y falla más tarde,
al primer acceso a la base. Hay que setearlas igual.

| Variable | Para qué sirve | Cómo elegir el valor | Qué falla si falta |
|---|---|---|---|
| `POSTGRES_USER` | Dueño de las tablas y superusuario de Postgres. Lo usan el servicio `db`, el runner de `migrate` (necesita DDL) y el servicio `backup`. La API **no** consulta con este rol. | Nombre de rol, p. ej. `loop_owner`. | El contenedor `db` no inicializa, el healthcheck `pg_isready -U ${POSTGRES_USER}` nunca pasa y `api` nunca arranca (depende de `service_healthy`). |
| `POSTGRES_PASSWORD` | Contraseña del rol dueño. | `openssl rand -base64 32` | Igual que la anterior. Ya **no** funciona como fallback de `DB_APP_PASSWORD` / `DB_UNSCOPED_PASSWORD`: ese fallback se eliminó a propósito. |
| `POSTGRES_DB` | Nombre de la base. Lo consume `config.ts:29` (`DB_NAME`) y el pool de la API. | `loop` | La API arranca (pasa el chequeo estricto) y después falla al conectar, porque el pool no tiene database. Es el peor modo de falla de la lista: no lo cubre el abort temprano. |

> **Discrepancia registrada.** `TESTING-MANUAL.md` sección 0 del bloque A enumera ocho variables
> "nuevas obligatorias" y omite `JWT_SECRET`, que sí está en `strictSchema`. El total real es **nueve**
> (el propio comentario de `env.ts:13` dice "los nueve secretos/URLs de producción"). Y ni el manual
> ni el esquema exigen `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, que en la práctica son
> igual de necesarias.

---

## 3. Opcionales con default

Si no se setean, el esquema aplica el default de la columna. En producción conviene setear
explícitamente las marcadas con ⚠️, porque su default es un valor de desarrollo que **no** está en la
lista de centinelas y por lo tanto pasa el chequeo estricto sin quejarse.

| Variable | Default | Para qué sirve |
|---|---|---|
| `NODE_ENV` | `development` | `compose.yml` ya la fija en `production` para el servicio `api`. Sin `production` **no corre ninguna validación estricta**. |
| `PORT` | `3000` | Puerto en el que escucha la API dentro del contenedor. |
| `POSTGRES_PORT` | `5432` | Puerto de Postgres. Antes estaba hardcodeado en tres lugares; ahora sale del esquema. |
| `PGHOST` | `db` | Host de Postgres. En `compose.yml` es el nombre del servicio. |
| `DB_APP_USER` | `loop_app` | Rol de aplicación sujeto a RLS. |
| `DB_UNSCOPED_USER` | `loop_app_unscoped` | Rol con `BYPASSRLS`. |
| `TOKEN_EXP` | `2592000` (30 días, en **segundos**) | Vida del JWT de usuario. |
| `ADMIN_TOKEN_EXP` | `1800` (30 min, en **segundos**) | Vida del JWT de admin. |
| `UPLOAD_DIR` | `/uploads` | Directorio de archivos subidos dentro del contenedor (montado desde `./uploads`). |
| ⚠️ `BASE_URL` | `http://localhost:3000` | Base con la que se arman las URLs públicas de los archivos subidos. **El default es localhost y no es un centinela**: un deploy que la omita pasa la validación y sirve URLs de imágenes rotas. Setearla siempre. |
| `RATE_LIMIT_ENABLED` | `true` | Solo acepta `"true"` o `"false"` (no `z.coerce.boolean()`, porque `Boolean("false")` da `true`). En producción, `false` aborta el arranque. |
| `API_IMAGE_TAG` | `1.0.0` | Tag de la imagen `ezemastro/loop-api`. Se cambia para hacer rollback (ver `runbook-deploy.md` §4). |
| `WEB_IMAGE_TAG` | `1.2.0` | Tag de `ezemastro/loop-web`. |
| `ADMIN_IMAGE_TAG` | `0.3.0` | Tag de `ezemastro/loop-admin`. |
| `LOG_LEVEL` | `info` | Nivel mínimo del logger (`pino`, runtime-observability/INF-10). Uno de `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. |

> ⚠️ **`FRONTEND_URL` y `ADMIN_FRONTEND_URL` tampoco tienen centinela.** Son obligatorias (sección 2),
> pero el chequeo solo valida que sean URLs bien formadas. Un `.env` de producción que quedó con
> `http://localhost:8081` pasa la validación sin decir nada y deja el CORS apuntando a localhost.

### Opcionales sin default (features específicas)

| Variable | Default efectivo | Cuándo hace falta |
|---|---|---|
| `APP_BASE_URL` | cae a `FRONTEND_URL` | URL pública de la app usada en los links de invitación. |
| `ANDROID_GOOGLE_CLIENT_ID` | sin valor | Solo si se publica la app Android con login de Google. `googleOauth.ts` filtra los vacíos. |
| `IOS_GOOGLE_CLIENT_ID` | sin valor | Ídem para iOS. |
| `RESEND_API_KEY` | sin valor | Proveedor de mail transaccional. Sin ella no se envían mails de verificación ni de reseteo de contraseña. |
| `REQUIRE_EMAIL_VERIFICATION` | se deduce de `RESEND_API_KEY` | `"true"`/`"false"`. Si se pone en `true` sin Resend, el link de verificación queda en el log de la API. |
| `EMAIL_DEBUG_LINKS` | `false` en producción, `true` fuera | Si el link de verificación (con el token en claro) se loguea. **En producción dejarla sin setear**: loguearlo es filtrar una credencial de toma de cuenta. |
| `AUTHORIZED_ADMIN_EMAIL` | sin valor | Email autorizado a crear el primer admin. |
| `SALT_ROUNDS` | `10` | Costo de bcrypt. Se lee directo de `process.env` en `services/hash.ts`, fuera del esquema. |
| `MIGRATIONS_DIR` | autodetectado | Solo el servicio `migrate`; `compose.yml` la fija en `/app/migrations`. |
| `SENTRY_DSN` | sin valor | Reporte de errores (runtime-observability/INF-10). **Inerte por diseño**: sin setear, el SDK de Sentry no se inicializa y no sale ningún request de red. Habilitarlo es cambiar esta variable, nunca código. |

### Firma de URLs de media (fuera del esquema Zod)

Se leen directo de `process.env` en `config.ts:292-299`. Hoy la firma viene **apagada** por defecto.

| Variable | Default | Notas |
|---|---|---|
| `MEDIA_URL_SIGNING_ENABLED` | `false` | Solo `"true"` la enciende. Encenderla en un ambiente de prueba antes que en producción. |
| `MEDIA_SIGNING_SECRET` | `""` | **Obligatoria si el flag anterior es `true`, pero nadie lo valida**: con el flag en `true` y el secreto vacío, las URLs se firman con clave vacía y la firma es trivialmente falsificable. |
| `MEDIA_SIGNING_SECRET_PREVIOUS` | `""` | Solo durante una rotación: se acepta para que las URLs ya emitidas sigan verificando. |
| `MEDIA_URL_TTL_SECONDS` | `86400` | Validez de una URL firmada. |
| `MEDIA_URL_BUCKET_SECONDS` | `3600` | Ventana de redondeo del `exp`, para que la misma URL sea cacheable. |

### Límites de donación (fuera del esquema Zod)

| Variable | Default |
|---|---|
| `DONATION_MIN_CREDITS` | `1` |
| `DONATION_MAX_CREDITS` | `100000` |
| `DONATION_DAILY_MAX_CREDITS` | `200000` |

---

## 4. Variables de **build**, no de runtime

No van en el `.env` que consume `api`: son `ARG`/`ENV` de los Dockerfiles de los clientes y quedan
horneadas en el bundle. Cambiarlas exige rebuildear la imagen.

| Variable | Dónde | Obligatoria |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `Dockerfile.web` | **Sí.** `client/config.ts` la exige con `requireEnv` y tira al cargar el módulo si falta. |
| `EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID` | `Dockerfile.web` | Sí, para el login de Google en web. |
| `EXPO_PUBLIC_LEGAL_BASE_URL` | build del cliente | No; default `https://loop.reditinere.com`. Base de `/privacidad`, `/terminos` y `/borrar-cuenta`. |
| `EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID` / `EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID` | build móvil | Solo para los builds nativos. |
| `EXPO_PUBLIC_REPORT_EMAIL` | build del cliente | Opcional. |
| `EXPO_PUBLIC_DEMO_MODE` | build del cliente | Opcional; `"true"` activa el modo demo con datos simulados. |
| `VITE_API_URL` | `Dockerfile.admin` | Sí, para el panel. |
| `VITE_GOOGLE_CLIENT_ID` | `Dockerfile.admin` | Sí, para el login del panel. |

---

## 5. Plantilla completa para pegar

Este bloque es el cuerpo que hay que pegar en `.env.template` de la raíz (y, con valores reales, en
el `.env` del host). Después de hacerlo, borrar `server/.env.template`, que queda reemplazado.

```dotenv
# ─────────────────────────────────────────────────────────────────────────────
# Loop — variables de entorno de producción
# Fuente de verdad del código: server/api/src/env.ts y server/api/src/config.ts
# Doc: docs/variables-entorno-produccion.md
# NUNCA versionar este archivo con valores reales.
# ─────────────────────────────────────────────────────────────────────────────

# ── Entorno ──────────────────────────────────────────────────────────────────
NODE_ENV=production
# Puerto en el que escucha la API DENTRO del contenedor.
# API_PORT (en docker-compose.dev.yml) publica el puerto del host, no mueve este.
PORT=3000

# ── Secretos obligatorios (la API hace process.exit(1) si faltan) ─────────────
JWT_SECRET=<generar: openssl rand -hex 32>
# Distinto de JWT_SECRET. No reutilizar: al setearlo se cierran todas las
# sesiones de admin activas.
ADMIN_JWT_SECRET=<generar: openssl rand -hex 32>
ADMIN_PASS_TOKEN=<generar: openssl rand -hex 32>

# ── URLs públicas (obligatorias; deben ser URLs válidas) ─────────────────────
# Ojo: el chequeo NO rechaza localhost acá. Poner el dominio real.
FRONTEND_URL=https://<dominio-web>
ADMIN_FRONTEND_URL=https://<dominio-admin>
# Base de las URLs de archivos subidos. Su default (http://localhost:3000)
# tampoco se rechaza: setearla siempre.
BASE_URL=https://<dominio-api>
# URL pública de la app para los links de invitación. Si se omite, cae a FRONTEND_URL.
APP_BASE_URL=https://<dominio-web>

# ── Google OAuth (obligatorios: sin ellos no se valida el `aud` del token) ───
WEB_GOOGLE_CLIENT_ID=<client-id-web>.apps.googleusercontent.com
ADMIN_GOOGLE_CLIENT_ID=<client-id-admin>.apps.googleusercontent.com
# Solo para los builds nativos:
ANDROID_GOOGLE_CLIENT_ID=<client-id-android>.apps.googleusercontent.com
IOS_GOOGLE_CLIENT_ID=<client-id-ios>.apps.googleusercontent.com

# ── Base de datos: rol dueño (migraciones y backups; NO lo usa la API) ───────
POSTGRES_USER=<usuario-dueño>
POSTGRES_PASSWORD=<generar: openssl rand -base64 32>
POSTGRES_DB=<nombre-de-la-base>
PGHOST=db
POSTGRES_PORT=5432

# ── Base de datos: roles de aplicación (obligatorios) ────────────────────────
# La migración 0007_db_roles_and_rls.sql aborta (RAISE) si estas contraseñas
# llegan vacías. Ya no existe fallback a POSTGRES_PASSWORD.
DB_APP_USER=loop_app
DB_APP_PASSWORD=<generar: openssl rand -base64 32>
DB_UNSCOPED_USER=loop_app_unscoped
DB_UNSCOPED_PASSWORD=<generar: openssl rand -base64 32>

# ── Sesiones (en SEGUNDOS) ───────────────────────────────────────────────────
TOKEN_EXP=2592000
ADMIN_TOKEN_EXP=1800

# ── Rate limiting ────────────────────────────────────────────────────────────
# Solo "true" o "false". En producción, "false" aborta el arranque.
RATE_LIMIT_ENABLED=true

# ── Archivos subidos ─────────────────────────────────────────────────────────
UPLOAD_DIR=/uploads

# ── Email transaccional ──────────────────────────────────────────────────────
RESEND_API_KEY=<api-key-de-resend>
# "true"/"false". Si se omite, se deduce de RESEND_API_KEY.
REQUIRE_EMAIL_VERIFICATION=true
# NO setear en producción: loguea el token de verificación en claro.
# EMAIL_DEBUG_LINKS=false
AUTHORIZED_ADMIN_EMAIL=<email-del-primer-admin>

# ── Hashing ──────────────────────────────────────────────────────────────────
SALT_ROUNDS=10

# ── Firma de URLs de media (apagada por defecto) ─────────────────────────────
# Encender primero en un ambiente de prueba. Si se pone "true", MEDIA_SIGNING_SECRET
# es obligatoria de hecho, aunque nadie la valide: vacía, la firma es falsificable.
MEDIA_URL_SIGNING_ENABLED=false
MEDIA_SIGNING_SECRET=<generar: openssl rand -hex 32>
# Solo durante una rotación de secreto:
MEDIA_SIGNING_SECRET_PREVIOUS=
MEDIA_URL_TTL_SECONDS=86400
MEDIA_URL_BUCKET_SECONDS=3600

# ── Límites de donación ──────────────────────────────────────────────────────
DONATION_MIN_CREDITS=1
DONATION_MAX_CREDITS=100000
DONATION_DAILY_MAX_CREDITS=200000

# ── Tags de imagen (rollback: ver docs/runbook-deploy.md §4) ─────────────────
API_IMAGE_TAG=1.0.0
WEB_IMAGE_TAG=1.2.0
ADMIN_IMAGE_TAG=0.3.0

# ── Observabilidad (runtime-observability/INF-10) ────────────────────────────
LOG_LEVEL=info
# Vacío = Sentry inerte: el SDK no se inicializa y no sale tráfico de red.
# Setear un DSN real es la única forma de habilitar el reporte de errores.
SENTRY_DSN=

# ─────────────────────────────────────────────────────────────────────────────
# BUILD-TIME — NO son runtime de la API. Son ARG/ENV de Dockerfile.web y
# Dockerfile.admin y quedan horneadas en el bundle: cambiarlas exige rebuild.
# ─────────────────────────────────────────────────────────────────────────────
# EXPO_PUBLIC_API_URL=https://<dominio-api>
# EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID=<client-id-web>.apps.googleusercontent.com
# EXPO_PUBLIC_LEGAL_BASE_URL=https://<dominio-web>
# EXPO_PUBLIC_REPORT_EMAIL=<email-de-reportes>
# EXPO_PUBLIC_DEMO_MODE=false
# VITE_API_URL=https://<dominio-api>
# VITE_GOOGLE_CLIENT_ID=<client-id-admin>.apps.googleusercontent.com
```

---

## 6. Cómo verificar antes de deployar de verdad

Correr la imagen de producción una sola vez, en un ambiente de prueba, con el `.env` real del host
tal cual está hoy, y ver si arranca o aborta. Si aborta, el mensaje lista **todas** las variables
faltantes de una — no hace falta iterar de a una.

```bash
docker compose -f compose.yml run --rm api node dist/index.js
```

Lo que ese chequeo **no** cubre y hay que mirar a mano:

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` ausentes: pasa la validación y falla al
  conectar.
- `FRONTEND_URL`, `ADMIN_FRONTEND_URL` o `BASE_URL` apuntando a `localhost`: pasa la validación.
- `MEDIA_URL_SIGNING_ENABLED=true` con `MEDIA_SIGNING_SECRET` vacía: pasa, y firma con clave vacía.
- `API_PORT`: aparece en `compose.yml` y en los compose de desarrollo, pero **el código nunca la
  lee**. Publica el puerto del lado del host; el contenedor siempre escucha en `PORT`.

Ver también [`docs/runbook-deploy.md`](runbook-deploy.md) para la secuencia de deploy, migraciones y
rollback.
