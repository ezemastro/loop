# Design: Credit Economy Integrity

## Technical Approach

Every credit movement in the application is funnelled through one function,
`applyCreditMovements(client, movements)`, which performs a guarded relative `UPDATE … RETURNING` per
affected user and writes one `wallet_transactions` row per movement in the same transaction. The
absolute-value query `queries.updateUserBalance` (`server/api/src/services/queries.ts:448-453`) and
its eleven call sites are deleted. The listing state machine gains conditional `WHERE` clauses so
that a lost update becomes a 409 instead of silent corruption, and a cancel transition so `accepted`
is no longer a credit-trapping dead end.

## Verified Facts

These were read in the repository at `7acced3`, not assumed. They drive the decisions below.

| Fact | Evidence |
|---|---|
| Exactly **three** SQL statements mutate credits; only the two admin ones are relative | `services/queries.ts:448-453` (absolute), `:860-865`, `:866-871` |
| `queries.updateUserBalance` has **11** call sites, all read-compute-write | `models/listings.ts:365,414,500,647,655,724,746,859,881`; `models/users.ts:87,93`; `utils/helpersDb.ts:673` |
| No balance query uses `FOR UPDATE`; the only `FOR UPDATE` in the codebase is for invitations | `services/queries.ts:705-710`; `models/auth.ts:118` |
| No isolation level is ever set — everything is `READ COMMITTED` | `services/postgresClient.ts:86-96` |
| `transaction_type` enum **already** has `'loop','mission','admin','donation'` | `server/database_creation.sql:97` |
| `wallet_transactions.balance_after BIGINT NULL` **already exists**; the only INSERT omits it | `server/database_creation.sql:103`; `services/queries.ts:855-859` |
| `queries.storeTrade` has **zero** call sites — `listing_trades` is never written by the app | `services/queries.ts:455-459` |
| `cancelListing` has **zero** call sites and no route; `routes/listings.ts` is 16 lines | `models/listings.ts:824-914`; `routes/listings.ts:1-16` |
| `cancelListing` provably never ran: an in-code comment documents a 3-vs-4 param arity bug it hit | `models/listings.ts:891-892` |
| `listing_status` enum has exactly four values; there is no `cancelled` | `server/database_creation.sql:69` |
| `createListing` is **not** transactional yet grants mission credits three times | `models/listings.ts:178`, `:160,165,170` |
| `makeOffer` applies **no** body schema; `offeredCredits: undefined` passes every guard | `controllers/listings.ts:153-178`; `models/listings.ts:314-316,326` |
| `decreaseUserBalance` has no floor clause | `services/queries.ts:866-871` |
| No `UNIQUE` on `user_missions(user_id, mission_template_id)` or on `mission_templates.key` | absent from `database_creation.sql` and all of `server/migrations/` |
| No scheduler, cron, queue, or `setInterval` exists anywhere in the server | `rg "setInterval|cron|bullmq"` over `server/api/src` → zero |
| `listings` has no status timestamp — only `created_at`/`updated_at` | `server/database_creation.sql:83-84` |
| Migration runner: lexicographic sort, sha256 checksum, advisory lock `72610001`, one tx per file unless `-- migrate:no-transaction` | `server/api/src/scripts/migrate.ts` |
| `npm run check-sql` statically checks `$N` arity against call sites | `server/api/package.json:21`; `server/scripts/check-sql-arity.py` |

A consequence worth stating plainly: because `updateUserBalance` writes **both** columns absolutely,
even a flow that means to change only one bucket rewrites the other. `receiveListing` rewrites the
buyer's `credits_balance` to its just-read value while only intending to decrement `credits_locked`
(`models/listings.ts:724-729`). That is a pure lost-update surface with no functional purpose, and it
is why "only touch the column you mean to touch" is a hard rule below.

## Architecture Decisions

### D1 — One guarded relative UPDATE, not `SELECT … FOR UPDATE`, for `users`

```sql
-- queries.applyCreditDelta
UPDATE users
   SET credits_balance = credits_balance + $1,
       credits_locked  = credits_locked  + $2
 WHERE id = $3
   AND credits_balance + $1 >= 0
   AND credits_locked  + $2 >= 0
   AND ($4::uuid IS NULL OR community_id = $4::uuid)
RETURNING credits_balance, credits_locked;
```

Four parameters. `$1`/`$2` are **signed** deltas, so one statement expresses every movement: a lock
is `(-X, +X)`, an unlock is `(+X, -X)`, a mission reward is `(+X, 0)`, a settlement burn is `(0, -X)`.

Why this and not `SELECT … FOR UPDATE` at the top of each transaction:

- It is **one** statement, so there is no window at all — not a short one, a nonexistent one. A
  `FOR UPDATE` approach still leaves the arithmetic in JS and depends on every future author
  remembering to take the lock.
- The `>= 0` predicates make the guard the *application's* rule. When
  `db-integrity-migrations` lands `CHECK (credits_balance >= 0)`, the guard fires first and returns
  0 rows; the CHECK never gets the chance to raise a 500. This is the explicit requirement that our
  code must fail with a clean domain error before the constraint fires.
- `RETURNING` yields `balance_after`/`locked_after` atomically, with no second read to race.

**Zero rows is ambiguous** — it means either "insufficient funds" or "that user is not in this
community". The helper disambiguates with one follow-up `queries.userById`: if the user is absent,
raise `NotFoundError(USER_NOT_FOUND)`; otherwise `InvalidInputError(INSUFFICIENT_CREDITS)`. That read
happens only on the failure path, so it costs nothing in the common case.

**Rejected:** `SELECT … FOR UPDATE` everywhere (leaves JS arithmetic, easy to forget);
`SERIALIZABLE` isolation (would require retry logic in `withClient`, a much larger blast radius, and
the repo has no retry infrastructure); optimistic `version` columns (a schema change plus retry logic
to solve a problem a `WHERE` clause already solves).

### D2 — `applyCreditMovements`: the single choke point

New file `server/api/src/utils/credits.ts`:

```ts
export type CreditReason =
  | "genesis_opening_balance"
  | "offer_lock" | "offer_unlock_withdrawn" | "offer_unlock_rejected"
  | "accept_buyer_adjust" | "accept_seller_lock"
  | "receive_buyer_settle" | "receive_seller_credit"
  | "cancel_buyer_refund" | "cancel_seller_unlock"
  | "deletion_release"
  | "mission_reward"
  | "donation_sent" | "donation_received"
  | "admin_grant" | "admin_debit";

export interface CreditMovement {
  userId: UUID;
  balanceDelta: number;   // signed, may be 0
  lockedDelta: number;    // signed, may be 0
  reason: CreditReason;
  referenceId: UUID | null;   // listing id, mission id, counterpart user id
  meta?: JsonObject | null;
}

export const applyCreditMovements = async (
  client: DatabaseClient,
  movements: CreditMovement[],
): Promise<void> => { /* sort, apply, ledger */ };
```

It sorts by `userId` (D3), applies each guarded UPDATE, and writes the matching ledger row using the
`RETURNING` values. Callers never touch `users.credits_*` and never touch `wallet_transactions`
directly. `queries.updateUserBalance` is **deleted**, so the compiler makes the migration exhaustive:
any missed call site fails `npm run check-types`.

A movement with `balanceDelta === 0 && lockedDelta === 0` is rejected as a programming error — a
no-op ledger row is noise, and it is always a sign the caller computed wrong.

### D3 — Lock ordering (deadlock prevention)

`READ COMMITTED` plus row locks taken by `UPDATE` means two transactions that touch the same two
users in opposite orders deadlock. `acceptOffer` touches seller-then-buyer; `donate` touches
sender-then-recipient. Without a rule, a seller donating to their buyer while that buyer accepts is a
live deadlock.

**The rules, in force for the whole change:**

1. **Listings before users.** Any `SELECT … FOR UPDATE` on `listings` is taken before the first
   credit movement in the transaction.
2. **Listings among themselves: ascending `id::text`.** `acceptOffer` locks the main listing and the
   traded listings in one statement with `ORDER BY id`, never in a `Promise.all` of separate
   statements. (Today it fires N concurrent `getListingById` calls at
   `models/listings.ts:551-553` — unordered *and* unlocked.)
3. **Users: ascending `id::text`.** Enforced structurally, not by convention:
   `applyCreditMovements` sorts its batch before issuing anything. A caller that passes
   `[seller, buyer]` and a caller that passes `[buyer, seller]` emit identical statement orders.
4. **One batch per transaction.** Callers assemble all movements and make a single
   `applyCreditMovements` call. Two sequential calls in one transaction would defeat rule 3, so the
   helper is the only place ordering is decided.
5. **Never `Promise.all` over statements on the same connection.** `pg` serialises them on one
   connection anyway, in nondeterministic order — which is exactly what rules 2 and 3 forbid. The
   existing `Promise.all` blocks at `models/listings.ts:631-637,641-645` become ordered `for … of`
   loops or single set-based statements.

Rule 3 also means a transaction can never hold a `users` lock while waiting for another `users` lock
out of order, which is the only deadlock cycle this schema can form.

### D4 — Ledger schema: two signed deltas, two running totals

`amount`/`positive` in the existing schema can express a balance change but **cannot express the
locked bucket at all**, and the locked bucket is where every loop's money actually sits. A lock
movement changes no net worth; a settlement burn changes `locked` while leaving `balance` alone.
Neither is representable as a single signed scalar.

Migration `0014` therefore adds:

| Column | Type | Meaning |
|---|---|---|
| `balance_delta` | `BIGINT NOT NULL DEFAULT 0` | Signed change to `users.credits_balance` |
| `locked_delta` | `BIGINT NOT NULL DEFAULT 0` | Signed change to `users.credits_locked` |
| `locked_after` | `BIGINT NULL` | `credits_locked` immediately after this movement |
| `reason` | `TEXT NULL` + `CHECK` over the 16 reasons | Fine-grained cause; `type` stays coarse |

`amount` and `positive` are retained and still populated (`amount = abs(balance_delta)` where a
balance moves, else the economic magnitude of the event; `positive = balance_delta >= 0`) so the
existing admin panel and `validations.ts:126-138` keep working unchanged. **The deltas are the
accounting truth; `amount`/`positive` are display.** This redundancy is deliberate and documented in
the migration header rather than resolved, because resolving it means touching the admin surface,
which is another block's scope.

**What `balance_after` means for the locked bucket.** `balance_after` is `users.credits_balance`
after the movement — the *spendable* bucket only. It is deliberately **not** net worth. The locked
bucket gets its own column, `locked_after`. The pair `(balance_after, locked_after)` is the user's
complete credit state at that instant, and a user's net worth at any row is
`balance_after + locked_after`. Reading `balance_after` alone during a loop is misleading by design:
during an `offered` loop the buyer's `balance_after` has already dropped while their net worth has
not changed at all. Any UI must show both or show the sum; showing `balance_after` alone will make
users believe credits were spent when they were only escrowed.

Both `*_after` columns stay nullable because the existing admin rows have no values for them and
back-filling them would require replaying a history that was never recorded.

### D5 — The exact set of ledger entry types

Sixteen reasons, each pinned to one code site. `type` is the coarse existing enum value.

| `reason` | `type` | `balance_delta` | `locked_delta` | Emitted at |
|---|---|---|---|---|
| `genesis_opening_balance` | `admin` | `+credits_balance` at migration | `+credits_locked` at migration | `0014` migration, one row per user |
| `offer_lock` | `loop` | `−offered` | `+offered` | `newOffer`, buyer (`models/listings.ts:365`) |
| `offer_unlock_withdrawn` | `loop` | `+offered` | `−offered` | `deleteOffer`, buyer (`:414`) |
| `offer_unlock_rejected` | `loop` | `+offered` | `−offered` | `rejectOffer`, buyer (`:500`) |
| `accept_seller_lock` | `loop` | `−newSellerLocked` | `+newSellerLocked` | `acceptOffer`, seller (`:647`) |
| `accept_buyer_adjust` | `loop` | `+(offered − newBuyerLocked)` | `−(offered − newBuyerLocked)` | `acceptOffer`, buyer (`:655`) |
| `receive_buyer_settle` | `loop` | `0` | `−offered` | `receiveListing`, buyer (`:724`) |
| `receive_seller_credit` | `loop` | `+offered` | `0` | `receiveListing`, seller (`:746`) |
| `cancel_buyer_refund` | `loop` | `+lockedForThisLoop` | `−lockedForThisLoop` | new cancel, buyer |
| `cancel_seller_unlock` | `loop` | `+sellerLockedForThisLoop` | `−sellerLockedForThisLoop` | new cancel, seller |
| `deletion_release` | `loop` | `+lockedForThisLoop` | `−lockedForThisLoop` | `deleteSelf`, each surviving counterparty |
| `mission_reward` | `mission` | `+rewardCredits` | `0` | `progressMission` (`utils/helpersDb.ts:673`) |
| `donation_sent` | `donation` | `−amount` | `0` | `donate`, sender (`models/users.ts:87`) |
| `donation_received` | `donation` | `+amount` | `0` | `donate`, recipient (`models/users.ts:93`) |
| `admin_grant` | `admin` | `+amount` | `0` | `modifyUserCredits` (`models/admin.ts:364`) |
| `admin_debit` | `admin` | `−amount` | `0` | `modifyUserCredits` (`models/admin.ts:366`) |

`accept_buyer_adjust` is emitted only when `offered !== newBuyerLocked`; when a buyer offers exactly
the price with no trades, the delta is zero and D2 forbids a no-op row. Every other reason always has
a non-zero delta pair by construction.

### D6 — Reconciliation, and why genesis rows are mandatory

The invariant, per user:

```
users.credits_balance == Σ wallet_transactions.balance_delta
users.credits_locked  == Σ wallet_transactions.locked_delta
```

This can only hold if the ledger starts from a known point. Balances exist today with no ledger
behind them, so migration `0014` inserts one `genesis_opening_balance` row per user carrying that
user's current `credits_balance`/`credits_locked` as its deltas. Without it the invariant is false
for every pre-existing user on day one and the check is worthless. The genesis insert and the column
addition are in **one** migration transaction so no window exists where a balance has no genesis row.

`npm run reconcile-credits` (`server/api/src/scripts/reconcileCredits.ts`) reports, read-only:

```sql
SELECT u.id, u.credits_balance, u.credits_locked,
       COALESCE(SUM(w.balance_delta), 0) AS ledger_balance,
       COALESCE(SUM(w.locked_delta),  0) AS ledger_locked
  FROM users u
  LEFT JOIN wallet_transactions w ON w.user_id = u.id
 GROUP BY u.id, u.credits_balance, u.credits_locked
HAVING u.credits_balance <> COALESCE(SUM(w.balance_delta), 0)
    OR u.credits_locked  <> COALESCE(SUM(w.locked_delta),  0);
```

It runs `unscoped("admin")` — it is a cross-community operator tool by definition, and per-community
reconciliation would miss nothing but would need N invocations. Rows whose `user_id` is NULL
(deleted users, D8) are excluded from the per-user join and reported separately as a retained-audit
total; they are expected and are not a discrepancy.

The script **reports and exits non-zero**. It never repairs. An automatic repair would paper over the
bug that caused the drift, and a wrong repair is worse than a loud alarm.

### D7 — Listing state machine, including the new cancel transitions

`listing_status` keeps its four values (`server/database_creation.sql:69`). **No new enum value is
added.** Two reasons: `ALTER TYPE … ADD VALUE` cannot use the new value in the same transaction, and
the migration runner wraps each file in one transaction
(`server/api/src/scripts/migrate.ts`) — the genesis insert in the same file would have to be split.
More importantly, a cancelled loop's listing should return to the market, and "back on the market" is
exactly `published`. A `cancelled` terminal state would need a separate relist action to be useful.

Full transition table. **Guard** is the SQL `WHERE` predicate that makes the transition safe under
concurrency; a transition whose guard matches zero rows raises `ConflictError` → 409.

| # | From | Event / route | Actor | To | Guard | Credit movements |
|---|---|---|---|---|---|---|
| 1 | ∅ | `POST /listings` | seller | `published` | — | none |
| 2 | `published` | `POST /:id/offer` | buyer | `offered` | `listing_status='published' AND buyer_id IS NULL AND seller_id <> $buyer` | `offer_lock` (buyer) |
| 3 | `offered` | `DELETE /:id/offer` | buyer | `published` | `listing_status='offered' AND buyer_id=$buyer` | `offer_unlock_withdrawn` (buyer) |
| 4 | `offered` | `POST /:id/offer/reject` | seller | `published` | `listing_status='offered' AND seller_id=$seller` | `offer_unlock_rejected` (buyer) |
| 5 | `offered` | `POST /:id/offer/accept` | seller | `accepted` | `listing_status='offered' AND seller_id=$seller` | `accept_seller_lock` (seller, if > 0) + `accept_buyer_adjust` (buyer, if ≠ 0) |
| 5t | `published` | same call, each traded listing | seller | `accepted` | `listing_status='published' AND buyer_id IS NULL AND seller_id=$offerBuyer` | none (trade legs carry no cash) |
| 6 | `accepted` | `POST /:id/receive` | buyer | `received` | `listing_status='accepted' AND buyer_id=$buyer` | `receive_buyer_settle` (buyer) + `receive_seller_credit` (seller) |
| 7 | **`accepted`** | **`POST /:id/cancel`** | **seller** | **`published`** | `listing_status='accepted' AND seller_id=$actor` | `cancel_buyer_refund` + `cancel_seller_unlock` |
| 8 | **`accepted`** | **`POST /:id/cancel`** | **buyer** | **`published`** | `listing_status='accepted' AND buyer_id=$actor` | `cancel_buyer_refund` + `cancel_seller_unlock` |
| 9 | `published` | `DELETE /listings/:id` | seller | ∅ | `listing_status='published'` | none |

**Rejected transitions**, each a 409 with a distinct message: cancel from `published` (nothing to
cancel), cancel from `offered` (use transition 3 or 4 — they already exist and already refund),
cancel from `received` (terminal; the goods changed hands), cancel by a third party, receive by
anyone but the buyer, and any transition out of `received`.

`received` is terminal. Today it is not — `updateListingsBuyerToNullByUserId`
(`services/queries.ts:1011-1016`) has no status filter and silently reverts settled loops to
`published` when a user is deleted (D8 fixes this).

**Transitions 7 and 8 also unwind the trade legs**: every listing linked through `listing_trades` for
this loop returns from `accepted` to `published` with `buyer_id = NULL`, and the rows are deleted.
This is the reason ECO-04's `storeTrade` must actually be called — without a persisted trade record,
cancellation cannot know which listings to give back. ECO-04 and ECO-05 are one problem.

**Cancel is symmetric and free.** Both parties get back exactly what they put in for *this* loop:
the buyer's `locked` for this listing, the seller's `locked` from the trade top-up. The dead
`cancelListing` charged the seller `price − offered_credits` out of pocket
(`models/listings.ts:853`) and credited the buyer the full `price` rather than what they had locked
(`:882`). Net worth happened to balance, but the seller paid a penalty for cancelling and the buyer's
refund was not their own money. Since that code provably never executed, there is no behaviour to
preserve; the new rule is "everyone gets their own money back".

### D8 — Deletion releases counterparty credits, and the ledger outlives the user

Two failures today, both at `models/self.ts:481-522`:

- `deleteListingsBySellerId` (`:501`) deletes the user's `offered`/`accepted` listings with no status
  filter. The counterparty buyer's `credits_locked` is never decremented — the credits are stranded
  against a listing that no longer exists.
- `updateListingsBuyerToNullByUserId` (`:502`) republishes listings the user was buying without
  releasing the *seller's* trade lock, and, having no status filter, also reverts `received` loops.

The fix, still one transaction: **before** any delete, enumerate the user's open loops in both roles
and run them through the same cancel logic as D7 (`deletion_release` movements for the surviving
counterparty), then narrow `updateListingsBuyerToNullByUserId` with
`AND listing_status IN ('offered','accepted')`.

`deleteWalletTransactionsByUserId` (`services/queries.ts:1023-1027`) is **deleted**, not narrowed.
Migration `0014` makes `wallet_transactions.user_id` nullable and repoints the composite FK
`wallet_transactions_user_community_fk` (`server/migrations/0004_not_null_and_fks.sql:134-137`) to
`ON DELETE SET NULL`. Deleting a user anonymises their ledger rows instead of destroying them. This
is what makes a historical audit possible at all, and it is why the counterparty's rows — which are
the *other* user's records of the same events — survive.

`community_id` stays `NOT NULL` on those anonymised rows, so RLS still scopes them and a community
admin can still reconcile their own community's history.

### D9 — Scoping (`inCommunity` vs `unscoped`)

| Path | Scope | Why |
|---|---|---|
| All listing flows, donate, missions | `inCommunity(communityId)`, `transaction: true` | Unchanged from today; both parties are always in one community (donate resolves both users through the scoped pool, `models/users.ts:74,79`) |
| `applyCreditMovements` | inherits the caller's client | It never opens its own connection; it must run inside the caller's transaction or the ledger is not atomic with the balance |
| `modifyUserCredits` | `unscoped("admin")`, `transaction: true` | Existing `adminScopeTx` (`models/admin.ts:57`); a super admin's filter is `null` |
| `deleteSelf` | `inCommunity(communityId)`, `transaction: true` | Unchanged |
| `resolveRequest` (admin deletion) | `unscoped("admin")`, `transaction: true` | **Changed** — today it is three separate non-transactional `withClient` calls (`models/accountDeletion.ts:101-130`), so the request is marked `completed` and committed before the deletion runs; if the delete fails the request lies |
| `reconcileCredits` script | `unscoped("admin")` | Cross-community operator tool |
| `0014` migration | table owner | Migration runner connects as `POSTGRES_USER` by design |

`createListing` gains `transaction: true` (`models/listings.ts:178`). It currently grants mission
credits three times with no transaction; a failure between grants leaves credits minted against a
listing that may not exist.

### D10 — Migration `0014_credit_ledger_integrity.sql`

Rationale, per `openspec/config.yaml`'s requirement to justify any new migration: the application
cannot satisfy the ledger invariant (D6) without `balance_delta`/`locked_delta` columns, cannot
preserve the ledger past deletion (D8) without a nullable `user_id`, and cannot do the mission
`ON CONFLICT DO NOTHING` fan-out (D11) without a unique index to conflict on. None of that is
expressible in application code.

Contents, in one transaction (no `-- migrate:no-transaction` pragma — nothing here needs
`CONCURRENTLY`, and atomicity of the genesis rows matters more than lock duration on a table this
size):

1. `ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS balance_delta BIGINT NOT NULL DEFAULT 0`,
   same for `locked_delta`; `ADD COLUMN IF NOT EXISTS locked_after BIGINT`, `reason TEXT`.
2. Back-fill `balance_delta` for the existing admin rows from `positive`/`amount`, so history is not
   silently zero.
3. `CHECK` constraint on `reason` over the sixteen D5 values (`NULL` allowed for legacy rows).
4. Drop `wallet_transactions_user_community_fk`; `ALTER COLUMN user_id DROP NOT NULL`; re-add the
   composite FK with `ON DELETE SET NULL`.
5. Insert one `genesis_opening_balance` row per user (D6).
6. `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_missions_user_template ON user_missions(user_id, mission_template_id)`
   — required by D11's `ON CONFLICT`.
7. `CREATE UNIQUE INDEX IF NOT EXISTS uq_mission_templates_key ON mission_templates(key)` — the
   uniqueness `models/admin.ts:671-674` already assumes but the DB never enforced, making it a TOCTOU
   race between two admins.
8. `ALTER TABLE listings ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP(0)`, back-filled from
   `COALESCE(updated_at, created_at)` — the timestamp a future expiry job needs. Nothing reads it in
   this change.

Steps 6 and 7 can fail on existing duplicate data. The migration de-duplicates first (keeping the
oldest row by `created_at`, then `id`) and states so in its header. House style is a Spanish `--`
prose header explaining the *why* including rejected alternatives, matching
`server/migrations/0007_db_roles_and_rls.sql:1-17` and `0008_email_verification.sql:1-7`.

Numbering: **`0014` is chosen because `db-integrity-migrations` claims `0009` through `0013`**
(`openspec/changes/db-integrity-migrations/design.md:357-361`: `0009_unique_user_email`,
`0010_credit_balance_checks`, `0011_message_listing_on_delete`, `0012_verification_token_hash`,
`0013_revoke_loop_app_dml`). That block's `0010_credit_balance_checks.sql` is the one landing
`CHECK (credits_balance >= 0)` and `CHECK (credits_locked >= 0)`, so it sorts — and therefore applies
— strictly before this file. The runner sorts lexicographically and checksums by basename
(`server/api/src/scripts/migrate.ts`), so ordering is decided by the filename alone. If block B is
dropped or renumbered, this file may move down, but it must never move *below* `0010`: the guarded
updates in D1 are designed to coexist with those constraints, and the genesis rows in D6 assume
balances have already been clamped non-negative by `0010`. Never edit an applied migration.

### D11 — Missions

- **`completed_at`**: `services/queries.ts:593-598` sets `completed_at = NOW()` on *every* tick,
  including incomplete ones, so it can never date a completion. Becomes
  `completed_at = CASE WHEN $2 THEN COALESCE(completed_at, NOW()) ELSE completed_at END`.
- **Inactive templates**: `progressMission` already honours `active`
  (`utils/helpersDb.ts:653`) — the audit is imprecise here (see Corrections). The gap is in
  *assignment*: `allMissionTemplates` (`services/queries.ts:577-580`) has no `WHERE active`, so
  `assignAllMissionsToUser` gives every new user the inactive ones too. Add the filter to the query.
- **Fan-out**: `assignMissionToAllUsers` (`utils/helpersDb.ts:769-802`) is `2 + 2·U` queries with a
  SELECT→INSERT window that duplicates rows when two admins act at once. Replaced by one statement:
  ```sql
  INSERT INTO user_missions (user_id, mission_template_id, progress, completed, community_id)
  SELECT u.id, $1, $2::jsonb, false, u.community_id
    FROM users u
   WHERE ($3::uuid IS NULL OR u.community_id = $3::uuid)
  ON CONFLICT (user_id, mission_template_id) DO NOTHING;
  ```
  This needs the unique index from D10 step 6.
- **`moveUserToCommunity`**: deletes `user_missions` at `models/admin.ts:1069` and never reassigns,
  leaving the user permanently unable to earn (`progressMission` returns early at
  `utils/helpersDb.ts:659` when no row exists). Call `assignAllMissionsToUser` after the move, inside
  the same `adminScopeTx`.
- **Reward atomicity**: `progressMission` grants credits and sends the notification *before* marking
  the row completed (`utils/helpersDb.ts:668-691`). Reorder so the guarded
  `UPDATE user_missions … WHERE completed = false` runs **first** and its row count gates the reward;
  0 rows means another request already completed it and no credit is granted.

### D12 — Input validation and the integer boundary

`credits_balance`/`credits_locked` are `BIGINT`; `price_credits`/`offered_credits` are `INTEGER`
(`server/database_creation.sql:33-34,77,81`). A decimal reaches Postgres and raises a 500.

- `makeOffer` gets a real body schema — today it has **none**, and `safeNumber(req.body.price)`
  returning `undefined` passes `offeredCredits < 0`, `offeredCredits > price` and
  `balance < offeredCredits` alike (`controllers/listings.ts:156`; `models/listings.ts:314-316,326`).
  New: `z.object({ price: z.number().int().min(0).max(MAX_CREDITS) })`.
- `donate`: `z.number().int().min(DONATION_MIN).max(DONATION_MAX)` replacing the ad-hoc
  `typeof amount !== "number" || amount <= 0` at `controllers/users.ts:71`.
- `tradingListingIds`: `z.array(z.uuid()).max(MAX_TRADE_LISTINGS)` with duplicates rejected. Today
  each element is UUID-checked individually (`controllers/listings.ts:223-225`) but there is no array
  schema, no cardinality bound and no dedup, and duplicates are summed twice at
  `models/listings.ts:564`.
- `createListing`: `price` gains `.int()`, and the model validates it against
  `categories.min_price_credits`/`max_price_credits` (nullable `INTEGER`,
  `server/database_creation.sql:53-54`) raising the already-defined but entirely unused
  `INVALID_PRICE_FOR_CATEGORY` (`config.ts:110`). It also verifies every `mediaId` has
  `uploaded_by = $userId`.

Donation limits live as constants in `config.ts` (`DONATION_MIN_CREDITS`, `DONATION_MAX_CREDITS`,
`DONATION_DAILY_MAX_CREDITS`). Per-community configuration is PROD-02 and out of scope. The daily cap
is enforced by summing today's `donation_sent` rows in the ledger — a capability that only exists
because ECO-02 is being fixed in the same change.

### D13 — Concurrency test harness: real DB, gated, following `rls.test.ts`

The existing fixtures in `server/api/src/tests/utils.ts` are **mocks** — `databaseQueryMock` returns
canned rows and cannot express two connections racing. A concurrency proof written against them would
assert nothing. The Jest `api` project's other suites (`auth`, `roles`, `schools`, `users`) boot the
app in-process against an ambient DB with no skip guard and no seeding, which is why they are stale.

`server/api/src/tests/creditConcurrency.test.ts` therefore follows the **`rls.test.ts` pattern**
exactly (`server/api/src/tests/rls.test.ts:10-13,30-35`): gated behind `RUN_DB_TESTS=1`, opening raw
`pg.Client` connections — the owner role to seed and clean, the app role to exercise the guards —
seeding its own fixtures under a `credits-${Date.now()}` suffix and cleaning up in `afterAll`. It
runs against the dockerised Postgres from `docker-compose.dev.yml`, which publishes `5432` on the
host; `docker-compose.e2e.yml` deliberately publishes no ports
(`docker-compose.e2e.yml:18-19`) and so cannot be reached from a host-side Jest run.

Two races are proven, each by firing both statements on **separate connections** and awaiting with
`Promise.allSettled` so neither is serialised by `pg`'s per-connection queue:

1. **Two offers, one listing.** Buyers A and B both `POST /:id/offer`. Exactly one row matches the
   transition-2 guard; the loser gets 409 and their `credits_locked` stays 0.
2. **Two donations, one balance.** One user with balance N donates N twice concurrently. Exactly one
   guarded UPDATE matches; the final balance is 0, never `−N`, and exactly two ledger rows exist
   (`donation_sent` + `donation_received`), not four.

A third assertion runs the D6 reconciliation query over the fixtures after both races and requires
zero discrepancies — the invariant is the real subject of the test.

Exact commands are in `tasks.md`.

## Corrections to the Audit

The audit is accurate on almost every line number; these are the exceptions and the imprecisions.

1. **Paths.** The brief says `server/api/src/db/postgresClient.ts` and `db/queries.ts`. There is no
   `db/` directory. The real paths are `server/api/src/services/postgresClient.ts` and
   `server/api/src/services/queries.ts`. `AGENTS.md:81` is correct. Likewise `helpersDb.ts` is at
   `server/api/src/utils/helpersDb.ts`, not the `services/` root implied by the audit's bare
   `helpersDb.ts:669-678`.

2. **ECO-04 overstates the missing validation.** The audit says `acceptOffer` "does not validate that
   traded listings … belong to the buyer". It **does** — `models/listings.ts:558-560` raises
   `NOT_LISTING_BUYER` when any traded listing's `sellerId !== oldListing.buyerId`. What is genuinely
   missing is the `listing_status = 'published'` and `buyer_id IS NULL` check, and the fact that the
   ownership check reads a row nobody has locked. The fix is unchanged; the finding's wording is not.

3. **ECO-04 on `tradingListingIds`.** "Never passes through Zod" is literally true but reads as
   "unvalidated". Each element **is** UUID-validated via `validateId` = `z.uuid().parseAsync`
   (`controllers/listings.ts:223-225`, `services/validations.ts:16`). The real gaps are: no array
   schema, no cardinality bound, and no duplicate rejection — duplicates are summed twice at
   `models/listings.ts:564`.

4. **ECO-11 on inactive templates.** "Inactive templates are still assigned" is correct for
   *assignment*, but the audit's phrasing invites the reader to also fix *progression*, which already
   filters correctly at `utils/helpersDb.ts:653` (`if (missionTemplate.active === false) return;`).
   Only the assignment queries need the filter.

5. **ECO-11's evidence pointer for the N+1.** The audit cites `admin.ts:687-691`. That is the *call
   site*; the N+1 loop itself is `assignMissionToAllUsers` at `utils/helpersDb.ts:769-802`, which
   already carries a `TODO` (`:759-768`) describing this exact defect and the exact fix.

6. **ECO-05's client citation is stale by six lines.** The Cancel button with no `onPress` is at
   `client/components/ListingButtons.tsx:114-116`, not `:108-110`. Lines 108-110 are the tail of the
   *working* "Mensaje" button. Note there is a second, genuinely working "Cancelar" at `:93` (the
   buyer retracting an offer, wired to `handleDeleteOffer`) — do not confuse them.

7. **Two audit ranges are truncated at the end** (harmless, but tasks cite the corrected ones):
   `models/listings.ts:859-881` should be `859-886` (the buyer update ends at 886);
   `models/users.ts:87-93` should be `87-98`.

8. **`models/self.ts` deleteSelf range.** The audit's `481-522` is exact. The brief's "~460-540" is
   not: `460-479` is `modifyUserPassword`.

9. **`models/accountDeletion.ts`.** `resolveRequest` spans `90-131`, not `120-130`. Its defect is
   sharper than "does not share a transaction": it uses **three separate** non-transactional
   `withClient` calls and commits the `completed` status *before* attempting the deletion.

### Defects found that the audit does not record

- **`makeOffer` has no request-body schema at all.** `offeredCredits: undefined` passes
  `offeredCredits < 0`, `offeredCredits > listing.price` and `balance < offeredCredits` — all three
  comparisons are `false` against `undefined` (`controllers/listings.ts:153-178`;
  `models/listings.ts:314-316,326`). This is a wider hole than ECO-08's "accepts decimals".
- **`createListing` is not transactional** (`models/listings.ts:178`) yet calls `progressMission`
  three times (`:160,165,170`), each able to mint credits. A failure between grants is unrecoverable.
- **`receiveListing` rewrites the buyer's `credits_balance` to its just-read value**
  (`models/listings.ts:724-729`) while intending to change only `credits_locked` — a lost-update
  surface with no purpose.
- **`updateListingsBuyerToNullByUserId` has no status filter** (`services/queries.ts:1011-1016`), so
  deleting a user reverts **`received`** — settled, terminal — loops back to `published`.
- **`withClient` swallows COMMIT failures** (`services/postgresClient.ts:167-169`): a failed COMMIT
  is reported to the caller as success. Recorded, not fixed here — it is `postgresClient` surgery
  that would widen this change's blast radius well past the credit economy.
- **The `catch {}` blocks in `models/listings.ts`** (`:628-664`, `:715-754`, `:767-818`) discard the
  original error and re-throw a generic `InternalServerError`. Once
  `db-integrity-migrations` lands its `CHECK` constraints, these would convert a clean constraint
  violation into an opaque 500. The rewritten flows narrow them.
- **No `UNIQUE` on `mission_templates.key`.** `models/admin.ts:671-674` checks uniqueness in
  application code only — a TOCTOU race between two admins. Fixed by D10 step 7.
- **`getUserMissionsByUserId` non-null assertion** at `utils/helpersDb.ts:481`: a `user_missions` row
  whose template is invisible yields `undefined` past a `!`. Recorded, not fixed.
- **`getNotificationsByUserId` pagination is inconsistent** with its own filtering: `total_records`
  is computed by `COUNT(*) OVER()` before hydration (`services/queries.ts:198-208`) but rows are
  dropped after it (`utils/helpersDb.ts:600-608`), so a page can return fewer items than promised.
  In scope for ECO-12.
- **`NOTIFICATIONS_CATEGORIES.MESSAGE = "message"`** (`config.ts:228-234`) is not a member of the
  `notification_type` enum (`server/database_creation.sql:126`). Recorded, not fixed.

## Rejected Alternatives

| Alternative | Why rejected |
|---|---|
| `SERIALIZABLE` isolation | Needs retry-on-40001 in `withClient`; blast radius far beyond credits; the `WHERE` guard solves it without retries |
| `SELECT … FOR UPDATE` on `users` everywhere | Leaves the arithmetic in JS; correctness depends on every future author remembering the lock |
| A separate `credit_movements` table | `wallet_transactions` already exists with the right enum and a `balance_after` column; a second table would need reconciling against the first |
| Deriving `locked_after` from `balance_after` | Impossible — they are independent buckets; a lock changes both in opposite directions |
| Adding `cancelled` to `listing_status` | `ALTER TYPE … ADD VALUE` cannot be used in the same transaction; and a cancelled listing belongs back on the market, which is `published` |
| Auto-repairing drift in the reconciliation script | Hides the bug that caused it; a wrong repair is worse than a loud alarm |
| Building the expiry cron here | No scheduler exists anywhere in the repo; introducing one belongs to `delivery-and-ci`. The `status_changed_at` column is added so that block has something to run on |
| Writing the concurrency test against `tests/utils.ts` mocks | Mocks cannot race; the test would assert nothing |
