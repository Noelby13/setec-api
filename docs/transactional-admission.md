# Transactional admission and receipt decisions

Documentary decisions now lock the cohort, then the application, and inspect the fresh application state. Only documentary review and observed documentation permit a decision. Previously approved positive decisions retain their existing400 response; unsupported transitions return409 without changing data. Approval respects the recorded maximum capacity, and concurrent approval counts the application once.

Receipt registration and decisions use the same cohort/application lock order, followed by the receipt lock. Collection needs the applicant's recorded documentary approval and enabled cohort collection. A pending receipt can be decided once. Rejecting another pending receipt preserves an established matriculation and its exact date. Withdrawn/completed academic records and closed cohorts cannot be reactivated through these operations. Existing reservation, quorum and normal payment behavior remain unchanged; no debt, installment or completion criterion is introduced.

The administrative form offers only cohorts with open applications. Documentary and cashier controls reflect eligible states. Speaker committee resolution and waiting-list promotion remain institutional inputs; documentary approval cannot silently substitute either process.

Observed RED:17 of19 initial HTTP cases failed; ten additional closed-cohort/quorum checks then failed before their guards. Final focused suite:30 passed. Whole API suite:99 passed; backoffice153 passed; both builds passed. Independent disposable PostgreSQL verification and parent replay passed, including normal response compatibility, races, rejected-command data invariance and preservation of matriculation. A real connected browser replay with the current guards passed6/6 without intercepted API traffic. The retained PostgreSQL command is `npm run test:enrollments:integration`.

Risk: items1,3,4 (stored state, existing consumers and concurrent administrative decisions). Native review is unavailable; these are observed functional checks, not a native review receipt.
