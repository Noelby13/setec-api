# UNCSM academic ecosystem: local delivery

Status: implemented and locally verified across three independent repositories. No deployment, push, real payment, configured-database migration or production data change was performed. Institutional acceptance, approved academic decisions and installation against an authorized database remain separate from these local engineering results.

## Implemented scope

| Application        | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSGRADOSETECAPI` | Student-only account registration; account/profile updates; controlled administrative users and role assignment; live session/account/permission checks; own-resource access; open-cohort applications and duplicate prevention; cashier-safe discovery; assigned teaching scope; complete own-history pagination; protected uploads; corrected academic SQL projections; linked digital certificate registry. |
| `setecweb`         | Existing catalog/cohort/admission/payment/grade/graduation functions retained; user management and account status; permission-scoped real indicators; cashier workspace and enrollment discovery; assigned teaching activities/act links; administrative certificate consultation, authorized legacy registration, downloads, public verification links, controlled revocation and event history.              |
| `setecportal`      | Public catalog/search/filtering and program/cohort detail; contextual registration/login/application; own account and applicant profile/documents; prior degrees and observed-document correction; own requests, enrolled/finished records, recorded schedule and authorized academic results; payment movement consultation; registered certificate consultation/download and public verification.            |

UI uses existing UNCSM colors, Roboto and reusable components. No new LMS, invented attendance/progress, payment gateway, calculated debt, academic decision rule or official certificate artwork is introduced. Requests, reserved places, payment review, active enrollment, egreso and certification remain distinct states. Data comes from API responses; test fixtures are confined to tests.

## API and contract changes

`FRONTEND_API_CONTRACT.md` and `frontend-types.ts` in this API repository are canonical. Their copies in both frontends must match byte for byte. The contract's current update supersedes its clearly marked historical reference snapshot; Swagger/comments alone are not the integration authority.

- `POST /api/auth/register`, `PATCH /api/auth/profile`.
- `GET/POST /api/users`, `PATCH /api/users/:id`, `GET /api/users/roles`; user list adds exact-name `rol` filtering.
- `GET /api/enrollments/cashier`; enrollment collections add `programa_id` filtering.
- `GET /api/enrollments/me?page&limit` adds real pagination while retaining existing `data`/`total` fields.
- `GET /api/cohorts/teaching/me`; grade operations enforce assigned-class scope.
- Prior-degree `PUT /api/applicants/degrees/:degreeId` returns changed evidence to `PENDIENTE` validation.
- `GET /api/certificates/me`, `GET /api/certificates`, public `GET /api/certificates/verify/:token`, protected `GET /api/certificates/:id/download` and `/events`, `POST /api/certificates/expediente/:id/register`, `POST /api/certificates/:id/revoke`.
- Existing graduation dossier reads expose registry availability, certificate ID and state. Legacy code verification reports authenticity/integrity as booleans; no registry means no digital authenticity assertion.
- Only promotional program/syllabus uploads remain public. Fetch private documents through the authenticated clients; do not forward tokens to arbitrary external URLs.

Fresh issuance uses the existing graduation endpoint and academic checks plus a registered-egreso safeguard and supplied institutional PDF. Its dossier write, immutable registry snapshot, SHA-256 and issuance event share one transaction. Registration of an already issued historic document is explicit. Revocation requires `CERTIFICADO_REVOCAR` and a reason; events are administrative. Public verification reveals minimal academic identity, never personal identification numbers, contacts, private PDF paths, actors or revocation reasons. A registry integrity check is not a cryptographic signature or an academic determination.

## Database changes and application

New additive tables: `certificados_registro` and `certificados_eventos`; related indexes and a snapshot-protection trigger; permission `CERTIFICADO_REVOCAR` assigned initially to `SUPER_ADMIN`. Historic dossiers are neither registered nor issued automatically. New cashier seed defaults exclude admission validation. No new student/user entity duplicates existing tables.

For an **existing authorized local database**, first inspect both migrations and review/retain a restorable backup. Set `AUTHORIZED_LOCAL_DATABASE_URL` locally to that exact intended database without putting credentials in Git, logs or this document. The following are instructions, not commands already executed on a configured database:

```sh
pg_dump "$AUTHORIZED_LOCAL_DATABASE_URL" --format=custom --file=/path/to/private-backups/uncsm-before-ecosystem.dump
psql "$AUTHORIZED_LOCAL_DATABASE_URL" --set=ON_ERROR_STOP=1 --file=database/migrations/20261021_certificate_registry.sql
# Optional role cleanup, after reviewing current cashier permissions:
psql "$AUTHORIZED_LOCAL_DATABASE_URL" --set=ON_ERROR_STOP=1 --file=database/migrations/20261021_cashier_permissions.sql
```

The optional cashier migration removes the legacy `INSCRIPCION_VALIDAR` role grant. Review legitimate additional academic assignments before applying it; it cannot infer institutional intent. Certificate migration adds the registry without changing existing academic or payment records. Without it, registry endpoints/fresh issuance return 503; legacy dossier reads expose availability false, and legacy verification cannot claim digital authenticity.

Do not rerun `database/schema.sql`, `database/init.sql` or the full seed against an existing database to apply these changes. The full schema is for a separately created empty database. For a new disposable local database, inspect the schema/seed, initialize that empty database with the schema, then run the seed only when its bootstrap roles/accounts are appropriate; replace any test credentials before non-test use. Retain uploaded institutional PDFs and backups according to local policy. Never run destructive setup against a configured real database as a test.

## Run the three projects

The verified local runtime is Node.js 22.17.1 with npm 10.9.2. Install each repository's frozen dependencies with `npm ci`; `setecportal` now has an independent real `node_modules` directory and lockfile. Do not share or symlink frontend dependency directories. No added runtime UI framework or browser download is required by this delivery.

In `POSGRADOSETECAPI`, configure local `.env` keys `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, and `NODE_ENV`. Use two independently generated, nonempty, distinct signing secrets; never copy fixture keys or commit values. The API uses `PORT=3000` by default. Configure only an intended local database; the ordinary server/seed reads this configuration.

```sh
# POSGRADOSETECAPI, terminal 1
npm run dev
# Or: npm run build && npm start
```

In `setecweb`, create a local `.env` from `.env.example`. Set `VITE_API_BASE_URL=http://localhost:3000/api` and `VITE_API_ORIGIN=http://localhost:3000` for that local API. These are public build settings, never secrets. The second key resolves protected document origins outside `/api`.

```sh
# setecweb, terminal 2
npm run dev -- --port 5173 --strictPort
```

In `setecportal`, create `.env.local` from `.env.example`; set `VITE_API_BASE_URL=http://localhost:3000/api`. The student transport derives its document origin from that complete API URL. No backend credentials belong in a `VITE_*` variable.

```sh
# setecportal, terminal 3
npm run dev -- --strictPort
```

Local URLs: API `http://localhost:3000/api`, admin `http://127.0.0.1:5173`, portal `http://127.0.0.1:5174`. Stop only servers you own if those ports are occupied; do not silently reuse an unrelated process. Portal preview uses 4174. Restart Vite after changing build settings. Sessions remain in memory and require login after reload; cohort selection/context is retained separately without storing tokens.

## Verification and remaining evidence

| Check                                     | Observed result                                                                                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API deterministic HTTP/unit suite         | 101 passed; TypeScript build passed                                                                                                                                                    |
| Administrative frontend                   | 153 passed; production build passed                                                                                                                                                    |
| Student portal                            | 45 passed; production build passed                                                                                                                                                     |
| Browser fixtures                          | Admin 8/8 and portal 3/3 passed; API traffic simulated                                                                                                                                 |
| PostgreSQL certificate lifecycle          | Independent verification and parent replay passed                                                                                                                                      |
| PostgreSQL admission/payment/input guards | Independent verification, baseline compatibility and retained-runner parent replay passed                                                                                              |
| Real connected browser                    | Public registration/application and eight successful certificate/public-role stages observed; final retained admission/Caja/student replay 6/6 passed, without intercepted API traffic |
| Contract synchronization/types            | All three copies match; standalone TypeScript compilation passed                                                                                                                       |
| OpenSpec                                  | All eight changes pass strict validation                                                                                                                                               |

The final connected runner creates a new PostgreSQL database, starts the actual API and both built frontends on private ephemeral loopback ports, and uses installed Chrome. It verifies administrative documentary approval/quorum, a dummy cashier receipt/approval, reflected student matriculation, final history and a recorded numeric grade. Its initial registration/profile/application are prepared through real HTTP; their full UI journey was observed in the preceding public-portal run. Existing programs/classes are modeled fixture records, and the final-history EGRESADO/grade are explicit SQL prerequisites, not automatic institutional completion decisions.

The certificate browser journey used an explicitly supplied test PDF: issuance through the existing graduation UI, owner download with identical SHA-256, public valid/unknown states, explicit revocation and revoked-download 409. Backend probes additionally verify immutable minimal snapshots, academic gates, rollback on audit failure, races, tampering and the old upload URL boundary.

Earlier attempts preserve two harness mistakes: a textbox/searchbox locator mismatch and an exact 90/90.00 comparison. The corrected final retained replay passes; the original failed attempts are not relabeled as passing. No application JavaScript errors occurred. Owned browsers, servers, pools and temporary containers were closed; pre-existing previews were preserved. Structured evidence and fixture screenshots are in [verification/connected-evidence.json](verification/connected-evidence.json) and [verification/postgres-evidence.json](verification/postgres-evidence.json).

```sh
# POSGRADOSETECAPI: deterministic isolated HTTP/unit checks and build
npm test
npm run build
npm run contracts:sync
npm run contracts:check
./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2022 --skipLibCheck frontend-types.ts
openspec validate --all --strict --no-interactive

# POSGRADOSETECAPI: explicit retained integration runner
npm run test:certificates:integration
npm run test:enrollments:integration
# Actual API + both frontends + Chrome; uses own temporary data/ports
npm run test:connected

# Each frontend, independently
npm test
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

The integration runner requires Docker at its documented local socket and an already cached `postgres:16-alpine` image. It uses `--pull=never`, generates its own uniquely named disposable database/container and temporary files, verifies database identity, does not read project `.env`, and cleans up its own resources. It does not authorize operations against any other database or remote Docker host. Failure/unavailability remains missing evidence, never a pass. Ordinary unit tests use isolated HTTP/mocks. Browser tests require an already available browser; do not download one or use a personal browser profile implicitly. Admin browser tests reserve 5173; portal tests reserve dedicated 5184, separate from its dev port.

## Institutional/configuration items still required

- Define the speaker committee resolution and waiting-list promotion procedure. These pending states are visible; documentary approval cannot stand in for their institutional decisions.
- Define the authorized academic criteria and operational process for recording `EGRESADO`; this implementation does not invent a graduation/completion transition or infer completion solely from payments/enrollment.
- Supply the official institutional PDF design/signing process. The system verifies and serves supplied files; it does not generate an official template or claim a digital signature.
- Confirm which additional institutional operators, if any, receive revocation authority and which reasons/procedures they must follow. Technical permission checks and audit are implemented; normative authority is not inferred.
- Configure a real authorized recovery delivery service before adding password-reset email delivery. Current UI gives honest assistance guidance; no email is sent or falsely confirmed.
- Apply reviewed migrations explicitly to an authorized target when ready; no real database was migrated by this work. The engineering scenarios use isolated fixtures; institutional acceptance must use approved procedures and must not rely on live charges or real-student mutations.

## Commits and progress

| Repository     | Local commits                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API            | `34eefd4` audit/OpenSpec; `7cc5120` identity/users; `dff1cf4` academic ownership/teacher/cashier; `a11fca0` certificate registry; `240ba76` serialized transitions; `618d8e0` strict documentary input |
| Backoffice     | `a8c1162` users/dashboards; `bc34f66` certificates; `b8b1fc6` eligible admission/Caja actions; `a3beca6` latest contract synchronization                                                               |
| Student portal | `f8295b7` runnable public/student application; `fe5612f` transition contract; `4759e51` strict-input contract                                                                                          |

Acceptance-tooling/evidence commit: API `05afb6b`. Documentation entry points: backoffice `c62557a` and portal `86ba13b`. The final tracking-closure commit follows these source commits; inspect `git log --oneline` in each repository for the complete local history. Branch: `feat/uncsm-student-ecosystem`. No push, pull request or deployment was performed. Resume details and per-spec evidence are in `odd/tasks/uncsm-ecosystem.md`. Engram mirror and native gentle-ai assessment/review remain unavailable; functional evidence is not represented as a native receipt.

## Known baseline API limitations

The preserved historical contract identifies older behavior outside the new workflows: program edits must use the dedicated tag-assignment endpoint rather than passing `tag_ids` to the generic update; PUT defaults must be preserved by clients; some inherited Multer errors still use generic 500 responses. Existing frontend consumers keep their established handling. These are not new regressions or claims of full unrelated API remediation.

## Fixture screenshots

- [Public program](verification/screenshots/public-program.png)
- [Mobile catalog](verification/screenshots/public-catalog-mobile.png) — simulated browser data, responsive QA
- [Student certificate](verification/screenshots/student-certificate.png)
- [Public revoked certificate](verification/screenshots/public-revoked-certificate.png)
- [Finished history](verification/screenshots/student-finished-history.png)
- [Recorded academic results](verification/screenshots/student-recorded-results.png)

## Needs your decision: native review

The requested local implementation and functional acceptance are complete. Native high-risk review remains **unavailable**: the current environment cannot resolve the `gentle-ai` command, so the user-owned mode/assessment/preflight cannot be read or executed. Independent functional verification is not a native transaction, consent, receipt or approval. No review mode was changed.

AGENTS.md requires an explicit disposition of unavailable proof. The remaining choice is to leave these local source candidates explicitly without native review, or keep that review pending until the CLI is available. This does not authorize deployment, push or a real-database migration. The feature remains open only for this decision; its code, tests, commands and evidence are preserved.
