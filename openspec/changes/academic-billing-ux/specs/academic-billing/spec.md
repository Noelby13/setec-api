## ADDED Requirements

### Requirement: Reachable actions and retained edits
Program and directly related cohort forms SHALL expose consistent save/cancel actions, retain edits across detail tabs, identify required fields, show actionable validation errors and offer explicit discard/continue choices before leaving unsaved work. Successful saving SHALL confirm the result and provide a clear destination.

#### Scenario: Edit while navigating program details
- **WHEN** an administrator edits program fields and visits another detail tab
- **THEN** returning to edit retains entered values and save does not depend on visiting tags

### Requirement: Accepted obligations and exact balances
Cohort plans SHALL separate enrollment fees from academic cost, match installment sums to the agreed academic price, support real academic-module links and optional due dates, and create immutable per-enrollment obligations once at existing documentary/quorum eligibility. Balances SHALL derive from exact decimal amounts and accepted payment allocations. General price changes SHALL NOT rewrite accepted debt.

#### Scenario: Enrollment fee plus three installments
- **WHEN** an eligible student accepts a C$2,000 enrollment fee and three academic installments of C$10,000
- **THEN** the account commits C$32,000 once, separates the fee, and retains that agreement after later price changes

### Requirement: Safe collection and internal documents
Authorized collection SHALL identify the student, cohort and obligations; prevent wrong-owner allocations, overpayment and retry duplicates transactionally; retain an audit history and uniquely numbered linked internal receipts. Fiscal compliance SHALL remain pending verified institutional requirements.

#### Scenario: Partial collection and retry
- **WHEN** Caja records C$4,000 against a C$10,000 installment and retries the same operation
- **THEN** the installment balance is C$6,000, only one payment and internal receipt exist, and the operation remains auditable

### Requirement: Consistent accounts and operational navigation
Authorized administrative/cashier dashboards and student account views SHALL use the same authoritative obligations, payments, balances, due dates and protected internal receipts. No unauthorized electronic payment integration SHALL be enabled.

#### Scenario: Shared account after collection
- **WHEN** Caja and the owning student consult the same enrollment after an approved collection
- **THEN** both receive the same obligations and balance, and can consult its authorized internal receipt without an electronic payment action

### Requirement: Verified delivery
Implementation SHALL preserve existing valid behavior and demonstrate form journeys, exact-money invariants, authorization, retry/concurrency behavior and connected accounts using isolated data. The complete original request and its numerical examples remain acceptance criteria.

#### Scenario: Connected verification
- **WHEN** the implementation is checked against disposable PostgreSQL and local browser sessions
- **THEN** observed results cover the configured plan, partial collection, account consistency and explicit administrator activation without changing a configured database

### Requirement: Explicit administrator activation
Matriculation SHALL activate only through an authorized administrator decision, including free cohorts. Payment recording or approval SHALL NOT itself activate academic matriculation. Existing documentary and quorum conditions SHALL remain prerequisites for collection.

#### Scenario: Partial payment or free cohort
- **WHEN** money is recorded/approved or a cohort has no financial obligation
- **THEN** an administrator still makes the explicit matriculation activation decision
