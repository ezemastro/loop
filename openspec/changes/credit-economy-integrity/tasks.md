# Tasks: Credit Economy Integrity

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1200–1500 (server ~1150, client ~40, migration ~130, tests ~250) |
| Session review budget | 800 lines/PR (configured) |
| 400-line budget risk | High (against the 400-line skill default; the change is one indivisible economic invariant) |
| Chained PRs recommended | No |
| Suggested split | None — see rationale below |
| Delivery strategy | single-pr / exception-ok |
| Chain strategy | N/A (single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High

**Why a single PR despite the size.** The ledger invariant `balance == Σ balance_delta` is either
true or false; there is no intermediate commit where half the call sites write ledger rows and the
reconciliation check passes. Splitting at the natural seam — "atomicity first, ledger second" — would
land a middle state whose reconciliation script fails by construction, which is worse to review than
a large coherent diff. The migration's genesis rows (design D6) must land in the same deploy as the
first ledger write for the same reason. Phases 1–8 below are ordered so the diff reads as a narrative
and each phase is independently reviewable within the one PR.

### Suggested Work Units

| Unit | Goal | Branch | Focused test command | Runtime harness | Rollback boundary |
|------|------|--------|-----------------------|------------------|--------------------|
| 1 | Whole change | `fix/auditoria-2026-09` | `cd server/api && npm run check-types && npm run check-sql` | Dockerised Postgres via `docker-compose.dev.yml`; Playwright `e2e/` | Migration `0014` is additive; reverting `utils/credits.ts` + `services/queries.ts` restores prior behaviour wholesale |

**Environment.** The Jest `api` project's existing suites (`auth`, `roles`, `schools`, `users`) are
known stale and depend on ambient DB data with no skip guard — they are **not** a gate for this
change (INF-06). The gates are `npm run check-types`, `npm run check-sql`, the new
`RUN_DB_TESTS=1`-gated concurrency suite, and Playwright `e2e/`.

**Bring the database up (once, for every DB-touching task below):**

```
docker compose -f docker-compose.dev.yml up -d db api
npm run dev:migrate
```

`docker-compose.dev.yml` publishes Postgres on host `5432`; `docker-compose.e2e.yml` publishes no
ports (`docker-compose.e2e.yml:18-19`) and cannot be reached from a host-side Jest run.

---

## Phase 1: Migration

- [x] 1.1 Create `server/migrations/0014_credit_ledger_integrity.sql`. Spanish `--` prose header in
      house style (mirror `server/migrations/0007_db_roles_and_rls.sql:1-17` and
      `0008_email_verification.sql:1-7`): what, then why, then rejected alternatives. No
      `-- migrate:no-transaction` pragma — atomicity of the genesis rows outweighs lock duration
      (design D10). — *credit-ledger: Ledger Entry On Every Movement*
- [x] 1.2 In `0014`, add to `wallet_transactions`: `balance_delta BIGINT NOT NULL DEFAULT 0`,
      `locked_delta BIGINT NOT NULL DEFAULT 0`, `locked_after BIGINT`, `reason TEXT` — all
      `IF NOT EXISTS`. Existing columns `balance_after` (`server/database_creation.sql:103`) and the
      `transaction_type` enum (`:97`) already exist and MUST NOT be recreated. — *credit-ledger: Locked-Bucket Semantics*
- [x] 1.3 In `0014`, back-fill `balance_delta` for existing rows from `positive`/`amount` so the
      admin history at `server/api/src/models/admin.ts:353` is not silently zero.
- [x] 1.4 In `0014`, add a `CHECK` on `reason` over the sixteen values in design D5, allowing `NULL`
      for legacy rows.
- [x] 1.5 In `0014`, drop `wallet_transactions_user_community_fk`
      (`server/migrations/0004_not_null_and_fks.sql:134-137`), `ALTER COLUMN user_id DROP NOT NULL`
      (`server/database_creation.sql:100`), and re-add the composite FK with `ON DELETE SET NULL`.
      Leave `community_id` `NOT NULL` so RLS still scopes anonymised rows. — *account-deletion-integrity: The Ledger Survives Deletion*
- [x] 1.6 In `0014`, insert one `genesis_opening_balance` row per user with
      `balance_delta = credits_balance`, `locked_delta = credits_locked`, `balance_after`/
      `locked_after` matching, `type = 'admin'`. Without this the invariant is false for every
      existing user (design D6). — *credit-ledger: Reconciliation Invariant*
- [x] 1.7 In `0014`, de-duplicate `user_missions` on `(user_id, mission_template_id)` keeping the
      oldest row, then `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_missions_user_template`. No such
      constraint exists today in `server/database_creation.sql:118-125` or any migration. — *mission-progress: Set-Based, Idempotent Fan-Out*
- [x] 1.8 In `0014`, de-duplicate `mission_templates` on `key`, then
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_mission_templates_key`. `server/api/src/models/admin.ts:671-674`
      assumes this uniqueness in application code only — a TOCTOU race between two admins. — *mission-progress: "Template keys are unique"*
- [x] 1.9 In `0014`, `ALTER TABLE listings ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP(0)`
      back-filled from `COALESCE(updated_at, created_at)`. Nothing reads it in this change; it exists
      so a future expiry job has a timestamp (`listings` has none today,
      `server/database_creation.sql:83-84`).
- [x] 1.10 Apply and verify: `docker compose -f docker-compose.dev.yml up -d db api && npm run dev:migrate`,
      then `cd server/api && npm run migrate:status` shows nothing pending.
  - **Checkpoint**: `db-integrity-migrations` claims `0009`–`0013`
    (`openspec/changes/db-integrity-migrations/design.md:357-361`), which is why this file is `0014`.
    Its `0010_credit_balance_checks.sql` clamps negative balances and adds the two credit `CHECK`
    constraints, and must be applied **before** this migration — the genesis rows in task 1.6 assume
    balances are already non-negative. If block B has not landed yet, apply its `0009`–`0013` first,
    or run this against a database whose balances are known non-negative. Never edit an applied
    migration; the runner checksums by basename.

## Phase 2: The credit choke point

- [x] 2.1 Add `queries.applyCreditDelta` to `server/api/src/services/queries.ts` — the guarded
      relative update from design D1, four parameters, with `RETURNING credits_balance, credits_locked`. — *credit-ledger: Atomic Balance Mutation*
- [x] 2.2 Add `queries.insertCreditLedgerEntry` to `server/api/src/services/queries.ts`, writing
      `user_id, type, positive, amount, balance_delta, locked_delta, balance_after, locked_after,
      reason, reference_id, meta, community_id`. Keep `amount`/`positive` populated so the admin
      surface and `server/api/src/services/validations.ts:126-138` keep working.
- [x] 2.3 Create `server/api/src/utils/credits.ts` with `CreditReason` (the sixteen values of design
      D5), `CreditMovement`, and `applyCreditMovements(client, movements)`. It MUST sort by `userId`
      before issuing any statement (design D3 rule 3) and MUST reject a movement whose two deltas are
      both zero. — *credit-ledger: Single Mutation Choke Point, Deadlock-Free Lock Ordering*
- [x] 2.4 In `applyCreditMovements`, on zero affected rows, re-read via `queries.userById` to
      distinguish `NotFoundError(USER_NOT_FOUND)` from `InvalidInputError(INSUFFICIENT_CREDITS)`
      (design D1). — *credit-ledger: "Guard fires before the database constraint"*
- [x] 2.5 **Delete** `queries.updateUserBalance` (`server/api/src/services/queries.ts:448-453`). The
      compiler now marks every one of its eleven call sites. — *credit-ledger: "No orphan balance writer remains"*

## Phase 3: Listing flows

- [x] 3.1 Add `listing_status = 'published' AND buyer_id IS NULL` plus `RETURNING *` to
      `queries.newOffer` (`server/api/src/services/queries.ts:427-432`); treat zero rows as
      `ConflictError` → 409 in `ListingsModel.newOffer` (`server/api/src/models/listings.ts:339`). — *listing-lifecycle: "A second buyer cannot overwrite the first"*
- [x] 3.2 Rewrite the buyer lock in `newOffer` (`server/api/src/models/listings.ts:365-370`) as a
      single `applyCreditMovements` call with `offer_lock`. — *credit-ledger: Ledger Entry On Every Movement*
- [x] 3.3 Rewrite `deleteOffer` (`server/api/src/models/listings.ts:414-419`) → `offer_unlock_withdrawn`,
      and `rejectOffer` (`:500-505`) → `offer_unlock_rejected`. Both MUST source the refund amount
      from the row their own `deleteOffer` update returned, not from the stale read at `:392`/`:471`.
- [x] 3.4 In `acceptOffer`, replace the unordered `Promise.all` of `getListingById`
      (`server/api/src/models/listings.ts:551-553`) with one `SELECT … WHERE id = ANY($1) … ORDER BY id FOR UPDATE`
      (design D3 rules 2 and 5). — *listing-lifecycle: Guarded State Transitions*
- [x] 3.5 Add `listing_status = 'published' AND buyer_id IS NULL AND seller_id = $n` plus `RETURNING *`
      to `queries.markListingAsSold` (`server/api/src/services/queries.ts:475-480`); replace the
      `Promise.all` at `server/api/src/models/listings.ts:641-645` with an ordered loop that fails the
      whole acceptance with 409 if any claim returns zero rows. — *listing-lifecycle: Validated And Persisted Trades*
- [x] 3.6 Call `queries.storeTrade` (`server/api/src/services/queries.ts:455-459`, currently **zero
      call sites**) once per traded listing inside `acceptOffer`'s transaction. — *listing-lifecycle: "Accepted trades are recorded"*
- [x] 3.7 Replace both balance writes in `acceptOffer`
      (`server/api/src/models/listings.ts:647-652`, `:655-660`) with one batched
      `applyCreditMovements` carrying `accept_seller_lock` and `accept_buyer_adjust`. Omit
      `accept_buyer_adjust` when its deltas are zero (design D5). Also replace the ordered
      `Promise.all` of `updateListingOfferedCreditsById` at `:631-637` with a loop.
- [x] 3.8 Rewrite `receiveListing`'s two writes (`server/api/src/models/listings.ts:724-729`,
      `:746-751`) as one batch: `receive_buyer_settle` `(0, −offered)` and `receive_seller_credit`
      `(+offered, 0)`. The buyer's `credits_balance` MUST NOT be written at all. — *credit-ledger: "Only the intended bucket changes"*
- [x] 3.9 Narrow the blanket `catch { throw new InternalServerError(...) }` blocks in
      `server/api/src/models/listings.ts:628-664`, `:715-754` and `:767-818` so typed domain errors
      propagate as 4xx instead of being flattened to 500. Required before
      `db-integrity-migrations`' `CHECK` constraints land.
- [x] 3.10 Add `transaction: true` to `createListing`'s options
      (`server/api/src/models/listings.ts:178`), which today grants mission credits three times
      (`:160,165,170`) with no transaction. — *listing-lifecycle: "A failure grants no credits"*
- [x] 3.11 In `createListing`, validate `price` against `categories.min_price_credits`/
      `max_price_credits` (`server/database_creation.sql:53-54`) raising the defined-but-unused
      `INVALID_PRICE_FOR_CATEGORY` (`server/api/src/config.ts:110`), and verify every `mediaId` has
      `uploaded_by = $userId`. — *listing-lifecycle: Transactional Listing Creation With Category Bounds*

## Phase 4: Cancellation (ECO-05)

- [x] 4.1 Rewrite `ListingsModel.cancelListing` (`server/api/src/models/listings.ts:824-914`) per
      design D7 transitions 7 and 8: allow **either** party (today it is seller-only, `:835-837`);
      guard on `listing_status = 'accepted'` in the SQL; release each party exactly what that loop
      escrowed. Delete the out-of-pocket `sellerShouldPay` charge (`:853`) and the full-`price` buyer
      credit (`:882`) — that code provably never ran (arity bug documented at `:891-892`). — *listing-lifecycle: Cancellation Of An Accepted Loop*
- [x] 4.2 In `cancelListing`, return every listing linked through `listing_trades` to `published`
      with `buyer_id = NULL`, then delete those trade rows, in the same transaction. — *listing-lifecycle: "Traded listings return to the market"*
- [x] 4.3 Emit `cancel_buyer_refund` and `cancel_seller_unlock` through one batched
      `applyCreditMovements`.
- [x] 4.4 Add `ListingsController.cancelListing` to `server/api/src/controllers/listings.ts`,
      validating `listingId` with `validateId` as its siblings do (`:222`).
- [x] 4.5 Add `listingsRouter.post("/:listingId/cancel", tokenMiddleware, ListingsController.cancelListing)`
      to `server/api/src/routes/listings.ts` (currently 16 lines, no cancel route). — *listing-lifecycle: "The client can reach cancellation"*
- [ ] 4.6 Add `client/hooks/useListingCancel.ts` following `client/hooks/useListingRejectOffer.ts:8-9`,
      posting to `/listings/${listingId}/cancel`, with the same query-key invalidation as its siblings.
      **SKIPPED**: `client/` is explicitly out of the file boundaries this apply pass was authorized
      to touch (concurrent-agent session preflight). The endpoint itself (4.4/4.5) is implemented,
      guarded, and verified directly against the real DB — only the client wiring is missing. See
      `TESTING-MANUAL.md` §7 for the manual follow-up.
- [ ] 4.7 Wire the dead Cancel button at `client/components/ListingButtons.tsx:114-116` to that hook.
      Do **not** touch the working "Cancelar" at `:93` — that is the buyer retracting an offer, bound
      to `handleDeleteOffer`. Show the control for the buyer too, per design D7 transition 8.
      **SKIPPED** — same reason as 4.6.

## Phase 5: Deletion (ECO-06)

- [x] 5.1 In `SelfModel.deleteSelf` (`server/api/src/models/self.ts:481-522`), before the deletes at
      `:501-502`, enumerate the user's open loops in both roles and release each surviving
      counterparty with a `deletion_release` movement. — *account-deletion-integrity: Third-Party Credits Are Released*
- [x] 5.2 Add `AND listing_status IN ('offered','accepted')` to
      `queries.updateListingsBuyerToNullByUserId` (`server/api/src/services/queries.ts:1011-1016`),
      which today has no status filter and reverts settled `received` loops to `published`. — *account-deletion-integrity: "A settled loop is not reopened"*
- [x] 5.3 Remove the `deleteWalletTransactionsByUserId` call
      (`server/api/src/models/self.ts:506`) and delete the query
      (`server/api/src/services/queries.ts:1023-1027`). The FK from task 1.5 now nulls `user_id`
      automatically. — *account-deletion-integrity: The Ledger Survives Deletion*
- [x] 5.4 Collapse `AccountDeletionModel.resolveRequest`
      (`server/api/src/models/accountDeletion.ts:90-131`) from three separate non-transactional
      `withClient` calls into one `{ scope: unscoped("admin"), transaction: true }`, so the request is
      no longer committed as `completed` before the deletion is attempted. — *account-deletion-integrity: Deletion Is One Transaction*

## Phase 6: Donations, admin, missions

- [x] 6.1 Rewrite `UsersModel.donate` (`server/api/src/models/users.ts:87-98`) as one batched
      `applyCreditMovements` with `donation_sent` and `donation_received`. — *credit-ledger: "A donation records both sides"*
- [x] 6.2 Add `DONATION_MIN_CREDITS`, `DONATION_MAX_CREDITS`, `DONATION_DAILY_MAX_CREDITS` to
      `server/api/src/config.ts` (constants; per-community config is PROD-02, out of scope). Enforce
      the daily cap by summing today's `donation_sent` rows. — *credit-ledger: Donation Limits*
- [x] 6.3 Replace the ad-hoc check at `server/api/src/controllers/users.ts:71`
      (`typeof amount !== "number" || amount <= 0`, which accepts decimals over an integer column)
      with a Zod schema in `server/api/src/services/validations.ts`. — *credit-ledger: "A non-integer donation is rejected"*
- [x] 6.4 Add a Zod body schema for `makeOffer` — it currently has **none**
      (`server/api/src/controllers/listings.ts:153-178`), so `offeredCredits: undefined` passes all
      three guards at `server/api/src/models/listings.ts:314-316,326`. Add
      `z.array(z.uuid()).max(...)` with duplicate rejection for `tradingListingIds`
      (`server/api/src/controllers/listings.ts:223-225`). Add `.int()` to `price` in
      `postListingsRequestBody`/`patchListingsRequestBody`
      (`server/api/src/services/validations.ts:299-315`). — *listing-lifecycle: Credit-Bearing Input Validation*
      **DEVIATION**: `makeOffer`'s schema and `tradingListingIds`' array schema landed as new,
      appended exports in `validations.ts` (both greenfield, no boundary conflict). The `.int()` on
      `postListingsRequestBody`/`patchListingsRequestBody` did NOT land in `validations.ts` — those
      are pre-existing schemas explicitly owned by `sec-hardening-api` for this session
      (`services/validations.ts`'s EXISTING schemas were off-limits). Equivalent protection lands in
      `ListingsModel.createListing` instead: `Number.isInteger(price)` is checked in the model
      before the category-bounds check, raising `INVALID_PRICE_FOR_CATEGORY`. `updateListing`'s price
      path is unchanged (not in this task's scope).
- [x] 6.5 Route `AdminModel.modifyUserCredits` (`server/api/src/models/admin.ts:353-367`) through
      `applyCreditMovements` with `admin_grant`/`admin_debit`; delete
      `queries.increaseUserBalance`/`decreaseUserBalance`
      (`server/api/src/services/queries.ts:860-871`) — the latter has no floor and can go negative.
- [x] 6.6 Fix `queries.progressMission` (`server/api/src/services/queries.ts:593-598`):
      `completed_at = CASE WHEN $2 THEN COALESCE(completed_at, NOW()) ELSE completed_at END`, and add
      `AND completed = false` so the row count gates the reward. — *mission-progress: Completion Timestamp Records Completion*
- [x] 6.7 Reorder `progressMission` (`server/api/src/utils/helpersDb.ts:668-691`) so the guarded
      mission update runs **first** and gates the reward; grant via `applyCreditMovements` with
      `mission_reward`. — *mission-progress: A Mission Rewards Once*
- [x] 6.8 Add `WHERE active = true` to `queries.allMissionTemplates`
      (`server/api/src/services/queries.ts:577-580`). Do **not** change `progressMission`'s active
      handling — it already filters correctly at `server/api/src/utils/helpersDb.ts:653`. — *mission-progress: Only Active Templates Are Assigned*
      **DEVIATION**: did not add the filter to `allMissionTemplates` itself — that query is also the
      one `AdminModel.getMissionTemplates` uses to list templates in the admin panel, where inactive
      ones must stay visible so an admin can reactivate them. Added a new `queries.activeMissionTemplates`
      instead and pointed `assignAllMissionsToUser`/`assignMissionToAllUsers` (the only two
      assignment paths) at it. Net effect on the two scenarios in `mission-progress/spec.md` is
      identical; `allMissionTemplates` itself is untouched.
- [x] 6.9 Replace `assignMissionToAllUsers` (`server/api/src/utils/helpersDb.ts:769-802`, a
      `2 + 2·U` N+1 with a documented duplicate window at `:759-768`) with the single
      `INSERT … SELECT … ON CONFLICT (user_id, mission_template_id) DO NOTHING` from design D11. — *mission-progress: Set-Based, Idempotent Fan-Out*
- [x] 6.10 In `AdminModel.moveUserToCommunity` (`server/api/src/models/admin.ts:1069`), call
      `assignAllMissionsToUser` after the move, inside the same `adminScopeTx`. — *mission-progress: Missions Follow A Moved User*

## Phase 7: Notifications and lossy reads (ECO-12)

- [x] 7.1 Add `listing_sold` to `NOTIFICATION_TEXTS.LOOP_NOTIFICATION`
      (`server/api/src/config.ts:180-205`) — it is emitted at
      `server/api/src/models/listings.ts:687` but has no text. Remove the
      `as Record<LoopNotificationPayload["type"], ...>` cast at `server/api/src/config.ts:205`, which
      is what suppresses the exhaustiveness error that would have caught this. — *notification-integrity: "A missing text fails the build"*
- [x] 7.2 In `getSchoolsByIds` (`server/api/src/utils/helpersDb.ts:130-137`), return the school with a
      null media reference instead of dropping it. — *notification-integrity: "A school with unreachable media is still listed"*
      **KNOWN FOLLOW-UP**: this widened `School.media` (`shared/types/app.d.ts`) from `Media` to
      `Media | null`, which is also used by `getSchoolById`, now fixed the same way. Two spots in
      `server/api/src/tests/utils.ts` (`MOCK_SCHOOL.media.id`, ~lines 470/490) now fail
      `tsc --noEmit` because that mock still assumes non-null. `src/tests/` was off-limits for this
      apply pass; the fix is a one-line null-check/assertion, left for whoever owns that file's
      cleanup. `npx eslint src` and `npm test` are otherwise unaffected — see final report.
- [x] 7.3 In `getNotificationsByUserId` (`server/api/src/utils/helpersDb.ts:600-608`), stop discarding
      notifications whose referenced record is gone; return them from their stored payload, and make
      the reported total consistent with the rows returned
      (`server/api/src/services/queries.ts:198-208` counts before hydration). — *notification-integrity: Reads Do Not Silently Drop Rows, Pagination Counts Match Returned Rows*

## Phase 8: Reconciliation and the concurrency proof

- [x] 8.1 Create `server/api/src/scripts/reconcileCredits.ts` running the design D6 query under
      `unscoped("admin")`, read-only, printing every discrepant user and exiting non-zero when any
      exists. It MUST NOT repair. Report rows with a null `user_id` separately as retained audit
      history. — *credit-ledger: Reconciliation Invariant*
- [x] 8.2 Add `"reconcile-credits": "tsx src/scripts/reconcileCredits.ts"` to
      `server/api/package.json` beside `migrate` (`:20`).
- [x] 8.3 Create `server/api/src/tests/creditConcurrency.test.ts` following the `rls.test.ts` pattern
      exactly (`server/api/src/tests/rls.test.ts:10-13,30-35`): gated behind `RUN_DB_TESTS === "1"`,
      raw `pg.Client` connections — owner role to seed and clean, app role to exercise the guards —
      fixtures suffixed `credits-${Date.now()}`, cleaned in `afterAll`. Do **not** use
      `server/api/src/tests/utils.ts`; those fixtures are mocks and cannot race (design D13).
- [x] 8.4 Test 1 — two simultaneous offers on one listing, fired on **separate connections** and
      awaited with `Promise.allSettled` (a single connection would serialise them). Assert: exactly
      one listing row is `offered`, the loser's `credits_locked` is 0, and exactly one `offer_lock`
      ledger row exists. — *listing-lifecycle: "A second buyer cannot overwrite the first"*
- [x] 8.5 Test 2 — one user with balance N issuing two simultaneous donations of N, on separate
      connections. Assert: exactly one succeeds, final balance is 0, never negative, and exactly two
      ledger rows exist (`donation_sent` + `donation_received`), not four. — *credit-ledger: "Concurrent donations cannot overdraw"*
- [x] 8.6 Test 3 — run the design D6 reconciliation query over the fixtures after tests 1 and 2 and
      assert zero discrepancies. — *credit-ledger: Reconciliation Invariant*
- [x] 8.7 Test 4 — lock ordering: one transaction accepting an offer while another donates in the
      opposite user order; assert both settle with no deadlock error (SQLSTATE `40P01`). — *credit-ledger: "Opposite-direction transactions do not deadlock"*
- [x] 8.8 Run the suite. **Exact commands, from the repository root:**
      ```
      docker compose -f docker-compose.dev.yml up -d db api
      npm run dev:migrate
      cd server/api && RUN_DB_TESTS=1 PGHOST=localhost npm test -- src/tests/creditConcurrency.test.ts
      ```
      `PGHOST=localhost` is required because `server/api/src/config.ts:20` defaults `DB_HOST` to `db`,
      the in-compose hostname, which does not resolve from the host.
      Teardown: `docker compose -f docker-compose.dev.yml down`.

## Phase 9: Gates

- [x] 9.1 `cd server/api && npm run check-types` — passes. This is the exhaustiveness proof for
      task 2.5: every removed `updateUserBalance` call site must have been rewritten.
- [x] 9.2 `cd server/api && npm run check-sql` — passes. Every new query's `$N` arity must match its
      call sites (`server/scripts/check-sql-arity.py`).
- [x] 9.3 `rg "updateUserBalance" server/api/src` returns nothing. — *credit-ledger: Single Mutation Choke Point*
- [x] 9.4 `cd server/api && npm run reconcile-credits` against the seeded dev database — zero
      discrepancies.
- [x] 9.5 Playwright: `npm run test:e2e` from the root. `e2e/tests/02_listing_journey.e2e.spec.ts`
      covers the loop end to end and is the regression gate for the six rewritten flows. Note
      `e2e/README.md:84` and `e2e/tests/02_listing_journey.e2e.spec.ts:230` assert that
      `listing_trades` is *never* written — those assertions **must be inverted** by task 3.6.
- [x] 9.6 Manual readback: confirm ECO-07 is unchanged — a listing priced 100, an offer of 80 with no
      trades, is still refused at accept time with `TOTAL_PRICE_EXCEEDED`
      (`server/api/src/models/listings.ts:605-606`). — *listing-lifecycle: Preserved Offer Pricing Rule*
- [x] 9.7 Update `AUDITORIA-PROGRESO.md`: mark block C closed, list ECO-07 under "Salteados a
      propósito", and add the new defects from design "Corrections to the Audit" under
      "Descubrimientos nuevos".

---

## Recorded Follow-ups (explicitly deferred, not fixed here)

- **ECO-07** — an offer below the asking price can never be accepted. Product decision; two options
  documented in `proposal.md`. Behaviour deliberately unchanged.
- **`withClient` swallows COMMIT failures** (`server/api/src/services/postgresClient.ts:167-169`): a
  failed COMMIT is reported to the caller as success. Fixing it is `postgresClient` surgery well past
  this change's blast radius, but it means a committed-looking credit movement could in principle be
  lost. Highest-value item in this list.
- **Loop expiry.** No scheduler, cron, queue, or `setInterval` exists anywhere in the server. Task 1.9
  adds `listings.status_changed_at` so a future job has a timestamp; the job itself belongs to
  `delivery-and-ci`. Until then, cancellation (Phase 4) is the manual exit.
- **`getUserMissionsByUserId` non-null assertion** (`server/api/src/utils/helpersDb.ts:481`): a
  `user_missions` row whose template is invisible yields `undefined` past a `!`.
- **`NOTIFICATIONS_CATEGORIES.MESSAGE = "message"`** (`server/api/src/config.ts:228-234`) is not a
  member of the `notification_type` enum (`server/database_creation.sql:126`).
- **`amount`/`positive` are redundant with `balance_delta`** in `wallet_transactions`. Kept populated
  for the admin panel and `server/api/src/services/validations.ts:126-138`; collapsing them means
  touching the admin surface, which is block E's scope.
- **Stale Jest `api` suites** (`auth`, `roles`, `schools`, `users`) depend on ambient DB data with no
  skip guard — INF-06, block F.
- **PROD-10 "my movements" screen.** This change makes it possible by writing the ledger; it does not
  build it.
