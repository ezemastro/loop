# Admin Safe Operations Specification

## Purpose

Defines the confirmation an irreversible admin action must carry, and the audit trail a credit
adjustment must leave. Covers the confirmation and credit-audit portions of ADM-08. The audit-trail
requirement is specified here in full but is deliberately split: the admin-facing half is implemented
by this change, and the ledger schema half is handed off to `credit-economy-integrity`, which owns
`wallet_transactions`.

## Requirements

### Requirement: Irreversible Actions Require Explicit Confirmation

Every destructive admin action MUST require a second, explicit confirmation before it executes. The
confirmation MUST reuse the pattern already established in the panel (`DeletionRequests.tsx:56`,
`:179`, `:196-210`): the danger control stages the target record rather than executing, and a
`ui/Modal` presents the consequence with the specific record identified in its description, a cancel
control, and a danger control guarded against double submission while the request is in flight.

The three actions that execute immediately today MUST be brought under this rule:

- revoke invitation (`Invitations.tsx:255-257` → `handleRevoke` at `:116`)
- remove community domain (`Communities.tsx:230-238` → `remove` at `:199`)
- reject deletion request (`DeletionRequests.tsx:174-177` → `resolve(request, "rejected")` at `:79`)

Confirmation dialogs MUST NOT use `window.confirm`; none exists in the panel and it cannot identify the
specific record. Confirmation copy MUST be Spanish, matching the surrounding panel copy.

The already-confirmed "Borrar cuenta" action (`DeletionRequests.tsx:179`) MUST retain its existing
confirmation unchanged.

(Unit 6 — ADM-08 confirmations)

#### Scenario: Revoking an invitation asks first

- GIVEN an operator viewing the invitations list
- WHEN they press "Revocar" on an invitation
- THEN no request is sent and a confirmation dialog appears naming that invitation's email
- AND the invitation is revoked only after the danger control in that dialog is pressed

#### Scenario: Cancelling leaves the record untouched

- GIVEN a confirmation dialog is open for any of the three actions
- WHEN the operator cancels or dismisses it
- THEN no request is sent and the record is unchanged

#### Scenario: Removing a domain names the consequence

- GIVEN a community whose last remaining registration domain is about to be removed
- WHEN the operator presses the remove control on that domain
- THEN the confirmation states that no one will be able to self-register into that community

#### Scenario: Rejecting a deletion request asks first

- GIVEN an operator viewing pending deletion requests
- WHEN they press "Rechazar"
- THEN a confirmation dialog appears naming the requester, and the request is resolved only after that
  dialog's danger control is pressed

#### Scenario: Double submission is prevented

- GIVEN a confirmation dialog whose action is in flight
- WHEN the operator presses the danger control again
- THEN no second request is sent

### Requirement: Credit Adjustments Carry a Mandatory Reason

An admin credit adjustment MUST NOT be submittable without a reason. The modify-credits screen MUST
present a required reason input, MUST reject an empty or whitespace-only value with a Spanish
validation message alongside the existing amount validation (`ModifyCreditsModal.tsx:40`), and MUST
transmit the reason with the adjustment.

The reason MUST be transmitted through the existing `meta` channel, which is already wired end to end
(`adminApi.ts:88-93` → `controllers/admin.ts:179` → `models/admin.ts:353-361`) and is `null` on every
adjustment today. This requirement is therefore satisfiable with no server change and no migration.

(Unit 5 — ADM-04 modals and reason)

#### Scenario: An adjustment without a reason is refused

- GIVEN an operator has entered a valid credit amount and no reason
- WHEN they submit
- THEN a Spanish validation message is shown and no request is sent

#### Scenario: A whitespace reason is refused

- GIVEN an operator has entered a reason consisting only of spaces
- WHEN they submit
- THEN the submission is refused exactly as for an empty reason

#### Scenario: The reason reaches the transaction record

- GIVEN an operator submits a valid amount with the reason "Ajuste por error de carga"
- WHEN the adjustment succeeds
- THEN the resulting `wallet_transactions` row carries that reason in its `meta` column instead of
  `NULL`

### Requirement: Credit Adjustments Are Attributable to an Admin

A credit adjustment MUST be attributable to the admin who performed it and MUST carry its reason as
first-class, queryable data rather than only inside a free-form `meta` document. `wallet_transactions`
today has neither an `admin_id` nor a `reason` column (`database_creation.sql:98-108`), so an
adjustment leaves no record of who made it.

**This requirement is NOT implemented by this change.** It is handed off to `credit-economy-integrity`,
which owns `wallet_transactions` and the ledger. Implementing it requires a migration adding the
columns, persisting `req.session.adminId` (available via `requireAdminId`, `controllers/admin.ts:21-25`)
through a modified INSERT (`services/queries.ts:855-859`) — ledger schema work by any definition.

Writing the reason into `meta` now MUST remain forward-compatible so a later migration can backfill a
`reason` column from `meta->>'reason'`.

Two adjacent defects found while verifying this requirement are recorded and handed off with it:
`balance_after` is written `NULL` on every admin adjustment because the column is absent from that
INSERT column list, making balance history unreconstructable; and `amount` receives no server-side
validation (`controllers/admin.ts:177-195` checks only that `userId` is present), which belongs to
`sec-hardening-api` as owner of the admin endpoint schemas.

(Hand-off — `credit-economy-integrity`; not implemented in this change)

#### Scenario: Attribution is queryable

- GIVEN the hand-off has been implemented by `credit-economy-integrity`
- WHEN an admin adjusts a user's credits
- THEN the resulting transaction row records the acting admin's id in a dedicated column

#### Scenario: This change does not modify the ledger

- GIVEN the completed `admin-panel-fixes` change
- WHEN `server/migrations/` and the wallet transaction INSERT are diffed against the base branch
- THEN no migration was added and the INSERT column list is unchanged
