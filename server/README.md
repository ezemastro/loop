# `server/`

Backend del monorepo Loop: la API (`server/api/`), el esquema base y catálogo (`database_creation.sql`,
`create_categories.sql`), y las migraciones versionadas (`server/migrations/`).

## Desarrollo local

```bash
npm run dev                      # desde la raíz: levanta db + api (watch) + client + admin
npm run dev:migrate              # aplica migraciones pendientes contra el stack de dev
npm run dev:seed                 # siembra las 3 comunidades de desarrollo (ver DEMO.md)
npm run dev:seed:demo            # siembra solo la comunidad demo
```

`server/docker-compose.yml` levanta `db` + `api` en modo desarrollo con sync por `watch`.

## Migraciones

Las migraciones viven en `server/migrations/*.sql`, se aplican en orden y quedan registradas con su
checksum en `schema_migrations` — nunca se edita una migración ya aplicada, se agrega una nueva.

```bash
cd server/api
npm run migrate           # aplica las pendientes (usa tsx; solo en dev)
npm run migrate:status    # lista aplicadas y pendientes, sin aplicar nada
```

En producción el runner corre ya compilado, sin `tsx` (que es una devDependency y no viaja a la
imagen): `node dist/scripts/migrate.js`. El servicio `migrate` de `compose.yml` es el que lo invoca
como paso previo a `api` — ver `docs/runbook-deploy.md` para el procedimiento completo de deploy,
verificación de estado y rollback.

## Imágenes Docker

La imagen de producción de la API se construye desde la raíz del repo con `Dockerfile.api`
(el contexto de build necesita `shared/` y `server/migrations/`, por eso no puede construirse desde
`server/` sola):

```bash
docker build -f Dockerfile.api --target development -t loop-api:dev .
docker build -f Dockerfile.api --target production  -t loop-api:prod .
```

Para publicar las tres imágenes (api, web, admin) multi-arquitectura (`linux/amd64,linux/arm64`),
usar `npm run docker:build` desde la raíz (`scripts/build-images.sh`) — es el único camino de build
soportado; no hay un `Dockerfile` ni un script de publicación propios de `server/`.

## Tests

```bash
cd server/api
npm run test               # unit + integration (RUN_DB_TESTS=1 corre la integración contra Postgres real)
npx jest --ci --selectProjects unit          # solo unit, sin base de datos
RUN_DB_TESTS=1 npx jest --ci --selectProjects integration   # RLS contra Postgres migrado
```
