## ADDED Requirements

### Requirement: Enrollment applications and tracking
The system SHALL satisfy the user requirement: "No asumas que enviar una solicitud significa estar admitido, haber pagado o encontrarse matriculado."

#### Scenario: Authorized functional increment
- **WHEN** this increment is implemented using isolated local test data
- **THEN** Students submit only for open cohorts, see their own applications and next steps; duplicates and unauthorized reads are rejected.

### Requirement: Preserve valid transactional state transitions
Administrative decisions SHALL inspect locked current cohort/enrollment/receipt state, preserve completed academic records, respect recorded capacity and require own documentary approval before collection.

#### Scenario: Repeated or stale decisions
- **WHEN** concurrent requests approve the same application or decide the same pending receipt
- **THEN** only one transition succeeds and capacity or receipt status changes once

#### Scenario: Protected academic states
- **WHEN** an operator observes an active/completed application or attempts to reactivate a withdrawn/completed record through a payment
- **THEN** the request fails without changing academic or payment data

#### Scenario: Existing valid workflow
- **WHEN** a documentary-review application is observed, corrected, approved and its enabled receipt accepted
- **THEN** existing reservation/quorum and matriculation behavior remains intact

#### Scenario: Institutional decision still pending
- **WHEN** a request awaits the speaker committee or waiting-list promotion
- **THEN** documentary validation does not substitute the undefined institutional decision
