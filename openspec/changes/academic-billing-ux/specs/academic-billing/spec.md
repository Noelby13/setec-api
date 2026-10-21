## ADDED Requirements

### Requirement: Reachable actions and retained edits
Program and directly related cohort forms SHALL expose consistent save/cancel actions, retain edits across detail tabs, identify required fields, show actionable validation errors and offer explicit discard/continue choices before leaving unsaved work. Successful saving SHALL confirm the result and provide a clear destination.

#### Scenario: Edit while navigating program details
- **WHEN** an administrator edits program fields and visits another detail tab
- **THEN** returning to edit retains entered values and save does not depend on visiting tags

### Requirement: Accepted obligations and exact balances
Cohort plans SHALL separate enrollment fees from academic cost, match installment sums to the agreed academic price, support real academic-module links and optional due dates, and create immutable per-enrollment obligations once at existing documentary/quorum eligibility. Balances SHALL derive from exact decimal amounts and accepted payment allocations. General price changes SHALL NOT rewrite accepted debt.

### Requirement: Safe collection and internal documents
Authorized collection SHALL identify the student, cohort and obligations; prevent wrong-owner allocations, overpayment and retry duplicates transactionally; retain an audit history and uniquely numbered linked internal receipts. Fiscal compliance SHALL remain pending verified institutional requirements.

### Requirement: Consistent accounts and operational navigation
Authorized administrative/cashier dashboards and student account views SHALL use the same authoritative obligations, payments, balances, due dates and protected internal receipts. No unauthorized electronic payment integration SHALL be enabled.

### Requirement: Verified delivery
Implementation SHALL preserve existing valid behavior and demonstrate form journeys, exact-money invariants, authorization, retry/concurrency behavior and connected accounts using isolated data. The complete original request and its numerical examples remain acceptance criteria.

### Requirement: Explicit administrator activation
Matriculation SHALL activate only through an authorized administrator decision, including free cohorts. Payment recording or approval SHALL NOT itself activate academic matriculation. Existing documentary and quorum conditions SHALL remain prerequisites for collection.

#### Scenario: Partial payment or free cohort
- **WHEN** money is recorded/approved or a cohort has no financial obligation
- **THEN** an administrator still makes the explicit matriculation activation decision
