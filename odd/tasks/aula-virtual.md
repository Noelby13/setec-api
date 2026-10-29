# Aula Virtual / Moodle file exchange
Objective: implement the user's approved Moodle plan. Branch: feat/aula-virtual (API and admin repos); runner: npm test, npm run build, isolated PostgreSQL integration.
Delivery: single-pr (explicit user choice); forecast 1,500–2,500 authored lines across API and UI; no remote operations. Engram mirror pending: provider unavailable. Baselines: API a353a867f6e317cfdecdada103c6e2a995ed7a54; UI 84ebcadd18c2ee7ac4d5db81e26985be8e1c95bf.

## Specs
S1. "Un curso Moodle por **componente y cohorte**." "Intercambio inicial mediante archivos." "Estudiantes con estado **MATRICULADO_ACTIVO**, sin añadir otro filtro financiero." Implement program/cohort/component selection and manual generation. S8 supersedes the former upcoming-date default with cohort lifecycle states.
S2. "Excel | Hojas `Usuarios` y `Cursos`, siguiendo las columnas de las capturas." "`usuarios.csv` | `username, firstname, lastname, email, course1, role1…`, ampliando los pares para cada curso seleccionado." "`cursos.csv` | `shortname, fullname, summary`, más la categoría requerida para la carga estándar." Preserve accents; unique stable course/account mappings; validate before generation; one row per account; audit generated batches without claiming Moodle ingestion.
S3. "Mantener una vinculación estable entre cada persona y su `username` Moodle." "Reutilizar cuentas existentes verificadas; solicitar completar la vinculación cuando falte, sin generar usuarios a partir del nombre ni del expediente." "Bloquear la generación cuando falten nombres, apellidos, correo, docente, categoría o identificadores necesarios, o existan conflictos." Configure category and teacher role; do not export passwords.
S4. "Retorno de la **nota final del componente**, con revisión previa y cierre de actas separado." XLSX/CSV upload with selectable username/final-grade columns; preview new/unchanged/change/error rows; 0–100 only, no implicit scale conversion or name matching; preserve existing academic grading rules and self/peer evaluation fields.
S5. "Tratar una nota idéntica como un registro sin cambios; exigir motivo para reemplazar una nota diferente." "Guardar archivo de origen, responsable, lote e historial anterior/nuevo de cada corrección." "Revalidar al confirmar y guardar el lote completo en una transacción; los errores deberán resolverse antes de aplicarlo." Respect permissions, teaching assignment, closed schedules, actor-owned previews and changes since preview. Retain original source privately. Preserve SNEPA API behavior.
S6. "Por afectar notas persistidas y permisos, la implementación tendrá verificación independiente después de sus propias pruebas." Test cross-cohort isolation, active-only eligibility, multi-course accounts, invalid/missing identities, exported headers and accents, import variants, authorization, closed/stale previews, audit and existing SNEPA regression; integration in isolated state only.

S7. "toda esa informacion que me pedis despues de dar revisar selecciones, el sistema ya deberia proponorlo, pero el usuario lo lee y tambien puede cambiarlo si algo no esta bien, pero ya deberia estar lleno o sugerido". New accepted requirement: prefill actual editable values for course shortname/fullname/summary/category/teacher role and person first/last/email/username; preserve confirmed mappings; proposals require explicit review/save, with a bulk reviewed-save action. Source missing real email stays visibly missing; no invented identities/contact addresses. Per-integration overrides persist and exports use reviewed stored values without modifying academic/person masters. Existing grade import contracts and legacy-code stability remain.

S8. User correction, verbatim: "no se que fue lo que hiciste pero es aqui donde me refiero que se llenara, pero todo de manera automatica, tambien no se para que sirve eso de retorno de nota final, acuerdate que tenemos todo un modulo sobre guardar nota proveniente de un excel. Tambien no entendi lo de buscar por fecha, considera el siguiente flujo, se abren el posgrado de IA, el estado de la cohorte es inscripcion, cuando se llena, pasa a quorum alcazado cobrando, luego se pone en ejecuccion. No tiene sentido buscar por fecha." Deliver S7 autofill in primary running checkouts, replace date search with cohort lifecycle filtering, and centralize Excel grade uploads in the existing Notas module; do not duplicate grade upload forms in Aula Virtual.

### Cohort workflow and unified notes (S8 supersedes date-oriented UI)
- Default `/virtual-classroom/candidates` uses the operational states INSCRIPCION_ABIERTA, QUORUM_ALCANZADO_COBRANDO, EN_EJECUCION; no implicit dates. Add optional `estado_cohorte` using existing enum. Return state in cohorts and schedule rows. UI selects program/cohort/state, shows friendly labels and removes Desde/Hasta inputs, 30-day copy and date query parameters. Dates remain informative only. Do not change real cohort states/transitions or financial/student eligibility rules. No new hard export restriction by cohort state beyond selection default.
- Preserve explicit legacy API `from`/`to` filters and their prior date-window semantics/errors when caller supplies either; no implicit operational-state restriction on that legacy path unless estado_cohorte explicitly supplied. New UI never sends those dates. State filter validation and docente assignment scope remain enforced.
- Aula Virtual contains export preparation/history and a permission-aware in-app link to `/notas`; no separate Retorno de nota final upload panel. Preserve selected cohort/component through existing Notas query keys `cohorte` and `programacion` where available, optional `origen=moodle` selects format. Keep existing navigation permissions, provide useful Notas shortcut to grade-only users rather than an empty page.
- Existing `/notas` remains the only grade upload workspace. Its current Importar acta Excel workflow keeps SNEPA as default unchanged. Add a source/format selector there to switch to Moodle Excel/CSV using the already-tested preview/confirm adapter and SAME selected component, no second cohort/component selector. Reuse/extract existing Moodle form into `features/grades/MoodleGradeImport.jsx`. All previous grade safeguards, source retention and callbacks remain. Do not delete or rewrite the existing SNEPA importer/backend contracts.
- On successful Moodle import refresh existing grades and lot/history resources. Handle its private source marker without rendering unsupported/broken file-download links; keep existing SNEPA links working. Preserve import/modification permissions, closed-acta blocking, stale-preview rejection and file/column invalidation. Update user-facing explanation to plain Spanish and avoid misleading text that bulk imports never audit when Moodle corrections do.
- Delivery continues on existing feature branches, single-pr choice retained. Pending proposals candidate APIc82cbdd/UI35bb505 must be merged only after its scoped recheck and additive proposal columns applied to the confirmed local database. Subsequent S8 change uses separate tracked work units and independent verification. No background publication or remote Moodle calls.

### Editable proposal contract (S7, supersedes blank defaults)
- Preview GET/POST routes unchanged. `courses` add `confirmed:boolean`; populate course values from saved mapping, otherwise authoritative legacy shortname or deterministic component+cohort+schedule code, fullname/summary from source, most recent saved same-program category/teacher_role, otherwise editable category ID `1` and role `teacher` from supplied template. Explain unconfirmed default category/role need review against Moodle. New generated course candidates check global current/legacy ownership; saved/legacy values never silently renamed.
- `people` existing firstname/lastname/email/username now contain actual editable proposals. Prefer saved mapping overrides/verified username, then linked source account username; else valid normalized email local-part; if unavailable or colliding use stable `pep.<person-type>.<32hex-person-id>` candidate (no names or expediente). Check candidates against local mapped/linked account ownership and global eligible source identities; deduplicate linked people by canonical user key so proposals stay stable across selection subsets. Suggestions are not verified and do not write on preview. Real missing name/email must be completed explicitly. Data available from either linked user or source applicant/staff should be reused before reporting missing.
- Existing PUT account body `{username,verified:true}` optionally adds `firstname,lastname,email`; PUT course body `{shortname,category,teacher_role}` optionally adds `fullname,summary`. Omitted optional fields preserve prior overrides, not clear them. Validate optional fields and Moodle username; unique confirmed mappings still enforced by DB. Nullable integration-only override columns in additive `20261029_virtual_classroom_proposals.sql` and fresh schema. No master-data DML. Account names/email changes do not alter grade matching, actor/assignment/closed-acta checks.
- Unconfirmed complete course proposals produce review-required issue and remain unexportable until saved; verified mapping data remains ready. Teacher enrollment role matches displayed/saved course role. All edited values must reach PUT and subsequent generated files.
- UI values prefilled, never only placeholders; all export fields above editable. Clearly distinguish suggestions from approved mappings. Provide "Guardar propuestas revisadas" using existing PUTs sequentially, then refresh canonical preview on success. Validate before saving, including missing real data. Partial failure preserves drafts, shows error, and keeps export disabled pending successful fresh review; no transactional batch API implied. Individual save buttons may remain; preserve other drafts on row save and require fresh server review before generation. Disable export immediately on any unsaved edit; preview selection changes still invalidate. No browser drafts silently discarded on saving another row.

### Agreed implementation interface (parent decisions)
All JSON responses use `{ data: value }`; errors follow existing middleware. Prefix `/api/virtual-classroom`.
- GET `/candidates?from=YYYY-MM-DD&to=YYYY-MM-DD&programa_id=UUID&cohorte_id=UUID`: `{programs:[{id,nombre}],cohorts:[{id,programa_id,codigo_cohorte}],schedules:[{id,cohorte_id,programa_id,componente_nombre,codigo_cohorte,fecha_inicio,fecha_fin,docente_nombre,actas_notas_cerradas}]}`. Export admins use COHORTE_GESTIONAR; grades users use NOTA_IMPORTAR; docentes see only assigned schedules.
- POST `/exports/preview`, JSON `{schedule_ids:string[]}`: `{courses:[{schedule_id,shortname,fullname,summary,category,teacher_role,fecha_inicio,fecha_fin}],people:[{person_key,firstname,lastname,email,username,suggested_username,verified,kind,courses:[{schedule_id,role}]}],issues:[{code,message,person_key?,schedule_id?}]}`. Server derives authoritative rosters; unresolved existing linked usernames are suggestions requiring explicit confirmation. Person keys `user:UUID` where linked, otherwise `applicant:UUID` or `teacher:UUID`. Never match by name or assume email proves identity.
- PUT `/accounts/:personKey`, JSON `{username,verified:true}`; PUT `/courses/:scheduleId`, JSON `{shortname,category,teacher_role}`. Admin COHORTE_GESTIONAR only. Unique username and shortname enforced by DB; trim/validate Moodle identifiers. Mapping edits invalidate stale import confirmation where relevant.
- POST `/exports`, JSON `{schedule_ids,format:'xlsx'|'users_csv'|'courses_csv'}`: binary attachment; server rebuilds and validates before download, stores actor/timestamp/content snapshot. GET `/exports`: `{data:[...]}` most recent authorized batches. UI clearly states files generated, not synchronized.
- POST `/grades/:programacionComponenteId/preview`, multipart `archivo` plus optional `username_column`, `grade_column`: `{columns:string[],preview_id?:string,rows:[{row,username,student_name,expediente,current_grade,grade,status:'new'|'unchanged'|'change'|'error',error?}],issues:[{code,message}],can_confirm:boolean}`. If mappings absent, return columns and no confirmable preview; UI resubmits same file after selecting mappings. Store file and canonical preview server-side, bound to actor and schedule; do not trust browser rows.
- POST `/grades/:programacionComponenteId/confirm`, JSON `{preview_id,reason?}`: `{processed,unchanged,lot_id}`. NOTA_IMPORTAR and teaching assignment; NOTA_MODIFICAR additionally required for changed grades. Atomic schedule locking and fingerprint revalidation; conflict returns 409 and requires new preview. Unchanged import is idempotent. Source file retained privately, never public static uploads.
- No new dependency required; use installed ExcelJS. Dedicated SQL migration and fresh-schema inclusion. English technical identifiers/comments; product copy follows existing Spanish target context. No production DB writes, external Moodle calls, publishing, push or PR.

## Tasks
T1 | S1-S6 | delegated API writer | complete; B1-B5 independently rechecked PASS | reason: parallel API/UI units with disjoint repositories and edit surfaces; isolated worktrees based on mainline then fast-forwarded to existing feature baselines | commits 384692b2487ff7a1da4f15636f35c823d66737db + 7aa7418f86b8166eba1e9902088ab48215e7dbdc.
T2 | S1-S4,S6 | delegated UI writer | complete; independent contract verification PASS | reason: parallel API/UI units; same frozen interface | commit 81a942d433c953c3f3de775a1a5eadb3b01f2bca.
T3 | S1-S6 | independent verifier and parent seam check | complete: S1-S6 PASS within tested contract | reason: high-risk persistence/permissions/concurrency | verified API7aa7418 + UI81a942d; evidence docs/verification/virtual-classroom-evidence.json.

T4 | S1-S6 | inline local migration + independent read-only verification | complete: migration applied; history/selection queries PASS | reason: existing feature deployment repair; no writer delegation required | existing migration7aa7418 lineage; evidence docs/verification/virtual-classroom-evidence.json.

T5 | S2,S3,S7 | delegated API writer | complete: scoped independent B1 PASS | reason: parallel disjoint API/UI edit surfaces | commits eb913c7b0d02d59991e45c4aa90d530f7e6e8df1 + c82cbddec4a5d147510d1f84683ba45e96460d60.
T6 | S2,S3,S7 | delegated UI writer | complete: independent export/draft probes PASS | reason: parallel disjoint API/UI edit surfaces | commit35bb5054cb2caa862aa3fc929642dcab7486af77.
T7 | S1-S7 | independent verifier + local proposal migration | complete: S1-S7 PASS; primary sources and local columns updated | reason: persistence, permission and grade regression risks | APIc82cbdd/UI35bb505.

T8 | S1,S8 | delegated API writer | complete: independent PASS | reason: parallel state-query/API and UI/notes units with disjoint repositories | commit30c775356f2a6fe516ab63404651f43deab7aabd.
T9 | S4,S7,S8 | delegated UI writer | complete: independent PASS | reason: parallel lifecycle UI and unified notes integration | commite6172981db48e94d1ab9178fe309fa46607c503d.
T10 | S1-S8 | independent verifier and primary-checkout cutover | complete: S1-S8 PASS; actual local state/autofill query PASS | reason: academic workflow/grade import/persistence regression | verifiedAPI30c7753/UIe617298.

## Log
L1 (2026-10-29): User original implementation request, verbatim:

PLEASE IMPLEMENT THIS PLAN:
# Módulo Aula Virtual: intercambio con Moodle

## Diagnóstico y decisiones

El sistema ya dispone de programas, cohortes, componentes con fechas y docentes, matrículas e importación de notas. También tiene un campo para el código del aula externa, pero todavía no una integración con Moodle.

La estructura actual permite construir el módulo aprovechando esos datos:

- Un curso Moodle por **componente y cohorte**.
- Intercambio inicial mediante archivos.
- Estudiantes con estado **MATRICULADO_ACTIVO**, sin añadir otro filtro financiero.
- Retorno de la **nota final del componente**, con revisión previa y cierre de actas separado.

La programación existente está en [cohort.dao.ts](</Users/noel/Documents/SISTEMA PEP AUTONOMO/V1/POSGRADOSETECAPI/src/modules/cohorts/cohort.dao.ts:31>). El importador actual requiere expediente y calificación; necesitará una entrada específica para interpretar archivos de Moodle. Véase [grades.service.ts](</Users/noel/Documents/SISTEMA PEP AUTONOMO/V1/POSGRADOSETECAPI/src/modules/grades/grades.service.ts:163>).

## Generación de cursos y usuarios

Agregar **Aula Virtual** al panel administrativo, con selección de programa, cohorte y componentes. Mostrar fechas, docente, estudiantes elegibles y problemas pendientes antes de generar los archivos.

La descarga incluirá:

| Archivo | Contenido |
|---|---|
| Excel | Hojas `Usuarios` y `Cursos`, siguiendo las columnas de las capturas. |
| `usuarios.csv` | `username, firstname, lastname, email, course1, role1…`, ampliando los pares para cada curso seleccionado. |
| `cursos.csv` | `shortname, fullname, summary`, más la categoría requerida para la carga estándar. |

Moodle usa CSV para sus cargas masivas. Los cursos deben crearse antes de importar sus usuarios y matrículas. La categoría y los roles deben corresponder a la configuración de su instalación. [Cursos](https://docs.moodle.org/501/en/Upload_courses), [usuarios](https://docs.moodle.org/501/en/Upload_users).

El módulo deberá:

- Mantener un código Moodle único y estable por componente y cohorte; validar cualquier código externo existente antes de reutilizarlo.
- Mantener una vinculación estable entre cada persona y su `username` Moodle. Reutilizar cuentas existentes verificadas; solicitar completar la vinculación cuando falte, sin generar usuarios a partir del nombre ni del expediente.
- Consolidar una fila por cuenta, incluyendo sus cursos y roles correspondientes.
- Bloquear la generación cuando falten nombres, apellidos, correo, docente, categoría o identificadores necesarios, o existan conflictos.
- Registrar quién generó cada lote, cuándo y qué cursos y matrículas contenía. Generar un archivo no significará que Moodle ya lo haya procesado.

## Retorno de calificaciones

Agregar un flujo de importación de Excel o CSV exportado desde Moodle. Moodle permite exportar su libro de calificaciones a estos formatos. [Documentación de notas](https://docs.moodle.org/501/en/Grade_export).

El operador seleccionará el componente y cohorte, cargará el archivo e identificará las columnas de usuario y nota final. La vista previa mostrará estudiantes reconocidos, notas nuevas, cambios y errores.

La confirmación deberá:

- Resolver la cuenta Moodle hacia la matrícula correspondiente, sin emparejar por nombres.
- Aceptar notas numéricas de 0 a 100; señalar valores vacíos o escalas diferentes sin convertirlos automáticamente.
- Aplicar las reglas académicas actuales de valoración y aprobación.
- Respetar permisos, asignación docente y bloqueo por actas cerradas.
- Tratar una nota idéntica como un registro sin cambios; exigir motivo para reemplazar una nota diferente.
- Guardar archivo de origen, responsable, lote e historial anterior/nuevo de cada corrección.
- Revalidar al confirmar y guardar el lote completo en una transacción; los errores deberán resolverse antes de aplicarlo.

La importación no cerrará actas ni acreditará automáticamente autoevaluación o coevaluación.

## Cambios técnicos y comprobación

En la API se agregarán operaciones para consultar candidatos, mantener vinculaciones Moodle, previsualizar y descargar exportaciones, y previsualizar y confirmar notas. Se conservará el contrato del importador SNEPA existente.

La persistencia incorporará vinculaciones de cuentas y cursos, historial de exportaciones y procedencia de las notas importadas. La interfaz administrativa reutilizará los selectores y componentes existentes.

Las pruebas cubrirán:

- Separación del mismo componente entre distintas cohortes.
- Inclusión exclusiva de matrículas activas.
- Usuarios compartidos entre varios cursos, identificadores repetidos y datos incompletos.
- Encabezados, roles, tildes y correspondencia entre `courseN` y `shortname`.
- Notas nuevas, repetidas, corregidas, inválidas y estudiantes ajenos al componente.
- Permisos, actas cerradas y cambios ocurridos entre previsualización y confirmación.
- Conservación del comportamiento del importador SNEPA.

Por afectar notas persistidas y permisos, la implementación tendrá verificación independiente después de sus propias pruebas.

## Supuestos y validación con Moodle

- “Por iniciar” mostrará inicialmente los próximos 30 días, con fechas ajustables y generación manual.
- El encargado realizará la carga en Moodle y devolverá el archivo de notas; esta versión no tendrá API ni envío automático.
- Categoría, rol docente y vinculaciones de cuentas serán configurables, sin asumir que `teacher` concede los permisos deseados.
- Las capturas son referencias de formato. Antes del uso real se validará un lote pequeño con el encargado: crear un curso, matricular cuentas y devolver una nota hasta comprobarla en nuestro sistema.
- El análisis fue de solo lectura; no se modificaron archivos ni se ejecutaron pruebas.

L2: Implementation now authorized. All three repositories initially clean on feat/individual-grades. Dedicated feat/aula-virtual branches created; writers use isolated mainline-based worktrees fast-forwarded to baselines to retain existing grades. No matching registry, shared skill resolver, Engram or gentle-ai executable available; do not fabricate native review or mirror. Previously user authorized gpt-6-luna when gpt-6.1-luna was unavailable.

L3: User chose "Una sola entrega: conservar todo el módulo en una única rama y un futuro PR." Parent owns API client binary POST helper and its regression tests in UI worktree; writers retain original surfaces. Meaningful RED observed: three new export download tests failed on unmodified helper; existing attachment tests remained green.

L4: T1 API S1-S6 implemented at 384692b; HTTP RED 404 then 4/4 GREEN. Full npm test 137 passing; build passed; disposable PostgreSQL integration passed six groups including forced rollback. T2 UI implemented at 81a942d; navigation RED then focused5/full195/build passed. Browser desktop/mobile both passed on fresh port5197 after stale existing-server and exact-label fixture issues. Parent re-ran reported API focused4 and UI focused5: all passed. Surfaces reviewed: only authorized writer paths plus parent-owned client helper/tests. Native assessment/mode unavailable (gentle-ai command not found), risk high; independent verifier required. Engram mirror remains pending. Actual implementation commits total 2395 additions+deletions; user explicitly chose single-pr. No external writes or production migration.

L5: Independent verifier at frozen API384692b/UI81a942d reproduced five candidate-caused blockers: B1 course PUT validates wrong parameter name; B2 ExcelJS CSV coercion changes numeric usernames; B3 existing null-grade row causes audit NOT NULL error; B4 preview rows/fingerprint snapshot race silently skips desired grade; B5 legacy external course-code collisions ignored. Original focused/integration tests passed, baseline/candidate existing SNEPA tests14 each passed. Scratch probes at /private/tmp/aula-verify.gQNP0b. One complete correction batch authorized to satisfy existing S1-S6, followed by one blocker-scoped recheck; no scope expansion. Risk items1,2,4. Native review remains unavailable, Engram mirror pending.

L6: One correction batch implemented B1-B5 with committed regression coverage. Writer observed HTTP/CSV RED then focused5/full138/build GREEN; disposable PG passed first-grade-null audit, real snapshot race rejection, global legacy ownership, original rollback/idempotence/flags/permissions. Parent re-ran focused5 and git diff --check: passed. Correction source commit recorded by next status; independent scoped recheck pending.

L7: Independent scoped recheck PASS B1-B5 at API7aa7418/UI81a942d. S1-S6 PASS within tested contract. Exact corrected archive: focused5 passed; disposable PG independent augmented regression passed, real race interleaving proved and rejected confirmation hash unchanged across grades/audit/lots/all previews. No reported blocker remains. Full suites API138/UI195, builds both passed; browser2 desktop/mobile passed on fresh local server. Existing SNEPA baseline/candidate14 each passed. No repeated full review after correction. Native Gentle AI receipt unavailable (executable absent); independent functional verification completed. Engram mirror pending (provider unavailable). Deployment tasks: apply additive migration explicitly to intended installation; perform small real Moodle exchange with administrator to validate instance category/roles/auth/headers. No production migration, remote transfer, push or PR performed. Risk: items1,2,4. L4 arithmetic correction: initial work-unit changes2401 additions+deletions; correction204; total2605 authored source/test/doc changes before tracking/evidence documentation.

L8 (2026-10-29): User reported "nhandled Application Error: error: relation \"virtual_classroom_exports\" does not exist" and ", al dar el boton revisar seleccion,". Read-only query against configured local database reproduced all four virtual_classroom relations missing. Sandbox denied default local socket access; authorized read-only escalation succeeded. Scope: apply existing additive 20261029 migration transactionally to this confirmed local database, validate relations and DAO queries; no remote operation, no business row changes, no automatic startup migration or exception suppression. Independent schema verification required after own checks.

L9: Applied existing additive migration20261029 to the confirmed configured local API database in one committed transaction. All4 tables now present. Parent own checks: original DAO history query and service preview selection passed, actual preview1course/2people returned expected missing configuration/account/email issues. Independent read-only verification PASS:4tables,20constraints,4namedindexes valid/ready,8CREATE statements only, read-only mode confirmed and history/selection queries succeeded. No business rows modified and no production source changes; browser/export/grade-write tests not repeated because this repair only applied the existing tested schema. Native review/Engram remain unavailable. Risk:item1(schema migration).

L10 (2026-10-29), user verbatim: toda esa informacion que me pedis despues de dar revisar selecciones, el sistema ya deberia proponorlo, pero el usuario lo lee y tambien puede cambiarlo si algo no esta bien, pero ya deberia estar lleno o sugerido
L11: Read-only mapping confirmed blank course defaults, username suggestions only in placeholder, static person names/email, and mapping PUTs only save subset. S7 adds actual editable proposed values and integration-only overrides, explicit reviewed bulk-save, no fake missing email, no automatic Moodle-account creation or master-data edits. Existing S3 authorization/legacy identity and S4-S5 grade protections preserved. Forecast extra900-1500lines; cached user delivery choice single-pr applies. API baseline d1473be; UI81a942d. Native review and Engram unavailable as before.

L12: APIeb913c7/UI35bb505 implement S7 optional overrides/proposals and reviewed-save. Parent bounded spotcheck found account controller body forwarding, linkedusername priority, readablecoursecode, teacherroleconsistency and storedidentity preservation gaps; writer fixed them in one self-review batch with regressions. Actual final APIfocused8/full141/build/isolatedPG passed (initial report140 was stale; final-byte rerun141). UIfocused8/full198/build/browserdesktop+mobile2 passed. Parent reranfocused8each/diffcheck passed. Independent verifier now audits frozen commits in scratch only; original configured local DB and primary sources not yet updated to newcolumns/code. Native review/Engram remain unavailable.

L13: Independent frozen APIeb913c7/UI35bb505 audit: S1-S6 regression probes passed; edited data persisted through realHTTP and actualCSV, oldoptionalPUTs preservedfields, masterhashunchanged, rejectedwritehashunchanged, UIrowdraftpreservation passed. One S7blocker: unlinked people with common@domain0.test/common@domain1.test eachalone proposedcommon but together onechanges toopaque due selected-onlyreservation. Exactbaseline probe wasblank forboth; candidatecaused. One bounded correctionbatch will resolve proposalownership globallyindependentofselection, preserving confirmed/linkedidentities; commit regression subset/order/save stability then single scopedrecheck.

L14 (2026-10-29), user verbatim: no se que fue lo que hiciste pero es aqui donde me refiero que se llenara, pero todo de manera automatica, tambien no se para que sirve eso de retorno de nota final, acuerdate que tenemos todo un modulo sobre guardar nota proveniente de un excel. Tambien no entendi lo de buscar por fecha, considera el siguiente flujo, se abren el posgrado de IA, el estado de la cohorte es inscripcion, cuando se llena, pasa a quorum alcazado cobrando, luego se pone en ejecuccion. No tiene sentido buscar por fecha.
L15: Attached screenshots show original UI still active because proposals were not yet merged; acknowledged plainly to user. Existing cohort enum confirms three lifecycle codes, and existing /notas has SNEPA Excel import and deep links cohorte/programacion. S8 accepted: operational-state selection, no date UI, one Notes import workspace with SNEPA default and existing Moodle adapter selectable. S7 remains and will be deployed first after immutable scoped recheck. No change to actual cohort transitions, payments or active enrollment policy.

L16: Fresh independent rechecker archived exact baselineeb913c7/correctedc82 and reproduced then cleared B1 via realPG single/subset/reverse/afterconfirm probes. S1-S7 other probes had already passed. Earlier recheck remained pending_init and was cancelled beforedispatch; fresh bounded rechecker succeeded. CorrectedfinalAPIfocused9/full142/build/isolatedPG passed, UIfull198/build/browser2 passed; parentfocused9 passed. Applied frozenproposal migration transactionally to confirmed LOCAL API database, verified5newcolumns, merged exactAPIc82 andUI35 into primaryfeat/aula-virtual checkouts so S7 actually visible. Globalidentity lookup was deduplicated bycanonicaluserkey. Source contactdata that neverexisted remainsmissing, nofakeemails or masterDML. S8 implementation pending nextunits.

L17: T8 APIdefault candidates now threeoperationalstates, optionalexplicitstate+returnedmetadata, datesonlywhenlegacycallerexplicitlyrequests; unchangedteacherassignment andactivestudentpolicy. API142/fullbuild/disposablePG operationalstates/nullpastfuture/exactstate/legacy passed. T9 removesdateUIandduplicateAula gradepanel, reusesMoodleadapterunderexistingNotas selectedcomponent withSNEPAdefault/sourcechoice and format/fileinvalidations. UI27focused/203full/build/browser4 passed. Parent reranfocusedAPI9/UI27anddiffchecks passed. Browserfixture initiallyreturnedobjects forarrayNotesresources, fixedfixtureonly; retained actualclick->Notes component/format/pathassertions. Native receipt/Engram unavailable. Independent candidate verification pending before finalS8merge.

L18: Final independent exact-archive verification PASS S1-S8, no candidate-caused blockers. Actual independent results: API9focused, PostgreSQL13groups, UI27focused, browser4desktop/mobile onfresh5203, deferred format/schedule publicUI probes19(17existing+2new) passed. WriterfullAPI142/UIfull203/buildsbothpassed reused; no unnecessary broaderrepeat. Source baseline/context guards unchanged. Merged exactAPI30c7753/UIe617298 into primaryfeat/aula-virtual. Final LOCAL read-only check WITHOUTDATES returned1program/1cohort/1schedule, stateINSCRIPCION_ABIERTA, allcoursefieldsfilled/allusernamesfilled,1actualmissingemail. No originalmasterdata/notes changed by migration or validation. S7newcolumns alreadyapplied before codecutover, preserving previousmigrationrepair. RealMoodlepilot and Engrammirror remainpending; native receipt unavailable; no push/PR/remote transfer. Risk:item1(additive integration data) and scopednote-workflow regression covered independently.
