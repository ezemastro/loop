# Credit Ledger Specification

## Purpose

Defines how credits move between the spendable (`credits_balance`) and escrowed (`credits_locked`)
buckets, and the audit record every movement MUST leave. Covers ECO-01, ECO-02 and ECO-10.

## Requirements

### Requirement: Atomic Balance Mutation

Every mutation of `users.credits_balance` or `users.credits_locked` MUST be expressed as a single
relative SQL statement of the form `SET credits_balance = credits_balance + $delta`. Reading a
balance into application memory, computing a new absolute value, and writing it back MUST NOT occur.

The statement MUST carry guard predicates rejecting any movement that would drive either bucket below
zero, and MUST use `RETURNING` to report the resulting balances. Zero affected rows MUST be treated as
a domain error and MUST NOT be silently ignored.

The application MUST fail with a typed domain error before any database `CHECK` constraint on the
credit columns can be violated.

#### Scenario: Concurrent offers cannot destroy credits

- GIVEN a user with `credits_balance = 100` and `credits_locked = 0`
- WHEN two requests each lock 100 credits at the same time
- THEN exactly one succeeds, the other receives a 400 `INSUFFICIENT_CREDITS`, and the user ends with
  `credits_balance = 0` and `credits_locked = 100`

#### Scenario: Concurrent donations cannot overdraw

- GIVEN a user with `credits_balance = 100`
- WHEN the user issues two simultaneous donations of 100 credits each
- THEN exactly one succeeds, the balance is `0`, and the balance is never negative at any point

#### Scenario: Guard fires before the database constraint

- GIVEN a user with `credits_balance = 10`
- WHEN a movement of `-50` is attempted
- THEN the response is a 400 domain error and no `CHECK` constraint violation is raised

#### Scenario: Only the intended bucket changes

- GIVEN a buyer settling a received listing, where only `credits_locked` should decrease
- WHEN the movement is applied
- THEN `credits_balance` is not written at all, and a concurrent change to that column is preserved

### Requirement: Single Mutation Choke Point

All credit movements MUST pass through one shared helper. No model, controller, or utility outside
that helper MAY issue SQL touching `users.credits_balance`, `users.credits_locked`, or
`wallet_transactions`. The previous absolute-value query MUST be removed from the codebase so the
type checker rejects any missed call site.

#### Scenario: No orphan balance writer remains

- GIVEN the change is applied
- WHEN the source tree is searched for the removed absolute-value query
- THEN there are zero matches, and `npm run check-types` passes

### Requirement: Deadlock-Free Lock Ordering

Within a single transaction, row locks MUST be acquired in a documented, deterministic order:
listings before users; listings among themselves in ascending id order; users in ascending id order.
The ordering MUST be enforced structurally by the shared helper sorting its batch, and MUST NOT rely
on callers passing arguments in a particular order.

Statements against the same connection MUST NOT be dispatched concurrently, because their execution
order would then be nondeterministic.

#### Scenario: Opposite-direction transactions do not deadlock

- GIVEN user A accepting an offer from user B, and user B simultaneously donating to user A
- WHEN both transactions run
- THEN both complete without a deadlock error, in some order

#### Scenario: Argument order does not change statement order

- GIVEN two callers passing the same two movements as `[seller, buyer]` and `[buyer, seller]`
- WHEN each batch is applied
- THEN both emit their `UPDATE` statements in the same ascending-user-id order

### Requirement: Ledger Entry On Every Movement

Every credit movement MUST write exactly one `wallet_transactions` row inside the same transaction as
the balance change. Loop, mission, and donation movements MUST be recorded, not only admin ones.

Each row MUST carry a signed `balance_delta`, a signed `locked_delta`, the resulting `balance_after`
and `locked_after`, one `reason` from the change's defined set, and a `reference_id` identifying the
listing, mission, or counterparty. A movement whose two deltas are both zero MUST NOT be recorded and
MUST be rejected as a caller error.

#### Scenario: Locking credits for an offer is recorded

- GIVEN a buyer offering 50 credits on a listing
- WHEN the offer succeeds
- THEN one row exists with `reason = 'offer_lock'`, `balance_delta = -50`, `locked_delta = +50`, and
  `balance_after`/`locked_after` matching the user row

#### Scenario: A mission reward is recorded

- GIVEN a user completing a mission worth 10 credits
- WHEN the reward is granted
- THEN one row exists with `reason = 'mission_reward'`, `balance_delta = +10`, `locked_delta = 0`

#### Scenario: A donation records both sides

- GIVEN user A donating 20 credits to user B
- WHEN the donation succeeds
- THEN exactly two rows exist: `donation_sent` for A and `donation_received` for B

#### Scenario: Rolling back leaves no ledger row

- GIVEN a transaction that applies a movement and then fails
- WHEN the transaction rolls back
- THEN neither the balance change nor its ledger row is persisted

### Requirement: Locked-Bucket Semantics

`balance_after` MUST mean the spendable balance after the movement, and MUST NOT mean net worth. The
escrowed bucket MUST be recorded separately as `locked_after`. A consumer displaying credit state
MUST use both values, or their sum, and MUST NOT present `balance_after` alone as the user's credits.

#### Scenario: Escrow is not reported as a loss

- GIVEN a user with 100 credits who offers 40 on a listing
- WHEN the resulting ledger row is read
- THEN `balance_after` is 60, `locked_after` is 40, and their sum equals the unchanged net worth of 100

### Requirement: Reconciliation Invariant

For every user, `credits_balance` MUST equal the sum of `balance_delta` and `credits_locked` MUST
equal the sum of `locked_delta` over that user's ledger rows. A reconciliation command MUST report
every violating user and MUST exit non-zero when any exists. It MUST be read-only and MUST NOT repair
discrepancies automatically.

Because balances predate the ledger, the migration MUST insert one opening-balance row per existing
user so the invariant holds from the first run.

#### Scenario: A freshly migrated database reconciles

- GIVEN a database with pre-existing balances and no ledger history
- WHEN the migration runs and reconciliation is executed
- THEN zero discrepancies are reported

#### Scenario: A full loop reconciles

- GIVEN a completed loop covering offer, accept, and receive
- WHEN reconciliation is executed
- THEN both parties reconcile exactly

#### Scenario: Drift is reported, not silently corrected

- GIVEN a user whose balance was altered outside the ledger
- WHEN reconciliation is executed
- THEN that user is listed, the command exits non-zero, and no balance is modified

### Requirement: Donation Limits

A donation MUST be a positive integer within a configured minimum and maximum, and the total a user
donates within one calendar day MUST NOT exceed a configured daily cap. Limits MUST be defined as
configuration constants. A donation to oneself MUST be rejected. Violations MUST return 400 and MUST
NOT alter any balance.

#### Scenario: A donation below the minimum is rejected

- GIVEN a configured minimum of 1 credit
- WHEN a user attempts to donate 0 credits
- THEN the request fails with 400 and no balance changes

#### Scenario: A non-integer donation is rejected before reaching the database

- GIVEN a user donating `2.5` credits
- WHEN the request is validated
- THEN it fails with 400, not a 500 from an integer column

#### Scenario: The daily cap is enforced from the ledger

- GIVEN a daily cap of 100 credits and a user who has already donated 90 today
- WHEN that user attempts to donate 20 more
- THEN the request fails with 400 and the balance is unchanged
