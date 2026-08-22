# Loop E2E — Suite de flujos críticos

Suite End-to-End de Playwright que cubre los flujos de negocio críticos de Loop: comunidades,
escuelas, usuarios, publicaciones, ofertas, intercambios, créditos (loopies), mensajería,
notificaciones, donaciones y deseos.

## Filosofía

- **Nivel API + base de datos, no UI.** Los tests ejecutan los ENDPOINTS REALES del backend — los
  mismos que el cliente consume — y verifican el efecto en la base con un pool de superusuario.
  Se evita simular el llenado de formularios desde el navegador: lo que se simula es la acción
  que el botón dispararía (misma llamada HTTP), y después se comprueba en la DB que el resultado
  fue el correcto. Un fallo de UI no debe fingir un fallo de negocio, ni un fallo de negocio debe
  esconderse detrás de un selector que cambió.
- **Base de datos desechable.** Cada corrida arranca en Docker un Postgres 100% nuevo
  (schema + categorías + migraciones), corre la suite y destruye el volumen automáticamente.
- **Tests ordenados y seriales.** Un solo worker, `fullyParallel: false`, archivos con prefijo
  numérico. El journey completo (`01 → 06`) simula el proceso real de negocio en orden.

## Cómo correr

Requisito: Docker con la imagen de Playwright (`mcr.microsoft.com/playwright:v1.49.0-jammy`).

```bash
npm run test:e2e            # sube db+api+runner, corre la suite, destruye todo (down -v)
npm run test:e2e:down       # limpieza manual del stack e2e (por si quedó algo)
```

El script `scripts/run-e2e.sh`:

1. Elimina volúmenes previos del proyecto `loop-e2e` (garantiza base fresca).
2. Construye la imagen del runner e2e con un cache-buster (el daemon Docker externo no invalida
   el COPY de `.dockerignore`/código por sí solo).
3. `docker compose -p loop-e2e -f docker-compose.e2e.yml up -d --wait`: levanta `db`, `migrate`
   (one-shot: schema + migraciones) y `api` y espera healthchecks. El servicio `e2e` vive bajo
   `profiles: ["run"]`, así `up` NO lo arranca (la suite correría dos veces contra la misma DB).
4. `docker compose run --rm -T --no-deps e2e npx playwright test --project=e2e`: corre la suite
   en el runner. `--no-deps` evita que `run` intente re-arrancar/re-migrar los servicios.
   `--exit-code-from` NO se usa: en Compose v5 implica `--abort-on-container-exit`, que aborta
   cuando `migrate` termina con éxito y deja el shutdown colgado con api/db vivos.
5. `trap EXIT` → `down -v --remove-orphans`: la base se elimina SIEMPRE, incluso si falla.

### Arquitectura del stack (`docker-compose.e2e.yml`)

| Servicio | Imagen | Rol |
|---|---|---|
| `db` | `e2e/Dockerfile.db-init` (postgres:16) | Arranca con `/docker-entrypoint-initdb.d/` corriendo `database_creation.sql` + `create_categories.sql` (base + catálogo). `POSTGRES_DB=loop_db` (requerido por el `ALTER DATABASE` del schema). Volumen nombrado, se borra con `down -v`. |
| `migrate` | `Dockerfile.api` (target `development`) | `npm run migrate` aplica `server/migrations/*.sql` (0000→0007). Necesita `DB_APP_USER/PASSWORD` y `DB_UNSCOPED_USER/PASSWORD` no vacíos (la migración 0007 los crea y raisea si faltan). |
| `api` | `Dockerfile.api` (target `development`) | La API real con los roles de aplicación; healthcheck sobre `GET /status`. |
| `e2e` | `e2e/Dockerfile.e2e` (playwright v1.49) | `npx playwright test --project=e2e`. Conecta a `http://api:3000` y a la DB `loop_db` como superusuario (base efímera: OK y necesario para que las assertions vean todo, incluido lo que RLS escondería). Perfil `run`: no arranca con `up`. |

Sin puertos publicados: todo el tráfico corre dentro de la red del proyecto. No pisa el stack de
desarrollo (3000/5432/8081/5173/4321).

## Qué se testea

Cada test verifica DOS cosas: la respuesta de la API Y el estado real en la base (filas,
saldos, créditos bloqueados, notificaciones, comunidad). Detalle por archivo:

| Archivo | Flujo | Assertions clave |
|---|---|---|
| `01_onboarding_and_tenant.e2e.spec.ts` | Registro por dominio, escuelas por comunidad, dominios desconocidos, login, `/me`, resolución de comunidad | `users.community_id` = comunidad del dominio; registro con escuela de otra comunidad → `SCHOOLS_NOT_IN_COMMUNITY` y rollback (no queda fila); dominio desconocido → `EMAIL_NOT_AUTHORIZED`; credits 0/0 iniciales; `user_schools` correcto. |
| `02_listing_journey.e2e.spec.ts` | **Journey completo**: publicar → feed → oferta con trade → notificación → aceptar → recibir → saldos liquidados → re-oferta rechazada | Estados `published→offered→accepted→received` en la base; `listing_trades` (se documenta que `acceptOffer` NO escribe en esa tabla, solo marca como vendido); saldo del comprador `baseline - offer` y locked `offer`; vendedor `baseline + offer`; notificaciones `new_offer`, `offer_accepted`, `listing_received` (van al VENDEDOR, no al comprador). Los baselines se miden después de publicar porque completar la misión `publish-listing-1` otorga créditos (cliente recibe +30.000 al publicar y el seller también). |
| `03_community_isolation.e2e.spec.ts` | Aislamiento real entre comunidades | El feed scopeado no muestra listings de otra comunidad; `GET /listings/:id` cruzado → `LISTING_NOT_FOUND`; mensaje cruzado → `USER_NOT_FOUND` y cero filas en `messages`; `GET /schools` solo devuelve escuelas de la comunidad; donación cruzada → 400 y saldo del receptor intacto. |
| `04_offer_negative_cases.e2e.spec.ts` | Casos negativos y autorización de ofertas | Oferta propia → `CANNOT_OFFER_OWN_LISTING`; mayor al precio → `INVALID_OFFER_PRICE`; créditos insuficientes → `INSUFFICIENT_CREDITS`; no-vendedor acepta → 401; no-comprador recibe → 401; cancelar oferta devuelve créditos y notifica `offer_deleted`; rechazar devuelve créditos y notifica `offer_rejected`; oferta sobre listing no publicable → error. |
| `05_messaging_notifications.e2e.spec.ts` | Mensajería y notificaciones | Persistencia de mensajes (sender/recipient/texto/`is_read`); orden cronológico; contador de no-leídos; marca-como-leído solo afecta los RECIBIDOS; oferta → notificación `new_offer` persistida y visible por API; aceptar → `offer_accepted`; `read-all` (solo marca las propias). |
| `06_donations_wishes.e2e.spec.ts` | Créditos, donaciones y deseos | Acreditación admin → `wallet_transactions` (type `admin`) + saldo; donación mueve saldos y registra notificación pero **NO** crea `wallet_transactions` (comportamiento real: solo saldos + notificación); donación sin saldo → 400; donación cruzada → rechazada sin tocar saldos; wishes CRUD completo (create/list/update por `:wishId`/delete por `:categoryId`). |

## Helpers (`e2e/helpers/`)

- `config.ts` — variables de entorno con defaults (API_URL, credenciales DB).
- `api.ts` — envolturas tipadas de los endpoints reales (register, login, admin credits, upload,
  listings, offers, accept/reject, receive, messages, wishes, donate, notifications…). El token de
  admin viaja como cookie `admin_token` (igual que el navegador), no como bearer.
- `db.ts` — pool de superusuario + helpers de lectura (users, listings, trades, notificaciones,
  wallet_transactions, mensajes, deseos, escuelas) + siembra de fixtures (school, community,
  admin email). La siembra es setup de datos de prueba; la lógica de negocio SIEMPRE viaja por API.
- `fixtures.ts` — `test` extendido con `api` (APIRequestContext), `db` (pool) y `uniqueEmail`.

## Advertencias de precisión (hallazgos reales del código)

Los tests verifican el comportamiento REAL, y en el camino documentan varios hallazgos:

1. **`listing_trades` nunca se inserta en `acceptOffer`** (la query `storeTrade` no se usa en
   ningún modelo). El ítem del comprador se "vende" con `markListingAsSold`. El journey lo
   verifica así, no esperando una fila en `listing_trades`.
2. **Las misiones de publicación otorgan créditos** (`publish-listing-1` = +30.000): el journey
   mide deltas sobre baselines medidos después de publicar.
3. **Las notificaciones de loop se guardan con `type='loop'`** y el subtipo (`new_offer`,
   `offer_accepted`, etc.) va en el `payload`. Los tests lo leen del payload.
4. **`listing_received` notifica al VENDEDOR**, no al comprador.
5. **Las donaciones no crean `wallet_transactions`**: solo saldos + notificación. Solo
   acreditaciones admin (y misiones) registran transacciones.
6. **El admin se autentica por cookie** (`admin_token`), no por bearer.
7. Los `InvalidInputError` sin código explícito (p.ej. donación sin saldo) devuelven
   `errorCode: "INVALID_INPUT"` aunque el mensaje sea el de la causa real.

## Fuera del alcance (y por qué)

| Área | Motivo |
|---|---|
| UI del cliente (Expo web) con Playwright de navegador | No hay `testID`s/selectores estables; la capa de UI no añade valor de negocio y agrega fragilidad. Los tests simulan las llamadas que la UI haría. |
| Google OAuth real (cliente y admin) | Requiere proveedor externo y credenciales; se cubre el flujo de email/password y el registro por dominio. |
| Push notifications (Expo) | Requiere dispositivo/tokens de push reales; se verifican las notificaciones PERSISTIDAS en la base y su API. |
| Admin panel (adminClient) y Landing (landing) | Son otras aplicaciones del monorepo, fuera del alcance de la suite de negocio del cliente. Los specs viejos de admin/landing se eliminaron: dependían de servers y de fixture compartidos insostenibles. |
| Subida de archivos real (uploads a disco/CDN) | Se sube un PNG mínimo real por `POST /uploads` (el mismo endpoint del cliente); no se prueba la optimización de imágenes ni el storage externo. |
| Borrado de cuenta, invitaciones, misiones avanzadas, paginación profunda, búsqueda/filtros exhaustivos | Flujos secundarios que no tocan la moneda ni el aislamiento; se priorizaron los flujos que pueden romper el negocio (loopies, intercambios, comunidades, escuelas, usuarios). |
| Rendimiento, concurrencia, carga | No es el objetivo de esta suite. |

## Notas del runner (lo que aprendimos)

- **Compose v5**: `--exit-code-from` IMPLICA `--abort-on-container-exit`; con `migrate` que sale 0
  al terminar, se aborta el stack antes de correr los tests. La solución es correr la suite con
  `docker compose run --rm -T --no-deps e2e` después de un `up -d --wait`.
- **El servicio e2e necesita `profiles: ["run"]`**: con el command `npx playwright test` directo,
  `up -d --wait` lo arranca y `run` lo vuelve a correr → la suite se ejecuta DOS veces contra la
  misma DB (duplicate keys). Bajo perfil, `up` no lo toca.
- **`e2e/Dockerfile.e2e` tiene `ARG CACHEBUST`** y el script lo setea con `date +%s`: el daemon
  Docker externo (docker-outside-of-docker) no invalida la capa `COPY e2e/` cuando cambian
  `.dockerignore` o el contenido; sin esto el runner ejecuta código viejo.
- **`.dockerignore` raíz excluía `*/tests/*`**: sin la excepción `!e2e/tests/*`, los specs no
  entraban a la imagen del runner ("No tests found").
- **Base siempre fresca**: el script baja `-v` el stack al INICIO y al FINAL (trap). Correr
  `docker compose up` manualmente y dejar el volumen vivo hace que los specs choquen con datos
  de corridas anteriores (escuelas/dominios duplicados).