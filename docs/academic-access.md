# Owned academic workflows

Student applications use the authenticated applicant and accept only `INSCRIPCION_ABIERTA` cohorts. A locked cohort row preserves the existing documentary, committee, waiting-list, quorum and payment transitions. Submission never means admission or matriculation. Applicant/cohort uniqueness prevents duplicates.

Applicant, degree, enrollment, payment, convalidation, grade, dossier and publication reads use ownership or their specific administrative permission. A supplied file URL does not establish ownership. Private uploads require authorization; only program promotions and syllabi remain public. Download private files as authenticated blobs.

The cashier endpoint preserves pagination but returns payment-relevant fields only. Cashier-only details redact identity documents, contacts and admission evidence. New seed defaults grant only `PAGO_VALIDAR`; the optional cashier migration removes the previous default admission grant on an explicitly authorized database. Additional academic permissions remain effective.

Teachers discover their assigned schedules at `/api/cohorts/teaching/me`. Class grades, import history, imports and class spreadsheets enforce assignment. Import permission alone does not grant a complete student's transcript or another teacher's class.

Own history accepts only `page` and `limit`, and returns complete pagination metadata. Administrative enrollment filters include `programa_id`; managed users accept `rol`. Both counts and rows use the same filters. Editing a degree returns it to `PENDIENTE`; an empty update preserves its state and students cannot submit validation fields.

Checks: the staged increment passed 50 deterministic tests and the TypeScript build in a fresh scratch copy. Independent disposable PostgreSQL probes verified ownership, duplicate applications, cashier-only payment operations, teacher assignment, 101-record pagination, role/program filters, degree revalidation and the corrected grade-audit role join. No configured database was modified.

This coherent authorization increment spans existing resource routes because each route must enforce the same ownership boundary. Native review assessment is unavailable (`gentle-ai` absent); independent verification supplies observed functional evidence, not a native receipt.

Risk: items 2, 3 and 4 (authorization, existing consumers and transactional application ordering).
