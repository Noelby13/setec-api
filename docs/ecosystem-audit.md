# Academic ecosystem audit — 2026-10-21

Both existing repositories were inspected before implementation. API baseline: `6678f3d`; backoffice baseline: `91cbb79`. Each remains an independent repository. The new portal lives in sibling `setecportal`.

| Capability | Existing evidence | Increment |
| --- | --- | --- |
| Identity | JWT login/refresh/logout; users, roles, permissions and sessions | Public student registration, safe user management, live account/session authorization |
| Programs/cohorts | Published active catalog, curriculum, cohort schedules and real enum states | New public catalog and cohort selection; only open cohorts admit applications |
| Applications/payments | Applicant account link, unique applicant/cohort, documentary review, quorum, payment review and enrollment | Ownership enforcement, contextual student flow, cashier discovery without admissions access |
| Academic history | Grades, component enrollment and graduation dossiers | Own course/history views; no fabricated progress, attendance or grades |
| Certification | Academic requirements and controlled issuance of uploaded institutional documents; public code lookup | Safe student consultation and minimal public verification; official PDF template and revocation policy remain unestablished |
| Administration | Existing program/cohort/admission/cashier/grade/graduation modules | User management and permission-scoped dashboards |
| Contracts | Identical Markdown and TypeScript copies in both original repositories | API is canonical; automate synchronization checks for all three apps |

The original backend has no automated test command. Frontend has Vitest and Playwright; prior recorded mocked HTTP results do not prove live PostgreSQL integration. No configured database or live personal/financial records were accessed for this audit. `openspec` 1.11.0 is available; `gentle-ai` and Engram tools are unavailable. Their proof/mirror remains unavailable, never assumed successful.

## Business evidence gaps

- Official certificate PDF layout, signing procedure and revocation authority/policy are not defined in the inspected material. Do not fabricate issuance rules or official documents.
- Account recovery requires a configured delivery service; do not present a nonfunctional recovery form as successful.
- Existing SQL/initial-schema inconsistencies in grades and graduation need isolated database validation before claiming those flows live.
- The existing cashier seed grants admission validation. New seed defaults and an explicit optional data migration must separate these permissions without silently changing a real database.

Implementation specification: `odd/tasks/uncsm-ecosystem.md`. OpenSpec changes are under `openspec/changes/01-*` through `08-*` and retain verifiable acceptance scenarios.

## Implemented follow-up

The table and gaps above describe the inspected baseline. The implementation now includes a linked certificate registry with immutable snapshots, PDF hashes, separate revocation permission and audit events. Existing official PDFs remain institutional inputs; no official design or academic completion rule was invented. The observed grade, grade-audit, applicant-interest and public-verification SQL mismatches were corrected and exercised against disposable PostgreSQL. Cashier discovery and seed defaults were separated from admissions, with an optional reviewed migration for an existing database.

Final deterministic checks passed: API 101, backoffice 153 and portal 45 tests, all three production builds, 11 fixture browser scenarios and 8 strict OpenSpec changes. Independent PostgreSQL checks and the parent's retained-runner replay passed. Actual connected browser acceptance passed its final six stages against the API and both frontends; public/account/certificate UI stages and fixture boundaries are preserved in the evidence guide. See `docs/ECOSYSTEM_DELIVERY.md` for current endpoints, migrations, commits, execution commands and institutional inputs still required.
