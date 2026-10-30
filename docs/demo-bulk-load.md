# Demonstration database bulk load

The deliverable is [`database/demo_bulk_load.sql`](../database/demo_bulk_load.sql). It creates synthetic presentation data in an explicitly selected demonstration PostgreSQL database. It does not connect to or load the configured application database automatically.

## Database analysis and scope

The checked-in model has **39 tables**. `database/schema.sql` is the consolidated schema; `database/init.sql` is an older base and lacks billing, certificate registry and virtual-classroom additions. `src/db/seed.ts` provisions security definitions and an administrator, rather than an academic catalog. No authoritative institutional list of careers exists in the reviewed repository. The live database was not accessed.

| Domain | Tables and relationships | Loader behavior |
| --- | --- | --- |
| Security | `roles`, `permisos`, `roles_permisos`, `usuarios`, `sesiones` | Reuse existing roles, add three role names if absent, create inactive synthetic accounts. No privilege assignments, password changes or sessions. |
| Taxonomy | `areas_conocimiento`, `tags_academicos`, `programas_tags` | Eight synthetic knowledge areas, sixteen discipline tags, and program/tag links. Areas describe taxonomy; they are not careers. |
| Infrastructure | `sedes_ies`, `personal_academico` | One fictional campus, one coordinator and eight teachers. |
| Offerings | `programas_academicos`, `componentes_curriculares` | Two illustrative offerings per discipline and four modules per new offering. Preserve existing offerings and curriculum. |
| Delivery | `cohortes_apertura`, `programacion_componentes_cohorte` | Three demo cohorts per program, with its own curriculum and teacher assignments. Open admissions, running and completed/evaluated examples. |
| Applicants | `personas_aspirantes`, `aspirantes_intereses_areas`, `titulos_academicos_aspirante` | Sixty distinct synthetic people, interests and previous-degree metadata per program. |
| Admissions | `inscripciones`, `solicitudes_convalidacion_acreditacion` | Documentary review/observations, reserved places, active enrollment, pending payment, review, withdrawal, waiting list and completed studies; one pending recognition request per program with a curriculum. |
| Grades | `matricula_componentes_snepa`, `notas_snepa_logs`, `lotes_importacion_notas` | Passing/failing grades with initial-entry audit; missing grades remain available for entry. No fabricated Excel upload batch. |
| Agreements | `planes_pago_cohorte`, `cuotas_plan_pago`, `planes_asignados_inscripcion`, `acuerdos_pago_inscripcion`, `obligaciones_pago` | Cohort offers and accepted agreements with separate enrollment and academic obligations. No repricing of existing agreements. |
| Payments | `pagos_inscripcion`, `aplicaciones_pago`, `comprobantes_internos`, `auditoria_economica` | Full/partial approved payments, an unpaid account, pending review, exact allocations, internal receipt snapshots and explicitly synthetic audit entries. |
| Completion | `expediente_graduacion_certificacion`, `publicaciones_cientificas_estudiante`, `certificados_registro`, `certificados_eventos` | Completed-study dossiers and illustrative research metadata. No issued degree, registered certificate, certificate hash or official verification event is fabricated. |
| Classroom exchange | `virtual_classroom_accounts`, `virtual_classroom_courses`, `virtual_classroom_exports`, `virtual_classroom_grade_previews` | Local unverified account/course proposals. No external LMS call, confirmed external identity, export history, file bytes or import preview. |

The sixteen **illustrative disciplines**, not a confirmed institutional career catalog, are Medicine, Nursing, Dentistry, Public Health, Systems Engineering, Civil Engineering, Industrial Engineering, Agronomy, Veterinary Medicine, Law, Administration, Accounting, Education, Psychology, Communication and Economics. Each gets a professional master's and a professional diploma. Names, prices and academic metadata are fictional; these records do not establish institutional authorization or regulatory compliance.

In addition, the loader iterates **every program already in `programas_academicos`**, including hidden/inactive programs. It adds demo cohorts and people without changing that program's name, visibility, state, price, requirements, tags or existing curriculum. Existing programs without modules get no invented modules or grades. Their publication flags continue to control public visibility. Adding more programs later and rerunning the loader adds their demo records too.

## Expected volume on an empty current schema

| Item | Count |
| --- | ---: |
| Synthetic programs / curriculum modules | 32 / 128 |
| Cohorts / scheduled modules | 96 / 384 |
| Students / enrollments | 1,920 / 1,920 |
| Users, including nine staff accounts | 1,929 |
| Grade records / initial audit entries | 3,584 / 3,584 |
| Payment agreements / obligations | 1,216 / 2,432 |
| Payments / approved internal receipts | 1,184 / 1,152 |
| Completion dossiers / publications | 640 / 320 |

Each additional existing program receives three cohorts and sixty students/enrollments; related grade counts depend on its actual curriculum. Synthetic postgraduate cohorts have a C$24,000 academic price, diplomas C$4,000, plus C$500 enrollment. Existing offerings use their reference academic price plus the demo C$500 enrollment fee; a zero academic price produces no academic obligation. These figures are demonstration choices, not approved fees.

## Execution

1. Select an isolated demonstration database with the **current schema**. For a new empty database only, initialize with `database/schema.sql`. For an existing demonstration database, apply missing additive migrations through the normal process, in order: academic billing, billing payments, cashier permissions, certificate registry, virtual classroom, then virtual-classroom proposals. Do not replay the full schema or security seed on an existing database.
2. Open `database/demo_bulk_load.sql` in pgAdmin/DBeaver or use `psql`. In the **same connection**, execute `SET demo.allow_seed = 'yes';` before running the file. The setting is an explicit opt-in; it is not an automatic production detector.
3. For `psql`, replace the uppercase connection placeholders with your selected demo target; use an interactive password prompt or your normal credential mechanism:

   ```sh
   psql -X -v ON_ERROR_STOP=1 -h DEMO_HOST -p DEMO_PORT -U DEMO_USER -d DEMO_DATABASE \
     -c "SET demo.allow_seed = 'yes'" -f database/demo_bulk_load.sql
   ```

4. Review the per-program summary returned before commit. The file wraps all inserts in one transaction; any error aborts the load. Deterministic UUIDs and insertion-only conflict handling make repeated unchanged loads preserve rows, timestamps, changes made later through the UI, and receipt numbering. Identity/name collisions fail rather than overwrite another record. Concurrent copies of this loader serialize with a transaction-scoped lock; lock timeout is five seconds and statement timeout is three minutes.

Use the application's existing authorized administrative account to demonstrate the data. All generated users are **inactive**, with unusable password hashes and no added permissions. There is no shared demo password or newly enabled administrator. To demonstrate a student login, provision that particular account through the application's normal authorized account-management process.

The `/demo/no-documento/...` paths and `example.invalid` links are deliberate placeholders, not downloadable documents. There are no real identity scans, CVs, MINSA approvals, research papers or certificates. Completed students remain `EGRESADO`, awaiting an actual issuance workflow. A preexisting offering may have stricter requirements than the illustrative metadata; this load does not claim to satisfy them. Classroom category `DEMO` is a local proposal; configure the real LMS category before external use. No remote upload is authorized or performed by this loader.

Dates are relative to the first load for each deterministic row. Existing demo rows are not refreshed on later runs; use a fresh disposable database for a new presentation timeline. To discard the dataset, discard your disposable demonstration database using your normal process; no broad deletion script is included.

## Verification

Run `node --import tsx scripts/demo-bulk-load.integration.mjs` from the API repository with Node dependencies available, Docker running and a cached `postgres:16-alpine` image. The harness creates only its randomly named container and three owned databases, disables container networking, exposes no host port, never reads `.env`, never pulls images, and removes its own container/volume afterward.

Observed checks: full SQL execution on PostgreSQL 16; expected volume; disabled accounts; absence of privilege grants; exact accepted-obligation totals and payment allocations; grade/cohort/component consistency; health-modality and date checks; an internal receipt rendered through the real PDF generator; unchanged row hashes and receipt sequence after repeated loads on fresh and shared connections; preservation and coverage of an existing hidden zero-price program; complete rollback after a late injected failure; and refusal without opt-in or on the old schema. The harness waits for TCP readiness so the image's temporary initialization server cannot produce a false ready signal. These are database-level proofs; no browser or external LMS journey was executed.
