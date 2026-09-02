# Database Integrity Constraints Specification

## Purpose

Defines two storage-level invariants that hold regardless of application code: credit balances are
never negative, and deleting a listing that is attached to a message succeeds. Covers the database
half of audit item **ECO-01** and audit item **ECO-09**.

Explicitly out of scope: how any credit amount is computed, whether updates are relative or
absolute, row locking, ledger writes, `balance_after` maintenance, and reconciliation. Those belong
to `credit-economy-integrity`. This capability specifies only what the database refuses to store.

## Requirements

### Requirement: Credit Balances Are Non-Negative

The `users` table MUST carry two separately named `CHECK` constraints, one asserting
`credits_balance >= 0` and one asserting `credits_locked >= 0`. They MUST be validated against
existing data at creation time; a `NOT VALID` constraint MUST NOT be used.

#### Scenario: A negative balance is rejected at the storage layer

- GIVEN any connection, including the table owner
- WHEN `UPDATE users SET credits_balance = -1` is executed
- THEN the database rejects it with SQLSTATE `23514` naming
  `users_credits_balance_non_negative`

#### Scenario: A negative locked amount is rejected and named distinctly

- GIVEN any connection
- WHEN `UPDATE users SET credits_locked = -5` is executed
- THEN the database rejects it with SQLSTATE `23514` naming `users_credits_locked_non_negative`,
  so the failing column is identifiable from the error alone

#### Scenario: Zero is a legal balance

- GIVEN a user whose `credits_balance` is `3`
- WHEN their balance is set to `0`
- THEN the update succeeds

### Requirement: Pre-Existing Negative Balances Are Clamped And Recorded

Before the constraints are added, the migration MUST clamp every negative `credits_balance` and
`credits_locked` to `0`, and MUST write one `wallet_transactions` row per affected user recording
the correction. That row MUST use the existing `admin` transaction type, MUST carry the post-clamp
value in `balance_after`, and MUST carry a `meta` field identifying the migration as the reason.
The migration MUST NOT invent a corrective `amount`.

#### Scenario: A corrupt balance is corrected with an audit trail

- GIVEN a user with `credits_balance = -40`
- WHEN the migration runs
- THEN their `credits_balance` is `0`, and a `wallet_transactions` row exists for them with
  `type = 'admin'`, `balance_after = 0`, and a `meta` reason naming the migration

#### Scenario: Healthy rows are untouched

- GIVEN every user has a non-negative balance and locked amount
- WHEN the migration runs
- THEN zero `users` rows are updated and zero `wallet_transactions` rows are inserted

### Requirement: Deleting An Attached Listing Detaches The Message

The composite foreign key from `messages` to `listings` MUST specify `ON DELETE SET NULL` scoped to
the `attached_listing_id` column only. Deleting a listing MUST succeed even when messages reference
it, and MUST leave every referencing message row intact apart from its now-null attachment.

#### Scenario: Listing attached to a message can be deleted

- GIVEN a published listing owned by a user, and a message whose `attached_listing_id` references it
- WHEN the owner calls `DELETE /listings/:id`
- THEN the request succeeds, the listing row is gone, and the message still exists with
  `attached_listing_id` set to `NULL`

#### Scenario: The tenant discriminator is never nulled

- GIVEN a message whose `attached_listing_id` is nulled by the cascade
- WHEN the message row is read afterwards
- THEN its `community_id` is unchanged and still `NOT NULL`, so row-level security continues to
  scope it to the same community

#### Scenario: Existing rows remain valid

- GIVEN messages that already reference listings
- WHEN the constraint is dropped and recreated with the new action
- THEN no existing row is modified or rejected, because the constraint is only loosened
