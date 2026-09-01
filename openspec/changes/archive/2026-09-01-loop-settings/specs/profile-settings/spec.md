# Profile Settings Specification

## Purpose

Defines the settings area reachable from `/profile`: its entry point and visibility rules, the
structure of its grouped list, the relocated account-and-session actions and their confirmation
gate, and the support-mail entries. Frontend only — no requirement here persists state to the
account or introduces an API call that does not already exist.

All user-facing copy in this specification is Spanish because the application is Spanish-only.

## ADDED Requirements

### Requirement: Settings Entry Point

`/profile` MUST expose a gear control in its header row that navigates to the settings screen. The
gear MUST render only when the profile belongs to the signed-in user. Viewing another person's
profile at `/user/[userId]` MUST NOT show it.

The settings screen MUST be an application route, not an overlay, so that the platform back
gesture, the web browser's back button, and deep links all work without special handling.

#### Scenario: Gear visible on the user's own profile

- GIVEN a signed-in user on `/profile`
- WHEN the profile header row renders
- THEN a gear control is present in that row
- AND activating it navigates to the settings route

#### Scenario: Gear absent on another user's profile

- GIVEN a signed-in user viewing `/user/[userId]` for a different person
- WHEN the profile header row renders
- THEN no gear control is present
- AND the existing "Denunciar" control still renders as it did before this change

#### Scenario: Back returns to the profile

- GIVEN a user on the settings screen reached from `/profile`
- WHEN the user goes back, by gesture, back control, or browser back
- THEN the profile screen is shown again with no intermediate screen

### Requirement: Settings Excluded from Primary Navigation

Settings MUST NOT appear in the bottom tab bar or in the desktop header navigation. The five
primary tabs MUST remain exactly as they are: `home`, `myListings`, `publish`, `wishlist`,
`profile`, in that order.

#### Scenario: Tab bar unchanged

- GIVEN any viewport width
- WHEN the bottom tab bar renders
- THEN it shows exactly the five existing primary tabs and no settings entry

#### Scenario: Desktop header nav unchanged

- GIVEN a viewport at or above 1024px
- WHEN the desktop header navigation renders
- THEN it shows exactly the five existing primary tabs and no settings entry

### Requirement: Grouped Settings List

The settings screen MUST render its entries as titled groups of rows, driven by a single
declarative table rather than by hand-written markup per row. Adding a future group MUST be
possible by appending to that table plus handling its action kind, without restructuring the
screen.

Every row MUST carry a non-empty Spanish label. Row keys MUST be unique within the whole table and
group keys MUST be unique. Rows whose action is irreversible MUST be visually distinguished from
ordinary rows.

This change MUST ship exactly two groups: account and session, and contact.

#### Scenario: Two groups render

- GIVEN a signed-in user on the settings screen
- WHEN the list renders
- THEN a group of account and session actions and a group of contact actions are shown, each under
  its own Spanish title

#### Scenario: Destructive row is distinguished

- GIVEN the settings list is rendered
- WHEN the account deletion row renders
- THEN it is visually marked as destructive, distinctly from non-destructive rows

### Requirement: Relocated Session and Account Actions

"Cerrar sesión" and "Eliminar cuenta" MUST be reachable only from the settings screen. Both MUST be
removed from the profile screen: the pinned bottom logout bar and the in-list delete section MUST
no longer exist there.

Logging out MUST have the same effect it has today. Because the authenticated route subtree is
mounted behind a session guard, ending the session MUST unmount the settings screen without
requiring explicit navigation away from it.

#### Scenario: Profile no longer carries the controls

- GIVEN a signed-in user on `/profile`
- WHEN the screen renders
- THEN neither a logout control nor a delete-account control appears anywhere on it

#### Scenario: Logout from settings

- GIVEN a signed-in user on the settings screen
- WHEN the user activates "Cerrar sesión"
- THEN the session ends and the user lands in the unauthenticated area, with no stale settings
  screen left mounted

### Requirement: Account Deletion Confirmation Gate

Account deletion MUST remain gated behind typing the account's own email address. The confirmation
MUST state that the action is permanent and irreversible and MUST enumerate what is removed.

The destructive button MUST stay disabled while the typed text is not an exact match for the
account email, and MUST also stay disabled while a deletion request is in flight. Relocating this
flow MUST NOT relax the match: a case-differing, whitespace-padded, empty, or otherwise
non-identical entry MUST NOT enable the button.

Dismissing the confirmation MUST clear the typed text so a later reopen starts empty.

#### Scenario: Exact match enables deletion

- GIVEN the deletion confirmation is open for an account whose email is `alguien@colegio.edu`
- WHEN the user types exactly `alguien@colegio.edu`
- THEN the destructive button becomes enabled

#### Scenario: Near-miss keeps deletion disabled

- GIVEN the deletion confirmation is open for an account whose email is `alguien@colegio.edu`
- WHEN the user types an empty string, a different address, a differently-cased variant, or the
  same address with surrounding whitespace
- THEN the destructive button remains disabled

#### Scenario: In-flight deletion cannot be re-submitted

- GIVEN a matching email has been typed and deletion has been requested
- WHEN the request is still in flight
- THEN the destructive button is disabled and reports progress

#### Scenario: Dismissal clears the field

- GIVEN text has been typed into the confirmation field
- WHEN the confirmation is dismissed and reopened
- THEN the field is empty and the destructive button is disabled

#### Scenario: Deletion failure is surfaced

- GIVEN a deletion request that the server rejects
- WHEN the error returns
- THEN the confirmation stays open and shows the error message

### Requirement: Support Mail Entries

The contact group MUST offer three entries: report a bug, send a suggestion, and contact the team.
Each MUST open the user's mail composer addressed to `loop@reditinere.com`, with a Spanish subject
identifying which entry was used and a Spanish prefilled body.

Each body MUST include a diagnostic block carrying the application version, the platform, and the
route the user was on. Each body MUST leave an explicit blank area for the user to write in.

A body MUST NOT contain an authentication token, an authorization header, a session identifier, or
the user's own email address. The recipient address is the only address a body may contain.

#### Scenario: Bug report composer

- GIVEN a user on the settings screen
- WHEN the user activates the bug-report entry
- THEN a mail composer opens addressed to `loop@reditinere.com`, with a subject identifying it as a
  bug report and a body containing the diagnostic block and prompts for what happened

#### Scenario: Suggestion composer

- GIVEN a user on the settings screen
- WHEN the user activates the suggestion entry
- THEN a mail composer opens addressed to `loop@reditinere.com` with a suggestion subject and a
  body containing the diagnostic block

#### Scenario: Contact composer

- GIVEN a user on the settings screen
- WHEN the user activates the contact entry
- THEN a mail composer opens addressed to `loop@reditinere.com` with a general enquiry subject and
  a body containing the diagnostic block

#### Scenario: No credential leaks into a body

- GIVEN any of the three entries
- WHEN its body is built
- THEN the body contains no token, no authorization header, no session identifier, and no email
  address other than the recipient

### Requirement: Mail Composer Fallback

When the mail composer cannot be opened, the user MUST NOT be left with a silent failure. The
application MUST tell the user which address to write to and MUST offer a way to recover the full
message text, so the prefilled subject and body are not lost.

#### Scenario: Composer unavailable

- GIVEN a device with no usable mail application
- WHEN the user activates a contact entry
- THEN the application reports that the composer could not be opened, names
  `loop@reditinere.com`, and offers the full message text for manual copying or sharing

#### Scenario: Existing report flow keeps its fallback

- GIVEN the abuse-report control on another user's profile or on a listing
- WHEN its composer cannot be opened
- THEN it offers the same recovery affordances it offered before this change, with the report body
  preserved in full
