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

- [ ] 0.1 Record the current state: `cd server/api && npm run check-types` and
      `npx jest --ci 2>&1 | tail -30`. Write the failing-test count down; it is the gate for later
      phases.
- [ ] 0.2 Bring up a real database: `docker compose -f docker-compose.dev.yml up -d db`, then
      `npm run dev:migrate`, then
      `docker compose -f docker-compose.dev.yml exec api npm run migrate:status` — confirm
      `0000`–`0008` all read `[ aplicada  ]`.
- [ ] 0.3 Create `server/scripts/audit-duplicate-emails.sql`: a read-only query returning each
      duplicated `lower(email)` with the row count, the row ids, and each row's `created_at`,
      `credits_balance` and listing count, so an operator can decide. — *email-identity-uniqueness:
      Migration Refuses To Deduplicate Silently*
- [ ] 0.4 Run it against the dev database and, separately, request that it be run against
      production. **If production has duplicates, `0009` will abort by design** — resolution is an
      operator decision and is a prerequisite, not part of this change. Record the result in
      design.md's Open Questions.

---

## Phase 1: SEC-05 — unique email (`0009`)

- [ ] 1.1 Create `server/migrations/0009_unique_user_email.sql` with a header explaining that the
      duplicate check lived outside the transaction (`models/auth.ts:152-162`) and that the index is
      now the enforcement. — *email-identity-uniqueness: Case-Insensitive Uniqueness Is Enforced By
      The Database*
- [ ] 1.2 In `0009`, add the `DO $$ … RAISE EXCEPTION $$` guard that aborts when any `lower(email)`
      group has more than one row, naming the offending addresses (design D1). It MUST NOT delete,
      merge, or rewrite any row. — *email-identity-uniqueness: "Duplicates abort the migration"*
- [ ] 1.3 In `0009`, add `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_uq ON users
      (lower(email));` — **transactional, not `CONCURRENTLY`**.
  - **Checkpoint**: this deviates from `0005`'s `CONCURRENTLY` convention on purpose. The header
    must say why: atomicity with the duplicate check, and the invalid-index trap where a failed
    concurrent build plus `IF NOT EXISTS` leaves the database permanently unprotected while
    reporting success (design D1).
- [ ] 1.4 Add the `-- ROLLBACK` block: `DROP INDEX IF EXISTS idx_users_email_lower_uq;`
- [ ] 1.5 Apply and verify: `npm run dev:migrate`; then as `loop_app` confirm a duplicate insert
      raises `23505`, and run `npm run dev:migrate` again to confirm it is a no-op.
- [ ] 1.6 Extract a shared PostgreSQL error helper (new `server/api/src/services/pgErrors.ts` or
      alongside `services/errors.ts`) exposing a constraint-name-aware unique-violation check.
      Replace the local copy at `models/admin.ts:60-61` so exactly one exists.
- [ ] 1.7 In `models/auth.ts`, wrap the `insertUser` call so a violation of
      `idx_users_email_lower_uq` is re-thrown as
      `ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS, "USER_ALREADY_EXISTS")`. The existing
      pre-check stays. — *email-identity-uniqueness: Unique Violations Map To HTTP 409*
- [ ] 1.8 Do the same for the Google registration path (`createUserWithGoogle`,
      `queries.ts:93`). — *email-identity-uniqueness: "Both registration paths are covered"*
- [ ] 1.9 Confirm the mapping discriminates by constraint name, so a `users_google_id_key` violation
      is NOT reported as `USER_ALREADY_EXISTS`. — *email-identity-uniqueness: "A Google-id collision
      is not reported as an email conflict"*
- [ ] 1.10 `cd server/api && npm run check-types`; confirm no new Jest failures versus 0.1.

**Done condition**: duplicate registration returns 409 rather than 500, the index exists, and the
migration is a no-op on re-run.

---

## Phase 2: ECO-01 (DB half) — credit floors (`0010`)

> Scope guard: this phase adds constraints and cleans data. It changes **no** credit arithmetic.
> Relative updates, `FOR UPDATE`, and ledger writes belong to `credit-economy-integrity`.

- [ ] 2.1 Create `server/migrations/0010_credit_balance_checks.sql` with a header noting that the
      application computes balances in JS and writes absolute values, so until
      `credit-economy-integrity` lands, these constraints turn silent corruption into a loud
      `23514`.
- [ ] 2.2 In `0010`, clamp first: the `WITH fixed AS (UPDATE … GREATEST(…, 0) RETURNING …)` +
      `INSERT INTO wallet_transactions` statement from design D2. Use `type = 'admin'` (an existing
      enum value), `amount = 0`, the post-clamp `balance_after`, and a `meta` reason naming the
      migration. — *database-integrity-constraints: Pre-Existing Negative Balances Are Clamped And
      Recorded*
  - **Checkpoint**: `amount` is deliberately `0` — the true adjustment is unknowable because the
    negative value is itself corrupt, and inventing one would poison the ledger sums that
    `credit-economy-integrity` will reconcile against. Say so in the header.
- [ ] 2.3 In `0010`, add the two separately named constraints
      `users_credits_balance_non_negative` and `users_credits_locked_non_negative`. **Not** a single
      combined `CHECK`, and **not** `NOT VALID` — see design D2. — *database-integrity-constraints:
      Credit Balances Are Non-Negative*
- [ ] 2.4 Add the `-- ROLLBACK` block (two `DROP CONSTRAINT IF EXISTS`), noting that clamped values
      are not restored and the compensating ledger rows are the record.
- [ ] 2.5 Apply on the dev stack. Then verify by hand:
      `docker compose -f docker-compose.dev.yml exec db psql -U postgres -d loop_db -c "UPDATE users SET credits_balance = -1 WHERE id = (SELECT id FROM users LIMIT 1);"`
      → expect `23514` naming `users_credits_balance_non_negative`. Repeat for `credits_locked`.
      — *database-integrity-constraints: "A negative balance is rejected at the storage layer"*
- [ ] 2.6 Verify the clean path: on a database with no negative balances, confirm zero `users` rows
      and zero `wallet_transactions` rows were touched. — *database-integrity-constraints: "Healthy
      rows are untouched"*

**Done condition**: the database refuses a negative balance; any clamp performed has a matching
ledger row; no credit arithmetic was modified.

---

## Phase 3: ECO-09 — deletable listings (`0011`)

- [ ] 3.1 Create `server/migrations/0011_message_listing_on_delete.sql` with a header explaining that
      `0004:105-107` created the composite FK with no `ON DELETE`, making any listing ever attached
      to a message undeletable (`queries.ts:217-221` → 500).
- [ ] 3.2 In `0011`, drop and recreate `messages_attached_listing_community_fk` with
      `ON DELETE SET NULL ("attached_listing_id")` — the **column-list form**.
      — *database-integrity-constraints: Deleting An Attached Listing Detaches The Message*
  - **Checkpoint**: the column list is mandatory, not stylistic. A bare `ON DELETE SET NULL` on this
    composite FK would also null `community_id`, which is `NOT NULL` since `0004` and is the RLS
    discriminator — the delete would fail and the tenant boundary would be at risk. Requires
    PostgreSQL 15+; the stack is `postgres:16`. State this in the header.
- [ ] 3.3 Add the `-- ROLLBACK` block (recreate the FK without the action), noting already-nulled
      values are not recoverable.
- [ ] 3.4 Apply, then verify manually: create a listing, attach it to a message, call
      `DELETE /listings/:id` as the owner, and confirm 2xx plus the message surviving with
      `attached_listing_id IS NULL` and `community_id` unchanged.
      — *database-integrity-constraints: "The tenant discriminator is never nulled"*
- [ ] 3.5 Confirm no existing row was rejected during the constraint swap (the constraint is only
      loosened). — *database-integrity-constraints: "Existing rows remain valid"*

**Done condition**: an attached listing deletes cleanly; the message keeps its text, its community
and its identity.

---

## Phase 4: SEC-10 — hashed, expiring tokens (`0012`)

- [ ] 4.1 Create `server/migrations/0012_verification_token_hash.sql` with a header explaining the
      cleartext storage at `0008:10` and stating the transition rule plainly: outstanding tokens are
      **invalidated, not migrated** (design D4 — `pgcrypto` is absent so SQL cannot hash, and
      re-hashing an already-exposed secret buys nothing).
- [ ] 4.2 In `0012`: add `email_verification_token_hash TEXT` and
      `email_verification_expires_at TIMESTAMPTZ`; `UPDATE users SET email_verification_token = NULL`
      for every non-null token; drop `idx_users_email_verification_token`; drop the
      `email_verification_token` column. — *email-verification-tokens: Tokens Are Stored Irreversibly,
      Outstanding Tokens Are Invalidated By The Migration*
- [ ] 4.3 In `0012`, create the **unique** partial index
      `idx_users_email_verification_hash ON users (email_verification_token_hash) WHERE
      email_verification_token_hash IS NOT NULL`. — *email-verification-tokens: "The hash lookup is
      unique"*
- [ ] 4.4 Add the `-- ROLLBACK` block, flagging it as only partially reversible: hashes cannot be
      inverted, so every pending user must re-request a link, and the migration must revert together
      with the application code.
- [ ] 4.5 In `services/queries.ts`, rewrite the four affected queries: `insertUser` writes the hash
      and `NOW() + INTERVAL '24 hours'`; `verifyUserEmail` matches
      `email_verification_token_hash = $1 AND email_verification_expires_at > NOW()` and clears both
      columns; `updateUserVerificationToken` writes hash + new expiry;
      `userEmailVerifiedAndTokenByEmail` stops selecting the token (it only needs to know whether one
      exists). — *email-verification-tokens: Tokens Expire After 24 Hours*
- [ ] 4.6 In `models/auth.ts`, keep generating `crypto.randomBytes(32).toString("hex")`, send that
      cleartext in the email, and store only its `sha256` hex digest. Cover registration
      (`auth.ts:170-176`) and resend (`auth.ts:340-347`).
- [ ] 4.7 Update the `DB_Users` shared type so the dropped column is gone and the two new ones exist;
      run `npm run check-types`.
- [ ] 4.8 Rewrite `e2e/helpers/db.ts`: replace `getVerificationTokenByEmail` (`:49-53`) with
      `seedVerificationToken(email, token)` that writes
      `encode(sha256($2::bytea), 'hex')` plus a 24 h expiry through the existing owner pool.
      `sha256()` is a PostgreSQL built-in — do **not** add `pgcrypto`.
      — *email-verification-tokens: The End-To-End Suite Exercises The Real Endpoint*
- [ ] 4.9 Rewrite `e2e/helpers/api.ts:70-79` (`verifyUserEmail`) to seed a known token and then call
      the real `GET /auth/verify-email?token=<known>`. Do not mock or bypass the endpoint, and do not
      add any env-gated response field that discloses a token.
      — *email-verification-tokens: "No test-only surface ships"*
- [ ] 4.10 Add an expiry test to the e2e suite: seed a token with an expiry in the past and assert
      verification fails. — *email-verification-tokens: "An expired token is refused"*
- [ ] 4.11 Run `npm run test:e2e` (full fresh-database cycle, `REQUIRE_EMAIL_VERIFICATION=true` per
      `docker-compose.e2e.yml:87`). This is the gate for the whole phase.

**Done condition**: no cleartext token exists anywhere in the schema, expired tokens are refused,
and the e2e suite still drives the real verification endpoint.

---

## Phase 5: SEC-09 — least-privilege grants (`0013`)

> This is the phase that can break production. The grant matrix in design D5 was derived from every
> write statement in the repository; do not widen or narrow it without repeating that derivation.

- [ ] 5.1 Re-verify the matrix against the code before writing SQL. Confirm all three scoped
      `invitations` writes still exist (`queries.ts:726-731` via `models/auth.ts:208` and `:472`;
      `queries.ts:1048-1051` via `models/self.ts:516`) and that `lockInvitation`
      (`utils/invitations.ts:34` → `queries.ts:708-711`) still uses `SELECT … FOR UPDATE`.
- [ ] 5.2 Create `server/migrations/0013_revoke_loop_app_dml.sql` with a header that states the
      matrix, records that the `0007:106-110` comment about `invitations` being read-only is stale,
      and warns that `SELECT … FOR UPDATE` requires the `UPDATE` privilege.
- [ ] 5.3 In `0013`, `REVOKE ALL ON admins, admin_valid_emails FROM loop_app`.
      — *database-privilege-hardening: Scoped Role Holds No Privilege On Admin Tables*
- [ ] 5.4 In `0013`, `REVOKE INSERT, UPDATE, DELETE ON communities, community_email_domains FROM
      loop_app`, keeping `SELECT`. — *database-privilege-hardening: Community Catalog Is Read-Only
      For The Scoped Role*
- [ ] 5.5 In `0013`, `REVOKE INSERT, DELETE ON invitations FROM loop_app` — **keep `SELECT` and
      `UPDATE`**. — *database-privilege-hardening: Invitations Retain SELECT And UPDATE For The
      Scoped Role*
  - **Checkpoint**: this is the single line that diverges from the audit's written recommendation.
    Applying the audit literally breaks invite registration and account self-deletion. The header
    must carry the evidence so a future reader does not "fix" it back.
- [ ] 5.6 In `0013`, narrow the default privileges: `ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE INSERT, UPDATE, DELETE ON TABLES FROM loop_app` (leaving `SELECT`, and leaving
      `loop_app_unscoped` untouched). Document that every future migration adding a tenant table
      must now grant `loop_app` its DML explicitly.
      — *database-privilege-hardening: Future Tables Do Not Inherit Write Privileges*
  - **Checkpoint**: use the same role-name indirection as `0007` — read the role names from
    `current_setting('app.db_app_user', true)` inside a `DO $$` block rather than hardcoding
    `loop_app`, so a deployment that renamed its roles still migrates.
- [ ] 5.7 Add the `-- ROLLBACK` block: re-`GRANT SELECT, INSERT, UPDATE, DELETE` on the five tables
      and restore `0007`'s default privileges.
- [ ] 5.8 Extend `assertDbHardening()` (`services/postgresClient.ts:208-258`) with a
      `has_table_privilege` check expressing the matrix, asserting both directions — including that
      `UPDATE` on `invitations` is **present**. Append to the existing `problems` array so the
      production-throw / dev-warn behavior at `:253-257` is reused, and leave the role, RLS and
      fail-closed probe checks intact.
      — *database-privilege-hardening: The Boot Assertion Verifies The Grant Matrix*
- [ ] 5.9 Apply `0013` on the dev stack and confirm the API still boots with no hardening warning.
- [ ] 5.10 Extend `server/api/src/tests/rls.test.ts` (gated on `RUN_DB_TESTS=1`) with **denial**
      assertions: as `loop_app`, each of `SELECT FROM admins`, `INSERT INTO admin_valid_emails`,
      `INSERT INTO communities`, `UPDATE communities`, `DELETE FROM community_email_domains`,
      `INSERT INTO invitations`, `DELETE FROM invitations` fails with `42501`.
- [ ] 5.11 Extend `rls.test.ts` with **retention** assertions: as `loop_app`, `SELECT` on
      `communities` and `community_email_domains` succeeds, and `SELECT … FOR UPDATE` plus
      `UPDATE invitations SET used_by_user_id = …` both succeed. These are what stop a future
      cleanup from re-breaking registration. — *database-privilege-hardening: "Invite registration
      completes"*
  - **Note**: `rls.test.ts` fixture writes go through the owner client (`:35`, `:61`, `:108`), which
    is RLS- and grant-exempt, so seeding is unaffected by the revoke.
- [ ] 5.12 Run the gated suite:
      `docker compose -f docker-compose.dev.yml exec -e RUN_DB_TESTS=1 api npx jest --ci src/tests/rls.test.ts`
      — confirm the original 8 tests still pass alongside the new ones.
- [ ] 5.13 Negative control: in a scratch database only, `REVOKE UPDATE ON invitations FROM
      loop_app` and confirm `assertDbHardening()` reports it. Restore afterwards.
      — *database-privilege-hardening: "An over-narrow revoke is caught at boot"*

**Done condition**: the matrix holds in both directions, the boot assertion enforces it, and invite
registration still works end to end.

---

## Phase 6: Full validation and close-out

- [ ] 6.1 Full fresh-database run: `npm run test:e2e`. This builds the database from
      `database_creation.sql` + `create_categories.sql` via `e2e/Dockerfile.db-init`, applies
      `0000`–`0013` through the `migrate` service, and runs the Playwright suite. It is the single
      authoritative gate for this change.
- [ ] 6.2 Idempotence: `npm run dev:migrate` twice in a row on the dev stack; the second run reports
      nothing pending. Then `npm run migrate:status` — all thirteen read `[ aplicada  ]` with no
      `[ CHECKSUM! ]`.
- [ ] 6.3 Confirm `server/database_creation.sql` and `server/migrations/0000`–`0008` are **untouched**
      in the diff (`git diff --stat`). Any change there is a defect — see design D0 and the checksum
      guard.
- [ ] 6.4 `cd server/api && npm run check-types`; confirm no new Jest failures versus the 0.1
      baseline.
- [ ] 6.5 `npx prettier --check` on the changed TS files.
- [ ] 6.6 Re-read each migration header and confirm every one carries its `-- ROLLBACK` block.
- [ ] 6.7 Save the outcome to Engram with topic key `sdd/loop/db-integrity-migrations`, project
      `loop`, including the SEC-09 `invitations` exception so it is not lost.

**Done condition**: the full e2e cycle passes on a database built from scratch, migrations are
idempotent and checksum-clean, and no applied migration was edited.
