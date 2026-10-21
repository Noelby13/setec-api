# Frontend API handoff
Objective: Produce an exact frontend integration contract and dependency-free TypeScript types from current backend sources.
Delivery: local files only, no Git repository available; strategy single-pr (no publication); checks: source inventory, structural readback and standalone tsc --noEmit. Engram mirror pending (unknown_project).

## Specs
S1. "Crea `FRONTEND_API_CONTRACT.md` documentando con total precisión" configuration, nine PostgreSQL enums, RBAC, every actual endpoint in eight functional modules plus auth, requests, responses, and business rules. Quote and preserve exact API field names. Distinguish requested UI policies from actual server enforcement; no backend changes authorized.
S2. "Crea `frontend-types.ts` en la raíz exportando todos los tipos e interfaces TypeScript (ENUMs, entidades de base de datos, DTOs de Request y estructuras de Response) sin ninguna dependencia de backend, listo para copiarse directamente al proyecto Frontend."

## Tasks
- T1 | S1 | delegated (parallel independent deliverables with disjoint edit surfaces) | complete | FRONTEND_API_CONTRACT.md | static coverage 88/88 routes; no commit: workspace has no .git.
- T2 | S2 | delegated (parallel independent deliverables with disjoint edit surfaces) | complete | frontend-types.ts | standalone tsc passed; no commit: workspace has no .git.

## Log
L1. Original request (verbatim):

Inspecciona todos los archivos actuales en `src/modules/`, `src/middlewares/`, `src/types/` y `@database/init.sql`. Necesito que generes dos archivos en la raíz del proyecto para entregárselos a otro proyecto que construirá el Frontend:

1. Crea `FRONTEND_API_CONTRACT.md` documentando con total precisión (según el código real que acabas de programar):
   - **Configuración Base:** URL base (`http://localhost:3000/api`), estructura estándar de respuestas JSON (éxito y error), manejo de autenticación Bearer JWT + Refresh Token, y cómo construir las URLs públicas para visualizar los archivos estáticos en `/uploads/...`.
   - **Diccionario de ENUMs y Permisos RBAC:** Lista exacta de los 9 ENUMs, los roles (`SUPER_ADMIN`, `COORDINADOR`, `CAJERO`, `DOCENTE`, `ESTUDIANTE`) y qué permiso (`permisos.codigo`) exige cada vista/acción para ocultar o mostrar botones en la UI.
   - **Catálogo Completo de Endpoints por Módulo (Los 8 módulos):** Para cada ruta real en `*.routes.ts`, detalla método HTTP, URL exacta, headers/permisos requeridos, estructura exacta del `body` (JSON o nombres de campos `multipart/form-data` en Multer), query params y ejemplo de respuesta.
   - **Reglas de Negocio Críticas que el Frontend debe reflejar en la UI:**
     a) **Normativa SETEC en Programas y Cohortes:** Validación condicional en formularios (si `es_ciencias_salud = true`, obligar a subir `aval_minsa` y bloquear modalidad `VIRTUAL`; si es `DOCTORADO_LICENCIATURA` o `DOCTORADO_MAESTRIA`, deshabilitar `estructurado_por_cursos`; si es `DOCTORADO_LICENCIATURA`, exigir `programa_salida_intermedia_id`; cupos de posgrado entre 15 y 30 salvo que marque `tiene_excepcion_cupo_setec` y suba el respaldo).
     b) **Menores de Edad:** Si la edad calculada desde `fecha_nacimiento` del aspirante es < 18 años (en cursos de extensión que lo permitan), mostrar y exigir los campos de tutor legal (`tutor_nombre_completo`, `tutor_identificacion`, `tutor_documento`).
     c) **Máquina de Estados de Inscripción, Quórum y Caja:** Explicar el flujo visual para el alumno y el admin (`EN_REVISION_DOCUMENTAL` -> 15 verificados disparan `QUORUM_ALCANZADO_COBRANDO` -> pasa de `INSCRITO_RESERVADO` a `PENDIENTE_PAGO` -> el botón de "Subir Baucher" solo se habilita al estudiante cuando `cobro_habilitado === true` o su estado es `PENDIENTE_PAGO` -> `PAGO_EN_REVISION` -> `MATRICULADO_ACTIVO`).
     d) **Notas SNEPA y Auditoría:** Estructura de columnas del Excel a subir, bloqueo cuando `actas_notas_cerradas = true`, y obligatoriedad del campo `motivo_modificacion` en el modal de edición manual de nota.
     e) **Graduación y Certificados:** Reglas de bloqueo antes de emitir título (verificar `idioma_egreso_requerido` y `num_publicaciones_requeridas`) y ruta pública de consulta QR.

2. Crea `frontend-types.ts` en la raíz exportando todos los tipos e interfaces TypeScript (ENUMs, entidades de base de datos, DTOs de Request y estructuras de Response) sin ninguna dependencia de backend, listo para copiarse directamente al proyecto Frontend.

L2. Read-only mapping inspected 50 files plus schema and relevant wiring. Observed 88 module endpoints, 25 tables, nine SQL enums and 12 additional TypeScript CHECK domains. Spot checked payment guard and mounted routers. No pre-existing tests or test script. No meaningful runtime RED for additive passive contract/types exports; source coverage and independent compilation are applicable.
L3. Both requested deliverables exceed the 400-line planning heuristic because they cover the full API; retaining complete coverage is required, not splitting or omitting endpoints. No commits, branches, PRs, Git initialization, backend modifications, network calls or runtime DB writes are authorized or required. Local task log retained because requirements and independent deliverables need recovery context.
L4. Writers completed S1 and S2. Contract: 88 endpoints, 120 valid JSON examples, enums, roles/permissions, all DTO catalogs, SQL row catalogs and caveats. Types: 21 domains, 25 row entities / 289 columns, requests and responses, 88 endpoint mappings; no imports. Each writer ran source coverage checks. Parent repeated standalone tsc successfully.
L5. Native review assessment reported high/unassessable because no Git repository exists; the tool attempted implicit git initialization, denied by filesystem permissions. No .git was created; no retry, initialization or lifecycle START attempted. Native review remains unavailable, not approved. Independent read-only verifier ran in /tmp scratch: S1/S2 conform, 88 route/auth/permission/status matches, 120 valid JSON examples, SQL columns/nullability/numeric representations covered, compiler exit 0. No HTTP/DB tests performed. Existing backend/schema incompatibilities are disclosed, not repaired.
L6. Independent verifier found one nonblocking export-name mismatch (EndpointMap versus ApiEndpointMap) at contract line 149; parent corrected that reference. No backend source was changed. Engram mirror remains pending: project key correctly detected as posgradosetecapi, but writes rejected unknown_project. Deliver root artifacts with static checks and explicit runtime-verification limits.
