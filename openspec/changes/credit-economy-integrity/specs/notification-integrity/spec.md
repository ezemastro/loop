# Notification Integrity Specification

## Purpose

Defines notification completeness and non-lossy read paths. Covers ECO-12.

## Requirements

### Requirement: Every Emitted Notification Has Text

Every notification type the server can emit MUST have title and body text defined. The mapping from
type to text MUST be exhaustive in a way the type checker enforces, so that adding a type without its
text fails the build rather than shipping an untitled push.

#### Scenario: A sold-listing notification has a title

- GIVEN a listing accepted as part of a barter trade
- WHEN its owner is notified
- THEN the notification has a non-empty title and body

#### Scenario: A missing text fails the build

- GIVEN a new notification type added without text
- WHEN the type check runs
- THEN it fails

### Requirement: Reads Do Not Silently Drop Rows

A read path MUST NOT silently discard a record because a related record is missing or out of scope. A
school without visible media MUST be returned with a null media reference rather than omitted. A
notification whose referenced listing, user, or mission is gone MUST still be returned, carrying
whatever it can from its own stored payload.

#### Scenario: A school with unreachable media is still listed

- GIVEN a school whose media row is not visible in the current scope
- WHEN the user's schools are read
- THEN the school is returned with a null media reference

#### Scenario: A notification outlives its listing

- GIVEN a notification referencing a deleted listing
- WHEN the user's notifications are read
- THEN the notification is returned rather than omitted

### Requirement: Pagination Counts Match Returned Rows

A paginated total MUST be consistent with the rows the endpoint actually returns. A page MUST NOT
report a total that counts records the same request then discards.

#### Scenario: The total reflects deliverable notifications

- GIVEN a page where some notifications reference missing records
- WHEN the page is read
- THEN the reported total is consistent with what the client can render, and paging forward does not
  produce empty pages
