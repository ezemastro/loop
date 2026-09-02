# Tasks: Database Integrity Migrations

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–700 (5 SQL migrations ~350, API ~120, tests + e2e helpers ~150) |
| Session review budget | Informative only this session — never a stop condition |
| 400-line budget risk | Med (exceeds the 400-line default; under the repo's configured 800) |
| Chained PRs recommended | No |
| Suggested split | None — single PR |
| Delivery strategy | single-pr / exception-ok |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Med

**Why no chain.** The five migrations share exactly one validation harness — a full
`npm run test:e2e` cycle against a database created fresh from `database_creation.sql` plus the
whole migration chain (`scripts/run-e2e.sh`). Splitting them would pay that cost five times and
leave intermediate branches whose database is half-hardened, which is a worse review artifact, not
a better one. The exception is taken deliberately under `exception-ok`.

### Suggested Work Units

| Unit | Goal | Branch | Focused test command | Runtime harness | Rollback boundary |
|------|------|--------|-----------------------|------------------|--------------------|
| 1 | Pre-flight audit + SEC-05 (`0009`) and API 409 mapping | `fix/auditoria-2026-09` | `cd server/api && npm run check-types && npx jest --ci auth` | `docker compose -f docker-compose.dev.yml up -d db` + `npm run dev:migrate` | `DROP INDEX idx_users_email_lower_uq` — fully reversible |
| 2 | ECO-01 DB half (`0010`) | `fix/auditoria-2026-09` | `psql` constraint probes (below) | Same dev stack | `DROP CONSTRAINT` ×2; clamped values are not restored |
| 3 | ECO-09 (`0011`) | `fix/auditoria-2026-09` | `npx playwright test --project=e2e` listing journey | e2e stack | Recreate the FK without `ON DELETE`; already-nulled columns are not restored |
| 4 | SEC-10 (`0012`) + e2e helper rewrite | `fix/auditoria-2026-09` | `npm run test:e2e` (verification flow) | e2e stack, `REQUIRE_EMAIL_VERIFICATION=true` | Migration and code revert **together** |
| 5 | SEC-09 (`0013`) + `assertDbHardening` + `rls.test.ts` | `fix/auditoria-2026-09` | `RUN_DB_TESTS=1 npx jest --ci rls` | Dev stack, then full e2e | Re-`GRANT` — fully reversible |

Environment: one branch, `fix/auditoria-2026-09`. Baseline for `server/api`'s Jest suite is known
stale/red (INF-06, `openspec/config.yaml`) — **record the failing count before touching anything**
and gate on "no new failures", not on green. `npm run check-types` (`tsc --noEmit`) is the real type
gate.

**Hard rules for every unit below.**
1. NEVER edit `0000`–`0008`. `migrate.ts:226-233` aborts the entire run on a SHA-256 mismatch of an
   applied migration. New behavior always means a new numbered file.
2. Follow the existing header convention: a comment block at the top explaining *why*, in the same
   voice as `0007`/`0008`.
3. Only use `-- migrate:no-transaction` when a statement genuinely cannot run in a transaction. None
   of `0009`–`0013` needs it — see design D1.
4. Every migration ends with a `-- ROLLBACK` comment block containing its down SQL.
5. Tooling: `rg` is available; `fd`/`bat`/`eza` are not.

---

## Phase 0: Baseline and pre-flight

- [x] 0.1 Record the current state: `cd server/api && npm run check-types` and
      `npx jest --ci 2>&1 | tail -30`. Write the failing-test count down; it is the gate for later
      phases. — Baseline recorded: `tsc --noEmit` clean; jest 24 failed / 20 skipped / 55 passed / 99
      total (`UPLOAD_DIR=/tmp/loop-uploads` needed — `/uploads` is not writable in this sandbox).
- [x] 0.2 Bring up a real database — *adapted*: used the session's disposable `loop-audit-db`
      container (real Postgres 16, `database_creation.sql` + `create_categories.sql` +
      `0000`–`0008` pre-applied) instead of `docker-compose.dev.yml`, per this apply batch's explicit
      instructions. Confirmed via `migrate.ts --status`: all nine existing migrations
      `[ aplicada  ]`.
- [x] 0.3 Create `server/scripts/audit-duplicate-emails.sql`: a read-only query returning each
      duplicated `lower(email)` with the row count, the row ids, and each row's `created_at`,
      `credits_balance` and listing count, so an operator can decide. — *email-identity-uniqueness:
      Migration Refuses To Deduplicate Silently*
- [x] 0.4 Run it against the dev database: zero duplicates on `loop-audit-db`. **Production could not
      be checked from this apply batch (no access)** — recorded as a hard operator prerequisite in
      design.md's Open Questions.

---

## Phase 1: SEC-05 — unique email (`0009`)

- [x] 1.1 Create `server/migrations/0009_unique_user_email.sql` with a header explaining that the
      duplicate check lived outside the transaction (`models/auth.ts:152-162`) and that the index is
      now the enforcement. — *email-identity-uniqueness: Case-Insensitive Uniqueness Is Enforced By
      The Database*
- [x] 1.2 In `0009`, add the `DO $$ … RAISE EXCEPTION $$` guard that aborts when any `lower(email)`
      group has more than one row, naming the offending addresses (design D1). It MUST NOT delete,
      merge, or rewrite any row. — *email-identity-uniqueness: "Duplicates abort the migration"*
- [x] 1.3 In `0009`, add `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_uq ON users
      (lower(email));` — **transactional, not `CONCURRENTLY`**.
  - **Checkpoint**: this deviates from `0005`'s `CONCURRENTLY` convention on purpose. The header
    must say why: atomicity with the duplicate check, and the invalid-index trap where a failed
    concurrent build plus `IF NOT EXISTS` leaves the database permanently unprotected while
    reporting success (design D1).
- [x] 1.4 Add the `-- ROLLBACK` block: `DROP INDEX IF EXISTS idx_users_email_lower_uq;`
- [x] 1.5 Apply and verify: applied on `loop-audit-db`; as `loop_app`, a case-variant duplicate
      (`ana@COLEGIO.edu.ar` after `Ana@colegio.edu.ar`) raised `23505` on `idx_users_email_lower_uq`;
      re-running the migration runner reported "Migraciones al día" (no-op).
- [x] 1.6 Extract a shared PostgreSQL error helper (new `server/api/src/services/pgErrors.ts`)
      exposing a constraint-name-aware unique-violation check. Replaced the local copy at
      `models/admin.ts:60-61` so exactly one exists.
- [x] 1.7 In `models/auth.ts`, wrap the `insertUser` call so a violation of
      `idx_users_email_lower_uq` is re-thrown as
      `ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS, "USER_ALREADY_EXISTS")`. The existing
      pre-check stays. — *email-identity-uniqueness: Unique Violations Map To HTTP 409*
- [x] 1.8 Do the same for the Google registration path (`createUserWithGoogle`,
      `queries.ts:93`). — *email-identity-uniqueness: "Both registration paths are covered"*
- [x] 1.9 Confirm the mapping discriminates by constraint name, so a `users_google_id_key` violation
      is NOT reported as `USER_ALREADY_EXISTS`. — `isUniqueViolation(err, "idx_users_email_lower_uq")`
      only matches that exact constraint; a `users_google_id_key` 23505 falls through and rethrows
      unchanged. — *email-identity-uniqueness: "A Google-id collision is not reported as an email
      conflict"*
- [x] 1.10 `cd server/api && npm run check-types`; confirm no new Jest failures versus 0.1. —
      `tsc --noEmit` clean; jest failures traced 1:1 to pre-existing issues (confirmed via
      `git stash` A/B comparison against the unmodified files), no new failures.

**Done condition**: duplicate registration returns 409 rather than 500, the index exists, and the
migration is a no-op on re-run.

---

## Phase 2: ECO-01 (DB half) — credit floors (`0010`)

> Scope guard: this phase adds constraints and cleans data. It changes **no** credit arithmetic.
> Relative updates, `FOR UPDATE`, and ledger writes belong to `credit-economy-integrity`.

- [x] 2.1 Create `server/migrations/0010_credit_balance_checks.sql` with a header noting that the
      application computes balances in JS and writes absolute values, so until
      `credit-economy-integrity` lands, these constraints turn silent corruption into a loud
      `23514`.
- [x] 2.2 In `0010`, clamp first: the `WITH fixed AS (UPDATE … GREATEST(…, 0) RETURNING …)` +
      `INSERT INTO wallet_transactions` statement from design D2. Use `type = 'admin'` (an existing
      enum value), `amount = 0`, the post-clamp `balance_after`, and a `meta` reason naming the
      migration. — *database-integrity-constraints: Pre-Existing Negative Balances Are Clamped And
      Recorded*
  - **Checkpoint**: `amount` is deliberately `0` — the true adjustment is unknowable because the
    negative value is itself corrupt, and inventing one would poison the ledger sums that
    `credit-economy-integrity` will reconcile against. Say so in the header.
- [x] 2.3 In `0010`, add the two separately named constraints
      `users_credits_balance_non_negative` and `users_credits_locked_non_negative`. **Not** a single
      combined `CHECK`, and **not** `NOT VALID` — see design D2. — *database-integrity-constraints:
      Credit Balances Are Non-Negative*
- [x] 2.4 Add the `-- ROLLBACK` block (two `DROP CONSTRAINT IF EXISTS`), noting that clamped values
      are not restored and the compensating ledger rows are the record.
- [x] 2.5 Apply on `loop-audit-db`. Verified by hand: `UPDATE users SET credits_balance = -1` →
      `23514` naming `users_credits_balance_non_negative`; `UPDATE users SET credits_locked = -5` →
      `23514` naming `users_credits_locked_non_negative`; `UPDATE ... SET credits_balance = 0`
      succeeded (zero is legal). — *database-integrity-constraints: "A negative balance is rejected
      at the storage layer"*
- [x] 2.6 Verify the clean path: `loop-audit-db` had zero pre-existing negative balances (fresh
      schema), so the clamp `WITH fixed AS (...)` matched zero rows and inserted zero
      `wallet_transactions` rows — confirmed by row counts before/after applying `0010`.
      — *database-integrity-constraints: "Healthy rows are untouched"*

**Done condition**: the database refuses a negative balance; any clamp performed has a matching
ledger row; no credit arithmetic was modified.

---

## Phase 3: ECO-09 — deletable listings (`0011`)

- [x] 3.1 Create `server/migrations/0011_message_listing_on_delete.sql` with a header explaining that
      `0004:105-107` created the composite FK with no `ON DELETE`, making any listing ever attached
      to a message undeletable (`queries.ts:217-221` → 500).
- [x] 3.2 In `0011`, drop and recreate `messages_attached_listing_community_fk` with
      `ON DELETE SET NULL ("attached_listing_id")` — the **column-list form**.
      — *database-integrity-constraints: Deleting An Attached Listing Detaches The Message*
  - **Checkpoint**: the column list is mandatory, not stylistic. A bare `ON DELETE SET NULL` on this
    composite FK would also null `community_id`, which is `NOT NULL` since `0004` and is the RLS
    discriminator — the delete would fail and the tenant boundary would be at risk. Requires
    PostgreSQL 15+; the stack is `postgres:16`. State this in the header.
- [x] 3.3 Add the `-- ROLLBACK` block (recreate the FK without the action), noting already-nulled
      values are not recoverable.
- [x] 3.4 Apply, then verify manually at the SQL level (direct DB test, not via the API — see
      "manual testing required" in the final report): created a listing, attached it to a message,
      `DELETE FROM listings WHERE id = ...` succeeded, the message row survived with
      `attached_listing_id` NULL and `community_id` unchanged.
      — *database-integrity-constraints: "The tenant discriminator is never nulled"*
- [x] 3.5 Confirmed no existing row was rejected during the constraint swap: `loop-audit-db` had no
      pre-existing `messages` rows referencing `attached_listing_id` at migration time, and the
      migration only dropped/recreated the constraint (no data rewrite). —
      *database-integrity-constraints: "Existing rows remain valid"*

**Done condition**: an attached listing deletes cleanly; the message keeps its text, its community
and its identity.

---

## Phase 4: SEC-10 — hashed, expiring tokens (`0012`)

- [x] 4.1 Create `server/migrations/0012_verification_token_hash.sql` with a header explaining the
      cleartext storage at `0008:10` and stating the transition rule plainly: outstanding tokens are
      **invalidated, not migrated** (design D4 — `pgcrypto` is absent so SQL cannot hash, and
      re-hashing an already-exposed secret buys nothing).
- [x] 4.2 In `0012`: add `email_verification_token_hash TEXT` and
      `email_verification_expires_at TIMESTAMPTZ`; `UPDATE users SET email_verification_token = NULL`
      for every non-null token; drop `idx_users_email_verification_token`; drop the
      `email_verification_token` column. — *email-verification-tokens: Tokens Are Stored Irreversibly,
      Outstanding Tokens Are Invalidated By The Migration*
- [x] 4.3 In `0012`, create the **unique** partial index
      `idx_users_email_verification_hash ON users (email_verification_token_hash) WHERE
      email_verification_token_hash IS NOT NULL`. — *email-verification-tokens: "The hash lookup is
      unique"* — verified: seeding the same hash on two different users raised `23505` on
      `idx_users_email_verification_hash`.
- [x] 4.4 Add the `-- ROLLBACK` block, flagging it as only partially reversible: hashes cannot be
      inverted, so every pending user must re-request a link, and the migration must revert together
      with the application code.
- [x] 4.5 In `services/queries.ts`, rewrite the four affected queries: `insertUser` writes the hash
      and `NOW() + INTERVAL '24 hours'`; `verifyUserEmail` matches
      `email_verification_token_hash = $1 AND email_verification_expires_at > NOW()` and clears both
      columns; `updateUserVerificationToken` writes hash + new expiry;
      `userEmailVerifiedAndTokenByEmail` stops selecting the token (it only needs to know whether one
      exists). — *email-verification-tokens: Tokens Expire After 24 Hours*
- [x] 4.6 In `models/auth.ts`, keep generating `crypto.randomBytes(32).toString("hex")`, send that
      cleartext in the email, and store only its `sha256` hex digest. Cover registration
      (`auth.ts:170-176`) and resend (`auth.ts:340-347`). Added `hashVerificationToken()` helper.
- [x] 4.7 Updated the `DB_Users` shared type so the dropped column is gone and the two new ones exist
      (`email_verification_token_hash`, `email_verification_expires_at`); `tsc --noEmit` clean.
- [x] 4.8 Rewrote `e2e/helpers/db.ts`: replaced `getVerificationTokenByEmail` with
      `seedVerificationToken(email, token)` and `seedExpiredVerificationToken(email, token)`, both
      writing `encode(sha256($2::bytea), 'hex')` through the existing owner pool.
      — *email-verification-tokens: The End-To-End Suite Exercises The Real Endpoint*
- [x] 4.9 Rewrote `e2e/helpers/api.ts` (`verifyUserEmail`) to generate a known token, seed its hash,
      and call the real `GET /auth/verify-email?token=<known>`. No mock, no bypass, no env-gated
      token-disclosing field. — *email-verification-tokens: "No test-only surface ships"*
- [x] 4.10 Added `verifyUserEmailExpired` helper plus a new e2e test ("un token de verificación
      vencido se rechaza...") in `01_onboarding_and_tenant.e2e.spec.ts` asserting an expired token is
      rejected and the account stays unverified. — *email-verification-tokens: "An expired token is
      refused"* — **not run** (see 4.11: full e2e stack could not be run in this session).
- [ ] 4.11 Run `npm run test:e2e` — **SKIPPED, not run**: the task instructions for this apply batch
      explicitly forbid running the full e2e stack ("would overload this machine"). Verified instead:
      (a) `npx playwright test --list` after `npm ci` in `e2e/` shows all 41 tests including the new
      one, parsing/loading cleanly; (b) `npx tsc --noEmit` and `npx eslint .` clean for the touched
      server files; (c) the hashing/expiry logic was validated directly against `loop-audit-db` at
      the SQL level (unique hash index, expiry column). **A human must run the real `npm run
      test:e2e` before merge** — see "manual testing required" in the final report.

**Done condition**: no cleartext token exists anywhere in the schema, expired tokens are refused,
and the e2e suite still drives the real verification endpoint.

---

## Phase 5: SEC-09 — least-privilege grants (`0013`)

> This is the phase that can break production. The grant matrix in design D5 was derived from every
> write statement in the repository; do not widen or narrow it without repeating that derivation.

- [x] 5.1 Re-verified the matrix against the code before writing SQL. Confirmed all three scoped
      `invitations` writes still exist (`queries.ts:726-731` via `models/auth.ts:208` and `:472`;
      `queries.ts:1048-1051` via `models/self.ts:516`) and that `lockInvitation`
      (`utils/invitations.ts:34` → `queries.ts:708-711`) still uses `SELECT … FOR UPDATE`.
- [x] 5.2 Create `server/migrations/0013_revoke_loop_app_dml.sql` with a header that states the
      matrix, records that the `0007:106-110` comment about `invitations` being read-only is stale,
      and warns that `SELECT … FOR UPDATE` requires the `UPDATE` privilege.
- [x] 5.3 In `0013`, `REVOKE ALL ON admins, admin_valid_emails FROM loop_app`.
      — *database-privilege-hardening: Scoped Role Holds No Privilege On Admin Tables* — verified:
      `SELECT * FROM admins` and `INSERT INTO admin_valid_emails` as `loop_app` both → "permission
      denied" (`42501`).
- [x] 5.4 In `0013`, `REVOKE INSERT, UPDATE, DELETE ON communities, community_email_domains FROM
      loop_app`, keeping `SELECT`. — *database-privilege-hardening: Community Catalog Is Read-Only
      For The Scoped Role* — verified: INSERT/UPDATE on `communities`, DELETE on
      `community_email_domains` all denied; `SELECT` on both retained.
- [x] 5.5 In `0013`, `REVOKE INSERT, DELETE ON invitations FROM loop_app` — **keep `SELECT` and
      `UPDATE`**. — *database-privilege-hardening: Invitations Retain SELECT And UPDATE For The
      Scoped Role* — verified both directions: INSERT/DELETE denied; `SELECT ... FOR UPDATE` +
      `UPDATE invitations SET used_by_user_id = ...` succeeded end to end.
  - **Checkpoint**: this is the single line that diverges from the audit's written recommendation.
    Applying the audit literally breaks invite registration and account self-deletion. The header
    must carry the evidence so a future reader does not "fix" it back.
- [x] 5.6 In `0013`, narrowed the default privileges: `ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE INSERT, UPDATE, DELETE ON TABLES FROM loop_app` (leaving `SELECT`, and leaving
      `loop_app_unscoped` untouched). Documented that every future migration adding a tenant table
      must now grant `loop_app` its DML explicitly. — verified: a fresh scratch table created after
      `0013` grants `loop_app` only `SELECT` by default, while `loop_app_unscoped` still gets full
      DML by default. — *database-privilege-hardening: Future Tables Do Not Inherit Write Privileges*
  - **Checkpoint**: used the same role-name indirection as `0007` — reads the role name from
    `current_setting('app.db_app_user', true)` inside a `DO $$` block rather than hardcoding
    `loop_app`.
- [x] 5.7 Add the `-- ROLLBACK` block: re-`GRANT SELECT, INSERT, UPDATE, DELETE` on the five tables
      and restore `0007`'s default privileges.
- [x] 5.8 Extended `assertDbHardening()` (`services/postgresClient.ts`) with a `LOOP_APP_GRANT_MATRIX`
      + `has_table_privilege` check expressing the full matrix in both directions — including that
      `UPDATE` on `invitations` is **present**. Appended to the existing `problems` array so the
      production-throw / dev-warn behavior is reused; role, RLS and fail-closed probe checks left
      intact. — *database-privilege-hardening: The Boot Assertion Verifies The Grant Matrix*
- [x] 5.9 Applied `0013` on `loop-audit-db` and confirmed `assertDbHardening()` reports **no**
      warning against the correct matrix (verified in both `NODE_ENV=development` and
      `NODE_ENV=production`).
- [x] 5.10 Extended `server/api/src/tests/rls.test.ts` (gated on `RUN_DB_TESTS=1`) with **denial**
      assertions: as `loop_app`, each of `SELECT FROM admins`, `INSERT INTO admin_valid_emails`,
      `INSERT INTO communities`, `UPDATE communities`, `DELETE FROM community_email_domains`,
      `INSERT INTO invitations`, `DELETE FROM invitations` fails with `42501`.
- [x] 5.11 Extended `rls.test.ts` with **retention** assertions: as `loop_app`, `SELECT` on
      `communities` and `community_email_domains` succeeds, and `SELECT … FOR UPDATE` plus
      `UPDATE invitations SET used_by_user_id = …` both succeed. — *database-privilege-hardening:
      "Invite registration completes"*
  - **Note**: `rls.test.ts` fixture writes go through the owner client, which is RLS- and
    grant-exempt, so seeding is unaffected by the revoke. Also added admin/invitation fixtures and
    fixed the `afterAll` deletion order (`invitations` before `admins`, both before `communities` —
    `invitations.created_by_admin_id` has no `ON DELETE`, see engram "RLS test afterAll FK ordering
    fix").
- [x] 5.12 Ran the gated suite against `loop-audit-db`:
      `RUN_DB_TESTS=1 <env> npx jest --ci --testPathPatterns 'rls.test'` — **17/17 passed** (the
      original 8 plus the 9 new SEC-09 matrix tests), exits cleanly with no forced-exit or hang.
- [x] 5.13 Negative control on `loop-audit-db`: `REVOKE UPDATE ON invitations FROM loop_app`,
      confirmed `assertDbHardening()` reports the missing privilege in dev (warn) and throws
      non-zero-exit in production mode; then `GRANT UPDATE ON invitations TO loop_app` restored the
      matrix, re-confirmed clean. — *database-privilege-hardening: "An over-narrow revoke is caught
      at boot"*

**Done condition**: the matrix holds in both directions, the boot assertion enforces it, and invite
registration still works end to end.

---

## Phase 6: Full validation and close-out

- [ ] 6.1 Full fresh-database run: `npm run test:e2e` — **SKIPPED, not run in this session** per
      explicit apply-batch instructions (would overload this machine). **Requires a human/CI run
      before merge** — see "manual testing required" in the final report.
- [x] 6.2 Idempotence: ran the migration runner twice in a row against `loop-audit-db`; the second run
      reported "Migraciones al día" (nothing pending). `migrate.ts --status` — all fourteen (`0000`–
      `0013`) read `[ aplicada  ]`, none `[ CHECKSUM! ]`.
- [x] 6.3 Confirmed `server/database_creation.sql` and `server/migrations/0000`–`0008` are
      **untouched**: `git diff --stat` against those exact paths returns empty.
- [x] 6.4 `cd server/api && npx tsc --noEmit` clean. Jest: full-suite failure count is not directly
      comparable to the 0.1 baseline because concurrent SDD work on this same branch/session
      restructured `server/api/src/tests/` (removed `roles.test.ts`, `schools.test.ts`,
      `users.test.ts`, the old integration `tests/auth.test.ts`, and the `setupAfterEnv`/`teardown`
      wiring) independently of this change. Every failure this apply batch's own files touch
      (`models/auth.test.ts`, `services/postgresClient.test.ts`) was confirmed via `git stash`
      A/B-diffing against the unmodified original files to be **pre-existing**, not introduced here.
- [x] 6.5 `npx prettier --check` clean on all changed TS files in both `server/api` and `e2e`
      (fixed one formatting drift each in `auth.ts`, `postgresClient.ts`, `rls.test.ts`, and the new
      e2e onboarding test via `eslint --fix`/`prettier --write`).
- [x] 6.6 Re-read each of `0009`–`0013`: all five carry a trailing `-- ROLLBACK` comment block with
      working down SQL (or an explicit partial-reversibility note for `0012`).
- [x] 6.7 Saved the outcome to Engram, topic key `sdd/db-integrity-migrations/apply-progress`,
      project `loop`, including the SEC-09 `invitations` exception.

**Done condition**: the full e2e cycle passes on a database built from scratch, migrations are
idempotent and checksum-clean, and no applied migration was edited.
