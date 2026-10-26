# Cohort module pricing

Objective: configure enrollment pricing and dated module charges in the cohort editor. Branch: `feat/uncsm-student-ecosystem` in API and backoffice.
Delivery: single-pr, local work-unit commits only; forecast approximately 600 authored changed lines. Runners: API `npm test`; backoffice `npm test`; independent financial verification. Engram mirror pending: memory tools unavailable.

## Specs

S1. User request: “cuando estoy guardando una cohorte, quiero que exista, el precio de matricula que puede ser gratis o pagada, precio total de la cohorte, Y TAMBIEN SE DEBE PONER PRECIO DE MODULO Y FECHA DE PAGO , asi para cuando el estudiante tiene que pagar, ya sabe cuanto debe de pagar, haz los cambios necesarios”. Acceptance: cohort editor configures free/paid enrollment, academic total, actual module amounts and required payment dates; cohort and default offer persist atomically and feed the existing student account. Existing academic-total semantics exclude enrollment, and previously accepted student agreements retain their original obligations. Checks: deterministic schema/service and UI tests, isolated financial integration where available, builds and independent verifier.

## Tasks

- T1 | S1 | inline (existing flow mapped; no writer trigger) | verified; commit pending | API atomic embedded module plan and regression tests; commit pending.
- T2 | S1 | inline (same coherent flow; no writer trigger) | verified; commit pending | cohort pricing editor, readback and regression tests; commit pending.
- T3 | S1 | delegated verification (financial persistence, shared contracts and transactions: risk items 1, 3, 4) | verified; final evidence commit pending | independent isolated verification and parent spot check.

## Log

L1 (2026-10-26). Original request verbatim: cuando estoy guardando una cohorte, quiero que exista, el precio de matricula que puede ser gratis o pagada, precio total de la cohorte, Y TAMBIEN SE DEBE PONER PRECIO DE MODULO Y FECHA DE PAGO , asi para cuando el estudiante tiene que pagar, ya sabe cuanto debe de pagar, haz los cambios necesarios
L2. Read-only explorer mapped existing versioned billing plans and student account presentation. All relevant repositories were clean on the existing feature branch. No new database columns or migration are required. Project skill registries, memory tools, and gentle-ai executable are unavailable. Existing focused checks passed on baseline (web 26; API 6). The requested explorer profile is unavailable; an inherited runtime profile performed the read-only map.

L3. Implemented optional embedded `plan_pago` in JSON/multipart using the existing default-plan tables. Cohort writes and version publication share one transaction; exact prices, complete real-module coverage and payment dates are required. Existing scalar-only and standalone plan clients retain their behavior. Current student agreements are unchanged. API RED: four added schema tests failed before the fix; GREEN: ten focused tests passed after normalization.
L4. The editor now offers free/paid enrollment, academic and combined totals, module amount/date inputs, exact-cent distribution, required new-cohort schedules and current-plan readback. UI RED: three requested behavior tests failed before implementation; GREEN: focused tests passed. An additional RED/GREEN regression fixes a false dirty indicator when loading existing schedules. Final complete backoffice suite observed 183/183 pass in independent scratch; build passed.
L5. Own-check executor observed API `npm test` 119/119, API build, canonical contract check, backoffice full suite/build, portal account tests 9/9 and portal build passing. Isolated billing integration initially lacked Docker socket permission; one approved local escalation retry passed with `complete: true`, including public-HTTP atomic rollback/data-hash preservation, immutable student accounts, changed/new version behavior and free multipart offers. No real database was changed.
L6. Native `gentle-ai review mode status`, assessment and selectorless STATUS were unavailable (exit 127, executable missing). No RDD transaction or authority was created; no mode preference was changed. Independent financial verification remains separate. Engram mirror remains pending because memory tools are unavailable. Delivery stays on the existing feature branches with no push or publishing.

L7. Independent verifier used fresh `/tmp` source copies without repository metadata, environment files or real data: S1 PASS; no change-caused blocker. Observed final web suite 183/183 and build, API suite 119/119, and an independent complete isolated financial integration pass. No correction requested. Optional screenshot/browser timing probe skipped. Parent spot check reran six focused schema/public-controller regression tests successfully. Risk: items 1, 3, 4 (financial reference updates, shared form/contracts and transaction locking).
