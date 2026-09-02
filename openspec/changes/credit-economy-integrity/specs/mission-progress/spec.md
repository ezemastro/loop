# Mission Progress Specification

## Purpose

Defines mission assignment and progression correctness. Covers ECO-11 and the mission half of ECO-01.

## Requirements

### Requirement: Completion Timestamp Records Completion

A mission's completion timestamp MUST be set once, when the mission first becomes complete, and MUST
NOT be rewritten by later progress updates or by updates that leave the mission incomplete.

#### Scenario: Partial progress leaves the timestamp unset

- GIVEN a mission requiring three steps with one step recorded
- WHEN progress advances to two steps
- THEN the completion timestamp remains unset

#### Scenario: The first completion is the recorded one

- GIVEN a mission that becomes complete
- WHEN any further progress update is attempted
- THEN the completion timestamp still shows the original completion moment

### Requirement: Only Active Templates Are Assigned

Mission assignment MUST consider only templates marked active. Registering a user, and fanning a new
template out to existing users, MUST NOT create rows for inactive templates.

#### Scenario: A new user gets no inactive missions

- GIVEN a catalogue containing one active and one inactive template
- WHEN a user registers
- THEN that user has exactly one mission

#### Scenario: Creating an inactive template assigns nothing

- GIVEN an administrator creating a template marked inactive
- WHEN creation completes
- THEN no user mission rows are created for it

### Requirement: Set-Based, Idempotent Fan-Out

Assigning a template to a population MUST be a single set-based statement that ignores users who
already have it, rather than a per-user read-then-write loop. Concurrent invocations MUST NOT create
duplicate assignments. The database MUST enforce that a user holds at most one row per template.

#### Scenario: Two administrators create no duplicates

- GIVEN two administrators triggering the same fan-out simultaneously
- WHEN both complete
- THEN each user holds exactly one row for that template

#### Scenario: Re-running the fan-out is a no-op

- GIVEN a template already assigned to every user
- WHEN the fan-out runs again
- THEN no new rows are created and no error is raised

#### Scenario: Template keys are unique

- GIVEN two administrators creating templates with the same key simultaneously
- WHEN both complete
- THEN exactly one succeeds and the other is refused

### Requirement: Missions Follow A Moved User

Moving a user to another community MUST leave that user with the active mission set of their new
community. Missions MUST NOT be removed without being reassigned.

#### Scenario: A moved user can still earn

- GIVEN a user moved to another community
- WHEN their missions are read
- THEN they hold the active templates, and progressing one grants its reward

### Requirement: A Mission Rewards Once

A mission reward MUST be granted at most once. The reward MUST be gated on a guarded update that
claims the incomplete mission, and MUST NOT be granted when that update claims no row. The reward and
the completion MUST be recorded in the same transaction, and the reward MUST leave a ledger entry.

#### Scenario: Concurrent progress grants one reward

- GIVEN a mission one step from completion
- WHEN two progress updates arrive simultaneously
- THEN the mission completes once, the reward is granted once, and exactly one ledger row exists

#### Scenario: A failed completion grants nothing

- GIVEN a mission completion whose transaction fails
- WHEN it rolls back
- THEN no credits are granted and the mission remains incomplete
