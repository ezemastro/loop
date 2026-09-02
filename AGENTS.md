# Loop - AGENTS.md

## Project Overview

School-based marketplace app (iOS/Android/Web) with admin panel. Monorepo with 4 packages, no npm workspaces configured.

## Packages

| Package       | Path                | Stack                                                               | Entry                                    |
| ------------- | ------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| **API**       | `server/api/`       | Express 5 + TypeScript + PostgreSQL                                 | `server/api/src/index.ts`                |
| **Client**    | `client/`           | Expo (React Native + Web)                                           | `client/app/` (expo-router file routing) |
| **Admin**     | `adminClient/`      | React 19 + Vite + Zustand + React Compiler                          | `adminClient/src/main.tsx`               |
| **Shared**    | `shared/types/`     | TypeScript `.d.ts` type definitions                                 | —                                        |
| **Demo data** | `shared/demo-data/` | Plain TS fixtures consumed by the API seed and the client demo mode | `shared/demo-data/index.ts`              |

## Commands

### Root level

```
npm run lint              # Lints all packages (sequential --prefix fallback, no workspaces)
npm run lint:fix          # Fixes lint in all packages
npm run format            # Prettier write (root config applies to all)
npm run format:check      # Prettier check
npm run docker:build      # scripts/build-images.sh — one `docker buildx` path for api/web/admin,
                           # multi-arch (linux/amd64,linux/arm64), tags each package's own version + latest
npm run docker:deploy     # docker compose up -d (pinned image tags, no --pull always)
npm run dev:migrate       # Runs `npm run migrate` inside the dev `api` container
npm run dev:seed          # Seeds the 3 dev communities (see DEMO.md)
npm run dev:seed:demo     # Seeds only the demo community, same as production demo mode
```

### API (`server/api/`)

```
npm run dev               # nodemon + tsx, watches src/
npm run test              # Jest --ci (ts-jest), NODE_ENV=test
npm run test:watch        # Jest --watch
npm run seed              # Seeds shared/demo-data into Postgres (dev only, idempotent)
npm run check-types       # tsc --noEmit
npm run build             # tsc (dev)
npm run build:docker      # tsc -p tsconfig.prod.json
```

### Client (`client/`)

```
npm start                 # expo start
npm run web               # expo start --web
npm run ios               # expo run:ios
npm run android           # expo run:android
npm run test              # jest-expo preset, --ci --watchAll=false
npm run lint              # expo lint
```

### Admin (`adminClient/`)

```
npm run dev               # vite --host (port 5173)
npm run build             # tsc -b && vite build
npm run lint              # eslint .
```

## Architecture

### API Routes (Express 5)

- `/auth` - register, login, google-login (no auth required)
- `/me` - self-service, requires JWT token via `tokenMiddleware`
- `/users`, `/schools`, `/categories`, `/listings`, `/messages`, `/uploads`, `/admin`, `/stats`
- All routes use `trimBody` middleware; most use `tokenMiddleware`
- Error handling via `errorMiddleware` at the end
- CORS: dev allows `localhost:5173` (admin) and `localhost:8081` (Expo web); prod uses env URLs

### Database

- PostgreSQL 16, raw `pg` client (no ORM)
- Connection in `server/api/src/services/postgresClient.ts`
- **Migrations**: `server/migrations/*.sql`, applied in order by `npm run migrate` (from `server/api`).
  `npm run migrate:status` lists pending ones. The runner tracks applied migrations in
  `schema_migrations` and verifies checksums — never edit an applied migration, add a new one.
- Base schema + seeds in `server/` root: `database_creation.sql` (base tables only — everything
  after multi-tenancy lives in `server/migrations/`), `create_categories.sql`
- **Demo data**: `npm run seed` (from `server/api`) writes `shared/demo-data` into Postgres. It is
  idempotent per community, connects as the table owner (the dataset spans communities, which the
  RLS-scoped roles cannot do by design), and refuses to run under `NODE_ENV=production` without
  `--force`. It also seeds the admin panel: one super admin, one community admin per community, the
  `admin_valid_emails` allowlist and a pending deletion request. See `DEMO.md` for accounts,
  passwords and the full contract.

### Multi-tenancy (communities)

The app is multi-tenant: a `communities` table groups schools, and every user belongs to exactly
one community, determined by their email domain at signup. **See `MIGRACION-COMUNIDADES.md` for the
full picture** — it is the reference document for this part of the system.

Three things to know before touching any DB code:

1. `withClient(fn, options)` **requires** a scope: `inCommunity(id)` or `unscoped(reason)`. There is
   no safe default for "which community is this data from".
2. Queries carry `AND ($n::uuid IS NULL OR community_id = $n::uuid)` with the community parameter
   **last**; call sites pass `client.communityId`.
3. The API connects as `DB_APP_USER` / `DB_UNSCOPED_USER`, never as `POSTGRES_USER` — that one is a
   superuser and superusers bypass Row-Level Security entirely.

`npm run check-sql` (from `server/api`) cross-checks every call site against its query's parameter
count. It exists because `client.query` takes `unknown[]`, so TypeScript cannot catch a mismatch —
it only shows up at runtime.

### Shared Types

- `shared/types/app.d.ts` - domain models (User, Listing, Category, School, etc.)
- `shared/types/apiCalls.d.ts` - request/response type definitions per endpoint
- Included in API tsconfig via `"../../shared/types/**/*.ts"`

### Docker/Deploy

- `compose.yml` - full stack: db, migrate (one-shot, gates `api` on
  `service_completed_successfully`), api, web, admin, backup (requires external `proxy-network`)
- No Caddy: the deploy host's own proxy (Traefik, via Coolify) owns ports 80/443/8080. `Caddyfile`
  and `compose.caddy.yml` were dead code and were removed — see `AUDITORIA-PROGRESO.md` for the
  discriminating evidence.
- `server/docker-compose.yml` - dev: db + api with watch mode sync
- `Dockerfile.api` - multi-stage: development → build (tsc) → production (node:22-alpine); the
  production stage also copies `server/migrations` and installs with `npm ci`
- `Dockerfile.web` - builds Expo web export, serves with `serve`
- `scripts/build-images.sh` - the single `docker buildx` build/publish path (see `npm run docker:build` above)

## Testing

### API Tests (Jest, ts-jest)

Two Jest projects in `jest.config.js`:

1. **unit** - `**/*.test.ts` in models/, controllers/, routes/, utils/, services/ — no database, no
   listener, hermetic
2. **integration** - `server/api/src/tests/**/*.test.ts` (currently just `rls.test.ts`), guarded by
   `RUN_DB_TESTS === "1"` and run against a real, migrated Postgres. No `setupFilesAfterEnv`, no
   `globalTeardown` — it does not boot a server.

- `moduleNameMapper` strips `.js` extensions from imports
- `collectCoverage` is on; no `coverageThreshold` yet (baseline not measured long enough to set one)
- Run from `server/api/` directory: `npm run test` (unit + integration; integration skips cleanly
  without `RUN_DB_TESTS=1`), or `npx jest --ci --selectProjects unit|integration` to target one

### Client Tests

- Uses `jest-expo` preset
- `npm run test` runs `--ci --watchAll=false` (CI-friendly, terminates)

### E2E Tests (Playwright)

- Located in `e2e/` directory
- Requires API running on `localhost:3000`
- `cd e2e && npm install && npx playwright install chromium`
- `npx playwright test --project=e2e` — the only project defined (`e2e/playwright.config.ts`);
  there is no `api`, `admin` or `fullstack` project
- `bash scripts/run-e2e.sh` builds, runs and tears down the self-contained `docker-compose.e2e.yml`
  stack (disposable DB + migrations + API), then runs the suite against it
- See `e2e/README.md` for full instructions

## Gotchas

- **No npm workspaces, deliberately** - root `package.json` has no `workspaces` field, and this is
  a considered decision, not an oversight: `shared/` isn't an npm package (two plain TS directories
  consumed via relative paths + `COPY shared ./shared` in every Dockerfile), workspaces wouldn't
  align the three divergent `zod` versions by themselves, and hoisting would force a rewrite of
  every Dockerfile install layer — including the `--omit=dev` production stage. Root lint runs its
  own sequential `cd && npx eslint` fallback per package instead.
- **API build uses `tsx` at runtime** - nodemon runs `npx tsx ./src/index.ts`, not compiled JS. The
  production image, however, invokes the *compiled* migration runner directly with `node` (`node
  dist/scripts/migrate.js`) — `tsx` is a devDependency stripped by `--omit=dev`, so `npm run
  migrate` cannot run in production.
- **External Docker network** - `compose.yml` requires `proxy-network` to be created manually (`docker network create proxy-network`).
- **Env files** - `.env` at root for compose; `server/.env` for API dev. Copy from `server/.env.template`.
- **`shared/` and the admin tsconfig** - `adminClient` has its own type definitions. The API and the
  client both include `shared/types/`, and the client also includes `shared/demo-data/` (with
  `metro.config.js` adding it to `watchFolders`, and `Dockerfile.web.dev` copying it into the image).
- **`axios.defaults.adapter` is not a function** - in axios 1.x it holds the candidate list
  (`['xhr', 'http', 'fetch']`) and one is picked per request. Casting it to `AxiosAdapter`
  compiles and then throws `fallback is not a function` at runtime. `client/api/loop.ts` wraps
  that adapter for demo mode and must resolve it with `axios.getAdapter()`.
- **React Compiler** enabled in adminClient via `babel-plugin-react-compiler`.
- **Admin uses `rolldown-vite`** instead of standard Vite (override in package.json).

## Conventions

- Prettier: 2-space indent, double quotes, trailing commas, 100 char print width, LF
- ESLint: flat config (`eslint.config.js`) in each package
- API uses `.js` extensions in imports with `moduleNameMapper` to strip them in tests
- Zod 4.x for validation (API uses 4.0.17, admin uses 4.3.5, client uses 4.1.5)
