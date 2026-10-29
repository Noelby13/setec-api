# Aula Virtual / Moodle file exchange
Objective: implement the user's approved Moodle plan. Branch: feat/aula-virtual (API and admin repos); runner: npm test, npm run build, isolated PostgreSQL integration.
Delivery: single-pr (explicit user choice); forecast 1,500–2,500 authored lines across API and UI; no remote operations. Engram mirror pending: provider unavailable. Baselines: API a353a867f6e317cfdecdada103c6e2a995ed7a54; UI 84ebcadd18c2ee7ac4d5db81e26985be8e1c95bf.

## Specs
S1. "Un curso Moodle por **componente y cohorte**." "Intercambio inicial mediante archivos." "Estudiantes con estado **MATRICULADO_ACTIVO**, sin añadir otro filtro financiero." Implement program/cohort/component selection, configurable upcoming 30-day window and manual generation.
S2. "Excel | Hojas `Usuarios` y `Cursos`, siguiendo las columnas de las capturas." "`usuarios.csv` | `username, firstname, lastname, email, course1, role1…`, ampliando los pares para cada curso seleccionado." "`cursos.csv` | `shortname, fullname, summary`, más la categoría requerida para la carga estándar." Preserve accents; unique stable course/account mappings; validate before generation; one row per account; audit generated batches without claiming Moodle ingestion.
S3. "Mantener una vinculación estable entre cada persona y su `username` Moodle." "Reutilizar cuentas existentes verificadas; solicitar completar la vinculación cuando falte, sin generar usuarios a partir del nombre ni del expediente." "Bloquear la generación cuando falten nombres, apellidos, correo, docente, categoría o identificadores necesarios, o existan conflictos." Configure category and teacher role; do not export passwords.
S4. "Retorno de la **nota final del componente**, con revisión previa y cierre de actas separado." XLSX/CSV upload with selectable username/final-grade columns; preview new/unchanged/change/error rows; 0–100 only, no implicit scale conversion or name matching; preserve existing academic grading rules and self/peer evaluation fields.
S5. "Tratar una nota idéntica como un registro sin cambios; exigir motivo para reemplazar una nota diferente." "Guardar archivo de origen, responsable, lote e historial anterior/nuevo de cada corrección." "Revalidar al confirmar y guardar el lote completo en una transacción; los errores deberán resolverse antes de aplicarlo." Respect permissions, teaching assignment, closed schedules, actor-owned previews and changes since preview. Retain original source privately. Preserve SNEPA API behavior.
S6. "Por afectar notas persistidas y permisos, la implementación tendrá verificación independiente después de sus propias pruebas." Test cross-cohort isolation, active-only eligibility, multi-course accounts, invalid/missing identities, exported headers and accents, import variants, authorization, closed/stale previews, audit and existing SNEPA regression; integration in isolated state only.

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
