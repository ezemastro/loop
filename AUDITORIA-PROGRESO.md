# Auditoría 2026-09 — Registro de avance

> Rama: `fix/auditoria-2026-09` (desde `main` @ `7acced3`)
> Sesión: 2026-09-02. Documento vivo: se actualiza al cerrar cada bloque.
> Fuente de verdad de hallazgos: `AUDITORIA-2026-09.md`. Qué probar a mano: `TESTING-MANUAL.md`.

## Bloques SDD

| Bloque | Change SDD | IDs de auditoría | Estado |
|---|---|---|---|
| A | `sec-hardening-api` | SEC-01, SEC-02, SEC-03, SEC-06, SEC-07, SEC-12, SEC-13, SEC-15, SEC-16, INF-11 | pendiente |
| B | `db-integrity-migrations` | SEC-05, SEC-09, SEC-10, ECO-01 (DB), ECO-09 | pendiente |
| C | `credit-economy-integrity` | ECO-01, ECO-02, ECO-03, ECO-04, ECO-05, ECO-06, ECO-08, ECO-10, ECO-11, ECO-12 | pendiente |
| D | `client-critical-fixes` | CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-09 | pendiente |
| E | `admin-panel-fixes` | ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, ADM-08 | pendiente |
| F | `delivery-and-ci` | INF-01, INF-02, INF-03, INF-04, INF-07, INF-08, INF-09, INF-10, INF-12 | pendiente |
| G | `legal-public-routes` | ADM-01, SEC-11, PROD-05 (parcial) | pendiente |

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
