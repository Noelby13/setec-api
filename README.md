# UNCSM academic API

Node.js/TypeScript API for postgraduate and continuing education workflows.

Start with [the integrated local execution guide](docs/ECOSYSTEM_DELIVERY.md) for all three applications, explicit additive migrations, environment settings, endpoints, institutional inputs and observed tests. Do not rerun a full schema or seed to upgrade an existing database.

Local development: `npm ci`, configure an authorized local database and distinct JWT keys, then `npm run dev`. See the guide before initializing data.

Checks: `npm test`, `npm run build`, `npm run contracts:check`, `npm run test:certificates:integration`, `npm run test:enrollments:integration`, `npm run test:grades:integration` and `npm run test:connected`. Integration commands create only their own temporary local test resources.

Academic obligations, manual enrollment activation, cashier allocations and internal receipts are described in [the academic billing guide](docs/academic-billing.md), including the two additive billing migrations and fiscal inputs still pending.

For presentation data, see [the database analysis and bulk demonstration loader](docs/demo-bulk-load.md). The standalone SQL covers every existing program plus 32 explicitly synthetic offerings; it requires an explicitly selected demo database and does not run automatically.

Individual grades support a full cohort roster, including students without a grade, and audited first-time entry. See [individual grade delivery and evidence](docs/ECOSYSTEM_DELIVERY.md#individual-grades-and-student-search-2026-10-29). Run `npm run test:grades:integration` with the cached `postgres:16-alpine` image and a running local Docker daemon: it creates its own database/container, checks actual grade SQL, rollback and concurrent saves, and removes only those temporary resources. It uses an explicit local Docker socket, binds PostgreSQL to loopback and never downloads images or loads the project `.env`.
