## ADDED Requirements

### Requirement: Student identity and controlled user management
The system SHALL satisfy the user requirement: "El registro público nunca debe permitir asignar privilegios administrativos."

#### Scenario: Authorized functional increment
- **WHEN** this increment is implemented using isolated local test data
- **THEN** Student registration cannot assign roles; authenticated reads and administrative operations enforce account activity, permissions and ownership.
