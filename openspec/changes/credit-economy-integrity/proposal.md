# Proposal: Credit Economy Integrity

## Intent

Loop's credit economy has no atomicity and no audit trail. Every balance movement in the product
(offer, retract, reject, accept, receive, mission reward, donation) is a `SELECT` into JavaScript,
arithmetic in JS, then `UPDATE users SET credits_balance = $1, credits_locked = $2` with **absolute
values** (`server/api/src/services/queries.ts:448-453`). There are eleven such call sites and not one
of them takes a row lock — `rg "FOR UPDATE"` over `server/api/src` returns only the invitations path
(`server/api/src/services/queries.ts:705-710`). Postgres runs these at the default `READ COMMITTED`;
no isolation level is set anywhere (`server/api/src/services/postgresClient.ts:86-96`). Two
concurrent requests touching the same user therefore destroy or duplicate credits, deterministically.

Nothing records that any of it happened. `wallet_transactions` is written by exactly one call site —
the admin credit grant at `server/api/src/models/admin.ts:353` — and `balance_after` is never
populated because the INSERT omits the column (`server/api/src/services/queries.ts:855-859`).
`listing_trades` is never written at all: `queries.storeTrade`
(`server/api/src/services/queries.ts:455-459`) has **zero call sites**. `deleteSelf` hard-deletes the
user's whole ledger (`server/api/src/models/self.ts:506`). There is no invariant anyone can check,
so a corrupted balance is undetectable and unrepairable.

On top of that the listing state machine leaks credits at three edges: a second buyer can overwrite
the first (`newOffer` has no status guard), an `accepted` loop has **no reachable exit** (the
`cancelListing` implementation at `server/api/src/models/listings.ts:824-914` has zero call sites and
no route), and deleting a user strands the counterparty's `credits_locked` forever.

This change makes every credit movement atomic, guarded, and recorded, and closes the lifecycle holes
that strand credits.

## Scope

### In Scope

- **ECO-01** — replace absolute balance writes with a single relative, guarded, `RETURNING` update;
  0 rows becomes a typed domain error. Documented lock ordering to prevent deadlocks.
- **ECO-02** — a `wallet_transactions` row inside the same transaction as every balance mutation,
  with `balance_after`/`locked_after` populated; ledger survives user deletion; a reconciliation
  script proving `balance == Σ balance_delta` and `locked == Σ locked_delta` per user.
- **ECO-03** — `newOffer` guards on `listing_status = 'published' AND buyer_id IS NULL`; 0 rows → 409.
- **ECO-04** — `acceptOffer` validates traded listings are `published`, owned by the buyer and
  unclaimed; `markListingAsSold` becomes conditional; `listing_trades` is finally written; a Zod
  schema for `tradingListingIds`.
- **ECO-05** — `POST /listings/:listingId/cancel` with per-role rules, reverting trades and both
  sides' locks, plus the client wiring for the dead Cancel button.
- **ECO-06** — user deletion releases third parties' locked credits and runs in one transaction
  across the admin path too.
- **ECO-08** — `createListing` becomes transactional and validates category price range and media
  ownership; integer coercion on every credit-bearing input.
- **ECO-10** — donation minimum, maximum and daily cap as config constants, plus ledger entries.
- **ECO-11** — `completed_at` stops being overwritten; inactive templates stop being assigned;
  `assignMissionToAllUsers` becomes one `INSERT … SELECT … ON CONFLICT DO NOTHING`;
  `moveUserToCommunity` reassigns missions.
- **ECO-12** — `listing_sold` notification text; `getSchoolsByIds` and `getNotificationsByUserId`
  stop silently dropping rows.
- One new migration, `server/migrations/0009_credit_ledger_integrity.sql`.

### Out of Scope

- **ECO-07** — deferred, needs a product decision. See "Deferred" below. Behaviour unchanged.
- **ECO-09** (`messages.attached_listing_id ON DELETE SET NULL`), `CHECK (credits_balance >= 0)`,
  `CHECK (credits_locked >= 0)` — owned by the parallel `db-integrity-migrations` block.
- **PROD-02** per-community configurable limits. Donation limits land as constants in `config.ts`.
- **PROD-10** the user-facing "my movements" screen. This change makes it *possible* by writing the
  ledger; it does not build the screen.
- A scheduler/cron runtime for loop expiry. None exists in the repo (`rg "setInterval|cron"` over
  `server/api/src` → zero matches) and introducing one belongs to the `delivery-and-ci` block. This
  change adds the `status_changed_at` column and a manually-invocable script so the job has
  something to run on later.
- Fixing the pre-existing red/stale `server/api/src/tests/` suite (INF-06).

## Capabilities

### New Capabilities

- `credit-ledger`: atomic balance mutation, the ledger entry contract, and the reconciliation
  invariant.
- `listing-lifecycle`: the listing state machine, its guarded transitions, trade persistence, and
  cancellation.
- `account-deletion-integrity`: what deleting a user must do to third parties' credits and to the
  ledger.
- `mission-progress`: mission assignment and progression correctness.
- `notification-integrity`: notification completeness and non-lossy read paths.

### Modified Capabilities

- None. `openspec/specs/` contains only `.gitkeep`.

## Approach

**One choke point for money.** Every balance movement in the application goes through a single new
helper, `applyCreditMovement(client, movement)`, which issues one guarded relative UPDATE and one
`wallet_transactions` INSERT. The eleven scattered `updateUserBalance` call sites are deleted and the
`updateUserBalance` query itself is removed. This is the only way the "ledger on every mutation"
invariant can be enforced rather than merely intended — a reviewer checks one function, not eleven
call sites.

**Guard, do not lock.** The primary mechanism is the conditional relative update:

```sql
UPDATE users
   SET credits_balance = credits_balance + $1,
       credits_locked  = credits_locked  + $2
 WHERE id = $3
   AND credits_balance + $1 >= 0
   AND credits_locked  + $2 >= 0
   AND ($4::uuid IS NULL OR community_id = $4::uuid)
RETURNING credits_balance, credits_locked;
```

Zero rows means "the movement would have gone negative, or the user is not in this community" and
raises a typed domain error. This is what keeps the application from ever tripping the
`CHECK (credits_balance >= 0)` constraint that `db-integrity-migrations` is landing: the guard fires
first and returns a clean 400, never a 500 from a constraint violation. `RETURNING` gives us
`balance_after`/`locked_after` for free, in the same statement, with no second read to race against.

Explicit `SELECT … FOR UPDATE` is used only where a decision depends on reading a row *before*
writing it — that is `listings` in `acceptOffer` and `cancel`, never `users`.

**Ordering is a rule, not a hope.** Deadlock avoidance is stated as an invariant in the design and
enforced by making the helper accept a *batch* of movements which it sorts by `user_id` before
issuing any UPDATE. A caller physically cannot lock two users in the wrong order.

**Reuse what already exists.** The `transaction_type` enum already contains `'loop' | 'mission' |
'donation' | 'admin'` (`server/database_creation.sql:97`) and `balance_after` already exists as a
nullable column (`server/database_creation.sql:103`). The schema was designed for this; only the
writes were never implemented. The migration therefore adds four columns and three constraints, not a
new table.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/migrations/0009_credit_ledger_integrity.sql` | New | Ledger columns, genesis rows, unique indexes, `status_changed_at` |
| `server/api/src/services/queries.ts` | Modified | Remove `updateUserBalance`; add guarded movement, guarded offer/sold, ledger insert, reconciliation |
| `server/api/src/utils/credits.ts` | New | `applyCreditMovement` — the single choke point |
| `server/api/src/models/listings.ts` | Modified | All six credit flows rewritten; `cancelListing` reworked and made reachable |
| `server/api/src/models/users.ts` | Modified | `donate` limits + ledger |
| `server/api/src/models/self.ts` | Modified | `deleteSelf` releases counterparty locks, preserves ledger |
| `server/api/src/models/accountDeletion.ts` | Modified | Single transaction across resolve + delete |
| `server/api/src/models/admin.ts` | Modified | `modifyUserCredits` via the choke point; mission fan-out; `moveUserToCommunity` |
| `server/api/src/utils/helpersDb.ts` | Modified | `progressMission`, mission assignment, `getSchoolsByIds`, `getNotificationsByUserId` |
| `server/api/src/controllers/listings.ts`, `routes/listings.ts` | Modified | Cancel endpoint; Zod on offer/accept bodies |
| `server/api/src/config.ts` | Modified | `listing_sold` text; donation limits |
| `server/api/src/scripts/reconcileCredits.ts` | New | Reconciliation report |
| `server/api/src/tests/creditConcurrency.test.ts` | New | Real-DB concurrency proof |
| `client/hooks/useListingCancel.ts`, `client/components/ListingButtons.tsx` | Modified | Wire the dead Cancel button |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Genesis ledger rows mis-state opening balances, so reconciliation is green but wrong | Med | Genesis row is `balance_delta = credits_balance` at migration time by construction; reconciliation is an equality check against the same column, and the migration is a single transaction |
| Deadlock between two multi-user transactions | Med | Batch helper sorts by `user_id`; listings locked before users, in ascending id order; documented in design D3 and asserted by a test |
| `db-integrity-migrations` lands its `CHECK` before this block, turning guard-less paths into 500s | Med | The guarded UPDATE returns 0 rows *before* any constraint can fire; if only one block lands, the CHECK still only fires on paths this block removes |
| The 0-row domain error masks a genuine "user not in community" bug as `INSUFFICIENT_CREDITS` | Med | Helper re-reads scope on 0 rows to distinguish, and raises `USER_NOT_FOUND` vs `INSUFFICIENT_CREDITS` |
| Rewriting six flows in `models/listings.ts` regresses the happy path | High | Existing Playwright `e2e/tests/02_listing_journey.e2e.spec.ts` covers the journey end to end; run it as a gate |
| Cancel semantics differ from the dead `cancelListing`, surprising nobody but changing money math | Low | The dead code is provably unreachable (arity bug documented at `models/listings.ts:891-892` proves it never ran); we are specifying new behaviour, not preserving old |
| `check-sql` arity checker rejects the new multi-use placeholders | Low | Run `npm run check-sql` as an explicit task step |

## Rollback Plan

The migration `0009` is additive: four nullable/defaulted columns, three indexes, and genesis rows.
Reverting the application code leaves the extra columns unused and harmless — no existing read path
selects them by name (`SELECT *` consumers ignore unknown keys through `parseDb`). There is no
destructive DDL and no data is dropped, so a code-only revert is a complete rollback. The one
irreversible act is the *removal* of `deleteWalletTransactionsByUserId`; on revert the ledger simply
retains rows it would previously have deleted, which is the safe direction.

`applyCreditMovement` is the single toggle point: reverting that one file plus `queries.ts` restores
the previous behaviour wholesale.

## Deferred — needs a product decision

**ECO-07 — an offer below the asking price can never be accepted.**

Today a buyer may offer any amount in `0..price` (`server/api/src/models/listings.ts:314-316`), but
`acceptOffer` computes `newBuyerLocked = price - tradingListingsTotalPrice` and rejects with
`TOTAL_PRICE_EXCEEDED` when `newBuyerLocked > offeredCredits`
(`server/api/src/models/listings.ts:605-606`). With no trade listings, `newBuyerLocked === price`, so
any offer strictly below the asking price is un-acceptable. The buyer's credits stay locked until
someone rejects or retracts. The rule is real, undocumented, and surfaces only as a Spanish error
string at accept time — after the buyer has already waited.

Two coherent resolutions, both out of scope here:

- **Option A — fixed price.** Reject `offeredCredits < price` at *offer* time with a clear error, so
  the impossible state can never be entered. Smallest change; removes the haggling affordance the
  client's amount input implies.
- **Option B — the seller may accept a discount.** Drop the `TOTAL_PRICE_EXCEEDED` guard for the
  no-trade case and settle at `offeredCredits`. Preserves haggling; changes what "price" means and
  needs client copy to match.

**This change leaves the behaviour exactly as it is.** The specs below describe the current rule as
an invariant to preserve so that the rewrite does not silently pick a side.

## Dependencies

- Branch `fix/auditoria-2026-09` (current).
- `db-integrity-migrations` is planned in parallel and owns `CHECK (credits_balance >= 0)`,
  `CHECK (credits_locked >= 0)` and ECO-09. Its artifact directory does not exist yet. This block
  assumes those constraints **will** exist and is designed to never trip them. Migration numbering
  must be coordinated: this block claims `0009`; if the other block lands first, renumber before
  applying (the runner sorts lexicographically and checksums by basename —
  `server/api/src/scripts/migrate.ts`).
- Test command for the concurrency proof requires the dockerised Postgres from
  `docker-compose.dev.yml` (the e2e stack publishes no ports).

## Success Criteria

- [ ] Two simultaneous offers on the same listing: exactly one succeeds, the other gets 409, and the
      losing buyer's `credits_locked` is 0.
- [ ] Two simultaneous donations of the full balance: exactly one succeeds, the final balance is 0
      and never negative.
- [ ] For every user, `credits_balance == Σ balance_delta` and `credits_locked == Σ locked_delta`
      over `wallet_transactions`; `npm run reconcile-credits` reports zero discrepancies.
- [ ] `rg "updateUserBalance" server/api/src` returns nothing.
- [ ] `POST /listings/:listingId/cancel` exists, is reachable from the client, and returns both
      sides' credits; no `accepted` loop can strand credits.
- [ ] Deleting a user with an outstanding offer against them returns the buyer's locked credits and
      leaves the buyer's ledger self-consistent.
- [ ] `acceptOffer` writes one `listing_trades` row per traded listing.
- [ ] `npm run check-sql` and `npm run check-types` pass from `server/api/`.
- [ ] Playwright `e2e/` passes.
- [ ] ECO-07 behaviour is byte-for-byte unchanged.
