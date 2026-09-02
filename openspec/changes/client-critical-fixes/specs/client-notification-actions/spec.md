# Client Notification Actions Specification

## Purpose

Defines what happens when a user taps a push notification or a notification card, and what the
client must do when the push payload does not carry a routing identifier. Covers audit finding
CLI-05 and the push-error part of CLI-13.

Out of scope: the server-side push payload itself. The client cannot deep-link to a specific listing
or chat until the server includes routing identifiers in the push (see "Degradation" below); that
server change belongs to another block.

## Requirements

### Requirement: Notification Cards Are Actionable

A notification card MUST be pressable when its payload identifies a destination, and MUST navigate
to that destination when pressed. A card whose payload identifies no destination MUST NOT be
pressable, so the user is never given an affordance that does nothing.

Destination resolution MUST be a pure function of the notification, so it can be verified without
rendering.

#### Scenario: A loop notification opens its listing

- GIVEN a notification of type `loop` whose payload carries a listing identifier
- WHEN the user taps its card
- THEN the listing detail screen for that identifier opens

#### Scenario: A donation notification opens the donor's profile

- GIVEN a notification of type `donation` whose payload carries a donor identifier
- WHEN the user taps its card
- THEN the public profile for that donor opens

#### Scenario: A mission notification is not pressable

- GIVEN a notification of type `mission`, for which no detail route exists
- WHEN its card renders
- THEN it presents no press affordance and tapping it does nothing

#### Scenario: A card with a missing identifier is not pressable

- GIVEN a notification whose payload is missing the identifier its type would normally carry
- WHEN its card renders
- THEN it presents no press affordance, and no navigation is attempted

### Requirement: Push Taps Navigate

Tapping a push notification MUST navigate the user somewhere relevant. The client MUST NOT respond
to a notification tap by logging only.

#### Scenario: Tapping a push no longer only logs

- GIVEN the app is running and a push notification is tapped
- WHEN the tap is handled
- THEN a navigation occurs and nothing is written to the console as the sole response

#### Scenario: A message push opens the conversations

- GIVEN a push notification whose category identifies it as a message
- WHEN the user taps it
- THEN the conversations screen opens

#### Scenario: A content push opens the notifications screen

- GIVEN a push notification of any non-message category, carrying no routing identifier
- WHEN the user taps it
- THEN the notifications screen opens

### Requirement: Push Routing Degrades On A Payload Without Identifiers

The client MUST route to a specific listing or conversation when the push payload carries the
corresponding identifier, and MUST fall back to the category's screen when it does not. Absence of
an identifier MUST NOT produce a navigation error or a blank screen.

This requirement is forward-compatible by design: the current server push carries no routing data,
so only the fallback branches can fire today.

#### Scenario: A push carrying a listing identifier deep-links

- GIVEN a push notification whose data carries a listing identifier
- WHEN the user taps it
- THEN the listing detail screen for that identifier opens

#### Scenario: A push carrying a user identifier opens that conversation

- GIVEN a push notification whose data carries a user identifier
- WHEN the user taps it
- THEN the conversation with that user opens

#### Scenario: A push with no data does not error

- GIVEN a push notification whose payload contains no data field at all, as the server sends today
- WHEN the user taps it
- THEN the category fallback screen opens and no navigation error is raised

### Requirement: Push Registration Errors Are Legible

An error raised while obtaining a push token MUST carry a readable message and MUST preserve the
originating error. It MUST NOT render the underlying error as `"[object Object]"`.

#### Scenario: A token failure produces a readable message

- GIVEN push token retrieval fails with a non-string throwable
- WHEN the resulting error message is read
- THEN it describes the failure and does not contain `"[object Object]"`

#### Scenario: The original error is preserved

- GIVEN push token retrieval fails
- WHEN the resulting error is inspected
- THEN the originating error is reachable from it rather than discarded
