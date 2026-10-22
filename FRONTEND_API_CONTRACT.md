# Contrato de integración Frontend — API SNEPA/SETEC

Original snapshot inspected 2026-10-20; updated incrementally on 2026-10-21. Entrega complementaria: `frontend-types.ts`. Las rutas y validaciones del código prevalecen sobre comentarios o Swagger. See the update section for the implemented backend changes.

## Update — 2026-10-21: integrated student and administrative flows

This section supersedes older snapshot statements below. The canonical contract and types live in POSGRADOSETECAPI; frontends retain byte-identical copies. Run `npm run contracts:check` or explicitly synchronize with `npm run contracts:sync` from the API repository.

### Identity and user management additions

All JSON responses retain `{success,message?,data}`. No password hashes or signing secrets are returned.

| Method / path | Authority | Body or query | `data` |
| --- | --- | --- | --- |
| POST `/api/auth/register` | Public, strict student-only role | email, password, nombres, apellidos; optional username, telefono | Student profile, no tokens; login separately |
| PATCH `/api/auth/profile` | Current account | Partial email, username, nombres, apellidos, telefono | Updated profile |
| GET `/api/users` | USUARIO_GESTIONAR or SUPER_ADMIN | search, rol (exact role name), page (default 1), limit (default 20, max 100) | `{items,total,page,limit}` |
| GET `/api/users/roles` | Same | None | Roles assignable within current authority, including their permissions |
| POST `/api/users` | Same | Registration fields plus rolId, optional activo | Safe managed user including rol_id |
| PATCH `/api/users/:id` | Same | Partial account fields plus rolId, activo | Updated safe managed user |
| GET `/api/enrollments/cashier` | PAGO_VALIDAR or SUPER_ADMIN | search, programa_id, cohorte_id, aspirante_id, estado, page, limit | Cashier-safe rows; top-level pagination |

Registration rejects all unknown fields, including rolId, role, permissions, activo and email_verificado. Passwords have at least eight characters and at most 72 UTF-8 bytes for bcrypt. Duplicate email/username returns 409, including database uniqueness races. Student role must already exist; a missing role/configuration returns 503 without creating an account. Administrative role assignment requires a current permission subset; own role/status changes and administrative modification of SUPER_ADMIN accounts are denied. Profile email edits clear email verification.

JWT access tokens now carry a session `sid`. Every protected request checks that session, account activity and current role permissions in the database. Pre-increment access tokens require a new login. Login and refresh response shapes are preserved. Signing keys must be explicitly configured, nonempty and distinct: JWT_SECRET and JWT_REFRESH_SECRET. Missing/invalid configuration returns 503. Logout using a refresh token still works; bearer-only logout is now authenticated and revokes its bound session. Refresh consumption is atomic, so simultaneous reuse cannot create two replacement sessions.

### Ownership, applications and cashier boundaries

Applicant/degree reads and updates, enrollment details, payment/convalidation operations, own grades, graduation dossier reads and scientific publications check ownership or the specific administrative permission. Self applicant creation binds usuario_id to the current account and cannot target another user. Enrollment creation resolves the student's applicant; another aspirante_id is denied. Administrative comments and leveling decisions require admission permission.

`GET /api/enrollments` and the cashier collection accept the additive UUID filter `programa_id`; existing cohort, applicant, state, search and pagination filters are preserved. Editing a prior degree through `PUT /api/applicants/degrees/:degreeId` returns changed evidence to `estado_validacion=PENDIENTE`; the student cannot retain or assign an administrative validation.

Only `INSCRIPCION_ABIERTA` accepts a new application; the cohort row is locked inside the existing transaction. Duplicate applicant/cohort remains 409. The initial outcome is documentary review, committee review or waiting list according to existing rules; it does not imply admission, payment or matriculation. Existing documentary quorum and payment transitions are retained.

Documentary `aprobado` accepts JSON booleans and recognized multipart strings true/false/1/0. Malformed values return 400 before any decision; omission retains the existing true default.

Document decisions now recheck locked enrollment state after acquiring the cohort lock. Only `EN_REVISION_DOCUMENTAL` and `DOCUMENTACION_OBSERVADA` are documentary-decision states; observations cannot reset reserved, paid, active, withdrawn or completed records. Already-approved positive decisions retain their previous 400 error; unsupported transitions return 409 without writes. Approval respects existing maximum capacity. Committee resolution and waiting-list promotion are not substituted by documentary validation. `CANCELADA`, `FINALIZADA_PENDIENTE_EVAL` and `EVALUADA_SETEC` cohorts reject documentary/payment mutations with 409.

Payment registration requires the applicant's recorded documentary approval as well as enabled cohort collection and the existing eligible states. Decisions lock cohort→enrollment→receipt and allow a pending receipt only once; stale decisions retain 400. A pending receipt cannot reactivate withdrawn, egreso or certified records (409). Rejecting an additional pending receipt leaves an already active matriculation and its date unchanged. Documentary/quorum rules and payment response envelopes are preserved. The Academic billing extension below adds exact-money plans, accepted obligations, allocation and internal receipts; payment approval no longer activates matriculation.

Cashier discovery has the same top-level pagination envelope as `/enrollments` but exposes only record ID/code, state, student name, program/cohort, recorded cohort prices, collection-enabled flag and quorum counts. Cashier-only detail keeps `{inscripcion,pagos,convalidaciones:[]}` while redacting identity documents, contact data, degrees and admission details. New cashier seed defaults grant only PAGO_VALIDAR. The optional `database/migrations/20261021_cashier_permissions.sql` removes the legacy default admission grant on an existing database; it has NOT been applied. Explicit additional privileges remain effective. Do not rerun the full schema or seed on existing data to apply this change.

### Complete own history and teaching scope

`GET /api/enrollments/me?page=1&limit=100` now supports positive page and limit 1–100 (defaults 1/100). Only these two query fields are accepted; aspirante_id cannot override ownership. Existing `data` and `total` remain, with additive `pagination:{total,page,limit,totalPages}`. Frontends must load all pages or explicitly report incomplete history; the student portal rejects partial/duplicate/stalled responses rather than claiming complete counts.

`GET /api/cohorts/teaching/me` returns only programmed components linked through `personal_academico.usuario_id` to the current account. Its safe rows include component/program/cohort names and IDs, recorded dates, schedule, room and closed-act status. Teacher dashboards and the grades selector consume these assigned activities. `NOTA_IMPORTAR` does not authorize a DOCENTE to another teacher's component: imports, class grades and import history check assignment. Grade-log/manual-change scope and uploaded whole-class acts are restricted likewise; a teacher cannot query another student's entire program transcript. Existing coordinator/administrator permissions are retained.

### Documents and academic verification

Only promotional `/uploads/programas/` and `/uploads/silabos/` assets remain public. Other uploads require Bearer plus ownership or the corresponding resource permission; unlinked files fail closed. Self-service attachment references must be freshly uploaded or already authorized; assigning another account’s URL is rejected before changing the record. Fetch private files as authenticated blobs, not unauthenticated anchors; never forward tokens to external document URLs. Both frontends implement authorized local downloads.

The public graduation verification response excludes identification type/number and private document URLs. Student name, program, cohort, issue date, document type and institutional code remain. Generated new codes use 128 random bits. Existing official codes remain unchanged. The DAO now uses `sedes_ies.nombre`; grade projections alias existing `nombre`, `codigo`, `creditos`, `orden_bloque` into the established transport field names. Applicant interest `area_codigo` is null because that column does not exist, rather than a fabricated value.

The implementation gates fresh issuance on the existing `EGRESADO` state and an existing locally uploaded institutional PDF (confined path and PDF header verified), in addition to prior language/publication checks. Matriculation alone returns 409. This is an implementation safeguard, not a newly established academic norm: the institution still owns the criteria and authorized process for recording EGRESADO. No arbitrary state-transition endpoint, official PDF generator, signature design or recovery email delivery is introduced.

### Digital certificate registry — current additive contract

Mount: `/api/certificates`. All responses set `Cache-Control: no-store`. JSON endpoints use `{success:true,data}`; collections additionally expose top-level `total` and `pagination:{total,page,limit,totalPages}`. The download is PDF bytes with attachment headers, not a JSON envelope. UUID path parameters are validated. Certificate administration means `TITULO_EMITIR` **or** `CERTIFICADO_REVOCAR`, with the existing `SUPER_ADMIN` override; register and revoke each require their specific permission.

| Method / path | Authority | Input | Response |
| --- | --- | --- | --- |
| GET `/api/certificates/verify/:token` | Public | Random public UUID token | Minimal public verification view; unknown token 404, malformed UUID 400 |
| GET `/api/certificates/me` | Current owner | Only page/limit; defaults 1/20, limit 1–100, page 1–100000 | Own certificate collection, including revocations |
| GET `/api/certificates` | Certificate administration | page/limit plus optional search (max150), estado VIGENTE/REVOCADO | Administrative certificate collection |
| GET `/api/certificates/:id/download` | Owner or certificate administration | Certificate UUID | Existing PDF attachment; inaccessible/missing record 404 |
| GET `/api/certificates/:id/events` | Certificate administration | Certificate UUID | `[{id,accion,fecha,actor_id,motivo}]` ordered events |
| POST `/api/certificates/expediente/:id/register` | TITULO_EMITIR | Empty strict JSON object `{}`; id is graduation dossier UUID | 201 certificate view; explicitly registers an already issued local institutional PDF |
| POST `/api/certificates/:id/revoke` | CERTIFICADO_REVOCAR | Strict `{motivo:string}` trim, 1–1000 characters | Certificate view with REVOCADO, no download; repeat revocation 409 |

`CertificatePublicView = {token_publico,estado,titular_nombre,programa_nombre,cohorte_codigo,tipo_documento,fecha_emision,fecha_revocacion}`. Public verification adds `integridad_verificada`; it is true only for a VIGENTE record whose stored PDF passes its SHA-256 comparison. A revoked record remains publicly identifiable with `integridad_verificada:false`; missing or altered current PDFs return 409. No identification numbers, contacts, payment data, private file paths, document hash, revocation reason or actor ID are public.

Protected certificate views add only `id`, `expediente_id`, `puede_descargar`. A list can still show a valid-state record with `puede_descargar:false` when its file is unavailable or fails integrity. The download rechecks ownership/administration, VIGENTE and SHA-256; revocation, missing PDF or mismatch returns 409. Existing authenticated upload-file access likewise blocks downloads of registered revoked or altered certificate documents. Verification establishes registry/file integrity; it is not a digital signature or a new academic determination.

Fresh graduation issuance writes the dossier, a linked registry snapshot and an EMITIDO audit event in the same transaction. Explicit legacy registration writes REGISTRADO and refuses dossiers lacking an actual issued document (409), duplicate registry associations (409), or unusable PDFs (400). Revocation records actor, timestamp and required reason plus a REVOCADO event atomically. There is no update/delete/reissue endpoint for a certificate snapshot, and no automatic registration of historic records.

`certificados_registro` stores the random token, owner link, immutable recipient/program/cohort/document-type/issue-date snapshot, local PDF reference and SHA-256. A database trigger preserves snapshot bytes and prevents changes after revocation. `certificados_eventos` stores the three event kinds. The additive `database/migrations/20261021_certificate_registry.sql` creates both tables/indexes/trigger and the new permission; it assigns that permission only to the existing SUPER_ADMIN role. Institutional policy still determines any additional revocation authority and acceptable reasons. This migration does not change historic dossiers, declare completion or issue documents.

Graduation dossier GETs add `{certificado_digital_id:UUID|null, estado_certificado:'VIGENTE'|'REVOCADO'|null, registro_digital_disponible:boolean}`. The older `GET /api/graduation/verify/:codigoRegistro` stays compatible and now adds `registro_digital_disponible`, `integridad_verificada`, `estado_certificado`, and optional `token_publico`; **`autenticidad_verificada` is boolean, never unconditionally true**. An unregistered legacy document can return metadata with authenticity/integrity false; a registered VIGENTE document requires verified bytes, and REVOCADO is false. Registered names/program/cohort/type/date use the immutable snapshot. Legacy metadata alone is not a claim of digital validity.

Without the registry migration, certificate registry operations and fresh issuance return 503 instead of pretending success. Legacy dossier reads remain available with null certificate markers/availability false; legacy verification reports false assurances. No migration has been applied to the configured real database. Official templates, signing procedures, academic egreso criteria and account recovery delivery remain institutional/configuration prerequisites.

## Historical reference snapshot — 2026-10-20

Sections 1–9 below preserve the original endpoint examples, DTO field dictionary and baseline limitations for compatibility investigation. They are **historical**, not current security guarantees or current feature availability. The update sections above supersede conflicting registration, permission, ownership, static-file, SQL and certificate statements. Use the current `ApiEndpointMap` in `frontend-types.ts` and mounted routes for additions; the historical count of 88 is not the current endpoint count.

## 1. Inicio rápido y alcance

1. Configurar `API_BASE_URL = "http://localhost:3000/api"` y `API_ORIGIN = "http://localhost:3000"` (puerto por defecto; el servidor permite override con PORT).
2. Iniciar sesión con `POST /api/auth/login`; guardar el par de tokens devuelto y consultar `user.permisos`.
3. Enviar el access token como `Authorization: Bearer <accessToken>` en las rutas marcadas como protegidas.
4. Leer las advertencias de compatibilidad de la sección 9 antes de construir perfiles, notas o consulta QR: existen consultas SQL incompatibles con `database/init.sql`.

Se inspeccionaron todos los archivos de `src/modules/`, `src/middlewares/`, `src/types/`, `database/init.sql`, `src/app.ts`, `src/db/pool.ts`, `src/db/seed.ts` y `src/scripts/generate-snepa-template.ts`. La referencia `@database/init.sql` corresponde al archivo real `database/init.sql`. Hay **88 endpoints de módulos: ocho módulos funcionales y un router adicional de autenticación**. No existen rutas públicas para registrar usuarios, administrar roles/permisos o generar un PDF/QR.

Los ejemplos de éxito describen exactamente la serialización prevista por controladores y consultas; usan datos ficticios, no resultados de llamadas HTTP observadas. Las rutas incompatibles con el esquema inicial se identifican explícitamente; no se promete que sus ejemplos de éxito funcionen sobre esa base.

### Convenciones del catálogo

- Las rutas se expresan completas desde `/api`; anteponer `http://localhost:3000`.
- `Público`: sin JWT. `JWT`: requiere Bearer, sin permiso adicional. Un código de permiso significa JWT más ese permiso; `SUPER_ADMIN` evita la comprobación de permiso.
- Todos los parámetros de ruta llamados `id`, `degreeId`, `componenteId`, `aspiranteId`, `paymentId`, `convalidationId`, `expedienteId`, `publicationId`, `programacionComponenteId`, `matriculaComponenteId` o `inscripcionId` son UUID válidos. `slug` es texto recortado no vacío; `codigoRegistro` es texto de longitud mínima 1 y debe codificarse con `encodeURIComponent`.
- Cuando no se declara query o body, no hay campos reconocidos por esa acción. No inventar paginación, orden, filtros, búsqueda ni cuerpos de borrado.
- Los objetos de respuesta y proyecciones se describen en la sección 7; los DTO de body en la sección 4. `?` significa opcional; `| null` acepta JSON `null` solamente donde se declara. Un campo opcional no equivale a nullable.

## 2. Transporte, respuestas, errores y autenticación

### Headers y formatos

Para JSON: `Content-Type: application/json`; para respuestas se puede enviar `Accept: application/json`. Para `FormData`, dejar que el navegador construya `Content-Type: multipart/form-data; boundary=...`; no fijarlo manualmente. `express.json()` y `express.urlencoded({extended:true})` están habilitados. CORS usa `cors()` sin restricción de origen ni credenciales configuradas. No hay cookies de autenticación, cabecera CSRF ni sesión de navegador requerida.

### Envelopes reales

Las propiedades no son uniformes: `message` puede faltar, `data` falta en borrados/logout/asignación de tags, `count` existe solo en ciertos listados; no hay `timestamp` global.

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "icono_url": null,
    "activa": true
  }
}
```

```json
{
  "success": false,
  "message": "Perfil de aspirante no encontrado"
}
```

Errores operacionales: `{success:false,message:string,details?:unknown}` y status elegido por el servicio. Validación Zod: HTTP 400, `{success:false,message:"Validation error",errors:[{field:"cohorte_id",message:"..."}]}`; `field` es la ruta de Zod unida con puntos y puede ser `""`. Autenticación: 401 (`"Token has expired"`, `"Invalid authentication token"`, `"Authentication required: Missing or invalid authorization token"`); permiso insuficiente: 403 y mensaje `Forbidden: Insufficient privileges. Required permission: 'CODIGO'`.

PostgreSQL: 23505 → 409 con `code:"PG_UNIQUE_VIOLATION"`; 23503 → 400 con `code:"PG_FOREIGN_KEY_VIOLATION"`; 23514 → 400 con `code:"PG_CHECK_VIOLATION"`. El envelope agrega `detail` y `constraint` cuando PostgreSQL los entrega. Otros errores (incluidos columnas/tablas inexistentes, ciertos formatos inválidos de PostgreSQL y errores Multer sin adaptación) → 500 `{success:false,message:"Internal server error"}`. Solo con `NODE_ENV=development` se añaden `error` y `stack`. Los filtros explícitos de extensión de notas/graduación sí lanzan `AppError` 400. Exceder un límite de Multer, enviar un nombre de archivo inesperado o demasiados archivos puede producir 500, no asumir 400/413.

Ruta inexistente → 404 `{success:false,message:"Route GET /api/no-existe not found"}`. Algunos servicios convierten conflictos relacionales de borrado en 409 con un mensaje específico; otros dejan el 400 de PostgreSQL. Mostrar `message` y mapear `errors` al formulario; no depender de un único texto para todos los fallos.

### Tipos de valores recibidos

`src/db/pool.ts` no registra parsers personalizados. Los `NUMERIC` seleccionados como columnas (`precio_total_referencia`, precios de cohorte, montos, notas, duración, porcentaje de investigación) llegan normalmente como **strings decimales**. Dentro de `json_build_object`/`json_agg` PostgreSQL serializa números JSON como **numbers**. Los enteros y `COUNT(*)::int` son numbers. Fechas directas `DATE`/`TIMESTAMPTZ` pueden ser serializadas por `pg`/Express como cadenas ISO con hora; dentro de JSON SQL las DATE se expresan `YYYY-MM-DD`. Enviar fechas de formulario como `YYYY-MM-DD`; no asumir un objeto `Date` en el cliente ni cortar timestamps sin considerar zona horaria. Los defaults de SQL sin `NOT NULL` admiten null en la base aunque las altas normales apliquen un valor.

### JWT y renovación

- Login acepta `identifier`, `email` o `username` (prioridad en ese orden) más `password`. Compara email sin distinguir mayúsculas; username es exacto. Una cuenta desactivada produce 403.
- `data.tokens = {accessToken,refreshToken,tokenType:"Bearer",expiresIn:900}`. Access JWT: duración 15 minutos; payload contiene `sub`, `rol`, `permisos` y claims temporales. Refresh JWT: 7 días; contiene `sub`, `jti` y claims temporales. La sesión persiste el hash del refresh.
- Renovar mediante `POST /api/auth/refresh` con `{refreshToken:"..."}`; revoca el refresh previo y devuelve **otro par completo**. Reemplazar ambos tokens. Si el refresh falla con 401, volver al login; no reintentar indefinidamente.
- `GET /api/auth/profile` y `/api/auth/me` son alias y devuelven perfil y permisos actuales. El middleware de cada ruta protegida usa los permisos del access token hasta su renovación; no consulta la sesión ni el estado activo en cada petición.
- `POST /api/auth/logout` **no tiene requireAuth**. Toma `body.refreshToken` o header `x-refresh-token` y revoca esa sesión. Sin refresh responde éxito pero normalmente no revoca nada, incluso si se envía Bearer, porque esa ruta no decodifica `req.user`. El logout no invalida inmediatamente el access token ya emitido. Limpiar ambos tokens localmente.
- Existe `registerUserSchema`, pero no está montado en ninguna ruta: no crear un botón de registro de cuenta que llame a `/auth/register`.

### Archivos estáticos

El servidor sirve `uploads/` en `/uploads` **fuera de `/api`**, sin JWT. Un valor `/uploads/programas/<uuid>.pdf` se visualiza en `http://localhost:3000/uploads/programas/<uuid>.pdf`, no en `/api/uploads/...`.

```ts
const publicFileUrl = (storedUrl: string | null | undefined): string | null =>
  storedUrl ? new URL(storedUrl, "http://localhost:3000").href : null;
```

El código guarda nombres UUID con la extensión original en minúsculas. Una URL absoluta ya almacenada se conserva con `new URL`. No hay endpoint general de upload: adjuntar el archivo al formulario del recurso. Los enlaces estáticos son públicos; ocultar un botón no protege el documento. Helmet se aplica también a estáticos: una política de navegador entre orígenes distintos puede requerir ajuste del despliegue (no se desactiva `Cross-Origin-Resource-Policy` explícitamente).

Servicios auxiliares, no incluidos en los 88: `GET /api/health` es público y responde `{status:"ok",uptime:number,timestamp:string,database:{status:"connected",serverTime:string}}` sin envelope `success`; necesita DB disponible. Swagger UI: `/api/docs`; documento: `/api/docs.json` (es documentación, no fuente de verdad de este contrato).

## 3. ENUMs y RBAC

### Nueve ENUMs nativos de PostgreSQL

Valores literales, sensibles a mayúsculas. Fuente: `database/init.sql` y `src/types/enums.ts`.

| ENUM SQL | Valores exactos |
|---|---|
| `categoria_programa_enum` | `POSGRADO`, `EDUCACION_PERMANENTE` |
| `subtipo_programa_enum` | `ESPECIALIDAD`, `MAESTRIA_PROFESIONAL`, `MAESTRIA_ACADEMICA`, `DOCTORADO_LICENCIATURA`, `DOCTORADO_MAESTRIA`, `POSDOCTORADO`, `CURSO_ESPECIALIZADO`, `CURSO_EXTENSION`, `TALLER`, `SEMINARIO`, `CONGRESO`, `DIPLOMADO_PROFESIONAL`, `DIPLOMADO_EXTENSION` |
| `modalidad_educativa_enum` | `PRESENCIAL`, `SEMIPRESENCIAL`, `VIRTUAL`, `MIXTA` |
| `nivel_idioma_mcer_enum` | `NINGUNO`, `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |
| `estado_inscripcion_enum` | `BORRADOR`, `EN_REVISION_DOCUMENTAL`, `DOCUMENTACION_OBSERVADA`, `PENDIENTE_COMITE_PONENCIA`, `LISTA_ESPERA`, `INSCRITO_RESERVADO`, `PENDIENTE_PAGO`, `PAGO_EN_REVISION`, `MATRICULADO_ACTIVO`, `RETIRADO`, `EGRESADO`, `GRADUADO_O_CERTIFICADO` |
| `rol_participacion_ep_enum` | `ESTUDIANTE_EVALUADO`, `PARTICIPANTE_ASISTENTE`, `PONENTE_CONGRESO` |
| `escala_cualitativa_snepa_enum` | `APRENDIZAJE_AVANZADO`, `APRENDIZAJE_SATISFACTORIO`, `APRENDIZAJE_FUNDAMENTAL`, `APRENDIZAJE_INICIAL` |
| `metodo_pago_enum` | `BAUCHER_BANCARIO`, `CAJA_ADMINISTRATIVA`, `TRANSFERENCIA`, `PASARELA_ONLINE` |
| `estado_pago_enum` | `PENDIENTE_REVISION`, `APROBADO`, `RECHAZADO`, `REEMBOLSADO`, `ANULADO` |

### Doce dominios adicionales: CHECK, no ENUM SQL

No confundirlos con los nueve tipos anteriores. Se exportan también como constantes/tipos en `frontend-types.ts`.

| Dominio TypeScript | Valores exactos |
|---|---|
| `TipoSede` | `SEDE_CENTRAL`, `SEDE`, `SUBSEDE`, `EXTENSION`, `UNICAM` |
| `MaximoGradoAcademico` | `LICENCIADO`, `ESPECIALISTA`, `MASTER`, `DOCTOR` |
| `EstadoVigenciaPrograma` | `ACTIVO`, `EN_REDISENO`, `PAUSADO`, `LIQUIDADO` |
| `EstadoCohorte` | `PLANIFICADA`, `INSCRIPCION_ABIERTA`, `QUORUM_ALCANZADO_COBRANDO`, `EN_EJECUCION`, `FINALIZADA_PENDIENTE_EVAL`, `EVALUADA_SETEC`, `CANCELADA` |
| `TipoIdentificacion` | `CEDULA`, `PASAPORTE`, `CEDULA_RESIDENCIA`, `PARTIDA_NACIMIENTO` |
| `NivelTitulo` | `TECNICO_SUPERIOR`, `GRADO`, `ESPECIALIDAD`, `MAESTRIA`, `DOCTORADO`, `CARTA_EGRESADO` |
| `EstadoValidacionTitulo` | `PENDIENTE`, `VALIDADO`, `RECHAZADO` |
| `TipoOrigenConvalidacion` | `CURSO_ESPECIALIZADO`, `DIPLOMADO_PROFESIONAL`, `SEMINARIO_EVALUADO`, `CONGRESO_PONENTE`, `CAMBIO_PLAN_ESTUDIOS`, `EXTERNO` |
| `EstadoDictamenConvalidacion` | `PENDIENTE`, `APROBADA`, `RECHAZADA` |
| `TipoDocumentoFinal` | `TITULO_POSGRADO`, `CERTIFICADO_APROBACION`, `CERTIFICADO_PARTICIPACION`, `CERTIFICADO_PONENTE`, `DIPLOMA_PROFESIONAL` |
| `TipoPublicacionCientifica` | `ENSAYO`, `ARTICULO_CIENTIFICO` |
| `AlcancePublicacion` | `UNIVERSITARIA`, `NACIONAL`, `REGIONAL`, `INTERNACIONAL` |

### Roles y matriz inicial de permisos

Roles exactos: `SUPER_ADMIN`, `COORDINADOR`, `CAJERO`, `DOCENTE`, `ESTUDIANTE`. Los roles son registros de `roles`, no un ENUM SQL. Matriz de `src/db/seed.ts` (los datos administrados pueden diferir):

| `permisos.codigo` | SUPER_ADMIN | COORDINADOR | CAJERO | DOCENTE | ESTUDIANTE | Vista/acción a habilitar |
|---|---|---|---|---|---|---|
| `USUARIO_GESTIONAR` | Sí | No | No | No | No | No tiene rutas de administración de usuarios implementadas |
| `SEDE_GESTIONAR` | Sí | Sí | No | No | No | Crear/editar/eliminar sedes |
| `DOCENTE_GESTIONAR` | Sí | Sí | No | No | No | Crear/editar/eliminar personal académico |
| `CATALOGO_GESTIONAR` | Sí | Sí | No | No | No | Áreas, tags, programas, asignar tags y malla |
| `COHORTE_GESTIONAR` | Sí | Sí | No | No | No | Cohortes, programación y cierre de actas vía edición de programación |
| `INSCRIPCION_VALIDAR` | Sí | Sí | Sí | No | No | Lista administrativa de aspirantes/inscripciones, verificar identidad, validar título y documentos |
| `PAGO_VALIDAR` | Sí | No | Sí | No | No | Aprobar/rechazar pago |
| `CONVALIDACION_DICTAMINAR` | Sí | Sí | No | No | No | Dictaminar convalidación |
| `NOTA_IMPORTAR` | Sí | Sí | No | Sí | No | Importar Excel |
| `NOTA_MODIFICAR` | Sí | Sí | No | No | No | Rectificación manual con motivo |
| `TITULO_EMITIR` | Sí | Sí | No | No | No | Crear/editar expediente, validar publicación, emitir documento |

La autorización efectiva de botones es `user.rol === "SUPER_ADMIN" || user.permisos.includes(codigo)`. No deducir permisos solo del nombre de rol. No confundir `coordinador_id`/`docente_titular_id` de `personal_academico` con `usuarios.id`.

**JWT sin permiso adicional no significa propietario.** En las rutas de perfiles/títulos por ID, intereses, inscripciones por ID, pagos, convalidaciones, consultas de notas, lectura de expedientes y registro/lista de publicaciones, el código no comprueba titularidad ni asignación docente. `/me` sí resuelve el aspirante desde el JWT. Crear un perfil o inscripción con `usuario_id`/`aspirante_id` explícito tampoco exige permiso administrativo. Esto es una limitación real del servidor, no una autorización recomendada para la UI; mostrar al estudiante sus propios recursos no reemplaza controles del backend.

## 4. Diccionario completo de cuerpos de petición

Las tablas siguientes son la estructura de body que referencian las rutas. Todo campo no listado se elimina por Zod, salvo `logout` e `observaciones` del import, sin schema de body. Los strings recortados se indican con `trim`. Los ENUMs remiten a la sección 3. Los defaults se aplican cuando se omite el campo, salvo los preprocesadores indicados. Todas las fechas indicadas `fecha` validan el patrón `YYYY-MM-DD`, no necesariamente una fecha del calendario antes de llegar a PostgreSQL.

Los nombres en español de esta sección son etiquetas de documentación, no nombres de exports. En `frontend-types.ts`, usar los DTO `*Request` y variantes `*Multipart` (por ejemplo `CrearPrograma` → `CreateProgramRequest`/`CreateProgramMultipart`, `EditarAspirante` → `UpdateApplicantProfileRequest`/`UpdateApplicantProfileMultipart`). `ApiEndpointMap` relaciona cada método/URL con sus tipos concretos de params, query, body y respuesta.

### DTO de autenticación

| DTO | Campos |
|---|---|
| `Login` | `password: string` min 1, sin trim; al menos uno de `identifier?: string`, `email?: string`, `username?: string`, todos trim/min 1. `email` aquí no valida formato de email. |
| `Refresh` | `refreshToken: string` min 1. |
| `Logout` | `refreshToken?: string`, sin schema; alternativamente header `x-refresh-token`. |

### DTO de taxonomía

| DTO | Campos y reglas |
|---|---|
| `CrearArea` | `nombre: string` trim 2–120; `slug?: string` trim 2–140; `icono_url?: string \| null` trim; `activa?: boolean = true` (JSON boolean, sin coerción). |
| `EditarArea` | Los mismos campos opcionales, sin default de `activa`; al menos un campo reconocido. Cambiar nombre sin slug vuelve a generar slug. |
| `CrearTag` | `nombre: string` trim 2–80; `slug?: string` trim 2–100. |
| `EditarTag` | Ambos opcionales; al menos un campo reconocido. El slug se genera/normaliza desde nombre o slug. |

### DTO de infraestructura

| DTO | Campos y reglas |
|---|---|
| `CrearSede` | `codigo_sede: string` trim 2–30; `nombre: string` trim 2–150; `tipo_sede: TipoSede`; `resolucion_autorizacion_setec?: string \| null` trim max 100; `direccion?: string \| null` trim; `activa?: boolean = true` sin coerción. |
| `EditarSede` | Todos los anteriores opcionales, sin default; al menos un campo. Código se guarda en mayúsculas. |
| `CrearDocente` | `identificacion: string` trim 3–30; `nombres: string` y `apellidos: string` trim 2–100; `maximo_grado_academico: MaximoGradoAcademico`; `usuario_id?: UUID \| null \| ""` (vacío se convierte a null); `biografia_comercial?: string \| null` trim; `foto_perfil_url?: string \| null` trim; `cv_url?: string` trim; `activo?: boolean = true`. Para activo, string se interpreta como true solo si `.toLowerCase() === "true"`. Archivo `cv_pdf` o `cv_url` no vacío es obligatorio en servicio. |
| `EditarDocente` | Todos opcionales, mismo formato, sin default de activo; al menos un campo de texto reconocido por schema antes de extraer archivos. `cv_url` no admite null. |

### DTO de programas

`CrearPrograma`:

| Campo | Tipo/validación/default |
|---|---|
| `codigo_interno` | string trim 2–30; requerido; se guarda en mayúsculas |
| `codigo_dictamen_setec` | string trim max 80, opcional/nullable |
| `fecha_aprobacion_setec` | fecha, opcional/nullable |
| `nombre` | string trim 3–250; requerido |
| `slug` | string trim max 280, opcional; se genera de nombre si no se envía |
| `categoria` | CategoriaPrograma; requerido |
| `subtipo` | SubtipoPrograma; requerido |
| `area_conocimiento_id` | UUID; requerido; área existente y activa al crear |
| `resumen_corto_web` | string trim max 500, opcional/nullable |
| `descripcion_comercial`, `imagen_portada_url`, `video_promo_url`, `brochure_pdf_url`, `aval_minsa_url` | string trim, opcional/nullable |
| `precio_total_referencia` | número >= 0, default 0 |
| `descuento_porcentaje` | entero 0–100, default 0 |
| `visible_en_web`, `es_ciencias_salud` | boolean, default false |
| `duracion_meses` | número > 0, opcional (no nullable como valor final); vacío/null se omiten |
| `horas_totales` | entero >= 1; requerido en la práctica (default preprocesado 0 falla mínimo 1) |
| `creditos_totales`, `creditos_investigacion` | entero >= 0, default 0 |
| `permite_continuidad_doctorado`, `es_acreditable_a_posgrado` | boolean, default false |
| `programa_salida_intermedia_id`, `programa_destino_acreditable_id` | UUID o null; omitido, vacío o string `"null"` se convierten a null al crear |
| `estructurado_por_cursos` | boolean, default true; servicio fuerza false en ambos doctorados |
| `requiere_titulo_grado_rn`, `requiere_titulo_profesional`, `permite_menores_edad` | boolean, default false |
| `idioma_egreso_requerido` | NivelIdiomaMcer, default NINGUNO |
| `num_publicaciones_requeridas` | entero >= 0, default 0 |
| `requiere_revista_indexada`, `requiere_pares_evaluadores` | boolean, default false |
| `titulo_o_certificado_otorgado` | string trim 2–200; requerido |
| `abreviatura_grado` | string trim max 20, opcional/nullable |
| `estado_vigencia` | EstadoVigenciaPrograma, default ACTIVO |
| `tag_ids` | UUID[], opcional; en multipart usar campos array que Multer construya como array (por ejemplo `tag_ids[]`); no se hace JSON.parse de este campo |

`EditarPrograma`: schema `.partial()` del anterior, mismos nombres y restricciones para valores enviados. **Zod actual mantiene los defaults internos `idioma_egreso_requerido=NINGUNO` y `estado_vigencia=ACTIVO` aun al omitirlos en PUT**, por lo que enviar los valores actuales si no se desea reiniciarlos. `{}` supera el refine por estos defaults. Tags omitidos se conservan. El schema acepta `tag_ids`, pero el SET dinámico actual falla si se envía en PUT; usar `POST /:id/tags` para reemplazar/eliminar asociaciones. Actualización valida reglas SETEC sobre estado combinado, no es reemplazo completo.

`AsignarTags`: `{tag_ids: UUID[]}` requerido, array vacío elimina todos los tags. Operación reemplaza la colección, no añade incrementalmente.

### DTO de malla curricular

| DTO | Campos |
|---|---|
| `CrearComponente` | `codigo: string` trim 1–30; `nombre: string` trim 2–200; `descripcion_temario?: string \| null` trim; `orden_bloque: entero >=1 =1`; `horas: entero >=1 =1`; `creditos: entero >=0 =0`; `es_investigacion`, `es_modalidad_graduacion`, `es_practica_profesional`: boolean default false; `costo_base_asignatura: número >=0 =0`; `url_silabo_pdf?: string \| null` trim. |
| `EditarComponente` | Mismos campos opcionales, sin defaults al omitirlos; al menos un campo reconocido antes de procesar el archivo del controlador. |

### DTO de cohortes y programación

`CrearCohorte`:

| Campo | Tipo/validación/default |
|---|---|
| `programa_id`, `sede_id`, `coordinador_id` | UUID requeridos; coordinador pertenece a personal_academico |
| `modalidad` | ModalidadEducativa; requerido |
| `codigo_cohorte` | string trim 2–50; requerido; se guarda en mayúsculas |
| `numero_edicion` | entero >=1, default 1 |
| `fecha_inicio_inscripcion`, `fecha_fin_inscripcion`, `fecha_inicio_clases`, `fecha_fin_clases` | fecha requerida; crear exige orden cronológico no decreciente |
| `horario_general` | string trim max 255, opcional/nullable |
| `precio_matricula`, `precio_total_cohorte` | número >=0, default 0 |
| `descuento_porcentaje` | entero 0–100, default 0 |
| `cupo_minimo`, `cupo_maximo` | entero >=1, defaults 15/30; regla adicional 15–30 sin excepción |
| `tiene_excepcion_cupo_setec` | boolean, default false |
| `excepcion_cupo_setec_url` | string trim, opcional/nullable; requerido efectivamente si se declara excepción y no hay archivo |
| `estado_cohorte` | EstadoCohorte, default PLANIFICADA |

`EditarCohorte`: todos los campos anteriores opcionales, más `cupos_actuales_verificados?: entero >=0`, `cobro_habilitado?: boolean`, `informe_evaluacion_cohorte_url?: string | null` trim. **Omitir estado_cohorte lo reinicia a PLANIFICADA por el default interno actual**. `{}` es aceptado por el schema. Servicio de actualización no repite todas las comprobaciones de fechas/existencia/actividad de la creación; no asumir idénticas validaciones. Al cambiar programa, la comprobación de salud usa el programa de la cohorte actual.

| DTO | Campos |
|---|---|
| `ProgramarComponente` | `componente_id: UUID` requerido; `docente_titular_id?: UUID \| null` (omitido/vacío/string `"null"` → null); `fecha_inicio?: fecha \| null`, `fecha_fin?: fecha \| null`; `horario?: string \| null` trim max255; `aula?: string \| null` trim max60; `codigo_aula_virtual_externa?: string \| null` trim max100; `actas_notas_cerradas: boolean = false`. |
| `EditarProgramacion` | Mismos campos opcionales, al menos uno. `componenteId` de la URL identifica el componente curricular, no el UUID de programación. `componente_id` también es aceptado por el schema de edición; el DAO actual lo incluye en SET si se envía, no tratarlo como solo lectura. |

Crear programación hace **upsert** por `(cohorte_id,componente_id)`: POST puede sustituir docente, fechas, aula y cierre existentes con los defaults del body. Verificar antes de guardar. Creación y edición de programación comparan fechas cuando hay ambas; creación exige docente activo y componente del programa. El cierre no impide editar programación; sí impide eliminarla.

### DTO de aspirantes e intereses

`CrearAspirante`:

| Campo | Tipo/validación/default |
|---|---|
| `usuario_id` | UUID opcional; si falta, usa usuario del JWT |
| `tipo_identificacion` | TipoIdentificacion requerido |
| `numero_identificacion` | string trim 3–40, requerido/único |
| `nombres`, `apellidos` | string trim 2–100, requeridos |
| `fecha_nacimiento` | fecha requerida; servicio calcula edad |
| `email` | string formato email max150, requerido; se guarda en minúsculas |
| `telefono` | string trim 5–30, requerido |
| `cedula_identidad_pdf_url` | string opcional/nullable |
| `tiene_discapacidad` | boolean, default false |
| `descripcion_ajuste_razonable` | string trim opcional/nullable |
| `tutor_nombre_completo` | string trim max200, opcional/nullable; requerido en servicio si menor |
| `tutor_identificacion` | string trim max40, opcional/nullable; requerido en servicio si menor |
| `tutor_documento_url` | string opcional/nullable; requerido en servicio si menor y no hay archivo |
| `intereses_areas_ids` | UUID[] default []; en multipart acepta string JSON `"[\"uuid\"]"` y hace JSON.parse |

`EditarAspirante`: los mismos campos opcionales excepto que **no acepta usuario_id**; boolean opcional sin default; `intereses_areas_ids` conserva su default `[]`. **Una edición de perfil que omite intereses borra los intereses** por la combinación schema/servicio actual; enviar explícitamente la colección actual para conservarla. `{}` es aceptado por schema. Las URLs de archivos usan prioridad archivo → body; no todos los null borran el valor porque algunos se transforman con `||`.

`ReemplazarIntereses`: `{area_conocimiento_ids: UUID[]}` requerido, nombres distintos de `intereses_areas_ids`; vacío elimina todos; los IDs se deduplican y deben existir/estar activos.

### DTO de títulos previos

| DTO | Campos |
|---|---|
| `CrearTituloPrevio` | `nivel_titulo: NivelTitulo`; `denominacion_titulo: string` trim 2–200; `institucion_emisora: string` trim 2–200; `fecha_emision: fecha`; `area_conocimiento_id?: UUID \| null`; `inscrito_registro_nacional: boolean = false`; `codigo_registro_nacional?: string \| null` trim max80; `certificado_rn_url?: string \| null`; `titulo_pdf_url?: string \| null` (archivo o URL no vacía obligatoria en servicio); `porcentaje_creditos_investigacion?: number` (preprocesa parseFloat; no rango en schema). |
| `EditarTituloPrevio` | Todos opcionales, boolean sin default; porcentaje omitido/null/vacío se omite, no se fuerza a null; `{}` permitido. No se exige nueva carga si conserva título existente. |
| `ValidarTituloPrevio` | `estado_validacion: EstadoValidacionTitulo` (incluye PENDIENTE); `observacion_rechazo?: string \| null` trim, obligatoria y no vacía si RECHAZADO. Al no rechazar el servicio limpia observacion_rechazo. |

### DTO de inscripción, caja y convalidación

| DTO | Campos |
|---|---|
| `CrearInscripcion` | `cohorte_id: UUID`; `aspirante_id?: UUID` (si falta resuelve JWT); `titulo_presentado_id?: UUID \| null`; `rol_participacion: RolParticipacionEp = ESTUDIANTE_EVALUADO`; `titulo_ponencia?: string \| null` max250; `resumen_ponencia?: string \| null`; `archivo_ponencia_url?: string \| null`; `es_reingreso_cambio_plan: boolean = false`; `inscripcion_origen_id?: UUID \| null`; `requiere_nivelacion_investigativa: boolean = false`; `acepta_compromiso_idioma_y_publicacion: boolean = false`; `observaciones_administracion?: string \| null`. |
| `ValidarDocumentos` | `aprobado: boolean = true`; `observaciones_administracion?: string \| null`. Omitir aprobado significa aprobar, no rechazar. |
| `CrearPago` | `metodo_pago: MetodoPago`; `numero_referencia_o_recibo: string` 1–100; `banco_origen?: string \| null` max100; `monto_subtotal`, `descuento_aplicado`, `total_pagado`: number, defaults 0, sin mínimo ni comprobación de suma; `concepto: string` 1–255; `comprobante_baucher_url?: string \| null`; `fecha_pago_reportada?: string` sin patrón de fecha en Zod. El archivo no es obligatorio por servicio. |
| `ValidarPago` | `estado: "APROBADO" \| "RECHAZADO"`; `motivo_rechazo?: string \| null`; si falta al rechazar se genera motivo por defecto. No acepta REEMBOLSADO/PENDIENTE_REVISION como decisión. |
| `CrearConvalidacion` | `componente_destino_id: UUID`; `origen_tipo: TipoOrigenConvalidacion`; `inscripcion_origen_ep_id?: UUID \| null`; `creditos_reconocidos: entero 1–15` (strings se procesan con parseInt); `justificacion_aporte_perfil: string` min10 sin trim; `certificado_origen_url?: string \| null`, archivo o URL obligatoria por servicio. Créditos no pueden superar los del componente destino. |
| `DictaminarConvalidacion` | `estado_dictamen: "APROBADA" \| "RECHAZADA"`; `coordinador_dictaminador_id?: UUID \| null`; si falta resuelve personal_academico del usuario JWT; puede quedar null si no existe vínculo. Solo solicitudes PENDIENTE se dictaminan. No crea una nota convalidada automáticamente. |

### DTO de notas y graduación

| DTO | Campos |
|---|---|
| `ImportarNotas` | Multipart: archivo obligatorio `archivo_excel`; texto opcional `observaciones` (sin Zod de body). El UUID de programación va en URL. |
| `ModificarNota` | JSON: `motivo_modificacion: string` min5, sin trim; `calificacion_cuantitativa?: number` 0–100 (no string); `valoracion_cualitativa?: EscalaCualitativaSnepa`; `observacion_acompanamiento_pedagogico?: string`; `autoevaluacion_completada?: boolean`; `coevaluacion_completada?: boolean`. Solo motivo ya es body válido; null no está permitido en estos campos. |
| `CrearExpediente` | `inscripcion_id: UUID`; `tipo_documento_final: TipoDocumentoFinal`; `idioma_acreditado?: string`; `nivel_idioma_alcanzado: NivelIdiomaMcer = NINGUNO`; `institucion_aval_idioma?: string`; `modalidad_graduacion_tipo?: string`; `titulo_trabajo_graduacion?: string`; `aplico_salida_intermedia: boolean = false`. No acepta URLs de adjuntos como texto. |
| `EditarExpediente` | Opcionales: `idioma_acreditado`, `institucion_aval_idioma`, `modalidad_graduacion_tipo`, `titulo_trabajo_graduacion`: string; `nivel_idioma_alcanzado: NivelIdiomaMcer`; `idioma_validado: boolean`; `aplico_salida_intermedia: boolean`; `tipo_documento_final: TipoDocumentoFinal`. Sin inscripcion_id y sin URLs de texto; `{}` permitido. DAO usa COALESCE: ausencias conservan valor. |
| `CrearPublicacion` | `tipo_publicacion: TipoPublicacionCientifica`; `titulo_publicacion: string` min3; `nombre_revista_o_medio: string` min2; `es_revista_indexada: boolean = false`; `tiene_revision_pares: boolean = false`; `alcance?: AlcancePublicacion` (no null); `url_o_doi: string` min3 sin validación URL; archivo `evidencia_pdf` obligatorio. La base limita título a 300 y revista a 200 aunque Zod no tiene máximo. |
| `ValidarPublicacion` | JSON `{validado_coordinacion: boolean}` real, sin coerción. False significa observada/rechazada; no tiene estado ni motivo adicional. |
| `EmitirDocumento` | Todos opcionales: `codigo_registro_titulo_emitido: string`, `documento_final_url: string`, `fecha_emision: fecha`, `tipo_documento_final: TipoDocumentoFinal`; archivo `documento_final` opcional. Sin body o `{}` puede emitir si cumple requisitos. Código SQL max80, aunque Zod no impone máximo. |

### Coerción y actualizaciones: leer antes de construir FormData

- Programas/cohortes/componentes/inscripciones y booleanos de creación de aspirante/título: strings trim y sin distinguir mayúsculas `true`/`1` → true, `false`/`0` → false. Valores no reconocidos caen al default del preprocesador (por ejemplo aprobado de validación documental → true). Booleanos opcionales de perfil/título ignoran valores no reconocidos. Enviar siempre literales válidos.
- Graduación: strings son true **solo** cuando exactamente `"true"`; `"TRUE"` y `"1"` son false. Docentes usan comparación lowercase con `"true"`, sin trim. Sedes/áreas y validación de publicación/manual de notas requieren boolean JSON real.
- Números de programas/cohortes convierten strings con `Number`; vacío/null/omitido usan default u omisión. Los números de pago convierten inválidos/ausentes a 0. Perfil/título usa parseFloat para porcentaje y filtros; convalidación usa parseInt.
- PUT se comporta como actualización parcial, no como reemplazo REST completo. Los defaults conservados de programas/cohortes y borrado de intereses son excepciones importantes. No asumir que omitir y enviar null tienen igual efecto. Componentes/programas/cohortes usan SET dinámico; otros recursos filtran undefined o usan COALESCE.
- Un update que exige al menos un campo valida el body **antes** de incorporar archivos del controlador: una carga de archivo sin campos textuales puede fallar. Enviar un campo reconocido apropiado. No mandar el objeto de respuesta completo como body de edición sin seleccionar DTO.

## 5. Matriz multipart y adjuntos

JSON funciona en las rutas con Multer si no se adjuntan archivos y los requisitos se satisfacen mediante las URLs aceptadas. No enviar un string JSON para arrays que el schema no procesa como JSON.

| Recurso | Nombres exactos de campos de archivo | Campo URL textual alternativo | Carpeta |
|---|---|---|---|
| Programa | `aval_minsa`, `imagen_portada`, `brochure_pdf` (máx. 1 de cada uno) | `aval_minsa_url`, `imagen_portada_url`, `brochure_pdf_url` | `/uploads/programas/` |
| Componente curricular | `silabo_pdf` (single) | `url_silabo_pdf` | `/uploads/silabos/` |
| Cohorte | `excepcion_cupo_pdf` (single) | `excepcion_cupo_setec_url` | `/uploads/cohortes/` |
| Docente | `foto_perfil`, `cv_pdf` (máx. 1 cada uno) | `foto_perfil_url`, `cv_url` | `/uploads/docentes/` |
| Perfil aspirante | `cedula_identidad_pdf` o alias `cedula_identidad_pdf_url`; `tutor_documento` o alias `tutor_documento_url` (máx. 1 por nombre) | `cedula_identidad_pdf_url`, `tutor_documento_url` | `/uploads/documentos/` |
| Título previo | `titulo_pdf` o alias `titulo_pdf_url`; `certificado_rn` o alias `certificado_rn_url` (máx. 1 por nombre) | `titulo_pdf_url`, `certificado_rn_url` | `/uploads/documentos/` |
| Inscripción | `archivo_ponencia` o alias `archivo_ponencia_url` (máx. 1 por nombre) | `archivo_ponencia_url` | `/uploads/ponencias/` |
| Pago | `comprobante_baucher`, alias `comprobante_baucher_url`, alias `baucher` (máx. 1 por nombre; prioridad en ese orden) | `comprobante_baucher_url` | `/uploads/bauchers/` |
| Convalidación | `certificado_origen` o alias `certificado_origen_url` (máx. 1 por nombre) | `certificado_origen_url` | `/uploads/convalidaciones/` |
| Importación de notas | `archivo_excel` (single, obligatorio) | No | `/uploads/actas_excel/` |
| Expediente | `certificado_idioma` o alias `certificado_idioma_url`; `acta_defensa` o alias `acta_defensa_url`; `titulo_intermedio` o alias `titulo_intermedio_emitido_url` (máx. 1 por nombre) | **No**: nombres `_url` son alias de archivo, no texto admitido en schema | `/uploads/documentos/` |
| Publicación | `evidencia_pdf` (single, obligatorio) | No | `/uploads/documentos/` |
| Emisión | `documento_final` (single, opcional) | `documento_final_url` | `/uploads/documentos/` |

Un archivo cargado prevalece sobre su URL textual. Cuando existen alias, prevalece el nombre primario; no enviar ambos innecesariamente. Fuera de notas/graduación **no se configuran filtros de extensión/MIME ni tamaño máximo**: los nombres `pdf` no prueban validación de contenido. No inventar un límite compartido.

Notas permite extensión `.xlsx` o `.xls`, case-insensitive, límite 15 MiB por archivo; el servicio usa exclusivamente `workbook.xlsx.readFile`, por lo que usar **.xlsx** para interoperabilidad. Graduación permite solo `.pdf`, case-insensitive, límite 20 MiB por archivo; comprueba extensión, no MIME/contenido. Los archivos se escriben antes de validar schema/servicio; una petición rechazada puede dejar el archivo en disco, sin limpieza automática ni endpoint de borrado.

## 6. Catálogo completo de endpoints

Cada entrada declara body, query, acceso y estructura de `data`. Los nombres de DTO remiten a sección 4, los archivos a sección 5 y los modelos/proyecciones a sección 7. Un array vacío en un ejemplo es una respuesta válida; su tipo de elementos se especifica aunque no haya registros.

### 6.1. auth (5 rutas)

Fuentes: `src/modules/auth/auth.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 01. `POST /api/auth/login`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON `Login`. Ejemplo: `{ "identifier": "ana@example.edu", "password": "su-contraseña" }`.
- **Éxito:** HTTP 200; `data: Login`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "00000004-1111-4111-8111-111111111111",
      "username": "ana",
      "email": "ana@example.edu",
      "nombres": "Ana",
      "apellidos": "Pérez",
      "telefono": null,
      "avatar_url": null,
      "rol": "ESTUDIANTE",
      "activo": true,
      "email_verificado": false,
      "permisos": [],
      "created_at": "2026-10-20T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "<jwt-access>",
      "refreshToken": "<jwt-refresh>",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  }
}
```

#### 02. `POST /api/auth/refresh`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON `Refresh`: `{ "refreshToken": "<jwt-refresh>" }`.
- **Éxito:** HTTP 200; `data: Tokens`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "data": {
    "accessToken": "<jwt-access>",
    "refreshToken": "<jwt-refresh>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

#### 03. `POST /api/auth/logout`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON opcional `Logout` o header `x-refresh-token`.
- **Éxito:** HTTP 200; sin `data`.
- **Atención:** Público: sin refresh no revoca la sesión y aun así responde éxito.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### 04. `GET /api/auth/profile`

- **Acceso:** JWT.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: PerfilUsuario`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000004-1111-4111-8111-111111111111",
    "username": "ana",
    "email": "ana@example.edu",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "telefono": null,
    "avatar_url": null,
    "rol": "ESTUDIANTE",
    "activo": true,
    "email_verificado": false,
    "permisos": [],
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 05. `GET /api/auth/me`

- **Acceso:** JWT.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: PerfilUsuario`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000004-1111-4111-8111-111111111111",
    "username": "ana",
    "email": "ana@example.edu",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "telefono": null,
    "avatar_url": null,
    "rol": "ESTUDIANTE",
    "activo": true,
    "email_verificado": false,
    "permisos": [],
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

### 6.2. taxonomy (10 rutas)

Fuentes: `src/modules/taxonomy/taxonomy.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 06. `GET /api/taxonomy/areas`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** `all?: string`; solo `all=true` incluye inactivas.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: areas_conocimiento[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 07. `GET /api/taxonomy/areas/:id`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: areas_conocimiento`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000006-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "icono_url": null,
    "activa": true
  }
}
```

#### 08. `GET /api/taxonomy/tags`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: tags_academicos[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 09. `GET /api/taxonomy/tags/:id`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: tags_academicos`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000007-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria"
  }
}
```

#### 10. `POST /api/taxonomy/areas`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON `CrearArea`.
- **Éxito:** HTTP 201; `data: areas_conocimiento`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Área de conocimiento creada exitosamente",
  "data": {
    "id": "00000006-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "icono_url": null,
    "activa": true
  }
}
```

#### 11. `PUT /api/taxonomy/areas/:id`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `EditarArea`.
- **Éxito:** HTTP 200; `data: areas_conocimiento`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Área de conocimiento actualizada exitosamente",
  "data": {
    "id": "00000006-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "icono_url": null,
    "activa": true
  }
}
```

#### 12. `DELETE /api/taxonomy/areas/:id`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Área de conocimiento eliminada exitosamente"
}
```

#### 13. `POST /api/taxonomy/tags`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON `CrearTag`.
- **Éxito:** HTTP 201; `data: tags_academicos`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Tag académico creado exitosamente",
  "data": {
    "id": "00000007-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria"
  }
}
```

#### 14. `PUT /api/taxonomy/tags/:id`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `EditarTag`.
- **Éxito:** HTTP 200; `data: tags_academicos`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Tag académico actualizado exitosamente",
  "data": {
    "id": "00000007-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria"
  }
}
```

#### 15. `DELETE /api/taxonomy/tags/:id`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Tag académico eliminado exitosamente"
}
```

### 6.3. infrastructure (10 rutas)

Fuentes: `src/modules/infrastructure/infrastructure.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 16. `GET /api/infrastructure/sedes`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** `all?: string`; solo `all=true` incluye inactivas.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: sedes_ies[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 17. `GET /api/infrastructure/sedes/:id`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: sedes_ies`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000008-1111-4111-8111-111111111111",
    "codigo_sede": "CENTRAL",
    "nombre": "Ingeniería",
    "tipo_sede": "SEDE_CENTRAL",
    "resolucion_autorizacion_setec": null,
    "direccion": null,
    "activa": true,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 18. `POST /api/infrastructure/sedes`

- **Acceso:** JWT + `SEDE_GESTIONAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON `CrearSede`.
- **Éxito:** HTTP 201; `data: sedes_ies`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Sede universitaria registrada exitosamente",
  "data": {
    "id": "00000008-1111-4111-8111-111111111111",
    "codigo_sede": "CENTRAL",
    "nombre": "Ingeniería",
    "tipo_sede": "SEDE_CENTRAL",
    "resolucion_autorizacion_setec": null,
    "direccion": null,
    "activa": true,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 19. `PUT /api/infrastructure/sedes/:id`

- **Acceso:** JWT + `SEDE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `EditarSede`.
- **Éxito:** HTTP 200; `data: sedes_ies`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Sede universitaria actualizada exitosamente",
  "data": {
    "id": "00000008-1111-4111-8111-111111111111",
    "codigo_sede": "CENTRAL",
    "nombre": "Ingeniería",
    "tipo_sede": "SEDE_CENTRAL",
    "resolucion_autorizacion_setec": null,
    "direccion": null,
    "activa": true,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 20. `DELETE /api/infrastructure/sedes/:id`

- **Acceso:** JWT + `SEDE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Sede universitaria eliminada exitosamente"
}
```

#### 21. `GET /api/infrastructure/docentes`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** `all?: string`; solo `all=true` incluye inactivos.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: DocenteDetalle[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 22. `GET /api/infrastructure/docentes/:id`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: DocenteDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000009-1111-4111-8111-111111111111",
    "usuario_id": null,
    "identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "maximo_grado_academico": "MASTER",
    "biografia_comercial": null,
    "foto_perfil_url": null,
    "cv_url": "/uploads/docentes/cv.pdf",
    "activo": true,
    "created_at": "2026-10-20T12:00:00.000Z",
    "usuario_email": null,
    "usuario_username": null,
    "rol_nombre": null
  }
}
```

#### 23. `POST /api/infrastructure/docentes`

- **Acceso:** JWT + `DOCENTE_GESTIONAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearDocente`; archivos `foto_perfil`, `cv_pdf`.
- **Éxito:** HTTP 201; `data: personal_academico`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Personal académico registrado exitosamente",
  "data": {
    "id": "00000009-1111-4111-8111-111111111111",
    "usuario_id": null,
    "identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "maximo_grado_academico": "MASTER",
    "biografia_comercial": null,
    "foto_perfil_url": null,
    "cv_url": "/uploads/docentes/cv.pdf",
    "activo": true,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 24. `PUT /api/infrastructure/docentes/:id`

- **Acceso:** JWT + `DOCENTE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarDocente`; archivos `foto_perfil`, `cv_pdf`.
- **Éxito:** HTTP 200; `data: personal_academico`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Personal académico actualizado exitosamente",
  "data": {
    "id": "00000009-1111-4111-8111-111111111111",
    "usuario_id": null,
    "identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "maximo_grado_academico": "MASTER",
    "biografia_comercial": null,
    "foto_perfil_url": null,
    "cv_url": "/uploads/docentes/cv.pdf",
    "activo": true,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 25. `DELETE /api/infrastructure/docentes/:id`

- **Acceso:** JWT + `DOCENTE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Personal académico eliminado exitosamente"
}
```

### 6.4. programs (13 rutas)

Fuentes: `src/modules/programs/program.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 26. `GET /api/programs/catalog`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** `area_id?: UUID`, `categoria?: CategoriaPrograma`, `subtipo?: SubtipoPrograma`, `search?: string` trim; Zod.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ProgramaCatalogo[]`.
- **Atención:** Solo visible_en_web=true y estado_vigencia=ACTIVO; cohortes_abiertas contiene únicamente INSCRIPCION_ABIERTA. No acepta tag_ids ni tags como filtro.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

#### 27. `GET /api/programs/recommendations/:aspiranteId`

- **Acceso:** Público.
- **Parámetros de ruta:** `aspiranteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ProgramaRecomendacion[]`.
- **Atención:** Público y personalizado por aspirante; verifica existencia. Solo programas ACTIVO, no exige visible_en_web.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

#### 28. `GET /api/programs/slug/:slug`

- **Acceso:** Público.
- **Parámetros de ruta:** `slug` (texto).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ProgramaDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000010-1111-4111-8111-111111111111",
    "codigo_interno": "CUR-001",
    "codigo_dictamen_setec": null,
    "fecha_aprobacion_setec": null,
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "categoria": "EDUCACION_PERMANENTE",
    "subtipo": "CURSO_EXTENSION",
    "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
    "resumen_corto_web": null,
    "descripcion_comercial": null,
    "imagen_portada_url": null,
    "video_promo_url": null,
    "brochure_pdf_url": null,
    "precio_total_referencia": "0.00",
    "descuento_porcentaje": 0,
    "visible_en_web": false,
    "es_ciencias_salud": false,
    "aval_minsa_url": null,
    "duracion_meses": null,
    "horas_totales": 40,
    "creditos_totales": 0,
    "creditos_investigacion": 0,
    "permite_continuidad_doctorado": false,
    "programa_salida_intermedia_id": null,
    "programa_destino_acreditable_id": null,
    "es_acreditable_a_posgrado": false,
    "estructurado_por_cursos": true,
    "requiere_titulo_grado_rn": false,
    "requiere_titulo_profesional": false,
    "permite_menores_edad": false,
    "idioma_egreso_requerido": "NINGUNO",
    "num_publicaciones_requeridas": 0,
    "requiere_revista_indexada": false,
    "requiere_pares_evaluadores": false,
    "titulo_o_certificado_otorgado": "Certificado de aprobación",
    "abreviatura_grado": null,
    "estado_vigencia": "ACTIVO",
    "created_at": "2026-10-20T12:00:00.000Z",
    "area_conocimiento": {
      "id": "00000006-1111-4111-8111-111111111111",
      "nombre": "Ingeniería",
      "slug": "ingenieria",
      "icono_url": null
    },
    "tags": [],
    "componentes": []
  }
}
```

#### 29. `GET /api/programs`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** `area_id?: UUID`, `categoria?: CategoriaPrograma`, `subtipo?: SubtipoPrograma`, `estado_vigencia?: EstadoVigenciaPrograma`, `visible_en_web?: string` (true solo si `"true"`), `search?: string`. No hay schema Zod de query aquí.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ProgramaLista[]`.
- **Atención:** Listado público sin filtro obligatorio de publicación/actividad; no equivale a catálogo.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 30. `GET /api/programs/:id`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ProgramaDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000010-1111-4111-8111-111111111111",
    "codigo_interno": "CUR-001",
    "codigo_dictamen_setec": null,
    "fecha_aprobacion_setec": null,
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "categoria": "EDUCACION_PERMANENTE",
    "subtipo": "CURSO_EXTENSION",
    "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
    "resumen_corto_web": null,
    "descripcion_comercial": null,
    "imagen_portada_url": null,
    "video_promo_url": null,
    "brochure_pdf_url": null,
    "precio_total_referencia": "0.00",
    "descuento_porcentaje": 0,
    "visible_en_web": false,
    "es_ciencias_salud": false,
    "aval_minsa_url": null,
    "duracion_meses": null,
    "horas_totales": 40,
    "creditos_totales": 0,
    "creditos_investigacion": 0,
    "permite_continuidad_doctorado": false,
    "programa_salida_intermedia_id": null,
    "programa_destino_acreditable_id": null,
    "es_acreditable_a_posgrado": false,
    "estructurado_por_cursos": true,
    "requiere_titulo_grado_rn": false,
    "requiere_titulo_profesional": false,
    "permite_menores_edad": false,
    "idioma_egreso_requerido": "NINGUNO",
    "num_publicaciones_requeridas": 0,
    "requiere_revista_indexada": false,
    "requiere_pares_evaluadores": false,
    "titulo_o_certificado_otorgado": "Certificado de aprobación",
    "abreviatura_grado": null,
    "estado_vigencia": "ACTIVO",
    "created_at": "2026-10-20T12:00:00.000Z",
    "area_conocimiento": {
      "id": "00000006-1111-4111-8111-111111111111",
      "nombre": "Ingeniería",
      "slug": "ingenieria",
      "icono_url": null
    },
    "tags": [],
    "componentes": []
  }
}
```

#### 31. `GET /api/programs/:id/componentes`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: componentes_curriculares[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 32. `POST /api/programs`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearPrograma`; archivos `aval_minsa`, `imagen_portada`, `brochure_pdf`.
- **Éxito:** HTTP 201; `data: programas_academicos`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Programa académico creado exitosamente",
  "data": {
    "id": "00000010-1111-4111-8111-111111111111",
    "codigo_interno": "CUR-001",
    "codigo_dictamen_setec": null,
    "fecha_aprobacion_setec": null,
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "categoria": "EDUCACION_PERMANENTE",
    "subtipo": "CURSO_EXTENSION",
    "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
    "resumen_corto_web": null,
    "descripcion_comercial": null,
    "imagen_portada_url": null,
    "video_promo_url": null,
    "brochure_pdf_url": null,
    "precio_total_referencia": "0.00",
    "descuento_porcentaje": 0,
    "visible_en_web": false,
    "es_ciencias_salud": false,
    "aval_minsa_url": null,
    "duracion_meses": null,
    "horas_totales": 40,
    "creditos_totales": 0,
    "creditos_investigacion": 0,
    "permite_continuidad_doctorado": false,
    "programa_salida_intermedia_id": null,
    "programa_destino_acreditable_id": null,
    "es_acreditable_a_posgrado": false,
    "estructurado_por_cursos": true,
    "requiere_titulo_grado_rn": false,
    "requiere_titulo_profesional": false,
    "permite_menores_edad": false,
    "idioma_egreso_requerido": "NINGUNO",
    "num_publicaciones_requeridas": 0,
    "requiere_revista_indexada": false,
    "requiere_pares_evaluadores": false,
    "titulo_o_certificado_otorgado": "Certificado de aprobación",
    "abreviatura_grado": null,
    "estado_vigencia": "ACTIVO",
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 33. `PUT /api/programs/:id`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarPrograma`; mismos archivos.
- **Éxito:** HTTP 200; `data: programas_academicos`.
- **Atención:** Omitir idioma/estado puede reiniciarlos; ver sección 4.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Programa académico actualizado exitosamente",
  "data": {
    "id": "00000010-1111-4111-8111-111111111111",
    "codigo_interno": "CUR-001",
    "codigo_dictamen_setec": null,
    "fecha_aprobacion_setec": null,
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "categoria": "EDUCACION_PERMANENTE",
    "subtipo": "CURSO_EXTENSION",
    "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
    "resumen_corto_web": null,
    "descripcion_comercial": null,
    "imagen_portada_url": null,
    "video_promo_url": null,
    "brochure_pdf_url": null,
    "precio_total_referencia": "0.00",
    "descuento_porcentaje": 0,
    "visible_en_web": false,
    "es_ciencias_salud": false,
    "aval_minsa_url": null,
    "duracion_meses": null,
    "horas_totales": 40,
    "creditos_totales": 0,
    "creditos_investigacion": 0,
    "permite_continuidad_doctorado": false,
    "programa_salida_intermedia_id": null,
    "programa_destino_acreditable_id": null,
    "es_acreditable_a_posgrado": false,
    "estructurado_por_cursos": true,
    "requiere_titulo_grado_rn": false,
    "requiere_titulo_profesional": false,
    "permite_menores_edad": false,
    "idioma_egreso_requerido": "NINGUNO",
    "num_publicaciones_requeridas": 0,
    "requiere_revista_indexada": false,
    "requiere_pares_evaluadores": false,
    "titulo_o_certificado_otorgado": "Certificado de aprobación",
    "abreviatura_grado": null,
    "estado_vigencia": "ACTIVO",
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 34. `DELETE /api/programs/:id`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Programa académico eliminado exitosamente"
}
```

#### 35. `POST /api/programs/:id/tags`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `AsignarTags`: `{ "tag_ids": [] }`.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Etiquetas asignadas al programa exitosamente"
}
```

#### 36. `POST /api/programs/:id/componentes`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearComponente`; archivo `silabo_pdf`.
- **Éxito:** HTTP 201; `data: componentes_curriculares`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Componente curricular agregado exitosamente a la malla",
  "data": {
    "id": "00000012-1111-4111-8111-111111111111",
    "programa_id": "00000012-1111-4111-8111-111111111111",
    "codigo": "MOD-01",
    "nombre": "Introducción a investigación",
    "descripcion_temario": null,
    "orden_bloque": 1,
    "horas": 40,
    "creditos": 0,
    "es_investigacion": false,
    "es_modalidad_graduacion": false,
    "es_practica_profesional": false,
    "costo_base_asignatura": "0.00",
    "url_silabo_pdf": null
  }
}
```

#### 37. `PUT /api/programs/:id/componentes/:componenteId`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID), `componenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarComponente`; archivo `silabo_pdf`.
- **Éxito:** HTTP 200; `data: componentes_curriculares`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Componente curricular actualizado exitosamente",
  "data": {
    "id": "00000012-1111-4111-8111-111111111111",
    "programa_id": "00000012-1111-4111-8111-111111111111",
    "codigo": "MOD-01",
    "nombre": "Introducción a investigación",
    "descripcion_temario": null,
    "orden_bloque": 1,
    "horas": 40,
    "creditos": 0,
    "es_investigacion": false,
    "es_modalidad_graduacion": false,
    "es_practica_profesional": false,
    "costo_base_asignatura": "0.00",
    "url_silabo_pdf": null
  }
}
```

#### 38. `DELETE /api/programs/:id/componentes/:componenteId`

- **Acceso:** JWT + `CATALOGO_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID), `componenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Componente curricular eliminado exitosamente de la malla"
}
```

### 6.5. cohorts (9 rutas)

Fuentes: `src/modules/cohorts/cohort.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 39. `GET /api/cohorts`

- **Acceso:** Público.
- **Parámetros de ruta:** ninguno.
- **Query:** `programa_id?: UUID`, `sede_id?: UUID`, `modalidad?: ModalidadEducativa`, `estado_cohorte?: EstadoCohorte`, `search?: string` trim.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: CohorteLista[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

#### 40. `GET /api/cohorts/:id`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: CohorteDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000013-1111-4111-8111-111111111111",
    "programa_id": "00000013-1111-4111-8111-111111111111",
    "sede_id": "00000013-1111-4111-8111-111111111111",
    "modalidad": "PRESENCIAL",
    "codigo_cohorte": "CUR-2026-01",
    "numero_edicion": 1,
    "coordinador_id": "00000013-1111-4111-8111-111111111111",
    "fecha_inicio_inscripcion": "2026-10-01T00:00:00.000Z",
    "fecha_fin_inscripcion": "2026-10-20T00:00:00.000Z",
    "fecha_inicio_clases": "2026-11-01T00:00:00.000Z",
    "fecha_fin_clases": "2026-12-01T00:00:00.000Z",
    "horario_general": null,
    "precio_matricula": "0.00",
    "precio_total_cohorte": "0.00",
    "descuento_porcentaje": 0,
    "cupo_minimo": 15,
    "cupo_maximo": 30,
    "cupos_actuales_verificados": 0,
    "cobro_habilitado": false,
    "tiene_excepcion_cupo_setec": false,
    "excepcion_cupo_setec_url": null,
    "estado_cohorte": "PLANIFICADA",
    "informe_evaluacion_cohorte_url": null,
    "created_at": "2026-10-20T12:00:00.000Z",
    "programa_nombre": "Ingeniería",
    "programa_codigo": "CUR-001",
    "programa_subtipo": "CURSO_EXTENSION",
    "es_ciencias_salud": false,
    "sede_nombre": "Sede Central",
    "codigo_sede": "CENTRAL",
    "coordinador_nombres": "Ana",
    "coordinador_apellidos": "Pérez",
    "coordinador_identificacion": "001-010190-0001A",
    "programacion": []
  }
}
```

#### 41. `GET /api/cohorts/:id/componentes`

- **Acceso:** Público.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ProgramacionDetalle[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 42. `POST /api/cohorts`

- **Acceso:** JWT + `COHORTE_GESTIONAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearCohorte`; archivo `excepcion_cupo_pdf`.
- **Éxito:** HTTP 201; `data: cohortes_apertura`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Cohorte de apertura planificada exitosamente",
  "data": {
    "id": "00000013-1111-4111-8111-111111111111",
    "programa_id": "00000013-1111-4111-8111-111111111111",
    "sede_id": "00000013-1111-4111-8111-111111111111",
    "modalidad": "PRESENCIAL",
    "codigo_cohorte": "CUR-2026-01",
    "numero_edicion": 1,
    "coordinador_id": "00000013-1111-4111-8111-111111111111",
    "fecha_inicio_inscripcion": "2026-10-01T00:00:00.000Z",
    "fecha_fin_inscripcion": "2026-10-20T00:00:00.000Z",
    "fecha_inicio_clases": "2026-11-01T00:00:00.000Z",
    "fecha_fin_clases": "2026-12-01T00:00:00.000Z",
    "horario_general": null,
    "precio_matricula": "0.00",
    "precio_total_cohorte": "0.00",
    "descuento_porcentaje": 0,
    "cupo_minimo": 15,
    "cupo_maximo": 30,
    "cupos_actuales_verificados": 0,
    "cobro_habilitado": false,
    "tiene_excepcion_cupo_setec": false,
    "excepcion_cupo_setec_url": null,
    "estado_cohorte": "PLANIFICADA",
    "informe_evaluacion_cohorte_url": null,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 43. `PUT /api/cohorts/:id`

- **Acceso:** JWT + `COHORTE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarCohorte`; archivo `excepcion_cupo_pdf`.
- **Éxito:** HTTP 200; `data: cohortes_apertura`.
- **Atención:** Omitir estado_cohorte puede volver a PLANIFICADA.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Cohorte de apertura actualizada exitosamente",
  "data": {
    "id": "00000013-1111-4111-8111-111111111111",
    "programa_id": "00000013-1111-4111-8111-111111111111",
    "sede_id": "00000013-1111-4111-8111-111111111111",
    "modalidad": "PRESENCIAL",
    "codigo_cohorte": "CUR-2026-01",
    "numero_edicion": 1,
    "coordinador_id": "00000013-1111-4111-8111-111111111111",
    "fecha_inicio_inscripcion": "2026-10-01T00:00:00.000Z",
    "fecha_fin_inscripcion": "2026-10-20T00:00:00.000Z",
    "fecha_inicio_clases": "2026-11-01T00:00:00.000Z",
    "fecha_fin_clases": "2026-12-01T00:00:00.000Z",
    "horario_general": null,
    "precio_matricula": "0.00",
    "precio_total_cohorte": "0.00",
    "descuento_porcentaje": 0,
    "cupo_minimo": 15,
    "cupo_maximo": 30,
    "cupos_actuales_verificados": 0,
    "cobro_habilitado": false,
    "tiene_excepcion_cupo_setec": false,
    "excepcion_cupo_setec_url": null,
    "estado_cohorte": "PLANIFICADA",
    "informe_evaluacion_cohorte_url": null,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 44. `DELETE /api/cohorts/:id`

- **Acceso:** JWT + `COHORTE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Cohorte eliminada exitosamente"
}
```

#### 45. `POST /api/cohorts/:id/componentes`

- **Acceso:** JWT + `COHORTE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `ProgramarComponente`.
- **Éxito:** HTTP 201; `data: programacion_componentes_cohorte`.
- **Atención:** POST hace upsert: puede reemplazar la programación ya existente y responde 201 igualmente.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Docente y módulo programados exitosamente en la cohorte",
  "data": {
    "id": "00000014-1111-4111-8111-111111111111",
    "cohorte_id": "00000014-1111-4111-8111-111111111111",
    "componente_id": "00000014-1111-4111-8111-111111111111",
    "docente_titular_id": null,
    "fecha_inicio": null,
    "fecha_fin": null,
    "horario": null,
    "aula": null,
    "codigo_aula_virtual_externa": null,
    "actas_notas_cerradas": false
  }
}
```

#### 46. `PUT /api/cohorts/:id/componentes/:componenteId`

- **Acceso:** JWT + `COHORTE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID), `componenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `EditarProgramacion`.
- **Éxito:** HTTP 200; `data: programacion_componentes_cohorte`.
- **Atención:** componenteId es ID curricular; no programacion_componente_id.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Programación del módulo actualizada exitosamente",
  "data": {
    "id": "00000014-1111-4111-8111-111111111111",
    "cohorte_id": "00000014-1111-4111-8111-111111111111",
    "componente_id": "00000014-1111-4111-8111-111111111111",
    "docente_titular_id": null,
    "fecha_inicio": null,
    "fecha_fin": null,
    "horario": null,
    "aula": null,
    "codigo_aula_virtual_externa": null,
    "actas_notas_cerradas": false
  }
}
```

#### 47. `DELETE /api/cohorts/:id/componentes/:componenteId`

- **Acceso:** JWT + `COHORTE_GESTIONAR`.
- **Parámetros de ruta:** `id` (UUID), `componenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.
- **Atención:** Rechaza eliminación si actas_notas_cerradas=true; FK de notas también puede impedirla.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Programación del módulo eliminada exitosamente de la cohorte"
}
```

### 6.6. applicants (15 rutas)

Fuentes: `src/modules/applicants/applicant.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 48. `GET /api/applicants/me`

- **Acceso:** JWT.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: AspiranteDetalle`.
- **Atención:** Consulta de intereses incompatible con init.sql; ver sección 9.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "data": {
    "id": "00000015-1111-4111-8111-111111111111",
    "usuario_id": null,
    "tipo_identificacion": "CEDULA",
    "numero_identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
    "email": "ana@example.edu",
    "telefono": "+50588880000",
    "cedula_identidad_pdf_url": null,
    "identidad_verificada": false,
    "fecha_verificacion": null,
    "verificado_por_usuario_id": null,
    "tiene_discapacidad": false,
    "descripcion_ajuste_razonable": null,
    "tutor_nombre_completo": null,
    "tutor_identificacion": null,
    "tutor_documento_url": null,
    "created_at": "2026-10-20T12:00:00.000Z",
    "usuario_email": "ana@example.edu",
    "verificador_nombres": null,
    "verificador_apellidos": null,
    "intereses": [],
    "titulos": []
  }
}
```

#### 49. `PUT /api/applicants/me`

- **Acceso:** JWT.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarAspirante`; archivos/alias de perfil en sección 5.
- **Éxito:** HTTP 200; `data: AspiranteMutacion`.
- **Atención:** Omitir intereses los vacía; consulta posterior de intereses incompatible con init.sql y provoca rollback.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "message": "Tu perfil de aspirante ha sido actualizado",
  "data": {
    "id": "00000015-1111-4111-8111-111111111111",
    "usuario_id": null,
    "tipo_identificacion": "CEDULA",
    "numero_identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
    "email": "ana@example.edu",
    "telefono": "+50588880000",
    "cedula_identidad_pdf_url": null,
    "identidad_verificada": false,
    "fecha_verificacion": null,
    "verificado_por_usuario_id": null,
    "tiene_discapacidad": false,
    "descripcion_ajuste_razonable": null,
    "tutor_nombre_completo": null,
    "tutor_identificacion": null,
    "tutor_documento_url": null,
    "created_at": "2026-10-20T12:00:00.000Z",
    "intereses": [],
    "titulos": []
  }
}
```

#### 50. `GET /api/applicants/degrees/:degreeId`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `degreeId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: TituloDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000017-1111-4111-8111-111111111111",
    "aspirante_id": "00000017-1111-4111-8111-111111111111",
    "area_conocimiento_id": null,
    "nivel_titulo": "GRADO",
    "denominacion_titulo": "Licenciatura en Ingeniería",
    "institucion_emisora": "Universidad de ejemplo",
    "fecha_emision": "2026-10-20T00:00:00.000Z",
    "inscrito_registro_nacional": false,
    "codigo_registro_nacional": null,
    "certificado_rn_url": null,
    "titulo_pdf_url": "/uploads/documentos/titulo.pdf",
    "porcentaje_creditos_investigacion": "0.00",
    "estado_validacion": "PENDIENTE",
    "observacion_rechazo": null,
    "fecha_validacion": null,
    "usuario_validador_id": null,
    "area_nombre": null,
    "validador_nombres": null,
    "validador_apellidos": null
  }
}
```

#### 51. `PUT /api/applicants/degrees/:degreeId`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `degreeId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarTituloPrevio`; archivos/alias de título.
- **Éxito:** HTTP 200; `data: titulos_academicos_aspirante`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Título académico actualizado exitosamente",
  "data": {
    "id": "00000017-1111-4111-8111-111111111111",
    "aspirante_id": "00000017-1111-4111-8111-111111111111",
    "area_conocimiento_id": null,
    "nivel_titulo": "GRADO",
    "denominacion_titulo": "Licenciatura en Ingeniería",
    "institucion_emisora": "Universidad de ejemplo",
    "fecha_emision": "2026-10-20T00:00:00.000Z",
    "inscrito_registro_nacional": false,
    "codigo_registro_nacional": null,
    "certificado_rn_url": null,
    "titulo_pdf_url": "/uploads/documentos/titulo.pdf",
    "porcentaje_creditos_investigacion": "0.00",
    "estado_validacion": "PENDIENTE",
    "observacion_rechazo": null,
    "fecha_validacion": null,
    "usuario_validador_id": null
  }
}
```

#### 52. `DELETE /api/applicants/degrees/:degreeId`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `degreeId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; sin `data`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Título académico eliminado exitosamente"
}
```

#### 53. `PATCH /api/applicants/degrees/:degreeId/validate`

- **Acceso:** JWT + `INSCRIPCION_VALIDAR`.
- **Parámetros de ruta:** `degreeId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `ValidarTituloPrevio`.
- **Éxito:** HTTP 200; `data: titulos_academicos_aspirante`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Estado de validación del título actualizado a 'VALIDADO'",
  "data": {
    "id": "00000017-1111-4111-8111-111111111111",
    "aspirante_id": "00000017-1111-4111-8111-111111111111",
    "area_conocimiento_id": null,
    "nivel_titulo": "GRADO",
    "denominacion_titulo": "Licenciatura en Ingeniería",
    "institucion_emisora": "Universidad de ejemplo",
    "fecha_emision": "2026-10-20T00:00:00.000Z",
    "inscrito_registro_nacional": false,
    "codigo_registro_nacional": null,
    "certificado_rn_url": null,
    "titulo_pdf_url": "/uploads/documentos/titulo.pdf",
    "porcentaje_creditos_investigacion": "0.00",
    "estado_validacion": "VALIDADO",
    "observacion_rechazo": null,
    "fecha_validacion": "2026-10-20T12:00:00.000Z",
    "usuario_validador_id": "00000004-1111-4111-8111-111111111111"
  }
}
```

#### 54. `GET /api/applicants`

- **Acceso:** JWT + `INSCRIPCION_VALIDAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** `identidad_verificada?: boolean|string` (true/1/false/0), `search?: string` trim, `limit?: number|string`, `offset?: number|string` (parseFloat). DAO default limit50/max100, offset0; no validación de mínimo/entero en schema.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: AspiranteLista[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

#### 55. `POST /api/applicants`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearAspirante`; archivos/alias de perfil en sección 5.
- **Éxito:** HTTP 201; `data: AspiranteMutacion`.
- **Atención:** Sin intereses puede crearse; con intereses consulta ac.codigo y revierte transacción frente a init.sql.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Perfil de aspirante registrado exitosamente",
  "data": {
    "id": "00000015-1111-4111-8111-111111111111",
    "usuario_id": null,
    "tipo_identificacion": "CEDULA",
    "numero_identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
    "email": "ana@example.edu",
    "telefono": "+50588880000",
    "cedula_identidad_pdf_url": null,
    "identidad_verificada": false,
    "fecha_verificacion": null,
    "verificado_por_usuario_id": null,
    "tiene_discapacidad": false,
    "descripcion_ajuste_razonable": null,
    "tutor_nombre_completo": null,
    "tutor_identificacion": null,
    "tutor_documento_url": null,
    "created_at": "2026-10-20T12:00:00.000Z",
    "intereses": [],
    "titulos": []
  }
}
```

#### 56. `GET /api/applicants/:id`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: AspiranteDetalle`.
- **Atención:** Consulta de intereses incompatible con init.sql; ver sección 9.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "data": {
    "id": "00000015-1111-4111-8111-111111111111",
    "usuario_id": null,
    "tipo_identificacion": "CEDULA",
    "numero_identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
    "email": "ana@example.edu",
    "telefono": "+50588880000",
    "cedula_identidad_pdf_url": null,
    "identidad_verificada": false,
    "fecha_verificacion": null,
    "verificado_por_usuario_id": null,
    "tiene_discapacidad": false,
    "descripcion_ajuste_razonable": null,
    "tutor_nombre_completo": null,
    "tutor_identificacion": null,
    "tutor_documento_url": null,
    "created_at": "2026-10-20T12:00:00.000Z",
    "usuario_email": "ana@example.edu",
    "verificador_nombres": null,
    "verificador_apellidos": null,
    "intereses": [],
    "titulos": []
  }
}
```

#### 57. `PUT /api/applicants/:id`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarAspirante`; archivos/alias de perfil en sección 5.
- **Éxito:** HTTP 200; `data: AspiranteMutacion`.
- **Atención:** Omitir intereses los vacía; consulta posterior de intereses incompatible con init.sql y provoca rollback.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "message": "Perfil de aspirante actualizado exitosamente",
  "data": {
    "id": "00000015-1111-4111-8111-111111111111",
    "usuario_id": null,
    "tipo_identificacion": "CEDULA",
    "numero_identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
    "email": "ana@example.edu",
    "telefono": "+50588880000",
    "cedula_identidad_pdf_url": null,
    "identidad_verificada": false,
    "fecha_verificacion": null,
    "verificado_por_usuario_id": null,
    "tiene_discapacidad": false,
    "descripcion_ajuste_razonable": null,
    "tutor_nombre_completo": null,
    "tutor_identificacion": null,
    "tutor_documento_url": null,
    "created_at": "2026-10-20T12:00:00.000Z",
    "intereses": [],
    "titulos": []
  }
}
```

#### 58. `PATCH /api/applicants/:id/verify-identity`

- **Acceso:** JWT + `INSCRIPCION_VALIDAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: personas_aspirantes`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Identidad del aspirante verificada administrativamente",
  "data": {
    "id": "00000015-1111-4111-8111-111111111111",
    "usuario_id": null,
    "tipo_identificacion": "CEDULA",
    "numero_identificacion": "001-010190-0001A",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
    "email": "ana@example.edu",
    "telefono": "+50588880000",
    "cedula_identidad_pdf_url": null,
    "identidad_verificada": true,
    "fecha_verificacion": "2026-10-20T12:00:00.000Z",
    "verificado_por_usuario_id": "00000004-1111-4111-8111-111111111111",
    "tiene_discapacidad": false,
    "descripcion_ajuste_razonable": null,
    "tutor_nombre_completo": null,
    "tutor_identificacion": null,
    "tutor_documento_url": null,
    "created_at": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 59. `PUT /api/applicants/:id/interests`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `ReemplazarIntereses`: `{ "area_conocimiento_ids": [] }`.
- **Éxito:** HTTP 200; `data: Interes[]`.
- **Atención:** Consulta ac.codigo incompatible con init.sql; revierte transacción.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "message": "Intereses del aspirante actualizados exitosamente",
  "data": []
}
```

#### 60. `GET /api/applicants/:id/interests`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: Interes[]`.
- **Atención:** Consulta ac.codigo incompatible con init.sql.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "data": []
}
```

#### 61. `POST /api/applicants/:id/degrees`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearTituloPrevio`; archivos/alias de título en sección 5.
- **Éxito:** HTTP 201; `data: titulos_academicos_aspirante`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Título académico registrado exitosamente",
  "data": {
    "id": "00000017-1111-4111-8111-111111111111",
    "aspirante_id": "00000017-1111-4111-8111-111111111111",
    "area_conocimiento_id": null,
    "nivel_titulo": "GRADO",
    "denominacion_titulo": "Licenciatura en Ingeniería",
    "institucion_emisora": "Universidad de ejemplo",
    "fecha_emision": "2026-10-20T00:00:00.000Z",
    "inscrito_registro_nacional": false,
    "codigo_registro_nacional": null,
    "certificado_rn_url": null,
    "titulo_pdf_url": "/uploads/documentos/titulo.pdf",
    "porcentaje_creditos_investigacion": "0.00",
    "estado_validacion": "PENDIENTE",
    "observacion_rechazo": null,
    "fecha_validacion": null,
    "usuario_validador_id": null
  }
}
```

#### 62. `GET /api/applicants/:id/degrees`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: TituloDetalle[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

### 6.7. enrollments (11 rutas)

Fuentes: `src/modules/enrollments/enrollment.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 63. `GET /api/enrollments/me`

- **Acceso:** JWT.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: InscripcionDetalle[]`.
- **Atención:** Perfil desde JWT; sin perfil devuelve data=[] y total=0; máximo100 registros en esta consulta.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": [],
  "total": 0
}
```

#### 64. `PATCH /api/enrollments/payments/:paymentId/validate`

- **Acceso:** JWT + `PAGO_VALIDAR`.
- **Parámetros de ruta:** `paymentId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `ValidarPago`: `{ "estado": "APROBADO" }`.
- **Éxito:** HTTP 200; `data: PagoValidado`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Pago aprobado. La activación de matrícula requiere una decisión administrativa.",
  "data": {
    "pago": {
      "id": "00000019-1111-4111-8111-111111111111",
      "inscripcion_id": "00000019-1111-4111-8111-111111111111",
      "aspirante_id": "00000019-1111-4111-8111-111111111111",
      "metodo_pago": "BAUCHER_BANCARIO",
      "numero_referencia_o_recibo": "REF-2026-001",
      "banco_origen": null,
      "comprobante_baucher_url": null,
      "monto_subtotal": "100.00",
      "descuento_aplicado": "0.00",
      "total_pagado": "100.00",
      "concepto": "Matrícula",
      "estado": "APROBADO",
      "motivo_rechazo": null,
      "fecha_pago_reportada": "2026-10-20T12:00:00.000Z",
      "usuario_validador_caja_id": "00000004-1111-4111-8111-111111111111",
      "fecha_validacion_caja": "2026-10-20T12:00:00.000Z"
    },
    "inscripcion": {
      "id": "00000018-1111-4111-8111-111111111111",
      "codigo_expediente": "EXP-2026-A1B2C3D4",
      "aspirante_id": "00000018-1111-4111-8111-111111111111",
      "cohorte_id": "00000018-1111-4111-8111-111111111111",
      "titulo_presentado_id": null,
      "estado": "MATRICULADO_ACTIVO",
      "observaciones_administracion": null,
      "rol_participacion": "ESTUDIANTE_EVALUADO",
      "titulo_ponencia": null,
      "resumen_ponencia": null,
      "archivo_ponencia_url": null,
      "es_reingreso_cambio_plan": false,
      "inscripcion_origen_id": null,
      "requiere_nivelacion_investigativa": false,
      "acepta_compromiso_idioma_y_publicacion": false,
      "fecha_inscripcion": "2026-10-20T12:00:00.000Z",
      "fecha_aprobacion_documental": null,
      "fecha_formalizacion_matricula": "2026-10-20T12:00:00.000Z",
      "aspirante_nombres": "Ana",
      "aspirante_apellidos": "Pérez",
      "aspirante_identificacion": "001-010190-0001A",
      "aspirante_tipo_identificacion": "CEDULA",
      "aspirante_email": "ana@example.edu",
      "aspirante_telefono": "+50588880000",
      "aspirante_usuario_id": "00000004-1111-4111-8111-111111111111",
      "cohorte_codigo": "CUR-2026-01",
      "numero_edicion": 1,
      "cohorte_modalidad": "PRESENCIAL",
      "precio_matricula": "100.00",
      "precio_total_cohorte": "100.00",
      "cupo_minimo": 15,
      "cupo_maximo": 30,
      "cupos_actuales_verificados": 15,
      "cobro_habilitado": true,
      "estado_cohorte": "QUORUM_ALCANZADO_COBRANDO",
      "programa_id": "00000010-1111-4111-8111-111111111111",
      "programa_nombre": "Ingeniería",
      "programa_codigo": "CUR-001",
      "programa_categoria": "EDUCACION_PERMANENTE",
      "programa_subtipo": "CURSO_EXTENSION",
      "requiere_titulo_grado_rn": false,
      "titulo_denominacion": null,
      "titulo_nivel": null,
      "titulo_institucion": null,
      "titulo_estado_validacion": null
    }
  }
}
```

#### 65. `PATCH /api/enrollments/convalidations/:convalidationId/dictamen`

- **Acceso:** JWT + `CONVALIDACION_DICTAMINAR`.
- **Parámetros de ruta:** `convalidationId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `DictaminarConvalidacion`: `{ "estado_dictamen": "APROBADA" }`.
- **Éxito:** HTTP 200; `data: solicitudes_convalidacion_acreditacion`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Solicitud de convalidación aprobada exitosamente",
  "data": {
    "id": "00000020-1111-4111-8111-111111111111",
    "inscripcion_destino_id": "00000020-1111-4111-8111-111111111111",
    "componente_destino_id": "00000020-1111-4111-8111-111111111111",
    "origen_tipo": "EXTERNO",
    "inscripcion_origen_ep_id": null,
    "certificado_origen_url": "/uploads/convalidaciones/certificado.pdf",
    "creditos_reconocidos": 1,
    "justificacion_aporte_perfil": "Formación equivalente en investigación",
    "estado_dictamen": "APROBADA",
    "coordinador_dictaminador_id": null,
    "fecha_dictamen": "2026-10-20T12:00:00.000Z"
  }
}
```

#### 66. `GET /api/enrollments`

- **Acceso:** JWT + `INSCRIPCION_VALIDAR`.
- **Parámetros de ruta:** ninguno.
- **Query:** `cohorte_id?: UUID`, `aspirante_id?: UUID`, `estado?: EstadoInscripcion`, `page?: entero>=1` default1, `limit?: entero1–100` default20 (parseInt), `search?: string`.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: InscripcionDetalle[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

#### 67. `POST /api/enrollments`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearInscripcion`; archivo `archivo_ponencia` o `archivo_ponencia_url`.
- **Éxito:** HTTP 201; `data: InscripcionDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Inscripción registrada exitosamente",
  "data": {
    "id": "00000018-1111-4111-8111-111111111111",
    "codigo_expediente": "EXP-2026-A1B2C3D4",
    "aspirante_id": "00000018-1111-4111-8111-111111111111",
    "cohorte_id": "00000018-1111-4111-8111-111111111111",
    "titulo_presentado_id": null,
    "estado": "EN_REVISION_DOCUMENTAL",
    "observaciones_administracion": null,
    "rol_participacion": "ESTUDIANTE_EVALUADO",
    "titulo_ponencia": null,
    "resumen_ponencia": null,
    "archivo_ponencia_url": null,
    "es_reingreso_cambio_plan": false,
    "inscripcion_origen_id": null,
    "requiere_nivelacion_investigativa": false,
    "acepta_compromiso_idioma_y_publicacion": false,
    "fecha_inscripcion": "2026-10-20T12:00:00.000Z",
    "fecha_aprobacion_documental": null,
    "fecha_formalizacion_matricula": null,
    "aspirante_nombres": "Ana",
    "aspirante_apellidos": "Pérez",
    "aspirante_identificacion": "001-010190-0001A",
    "aspirante_tipo_identificacion": "CEDULA",
    "aspirante_email": "ana@example.edu",
    "aspirante_telefono": "+50588880000",
    "aspirante_usuario_id": "00000004-1111-4111-8111-111111111111",
    "cohorte_codigo": "CUR-2026-01",
    "numero_edicion": 1,
    "cohorte_modalidad": "PRESENCIAL",
    "precio_matricula": "100.00",
    "precio_total_cohorte": "100.00",
    "cupo_minimo": 15,
    "cupo_maximo": 30,
    "cupos_actuales_verificados": 0,
    "cobro_habilitado": false,
    "estado_cohorte": "INSCRIPCION_ABIERTA",
    "programa_id": "00000010-1111-4111-8111-111111111111",
    "programa_nombre": "Ingeniería",
    "programa_codigo": "CUR-001",
    "programa_categoria": "EDUCACION_PERMANENTE",
    "programa_subtipo": "CURSO_EXTENSION",
    "requiere_titulo_grado_rn": false,
    "titulo_denominacion": null,
    "titulo_nivel": null,
    "titulo_institucion": null,
    "titulo_estado_validacion": null
  }
}
```

#### 68. `GET /api/enrollments/:id`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: DossierInscripcion`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "inscripcion": {
      "id": "00000018-1111-4111-8111-111111111111",
      "codigo_expediente": "EXP-2026-A1B2C3D4",
      "aspirante_id": "00000018-1111-4111-8111-111111111111",
      "cohorte_id": "00000018-1111-4111-8111-111111111111",
      "titulo_presentado_id": null,
      "estado": "EN_REVISION_DOCUMENTAL",
      "observaciones_administracion": null,
      "rol_participacion": "ESTUDIANTE_EVALUADO",
      "titulo_ponencia": null,
      "resumen_ponencia": null,
      "archivo_ponencia_url": null,
      "es_reingreso_cambio_plan": false,
      "inscripcion_origen_id": null,
      "requiere_nivelacion_investigativa": false,
      "acepta_compromiso_idioma_y_publicacion": false,
      "fecha_inscripcion": "2026-10-20T12:00:00.000Z",
      "fecha_aprobacion_documental": null,
      "fecha_formalizacion_matricula": null,
      "aspirante_nombres": "Ana",
      "aspirante_apellidos": "Pérez",
      "aspirante_identificacion": "001-010190-0001A",
      "aspirante_tipo_identificacion": "CEDULA",
      "aspirante_email": "ana@example.edu",
      "aspirante_telefono": "+50588880000",
      "aspirante_usuario_id": "00000004-1111-4111-8111-111111111111",
      "cohorte_codigo": "CUR-2026-01",
      "numero_edicion": 1,
      "cohorte_modalidad": "PRESENCIAL",
      "precio_matricula": "100.00",
      "precio_total_cohorte": "100.00",
      "cupo_minimo": 15,
      "cupo_maximo": 30,
      "cupos_actuales_verificados": 0,
      "cobro_habilitado": false,
      "estado_cohorte": "INSCRIPCION_ABIERTA",
      "programa_id": "00000010-1111-4111-8111-111111111111",
      "programa_nombre": "Ingeniería",
      "programa_codigo": "CUR-001",
      "programa_categoria": "EDUCACION_PERMANENTE",
      "programa_subtipo": "CURSO_EXTENSION",
      "requiere_titulo_grado_rn": false,
      "titulo_denominacion": null,
      "titulo_nivel": null,
      "titulo_institucion": null,
      "titulo_estado_validacion": null
    },
    "pagos": [],
    "convalidaciones": []
  }
}
```

#### 69. `PATCH /api/enrollments/:id/validate-documents`

- **Acceso:** JWT + `INSCRIPCION_VALIDAR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `ValidarDocumentos`: `{ "aprobado": true, "observaciones_administracion": null }`.
- **Éxito:** HTTP 200; `data: InscripcionDetalle`.
- **Atención:** Transaccional: actualiza contador/quórum y otras inscripciones; recargar cohortes/listado después.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Documentos validados y estado de inscripción actualizado exitosamente",
  "data": {
    "id": "00000018-1111-4111-8111-111111111111",
    "codigo_expediente": "EXP-2026-A1B2C3D4",
    "aspirante_id": "00000018-1111-4111-8111-111111111111",
    "cohorte_id": "00000018-1111-4111-8111-111111111111",
    "titulo_presentado_id": null,
    "estado": "INSCRITO_RESERVADO",
    "observaciones_administracion": null,
    "rol_participacion": "ESTUDIANTE_EVALUADO",
    "titulo_ponencia": null,
    "resumen_ponencia": null,
    "archivo_ponencia_url": null,
    "es_reingreso_cambio_plan": false,
    "inscripcion_origen_id": null,
    "requiere_nivelacion_investigativa": false,
    "acepta_compromiso_idioma_y_publicacion": false,
    "fecha_inscripcion": "2026-10-20T12:00:00.000Z",
    "fecha_aprobacion_documental": "2026-10-20T12:00:00.000Z",
    "fecha_formalizacion_matricula": null,
    "aspirante_nombres": "Ana",
    "aspirante_apellidos": "Pérez",
    "aspirante_identificacion": "001-010190-0001A",
    "aspirante_tipo_identificacion": "CEDULA",
    "aspirante_email": "ana@example.edu",
    "aspirante_telefono": "+50588880000",
    "aspirante_usuario_id": "00000004-1111-4111-8111-111111111111",
    "cohorte_codigo": "CUR-2026-01",
    "numero_edicion": 1,
    "cohorte_modalidad": "PRESENCIAL",
    "precio_matricula": "100.00",
    "precio_total_cohorte": "100.00",
    "cupo_minimo": 15,
    "cupo_maximo": 30,
    "cupos_actuales_verificados": 1,
    "cobro_habilitado": false,
    "estado_cohorte": "INSCRIPCION_ABIERTA",
    "programa_id": "00000010-1111-4111-8111-111111111111",
    "programa_nombre": "Ingeniería",
    "programa_codigo": "CUR-001",
    "programa_categoria": "EDUCACION_PERMANENTE",
    "programa_subtipo": "CURSO_EXTENSION",
    "requiere_titulo_grado_rn": false,
    "titulo_denominacion": null,
    "titulo_nivel": null,
    "titulo_institucion": null,
    "titulo_estado_validacion": null
  }
}
```

#### 70. `POST /api/enrollments/:id/payments`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearPago`; archivo `comprobante_baucher`, `comprobante_baucher_url` o `baucher`.
- **Éxito:** HTTP 201; `data: pagos_inscripcion`.
- **Atención:** Requiere cobro_habilitado=true Y estado permitido; no comprueba propietario ni monto esperado.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Comprobante de pago registrado exitosamente en revisión",
  "data": {
    "id": "00000019-1111-4111-8111-111111111111",
    "inscripcion_id": "00000019-1111-4111-8111-111111111111",
    "aspirante_id": "00000019-1111-4111-8111-111111111111",
    "metodo_pago": "BAUCHER_BANCARIO",
    "numero_referencia_o_recibo": "REF-2026-001",
    "banco_origen": null,
    "comprobante_baucher_url": null,
    "monto_subtotal": "100.00",
    "descuento_aplicado": "0.00",
    "total_pagado": "100.00",
    "concepto": "Matrícula",
    "estado": "PENDIENTE_REVISION",
    "motivo_rechazo": null,
    "fecha_pago_reportada": "2026-10-20T12:00:00.000Z",
    "usuario_validador_caja_id": null,
    "fecha_validacion_caja": null
  }
}
```

#### 71. `GET /api/enrollments/:id/payments`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: pagos_inscripcion[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 72. `POST /api/enrollments/:id/convalidations`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearConvalidacion`; archivo `certificado_origen` o `certificado_origen_url`.
- **Éxito:** HTTP 201; `data: solicitudes_convalidacion_acreditacion`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Solicitud de convalidación registrada exitosamente",
  "data": {
    "id": "00000020-1111-4111-8111-111111111111",
    "inscripcion_destino_id": "00000020-1111-4111-8111-111111111111",
    "componente_destino_id": "00000020-1111-4111-8111-111111111111",
    "origen_tipo": "EXTERNO",
    "inscripcion_origen_ep_id": null,
    "certificado_origen_url": "/uploads/convalidaciones/certificado.pdf",
    "creditos_reconocidos": 1,
    "justificacion_aporte_perfil": "Formación equivalente en investigación",
    "estado_dictamen": "PENDIENTE",
    "coordinador_dictaminador_id": null,
    "fecha_dictamen": null
  }
}
```

#### 73. `GET /api/enrollments/:id/convalidations`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ConvalidacionDetalle[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

### 6.8. grades (6 rutas)

Fuentes: `src/modules/grades/grades.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 74. `POST /api/grades/import/:programacionComponenteId`

- **Acceso:** JWT + `NOTA_IMPORTAR`.
- **Parámetros de ruta:** `programacionComponenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Multipart `ImportarNotas`: `archivo_excel` obligatorio y `observaciones?`.
- **Éxito:** HTTP 201; `data: Importacion`.
- **Atención:** Consulta previa usa columnas curriculares inexistentes en init.sql; 500 antes de importar. Flujo previsto y formato Excel en sección 8.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "message": "Acta de calificaciones procesada. Registros actualizados: 1",
  "data": {
    "lote": {
      "id": "00000021-1111-4111-8111-111111111111",
      "programacion_componente_id": "00000021-1111-4111-8111-111111111111",
      "subido_por_usuario_id": "00000021-1111-4111-8111-111111111111",
      "archivo_excel_url": "/uploads/actas_excel/acta.xlsx",
      "total_registros_procesados": 1,
      "observaciones": null,
      "created_at": "2026-10-20T12:00:00.000Z"
    },
    "total_filas_leidas": 1,
    "total_registros_procesados": 1,
    "errores_filas": []
  }
}
```

#### 75. `PATCH /api/grades/:matriculaComponenteId`

- **Acceso:** JWT + `NOTA_MODIFICAR`.
- **Parámetros de ruta:** `matriculaComponenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `ModificarNota`.
- **Éxito:** HTTP 200; `data: NotaModificada`.
- **Atención:** Lectura previa incompatible con init.sql; no hay guard de actas cerradas en servicio manual.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "message": "Calificación modificada exitosamente y registrada en auditoría de notas",
  "data": {
    "grade": {
      "id": "00000022-1111-4111-8111-111111111111",
      "inscripcion_id": "00000022-1111-4111-8111-111111111111",
      "programacion_componente_id": "00000022-1111-4111-8111-111111111111",
      "componente_id": "00000022-1111-4111-8111-111111111111",
      "lote_importacion_id": null,
      "es_convalidada": false,
      "calificacion_cuantitativa": "95.00",
      "valoracion_cualitativa": "APRENDIZAJE_AVANZADO",
      "observacion_acompanamiento_pedagogico": null,
      "autoevaluacion_completada": false,
      "coevaluacion_completada": false,
      "aprobado": true,
      "es_modificada_manualmente": true,
      "registrado_por_usuario_id": "00000004-1111-4111-8111-111111111111",
      "fecha_registro": "2026-10-20T12:00:00.000Z"
    },
    "auditLog": {
      "id": "00000023-1111-4111-8111-111111111111",
      "matricula_componente_id": "00000023-1111-4111-8111-111111111111",
      "nota_anterior": "0.00",
      "nota_nueva": "95.00",
      "cualitativa_anterior": null,
      "cualitativa_nueva": "APRENDIZAJE_AVANZADO",
      "motivo_modificacion": "Corrección de acta autorizada",
      "modificado_por_usuario_id": "00000004-1111-4111-8111-111111111111",
      "fecha_modificacion": "2026-10-20T12:00:00.000Z"
    }
  }
}
```

#### 76. `GET /api/grades/component/:programacionComponenteId`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `programacionComponenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: NotaDetalle[]`.
- **Atención:** Lectura previa de programación incompatible con init.sql.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "data": []
}
```

#### 77. `GET /api/grades/lots/:programacionComponenteId`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `programacionComponenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: LoteDetalle[]`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 78. `GET /api/grades/student/:inscripcionId`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `inscripcionId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: NotaKardex[]`.
- **Atención:** Consulta incompatible con columnas curriculares de init.sql.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "data": []
}
```

#### 79. `GET /api/grades/:matriculaComponenteId/logs`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `matriculaComponenteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: LogDetalle[]`.
- **Atención:** Lectura previa y u.rol incompatibles con init.sql.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "data": []
}
```

### 6.9. graduation (9 rutas)

Fuentes: `src/modules/graduation/graduation.routes.ts`, schema, controlador, servicio y DAO del mismo directorio.

#### 80. `GET /api/graduation/verify/:codigoRegistro`

- **Acceso:** Público.
- **Parámetros de ruta:** `codigoRegistro` (texto).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: VerificacionPublica`.
- **Atención:** Público sin JWT; consulta usa sedes_universitarias inexistente en init.sql. No devuelve imagen QR ni PDF generado.

Ejemplo de respuesta de éxito previsto; **incompatible con init.sql**, ver sección 9:

```json
{
  "success": true,
  "data": {
    "autenticidad_verificada": true,
    "codigo_registro": "SETEC-CURSOEXTENSION-2026-A1B2C3",
    "tipo_documento": "CERTIFICADO_APROBACION",
    "fecha_emision": "2026-10-20T00:00:00.000Z",
    "estudiante": {
      "nombres": "Ana",
      "apellidos": "Pérez",
      "tipo_identificacion": "CEDULA",
      "numero_identificacion": "001-010190-0001A"
    },
    "programa": {
      "nombre": "Ingeniería",
      "categoria": "EDUCACION_PERMANENTE",
      "subtipo": "CURSO_EXTENSION",
      "titulo_o_certificado_otorgado": "Certificado de aprobación"
    },
    "cohorte": {
      "codigo_cohorte": "CUR-2026-01",
      "sede": "Sede Central"
    },
    "documento_digital_url": null
  }
}
```

#### 81. `POST /api/graduation/expediente`

- **Acceso:** JWT + `TITULO_EMITIR`.
- **Parámetros de ruta:** ninguno.
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `CrearExpediente`; archivos/alias de expediente de sección 5.
- **Éxito:** HTTP 201; `data: expediente_graduacion_certificacion`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Expediente de graduación creado exitosamente",
  "data": {
    "id": "00000024-1111-4111-8111-111111111111",
    "inscripcion_id": "00000024-1111-4111-8111-111111111111",
    "idioma_acreditado": null,
    "nivel_idioma_alcanzado": "NINGUNO",
    "institucion_aval_idioma": null,
    "certificado_idioma_url": null,
    "idioma_validado": false,
    "modalidad_graduacion_tipo": null,
    "titulo_trabajo_graduacion": null,
    "acta_defensa_url": null,
    "aplico_salida_intermedia": false,
    "titulo_intermedio_emitido_url": null,
    "tipo_documento_final": "CERTIFICADO_APROBACION",
    "codigo_registro_titulo_emitido": null,
    "documento_final_url": null,
    "fecha_emision": null,
    "emitido_por_usuario_id": null
  }
}
```

#### 82. `GET /api/graduation/expediente/:id`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ExpedienteDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000024-1111-4111-8111-111111111111",
    "inscripcion_id": "00000024-1111-4111-8111-111111111111",
    "idioma_acreditado": null,
    "nivel_idioma_alcanzado": "NINGUNO",
    "institucion_aval_idioma": null,
    "certificado_idioma_url": null,
    "idioma_validado": false,
    "modalidad_graduacion_tipo": null,
    "titulo_trabajo_graduacion": null,
    "acta_defensa_url": null,
    "aplico_salida_intermedia": false,
    "titulo_intermedio_emitido_url": null,
    "tipo_documento_final": "CERTIFICADO_APROBACION",
    "codigo_registro_titulo_emitido": null,
    "documento_final_url": null,
    "fecha_emision": null,
    "emitido_por_usuario_id": null,
    "codigo_expediente": "EXP-2026-A1B2C3D4",
    "inscripcion_estado": "MATRICULADO_ACTIVO",
    "aspirante_nombres": "Ana",
    "aspirante_apellidos": "Pérez",
    "numero_identificacion": "001-010190-0001A",
    "programa_nombre": "Ingeniería",
    "programa_subtipo": "CURSO_EXTENSION",
    "codigo_cohorte": "CUR-2026-01",
    "publicaciones": []
  }
}
```

#### 83. `GET /api/graduation/enrollment/:inscripcionId`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `inscripcionId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: ExpedienteDetalle`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": {
    "id": "00000024-1111-4111-8111-111111111111",
    "inscripcion_id": "00000024-1111-4111-8111-111111111111",
    "idioma_acreditado": null,
    "nivel_idioma_alcanzado": "NINGUNO",
    "institucion_aval_idioma": null,
    "certificado_idioma_url": null,
    "idioma_validado": false,
    "modalidad_graduacion_tipo": null,
    "titulo_trabajo_graduacion": null,
    "acta_defensa_url": null,
    "aplico_salida_intermedia": false,
    "titulo_intermedio_emitido_url": null,
    "tipo_documento_final": "CERTIFICADO_APROBACION",
    "codigo_registro_titulo_emitido": null,
    "documento_final_url": null,
    "fecha_emision": null,
    "emitido_por_usuario_id": null,
    "codigo_expediente": "EXP-2026-A1B2C3D4",
    "inscripcion_estado": "MATRICULADO_ACTIVO",
    "aspirante_nombres": "Ana",
    "aspirante_apellidos": "Pérez",
    "numero_identificacion": "001-010190-0001A",
    "programa_nombre": "Ingeniería",
    "programa_subtipo": "CURSO_EXTENSION",
    "codigo_cohorte": "CUR-2026-01",
    "publicaciones": []
  }
}
```

#### 84. `PATCH /api/graduation/expediente/:id`

- **Acceso:** JWT + `TITULO_EMITIR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EditarExpediente`; archivos/alias de expediente.
- **Éxito:** HTTP 200; `data: expediente_graduacion_certificacion`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Expediente de graduación actualizado exitosamente",
  "data": {
    "id": "00000024-1111-4111-8111-111111111111",
    "inscripcion_id": "00000024-1111-4111-8111-111111111111",
    "idioma_acreditado": null,
    "nivel_idioma_alcanzado": "NINGUNO",
    "institucion_aval_idioma": null,
    "certificado_idioma_url": null,
    "idioma_validado": false,
    "modalidad_graduacion_tipo": null,
    "titulo_trabajo_graduacion": null,
    "acta_defensa_url": null,
    "aplico_salida_intermedia": false,
    "titulo_intermedio_emitido_url": null,
    "tipo_documento_final": "CERTIFICADO_APROBACION",
    "codigo_registro_titulo_emitido": null,
    "documento_final_url": null,
    "fecha_emision": null,
    "emitido_por_usuario_id": null
  }
}
```

#### 85. `POST /api/graduation/expediente/:expedienteId/publications`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `expedienteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Multipart `CrearPublicacion`; archivo `evidencia_pdf` obligatorio.
- **Éxito:** HTTP 201; `data: publicaciones_cientificas_estudiante`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Publicación científica registrada exitosamente en el expediente",
  "data": {
    "id": "00000025-1111-4111-8111-111111111111",
    "expediente_graduacion_id": "00000025-1111-4111-8111-111111111111",
    "tipo_publicacion": "ARTICULO_CIENTIFICO",
    "titulo_publicacion": "Investigación aplicada",
    "nombre_revista_o_medio": "Revista académica",
    "es_revista_indexada": false,
    "tiene_revision_pares": false,
    "alcance": null,
    "url_o_doi": "https://example.edu/articulo",
    "evidencia_pdf_url": "/uploads/documentos/articulo.pdf",
    "validado_coordinacion": false
  }
}
```

#### 86. `GET /api/graduation/expediente/:expedienteId/publications`

- **Acceso:** JWT. Sin comprobación de propietario/asignación adicional.
- **Parámetros de ruta:** `expedienteId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** Sin body.
- **Éxito:** HTTP 200; `data: publicaciones_cientificas_estudiante[]`.
- **Atención:** No exige existencia del expediente; puede responder array vacío.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "data": []
}
```

#### 87. `PATCH /api/graduation/publications/:publicationId/validate`

- **Acceso:** JWT + `TITULO_EMITIR`.
- **Parámetros de ruta:** `publicationId` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON `ValidarPublicacion`: `{ "validado_coordinacion": true }`.
- **Éxito:** HTTP 200; `data: publicaciones_cientificas_estudiante`.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Publicación científica validada exitosamente",
  "data": {
    "id": "00000025-1111-4111-8111-111111111111",
    "expediente_graduacion_id": "00000025-1111-4111-8111-111111111111",
    "tipo_publicacion": "ARTICULO_CIENTIFICO",
    "titulo_publicacion": "Investigación aplicada",
    "nombre_revista_o_medio": "Revista académica",
    "es_revista_indexada": false,
    "tiene_revision_pares": false,
    "alcance": null,
    "url_o_doi": "https://example.edu/articulo",
    "evidencia_pdf_url": "/uploads/documentos/articulo.pdf",
    "validado_coordinacion": true
  }
}
```

#### 88. `POST /api/graduation/expediente/:id/issue`

- **Acceso:** JWT + `TITULO_EMITIR`.
- **Parámetros de ruta:** `id` (UUID).
- **Query:** Sin query reconocida.
- **Body:** JSON o multipart `EmitirDocumento`; archivo `documento_final` opcional.
- **Éxito:** HTTP 200; `data: Emision`.
- **Atención:** Registra código/fecha/documento aportado, no genera PDF/QR. Puede emitir sin documento_final_url.

Ejemplo de respuesta de éxito:

```json
{
  "success": true,
  "message": "Título o certificado emitido exitosamente. Código de Registro: SETEC-CURSOEXTENSION-2026-A1B2C3",
  "data": {
    "expediente": {
      "id": "00000024-1111-4111-8111-111111111111",
      "inscripcion_id": "00000024-1111-4111-8111-111111111111",
      "idioma_acreditado": null,
      "nivel_idioma_alcanzado": "NINGUNO",
      "institucion_aval_idioma": null,
      "certificado_idioma_url": null,
      "idioma_validado": false,
      "modalidad_graduacion_tipo": null,
      "titulo_trabajo_graduacion": null,
      "acta_defensa_url": null,
      "aplico_salida_intermedia": false,
      "titulo_intermedio_emitido_url": null,
      "tipo_documento_final": "CERTIFICADO_APROBACION",
      "codigo_registro_titulo_emitido": "SETEC-CURSOEXTENSION-2026-A1B2C3",
      "documento_final_url": null,
      "fecha_emision": "2026-10-20T00:00:00.000Z",
      "emitido_por_usuario_id": "00000004-1111-4111-8111-111111111111"
    },
    "codigo_registro": "SETEC-CURSOEXTENSION-2026-A1B2C3",
    "fecha_emision": "2026-10-20",
    "estado_inscripcion": "GRADUADO_O_CERTIFICADO",
    "estudiante": "Ana Pérez",
    "programa": "Ingeniería"
  }
}
```

## 7. Campos completos de datos y proyecciones

Las tablas SQL siguientes enumeran todos los campos de cada entidad de persistencia, incluidos campos internos que **no** se entregan en todos los endpoints. `NULL` depende de la definición SQL, no del default. No usar los modelos de usuarios/sesiones para deducir respuestas públicas: autenticación devuelve exclusivamente PerfilUsuario. No existe un CRUD HTTP por cada tabla. Las respuestas de las mutaciones marcadas con nombre de tabla usan las columnas de esa tabla (`RETURNING *`); las proyecciones agregan o seleccionan campos como se especifica después.

### 7.1. Entidades SQL (25 tablas)

#### `permisos`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `codigo` | `VARCHAR(50)` | No | — |
| `nombre` | `VARCHAR(150)` | No | — |
| `descripcion` | `TEXT` | Sí | — |

#### `roles`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `nombre` | `VARCHAR(50)` | No | — |
| `descripcion` | `TEXT` | Sí | — |

#### `roles_permisos`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `rol_id` | `UUID` | No | — |
| `permiso_id` | `UUID` | No | — |

#### `usuarios`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `username` | `VARCHAR(60)` | Sí | — |
| `email` | `VARCHAR(150)` | No | — |
| `password_hash` | `VARCHAR(255)` | No | — |
| `nombres` | `VARCHAR(100)` | No | — |
| `apellidos` | `VARCHAR(100)` | No | — |
| `telefono` | `VARCHAR(30)` | Sí | — |
| `avatar_url` | `TEXT` | Sí | — |
| `rol_id` | `UUID` | No | — |
| `activo` | `BOOLEAN` | Sí | `TRUE` |
| `email_verificado` | `BOOLEAN` | Sí | `FALSE` |
| `created_at` | `TIMESTAMPTZ` | Sí | `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `sesiones`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `usuario_id` | `UUID` | No | — |
| `direccion_ip` | `VARCHAR(48)` | Sí | — |
| `user_agent` | `TEXT` | Sí | — |
| `payload` | `TEXT` | Sí | — |
| `refresh_token_hash` | `VARCHAR(255)` | No | — |
| `is_token_revocado` | `BOOLEAN` | Sí | `FALSE` |
| `creacion_token` | `TIMESTAMPTZ` | Sí | `NOW()` |
| `expiracion_token` | `TIMESTAMPTZ` | No | — |
| `ultima_actividad` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `areas_conocimiento`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `nombre` | `VARCHAR(120)` | No | — |
| `slug` | `VARCHAR(140)` | No | — |
| `icono_url` | `TEXT` | Sí | — |
| `activa` | `BOOLEAN` | Sí | `TRUE` |

#### `tags_academicos`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `nombre` | `VARCHAR(80)` | No | — |
| `slug` | `VARCHAR(100)` | No | — |

#### `sedes_ies`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `codigo_sede` | `VARCHAR(30)` | No | — |
| `nombre` | `VARCHAR(150)` | No | — |
| `tipo_sede` | `VARCHAR(30)` | No | — |
| `resolucion_autorizacion_setec` | `VARCHAR(100)` | Sí | — |
| `direccion` | `TEXT` | Sí | — |
| `activa` | `BOOLEAN` | Sí | `TRUE` |
| `created_at` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `personal_academico`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `usuario_id` | `UUID` | Sí | — |
| `identificacion` | `VARCHAR(30)` | No | — |
| `nombres` | `VARCHAR(100)` | No | — |
| `apellidos` | `VARCHAR(100)` | No | — |
| `maximo_grado_academico` | `VARCHAR(50)` | No | — |
| `biografia_comercial` | `TEXT` | Sí | — |
| `foto_perfil_url` | `TEXT` | Sí | — |
| `cv_url` | `TEXT` | No | — |
| `activo` | `BOOLEAN` | Sí | `TRUE` |
| `created_at` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `programas_academicos`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `codigo_interno` | `VARCHAR(30)` | No | — |
| `codigo_dictamen_setec` | `VARCHAR(80)` | Sí | — |
| `fecha_aprobacion_setec` | `DATE` | Sí | — |
| `nombre` | `VARCHAR(250)` | No | — |
| `slug` | `VARCHAR(280)` | No | — |
| `categoria` | `categoria_programa_enum` | No | — |
| `subtipo` | `subtipo_programa_enum` | No | — |
| `area_conocimiento_id` | `UUID` | No | — |
| `resumen_corto_web` | `VARCHAR(500)` | Sí | — |
| `descripcion_comercial` | `TEXT` | Sí | — |
| `imagen_portada_url` | `TEXT` | Sí | — |
| `video_promo_url` | `TEXT` | Sí | — |
| `brochure_pdf_url` | `TEXT` | Sí | — |
| `precio_total_referencia` | `NUMERIC(12,2)` | No | `0.00` |
| `descuento_porcentaje` | `INT` | Sí | `0` |
| `visible_en_web` | `BOOLEAN` | Sí | `FALSE` |
| `es_ciencias_salud` | `BOOLEAN` | Sí | `FALSE` |
| `aval_minsa_url` | `TEXT` | Sí | — |
| `duracion_meses` | `NUMERIC(4,1)` | Sí | — |
| `horas_totales` | `INT` | No | — |
| `creditos_totales` | `INT` | No | `0` |
| `creditos_investigacion` | `INT` | No | `0` |
| `permite_continuidad_doctorado` | `BOOLEAN` | Sí | `FALSE` |
| `programa_salida_intermedia_id` | `UUID` | Sí | — |
| `programa_destino_acreditable_id` | `UUID` | Sí | — |
| `es_acreditable_a_posgrado` | `BOOLEAN` | Sí | `FALSE` |
| `estructurado_por_cursos` | `BOOLEAN` | Sí | `TRUE` |
| `requiere_titulo_grado_rn` | `BOOLEAN` | Sí | `FALSE` |
| `requiere_titulo_profesional` | `BOOLEAN` | Sí | `FALSE` |
| `permite_menores_edad` | `BOOLEAN` | Sí | `FALSE` |
| `idioma_egreso_requerido` | `nivel_idioma_mcer_enum` | Sí | `'NINGUNO'` |
| `num_publicaciones_requeridas` | `INT` | Sí | `0` |
| `requiere_revista_indexada` | `BOOLEAN` | Sí | `FALSE` |
| `requiere_pares_evaluadores` | `BOOLEAN` | Sí | `FALSE` |
| `titulo_o_certificado_otorgado` | `VARCHAR(200)` | No | — |
| `abreviatura_grado` | `VARCHAR(20)` | Sí | — |
| `estado_vigencia` | `VARCHAR(30)` | Sí | `'ACTIVO'` |
| `created_at` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `programas_tags`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `programa_id` | `UUID` | No | — |
| `tag_id` | `UUID` | No | — |

#### `componentes_curriculares`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `programa_id` | `UUID` | No | — |
| `codigo` | `VARCHAR(30)` | No | — |
| `nombre` | `VARCHAR(200)` | No | — |
| `descripcion_temario` | `TEXT` | Sí | — |
| `orden_bloque` | `INT` | No | `1` |
| `horas` | `INT` | No | — |
| `creditos` | `INT` | No | `0` |
| `es_investigacion` | `BOOLEAN` | Sí | `FALSE` |
| `es_modalidad_graduacion` | `BOOLEAN` | Sí | `FALSE` |
| `es_practica_profesional` | `BOOLEAN` | Sí | `FALSE` |
| `costo_base_asignatura` | `NUMERIC(12,2)` | No | `0.00` |
| `url_silabo_pdf` | `TEXT` | Sí | — |

#### `cohortes_apertura`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `programa_id` | `UUID` | No | — |
| `sede_id` | `UUID` | No | — |
| `modalidad` | `modalidad_educativa_enum` | No | — |
| `codigo_cohorte` | `VARCHAR(50)` | No | — |
| `numero_edicion` | `INT` | No | — |
| `coordinador_id` | `UUID` | No | — |
| `fecha_inicio_inscripcion` | `DATE` | No | — |
| `fecha_fin_inscripcion` | `DATE` | No | — |
| `fecha_inicio_clases` | `DATE` | No | — |
| `fecha_fin_clases` | `DATE` | No | — |
| `horario_general` | `VARCHAR(255)` | Sí | — |
| `precio_matricula` | `NUMERIC(12,2)` | No | `0.00` |
| `precio_total_cohorte` | `NUMERIC(12,2)` | No | — |
| `descuento_porcentaje` | `INT` | Sí | `0` |
| `cupo_minimo` | `INT` | No | `15` |
| `cupo_maximo` | `INT` | No | `30` |
| `cupos_actuales_verificados` | `INT` | No | `0` |
| `cobro_habilitado` | `BOOLEAN` | Sí | `FALSE` |
| `tiene_excepcion_cupo_setec` | `BOOLEAN` | Sí | `FALSE` |
| `excepcion_cupo_setec_url` | `TEXT` | Sí | — |
| `estado_cohorte` | `VARCHAR(30)` | Sí | `'PLANIFICADA'` |
| `informe_evaluacion_cohorte_url` | `TEXT` | Sí | — |
| `created_at` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `programacion_componentes_cohorte`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `cohorte_id` | `UUID` | No | — |
| `componente_id` | `UUID` | No | — |
| `docente_titular_id` | `UUID` | Sí | — |
| `fecha_inicio` | `DATE` | Sí | — |
| `fecha_fin` | `DATE` | Sí | — |
| `horario` | `VARCHAR(255)` | Sí | — |
| `aula` | `VARCHAR(60)` | Sí | — |
| `codigo_aula_virtual_externa` | `VARCHAR(100)` | Sí | — |
| `actas_notas_cerradas` | `BOOLEAN` | Sí | `FALSE` |

#### `personas_aspirantes`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `usuario_id` | `UUID` | Sí | — |
| `tipo_identificacion` | `VARCHAR(20)` | No | — |
| `numero_identificacion` | `VARCHAR(40)` | No | — |
| `nombres` | `VARCHAR(100)` | No | — |
| `apellidos` | `VARCHAR(100)` | No | — |
| `fecha_nacimiento` | `DATE` | No | — |
| `email` | `VARCHAR(150)` | No | — |
| `telefono` | `VARCHAR(30)` | No | — |
| `cedula_identidad_pdf_url` | `TEXT` | Sí | — |
| `identidad_verificada` | `BOOLEAN` | Sí | `FALSE` |
| `fecha_verificacion` | `TIMESTAMPTZ` | Sí | — |
| `verificado_por_usuario_id` | `UUID` | Sí | — |
| `tiene_discapacidad` | `BOOLEAN` | Sí | `FALSE` |
| `descripcion_ajuste_razonable` | `TEXT` | Sí | — |
| `tutor_nombre_completo` | `VARCHAR(200)` | Sí | — |
| `tutor_identificacion` | `VARCHAR(40)` | Sí | — |
| `tutor_documento_url` | `TEXT` | Sí | — |
| `created_at` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `aspirantes_intereses_areas`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `aspirante_id` | `UUID` | No | — |
| `area_conocimiento_id` | `UUID` | No | — |

#### `titulos_academicos_aspirante`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `aspirante_id` | `UUID` | No | — |
| `area_conocimiento_id` | `UUID` | Sí | — |
| `nivel_titulo` | `VARCHAR(40)` | No | — |
| `denominacion_titulo` | `VARCHAR(200)` | No | — |
| `institucion_emisora` | `VARCHAR(200)` | No | — |
| `fecha_emision` | `DATE` | No | — |
| `inscrito_registro_nacional` | `BOOLEAN` | Sí | `FALSE` |
| `codigo_registro_nacional` | `VARCHAR(80)` | Sí | — |
| `certificado_rn_url` | `TEXT` | Sí | — |
| `titulo_pdf_url` | `TEXT` | No | — |
| `porcentaje_creditos_investigacion` | `NUMERIC(5,2)` | Sí | — |
| `estado_validacion` | `VARCHAR(20)` | Sí | `'PENDIENTE'` |
| `observacion_rechazo` | `TEXT` | Sí | — |
| `fecha_validacion` | `TIMESTAMPTZ` | Sí | — |
| `usuario_validador_id` | `UUID` | Sí | — |

#### `inscripciones`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `codigo_expediente` | `VARCHAR(40)` | No | — |
| `aspirante_id` | `UUID` | No | — |
| `cohorte_id` | `UUID` | No | — |
| `titulo_presentado_id` | `UUID` | Sí | — |
| `estado` | `estado_inscripcion_enum` | No | `'EN_REVISION_DOCUMENTAL'` |
| `observaciones_administracion` | `TEXT` | Sí | — |
| `rol_participacion` | `rol_participacion_ep_enum` | No | `'ESTUDIANTE_EVALUADO'` |
| `titulo_ponencia` | `VARCHAR(250)` | Sí | — |
| `resumen_ponencia` | `TEXT` | Sí | — |
| `archivo_ponencia_url` | `TEXT` | Sí | — |
| `es_reingreso_cambio_plan` | `BOOLEAN` | Sí | `FALSE` |
| `inscripcion_origen_id` | `UUID` | Sí | — |
| `requiere_nivelacion_investigativa` | `BOOLEAN` | Sí | `FALSE` |
| `acepta_compromiso_idioma_y_publicacion` | `BOOLEAN` | Sí | `FALSE` |
| `fecha_inscripcion` | `TIMESTAMPTZ` | Sí | `NOW()` |
| `fecha_aprobacion_documental` | `TIMESTAMPTZ` | Sí | — |
| `fecha_formalizacion_matricula` | `TIMESTAMPTZ` | Sí | — |

#### `pagos_inscripcion`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `inscripcion_id` | `UUID` | No | — |
| `aspirante_id` | `UUID` | No | — |
| `metodo_pago` | `metodo_pago_enum` | No | — |
| `numero_referencia_o_recibo` | `VARCHAR(100)` | No | — |
| `banco_origen` | `VARCHAR(100)` | Sí | — |
| `comprobante_baucher_url` | `TEXT` | Sí | — |
| `monto_subtotal` | `NUMERIC(12,2)` | No | — |
| `descuento_aplicado` | `NUMERIC(12,2)` | No | `0.00` |
| `total_pagado` | `NUMERIC(12,2)` | No | — |
| `concepto` | `VARCHAR(255)` | No | — |
| `estado` | `estado_pago_enum` | No | `'PENDIENTE_REVISION'` |
| `motivo_rechazo` | `TEXT` | Sí | — |
| `fecha_pago_reportada` | `TIMESTAMPTZ` | Sí | `NOW()` |
| `usuario_validador_caja_id` | `UUID` | Sí | — |
| `fecha_validacion_caja` | `TIMESTAMPTZ` | Sí | — |

#### `solicitudes_convalidacion_acreditacion`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `inscripcion_destino_id` | `UUID` | No | — |
| `componente_destino_id` | `UUID` | No | — |
| `origen_tipo` | `VARCHAR(40)` | No | — |
| `inscripcion_origen_ep_id` | `UUID` | Sí | — |
| `certificado_origen_url` | `TEXT` | No | — |
| `creditos_reconocidos` | `INT` | No | — |
| `justificacion_aporte_perfil` | `TEXT` | No | — |
| `estado_dictamen` | `VARCHAR(20)` | Sí | `'PENDIENTE'` |
| `coordinador_dictaminador_id` | `UUID` | Sí | — |
| `fecha_dictamen` | `TIMESTAMPTZ` | Sí | — |

#### `lotes_importacion_notas`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `programacion_componente_id` | `UUID` | No | — |
| `subido_por_usuario_id` | `UUID` | No | — |
| `archivo_excel_url` | `TEXT` | No | — |
| `total_registros_procesados` | `INT` | No | `0` |
| `observaciones` | `TEXT` | Sí | — |
| `created_at` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `matricula_componentes_snepa`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `inscripcion_id` | `UUID` | No | — |
| `programacion_componente_id` | `UUID` | No | — |
| `componente_id` | `UUID` | No | — |
| `lote_importacion_id` | `UUID` | Sí | — |
| `es_convalidada` | `BOOLEAN` | Sí | `FALSE` |
| `calificacion_cuantitativa` | `NUMERIC(5,2)` | Sí | — |
| `valoracion_cualitativa` | `escala_cualitativa_snepa_enum` | Sí | — |
| `observacion_acompanamiento_pedagogico` | `TEXT` | Sí | — |
| `autoevaluacion_completada` | `BOOLEAN` | Sí | `FALSE` |
| `coevaluacion_completada` | `BOOLEAN` | Sí | `FALSE` |
| `aprobado` | `BOOLEAN` | Sí | `FALSE` |
| `es_modificada_manualmente` | `BOOLEAN` | Sí | `FALSE` |
| `registrado_por_usuario_id` | `UUID` | Sí | — |
| `fecha_registro` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `notas_snepa_logs`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `matricula_componente_id` | `UUID` | No | — |
| `nota_anterior` | `NUMERIC(5,2)` | Sí | — |
| `nota_nueva` | `NUMERIC(5,2)` | Sí | — |
| `cualitativa_anterior` | `escala_cualitativa_snepa_enum` | Sí | — |
| `cualitativa_nueva` | `escala_cualitativa_snepa_enum` | Sí | — |
| `motivo_modificacion` | `TEXT` | No | — |
| `modificado_por_usuario_id` | `UUID` | No | — |
| `fecha_modificacion` | `TIMESTAMPTZ` | Sí | `NOW()` |

#### `expediente_graduacion_certificacion`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `inscripcion_id` | `UUID` | No | — |
| `idioma_acreditado` | `VARCHAR(50)` | Sí | — |
| `nivel_idioma_alcanzado` | `nivel_idioma_mcer_enum` | Sí | `'NINGUNO'` |
| `institucion_aval_idioma` | `VARCHAR(200)` | Sí | — |
| `certificado_idioma_url` | `TEXT` | Sí | — |
| `idioma_validado` | `BOOLEAN` | Sí | `FALSE` |
| `modalidad_graduacion_tipo` | `VARCHAR(50)` | Sí | — |
| `titulo_trabajo_graduacion` | `TEXT` | Sí | — |
| `acta_defensa_url` | `TEXT` | Sí | — |
| `aplico_salida_intermedia` | `BOOLEAN` | Sí | `FALSE` |
| `titulo_intermedio_emitido_url` | `TEXT` | Sí | — |
| `tipo_documento_final` | `VARCHAR(50)` | No | — |
| `codigo_registro_titulo_emitido` | `VARCHAR(80)` | Sí | — |
| `documento_final_url` | `TEXT` | Sí | — |
| `fecha_emision` | `DATE` | Sí | — |
| `emitido_por_usuario_id` | `UUID` | Sí | — |

#### `publicaciones_cientificas_estudiante`

| Campo | Tipo SQL | Null permitido | Default |
|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` |
| `expediente_graduacion_id` | `UUID` | No | — |
| `tipo_publicacion` | `VARCHAR(40)` | No | — |
| `titulo_publicacion` | `VARCHAR(300)` | No | — |
| `nombre_revista_o_medio` | `VARCHAR(200)` | No | — |
| `es_revista_indexada` | `BOOLEAN` | Sí | `FALSE` |
| `tiene_revision_pares` | `BOOLEAN` | Sí | `FALSE` |
| `alcance` | `VARCHAR(30)` | Sí | — |
| `url_o_doi` | `TEXT` | No | — |
| `evidencia_pdf_url` | `TEXT` | No | — |
| `validado_coordinacion` | `BOOLEAN` | Sí | `FALSE` |

### 7.2. Proyecciones de respuesta (nombres utilizados en este contrato)

Los ejemplos siguientes son objetos `data` completos; los valores ilustrativos null no implican que el campo sea siempre null. Para arrays se muestra el tipo completo de un elemento, no un objeto envoltorio adicional. Las proyecciones SQL que hoy fallan se mantienen para describir lo que el controlador intenta entregar, no para ocultar el fallo.

#### `PerfilUsuario`

```json
{
  "id": "00000004-1111-4111-8111-111111111111",
  "username": "ana",
  "email": "ana@example.edu",
  "nombres": "Ana",
  "apellidos": "Pérez",
  "telefono": null,
  "avatar_url": null,
  "rol": "ESTUDIANTE",
  "activo": true,
  "email_verificado": false,
  "permisos": [],
  "created_at": "2026-10-20T12:00:00.000Z"
}
```

#### `Tokens`

```json
{
  "accessToken": "<jwt-access>",
  "refreshToken": "<jwt-refresh>",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

#### `Login`

```json
{
  "user": {
    "id": "00000004-1111-4111-8111-111111111111",
    "username": "ana",
    "email": "ana@example.edu",
    "nombres": "Ana",
    "apellidos": "Pérez",
    "telefono": null,
    "avatar_url": null,
    "rol": "ESTUDIANTE",
    "activo": true,
    "email_verificado": false,
    "permisos": [],
    "created_at": "2026-10-20T12:00:00.000Z"
  },
  "tokens": {
    "accessToken": "<jwt-access>",
    "refreshToken": "<jwt-refresh>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

#### `DocenteDetalle`

```json
{
  "id": "00000009-1111-4111-8111-111111111111",
  "usuario_id": null,
  "identificacion": "001-010190-0001A",
  "nombres": "Ana",
  "apellidos": "Pérez",
  "maximo_grado_academico": "MASTER",
  "biografia_comercial": null,
  "foto_perfil_url": null,
  "cv_url": "/uploads/docentes/cv.pdf",
  "activo": true,
  "created_at": "2026-10-20T12:00:00.000Z",
  "usuario_email": null,
  "usuario_username": null,
  "rol_nombre": null
}
```

#### `ProgramaLista`

```json
{
  "id": "00000010-1111-4111-8111-111111111111",
  "codigo_interno": "CUR-001",
  "codigo_dictamen_setec": null,
  "fecha_aprobacion_setec": null,
  "nombre": "Ingeniería",
  "slug": "ingenieria",
  "categoria": "EDUCACION_PERMANENTE",
  "subtipo": "CURSO_EXTENSION",
  "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
  "resumen_corto_web": null,
  "descripcion_comercial": null,
  "imagen_portada_url": null,
  "video_promo_url": null,
  "brochure_pdf_url": null,
  "precio_total_referencia": "0.00",
  "descuento_porcentaje": 0,
  "visible_en_web": false,
  "es_ciencias_salud": false,
  "aval_minsa_url": null,
  "duracion_meses": null,
  "horas_totales": 40,
  "creditos_totales": 0,
  "creditos_investigacion": 0,
  "permite_continuidad_doctorado": false,
  "programa_salida_intermedia_id": null,
  "programa_destino_acreditable_id": null,
  "es_acreditable_a_posgrado": false,
  "estructurado_por_cursos": true,
  "requiere_titulo_grado_rn": false,
  "requiere_titulo_profesional": false,
  "permite_menores_edad": false,
  "idioma_egreso_requerido": "NINGUNO",
  "num_publicaciones_requeridas": 0,
  "requiere_revista_indexada": false,
  "requiere_pares_evaluadores": false,
  "titulo_o_certificado_otorgado": "Certificado de aprobación",
  "abreviatura_grado": null,
  "estado_vigencia": "ACTIVO",
  "created_at": "2026-10-20T12:00:00.000Z",
  "area_conocimiento": {
    "id": "00000006-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "icono_url": null
  },
  "tags": []
}
```

#### `ProgramaDetalle`

```json
{
  "id": "00000010-1111-4111-8111-111111111111",
  "codigo_interno": "CUR-001",
  "codigo_dictamen_setec": null,
  "fecha_aprobacion_setec": null,
  "nombre": "Ingeniería",
  "slug": "ingenieria",
  "categoria": "EDUCACION_PERMANENTE",
  "subtipo": "CURSO_EXTENSION",
  "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
  "resumen_corto_web": null,
  "descripcion_comercial": null,
  "imagen_portada_url": null,
  "video_promo_url": null,
  "brochure_pdf_url": null,
  "precio_total_referencia": "0.00",
  "descuento_porcentaje": 0,
  "visible_en_web": false,
  "es_ciencias_salud": false,
  "aval_minsa_url": null,
  "duracion_meses": null,
  "horas_totales": 40,
  "creditos_totales": 0,
  "creditos_investigacion": 0,
  "permite_continuidad_doctorado": false,
  "programa_salida_intermedia_id": null,
  "programa_destino_acreditable_id": null,
  "es_acreditable_a_posgrado": false,
  "estructurado_por_cursos": true,
  "requiere_titulo_grado_rn": false,
  "requiere_titulo_profesional": false,
  "permite_menores_edad": false,
  "idioma_egreso_requerido": "NINGUNO",
  "num_publicaciones_requeridas": 0,
  "requiere_revista_indexada": false,
  "requiere_pares_evaluadores": false,
  "titulo_o_certificado_otorgado": "Certificado de aprobación",
  "abreviatura_grado": null,
  "estado_vigencia": "ACTIVO",
  "created_at": "2026-10-20T12:00:00.000Z",
  "area_conocimiento": {
    "id": "00000006-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "icono_url": null
  },
  "tags": [],
  "componentes": []
}
```

#### `ProgramaCatalogo`

```json
{
  "id": "00000010-1111-4111-8111-111111111111",
  "codigo_interno": "CUR-001",
  "codigo_dictamen_setec": null,
  "fecha_aprobacion_setec": null,
  "nombre": "Ingeniería",
  "slug": "ingenieria",
  "categoria": "EDUCACION_PERMANENTE",
  "subtipo": "CURSO_EXTENSION",
  "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
  "resumen_corto_web": null,
  "descripcion_comercial": null,
  "imagen_portada_url": null,
  "video_promo_url": null,
  "brochure_pdf_url": null,
  "precio_total_referencia": "0.00",
  "descuento_porcentaje": 0,
  "visible_en_web": false,
  "es_ciencias_salud": false,
  "duracion_meses": null,
  "horas_totales": 40,
  "creditos_totales": 0,
  "creditos_investigacion": 0,
  "permite_continuidad_doctorado": false,
  "programa_salida_intermedia_id": null,
  "programa_destino_acreditable_id": null,
  "es_acreditable_a_posgrado": false,
  "estructurado_por_cursos": true,
  "requiere_titulo_grado_rn": false,
  "requiere_titulo_profesional": false,
  "permite_menores_edad": false,
  "idioma_egreso_requerido": "NINGUNO",
  "num_publicaciones_requeridas": 0,
  "requiere_revista_indexada": false,
  "requiere_pares_evaluadores": false,
  "titulo_o_certificado_otorgado": "Certificado de aprobación",
  "abreviatura_grado": null,
  "estado_vigencia": "ACTIVO",
  "created_at": "2026-10-20T12:00:00.000Z",
  "area_conocimiento": {
    "id": "00000006-1111-4111-8111-111111111111",
    "nombre": "Ingeniería",
    "slug": "ingenieria",
    "icono_url": null
  },
  "tags": [],
  "malla_curricular": [],
  "cohortes_abiertas": []
}
```

#### `ProgramaRecomendacion`

```json
{
  "id": "00000010-1111-4111-8111-111111111111",
  "codigo_interno": "CUR-001",
  "codigo_dictamen_setec": null,
  "fecha_aprobacion_setec": null,
  "nombre": "Ingeniería",
  "slug": "ingenieria",
  "categoria": "EDUCACION_PERMANENTE",
  "subtipo": "CURSO_EXTENSION",
  "area_conocimiento_id": "00000010-1111-4111-8111-111111111111",
  "resumen_corto_web": null,
  "descripcion_comercial": null,
  "imagen_portada_url": null,
  "video_promo_url": null,
  "brochure_pdf_url": null,
  "precio_total_referencia": "0.00",
  "descuento_porcentaje": 0,
  "visible_en_web": false,
  "es_ciencias_salud": false,
  "aval_minsa_url": null,
  "duracion_meses": null,
  "horas_totales": 40,
  "creditos_totales": 0,
  "creditos_investigacion": 0,
  "permite_continuidad_doctorado": false,
  "programa_salida_intermedia_id": null,
  "programa_destino_acreditable_id": null,
  "es_acreditable_a_posgrado": false,
  "estructurado_por_cursos": true,
  "requiere_titulo_grado_rn": false,
  "requiere_titulo_profesional": false,
  "permite_menores_edad": false,
  "idioma_egreso_requerido": "NINGUNO",
  "num_publicaciones_requeridas": 0,
  "requiere_revista_indexada": false,
  "requiere_pares_evaluadores": false,
  "titulo_o_certificado_otorgado": "Certificado de aprobación",
  "abreviatura_grado": null,
  "estado_vigencia": "ACTIVO",
  "created_at": "2026-10-20T12:00:00.000Z",
  "area_nombre": "Ingeniería",
  "area_slug": "ingenieria",
  "area_icono_url": null,
  "score_relevancia": 25,
  "motivos_match": [
    "INTERES_DECLARADO"
  ],
  "tags": [],
  "total_cohortes_abiertas": 0
}
```

#### `CohorteLista`

```json
{
  "id": "00000013-1111-4111-8111-111111111111",
  "programa_id": "00000013-1111-4111-8111-111111111111",
  "sede_id": "00000013-1111-4111-8111-111111111111",
  "modalidad": "PRESENCIAL",
  "codigo_cohorte": "CUR-2026-01",
  "numero_edicion": 1,
  "coordinador_id": "00000013-1111-4111-8111-111111111111",
  "fecha_inicio_inscripcion": "2026-10-01T00:00:00.000Z",
  "fecha_fin_inscripcion": "2026-10-20T00:00:00.000Z",
  "fecha_inicio_clases": "2026-11-01T00:00:00.000Z",
  "fecha_fin_clases": "2026-12-01T00:00:00.000Z",
  "horario_general": null,
  "precio_matricula": "0.00",
  "precio_total_cohorte": "0.00",
  "descuento_porcentaje": 0,
  "cupo_minimo": 15,
  "cupo_maximo": 30,
  "cupos_actuales_verificados": 0,
  "cobro_habilitado": false,
  "tiene_excepcion_cupo_setec": false,
  "excepcion_cupo_setec_url": null,
  "estado_cohorte": "PLANIFICADA",
  "informe_evaluacion_cohorte_url": null,
  "created_at": "2026-10-20T12:00:00.000Z",
  "programa_nombre": "Ingeniería",
  "programa_codigo": "CUR-001",
  "programa_subtipo": "CURSO_EXTENSION",
  "es_ciencias_salud": false,
  "sede_nombre": "Sede Central",
  "codigo_sede": "CENTRAL",
  "coordinador_nombres": "Ana",
  "coordinador_apellidos": "Pérez",
  "coordinador_identificacion": "001-010190-0001A"
}
```

#### `CohorteDetalle`

```json
{
  "id": "00000013-1111-4111-8111-111111111111",
  "programa_id": "00000013-1111-4111-8111-111111111111",
  "sede_id": "00000013-1111-4111-8111-111111111111",
  "modalidad": "PRESENCIAL",
  "codigo_cohorte": "CUR-2026-01",
  "numero_edicion": 1,
  "coordinador_id": "00000013-1111-4111-8111-111111111111",
  "fecha_inicio_inscripcion": "2026-10-01T00:00:00.000Z",
  "fecha_fin_inscripcion": "2026-10-20T00:00:00.000Z",
  "fecha_inicio_clases": "2026-11-01T00:00:00.000Z",
  "fecha_fin_clases": "2026-12-01T00:00:00.000Z",
  "horario_general": null,
  "precio_matricula": "0.00",
  "precio_total_cohorte": "0.00",
  "descuento_porcentaje": 0,
  "cupo_minimo": 15,
  "cupo_maximo": 30,
  "cupos_actuales_verificados": 0,
  "cobro_habilitado": false,
  "tiene_excepcion_cupo_setec": false,
  "excepcion_cupo_setec_url": null,
  "estado_cohorte": "PLANIFICADA",
  "informe_evaluacion_cohorte_url": null,
  "created_at": "2026-10-20T12:00:00.000Z",
  "programa_nombre": "Ingeniería",
  "programa_codigo": "CUR-001",
  "programa_subtipo": "CURSO_EXTENSION",
  "es_ciencias_salud": false,
  "sede_nombre": "Sede Central",
  "codigo_sede": "CENTRAL",
  "coordinador_nombres": "Ana",
  "coordinador_apellidos": "Pérez",
  "coordinador_identificacion": "001-010190-0001A",
  "programacion": []
}
```

#### `ProgramacionDetalle`

```json
{
  "id": "00000014-1111-4111-8111-111111111111",
  "cohorte_id": "00000014-1111-4111-8111-111111111111",
  "componente_id": "00000014-1111-4111-8111-111111111111",
  "docente_titular_id": null,
  "fecha_inicio": null,
  "fecha_fin": null,
  "horario": null,
  "aula": null,
  "codigo_aula_virtual_externa": null,
  "actas_notas_cerradas": false,
  "componente_codigo": "MOD-01",
  "componente_nombre": "Introducción a investigación",
  "orden_bloque": 1,
  "horas": 40,
  "creditos": 0,
  "docente_nombres": null,
  "docente_apellidos": null,
  "docente_identificacion": null,
  "docente_maximo_grado": null
}
```

#### `AspiranteLista`

```json
{
  "id": "00000015-1111-4111-8111-111111111111",
  "usuario_id": null,
  "tipo_identificacion": "CEDULA",
  "numero_identificacion": "001-010190-0001A",
  "nombres": "Ana",
  "apellidos": "Pérez",
  "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
  "email": "ana@example.edu",
  "telefono": "+50588880000",
  "cedula_identidad_pdf_url": null,
  "identidad_verificada": false,
  "fecha_verificacion": null,
  "verificado_por_usuario_id": null,
  "tiene_discapacidad": false,
  "descripcion_ajuste_razonable": null,
  "tutor_nombre_completo": null,
  "tutor_identificacion": null,
  "tutor_documento_url": null,
  "created_at": "2026-10-20T12:00:00.000Z",
  "usuario_email": "ana@example.edu",
  "verificador_nombres": null,
  "verificador_apellidos": null
}
```

#### `AspiranteDetalle`

```json
{
  "id": "00000015-1111-4111-8111-111111111111",
  "usuario_id": null,
  "tipo_identificacion": "CEDULA",
  "numero_identificacion": "001-010190-0001A",
  "nombres": "Ana",
  "apellidos": "Pérez",
  "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
  "email": "ana@example.edu",
  "telefono": "+50588880000",
  "cedula_identidad_pdf_url": null,
  "identidad_verificada": false,
  "fecha_verificacion": null,
  "verificado_por_usuario_id": null,
  "tiene_discapacidad": false,
  "descripcion_ajuste_razonable": null,
  "tutor_nombre_completo": null,
  "tutor_identificacion": null,
  "tutor_documento_url": null,
  "created_at": "2026-10-20T12:00:00.000Z",
  "usuario_email": "ana@example.edu",
  "verificador_nombres": null,
  "verificador_apellidos": null,
  "intereses": [],
  "titulos": []
}
```

#### `AspiranteMutacion`

```json
{
  "id": "00000015-1111-4111-8111-111111111111",
  "usuario_id": null,
  "tipo_identificacion": "CEDULA",
  "numero_identificacion": "001-010190-0001A",
  "nombres": "Ana",
  "apellidos": "Pérez",
  "fecha_nacimiento": "1990-01-01T00:00:00.000Z",
  "email": "ana@example.edu",
  "telefono": "+50588880000",
  "cedula_identidad_pdf_url": null,
  "identidad_verificada": false,
  "fecha_verificacion": null,
  "verificado_por_usuario_id": null,
  "tiene_discapacidad": false,
  "descripcion_ajuste_razonable": null,
  "tutor_nombre_completo": null,
  "tutor_identificacion": null,
  "tutor_documento_url": null,
  "created_at": "2026-10-20T12:00:00.000Z",
  "intereses": [],
  "titulos": []
}
```

#### `Interes`

```json
{
  "aspirante_id": "00000015-1111-4111-8111-111111111111",
  "area_conocimiento_id": "00000006-1111-4111-8111-111111111111",
  "area_nombre": "Ingeniería",
  "area_codigo": "ING"
}
```

#### `TituloDetalle`

```json
{
  "id": "00000017-1111-4111-8111-111111111111",
  "aspirante_id": "00000017-1111-4111-8111-111111111111",
  "area_conocimiento_id": null,
  "nivel_titulo": "GRADO",
  "denominacion_titulo": "Licenciatura en Ingeniería",
  "institucion_emisora": "Universidad de ejemplo",
  "fecha_emision": "2026-10-20T00:00:00.000Z",
  "inscrito_registro_nacional": false,
  "codigo_registro_nacional": null,
  "certificado_rn_url": null,
  "titulo_pdf_url": "/uploads/documentos/titulo.pdf",
  "porcentaje_creditos_investigacion": "0.00",
  "estado_validacion": "PENDIENTE",
  "observacion_rechazo": null,
  "fecha_validacion": null,
  "usuario_validador_id": null,
  "area_nombre": null,
  "validador_nombres": null,
  "validador_apellidos": null
}
```

#### `InscripcionDetalle`

```json
{
  "id": "00000018-1111-4111-8111-111111111111",
  "codigo_expediente": "EXP-2026-A1B2C3D4",
  "aspirante_id": "00000018-1111-4111-8111-111111111111",
  "cohorte_id": "00000018-1111-4111-8111-111111111111",
  "titulo_presentado_id": null,
  "estado": "EN_REVISION_DOCUMENTAL",
  "observaciones_administracion": null,
  "rol_participacion": "ESTUDIANTE_EVALUADO",
  "titulo_ponencia": null,
  "resumen_ponencia": null,
  "archivo_ponencia_url": null,
  "es_reingreso_cambio_plan": false,
  "inscripcion_origen_id": null,
  "requiere_nivelacion_investigativa": false,
  "acepta_compromiso_idioma_y_publicacion": false,
  "fecha_inscripcion": "2026-10-20T12:00:00.000Z",
  "fecha_aprobacion_documental": null,
  "fecha_formalizacion_matricula": null,
  "aspirante_nombres": "Ana",
  "aspirante_apellidos": "Pérez",
  "aspirante_identificacion": "001-010190-0001A",
  "aspirante_tipo_identificacion": "CEDULA",
  "aspirante_email": "ana@example.edu",
  "aspirante_telefono": "+50588880000",
  "aspirante_usuario_id": "00000004-1111-4111-8111-111111111111",
  "cohorte_codigo": "CUR-2026-01",
  "numero_edicion": 1,
  "cohorte_modalidad": "PRESENCIAL",
  "precio_matricula": "100.00",
  "precio_total_cohorte": "100.00",
  "cupo_minimo": 15,
  "cupo_maximo": 30,
  "cupos_actuales_verificados": 0,
  "cobro_habilitado": false,
  "estado_cohorte": "INSCRIPCION_ABIERTA",
  "programa_id": "00000010-1111-4111-8111-111111111111",
  "programa_nombre": "Ingeniería",
  "programa_codigo": "CUR-001",
  "programa_categoria": "EDUCACION_PERMANENTE",
  "programa_subtipo": "CURSO_EXTENSION",
  "requiere_titulo_grado_rn": false,
  "titulo_denominacion": null,
  "titulo_nivel": null,
  "titulo_institucion": null,
  "titulo_estado_validacion": null
}
```

#### `DossierInscripcion`

```json
{
  "inscripcion": {
    "id": "00000018-1111-4111-8111-111111111111",
    "codigo_expediente": "EXP-2026-A1B2C3D4",
    "aspirante_id": "00000018-1111-4111-8111-111111111111",
    "cohorte_id": "00000018-1111-4111-8111-111111111111",
    "titulo_presentado_id": null,
    "estado": "EN_REVISION_DOCUMENTAL",
    "observaciones_administracion": null,
    "rol_participacion": "ESTUDIANTE_EVALUADO",
    "titulo_ponencia": null,
    "resumen_ponencia": null,
    "archivo_ponencia_url": null,
    "es_reingreso_cambio_plan": false,
    "inscripcion_origen_id": null,
    "requiere_nivelacion_investigativa": false,
    "acepta_compromiso_idioma_y_publicacion": false,
    "fecha_inscripcion": "2026-10-20T12:00:00.000Z",
    "fecha_aprobacion_documental": null,
    "fecha_formalizacion_matricula": null,
    "aspirante_nombres": "Ana",
    "aspirante_apellidos": "Pérez",
    "aspirante_identificacion": "001-010190-0001A",
    "aspirante_tipo_identificacion": "CEDULA",
    "aspirante_email": "ana@example.edu",
    "aspirante_telefono": "+50588880000",
    "aspirante_usuario_id": "00000004-1111-4111-8111-111111111111",
    "cohorte_codigo": "CUR-2026-01",
    "numero_edicion": 1,
    "cohorte_modalidad": "PRESENCIAL",
    "precio_matricula": "100.00",
    "precio_total_cohorte": "100.00",
    "cupo_minimo": 15,
    "cupo_maximo": 30,
    "cupos_actuales_verificados": 0,
    "cobro_habilitado": false,
    "estado_cohorte": "INSCRIPCION_ABIERTA",
    "programa_id": "00000010-1111-4111-8111-111111111111",
    "programa_nombre": "Ingeniería",
    "programa_codigo": "CUR-001",
    "programa_categoria": "EDUCACION_PERMANENTE",
    "programa_subtipo": "CURSO_EXTENSION",
    "requiere_titulo_grado_rn": false,
    "titulo_denominacion": null,
    "titulo_nivel": null,
    "titulo_institucion": null,
    "titulo_estado_validacion": null
  },
  "pagos": [],
  "convalidaciones": []
}
```

#### `ConvalidacionDetalle`

```json
{
  "id": "00000020-1111-4111-8111-111111111111",
  "inscripcion_destino_id": "00000020-1111-4111-8111-111111111111",
  "componente_destino_id": "00000020-1111-4111-8111-111111111111",
  "origen_tipo": "EXTERNO",
  "inscripcion_origen_ep_id": null,
  "certificado_origen_url": "/uploads/convalidaciones/certificado.pdf",
  "creditos_reconocidos": 1,
  "justificacion_aporte_perfil": "Formación equivalente en investigación",
  "estado_dictamen": "PENDIENTE",
  "coordinador_dictaminador_id": null,
  "fecha_dictamen": null,
  "componente_nombre": "Introducción a investigación",
  "componente_codigo": "MOD-01",
  "componente_creditos": 3,
  "coordinador_nombres": null,
  "coordinador_apellidos": null
}
```

#### `NotaDetalle`

```json
{
  "id": "00000022-1111-4111-8111-111111111111",
  "inscripcion_id": "00000022-1111-4111-8111-111111111111",
  "programacion_componente_id": "00000022-1111-4111-8111-111111111111",
  "componente_id": "00000022-1111-4111-8111-111111111111",
  "lote_importacion_id": null,
  "es_convalidada": false,
  "calificacion_cuantitativa": "95.00",
  "valoracion_cualitativa": "APRENDIZAJE_AVANZADO",
  "observacion_acompanamiento_pedagogico": null,
  "autoevaluacion_completada": false,
  "coevaluacion_completada": false,
  "aprobado": true,
  "es_modificada_manualmente": false,
  "registrado_por_usuario_id": null,
  "fecha_registro": "2026-10-20T12:00:00.000Z",
  "codigo_expediente": "EXP-2026-A1B2C3D4",
  "nombres": "Ana",
  "apellidos": "Pérez",
  "numero_identificacion": "001-010190-0001A",
  "registrado_por_email": "docente@example.edu"
}
```

#### `NotaKardex`

```json
{
  "id": "00000022-1111-4111-8111-111111111111",
  "inscripcion_id": "00000022-1111-4111-8111-111111111111",
  "programacion_componente_id": "00000022-1111-4111-8111-111111111111",
  "componente_id": "00000022-1111-4111-8111-111111111111",
  "lote_importacion_id": null,
  "es_convalidada": false,
  "calificacion_cuantitativa": "95.00",
  "valoracion_cualitativa": "APRENDIZAJE_AVANZADO",
  "observacion_acompanamiento_pedagogico": null,
  "autoevaluacion_completada": false,
  "coevaluacion_completada": false,
  "aprobado": true,
  "es_modificada_manualmente": false,
  "registrado_por_usuario_id": null,
  "fecha_registro": "2026-10-20T12:00:00.000Z",
  "nombre_modulo": "Introducción a investigación",
  "codigo_componente": "MOD-01",
  "creditos_academicos": 3,
  "orden_secuencia": 1,
  "fecha_inicio": "2026-11-01T00:00:00.000Z",
  "fecha_fin": "2026-12-01T00:00:00.000Z"
}
```

#### `LoteDetalle`

```json
{
  "id": "00000021-1111-4111-8111-111111111111",
  "programacion_componente_id": "00000021-1111-4111-8111-111111111111",
  "subido_por_usuario_id": "00000021-1111-4111-8111-111111111111",
  "archivo_excel_url": "/uploads/actas_excel/acta.xlsx",
  "total_registros_procesados": 0,
  "observaciones": null,
  "created_at": "2026-10-20T12:00:00.000Z",
  "subido_por_email": "docente@example.edu"
}
```

#### `LogDetalle`

```json
{
  "id": "00000023-1111-4111-8111-111111111111",
  "matricula_componente_id": "00000023-1111-4111-8111-111111111111",
  "nota_anterior": "0.00",
  "nota_nueva": "0.00",
  "cualitativa_anterior": null,
  "cualitativa_nueva": null,
  "motivo_modificacion": "Corrección de acta autorizada",
  "modificado_por_usuario_id": "00000023-1111-4111-8111-111111111111",
  "fecha_modificacion": "2026-10-20T12:00:00.000Z",
  "modificado_por_email": "coordinador@example.edu",
  "modificado_por_rol": "COORDINADOR"
}
```

#### `Importacion`

```json
{
  "lote": {
    "id": "00000021-1111-4111-8111-111111111111",
    "programacion_componente_id": "00000021-1111-4111-8111-111111111111",
    "subido_por_usuario_id": "00000021-1111-4111-8111-111111111111",
    "archivo_excel_url": "/uploads/actas_excel/acta.xlsx",
    "total_registros_procesados": 1,
    "observaciones": null,
    "created_at": "2026-10-20T12:00:00.000Z"
  },
  "total_filas_leidas": 1,
  "total_registros_procesados": 1,
  "errores_filas": []
}
```

#### `NotaModificada`

```json
{
  "grade": {
    "id": "00000022-1111-4111-8111-111111111111",
    "inscripcion_id": "00000022-1111-4111-8111-111111111111",
    "programacion_componente_id": "00000022-1111-4111-8111-111111111111",
    "componente_id": "00000022-1111-4111-8111-111111111111",
    "lote_importacion_id": null,
    "es_convalidada": false,
    "calificacion_cuantitativa": "95.00",
    "valoracion_cualitativa": "APRENDIZAJE_AVANZADO",
    "observacion_acompanamiento_pedagogico": null,
    "autoevaluacion_completada": false,
    "coevaluacion_completada": false,
    "aprobado": true,
    "es_modificada_manualmente": true,
    "registrado_por_usuario_id": "00000004-1111-4111-8111-111111111111",
    "fecha_registro": "2026-10-20T12:00:00.000Z"
  },
  "auditLog": {
    "id": "00000023-1111-4111-8111-111111111111",
    "matricula_componente_id": "00000023-1111-4111-8111-111111111111",
    "nota_anterior": "0.00",
    "nota_nueva": "95.00",
    "cualitativa_anterior": null,
    "cualitativa_nueva": "APRENDIZAJE_AVANZADO",
    "motivo_modificacion": "Corrección de acta autorizada",
    "modificado_por_usuario_id": "00000004-1111-4111-8111-111111111111",
    "fecha_modificacion": "2026-10-20T12:00:00.000Z"
  }
}
```

#### `ExpedienteDetalle`

```json
{
  "id": "00000024-1111-4111-8111-111111111111",
  "inscripcion_id": "00000024-1111-4111-8111-111111111111",
  "idioma_acreditado": null,
  "nivel_idioma_alcanzado": "NINGUNO",
  "institucion_aval_idioma": null,
  "certificado_idioma_url": null,
  "idioma_validado": false,
  "modalidad_graduacion_tipo": null,
  "titulo_trabajo_graduacion": null,
  "acta_defensa_url": null,
  "aplico_salida_intermedia": false,
  "titulo_intermedio_emitido_url": null,
  "tipo_documento_final": "CERTIFICADO_APROBACION",
  "codigo_registro_titulo_emitido": null,
  "documento_final_url": null,
  "fecha_emision": null,
  "emitido_por_usuario_id": null,
  "codigo_expediente": "EXP-2026-A1B2C3D4",
  "inscripcion_estado": "MATRICULADO_ACTIVO",
  "aspirante_nombres": "Ana",
  "aspirante_apellidos": "Pérez",
  "numero_identificacion": "001-010190-0001A",
  "programa_nombre": "Ingeniería",
  "programa_subtipo": "CURSO_EXTENSION",
  "codigo_cohorte": "CUR-2026-01",
  "publicaciones": []
}
```

#### `Emision`

```json
{
  "expediente": {
    "id": "00000024-1111-4111-8111-111111111111",
    "inscripcion_id": "00000024-1111-4111-8111-111111111111",
    "idioma_acreditado": null,
    "nivel_idioma_alcanzado": "NINGUNO",
    "institucion_aval_idioma": null,
    "certificado_idioma_url": null,
    "idioma_validado": false,
    "modalidad_graduacion_tipo": null,
    "titulo_trabajo_graduacion": null,
    "acta_defensa_url": null,
    "aplico_salida_intermedia": false,
    "titulo_intermedio_emitido_url": null,
    "tipo_documento_final": "CERTIFICADO_APROBACION",
    "codigo_registro_titulo_emitido": "SETEC-CURSOEXTENSION-2026-A1B2C3",
    "documento_final_url": null,
    "fecha_emision": "2026-10-20T00:00:00.000Z",
    "emitido_por_usuario_id": "00000004-1111-4111-8111-111111111111"
  },
  "codigo_registro": "SETEC-CURSOEXTENSION-2026-A1B2C3",
  "fecha_emision": "2026-10-20",
  "estado_inscripcion": "GRADUADO_O_CERTIFICADO",
  "estudiante": "Ana Pérez",
  "programa": "Ingeniería"
}
```

#### `VerificacionPublica`

```json
{
  "autenticidad_verificada": true,
  "codigo_registro": "SETEC-CURSOEXTENSION-2026-A1B2C3",
  "tipo_documento": "CERTIFICADO_APROBACION",
  "fecha_emision": "2026-10-20T00:00:00.000Z",
  "estudiante": {
    "nombres": "Ana",
    "apellidos": "Pérez",
    "tipo_identificacion": "CEDULA",
    "numero_identificacion": "001-010190-0001A"
  },
  "programa": {
    "nombre": "Ingeniería",
    "categoria": "EDUCACION_PERMANENTE",
    "subtipo": "CURSO_EXTENSION",
    "titulo_o_certificado_otorgado": "Certificado de aprobación"
  },
  "cohorte": {
    "codigo_cohorte": "CUR-2026-01",
    "sede": "Sede Central"
  },
  "documento_digital_url": null
}
```

#### `PagoValidado`

```json
{
  "pago": {
    "id": "00000019-1111-4111-8111-111111111111",
    "inscripcion_id": "00000019-1111-4111-8111-111111111111",
    "aspirante_id": "00000019-1111-4111-8111-111111111111",
    "metodo_pago": "BAUCHER_BANCARIO",
    "numero_referencia_o_recibo": "REF-2026-001",
    "banco_origen": null,
    "comprobante_baucher_url": null,
    "monto_subtotal": "100.00",
    "descuento_aplicado": "0.00",
    "total_pagado": "100.00",
    "concepto": "Matrícula",
    "estado": "APROBADO",
    "motivo_rechazo": null,
    "fecha_pago_reportada": "2026-10-20T12:00:00.000Z",
    "usuario_validador_caja_id": "00000004-1111-4111-8111-111111111111",
    "fecha_validacion_caja": "2026-10-20T12:00:00.000Z"
  },
  "inscripcion": {
    "id": "00000018-1111-4111-8111-111111111111",
    "codigo_expediente": "EXP-2026-A1B2C3D4",
    "aspirante_id": "00000018-1111-4111-8111-111111111111",
    "cohorte_id": "00000018-1111-4111-8111-111111111111",
    "titulo_presentado_id": null,
    "estado": "MATRICULADO_ACTIVO",
    "observaciones_administracion": null,
    "rol_participacion": "ESTUDIANTE_EVALUADO",
    "titulo_ponencia": null,
    "resumen_ponencia": null,
    "archivo_ponencia_url": null,
    "es_reingreso_cambio_plan": false,
    "inscripcion_origen_id": null,
    "requiere_nivelacion_investigativa": false,
    "acepta_compromiso_idioma_y_publicacion": false,
    "fecha_inscripcion": "2026-10-20T12:00:00.000Z",
    "fecha_aprobacion_documental": null,
    "fecha_formalizacion_matricula": "2026-10-20T12:00:00.000Z",
    "aspirante_nombres": "Ana",
    "aspirante_apellidos": "Pérez",
    "aspirante_identificacion": "001-010190-0001A",
    "aspirante_tipo_identificacion": "CEDULA",
    "aspirante_email": "ana@example.edu",
    "aspirante_telefono": "+50588880000",
    "aspirante_usuario_id": "00000004-1111-4111-8111-111111111111",
    "cohorte_codigo": "CUR-2026-01",
    "numero_edicion": 1,
    "cohorte_modalidad": "PRESENCIAL",
    "precio_matricula": "100.00",
    "precio_total_cohorte": "100.00",
    "cupo_minimo": 15,
    "cupo_maximo": 30,
    "cupos_actuales_verificados": 15,
    "cobro_habilitado": true,
    "estado_cohorte": "QUORUM_ALCANZADO_COBRANDO",
    "programa_id": "00000010-1111-4111-8111-111111111111",
    "programa_nombre": "Ingeniería",
    "programa_codigo": "CUR-001",
    "programa_categoria": "EDUCACION_PERMANENTE",
    "programa_subtipo": "CURSO_EXTENSION",
    "requiere_titulo_grado_rn": false,
    "titulo_denominacion": null,
    "titulo_nivel": null,
    "titulo_institucion": null,
    "titulo_estado_validacion": null
  }
}
```

### 7.3. Detalles de forma que no deben normalizarse a ciegas

- ProgramaLista = programas_academicos + `area_conocimiento:{id,nombre,slug,icono_url}`, `tags:{id,nombre,slug}[]`; **sin componentes**. ProgramaDetalle agrega `componentes` como array JSON SQL. Esos elementos contienen todos los campos de componentes_curriculares **excepto programa_id**; sus NUMERIC son numbers.
- ProgramaCatalogo omite `aval_minsa_url` aunque la interfaz interna herede ProgramRecord. Usa `malla_curricular` (no `componentes`) con los mismos elementos JSON sin programa_id. `cohortes_abiertas` contiene exactamente `id`, `codigo_cohorte`, `numero_edicion`, `modalidad`, `sede_id`, `sede_nombre`, `fecha_inicio_inscripcion`, `fecha_fin_inscripcion`, `fecha_inicio_clases`, `fecha_fin_clases`, `horario_general`, `precio_matricula`, `precio_total_cohorte`, `descuento_porcentaje`, `cupo_minimo`, `cupo_maximo`, `cupos_actuales_verificados`, `cobro_habilitado`, `estado_cohorte`. Precios anidados numbers; fechas DATE anidadas YYYY-MM-DD.
- ProgramaRecomendacion incluye todos los campos del programa, `area_nombre:string`, `area_slug:string`, `area_icono_url:string|null`, `score_relevancia:number`, `motivos_match:string[]`, `tags` y `total_cohortes_abiertas:number`. Motivos posibles: CONTINUIDAD_ACREDITABLE (+50), AFINIDAD_TITULO_PREVIO (+35), INTERES_DECLARADO (+25), CONVALIDABLE_A_POSGRADO (+10). Solo score>0, orden score descendente, luego cohortes abiertas descendente y nombre.
- CohorteLista agrega programa/nombre/código/subtipo/salud, sede y coordinador; la propiedad real es **codigo_sede**, no `sede_codigo` de la interfaz interna. CohorteDetalle agrega `programacion: ProgramacionDetalle[]`. Estos elementos JSON SQL tienen fechas YYYY-MM-DD; el endpoint de lista de programación usa columnas directas y puede serializarlas como ISO.
- AspiranteLista y consultas por ID agregan `usuario_email`, `verificador_nombres`, `verificador_apellidos` (nullable). AspiranteDetalle agrega `intereses` y `titulos: TituloDetalle[]`; AspiranteMutacion normalmente compone el row RETURNING y las colecciones sin aliases de usuario/verificador. Si no hay campos escalares para SET, ApplicantDao.updateProfile devuelve la consulta por ID con esos aliases, por lo que pueden aparecer también en esa rama. `verify-identity` devuelve solo el row de personas_aspirantes.
- TituloDetalle agrega `area_nombre`, `validador_nombres`, `validador_apellidos`, nullable; altas/ediciones/validaciones devuelven row sin esos aliases.
- InscripcionDetalle usa nombres planos como `cohorte_codigo`, `programa_nombre`, `cobro_habilitado`; `GET /enrollments/:id` envuelve ese objeto bajo `data.inscripcion` y agrega `pagos` y `convalidaciones`. POST y validate-documents devuelven directamente InscripcionDetalle, no ese dossier.
- ConvalidacionDetalle agrega `componente_nombre`, `componente_codigo`, `componente_creditos`, `coordinador_nombres`, `coordinador_apellidos`; las mutaciones devuelven row sin joins. Las notas listadas por componente usan `nombres`/`apellidos`, no aspirante_nombres/apellidos; kardex usa aliases curriculares incompatibles descritos en sección 9.
- ExpedienteDetalle agrega los aliases de inscripción/estudiante/programa/cohorte del ejemplo y `publicaciones: publicaciones_cientificas_estudiante[]`. POST/PATCH no devuelven esos joins. Emitir devuelve `{expediente,codigo_registro,fecha_emision,estado_inscripcion,estudiante,programa}`; no un expediente plano.
- Importacion puede contener `errores_filas` aun con HTTP 201 y success=true; no equiparar éxito HTTP con importación total. ModificarNota devuelve `{grade,auditLog}` y el nombre auditLog conserva camelCase.

## 8. Reglas de negocio que debe representar la UI

### 8.1. Formularios SETEC de programa y cohorte

| Condición | Comportamiento de la UI y validación real |
|---|---|
| `es_ciencias_salud === true` | Exigir aval MINSA: archivo `aval_minsa` o URL `aval_minsa_url` no vacía. La modalidad pertenece a la cohorte: deshabilitar VIRTUAL, permitir PRESENCIAL/SEMIPRESENCIAL/MIXTA. El servicio de cohorte rechaza VIRTUAL para salud. |
| Subtipo DOCTORADO_LICENCIATURA o DOCTORADO_MAESTRIA | Mostrar `estructurado_por_cursos=false` como deshabilitado. El servicio lo fuerza a false y existe CHECK SQL. No esconder otros requisitos de doctorado inferidos de normativa que el programa no configura. |
| Subtipo DOCTORADO_LICENCIATURA | Exigir `programa_salida_intermedia_id`. Creación comprueba existencia; no comprueba que el subtipo de ese programa sea maestría aunque el mensaje lo mencione. |
| Sin excepción de cupo | Exigir `cupo_minimo >= 15`, `cupo_maximo <= 30`, enteros positivos y mínimo <= máximo. Aunque comentarios/mensajes dicen posgrados, **el servicio aplica estos límites a todas las cohortes**, también educación permanente. |
| `tiene_excepcion_cupo_setec === true` | Exigir respaldo `excepcion_cupo_pdf` o `excepcion_cupo_setec_url`; todavía exige mínimo/maximo positivos y mínimo <= máximo. |
| Crear cohorte | Fechas en orden: inicio inscripción <= fin inscripción <= inicio clases <= fin clases. Sede y coordinador deben existir/estar activos; coordinador es registro de personal_academico, no rol o usuario. |

No hay catálogo de “requisitos normativos por subtipo” calculado automáticamente: mostrar los flags y umbrales reales del programa. `requiere_titulo_profesional`, `permite_menores_edad`, `acepta_compromiso_idioma_y_publicacion` y otros flags no implican por sí solos que todos los servicios los hagan cumplir.

La edición de programa conserva comprobaciones de salud/doctorado sobre los valores combinados. Sin embargo, `tag_ids` en `PUT /api/programs/:id` se filtra al SET dinámico como una columna inexistente; usar `POST /api/programs/:id/tags` para reemplazar tags. La edición de cohorte permite cambiar contador y cobro manualmente con COHORTE_GESTIONAR; no es una máquina de estados protegida para todas las transiciones.

### 8.2. Menores de edad y tutor legal

Calcular la edad a partir de `fecha_nacimiento`, restando un año si todavía no ha ocurrido el cumpleaños del año actual. Si edad <18, mostrar y exigir:

- `tutor_nombre_completo` no vacío;
- `tutor_identificacion` no vacío;
- archivo `tutor_documento` (o su alias) o `tutor_documento_url` no vacía.

Creación y actualización de perfil verifican estos tres valores sobre datos efectivos. El servidor calcula usando `new Date()` y getters locales; el Frontend debe usar fecha civil y tener cuidado con el desfase de zona horaria. El servicio exige tutor para **todo perfil menor**, sin consultar un programa, porque el perfil no pertenece a una cohorte en ese momento. No condicionarlo únicamente a un checkbox de cursos de extensión.

El requisito de producto “en cursos de extensión que lo permitan” se puede reflejar leyendo `permite_menores_edad` en el catálogo, pero **createEnrollment no bloquea actualmente a un menor cuando ese flag es false**, ni restringe los menores por subtipo. No afirmar que el servidor garantiza esa restricción; requiere una corrección de backend separada.

### 8.3. Inscripción, quórum y caja

Estados de inscripción y estado de cohorte son conceptos separados. Flujo normal previsto:

```text
POST inscripción
  ├─ cohorte llena → LISTA_ESPERA
  ├─ PONENTE_CONGRESO → PENDIENTE_COMITE_PONENCIA
  └─ resto → EN_REVISION_DOCUMENTAL

PATCH validate-documents {aprobado:false}
  → DOCUMENTACION_OBSERVADA

PATCH validate-documents {aprobado:true}
  → incrementa cupos_actuales_verificados
  ├─ contador < cupo_minimo → INSCRITO_RESERVADO
  └─ contador >= cupo_minimo
       cohorte.estado_cohorte = QUORUM_ALCANZADO_COBRANDO
       cohorte.cobro_habilitado = true
       inscripción actual y todas las INSCRITO_RESERVADO → PENDIENTE_PAGO

POST payments → pago.PENDIENTE_REVISION e inscripción.PAGO_EN_REVISION
PATCH payments/.../validate {estado:APROBADO} → aplica pago; no activa matrícula
POST billing/enrollments/:id/activate {motivo} → MATRICULADO_ACTIVO (INSCRIPCION_VALIDAR)
PATCH payments/.../validate {estado:RECHAZADO} → PENDIENTE_PAGO (puede reintentar)
```

El umbral real es **cupo_minimo**, default 15; no fijar 15 en el componente visual si existe una excepción/configuración distinta. El contador es un campo incrementado, no un `COUNT(*)` recalculado para cada lectura. La validación usa una transacción y bloquea la fila de cohorte; una aprobación repetida en estado INSCRITO_RESERVADO/PENDIENTE_PAGO/PAGO_EN_REVISION/MATRICULADO_ACTIVO se rechaza. Una observación posterior no decrementa el contador ni deshabilita el cobro automáticamente: no simular un recuento distinto al del servidor.

**Corrección importante al criterio solicitado de “Subir Baucher”: el backend exige AND, no OR.** Condición exacta de aceptación de un pago:

```ts
const canSubmitPayment =
  enrollment.cobro_habilitado === true &&
  ["PENDIENTE_PAGO", "PAGO_EN_REVISION", "DOCUMENTACION_OBSERVADA", "MATRICULADO_ACTIVO"]
    .includes(enrollment.estado);
```

Mostrar el botón normal al estudiante en PENDIENTE_PAGO con cobro habilitado; para estados adicionales decidir solo la presentación, sin prometer que basta un estado o que se puede pagar antes del quórum. El mensaje de error del servidor menciona solo PENDIENTE_PAGO, pero el condicional permite también los otros dos estados. No existe propiedad calculada `canSubmitPayment` en la respuesta; obtener `cobro_habilitado` desde InscripcionDetalle/cohorte.

Caja requiere PAGO_VALIDAR para decidir pagos; un pago ya decidido no puede volver a dictaminarse. Aprobar cualquier pago pendiente formaliza la matrícula y fecha, sin comprobar que cubra la deuda ni sumar pagos. Rechazar produce un motivo por defecto si se omite y devuelve la inscripción a PENDIENTE_PAGO. Todas las modalidades de pago pasan por PENDIENTE_REVISION; no hay integración real con pasarela, webhook ni reembolso pese a los valores ENUM.

Otros límites relevantes:

- La inscripción única es `(aspirante_id,cohorte_id)`; duplicado → 409. El código de expediente se genera como `EXP-YYYY-<8 hex mayúsculas>`.
- Al crear se rechazan cohortes CANCELADA, FINALIZADA_PENDIENTE_EVAL, EVALUADA_SETEC; no se exige INSCRIPCION_ABIERTA ni se comprueban fechas de inscripción. La UI puede filtrar catálogo, pero no afirmar que ese filtro sea un guard del servidor.
- Se usa el total de inscripciones consideradas activas por el DAO y los verificados para decidir LISTA_ESPERA. El DAO cuenta todos los estados distintos de RETIRADO, incluida LISTA_ESPERA.
- Cuando `requiere_titulo_grado_rn` es true, se exige `titulo_presentado_id` perteneciente al aspirante. El código no verifica ahí que `inscrito_registro_nacional` sea true, ni que el título esté VALIDADO ni su nivel específico. Identidad verificada y título validado son acciones separadas; validate-documents no las consulta automáticamente.
- No hay endpoint específico de aprobación de ponencia, promoción desde lista de espera, retiro, reembolso, ni transición genérica de inscripción. Que un estado exista en ENUM no significa que haya acción HTTP implementada para alcanzarlo.
- La convalidación exige evidencia y créditos 1–15/no superiores a la asignatura; dictaminarla no modifica automáticamente `matricula_componentes_snepa.es_convalidada` ni registra nota.

### 8.4. Notas SNEPA: Excel, cierre y auditoría

El formulario debe enviar `archivo_excel` y el UUID de **programacion_componentes_cohorte.id**, no el UUID de componente curricular ni el de cohorte. El script `src/scripts/generate-snepa-template.ts` genera `uploads/actas_excel/plantilla_acta_snepa.xlsx`; si el archivo está generado, URL pública `http://localhost:3000/uploads/actas_excel/plantilla_acta_snepa.xlsx`. No existe ruta HTTP para generar la plantilla; `npm run gen:excel` es una tarea del backend, no una llamada del Frontend.

Formato recomendado (fila 1 headers, primera hoja solamente):

| Columna | Obligatoria para import | Interpretación real |
|---|---|---|
| `codigo_expediente` | Sí | Identifica inscripción; se exige misma cohorte de la programación. Sin código se ignora la fila. |
| `identificacion` | No | Informativa en plantilla; el importador no la usa para buscar/validar. |
| `nombre_completo` | No | Informativa en plantilla; el importador no la usa para buscar/validar. |
| `calificacion_cuantitativa` | Sí | `Number(valor)` entre 0 y 100. Una celda vacía se convierte a 0; la UI puede advertirlo. |
| `valoracion_cualitativa` | No | Literal ENUM SNEPA; si falta o es inválido se calcula desde nota. |
| `autoevaluacion_completada` | No | Boolean/1 o strings true: si, s, true, 1, v, verdadero, yes, y (trim/lowercase); resto false. `SÍ` con tilde no está en esa lista. |
| `coevaluacion_completada` | No | Misma interpretación. |
| `observacion_acompanamiento_pedagogico` | No | Texto de acompañamiento. |

Se reconocen cabeceras normalizadas (minúsculas, sin tildes, separadores a `_`): código/expediente, cuantitativa/nota/calificacion, cualitativa/valoracion, auto, coe, observacion/pedagogico/acompanamiento. Preferir los nombres exactos de la tabla para evitar coincidencias ambiguas.

| Nota cuantitativa | Cualitativa calculada |
|---|---|
| >=90 | APRENDIZAJE_AVANZADO |
| >=80 y <90 | APRENDIZAJE_SATISFACTORIO |
| >=70 y <80 | APRENDIZAJE_FUNDAMENTAL |
| <70 | APRENDIZAJE_INICIAL |

Si se proporciona cualitativa válida, prevalece aun si no corresponde con la nota. `aprobado` se determina por cualitativa distinta de APRENDIZAJE_INICIAL cuando hay cualitativa; sin ella, nota>=70. No recalcular un `aprobado` diferente en UI.

Flujo previsto del importador: verifica actas abiertas, lee .xlsx, registra lote y hace upsert por `(inscripcion_id,componente_id)`. Filas inválidas/inexistentes/de otra cohorte se reportan en `errores_filas` mientras otras pueden guardarse. Un archivo con todas las notas inválidas puede provocar 400 antes de crear lote; un archivo sin filas útiles puede devolver lote con cero procesados. `total_filas_leidas` se calcula como `parsedRows.length + errores_filas.length`; algunos errores detectados después del parseo pueden inflar ese total respecto de filas únicas. Mostrar los contadores devueltos sin inferir que equivalen al número físico de filas. No existe rollback por cada error de fila de negocio: el éxito parcial usa HTTP 201.

**Actas cerradas:** deshabilitar importar y mostrar estado de solo lectura si `actas_notas_cerradas === true`. El importador sí lo comprueba. La edición manual **no** comprueba ese flag actualmente, aunque su consulta lo carga; si la UI también bloquea edición manual por cierre, es una política de UI adicional, no una garantía implementada en ese servicio. Cerrar/reabrir se realiza editando la programación con COHORTE_GESTIONAR; no hay endpoint especializado de cierre.

Modal de edición manual: exigir `motivo_modificacion` (servidor min5 sin trim; UI debe evitar motivo compuesto solo de espacios), enviar calificación como number y booleanos JSON reales. Si cambia nota y no envía cualitativa, se recalcula SNEPA; si la envía, prevalece. Se actualiza `es_modificada_manualmente=true`, usuario/fecha de registro, y se inserta un log con nota/cualitativa anterior/nueva, motivo y usuario/fecha. El import masivo no añade esos logs individuales de rectificación. Ver sección 9: hay bloqueos SQL reales antes de que estos flujos se ejecuten sobre init.sql.

### 8.5. Graduación, idioma, publicaciones y verificación pública

Antes de habilitar emitir para un usuario con TITULO_EMITIR:

1. Debe existir expediente y no estar ya emitido (servidor considera emitido si **ambos** fecha_emision y codigo_registro_titulo_emitido existen).
2. Si `idioma_egreso_requerido != NINGUNO`, exigir `nivel_idioma_alcanzado` del expediente >= requerido según NINGUNO < A1 < A2 < B1 < B2 < C1 < C2, y `idioma_validado === true`.
3. Exigir al menos `num_publicaciones_requeridas` publicaciones con `validado_coordinacion=true`; además filtrar indexadas cuando `requiere_revista_indexada=true` y revisión por pares cuando `requiere_pares_evaluadores=true`. Un PDF cargado sin validación no cuenta.

Los GET de expediente no incluyen los requisitos del programa: recuperar el programa desde la inscripción/cohorte o catálogo cuando sea necesario. Para publicar una evidencia, el endpoint exige un archivo PDF real `evidencia_pdf`, no una URL textual. La validación de idioma se realiza con PATCH del expediente `idioma_validado`; no hay endpoint de “validar idioma” separado.

La emisión comprueba idioma/publicaciones; **no comprueba automáticamente** que estén todas las notas aprobadas, una deuda en cero, actas cerradas, estado EGRESADO, acta de defensa, documento final existente o validez del certificado de idioma por contenido. No presentar esas garantías como implementadas. Si la UI añade una política más estricta, debe identificarse como adicional.

El endpoint guarda el PDF/URL final suministrado, genera un código si falta (`SETEC-<subtipo sin caracteres no alfanuméricos>-YYYY-<6 hex mayúsculas>`), aplica fecha de body o fecha UTC actual y cambia la inscripción a GRADUADO_O_CERTIFICADO en la misma transacción. **No genera el archivo PDF ni una imagen QR**. La emisión puede dejar `documento_final_url=null`; manejar certificado sin enlace de descarga.

La URL a codificar en un QR/enlace de consulta es:

```text
http://localhost:3000/api/graduation/verify/<encodeURIComponent(codigo_registro)>
```

Es una consulta JSON pública, no una página visual ni descarga. Un Frontend puede crear su propia página de verificación y QR que llame a esa URL, pero eso no existe en el backend actual. La respuesta prevista incluye identidad/número de identificación del estudiante, programa, cohorte, sede, tipo y fecha y enlace digital; tratar esos datos como públicos cuando se publique. **La consulta QR actual está bloqueada por drift SQL**, descrito a continuación.

## 9. Incompatibilidades y límites comprobados que no debe ocultar la integración

Comparación estática con `database/init.sql`, no prueba contra una base de datos desplegada. Si una instalación tiene migraciones o vistas adicionales no incluidas aquí, verificarla por separado; no asumirlas. El error SQL nativo de columna/tabla inexistente no está mapeado a error operacional y termina en HTTP 500:

```json
{
  "success": false,
  "message": "Internal server error"
}
```

| Hallazgo concreto | Rutas/flujo afectados frente a init.sql | Evidencia |
|---|---|---|
| `ApplicantDao.getInterests` selecciona `ac.codigo`, pero areas_conocimiento contiene `id,nombre,slug,icono_url,activa` sin codigo | GET perfil por ID o /me; GET/PUT intereses; PUT perfil; POST perfil cuando tiene intereses no vacíos. Un POST perfil sin intereses no llama getInterests y puede funcionar. PUT /me puede fallar ya al obtener el perfil. Transacciones que llaman esta consulta revierten sus cambios. | `src/modules/applicants/applicant.dao.ts:449–468`; servicios createProfile/updateProfile/getProfileById/getProfileByUsuarioId/replaceInterests |
| Programas: input.tag_ids se propaga a `Object.keys(data)` y SET como si fuera columna | PUT /api/programs/:id con tag_ids → columna inexistente; usar endpoint dedicado POST /:id/tags. El schema acepta tag_ids, pero no hace que exista columna. | `src/modules/programs/program.service.ts` updateProgram; `src/modules/programs/program.dao.ts:488–534` |
| `GradesDAO.getProgramacionComponenteById` usa `cc.nombre_modulo`, `cc.codigo_componente`, `cc.creditos_academicos`; las columnas reales son nombre/codigo/creditos | POST import y GET notas por componente fallan en consulta previa, antes de revisar cierre/importar/listar | `src/modules/grades/grades.dao.ts:45–75` |
| `getMatriculaComponenteById` también usa nombre_modulo/codigo_componente | PATCH nota y GET logs fallan ya en lectura previa | `src/modules/grades/grades.dao.ts:221–245` |
| Kardex usa nombre_modulo/codigo_componente/creditos_academicos/orden_secuencia, ninguna de esas columnas existe en componentes_curriculares (usa nombre/codigo/creditos/orden_bloque) | GET /api/grades/student/:inscripcionId | `src/modules/grades/grades.dao.ts:361–382` |
| Logs selecciona `u.rol`; usuarios tiene rol_id y se necesitaría resolver roles | GET logs, además del fallo de lectura previa | `src/modules/grades/grades.dao.ts:386–403` |
| QR hace JOIN sedes_universitarias y selecciona nombre_sede; init.sql define sedes_ies.nombre | GET /api/graduation/verify/:codigoRegistro falla incluso antes de decidir si código existe | `src/modules/graduation/graduation.dao.ts:418–450` |

Estos hallazgos no se corrigieron: el alcance es generar contrato/tipos, no modificar comportamiento del servidor. Los tipos de las proyecciones afectadas describen las claves pretendidas por SQL/controlador, no una garantía de respuesta exitosa.

Otras precauciones funcionales verificadas:

- Los permisos de lectura no equivalen a control de propiedad; hay rutas autenticadas sin restricciones de propietario/asignación, y listados públicos que no filtran datos privados/publicación. El Frontend no puede corregir esto con botones ocultos.
- Los defaults de PUT reinician idioma/estado del programa, estado de cohorte e intereses de perfil. Se verificó `safeParse({})` con el Zod instalado: programa → `{idioma_egreso_requerido:"NINGUNO",estado_vigencia:"ACTIVO"}`; cohorte → `{estado_cohorte:"PLANIFICADA"}`; perfil → `{intereses_areas_ids:[]}`. Documentar y preservar valores explícitos al editar.
- Los nombres de archivos no garantizan extensión o PDF válido en todos los módulos, y los errores de Multer no tienen traducción propia. No hay endpoint de limpieza de archivos huérfanos.
- Se conserva el typo de dominio **BAUCHER** en ENUM, carpetas, DTO y mensajes porque es el contrato real; no reemplazarlo por VOUCHER en llamadas.

## 10. Checklist de entrega al equipo Frontend

- [ ] Separar origen público de uploads y base `/api`; no concatenar `/api/uploads`.
- [ ] Usar JWT Bearer y rotación completa de refresh; logout con refresh explícito.
- [ ] Habilitar acciones por `permisos`/override, no por rol solamente; no tratar UI como barrera de seguridad.
- [ ] Diferenciar `programa_id`, `componente_id`, `programacion_componente_id`, `inscripcion_id`, `expediente_id` y `usuario_id` de personal_academico.id.
- [ ] Preservar defaults de edición y colecciones al guardar; preferir endpoint dedicado para tags.
- [ ] Refrescar inscripción/cohorte tras validar documentos o pagos; usar AND para permitir subir baucher.
- [ ] Mostrar errores de fila de Excel aunque success=true, y bloquear importación con actas cerradas.
- [ ] No prometer generación de PDF/QR ni verificación pública operativa hasta resolver los desajustes SQL.
- [ ] Integrar `frontend-types.ts` sin importar Express, Zod, PostgreSQL ni módulos internos del backend.


## Academic billing extension (2026-10-21)

The API remains canonical. All new amounts use exact decimal strings (maximum two decimal places; NUMERIC(12,2)); no implicit rounding, interest, penalties or new discount rule. Prices in an accepted enrollment agreement are immutable snapshots. The existing documentary-approval plus cohort-quorum transition creates obligations for the new and previously reserved students, once. GET account never creates debt. A zero enrollment fee creates no enrollment obligation. A free cohort creates an agreement with no charges. Administrative matriculation activation is explicit, including free cohorts; recording/approving money does not activate enrollment.

| Endpoint (all under `/api/billing`) | Permission and behavior |
| --- | --- |
| `GET /students` | PAGO_VALIDAR or INSCRIPCION_VALIDAR; distinct people linked to enrollments, literal full-name/identifier/expediente search, minimal identity fields and server pagination (details below) |
| `GET /cohorts/:id/plans` | COHORTE_GESTIONAR, INSCRIPCION_VALIDAR or PAGO_VALIDAR; all immutable offer versions |
| `POST /cohorts/:id/plans` | COHORTE_GESTIONAR; publish name/version, mode, separate enrollment fee and academic cost, installments, optional due dates and real program component IDs |
| `GET /enrollments/:id/account` | Own student, INSCRIPCION_VALIDAR or PAGO_VALIDAR; agreed amounts, obligations, approved/pending allocations, exact balance, overdue/next due date, history and internal receipt metadata |
| `POST /enrollments/:id/plan` | INSCRIPCION_VALIDAR; `{plan_id}` chooses an offer before obligations are accepted |
| `POST /enrollments/:id/accept` | INSCRIPCION_VALIDAR; `{plan_id?, motivo?}` accepts the visible offer. Historical approved payments require an explicit reason confirming the agreed price and recognizing credits atomically. Insufficient agreed total rejects the whole reconciliation |
| `POST /enrollments/:id/activate` | INSCRIPCION_VALIDAR; `{motivo}` explicitly activates an approved, quorum-eligible enrollment regardless of payment coverage; reason is audited |
| `POST /enrollments/:id/payments` | PAGO_VALIDAR; immediate atomic collection against selected obligations, approval and internal receipt; does not activate matriculation |
| `POST /enrollments/:id/payments/:paymentId/cancel` | PAGO_ANULAR; `{motivo}` voids an approved collection, restores available debt and annotates the retained receipt |
| `POST /enrollments/:id/obligations/:obligationId/cancel` | OBLIGACION_ANULAR; `{motivo}` only for obligations without approved/pending allocations |
| `GET /enrollments/:id/receipts/:receiptId.pdf` | Own student, INSCRIPCION_VALIDAR or PAGO_VALIDAR; private PDF with uniquely assigned `CI-` number and any void annotation; suitable for downloading/printing |
| `GET /enrollments/:id/audit` | PAGO_VALIDAR; latest 200 economic events |
| `GET /dashboard` | COHORTE_GESTIONAR, INSCRIPCION_VALIDAR or PAGO_VALIDAR; server totals, pending/overdue amounts, today's approved operations, recent collections and receipt links |

Every success above is HTTP 200 `{success:true,data:...}`. Student discovery additionally returns `pagination:{total,page,limit,totalPages}` at the top level. Its optional query parameters are `search` (trimmed, maximum 120 characters), `page` (positive integer, default 1), and `limit` (1–50, default 10). Search covers full names, full identifiers and enrollment expediente codes, but the response exposes only `id`, `nombres`, `apellidos`, `tipo_identificacion`, and `identificacion_terminacion` (last four identifier characters). People without enrollments are excluded; multiple matching enrollments return one person. Results sort by surnames, names and ID, and count plus page share a repeatable-read, read-only transaction. Invalid input is 400, unauthorized access 403, missing resources 404, and inconsistent state/retry/available balance 409. The plan modes are GRATUITO, PAGO_UNICO, CUOTAS and MODULOS; academic installment amounts sum exactly to the academic price, excluding the enrollment fee. MODULOS requires actual components from this cohort's program. A different offer may be selected before acceptance. Publishing a default offer updates current cohort reference prices atomically, but never accepted obligations. Subsequent reference-price edits use a new plan version.

Example collection: `{ "clave_idempotencia": "a-client-generated-unique-key", "metodo_pago": "CAJA_ADMINISTRATIVA", "numero_referencia_o_recibo": "CAJA-001", "aplicaciones": [{ "obligacion_id": "<UUID>", "importe": "4000.00" }] }`. Total is computed on the server. Retain the key across uncertain/retried requests. Reusing a key/reference with changed financial data returns 409; an exact replay returns the same payment and receipt without another collection. Pending student vouchers reserve available amounts but do not reduce the approved outstanding balance; rejection releases the reservation. Overpayments, duplicate allocations, cancelled obligations and different-enrollment allocations are rejected transactionally.

The existing `POST /api/enrollments/:id/payments` remains the reviewable voucher-reporting interface. `monto_subtotal` and positive `total_pagado` are required, money must have at most two decimals and `subtotal - descuento = total`; optional `clave_idempotencia` and `aplicaciones` are supported (JSON arrays may be encoded as JSON strings in multipart). Legacy clients without selections allocate to outstanding obligations in ledger order and derive a stable retry key from the reference. Active matriculated students can report subsequent installments; review never revokes their administrator activation. PASARELA_ONLINE is not enabled. Existing payment approval still returns `{pago,inscripcion}`, now with a separate internal receipt in the account and no automatic academic activation.

Obligation states are calculated from approved allocations/due date: PENDIENTE, PARCIALMENTE_PAGADO, PAGADO, VENCIDO; ANULADO is explicit audited metadata. Cancellation does not rewrite accepted prices or delete history. An existing payment may expose ANULADO. Cancellation permissions are separate, initially unassigned to ordinary cashier roles; SUPER_ADMIN retains the existing override. An internal receipt is not a fiscal invoice. Tax identifiers, fiscal authorization, authorized numbering/format and fiscal correction procedures remain pending institutional approval. No bank/card processing or online collection is implemented.

Historical debt is never inferred from today's tariff merely because old payments exist. Account returns `requiere_conciliacion:true` and an unknown (`null`) outstanding balance until an administrator explicitly confirms the agreement and existing credits. Agreements without known prices likewise expose null amounts rather than a fabricated zero balance. Configure an explicit agreed-price plan when a pre-existing cohort discount needs interpretation; no automatic new discount calculation is introduced.
