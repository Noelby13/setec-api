## ADDED Requirements

### Requirement: Controlled verifiable document registry
The system SHALL integrate issued institutional PDFs with unguessable public identifiers, stored document integrity and controlled validity states without inventing official layouts or academic issuance rules.

#### Scenario: Authorized issuance
- **WHEN** an authorized operator issues a document through the existing graduation rules using an existing institutional PDF
- **THEN** the issue and its linked verification metadata, SHA-256 hash and audit event SHALL commit atomically

#### Scenario: Existing issued document
- **WHEN** an authorized operator explicitly registers a legacy issued dossier with its existing PDF
- **THEN** the registry SHALL link it once without reissuing the academic document or changing its original issue date

#### Scenario: Public verification privacy
- **WHEN** a visitor provides a valid random public token
- **THEN** verification SHALL show only the issued recipient name, academic program/cohort, document type/date and validity
- **AND** it SHALL expose neither identity/contact data nor a private document URL

#### Scenario: Revocation
- **WHEN** an operator with explicit certificate revocation authority confirms a nonempty reason
- **THEN** the certificate SHALL become revoked atomically with an audit event and public verification SHALL reflect that state
- **AND** a duplicate or unauthorized revocation SHALL leave stored state unchanged

#### Scenario: Document manipulation
- **WHEN** a stored PDF does not match its recorded hash or no longer exists
- **THEN** verification and download SHALL refuse to claim its integrity

#### Scenario: Official design unavailable
- **WHEN** no institutional certificate template or signature service is supplied
- **THEN** the system SHALL use the existing authorized PDF and SHALL NOT generate a purported official design
