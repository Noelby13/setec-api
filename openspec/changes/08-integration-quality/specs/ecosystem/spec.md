## ADDED Requirements

### Requirement: Cross-project verification and execution guide
The system SHALL satisfy the user requirement: "Utiliza datos de prueba aislados. Nunca ejecutes cobros reales para probar el sistema."

#### Scenario: Authorized functional increment
- **WHEN** this increment is implemented using isolated local test data
- **THEN** Contract copies are checked automatically; local unit/build/isolated HTTP and frontend flow results and remaining integration gaps are documented honestly.
