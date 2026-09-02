# Proposal: Database Integrity Migrations

## Intent

The 2026-09 audit found five defects whose common shape is the same: the invariant exists only in
application code, so any race, any refactor, or any SQL injection on the scoped path can corrupt
the data. `users.email` has no UNIQUE constraint and is checked in a separate connection before the
insert (`models/auth.ts:152-162`). `credits_balance`/`credits_locked` have no floor
(`database_creation.sql:33-34`). `messages.attached_listing_id` has a composite FK with no
`ON DELETE` action, so a listing that was ever attached to a message can never be deleted
(`0004_not_null_and_fks.sql:105-107`). Email verification tokens are stored in cleartext and never
expire (`0008_email_verification.sql:10`). The `loop_app` role holds DML on five tables that have
no RLS (`0007_db_roles_and_rls.sql:46-52`).

This change moves those five invariants **into the database**, where they hold regardless of what
the application code does. It is deliberately the *first* block of the audit remediation: once the
constraints exist, the application-side credit rewrite (`credit-economy-integrity`) can be applied
against a database that already refuses to store a corrupt value.

## Scope

### In Scope

- **SEC-05** — deduplication audit + `CREATE UNIQUE INDEX ON users (lower(email))`, and mapping
  PostgreSQL `23505` to a 409 `USER_ALREADY_EXISTS` on the registration paths.
- **ECO-01 (DB half only)** — `CHECK (credits_balance >= 0)` and `CHECK (credits_locked >= 0)` on
  `users`, plus the data cleanup that makes them valid.
- **ECO-09** — `ON DELETE SET NULL` on the `messages_attached_listing_community_fk` composite FK.
- **SEC-10** — hashed verification token column + `expires_at` (24 h), with a transition plan for
  tokens already issued, and the e2e helper rewrite that hashing forces.
- **SEC-09** — least-privilege `REVOKE` for `loop_app` on the five non-RLS tables, keeping `SELECT`
  on `communities` and `community_email_domains` **and `SELECT` + `UPDATE` on `invitations`**
  (the audit's proposed blanket revoke would break invite registration — see design D5), plus the
  `ALTER DEFAULT PRIVILEGES` correction and a new grant assertion in `assertDbHardening()`.
- Migration validation against a real PostgreSQL 16 via `docker-compose.dev.yml` and
  `docker-compose.e2e.yml`, including the RLS test suite.

### Out of Scope

- All application-side credit logic: relative `UPDATE`s, `SELECT … FOR UPDATE`, ledger writes,
  `balance_after`, reconciliation jobs, concurrency tests. Owned by `credit-economy-integrity`.
  This change lands the constraint; it does not change how a single credit is computed.
- Every SEC id not listed above (SEC-01…04, 06…08, 11…16). Owned by `sec-hardening-api`.
- Password reset / change-password flows (SEC-06, SEC-11), even though they share the token table.
- Rate limiting and JWT expiry (already recorded as deferred repo-wide work).
- Soft-delete (`listings.disabled`) as an alternative to ECO-09 — rejected in design D3.
- Editing `server/database_creation.sql` — see design D0; the repo does not mirror migrations there.

## Capabilities

### New Capabilities

- `email-identity-uniqueness`: one account per email address, enforced case-insensitively by the
  database, and the API contract for the resulting conflict.
- `database-integrity-constraints`: non-negative credit balances as a storage-level invariant, and
  the referential behavior of a deleted listing that is attached to a message.
- `email-verification-tokens`: verification tokens are stored irreversibly and expire.
- `database-privilege-hardening`: the least-privilege grant matrix for `loop_app` and
  `loop_app_unscoped`, and the boot-time assertion that guards it.

### Modified Capabilities

- None. `openspec/specs/` is empty; the RLS behavior established by migration `0007` is described
  here for the first time, as new spec text scoped to privileges only.

## Approach

**Five migrations, not one.** `0009` … `0013`, one per audit id, each independently revertible and
each with its own documented down SQL. A single combined migration would make the rollback of the
riskiest item (SEC-09's REVOKE) impossible without also reverting the safe ones.

**Fail loud, never mutate identity silently.** Two of the five constraints can find pre-existing
conflicting rows. For duplicate emails the migration `RAISE`s with the offending addresses rather
than picking a winner: a duplicate row owns listings, messages, credits and possibly a distinct
human, and no automatic merge rule is safe. For negative balances the migration clamps to `0` and
writes a compensating `wallet_transactions` row, because a negative balance is unambiguously a bug
and the ledger can record the correction. Both rules are argued in design D1 and D2.

**Migrations are the schema's only source of truth.** `server/database_creation.sql` is the
`docker-entrypoint-initdb.d` base image only (`e2e/Dockerfile.db-init`) and was *never* updated in
lockstep: it has no `community_id`, no composite FKs, and none of `0008`'s columns. Mirroring five
new migrations into it now would be a new convention, not a continuation of the existing one.

**SEC-09 is the one item that can break production at runtime.** It is sequenced last, gated on an
explicit grant-matrix derivation from the code, and shipped with an extended `rls.test.ts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/migrations/0009_unique_user_email.sql` | New | Dedup audit + unique index on `lower(email)` |
| `server/migrations/0010_credit_balance_checks.sql` | New | Clamp negatives + two `CHECK` constraints |
| `server/migrations/0011_message_listing_on_delete.sql` | New | Recreate FK with `ON DELETE SET NULL` |
| `server/migrations/0012_verification_token_hash.sql` | New | Hash column + `expires_at`, drop cleartext |
| `server/migrations/0013_revoke_loop_app_dml.sql` | New | `REVOKE` + `ALTER DEFAULT PRIVILEGES` fix |
| `server/api/src/models/auth.ts` | Modified | Map `23505` → `ConflictError`; hash + expire tokens |
| `server/api/src/services/queries.ts` | Modified | Token queries move to hash + `expires_at` |
| `server/api/src/services/dbHardening.ts` (or its home) | Modified | Assertion follows the new matrix |
| `server/api/src/tests/rls.test.ts` | Modified | Assert the revoked writes are denied |
| `e2e/helpers/db.ts`, `e2e/helpers/api.ts` | Modified | Cannot read a hashed token; seed a known one |
| `server/database_creation.sql` | Unchanged | Deliberate — see design D0 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SEC-09 `REVOKE` breaks registration or invitations at runtime | **Confirmed** for the audit's literal proposal | The grant matrix was derived from every write statement in the code *before* writing SQL and found the `invitations` exception (D5). `rls.test.ts` is extended to assert each revoked write is denied *and* that the retained `invitations` lock/consume still works; a full e2e run is the gate |
| `assertDbHardening()` does not inspect grants, so a bad REVOKE surfaces only as a runtime `42501` | High | `postgresClient.ts:208-258` checks `rolsuper`/`rolbypassrls`, `relrowsecurity` on `TENANT_TABLES`, and a fail-closed probe — none of which see grants. A `has_table_privilege` assertion is added (D6) |
| `account_deletion_requests` is also written on the scoped path | N/A here | Out of scope by design; recorded as a follow-up so a later privilege pass does not repeat the SEC-09 mistake |
| Production already holds duplicate emails, so `0009` aborts the deploy | Med | Pre-flight audit query is run and resolved by an operator *before* the migration ships; the abort is the designed behavior, not a failure |
| `CREATE UNIQUE INDEX` takes an `ACCESS EXCLUSIVE` lock on `users` | Low | Table is small (single-community deployment); non-concurrent build chosen deliberately for atomicity — see D1 |
| Hashing tokens breaks the e2e suite | Certain | Already confirmed: `e2e/helpers/api.ts:70-79` reads the cleartext column. The helper seeds a known token's hash instead — see D4 |
| Tokens issued before `0012` stop working | Certain | Intended. Outstanding tokens are invalidated; the existing resend endpoint reissues — see D4 |
| `ALTER DEFAULT PRIVILEGES` from `0007` silently re-grants DML on future tables | Med | `0013` corrects the default privileges too, not just the current grants |
| A migration is edited after being applied | Low | Runner aborts on SHA-256 checksum mismatch (`migrate.ts`); tasks forbid it explicitly |

## Rollback Plan

Every migration carries its down SQL in a trailing comment block (the runner is forward-only, so
rollback is a deliberate operator action, and a *new* migration is required to re-apply). Ordered
from safest to revert to most urgent:

- `0013` — re-`GRANT` the DML. One statement, restores the pre-change privilege set exactly.
- `0011` — recreate the FK without `ON DELETE`. Note: rows already nulled are not recoverable.
- `0010` — `DROP CONSTRAINT`. Clamped balances are not restored; the compensating ledger rows are
  the audit trail.
- `0009` — `DROP INDEX`. Fully reversible.
- `0012` — most expensive to revert: the cleartext column is gone and hashes cannot be inverted.
  Reverting means every unverified user must re-request a link. Acceptable because
  `REQUIRE_EMAIL_VERIFICATION` is off by default in production today.

The application-side changes revert as a normal code revert, but `0012`'s code and migration must
revert **together** — the API cannot read a dropped column.

## Dependencies

- Migration `0007` applied (roles `loop_app` / `loop_app_unscoped` exist).
- `DB_APP_PASSWORD` and `DB_UNSCOPED_PASSWORD` present in the migration runner's environment
  (`0007` `RAISE`s otherwise) — already true for both compose files.
- A duplicate-email audit run against the production database, resolved, before `0009` ships.
- No dependency on `credit-economy-integrity`; that block depends on **this** one.

## Size Forecast and Delivery

Forecast: **~550–700 changed lines** — five SQL migrations (~350), the API changes for SEC-05 and
SEC-10 (~120), test and e2e helper changes (~150). Under the configured 800-line budget.

Single PR on `fix/auditoria-2026-09`, per the session's `single-pr` delivery strategy.
Chained PRs are **not** recommended: the five migrations share one validation harness (a full
`npm run test:e2e` cycle against a fresh database), and splitting them would mean paying that
harness cost five times while leaving intermediate branches whose database state is half-hardened.

## Success Criteria

- [ ] `npm run migrate` applies `0009`–`0013` cleanly on a database created from
      `database_creation.sql` + `0000`–`0008`, and is a no-op on a second run.
- [ ] Two concurrent registrations with the same email produce exactly one row and one 409.
- [ ] `UPDATE users SET credits_balance = -1` is rejected by the database.
- [ ] `DELETE /listings/:id` succeeds for a listing attached to a message and returns 204/200, with
      the message's `attached_listing_id` set to `NULL`.
- [ ] No cleartext verification token exists in `users`; an expired token is rejected.
- [ ] `loop_app` holds no privilege at all on `admins` and `admin_valid_emails`; holds `SELECT` only
      on `communities` and `community_email_domains`; holds `SELECT` + `UPDATE` only on
      `invitations`; and registration with an invite token still succeeds end to end.
- [ ] `RUN_DB_TESTS=1` `rls.test.ts` passes with the new grant assertions.
- [ ] `npm run test:e2e` passes end to end, including the verification flow.
