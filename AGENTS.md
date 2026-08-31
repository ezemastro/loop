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
npm run lint              # Lints all packages (sequential fallback, no workspaces)
npm run lint:fix          # Fixes lint in all packages
npm run format            # Prettier write (root config applies to all)
npm run format:check      # Prettier check
npm run docker:build      # Builds Docker images, bumps version from package.json
npm run docker:build:patch/npm run docker:build:minor/npm run docker:build:major  # Version bump + build
npm run docker:push       # Pushes images to registry
npm run start             # docker compose -f docker-compose.prod.yml up
npm run docker:deploy     # docker compose up -d --pull always
npm run dev:migrate       # Runs `npm run migrate` inside the dev `api` container
npm run dev:seed          # Seeds the 3 dev communities (see DEMO.md)
npm run dev:seed:demo     # Seeds only the demo community, same as production demo mode
```

### API (`server/api/`)

```
npm run dev               # nodemon + tsx, watches src/
npm run test              # Jest (ts-jest), NODE_ENV=test
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
npm run test              # jest-expo preset, --watchAll
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

- `compose.yml` - full stack: db, api, web, admin, backup (requires external `proxy-network`)
- `compose.caddy.yml` - Caddy reverse proxy for TLS
- `server/docker-compose.yml` - dev: db + api with watch mode sync
- `server/docker-compose.prod.yml` - prod: db + api + caddy
- `Dockerfile.api` - multi-stage: development → build (tsc) → production (node:22-alpine)
- `Dockerfile.web` - builds Expo web export, serves with `serve`
- `api.Dockerfile` does NOT exist (referenced in root scripts but missing)

## Testing

### API Tests (Jest, ts-jest)

Two Jest projects in `jest.config.js`:

1. **api** - integration tests: `server/api/src/tests/**/*.test.ts` (has globalTeardown for DB cleanup)
2. **unit** - unit tests: `**/*.test.ts` in models/, controllers/, routes/, utils/, services/

- `moduleNameMapper` strips `.js` extensions from imports
- `setupFilesAfterEnv` in `src/tests/setupAfterEnv.ts`
- Run from `server/api/` directory: `npm run test`

### Client Tests

- Uses `jest-expo` preset
- `npm run test` runs with `--watchAll` (interactive, not CI-friendly)

### E2E Tests (Playwright)

- Located in `e2e/` directory
- Requires API running on `localhost:3000`
- `cd e2e && npm install && npx playwright install chromium`
- `npx playwright test` runs all tests
- `npx playwright test --project api` for API-only tests
- `npx playwright test --project admin` for admin UI tests (requires admin dev server)
- `npx playwright test --project fullstack` for cross-package flows
- See `e2e/README.md` for full instructions

## Gotchas

- **No npm workspaces** - root `package.json` has no `workspaces` field. The `--workspace` flags in lint scripts silently fail and fall back to sequential `cd && npx eslint` commands.
- **API build uses `tsx` at runtime** - nodemon runs `npx tsx ./src/index.ts`, not compiled JS.
- **`api.Dockerfile` missing** - root `build:server` script references `api.Dockerfile` which does not exist. Use `Dockerfile.api` instead.
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
