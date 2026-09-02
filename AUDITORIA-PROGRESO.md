# Auditoría 2026-09 — Registro de avance

> Rama: `fix/auditoria-2026-09` (desde `main` @ `7acced3`)
> Sesión: 2026-09-02. Documento vivo: se actualiza al cerrar cada bloque.
> Fuente de verdad de hallazgos: `AUDITORIA-2026-09.md`. Qué probar a mano: `TESTING-MANUAL.md`.

## Bloques SDD

| Bloque | Change SDD | IDs de auditoría | Plan | Implementación |
|---|---|---|---|---|
| A | `sec-hardening-api` | SEC-01, 02, 03, 04, 06(parcial), 07, 12, 13, 15, 16, INF-11 | ✅ | pendiente |
| B | `db-integrity-migrations` | SEC-05, SEC-09, SEC-10, ECO-01 (DB), ECO-09 | ✅ | en curso |
| C | `credit-economy-integrity` | ECO-01, 02, 03, 04, 05, 06, 08, 10, 11, 12 | ✅ | pendiente |
| D | `client-critical-fixes` | CLI-01, 02, 03, 04, 05, 06, 07, 09, 12(parcial), 13(parcial) | ✅ | pendiente |
| E | `admin-panel-fixes` | ADM-02, 03, 04, 05, 06, 08, 10(parcial) | ✅ | en curso |
| F | `delivery-and-ci` | INF-01, 02, 03, 04, 06, 07, 08, 09, 10, 12 | ✅ | pendiente |
| G | `legal-public-routes` | ADM-01, SEC-08, SEC-11, PROD-05(parcial) | ✅ | pendiente |

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

(se completa al cerrar la sesión)

## Descubrimientos nuevos

(se completa a medida que aparecen)

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
