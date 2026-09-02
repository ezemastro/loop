# Auditoría 2026-09 — Registro de avance

> Rama: `fix/auditoria-2026-09` (desde `main` @ `7acced3`)
> Sesión: 2026-09-02. Documento vivo: se actualiza al cerrar cada bloque.
> Fuente de verdad de hallazgos: `AUDITORIA-2026-09.md`. Qué probar a mano: `TESTING-MANUAL.md`.

## Bloques SDD

| Bloque | Change SDD | IDs de auditoría | Plan | Implementación |
|---|---|---|---|---|
| A | `sec-hardening-api` | SEC-01, 02, 03, 04, 06(parcial), 07, 12, 13, 15, 16, INF-11 | ✅ | ✅ `c6b3f74` — falta escribir `.env.template` a mano (bloqueado por permisos) |
| B | `db-integrity-migrations` | SEC-05, SEC-09, SEC-10, ECO-01 (DB), ECO-09 | ✅ | ✅ `a3a026e` |
| C | `credit-economy-integrity` | ECO-01, 02, 03, 04, 05, 06, 08, 10, 11, 12 | ✅ | ✅ código de servidor completo y validado contra DB real; botón "Cancelar" del cliente ya conectado en `38cbc6e` |
| D | `client-critical-fixes` | CLI-01, 02, 03, 04, 05, 06, 07, 09, 12(parcial), 13(parcial) | ✅ | ✅ `d6b50b3` |
| E | `admin-panel-fixes` | ADM-02, 03, 04, 05, 06, 08, 10(parcial) | ✅ | ✅ `fe7f886` |
| F | `delivery-and-ci` | INF-01, 02, 03, 04, 06, 07, 08, 09, 10, 12 | ✅ | ✅ `3ba569f` + pase posterior — fases 1-9 aplicadas completas; fase 7 (observabilidad/INF-10) ya no está diferida: `sec-hardening-api` aplicó `GET /health`, así que este pase agregó `pino`/`pino-http`, id de correlación, redacción de secretos y Sentry (inerte sin `SENTRY_DSN`) sobre esa base. Tareas `[VERIFY]` 7.10/7.11 (Sentry sin DSN, `/health` con la base caída) quedan pendientes de chequeo manual |
| G | `legal-public-routes` | ADM-01, SEC-08, SEC-11, PROD-05(parcial) | ✅ | ✅ código completo, migraciones `0015`/`0016` aplicadas y validadas; **gate legal (6.6) pendiente de un humano — ver `TESTING-MANUAL.md` §0** |

Cada bloque tiene `proposal.md`, `design.md`, `tasks.md` y sus delta specs en
`openspec/changes/<id>/`. Las correcciones a la auditoría que salieron de leer el código están en
`AUDITORIA-CORRECCIONES.md` — son sustanciales, incluida una que habría roto producción (SEC-09) y
otra que habría abierto una escalada de privilegios (SEC-04).

## Entorno de validación

Base descartable para migraciones y tests con DB real:

```
docker run -d --name loop-audit-db --rm \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=audit_password -e POSTGRES_DB=loop_db \
  -p 5433:5432 postgres:16
docker exec -i loop-audit-db psql -U postgres -d loop_db -v ON_ERROR_STOP=1 < server/database_creation.sql
docker exec -i loop-audit-db psql -U postgres -d loop_db -v ON_ERROR_STOP=1 < server/create_categories.sql
cd server/api && PGHOST=localhost POSTGRES_PORT=5433 POSTGRES_USER=postgres POSTGRES_PASSWORD=audit_password \
  POSTGRES_DB=loop_db DB_APP_USER=loop_app DB_APP_PASSWORD=audit_app_password \
  DB_UNSCOPED_USER=loop_app_unscoped DB_UNSCOPED_PASSWORD=audit_unscoped_password \
  AUTHORIZED_ADMIN_EMAIL=admin@northfield.edu.ar npx tsx src/scripts/migrate.ts
```

## Salteados a propósito

- **ECO-07** (`credit-economy-integrity`) — una oferta por debajo del precio pedido, sin ningún
  ítem de intercambio de por medio, sigue sin poder aceptarse (`TOTAL_PRICE_EXCEEDED`). Es una
  regla real y preexistente que necesita una decisión de producto (¿precio fijo, o el vendedor
  puede aceptar con descuento?), documentada en `openspec/changes/credit-economy-integrity/proposal.md`
  ("Deferred"). El comportamiento queda byte-a-byte igual a como estaba.
- **Wiring del cliente para `POST /listings/:listingId/cancel`** (`credit-economy-integrity`,
  ECO-05) — el endpoint existe, está guardado y probado directamente contra la base real; el
  botón "Cancelar" del cliente (`client/components/ListingButtons.tsx:114-116`) sigue sin
  `onPress`. Se salteó porque `client/` estaba fuera de los archivos que este bloque podía tocar
  en la sesión concurrente. Ver `TESTING-MANUAL.md` §7.

## Descubrimientos nuevos

- **`receiveListing` reescribía `credits_balance` del comprador a su propio valor sin necesidad**
  (`credit-economy-integrity`, corrección al audit original): un lost-update sin ningún propósito
  — solo pretendía tocar `credits_locked`. Corregido: el bucket que no cambia ya no aparece en el
  UPDATE.
- **`cancelListing` (la implementación vieja) cobraba de más al vendedor y de más al comprador**
  (`credit-economy-integrity`): cargaba `price - offeredCredits` de bolsillo al vendedor y
  acreditaba el `price` completo al comprador en vez de lo que tenía bloqueado. Nunca corrió en
  producción (bug de aridad documentado en el propio código), así que no hay comportamiento que
  preservar — la regla nueva es simétrica: cada parte recupera exactamente lo que ese loop le
  tenía bloqueado.
- **`makeOffer` no tenía ningún schema de validación** (`credit-economy-integrity`, más amplio de
  lo que decía el audit original): `offeredCredits: undefined` pasaba las tres comparaciones de
  guardas porque todas son `false` contra `undefined`.
- **`assignMissionToAllUsers` tenía una ventana de duplicación real entre dos admins simultáneos**
  (`credit-economy-integrity`, ECO-11): el SELECT→INSERT por usuario (N+1) no tenía ningún
  constraint de unicidad debajo — confirmado y cerrado con `uq_user_missions_user_template`
  (migración `0014`) más un único `INSERT … SELECT … ON CONFLICT DO NOTHING`.
- **No había ningún `UNIQUE` real sobre `mission_templates.key`** (`credit-economy-integrity`): la
  unicidad solo la vigilaba la aplicación — una carrera TOCTOU real entre dos altas de plantilla
  simultáneas. Cerrado con `uq_mission_templates_key` (migración `0014`).

---

## Descubrimientos de esta sesión

### D-01 — La RPi de desarrollo ES el host de producción de Coolify
`docker ps` muestra `coolify`, `coolify-db`, `coolify-redis`, `coolify-realtime`, `coolify-sentinel`
y contenedores de apps vivas (`task-manager-*`, `hormigon-*`, `viga-continua-*`, `ai_virtual_office`),
todos healthy. RAM total 8 GB, disponible ~2.7 GB al arrancar la sesión.

**Consecuencia:** levantar el stack completo de `docker-compose.e2e.yml` puede tirar producción.
Para validar migraciones se usa **un solo contenedor `postgres:16` descartable**, no el compose entero.
Chequear `free -m` antes de cualquier trabajo pesado con Docker.

**Versiones reales del host:** Docker 29.3.1 · Compose v5.1.1 · Node v24.14.1 · npm 11.11.0 · aarch64.
Ojo: Node 24 local vs Node 20/22 en los Dockerfiles (INF-08 confirma la desalineación).

### D-02 — Línea base de typecheck antes de tocar nada
Medido en `main` (`7acced3`), para poder distinguir lo roto de antes de lo que rompamos nosotros:

| Paquete | `tsc --noEmit` | Detalle |
|---|---|---|
| `server/api` | ✅ limpio (exit 0) | — |
| `client` | ❌ **209 errores** | 200 son de `__tests__/*` (falta `@types/jest` / `include` del tsconfig). Solo **9 son de código real**: `demo/state.ts` (5, `string` vs `Date`), `config.ts:72` (`Record<ProductStatus, number>` incompleto: faltan `like_new`, `good`, `fair`), `components/screens/Login.tsx:39` (`loginError` no existe), `components/ReportButton.tsx:63` (`PublicUser.email` no existe), `components/modals/DonateModal.tsx:57` (`PublicUser` vs `User`). |
| `adminClient` | no medible al empezar | No tenía `node_modules` **ni** `package-lock.json`. |

**Hallazgo nuevo, no está en la auditoría:** el cliente no typechequea en `main`. `expo lint` no lo
detecta porque no corre `tsc`. Cualquier CI que agregue `tsc --noEmit` (INF-02) va a fallar de entrada
si no se arregla esto primero o se excluye `__tests__` del `tsconfig`.

### D-03 — `adminClient` sin lockfile (ADM-10 / INF-07)
`adminClient/.gitignore` excluía `package-lock.json`, así que el paquete no era auditable ni
reproducible. Corregido en esta sesión: se quitó la línea del `.gitignore` y se generó y commiteó
el lockfile.

### D-04 — `npm run lint` estaba roto en 3 de 3 paquetes (INF-12, resuelto)
La auditoría decía "Lint raíz roto". Era peor: **ningún** paquete linteaba.

| Síntoma | Causa | Arreglo |
|---|---|---|
| `SyntaxError: Cannot use import statement outside a module` | `eslint.shared.config.js` es ESM pero el `package.json` raíz es `commonjs` | renombrado a `eslint.shared.config.mjs` |
| `@typescript-eslint plugin is not defined` (admin) | la config compartida aplicaba `@typescript-eslint/no-unused-vars` sin registrar el plugin | la regla se exporta aparte como `typescriptUnusedVars` y cada paquete la agrega **después** de su propio `tseslint` |
| `Cannot redefine plugin "@typescript-eslint"` (api) | registrar el plugin en la compartida chocaba con el spread de `tseslint` del paquete | mismo arreglo |
| `ERR_UNSUPPORTED_DIR_IMPORT` (client) | `import expoConfig from "eslint-config-expo/flat"` sin extensión | `"eslint-config-expo/flat.js"` |
| `Cannot redefine plugin "prettier"` (client) | el cliente importaba `eslint-plugin-prettier/recommended` **además** del que ya trae la config compartida | se quitó el duplicado |
| `npm run lint` raíz no hacía nada | `--workspace` sin campo `workspaces` en el `package.json` raíz | reescrito con `--prefix`; se agregó script `lint` al `server/api` que no tenía |

**Línea base de lint una vez que corre** (todo preexistente, ninguno introducido por esta sesión):

| Paquete | Problemas |
|---|---|
| `server/api` | 25 errores (14 auto-corregibles) |
| `client` | 22 errores + 3 warnings (14 auto-corregibles) |
| `adminClient` | 28 errores (3 auto-corregibles) |

No se corrió `--fix` todavía: eso mueve muchas líneas y taparía los diffs reales de los bloques.
Queda para el final de la sesión.

### D-05 — El proxy activo es Traefik (de Coolify), no Caddy — INF-09 resuelto por observación
La auditoría marcaba INF-09 como "a confirmar si Caddy es el proxy activo". Confirmado en el host:

```
$ docker inspect coolify-proxy --format '{{.Config.Image}}'
traefik:v3.6
$ docker ps --filter name=coolify-proxy --format '{{.Ports}}'
0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp, 0.0.0.0:8080->8080/tcp, 0.0.0.0:443->443/udp
```

Traefik ocupa 80, 443 y 8080. **Caddy no puede estar sirviendo nada**: no hay contenedor Caddy
corriendo y los puertos que su config pide ya están tomados. Por lo tanto `Caddyfile` y
`compose.caddy.yml` son código muerto, y el bug de `admin:3002` vs puerto 80 nunca se manifestó
porque ese subdominio jamás pasó por Caddy.

**Decisión:** se borran `Caddyfile` y `compose.caddy.yml` en el bloque F en vez de arreglarlos.
Ojo también: la red `loop_default` existe pero está **vacía** — no hay ningún contenedor de Loop
corriendo en esta máquina hoy.

### D-06 — `POSTGRES_PORT` se ignoraba: 5432 hardcodeado en 3 lugares (INF-11, resuelto)
`migrate.ts:207`, `postgresClient.ts:47` y `rls.test.ts:35` fijaban `port: 5432`, así que era
imposible apuntar a una base en otro puerto. Se agregó `DB_PORT` en `config.ts` (desde
`POSTGRES_PORT`, default 5432) y se usa en los tres lugares.

Con eso se pudo levantar una base de validación descartable y **la cadena completa de migraciones
`0000`→`0008` corre limpia contra un `postgres:16` real**. Ese es el entorno que se usa para
validar las migraciones nuevas de esta sesión.

### D-07 — La migración `0000` no puede correr sobre un volumen vacío
`server/migrations/0000_baseline_reconcile.sql` asume que el schema base de `database_creation.sql`
ya existe. En un volumen realmente vacío, correr solo el runner falla con
`relation "admins" does not exist`.

Es decir: el fix de INF-01 (servicio `migrate` en `compose.yml`) **no alcanza solo**. El servicio `db`
tiene que sembrar el schema base primero. Ya quedó resuelto montando `database_creation.sql` y
`create_categories.sql` en `/docker-entrypoint-initdb.d/`, el mismo patrón que ya usaba
`e2e/Dockerfile.db-init`.

### D-08 — El bloqueo real de INF-01 no era el que decía la auditoría
`tsconfig.prod.json` **sí** compila `migrate.ts` a `dist/scripts/`. Lo que faltaba era el `COPY` de
`server/migrations` **y**, sobre todo, que `tsx` es devDependency y `--omit=dev` la borra: por eso
`npm run migrate` nunca iba a correr en la imagen de producción. El servicio invoca
`node dist/scripts/migrate.js`.

### D-09 — ESLint flat config no ignora `dist/` solo
Un build local inundaba el lint con 8904 hallazgos. `server/api/eslint.config.ts` no tenía el ignore
de `dist/**`. Agregado.


---

## Follow-ups nuevos que salieron de esta sesión

Ninguno estaba en la auditoría. Ordenados por valor:

1. **`withClient` se traga los fallos de COMMIT.** Un movimiento de créditos puede parecer
   commiteado y haberse perdido. Es el de mayor valor de toda la lista.
2. **El payload de push del servidor no manda `data`** (`services/expoNotifications.ts`), así que
   el deep-link de notificaciones no se puede cerrar del lado del cliente. CLI-05 quedó a medias
   por esto, no por el cliente.
3. **`useNotifications` ignora `pageParam`**: pagina para siempre sobre la página 1.
4. **`sw.js` no tiene listener de `push` ni de `notificationclick`.**
5. **La estandarización de `parseApiError` no está completa** — `useUpdateListing`, `useSendMessage`,
   `useUploadFiles` y otros siguen armando el mensaje a mano. La guarda de
   `client/__tests__/api-errors.test.ts` solo mira bloques `catch`, así que no los ve.
6. **`services/uploads.ts` hace `fs.mkdirSync("/uploads")` en tiempo de carga del módulo.** Hoy
   ningún test lo toca, pero es una mina para cualquier test unitario fuera de un contenedor.
7. **El enum `product_status` de Postgres tiene 5 valores contra 3 en TypeScript**, y los seis
   `validate*` de `services/validations.ts` son código muerto ya derivado.
8. **La API nunca valida el precio contra categoría/estado**: `PRICE_STATUS_MULTIPLIERS` es solo del
   cliente e `INVALID_PRICE_FOR_CATEGORY` no tiene un solo call site.
9. **`showAlert` con acciones auto-confirma en web** — ver `AUDITORIA-CORRECCIONES.md`. Cualquier
   confirmación futura tiene que degradar a un modal propio en web.

## Bloqueado por permisos, hay que hacerlo a mano

**`.env.template`.** El deny list de esta sesión bloquea toda ruta `.env*`, incluso para lectura.
El contenido exacto (todas las variables que ahora exige el esquema de entorno, con qué son
obligatorias en producción) está en `openspec/changes/sec-hardening-api/tasks.md`.
Sin ese archivo, el próximo que clone el repo no sabe qué variables necesita — y la API ahora
**aborta el arranque en producción** si falta alguna.

---

## Verificación final de la sesión

Base **desde cero** (`postgres:16` limpio → `database_creation.sql` → `create_categories.sql` →
migraciones `0000`–`0016`):

```
✓ 0009_unique_user_email          ✓ 0013_revoke_loop_app_dml
✓ 0010_credit_balance_checks      ✓ 0014_credit_ledger_integrity
✓ 0011_message_listing_on_delete  ✓ 0015_terms_acceptance
✓ 0012_verification_token_hash    ✓ 0016_password_reset
Migraciones al día.
```

Suite completa del API **con base real** (`RUN_DB_TESTS=1`), o sea incluidos RLS, concurrencia de
créditos y rutas legales:

```
Test Suites: 17 passed, 17 total
Tests:       163 passed, 163 total
```

| Chequeo | Al empezar | Al terminar |
|---|---|---|
| `server/api` `tsc --noEmit` | ✅ limpio | ✅ limpio |
| `client` `tsc --noEmit` | ❌ 209 errores | ✅ limpio |
| `adminClient` `tsc -b --noEmit` | no medible (sin `node_modules` ni lockfile) | ✅ limpio |
| `npm run lint` | ❌ roto en **los tres** paquetes | ✅ corre en los tres |
| Suite del API (sin DB) | ❌ 9 suites en rojo / 4 en verde · 20 tests en rojo / 54 en verde | ✅ 14 en verde, 0 en rojo · 134 tests |
| Suite del API (con DB real) | nunca se corría | ✅ **17/17 suites, 163/163 tests** |
| Suite del cliente | 721 (con `--watchAll`, no terminaba en CI) | ✅ 857 con `--ci` |
| Migraciones desde cero | ❌ imposible: puerto hardcodeado | ✅ `0000`–`0016` limpias |
| `npm audit` | 4 high en raíz, 53 en cliente, admin no auditable | ✅ sin vulnerabilidades |
