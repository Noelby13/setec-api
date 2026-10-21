# Verifiable institutional documents

The additive `database/migrations/20261021_certificate_registry.sql` creates a one-to-one registry for existing graduation dossiers and its event history. It does not issue documents or migrate old dossiers automatically. Apply it explicitly to an authorized database; missing registry returns 503 before new issuance writes.

Issuance keeps the existing language/publication requirements, requires `EGRESADO`, and reads an existing local institutional PDF. The application does not define completion criteria, generate an official design or apply a digital signature. The immutable snapshot stores the holder's name, program, cohort, type, issue date, random public UUID and SHA-256 digest. Dossier issuance, enrollment status, registry and audit event share one transaction.

`TITULO_EMITIR` permits issuance and explicit registration of already-issued dossiers. Registration preserves the original document and issue date. `CERTIFICADO_REVOCAR` is separate, seeded only for `SUPER_ADMIN`, and requires a reason. Revocation cannot be undone through the API. Public verification shows only minimal academic identity and validity; it never exposes identification numbers, contact information or file paths.

Student downloads require ownership; certificate administrators use their explicit permissions. A revoked, missing or changed registered PDF cannot be downloaded through either the certificate endpoint or the previous private upload URL. Legacy code verification reports digital availability and never claims verified integrity without a registry record.

Run `npm run test:certificates:integration` for reproducible real PostgreSQL checks. The runner creates a unique temporary local container from the cached `postgres:16-alpine` image, uses a new test database and scratch upload directory, never reads project `.env`, and removes only its own resources. It tests migration idempotence, academic gates, owner access, minimal immutable snapshots, exact PDF bytes, tamper/static-path blocking, rollback on injected audit failure and concurrent issuance/revocation. Independent extensions also pin role/program filtering, degree revalidation and grade-audit role projection.

Observed: 15 certificate boundary tests, independent PostgreSQL verification and parent replay passed; the complete API suite has 69 passing tests. Native review assessment is unavailable, so no native approval or receipt is claimed.

Risk: items 1, 2, 3 and 4 (persisted registry, authorization, legacy verification and concurrent transitions).
