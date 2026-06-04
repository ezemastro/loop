# Loop E2E Tests

End-to-end test suite for the Loop fullstack application. Tests cover API endpoints, Admin Panel UI, Landing page, and cross-package user journeys.

## Prerequisites

1. **Node.js 22+** installed
2. **PostgreSQL 16** running (via Docker or locally)
3. **API server** running on `http://localhost:3000`
4. **Admin dev server** running on `http://localhost:5173` (for admin UI tests)
5. **Landing dev server** running on `http://localhost:4321` (for landing tests)

## Quick Start

### 1. Install dependencies

```bash
cd e2e
npm install
```

### 2. Start the API server

```bash
# Terminal 1: Start database + API
cd server/api
npm run dev
```

The API should be accessible at `http://localhost:3000/status`.

### 3. (Optional) Start Admin Panel

```bash
# Terminal 2: Start admin dev server
cd adminClient
npm run dev
```

### 4. (Optional) Start Landing Page

```bash
# Terminal 3: Start landing dev server
cd landing
npm run dev
```

### 5. Install Playwright browsers

```bash
cd e2e
npx playwright install chromium
```

### 6. Run tests

```bash
cd e2e

# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test suites
npx playwright test --grep @api        # API only
npx playwright test --grep @admin      # Admin UI only
npx playwright test --grep @landing    # Landing only
npx playwright test --grep @fullstack  # Fullstack flows only

# Run specific test file
npx playwright test auth.api.spec.ts
npx playwright test listings.api.spec.ts
npx playwright test messages.api.spec.ts
npx playwright test admin.api.spec.ts
npx playwright test admin.admin.spec.ts
npx playwright test landing.landing.spec.ts
npx playwright test fullstack.fullstack.spec.ts

# Run with specific project
npx playwright test --project api
npx playwright test --project admin
npx playwright test --project landing
npx playwright test --project fullstack

# Debug a specific test
npx playwright test --debug
```

## Test Structure

```
e2e/
├── package.json              # E2E dependencies
├── playwright.config.ts      # Playwright configuration
├── fixtures.ts               # Shared test fixtures (DB, API clients, test data)
├── global-teardown.ts        # Database cleanup after all tests
└── tests/
    ├── auth.api.spec.ts          # Auth API tests (register, login, me)
    ├── listings.api.spec.ts      # Listings API tests (CRUD, offers)
    ├── messages.api.spec.ts      # Messages API tests (send, receive, read)
    ├── admin.api.spec.ts         # Admin API tests (users, schools, categories)
    ├── admin.admin.spec.ts       # Admin Panel UI tests (login, navigation)
    ├── landing.landing.spec.ts   # Landing page tests (SEO, a11y, responsive)
    └── fullstack.fullstack.spec.ts # Cross-package user journeys
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3000` | API server URL |
| `ADMIN_URL` | `http://localhost:5173` | Admin panel URL |
| `LANDING_URL` | `http://localhost:4321` | Landing page URL |
| `PGHOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `postgres` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `password` | PostgreSQL password |
| `POSTGRES_DB` | `db` | PostgreSQL database |

## Test Data

All tests use email addresses with the `e2e-` prefix (e.g., `e2e-user@loop.test`). The database is cleaned between test files to ensure isolation.

## Database Cleanup

- Tests clean up their own data where possible
- `global-teardown.ts` runs after all tests to remove any remaining `e2e-*` data
- Schools and categories created by tests are prefixed with `E2E` for easy identification

## CI Integration

To run in CI:

```bash
# Install dependencies
cd e2e && npm install

# Install Playwright browsers + system deps
npx playwright install --with-deps chromium

# Start API server in background
cd ../server/api && npm run dev &
sleep 10  # Wait for API to be ready

# Run tests
cd ../../e2e
npx playwright test --reporter=github
```

## Troubleshooting

### "Connection refused" errors
- Ensure the API server is running: `curl http://localhost:3000/status`
- Check PostgreSQL is running: `docker ps | grep postgres`

### "Database cleanup failed" errors
- Verify database credentials match `server/.env`
- Ensure the database schema is up to date

### Admin UI tests failing
- Ensure admin dev server is running on port 5173
- Check that the API is accessible from the admin server (CORS)

### Landing tests failing
- Ensure landing dev server is running on port 4321
- Some tests may skip if dev server is not available

## Coverage

| Area | Tests | Status |
|------|-------|--------|
| Auth API | 10 | ✅ |
| Listings API | 15 | ✅ |
| Messages API | 8 | ✅ |
| Admin API | 12 | ✅ |
| Admin UI | 8 | ✅ |
| Landing Page | 14 | ✅ |
| Fullstack Flows | 6 | ✅ |
| **Total** | **73** | |
