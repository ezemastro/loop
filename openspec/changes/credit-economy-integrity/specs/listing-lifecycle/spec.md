# Listing Lifecycle Specification

## Purpose

Defines the listing state machine, the concurrency guards that make each transition safe, the
persistence of barter trades, and cancellation. Covers ECO-03, ECO-04, ECO-05 and ECO-08.

## Requirements

### Requirement: Guarded State Transitions

Every transition MUST express its precondition as a SQL `WHERE` predicate on the row being updated,
not only as an in-memory check on a previously read copy. A transition whose predicate matches zero
rows MUST return 409 Conflict and MUST NOT alter any balance.

The permitted transitions are exactly: create to `published`; `published` to `offered`; `offered` to
`published` by buyer withdrawal or seller rejection; `offered` to `accepted`; `published` to
`accepted` for a listing traded in; `accepted` to `received`; `accepted` to `published` by
cancellation; and deletion from `published`. Any other transition MUST be refused.

#### Scenario: A second buyer cannot overwrite the first

- GIVEN a `published` listing and two buyers offering at the same time
- WHEN both requests execute
- THEN exactly one listing row moves to `offered`, the other buyer receives 409, and the losing
  buyer's `credits_locked` is 0

#### Scenario: Offering on a claimed listing is refused

- GIVEN a listing already in `offered` with a buyer
- WHEN another user offers on it
- THEN the response is 409 and no credits are locked

#### Scenario: A received listing is terminal

- GIVEN a listing in `received`
- WHEN any transition other than none is attempted on it
- THEN the request is refused and the listing stays `received`

#### Scenario: A seller cannot offer on their own listing

- GIVEN a user who owns a `published` listing
- WHEN that user offers on it
- THEN the request is refused and no credits are locked

### Requirement: Validated And Persisted Trades

When an offer is accepted with traded listings, each traded listing MUST be verified, in the same
guarded update that claims it, to be `published`, to have no buyer, and to be owned by the buyer of
the main listing. A traded listing failing any condition MUST cause the whole acceptance to fail with
409 and MUST leave every balance unchanged.

Each accepted trade MUST be persisted as a `listing_trades` row inside the same transaction, so that
cancellation can later identify which listings to return.

The traded-listing identifier list MUST be validated as an array of unique identifiers with a bounded
maximum length. Duplicate entries MUST be rejected rather than counted twice.

#### Scenario: A traded listing owned by a third party is refused

- GIVEN an acceptance naming a listing owned by neither party
- WHEN the acceptance is attempted
- THEN it fails and no listing changes state

#### Scenario: A traded listing already under offer is refused

- GIVEN an acceptance naming a listing that is already `offered`
- WHEN the acceptance is attempted
- THEN it fails with 409 and that listing keeps its existing buyer and status

#### Scenario: Accepted trades are recorded

- GIVEN an acceptance with two valid traded listings
- WHEN it succeeds
- THEN two `listing_trades` rows exist linking them to the main listing

#### Scenario: Duplicate traded identifiers are rejected

- GIVEN an acceptance naming the same listing twice
- WHEN the request is validated
- THEN it fails with 400 and its price is not counted twice

### Requirement: Cancellation Of An Accepted Loop

An accepted loop MUST be cancellable over HTTP by either the seller or the buyer, through a route
that exists and is reachable. Cancellation MUST return the listing to `published` with no buyer,
release the escrowed credits of both parties for that loop, return every traded listing to
`published` with no buyer, and delete the corresponding `listing_trades` rows — all in one
transaction.

Each party MUST receive back exactly what that loop escrowed from them. Cancellation MUST NOT charge
either party a penalty and MUST NOT credit either party funds they did not escrow.

Cancellation MUST be refused for a listing that is `published`, `offered`, or `received`, and MUST be
refused for any user who is neither the buyer nor the seller.

#### Scenario: The seller cancels an accepted loop

- GIVEN an accepted loop where the buyer escrowed 50 and the seller escrowed 10
- WHEN the seller cancels
- THEN the listing is `published` with no buyer, the buyer regains 50 spendable credits, the seller
  regains 10, and both parties' `credits_locked` for that loop is 0

#### Scenario: The buyer cancels an accepted loop

- GIVEN the same accepted loop
- WHEN the buyer cancels
- THEN the outcome is identical to the seller cancelling

#### Scenario: Traded listings return to the market

- GIVEN an accepted loop with two traded listings
- WHEN either party cancels
- THEN both traded listings are `published` with no buyer and the trade rows are gone

#### Scenario: A stranger cannot cancel

- GIVEN an accepted loop between two users
- WHEN a third user attempts to cancel it
- THEN the request is refused and nothing changes

#### Scenario: A settled loop cannot be cancelled

- GIVEN a listing in `received`
- WHEN either party attempts to cancel
- THEN the request is refused with 409

#### Scenario: The client can reach cancellation

- GIVEN a user viewing an accepted loop they are party to
- WHEN they press the Cancel control
- THEN a cancellation request is issued; the control MUST NOT be inert

### Requirement: Credit-Bearing Input Validation

Every request field that becomes a credit amount MUST be validated as a bounded, non-negative integer
before reaching the database. A non-integer, missing, or out-of-range amount MUST produce 400 and MUST
NOT produce a 500 from an integer column, and MUST NOT pass a guard by being absent.

#### Scenario: A missing offer amount is rejected

- GIVEN an offer request whose body omits the amount
- WHEN it is validated
- THEN it fails with 400 rather than being treated as a valid zero-cost offer

#### Scenario: A decimal offer amount is rejected

- GIVEN an offer of `10.5` credits
- WHEN it is validated
- THEN it fails with 400

### Requirement: Transactional Listing Creation With Category Bounds

Listing creation MUST run in a single transaction covering the listing row, its media links, and any
mission progress it triggers. The price MUST be validated against the category's configured minimum
and maximum where those are set, and every supplied media identifier MUST belong to the requesting
user. Violations MUST return 400 and MUST leave no partial listing and no granted credits.

#### Scenario: A price outside the category range is refused

- GIVEN a category with a maximum of 100 credits
- WHEN a user creates a listing priced at 150
- THEN the request fails with 400 and no listing row exists

#### Scenario: Another user's media cannot be attached

- GIVEN a media identifier uploaded by a different user
- WHEN a listing is created referencing it
- THEN the request fails and no listing row exists

#### Scenario: A failure grants no credits

- GIVEN listing creation that fails after mission progress would have been recorded
- WHEN the transaction rolls back
- THEN no mission reward is granted and no listing exists

### Requirement: Preserved Offer Pricing Rule

The existing rule that an offer must cover the listing's price after traded value — under which an
offer below the asking price with no trades cannot be accepted — MUST remain behaviourally unchanged
by this change. Resolving it is a product decision recorded as deferred.

#### Scenario: A below-price offer still cannot be accepted

- GIVEN a listing priced at 100 and an offer of 80 with no traded listings
- WHEN the seller attempts to accept
- THEN the acceptance is refused exactly as it is today, and the buyer's credits remain escrowed
