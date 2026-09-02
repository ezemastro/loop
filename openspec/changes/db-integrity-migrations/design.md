# Design: Database Integrity Migrations

## Technical Approach

Five new forward-only migrations, `0009` … `0013`, one per audit id, each with its down SQL in a
trailing comment block. Four of them carry a matching application-side change (error mapping, token
hashing, grant assertion, test coverage). `server/database_creation.sql` is not touched (D0).
Delivered as one PR on `fix/auditoria-2026-09`.

## Verified Repository Facts

These were read in the repository, not assumed. They drive every decision below.

| Fact | Evidence |
|---|---|
| The runner applies `server/migrations/*.sql` in **alphabetical** order, one transaction each, unless line 1 is `-- migrate:no-transaction` | `server/api/src/scripts/migrate.ts:31,70-73,247-267` |
| An already-applied migration whose bytes change aborts the whole run on a SHA-256 mismatch | `migrate.ts:226-233` — "Nunca edites una migración aplicada: creá una nueva" |
| The runner connects as the **owner/superuser** (`DB_USER`), never as an app role | `migrate.ts:202-208`; header comment `migrate.ts:12-13` |
| Migrations read runtime values only via `current_setting('app.<key>', true)`; nothing is interpolated | `migrate.ts:155-172` (`exposeMigrationSettings`) |
| `-- migrate:no-transaction` files run statement-by-statement and are **not** atomic; they must be idempotent | `migrate.ts:258-266` |
| `database_creation.sql` is the `docker-entrypoint-initdb.d` base only; migrations run on top of it | `e2e/Dockerfile.db-init:4-11` |
| `database_creation.sql` was **never** mirrored: it has no `community_id`, no composite FKs, and none of `0008`'s columns | `rg email_verified server/database_creation.sql` → no match; `database_creation.sql:186` still shows the pre-`0004` simple FK |
| The API uses exactly two pools; the role is a pure function of the scope | `server/api/src/services/postgresClient.ts:53-66,112` — `scope.mode === "community" ? scopedPool : unscopedPool`. No `SET ROLE` anywhere |
| `ConflictError` already maps to HTTP 409 | `server/api/src/middlewares/errors.ts:31-33` |
| A `23505` detector already exists and is the house pattern | `server/api/src/models/admin.ts:60-61` — `isUniqueViolation` |
| `pgcrypto` is **not** installed and no migration creates it, so `digest()` is unavailable in SQL | `rg "pgcrypto\|CREATE EXTENSION" server/` → no match |
| `transaction_type` is `enum ('loop','mission','admin','donation')` and `wallet_transactions` has `balance_after` + `meta jsonb` | `database_creation.sql:97-108` |
| The e2e suite reads the **cleartext** verification token out of Postgres to build the link | `e2e/helpers/db.ts:49-53`, `e2e/helpers/api.ts:70-79` |
| The e2e DB helper connects as the owner/superuser, so it can write any column | `e2e/helpers/db.ts:5-16` |
| `assertDbHardening()` inspects `rolsuper`/`rolbypassrls`, `relrowsecurity` on `TENANT_TABLES`, and a fail-closed probe — **never a grant** | `postgresClient.ts:208-258`; `TENANT_TABLES` at `:28-42` contains none of the five SEC-09 tables |
| `rls.test.ts` is gated on `RUN_DB_TESTS=1` and its `app` client is `loop_app`; all fixture writes go through the owner client | `server/api/src/tests/rls.test.ts:30-35,53-57,61,108` |

## Architecture Decisions

### D0 — `database_creation.sql` is not updated (all five migrations)

The repo's actual convention, read from the files rather than inferred: `database_creation.sql` is
the **legacy pre-communities snapshot** that `docker-entrypoint-initdb.d` runs once on an empty
datadir, and migration `0000_baseline_reconcile.sql` exists precisely to close the gap between it
and reality. It was not updated for `0001`–`0008`: it has no `community_id` column anywhere, still
declares the pre-`0004` simple FK at `:186`, and has neither `email_verified` nor
`email_verification_token` from `0008`.

Therefore: **do not mirror.** Every fresh install already runs `database_creation.sql` *and then*
the full migration chain, so the constraints land either way. Mirroring would create a second
source of truth that is correct for exactly one of the two install paths and would silently diverge
the first time someone forgets — which is the failure mode `0000` was written to repair.

**Rejected**: updating `database_creation.sql` in lockstep. It would be a new convention introduced
mid-audit, it doubles the review surface, and it cannot be validated (nothing in CI builds a
database from `database_creation.sql` alone).

### D1 — SEC-05: fail loud on duplicates, non-concurrent unique index (`0009`)

**Cleanup rule: the migration aborts. It never picks a winner.**

```sql
DO $$
DECLARE dupes TEXT;
BEGIN
    SELECT string_agg(DISTINCT lower(email), ', ')
      INTO dupes
      FROM users
     GROUP BY lower(email)
    HAVING count(*) > 1;

    IF dupes IS NOT NULL THEN
        RAISE EXCEPTION
          'No se puede crear el índice único: hay emails duplicados en users (%). '
          'Resolvelos con scripts/audit-duplicate-emails.sql antes de migrar.', dupes;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_uq ON users (lower(email));
```

**Justification.** Every automatic rule is worse than stopping. A duplicate `users` row owns
listings, messages, a credit balance, `user_schools` rows and possibly a genuinely different human
who typed a colleague's address. Deleting the newer row destroys their data; rewriting the loser's
email (`email || '+dup'`) silently locks a real person out of an account they can still see in the
app; merging balances is exactly the credit arithmetic this block is forbidden from doing. Since
the application already checks for existence before inserting (`models/auth.ts:152-162`), a
duplicate can only exist from a genuine race — so the expected production count is **zero** and the
abort is a cheap, loud no-op. When it is not zero, a human must decide, and the exception names the
addresses so they can.

The cleanup step is therefore a **pre-flight**, not a mutation: `scripts/audit-duplicate-emails.sql`
is run against production first (task 1.1), and any hit is resolved by an operator before `0009`
ships.

**Non-concurrent index, deliberately.** `0005_indexes.sql` established the
`-- migrate:no-transaction` + `CREATE INDEX CONCURRENTLY` pattern, but it is wrong here for two
reasons. First, atomicity: the duplicate check and the index build must be in one transaction, or a
registration racing between them re-creates the duplicate and the build fails. Second, the
`CONCURRENTLY` failure mode is a trap — a failed concurrent build leaves an **invalid** index
behind, and the next run's `IF NOT EXISTS` sees it and skips, leaving the database permanently
unprotected while reporting success. `users` in a single-community deployment is small, so the
`ACCESS EXCLUSIVE` lock is measured in milliseconds. Transactional it is.

`lower(email)` and not `citext`: the entire codebase already compares with `lower(email) = lower($1)`
(`queries.ts:53-57,84-88,105`), so a functional index matches the existing queries exactly and is
usable by them; switching the column type to `citext` would need an extension and a column rewrite.

**API side.** `AuthModel.registerUser` (`models/auth.ts:152-162`) keeps its pre-check — it produces
the nicer error for the common case — but the `INSERT` is wrapped so a `23505` on
`idx_users_email_lower_uq` is re-thrown as `ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS,
"USER_ALREADY_EXISTS")`, which `errors.ts:31-33` already turns into a 409. The detector is the
existing `isUniqueViolation` pattern from `models/admin.ts:60-61`, lifted into a shared helper so
there is one copy. The same wrapping applies to `createUserWithGoogle` (`queries.ts:93`), which has
the identical race.

The check must be on the **constraint name**, not on `23505` alone: `users` also has
`users_google_id_key` (`0000:35-38`), and a Google-id collision is a different bug that must not be
reported as "email already registered".

### D2 — ECO-01 (DB half): clamp negatives with a compensating ledger row (`0010`)

**Cleanup rule: clamp to `0`, and write a `wallet_transactions` row that explains it.**

```sql
WITH fixed AS (
    UPDATE users
       SET credits_balance = GREATEST(credits_balance, 0),
           credits_locked  = GREATEST(credits_locked, 0)
     WHERE credits_balance < 0 OR credits_locked < 0
    RETURNING id, community_id, credits_balance, credits_locked
)
INSERT INTO wallet_transactions
    (user_id, community_id, type, positive, amount, balance_after, meta)
SELECT id, community_id, 'admin', TRUE, 0, credits_balance,
       jsonb_build_object('reason', 'migration_0010_clamp_negative_balance')
  FROM fixed;

ALTER TABLE users
    ADD CONSTRAINT users_credits_balance_non_negative CHECK (credits_balance >= 0),
    ADD CONSTRAINT users_credits_locked_non_negative  CHECK (credits_locked  >= 0);
```

**Justification.** Unlike a duplicate email, a negative balance is unambiguously a bug — there is no
reading of the domain in which a user owes the platform credits, and the audit names
`decreaseUserBalance` with no floor (`models/users.ts:87-93`) as the cause. Clamping is the only
resolution that lets the constraint exist, and it is safe *because* the ledger records it: the
compensating `wallet_transactions` row carries `type = 'admin'` (an existing enum value,
`database_creation.sql:97`), the post-clamp `balance_after`, and a `meta` reason string, so the
adjustment is auditable rather than silent. The `amount` is written as `0` because the real
adjustment amount is unknown-by-construction (the negative value is itself corrupt), and inventing
one would poison the ledger sums that `credit-economy-integrity` will later reconcile against.

Two separate named constraints, not one combined `CHECK (a >= 0 AND b >= 0)`: a violation then
names *which* column failed, which matters when `credit-economy-integrity` starts tripping them
during its rewrite.

`NOT VALID` + `VALIDATE CONSTRAINT` was considered and **rejected**: it exists to avoid a long table
scan under lock on a large table, but it would let the migration report success while leaving
pre-existing negative rows in place — the exact "invariant that is not actually enforced" this
change is written to eliminate.

Adding the constraints does **not** by itself fix ECO-01: the application still writes absolute
values computed in JS, so a race now produces a `23514` error instead of a corrupt balance. That is
the intended intermediate state — a loud failure is strictly better than a silent one, and the
atomic-update rewrite is owned by `credit-economy-integrity`.

### D3 — ECO-09: `ON DELETE SET NULL` on the composite FK (`0011`)

```sql
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_attached_listing_community_fk";
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_attached_listing_community_fk"
    FOREIGN KEY ("attached_listing_id", "community_id") REFERENCES "listings"("id", "community_id")
    ON DELETE SET NULL ("attached_listing_id");
```

The column-list form of `ON DELETE SET NULL` (PostgreSQL 15+, and the stack is `postgres:16`) is
**required** here. A bare `ON DELETE SET NULL` on a composite FK would null `community_id` too —
which is `NOT NULL` since `0004` and is the RLS discriminator, so the delete would fail with a
not-null violation and the tenant boundary would be the thing at risk. Naming
`attached_listing_id` nulls only the optional half, which is exactly the semantics `0004:72-74`
already documents for `MATCH SIMPLE` on this FK.

No data cleanup is needed: the constraint is *loosened*, so every existing row remains valid.

**Rejected**: soft delete via the unused `listings.disabled` column. It is a product decision (does
a deleted listing still appear in an old chat?), it changes the read path of every listing query,
and it leaves the 500 in place for anyone who really does delete. `ON DELETE SET NULL` is the
minimal fix that makes the DB correct; the message keeps its text and simply loses the attachment
card, which is the honest representation of a deleted listing.

### D4 — SEC-10: hash + expiry, and invalidate every outstanding token (`0012`)

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

-- Transición: los tokens vigentes se invalidan, no se migran (ver justificación).
UPDATE users
   SET email_verification_token = NULL
 WHERE email_verification_token IS NOT NULL;

DROP INDEX IF EXISTS idx_users_email_verification_token;
ALTER TABLE users DROP COLUMN IF EXISTS email_verification_token;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verification_hash
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
```

**Transition plan for tokens already issued: they are invalidated, not migrated.** Three reasons.
(1) It is technically impossible in-place with a straight face: `pgcrypto` is not installed, so
`digest()` does not exist in SQL, and adding an extension to hash values that were *already stored
in cleartext* — i.e. already exposed to anyone with a backup, a log, or a replica — buys nothing.
(2) The blast radius is near zero: `REQUIRE_EMAIL_VERIFICATION` is off by default
(`models/auth.ts:166-169`), and `0008:12` already marked every pre-existing user verified, so the
outstanding-token population is at most the users who registered after `0008` on a deployment that
opted in. (3) The recovery path already exists and is one click: `AuthModel.resendVerificationEmail`
(`models/auth.ts:325-352`) issues a fresh token, and it already rotates on every call.

The unique partial index on the hash replaces `0008`'s non-unique one. Unique is now correct and
cheap: the lookup is by exact hash, and a collision would mean two accounts share a verification
link.

**Application side.** The token is generated as today (`crypto.randomBytes(32).toString("hex")`),
sent in the email, and **only its `sha256` hex digest is stored**. `verifyUserEmail`
(`queries.ts:67-74`) becomes a lookup on `email_verification_token_hash = $1` with
`AND email_verification_expires_at > NOW()`, and `insertUser` / `updateUserVerificationToken` write
the hash plus `NOW() + INTERVAL '24 hours'`. Hashing happens in Node, so no extension is needed.
`userEmailVerifiedAndTokenByEmail` (`queries.ts:82-90`) stops selecting the token entirely — it only
ever needed to know *whether* one existed.

**e2e consequence, and the fix.** `e2e/helpers/api.ts:70-79` currently reads the cleartext column to
build the verification URL; once only the hash is stored, that is unrecoverable by construction.
The helper inverts the direction instead: it **writes** a known token's hash through the existing
owner-role pool (`e2e/helpers/db.ts:5-16`) and then calls the real endpoint with the known
cleartext.

```ts
// e2e/helpers/db.ts
export const seedVerificationToken = (email: string, token: string) =>
  query(
    `UPDATE users
        SET email_verification_token_hash = encode(sha256($2::bytea), 'hex'),
            email_verification_expires_at = NOW() + INTERVAL '24 hours'
      WHERE lower(email) = lower($1)`,
    [email, token],
  );
```

`sha256()` is a built-in since PostgreSQL 11 — no `pgcrypto` — so the helper needs no new
dependency. This keeps the suite exercising the **real** `GET /auth/verify-email` endpoint (its
stated intent, `e2e/helpers/api.ts:66-69`) rather than mocking it.

**Rejected**: scraping the verification link out of the API container logs
(`services/email.ts:41`) — the e2e runner has no Docker socket. **Rejected**: an env-gated
`verificationToken` field in the register response — it adds a production-reachable surface whose
only guard is a misconfigurable environment variable, to solve a test-harness problem.

### D5 — SEC-09: the grant matrix, corrected against the code (`0013`)

The audit proposes revoking DML from `loop_app` on all five tables. **Applied literally, that breaks
invite-based registration and account self-deletion.** Derived from every write statement in the
repository:

| Table | SELECT | INSERT | UPDATE | DELETE | Why |
|---|:---:|:---:|:---:|:---:|---|
| `admins` | revoke | revoke | revoke | revoke | No `loop_app` access of any kind exists. `REVOKE ALL`. |
| `admin_valid_emails` | revoke | revoke | revoke | revoke | Same — every write is `unscoped("admin")` or the boot bootstrap (`index.ts:108-114`). `REVOKE ALL`. |
| `invitations` | **keep** | revoke | **keep** | revoke | See below. |
| `communities` | **keep** | revoke | revoke | revoke | Scoped reads only: `communityById` and `communityByDomain` on the login hot path. |
| `community_email_domains` | **keep** | revoke | revoke | revoke | Read-only via the `communityByDomain` join. |

**The `invitations` exception.** Three scoped writes exist, all on the `loop_app` pool:

- `queries.ts:726-731` `UPDATE invitations SET used_by_user_id = $1, used_at = NOW() …` — reached
  from `utils/invitations.ts:58` via `models/auth.ts:208` (`POST /auth/register`) and
  `models/auth.ts:472` (`POST /auth/google`), both under `inCommunity(communityId)`
  (`auth.ts:246`, `auth.ts:485`).
- `queries.ts:1048-1051` `UPDATE invitations SET used_by_user_id = NULL …` — `models/self.ts:516`
  under `inCommunity` (`self.ts:520`), i.e. `DELETE /me`.

And a fourth, non-obvious dependency: `queries.ts:708-711` `SELECT * FROM invitations WHERE token =
$1 **FOR UPDATE**`, called by `lockInvitation` (`utils/invitations.ts:34`) from `models/auth.ts:180`
and `:445`. Per the PostgreSQL `GRANT` reference, `SELECT … FOR UPDATE` requires the **UPDATE**
privilege in addition to `SELECT`. Revoking `UPDATE` on `invitations` therefore fails with `42501`
at the row lock — *before* the consume — and the single-use guarantee for invitations is exactly
what that lock provides. `INSERT` and `DELETE` on `invitations` are admin-only
(`models/admin.ts:926`, `:1003`, both `unscoped`) and are safely revoked.

The `0007:106-110` comment claiming `invitations` is only *read* by token is stale; `0013` corrects
it in place as documentation.

**`ALTER DEFAULT PRIVILEGES` must be corrected too.** `0007:50-52` grants
`SELECT, INSERT, UPDATE, DELETE` on all *future* tables to both roles. A `REVOKE` on today's tables
does not touch that, so the next table anyone adds would arrive with the loose grant. `0013` narrows
the default for `loop_app` to `SELECT` and leaves `loop_app_unscoped` unchanged (it is the admin and
pre-tenant path and legitimately needs DML). Consequence, recorded in the migration header: **every
future migration that adds a tenant table must explicitly grant `loop_app` the DML it needs.** That
is the intended trade — an explicit grant is reviewable, a silent default is not.

`loop_app_unscoped` is untouched throughout. It is `BYPASSRLS` by construction and serves the admin
panel; narrowing it is a different, larger change (and `sec-hardening-api`'s problem).

### D6 — `assertDbHardening()` gains a grant assertion

`postgresClient.ts:208-258` checks three things and **none of them is a grant**: the role is not
`rolsuper`/`rolbypassrls`, `relrowsecurity` is on for `TENANT_TABLES` (`:28-42`, which contains none
of the five SEC-09 tables), and a fail-closed `SELECT count(*) FROM listings` probe returns `0`. A
wrong `0013` is therefore invisible at boot and surfaces only as a `42501` from a user's
registration attempt.

One query is added to the existing `problems` accumulator, expressing the matrix as data:

```ts
const { rows: grantRows } = await scopedPool.query<{ tbl: string; priv: string }>(
  `SELECT t.tbl, p.priv
     FROM unnest($1::text[], $2::text[]) AS t(tbl, priv_csv)
     CROSS JOIN LATERAL unnest(string_to_array(t.priv_csv, ',')) AS p(priv)
    WHERE has_table_privilege(current_user, t.tbl, p.priv) <> (p.priv = ANY(...))`,
);
```

Concretely it asserts, for the scoped role: no privilege on `admins` or `admin_valid_emails`;
`SELECT` yes / `INSERT`,`DELETE` no on `communities` and `community_email_domains`; and `SELECT` yes,
`UPDATE` **yes**, `INSERT`/`DELETE` no on `invitations`. The positive `UPDATE` assertion is the
important one — it is what stops a future "tidy-up" from re-breaking registration. It reuses the
existing severity behavior: `throw` in production, `console.warn` otherwise (`:253-257`).

## Data Flow

```
docker-entrypoint-initdb.d
   ├─ database_creation.sql   (legacy snapshot — NOT updated, D0)
   └─ create_categories.sql
                │
                ▼
npm run migrate  (owner role, alphabetical, checksum-guarded)
   0000…0008  existing
   0009  dedup audit → RAISE or CREATE UNIQUE INDEX (lower(email))        ── SEC-05
   0010  clamp negatives + compensating ledger → 2× CHECK >= 0            ── ECO-01 (DB)
   0011  drop/recreate FK ON DELETE SET NULL (attached_listing_id)        ── ECO-09
   0012  add hash + expires_at, NULL outstanding, drop cleartext column   ── SEC-10
   0013  REVOKE per matrix + ALTER DEFAULT PRIVILEGES                     ── SEC-09
                │
                ▼
API boot: assertDbHardening()  → roles + RLS + fail-closed probe + NEW grant matrix (D6)
                │
     ┌──────────┴───────────┐
 scopedPool               unscopedPool
 (loop_app, RLS)          (loop_app_unscoped, BYPASSRLS)
 SELECT+UPDATE invitations  full DML on the five tables
 SELECT communities/domains
```

## File Changes

| File | Action | Item |
|---|---|---|
| `server/migrations/0009_unique_user_email.sql` | Create | SEC-05 |
| `server/migrations/0010_credit_balance_checks.sql` | Create | ECO-01 (DB) |
| `server/migrations/0011_message_listing_on_delete.sql` | Create | ECO-09 |
| `server/migrations/0012_verification_token_hash.sql` | Create | SEC-10 |
| `server/migrations/0013_revoke_loop_app_dml.sql` | Create | SEC-09 |
| `server/scripts/audit-duplicate-emails.sql` | Create | SEC-05 pre-flight |
| `server/api/src/services/errors.ts` (or a new `pgErrors.ts`) | Modify | Shared `isUniqueViolation` / constraint-name helper |
| `server/api/src/models/auth.ts` | Modify | `23505` → 409; hash + expire tokens |
| `server/api/src/models/admin.ts` | Modify | Use the shared helper (drop the local copy at `:60-61`) |
| `server/api/src/services/queries.ts` | Modify | Token queries → hash + `expires_at` |
| `server/api/src/services/postgresClient.ts` | Modify | Grant assertion in `assertDbHardening` (D6) |
| `server/api/src/tests/rls.test.ts` | Modify | Grant-matrix assertions, both denied and retained |
| `e2e/helpers/db.ts` | Modify | `seedVerificationToken`; drop `getVerificationTokenByEmail` |
| `e2e/helpers/api.ts` | Modify | `verifyUserEmail` seeds a known token (D4) |
| `server/database_creation.sql` | **Unchanged** | D0 |
| `server/migrations/0007_db_roles_and_rls.sql` | **Unchanged** | Checksum-guarded; never edit an applied migration |

## Rollback (down SQL)

The runner is forward-only, so each migration carries its down SQL in a trailing comment block and
reverting is a deliberate operator action (re-applying afterwards needs a *new* numbered file).

| Migration | Down SQL | Reversible? |
|---|---|---|
| `0009` | `DROP INDEX IF EXISTS idx_users_email_lower_uq;` | Fully |
| `0010` | `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_credits_balance_non_negative, DROP CONSTRAINT IF EXISTS users_credits_locked_non_negative;` | Constraint yes; clamped values no (the ledger rows are the record) |
| `0011` | Drop and recreate the FK without `ON DELETE SET NULL` | Constraint yes; already-nulled `attached_listing_id` values no |
| `0012` | Re-add `email_verification_token TEXT`, recreate the old index, drop the hash/expiry columns | **Partially** — hashes cannot be inverted; every pending user must re-request a link |
| `0013` | `GRANT SELECT, INSERT, UPDATE, DELETE ON <five tables> TO loop_app;` + restore the `0007` default privileges | Fully |

`0012`'s migration and its application code must revert **together**: the API cannot query a dropped
column, and cannot find a hash in a cleartext column.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Migration run (dev) | `0009`–`0013` apply cleanly and are idempotent | `docker compose -f docker-compose.dev.yml up -d db` → `npm run dev:migrate` → `docker compose -f docker-compose.dev.yml exec api npm run migrate:status` (all `[ aplicada ]`) → `npm run dev:migrate` again (no-op) |
| Migration run (fresh) | The chain applies to a database built from `database_creation.sql` + `0000`…`0008` | `npm run test:e2e` — `e2e/Dockerfile.db-init` seeds the base and the `migrate` service runs the chain on a volume created fresh each run (`scripts/run-e2e.sh:11-12`) |
| Constraint behavior | Each invariant actually rejects | `psql` as `loop_app`: duplicate `lower(email)` insert → `23505`; `UPDATE users SET credits_balance = -1` → `23514`; delete a listing attached to a message → succeeds, message's `attached_listing_id` is `NULL` |
| Grants (`rls.test.ts`) | The matrix holds in both directions | `RUN_DB_TESTS=1` + existing 8 tests. **Denied**: `INSERT`/`UPDATE`/`DELETE` on `communities`, `community_email_domains`, `invitations`; any access to `admins`, `admin_valid_emails` — each `42501`. **Retained**: `SELECT` on both community tables; `SELECT … FOR UPDATE` and `UPDATE invitations SET used_by_user_id = …` succeed |
| Boot assertion | `assertDbHardening` catches a wrong matrix | Temporarily `REVOKE UPDATE ON invitations FROM loop_app` in a scratch DB and confirm the API warns (dev) / exits (production) |
| End to end | Registration, invite registration, verification, listing delete | `npm run test:e2e` — the suite runs with `REQUIRE_EMAIL_VERIFICATION: "true"` (`docker-compose.e2e.yml:87`), so `0012` and the rewritten helper are exercised on the real endpoint |
| Unit | API layer | `cd server/api && npm run test`. The suite is known stale/red pre-change (INF-06, `openspec/config.yaml`) — record the baseline failure count first and require no *new* failures rather than green |

`npm run check-types` (`tsc --noEmit`) is the type gate for the API changes. Formatting is Prettier
(2-space, double quotes, 100 width).

## Threat Matrix

| Boundary | Consideration |
|---|---|
| Privilege escalation | `0013` only ever narrows privileges. It touches no role attribute (`SUPERUSER`, `BYPASSRLS`) and does not alter `loop_app_unscoped`. |
| Tenant isolation | `0011` uses the column-list `ON DELETE SET NULL` specifically so `community_id` — the RLS discriminator — can never be nulled by a cascade. No policy is added, dropped or modified. |
| Secret exposure | `0012` removes a secret from storage; it never logs a token. The e2e helper's known token is confined to the ephemeral e2e database. |
| Enumeration | The 409 from D1 confirms an email is registered — but `POST /auth/register` already does so via the existing pre-check, so this introduces no new oracle. |
| SQL injection | No user input reaches migration SQL; the runner exposes values only as GUCs read with `current_setting` (`migrate.ts:155-172`). |
| Migration integrity | No applied migration is edited; the SHA-256 checksum guard (`migrate.ts:226-233`) stays intact. |

## Open Questions

- [ ] Does production currently hold duplicate `lower(email)` rows? Task 1.1 answers this before
      `0009` ships. If it does, resolution is an operator decision, not this change's.

## Recorded Follow-ups (not fixed here)

- `account_deletion_requests` sits in the same "no RLS" bucket as the SEC-09 five and is **written**
  on the scoped path (`models/self.ts:517` → `queries.ts:786-789`). A later privilege pass must not
  repeat the mistake D5 caught.
- `0007:106-110`'s claim that `invitations` is only read by token is stale. `0013` corrects the
  documentation, but the underlying design question — should `invitations` have RLS instead of a
  hand-maintained grant exception? — is left open.
- `loop_app_unscoped` retains full DML on every table. Narrowing it is `sec-hardening-api`'s scope.
- The `users` pre-check in `models/auth.ts:152-162` remains a TOCTOU race by design; after `0009`
  the database is the arbiter and the pre-check is only a nicer error path. Removing it entirely is
  a judgment call left to `sec-hardening-api`.
- `CHECK` constraints will surface ECO-01's races as `23514` errors until
  `credit-economy-integrity` lands the atomic updates. That is intended, and it is the signal that
  block should be scheduled next.
