# Aula Virtual file exchange

This module prepares Moodle course and user files and imports a final component grade from an uploaded workbook. It does not contact Moodle, create Moodle accounts, enroll users, close grade sheets, or mark self/peer evaluations complete. Generated files must be uploaded by an operator, with courses created before users are enrolled.

## Database setup

Apply `database/migrations/20261029_virtual_classroom.sql` to an existing installation. Fresh installations receive the same objects from `database/schema.sql`. Moodle usernames, course shortnames, generated file bytes, and import source bytes are private database records; no source workbook is written under the public uploads directory.

## Candidate selection and mapping

`GET /api/virtual-classroom/candidates` accepts optional `from`, `to`, `programa_id`, and `cohorte_id` query parameters. Dates default to today through the following 30 days. A `COHORTE_GESTIONAR` user sees the matching schedule set; grade users may inspect schedules permitted by their role, and teachers see only their assigned schedules.

Before generation, configure each component/cohort Moodle course:

```http
PUT /api/virtual-classroom/courses/{scheduleId}
Content-Type: application/json

{"shortname":"PEP01-GESTION-PUBLICA","category":"Posgrados","teacher_role":"editingteacher"}
```

Configure an existing person-to-account link explicitly. Linked people use `user:{userId}` as the stable key; an unlinked applicant or teacher uses `applicant:{personId}` or `teacher:{personId}`. A linked application username is shown only as a suggestion until an administrator confirms it.

```http
PUT /api/virtual-classroom/accounts/applicant:{personId}
Content-Type: application/json

{"username":"ana.perez","verified":true}
```

Only `COHORTE_GESTIONAR` may edit mappings and generate files. Usernames and course shortnames are unique in the database. The preview endpoint is `POST /api/virtual-classroom/exports/preview` with `{ "schedule_ids": ["..."] }`. Resolve every returned issue before `POST /api/virtual-classroom/exports` with the same schedule IDs and `format` set to `xlsx`, `users_csv`, or `courses_csv`.

The workbook contains `Usuarios` and `Cursos`. User CSV headers include `username,firstname,lastname,email` and one `courseN,roleN` pair per selected schedule. Course CSV headers are `shortname,fullname,summary,category`. Accents are preserved and CSV values use standard quoted escaping. `GET /api/virtual-classroom/exports` lists the actor's generated batch metadata and content snapshot; generated content is stored privately for audit.

## Grade return

Upload one `.xlsx` or `.csv` file (maximum 15 MiB) as multipart field `archivo` to `POST /api/virtual-classroom/grades/{scheduleId}/preview`. Include `username_column` and `grade_column` multipart text fields to create a confirmable preview. If omitted, the response lists source columns and does not create a confirmation token. The file must include a row of headers. Formula/error cells, duplicate usernames, unlinked usernames, non-active/non-component students, blank values, and values outside 0–100 are reported as errors. Names are shown for review but never used for matching.

Every valid preview is bound to the current user, schedule, original file bytes, mapped usernames, active roster, and existing grades. It expires after two hours. Confirmation uses `POST /api/virtual-classroom/grades/{scheduleId}/confirm` with `{ "preview_id": "...", "reason": "..." }`. Identical grades are counted as unchanged and need no correction permission. A different grade requires `NOTA_MODIFICAR` and a nonblank reason. The service locks the schedule, checks that actas remain open, recomputes the fingerprint, then writes the import lot, grade changes, and SNEPA audit rows in one transaction. Any mismatch returns 409 and requires a new preview. The existing SNEPA importer remains unchanged.

## Verification

Run `node --import tsx --test src/modules/virtual-classroom/*.test.ts`, `npm test`, and `npm run build`. `npm run test:virtual-classroom:integration` uses only a cached local `postgres:16-alpine` Docker image, a unique disposable container/database, and a scratch directory. It never pulls images or reads `.env`; it removes only resources created by that run.
