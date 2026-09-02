# Account Deletion Integrity Specification

## Purpose

Defines what deleting a user MUST do to third parties' escrowed credits and to the audit trail.
Covers ECO-06 and the ledger-durability half of ECO-02.

## Requirements

### Requirement: Third-Party Credits Are Released

Deleting a user MUST NOT strand another user's credits. Before any of the departing user's rows are
removed, every open loop they are party to — whether as seller or as buyer — MUST be unwound using
the same rules as cancellation, releasing the surviving counterparty's escrowed credits back to their
spendable balance and recording the movement in the ledger.

#### Scenario: A pending offer against the departing user is refunded

- GIVEN a buyer who has escrowed 50 credits on a listing sold by a user who then deletes their account
- WHEN the deletion completes
- THEN the buyer's `credits_locked` for that loop is 0 and their spendable balance has regained 50

#### Scenario: A loop the departing user was buying releases the seller

- GIVEN an accepted loop where the seller escrowed 10 credits and the buyer deletes their account
- WHEN the deletion completes
- THEN the seller's escrowed 10 credits are returned to their spendable balance

#### Scenario: A settled loop is not reopened

- GIVEN a listing in `received` bought by the departing user
- WHEN the deletion completes
- THEN that listing is not returned to `published` and no credits move

#### Scenario: Release is recorded

- GIVEN any counterparty release performed during deletion
- WHEN the deletion completes
- THEN a ledger row exists for the surviving user describing the release

### Requirement: The Ledger Survives Deletion

Deleting a user MUST NOT delete their `wallet_transactions` rows. The rows MUST be retained with the
user reference cleared, so that community-level history and reconciliation remain auditable. Retained
rows MUST keep their community association so tenant isolation still applies to them.

#### Scenario: History is anonymised, not destroyed

- GIVEN a user with ten ledger rows
- WHEN their account is deleted
- THEN ten rows still exist, each with a null user reference and an unchanged community

#### Scenario: The counterparty's own records are untouched

- GIVEN a loop between two users where one deletes their account
- WHEN the deletion completes
- THEN the surviving user's ledger rows for that loop are unchanged and still reconcile

#### Scenario: Reconciliation ignores orphaned rows

- GIVEN retained rows with no user reference
- WHEN reconciliation runs
- THEN no user is reported as discrepant on account of them, and they are reported separately

### Requirement: Deletion Is One Transaction

The entire deletion — releasing counterparty credits, writing ledger entries, removing the user's
rows, and resolving any administrative deletion request — MUST occur in a single transaction. A
failure at any point MUST leave the user present, the request unresolved, and every balance
untouched.

#### Scenario: A failed deletion does not mark the request resolved

- GIVEN an administrator resolving a deletion request where the deletion then fails
- WHEN the operation returns
- THEN the request is not marked completed and the user still exists

#### Scenario: A failed deletion releases no credits

- GIVEN a deletion that fails after some counterparty releases were computed
- WHEN the transaction rolls back
- THEN no counterparty balance has changed
