# Client Cross-Platform Feedback Specification

## Purpose

Defines the requirement that user-visible feedback works on every target the client ships to, and
covers two places where the client currently renders nothing or renders an invalid value. Covers the
alert portion of audit finding CLI-09 and the progress-bar portion of CLI-13.

## Requirements

### Requirement: Alerts Are Visible On Every Platform

Any code path that informs the user of a failure MUST produce visible feedback on native **and** on
web. The client MUST NOT rely on a mechanism that is a silent no-op on React Native Web.

A single shared entry point MUST be used, so a future call site cannot reintroduce the defect by
choosing the wrong mechanism.

#### Scenario: A missing report address is reported on web

- GIVEN the web app with no report address configured
- WHEN the user presses the report action
- THEN a visible message explains that reporting is unavailable

#### Scenario: A failed mail composer is reported on web

- GIVEN the web app where the mail composer cannot be opened
- WHEN the user triggers an action that would open it
- THEN a visible message appears and the user is given a way to copy the address or the message text

#### Scenario: The allowed-domains contact path is reported on web

- GIVEN the web app where the mail composer cannot be opened from the allowed-domains notice
- WHEN the user presses the contact action
- THEN a visible message appears and the contact address is available to copy

#### Scenario: Native behaviour is unchanged

- GIVEN a native build
- WHEN any of the three paths above is triggered
- THEN the same native dialog appears as before this change, with the same title, message and actions

#### Scenario: Existing Spanish copy is preserved verbatim

- GIVEN the three affected call sites
- WHEN their user-facing strings are compared against the pre-change source
- THEN every string is unchanged, and this change introduces no new user-facing copy

### Requirement: Progress Values Are Always Valid

A rendered progress value MUST be a valid percentage. The client MUST NOT emit a width derived from
a division by zero, and MUST clamp the result to the range 0 to 100.

The computation MUST be a pure function, so it can be verified without rendering.

#### Scenario: A mission with no total renders an empty bar

- GIVEN a mission whose total is zero
- WHEN its progress bar renders
- THEN the filled width is zero percent, and no invalid value is emitted

#### Scenario: A mission beyond its total is clamped

- GIVEN a mission whose current value exceeds its total
- WHEN its progress bar renders
- THEN the filled width is one hundred percent

#### Scenario: A normal mission renders proportionally

- GIVEN a mission at three of four
- WHEN its progress bar renders
- THEN the filled width is seventy-five percent

#### Scenario: A malformed mission does not corrupt the notifications list

- GIVEN a mission notification whose payload carries a zero total
- WHEN the notifications list renders
- THEN the card renders with an empty progress bar and the surrounding list is unaffected
