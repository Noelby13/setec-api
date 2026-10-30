# Readable presentation dataset — version 2

The SQL file is [`database/demo_bulk_load.sql`](../database/demo_bulk_load.sql). Version 2 replaces UUID-like display labels with meaningful academic references and adds program covers and educational video links. UUIDs remain internal primary keys.

### UUID validation correction

The initial version 2 generated UUIDs by casting a raw MD5 value. PostgreSQL accepted those values, but many failed the API's UUID version/variant checks, causing `Validation error` in detail pages and filters. The generator now uses canonical name-based UUIDv3 values with a fixed namespace. The regression checks every stored UUID and exercises the real program, cohort, enrollment and payment schemas. API validation remains unchanged.

For an already loaded broken version 2, [`database/demo_uuid_repair.sql`](../database/demo_uuid_repair.sql) repairs owned identities and their references in place after `SET demo.allow_uuid_repair = 'yes';` on the same connection. It preserves readable codes, names, notes, amounts, dates, receipt numbers, media and existing original records. It refuses affected protected artifacts instead of disabling their guards. Back up the selected local database before running it. After a repair, reopen records from a refreshed catalog or list: previously opened URLs contain the old IDs.

`node --import tsx scripts/demo-uuid-repair.integration.mjs` checks the archived broken load, actual API-schema failure, in-place repair, exact inverse-mapped row preservation, original data and receipt sequence preservation, precise restoration of FK definitions, later/composite/self references, typed classroom identities, late-failure rollback and repeat-load no-ops. Affected immutable certificates, previews, sessions or historical exports stop the repair; unrelated historical exports remain byte-for-byte unchanged. Temporary FK deferral is validated and restored in the same transaction; no guard or trigger is disabled.

## What the data looks like

| Visible field | Example |
| --- | --- |
| Program | Maestría Profesional en Ingeniería de Software |
| Program code | MAE-SIS |
| Cohort | MAE-SIS-2026-II |
| Student | Ana García Mendoza |
| Enrollment | EXP-MAE-SIS-2026-2-01 |
| Identification | EST-MAE-SIS-2026-2-01 |
| Payment reference | TRF-MAE-SIS-2026-2-01 |
| Module | Arquitectura de Software |

Names, codes, contact details and prices are synthetic. They are intended for presenting academic workflows; they do not establish an institutional offering or accreditation. The repository has no complete official career catalog. There are sixteen illustrative disciplines, with a master's and diploma per discipline; the loader also covers every program already in the selected database.

Medicine, Nursing, Dentistry, Public Health, Systems Engineering, Civil Engineering, Industrial Engineering, Agronomy, Veterinary Medicine, Law, Administration, Accounting, Education, Psychology, Communication and Economics each have relevant curriculum modules. Program hours and credits equal their curriculum totals. Module dates span the cohort duration, and current cohorts have grades only for modules already completed. Applicants have full names, readable unique references, plausible adult birth dates and previous degree metadata. Enrollment, payment allocations, accepted obligations and receipt snapshots remain linked consistently.

## Database coverage

The consolidated schema has 39 tables. Taxonomy leads to programs, curriculum components, cohorts and module schedules. Users link to academic staff or applicants. Applicants have previous degrees and enrollments; enrollments link to payment plans, accepted agreements, obligations, allocations and internal receipts, as well as grades, audit records, recognition requests and completion dossiers. Classroom records are local exchange proposals.

Existing academic definitions and curriculum are preserved. The user's photo/video request additionally permits filling missing media fields on the three original IT programs (`001-CCNA-NIC`, `CIB-SEG-1`, `PR-IA-REDES`); populated media fields are retained. No roles or permissions are broadened by the v2 loader. All generated user accounts remain inactive with unusable password hashes. Use an existing authorized administrator to present the data.

On an empty current schema, the dataset has 32 programs, 128 modules, 96 cohorts, 1,920 students/enrollments, 3,584 grades, 1,184 payments and 640 completion dossiers. Each existing program adds three example cohorts and sixty enrollments; grade quantities depend on its actual curriculum and duration.

Actual identity scans, CVs, institutional approvals, research PDFs, issued certificates, sessions and upload/export histories are not fabricated. Paths under `/demo/no-documento/` are explicit document placeholders. Completed students remain `EGRESADO`, awaiting an authorized issuance workflow. Photos and videos are real media references; they are not placeholders or claims that the educational video belongs to the institution.

## Photos and videos

[`database/demo_media.json`](../database/demo_media.json) records the subject-specific cover/video assignments and provenance. [`docs/demo-media-sources.md`](demo-media-sources.md) records sources, licenses and verification evidence. The portal supports YouTube links through its existing video player. Videos remain educational references hosted by their publishers; do not represent them as institutional promotional recordings.

Run `node scripts/cache-demo-media.mjs` before loading on a fresh checkout. It retrieves the declared public cover sources into `/uploads/programas/demo-v2-*`, validates JPEG/PNG signatures and reuses valid existing files. `--help` documents this command. The 19 local covers represent 14 distinct source images and are served by the API's existing public program-image route; no authentication guard changes are needed. Upload files remain excluded from Git, so retain or rebuild this cache when moving the database. All 18 distinct video IDs were verified using publisher oEmbed metadata; their availability remains subject to the publishers.

## Replacing version 1 safely

1. Select the intended local demonstration database and retain a private current backup. Do not restore an old whole-database snapshot over unrelated later work.
2. Run [`database/demo_bulk_rollback.sql`](../database/demo_bulk_rollback.sql) with `SET demo.allow_remove = 'yes';` on the same connection. This removes only deterministic v1 fixture IDs, in dependency order. It retains existing original records, shared roles and the previously approved certificate migration. Unknown dependent rows stop the operation atomically, including dependencies that could otherwise cascade or be set to null. It never deletes arbitrary rows merely because a display code starts with DEMO.
3. Run `database/demo_bulk_load.sql` with `SET demo.allow_seed = 'yes';` on the same connection. The file refuses to mix with the old UUID-labelled v1 cohorts. For a combined atomic replacement, one caller transaction must enclose both SQL bodies after removing only their outer BEGIN/COMMIT lines; on any error roll back the entire replacement.
4. Review the resulting program/cohort/enrollment summary. Reload the application selectors to see the new labels. Dates are relative to the initial load for each deterministic row; repeated loads do not refresh existing rows or create duplicates.

For a new empty database only, initialize with `database/schema.sql`; do not replay that schema or the security seed over an existing database. Existing databases need their normal additive migrations, including academic billing, billing payments, certificate registry and classroom proposals. The previous explicitly authorized certificate migration remains in place.

A standalone load using psql accepts explicit demo connection arguments and an interactive password prompt or the normal local credential mechanism:

```sh
psql -X -v ON_ERROR_STOP=1 -h DEMO_HOST -p DEMO_PORT -U DEMO_USER -d DEMO_DATABASE \
  -c "SET demo.allow_seed = 'yes'" -f database/demo_bulk_load.sql
```

## Verification and recovery

`node --import tsx scripts/demo-bulk-load.integration.mjs` tests the actual v2 SQL, readable display references, subject-specific media presence, curriculum/timeline consistency, financial and grade invariants, receipt rendering, row/sequence preservation on fresh/shared connections, existing-program preservation and complete rollback on failure. The test first reproduced the user's v1 issue with all 96 synthetic cohort labels failing the readability assertion.

`node scripts/demo-bulk-rollback.integration.mjs` tests exact v1 removal using the archived original loader, preservation of original/later records, refusal without opt-in, unknown dependency rejection with unchanged table hashes, silent cascade/SET NULL protection, changed payment-plan protection and repeated no-op rollback.

Both runners use only cached disposable network-disabled PostgreSQL 16 containers, expose no host port, never read `.env`, never pull images and remove their owned containers/volumes. Runtime dependencies must already be present. Actual local replacement is separately authorized and verified with original-row/field preservation checks and a current private backup. The feature log is `odd/tasks/demo-bulk-load.md`. Native Gentle AI review and the Engram mirror remain unavailable; no native approval receipt is claimed.

## Completed local replacement — 2026-10-30

Version 1 was removed by its exact fixture identifiers and version 2 loaded in one committed transaction on `posgrado_setec_db` local. The operation removed 34,035 old fixture rows and preserved all 229 unrelated current rows. Independent verification also confirmed all 225 original pre-load row hashes across 37 tables. Existing original program media were already populated, so no original field values changed.

All 35 programs are covered by 105 readable example cohorts and 2,100 generated enrollments. Actual database totals are 107 cohorts, 2,106 applicants, 2,105 enrollments, 3,737 grades and 1,301 payments. No old UUID-style cohort labels remain. All 35 programs have image/video values; the 32 new offerings use the verified manifest. All 19 cached public covers returned HTTP200 with image MIME from the running local API, and the public catalog returned200 with the new records. Refresh the application to discard previously fetched selector data.

The private pre-replacement backup is `.demo-replacement-backups-BUUCYx/before-replacement.dump`, SHA256 `a41bcd473393a51fdda8e6db836da78083e07c957d11787b004eb20ec29c2caa`. Browser playback and a full browser journey were not repeated; source metadata, publisher oEmbed, local image files, public image responses and database integrity were checked. Full app tests/build were not rerun because application source is unchanged; their earlier 143-test/build evidence remains applicable.
