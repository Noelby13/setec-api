# Academic billing and internal payment receipts

The academic account is scoped to one enrollment and cohort. It distinguishes the enrollment fee, academic cost, accepted payment plan, obligations, approved payments, pending reservations and remaining balance. The backoffice and student portal consume the same `GET /api/billing/enrollments/:id/account` response. Monetary values are decimal strings; financial calculations use integer cents.

## Configuration and eligibility

An administrator opens **Cohorts → Payment plans**, defines the enrollment fee separately from academic cost and publishes a versioned offer. Supported modes are free, single payment, scheduled installments and charges linked to real curriculum components. Installment amounts must equal academic cost exactly; the enrollment fee is additional. Dates are optional. No interest, penalties, implicit discounts or electronic payment processors are introduced.

Multiple offers may coexist; one can be the cohort default. Admissions may assign an alternative before documentary approval. Existing documentary approval and cohort quorum determine collection eligibility. At that boundary the selected/default plan becomes an immutable accepted agreement with obligations, once only. A later offer or price change never silently reprices an existing accepted agreement. A free agreement generates no charges.

**Enrollment activation is a separate administrator action**, including free cohorts. Approving a payment does not activate enrollment. The administrator must have `INSCRIPCION_VALIDAR` and provide an audit reason; existing documentary, quorum and academic guards still apply. Activation does not invent a paid-amount threshold.

Historical approved payments without a known accepted price remain explicitly unconfirmed. An administrator must confirm the applicable plan and provide reconciliation evidence/reason. Reconciliation applies existing payments transactionally; over-credit and inconsistent allocations are rejected. An unknown balance is `null`, never a fabricated zero.

## Cashier operations

1. Open **Caja** and search by student name, identification or enrollment file code. Results show only names, document type and the last four identification characters.
2. Select the student, then one linked program/cohort. Each account keeps its own origin and totals.
3. Select unpaid obligations and, if needed, change an amount to a partial payment. The interface calculates the exact total; it does not accept an unrelated free-form charge.
4. Select cash, bank deposit or transfer. Supply the actual bank reference where applicable; cash receives an internal operational reference.
5. Confirm once. On an uncertain response, retry the retained operation with the same idempotency key and payload. Consult history before beginning a different operation.
6. Review updated balances and the linked internal receipt. Pending student reports reserve available amounts but reduce debt only after approval.

Collection, allocations, receipt numbering and audit events commit atomically. Enrollment/collection locks and request fingerprints protect concurrent collection and retries. Wrong-enrollment allocations, overpayment, duplicate obligations and changed retries are rejected.

Payment cancellation requires `PAGO_ANULAR`; unused obligation cancellation requires `OBLIGACION_ANULAR`. Neither permission is granted automatically to ordinary cashiers. An explicit reason is retained, approved allocations stop reducing the balance, and the original receipt remains visible with its cancellation annotation. A used or reserved obligation cannot be cancelled silently.

## Documents and permissions

Receipts are **internal payment acknowledgements, not fiscal invoices**. The PDF records the student, enrollment, program/cohort, concepts, exact amounts, payment reference/date, unique internal number and any cancellation. Authorized operators and the account owner may download it through the protected billing route; it is not a public upload. Browser view/print and PDF download attach authentication without putting credentials in URLs.

No approved fiscal format, tax identifiers, official fiscal numbering procedure or institutional approval was supplied. Those inputs and an authorized issuance procedure are required before claiming fiscal compliance. No banking/card integration is configured by this change.

The dashboard reports actual accepted-obligation balances, overdue counts, recent transactions, issued documents and today's approved operations in Nicaragua time. Accounts lacking an agreement are disclosed separately and excluded from authoritative debt totals. The student portal is read-only for this economic flow.

## Installation and verification

No configured database was migrated by this implementation. Review these additive migrations and a restorable backup before applying them to an explicitly authorized target, in order:

1. `database/migrations/20261021_academic_billing.sql`
2. `database/migrations/20261021_billing_payments.sql`

Use the project's normal reviewed migration process. Do not replay the full schema or seed over an existing database. Assign exceptional cancellation permissions only through the institution's authorized role process.

`npm test`, `npm run build` and `npm run contracts:check` cover deterministic API behavior and canonical consumer copies. `npm run test:billing:integration` uses a unique disposable PostgreSQL container, scratch uploads and synthetic users; it never uses project `.env` or a configured database. `npm run test:enrollments:integration` and `npm run test:connected` exercise preserved academic behavior and local browser journeys. Run outputs, including failures and unavailable checks, are recorded in `odd/tasks/academic-billing-ux.md`; this guide does not assert a check passed merely because a command exists.
