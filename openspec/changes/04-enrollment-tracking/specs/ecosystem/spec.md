## ADDED Requirements

### Requirement: Enrollment applications and tracking
The system SHALL satisfy the user requirement: "No asumas que enviar una solicitud significa estar admitido, haber pagado o encontrarse matriculado."

#### Scenario: Authorized functional increment
- **WHEN** this increment is implemented using isolated local test data
- **THEN** Students submit only for open cohorts, see their own applications and next steps; duplicates and unauthorized reads are rejected.
