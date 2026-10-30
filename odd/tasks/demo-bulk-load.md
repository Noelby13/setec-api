# Demonstration bulk database load
Objective: deliver a standalone synthetic PostgreSQL dataset and its database analysis. Branch: `feat/demo-bulk-load`; delivery: single-pr (one coherent local artifact, no remote publication).
Runner: disposable cached PostgreSQL 16 container; forecast: approximately 650 authored lines, excluding generated output. Engram mirror pending: provider unavailable.

## Specs
- S1: "quiero que analices toda la BD y me generes una carga masiva para la bd" — inspect the complete checked-in schema and migrations; deliver SQL and document relationships and prerequisites; do not execute against the configured database.
- S2: "el objetivo es tener datos para mostrar . ocupa datos de todas las carreras." — include every existing program dynamically and a clearly synthetic multidisciplinary catalog; populate coherent admissions, academic, billing and classroom demonstration flows.
- S3: "genera su archivo correspondiente para tenerlo en cuenta" — retain a reusable SQL file, instructions, quantities and validation evidence.

## Tasks
- T1 [S1–S3] inline, verified: SQL loader, analysis/instructions and isolated regression harness. Route reason: no parallel independent write units; parent implements. Work-unit commit is the commit introducing `database/demo_bulk_load.sql` (resolve with `git log --diff-filter=A --format=%H -- database/demo_bulk_load.sql`).
- T2 [S1–S3] delegated verification, pending: independent security/data-integrity audit after own PostgreSQL checks. Trigger: operational SQL creates identity and financial fixtures. Commit pending.

## Log
- L1 (2026-10-29): User request verbatim: "quiero que analices toda la BD y me generes una carga masiva para la bd, el objetivo es tener datos para mostrar . ocupa datos de todas las carreras. genera su archivo correspondiente para tenerlo en cuenta"
- L2: Root is not a repository; API is `V1/POSGRADOSETECAPI`, initially clean at `4b2a2e6` on `feat/aula-virtual`. Native multi-agent enabled. Configured explorer model unavailable; available Luna fallback mapped schema read-only. No project skill registry, shared resolver, Engram tools or gentle-ai executable available.
- L3: Checked-in schema has no authoritative program catalog. Existing DB not inspected. Assumption: synthetic illustrative offerings are acceptable for demonstration; include all existing offerings without changing their definitions or publication flags. Do not claim institutional completeness.
- L4: Source is standalone SQL plus docs and checks; source-mutating application tests have no relevant RED. Observe missing-loader failure first, then actual PostgreSQL execution, repeatability, preservation and rollback checks. No application implementation or dependency changes planned.
- L5: Observed missing-loader check exited 1 before creation. Own database integration command `node --import tsx scripts/demo-bulk-load.integration.mjs` passed twice, including after previous-degree metadata adjustment. It tested real PostgreSQL 16 execution, quantities, no active logins or permission grants, financial/grade invariants, real receipt rendering, whole-table hash preservation on repeat, receipt sequence preservation, existing-program coverage, rejection and full rollback. All owned containers were removed.
- L6: Current output covers 39 schema tables in the analysis; inserts 32 synthetic offerings across 16 illustrative disciplines, 96 cohorts, 1,920 students and 3,584 grades on an empty current schema. Existing programs are covered dynamically without definition changes. Sessions, real file/import/export artifacts and official certificate registries are intentionally not fabricated. Authored implementation approximately 540 lines; one coherent artifact delivery uses single-pr strategy, no PR requested.
- L7: Native review mode/assessment unavailable because `gentle-ai` is not installed; no review mode toggled or review approval claimed. Risk remains raised for identity fixtures and loader locking. Independent verifier required. Engram mirror remains pending because no provider is exposed.
