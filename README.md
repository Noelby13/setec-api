# UNCSM academic API

Node.js/TypeScript API for postgraduate and continuing education workflows.

Start with [the integrated local execution guide](docs/ECOSYSTEM_DELIVERY.md) for all three applications, explicit additive migrations, environment settings, endpoints, institutional inputs and observed tests. Do not rerun a full schema or seed to upgrade an existing database.

Local development: `npm ci`, configure an authorized local database and distinct JWT keys, then `npm run dev`. See the guide before initializing data.

Checks: `npm test`, `npm run build`, `npm run contracts:check`, `npm run test:certificates:integration`, `npm run test:enrollments:integration` and `npm run test:connected`. Integration commands create only their own temporary local test resources.
