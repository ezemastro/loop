# Runbook: Deploy, Migraciones y Rollback

Este runbook cubre el ciclo de vida de un deploy de producción con `compose.yml`: primer deploy,
deploys posteriores, cómo leer el estado de las migraciones, cómo hacer rollback a una imagen
anterior, y qué garantías de backup existen hoy (y cuáles no).

El host de producción es un servidor **Coolify sobre ARM64**. Coolify (vía su proxy Traefik) ya
ocupa los puertos 80, 443 y 8080 del host — nunca se debe publicar ninguno de esos puertos desde
`compose.yml`. No hay Caddy en este stack: se evaluó (`AUDITORIA-PROGRESO.md`, bloque F) y se
confirmó que Traefik es el único proxy activo; `Caddyfile` y `compose.caddy.yml` eran código muerto
y se eliminaron.

## 0. Antes de la primera migración en producción: leer esto

`MIGRACION-COMUNIDADES.md` documenta que las migraciones de comunidades (`0001` en adelante) **nunca
se aplicaron en producción**. La primera vez que este `compose.yml` corra contra la base de
producción real:

1. **Tomar un snapshot/backup de la base ANTES de nada.** Si algo sale mal a mitad de migración, la
   única forma de volver atrás es restaurar ese snapshot — el runner no tiene un "deshacer"
   automático por migración.
2. Confirmar que `DB_APP_PASSWORD` y `DB_UNSCOPED_PASSWORD` están seteadas y no vacías en el `.env`
   del host. `server/migrations/0007_db_roles_and_rls.sql` crea los roles de aplicación
   (`loop_app`, `loop_app_unscoped`) y hace `RAISE` (aborta la migración) si esas contraseñas llegan
   vacías.
3. Recién después de eso, seguir la secuencia normal de deploy (sección 2).

## 1. Qué corre en cada `docker compose up`

```
db (postgres:16)
  └─ healthcheck: pg_isready
       └─ migrate (imagen ezemastro/loop-api, one-shot)
            │   node dist/scripts/migrate.js
            │   MIGRATIONS_DIR=/app/migrations, credenciales de POSTGRES_USER (dueño de las tablas)
            │   aplica migraciones pendientes con lock advisory + verificación de checksum
            └─ exit 0 → service_completed_successfully
                 └─ api (imagen ezemastro/loop-api)
                      NODE_ENV=production; assertDbHardening() verifica que RLS está activo
                      (si migrate no corrió antes, esto haría process.exit(1) — por diseño)
```

`migrate` usa las credenciales de `POSTGRES_USER` (superusuario/dueño), no las de la app: las
migraciones necesitan DDL, que el rol de aplicación no tiene a propósito. Si `migrate` falla, sale
con código distinto de 0 y **`api` nunca arranca** — es la conducta esperada, no un bug: mejor un
deploy detenido que una API sirviendo contra un esquema a medio migrar.

## 2. Deploy ordinario (host ya inicializado)

```bash
# En el host, con compose.yml y .env ya presentes:
docker compose pull                # trae las imágenes de las tags fijadas en .env (ver sección 4)
docker compose up -d
docker compose logs -f migrate     # confirmar que migrate aplicó lo pendiente y salió con 0
docker compose ps                  # confirmar que api está healthy y no reinicia
```

Si `migrate` sale con código 0 y no hay nada pendiente, el log dice "Migraciones al día." — es el
caso normal en la mayoría de los deploys (solo cambia código de aplicación, no el esquema).

## 3. Inspeccionar el estado de las migraciones

Sin aplicar nada:

```bash
# Dentro del contenedor de la imagen de producción (no hace falta que esté corriendo `api`):
docker compose run --rm migrate node dist/scripts/migrate.js --status
```

Lista las migraciones aplicadas y las pendientes. En desarrollo, el equivalente con `tsx` es
`npm run migrate:status` (desde `server/api`) — no está disponible en la imagen de producción
porque `tsx` es una devDependency y la imagen instala con `--omit=dev`.

## 4. Rollback a una imagen anterior

`compose.yml` referencia las imágenes por variable (`${API_IMAGE_TAG}`, `${WEB_IMAGE_TAG}`,
`${ADMIN_IMAGE_TAG}`, cada una con un default de la última versión conocida), nunca por `latest` —
así la revisión corriendo es identificable y se puede volver atrás sin rebuildear:

```bash
# En el .env del host:
API_IMAGE_TAG=1.0.0          # la versión anterior conocida-buena
docker compose up -d api migrate
```

**Importante:** un rollback de la imagen de la API **no** revierte migraciones ya aplicadas al
esquema. Si el deploy que se está revirtiendo incluyó una migración nueva, evaluar si el código
anterior sigue siendo compatible con el esquema ya migrado antes de hacer rollback — si no lo es,
la única vía es restaurar desde el snapshot de la sección 0/5.

## 5. Backups y restore

`compose.yml` incluye un servicio `backup`
(`prodrigestivill/postgres-backup-local`, `./backups`, `SCHEDULE=@daily`, `BACKUP_KEEP_DAYS=7`).

Restaurar un dump:

```bash
# Ubicar el dump deseado en ./backups (nombrado por fecha)
docker compose stop api migrate
docker exec -i postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < ./backups/<archivo>.sql
docker compose up -d
```

**Lo que este backup NO cubre (deferido, INF-05 — fuera de alcance de este cambio):**

- Los backups son **locales al mismo host**, sin copia off-site. Si el host se pierde, se pierden
  los backups con él.
- No están cifrados en reposo.
- **El procedimiento de restore de arriba está documentado pero NO ensayado** — no hubo un simulacro
  de restore real contra este stack.
- `./uploads` (los archivos subidos por los usuarios) **no se respalda en absoluto** — solo la base
  de datos.

Proveer un destino off-site, cifrado, y correr un simulacro de restore requiere infraestructura que
este cambio no puede crear (una cuenta de almacenamiento externo, credenciales, etc.). Queda
registrado como trabajo futuro.

## 6. Constraints del host conocidas

- Coolify sobre ARM64; Traefik ya ocupa 80/443/8080 — nunca publicar esos puertos.
- No existe una red `reverse_proxy_network`; `compose.yml` usa `proxy-network`, creada a mano
  (`docker network create proxy-network`) antes del primer `up`.
- No hay Caddy activo — ver la sección 0 de este documento y `AUDITORIA-PROGRESO.md` (bloque F) para
  la evidencia completa (Traefik ya ocupa los tres puertos que Caddy pedía; `Caddyfile:13` además
  enrutaba mal el subdominio de admin, así que aunque hubiera estado vivo nunca funcionó).
