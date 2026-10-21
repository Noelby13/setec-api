# UNCSM academic ecosystem
Objective: integrate the existing API/backoffice and a new local student portal. Branch: feat/uncsm-student-ecosystem.
Delivery: single-pr per repository if later authorized, local work-unit commits only; no push, PR or deployment. Forecast: ~3000 authored lines. Runners: node --import tsx --test; Vitest; Vite; OpenSpec.

## Specs

### S1: Audit existing systems and API contracts
User requirement (verbatim): "Debes inspeccionar ambos proyectos antes de modificar código."
Authorized scope and acceptance: Both existing repositories, contract copies, data model, permissions and available checks are mapped without touching live data.

### S2: Student identity and controlled user management
User requirement (verbatim): "El registro público nunca debe permitir asignar privilegios administrativos."
Authorized scope and acceptance: Student registration cannot assign roles; authenticated reads and administrative operations enforce account activity, permissions and ownership.

### S3: Public academic catalog and cohort selection
User requirement (verbatim): "Diferencia claramente entre un programa publicado, una cohorte disponible y una cohorte que admite inscripciones."
Authorized scope and acceptance: The third local application consumes actual catalog data, offers search and cohort selection, and preserves selection through authentication.

### S4: Enrollment applications and tracking
User requirement (verbatim): "No asumas que enviar una solicitud significa estar admitido, haber pagado o encontrarse matriculado."
Authorized scope and acceptance: Students submit only for open cohorts, see their own applications and next steps; duplicates and unauthorized reads are rejected. Original requirement: "No permitas transiciones de estado arbitrarias." Documentary/payment decisions serialize their current state and cannot reset finalized academic records, overcount capacity or bypass own approval/quorum. Committee decisions and waiting-list promotion require an established institutional process.

### S5: Administrative integration and role dashboards
User requirement (verbatim): "Los permisos deben comprobarse en la API, no solamente ocultando opciones visuales."
Authorized scope and acceptance: Existing backoffice preserves its modules, adds authorized user management and real operational summaries, and isolates cashier actions.

### S6: Student dashboard and academic history
User requirement (verbatim): "No inventes asistencia, calificaciones ni porcentajes de avance."
Authorized scope and acceptance: Authenticated student routes show only real own profile, applications, enrolled programs and final academic records, with actionable empty/error states.

### S7: Safe academic certificate integration
User requirement (verbatim): "No inventes diseños oficiales ni reglas de emisión."
Authorized scope and acceptance: Existing issued documents can be consulted and publicly verified with minimal fields; a linked technical registry records immutable recipient/program metadata, random public tokens, PDF hashes and controlled revocation events. Official PDF templates and academic decisions remain institutional inputs, not invented rules.

### S8: Cross-project verification and execution guide
User requirement (verbatim): "Utiliza datos de prueba aislados. Nunca ejecutes cobros reales para probar el sistema."
Authorized scope and acceptance: Contract copies are checked automatically; local unit/build/isolated HTTP and frontend flow results and remaining integration gaps are documented honestly.

## Tasks
- [x] T1 → S1; route: inline; status: audited and OpenSpec validated; commit: 34eefd4. Parent owns coordination, documentation and seams.
- [x] T2 → S2; route: delegated; status: verified identity increment; commit: 7cc5120; role-filter extension: dff1cf4. Writer trigger: parallel disjoint backend and new-portal units.
- [x] T3 → S3; route: delegated; status: catalog and contextual public journey verified; commit: portal f8295b7. Writer trigger: parallel disjoint portal/backend units.
- [x] T4 → S4; route: delegated; status: own applications, eligibility/transaction guards and connected admission/payment verified; commits: API dff1cf4, 240ba76, 618d8e0; portal f8295b7. Writer trigger: portal parallel with backend; parent owns API seams and corrections.
- [x] T5 → S5; route: delegated; status: permission-scoped operations and actual Caja/matriculation verified; commits: backoffice a8c1162, b8b1fc6; API dff1cf4, 240ba76. Writer trigger: disjoint administrative UI, identity and portal units.
- [x] T6 → S6; route: delegated; status: own dashboard/history, degree correction, schedule and recorded academic results verified; commit: portal f8295b7. Writer trigger: parallel disjoint portal/backend units.
- [x] T7 → S7; route: delegated; status: validated technical registry/PDF/public/revocation scope complete; institutional inputs documented; commits: API a11fca0, backoffice bc34f66, portal f8295b7. Writer trigger: disjoint registry and frontend units with own tests.
- [ ] T8 → S8; route: inline; status: functional acceptance/evidence complete; Needs your decision: native review unavailable and requires explicit disposition; commit: 05afb6b. Parent owns seams/docs; long/independent checks delegated per action.

## Log

### L1 — Original authorized request (verbatim)

# OBJETIVO: Desarrollo integral de la plataforma de Educación Permanente y Posgrado

Actúa como un equipo de ingeniería de software senior especializado en arquitectura full-stack, sistemas de gestión académica, diseño UX/UI, seguridad, pruebas automatizadas e integración de sistemas.

Quiero que trabajes de forma autónoma para completar y mejorar mi plataforma de Educación Permanente y Posgrado de la UNCSM.

No quiero solamente funcionalidades aisladas. Quiero un ecosistema integrado, intuitivo, organizado, seguro y mantenible, donde estudiantes, docentes y personal administrativo puedan completar sus procesos sin dificultades.

## 1. CONTEXTO DEL PROYECTO

Dentro de V1 existen dos proyectos:

- `POSGRADOSETECAPI`: backend Node.js, API y base de datos.
- `setecweb`: plataforma web administrativa.

También existen contratos, tipos TypeScript, documentación y funcionalidades previamente desarrolladas.

Debes inspeccionar ambos proyectos antes de modificar código.

Analiza:

- Arquitectura existente.
- Base de datos y relaciones.
- Endpoints.
- Autenticación y autorización.
- Roles y permisos.
- Programas académicos, cursos y cohortes.
- Estudiantes, docentes e inscripciones.
- Matrículas y pagos.
- Gestión académica.
- Certificados y documentación académica.
- Componentes visuales, diseño y navegación actuales.
- Pruebas existentes.

Identifica qué funcionalidades están completas, cuáles son parciales y cuáles faltan.

Reutiliza el código existente y evita duplicar funcionalidades.

## 2. NUEVA APLICACIÓN WEB PÚBLICA Y PORTAL DEL ESTUDIANTE

Crea una tercera aplicación dentro de V1, conectada a la API existente.

La aplicación tendrá dos espacios:

1. Portal público de oferta académica.
2. Portal privado del estudiante.

Debe tener una identidad institucional coherente, diseño profesional, moderno, responsive y accesible.

### 2.1. Portal público de oferta académica

Los visitantes podrán:

- Explorar programas de Educación Permanente y Posgrado.
- Filtrar y buscar programas académicos.
- Consultar cursos, diplomados, especialidades, maestrías y otros programas existentes.
- Consultar información académica detallada.
- Visualizar modalidad, duración, créditos, requisitos, costos y fechas cuando la información esté disponible.
- Consultar las cohortes de cada programa.
- Identificar cohortes con inscripciones abiertas.
- Consultar los requisitos y el proceso de inscripción.
- Iniciar el proceso de inscripción desde la página del programa.

Diferencia claramente entre un programa publicado, una cohorte disponible y una cohorte que admite inscripciones.

No inventes precios, calendarios ni información académica.

### 2.2. Registro e inicio de sesión

Implementa:

- Registro de estudiantes.
- Inicio y cierre de sesión.
- Recuperación segura de acceso, cuando sea viable con los servicios configurados.
- Perfil personal.
- Actualización de información autorizada.
- Validaciones de formularios.
- Manejo claro de errores.
- Protección de cuentas y sesiones.

El estudiante no debe tener que registrarse repetidamente para diferentes cursos.

La experiencia debe permitir que un visitante seleccione una cohorte y continúe su inscripción después de crear su cuenta o iniciar sesión, sin perder el contexto.

### 2.3. Inscripción académica

Diseña e implementa un proceso de inscripción intuitivo.

Flujo esperado:

1. El estudiante encuentra un programa.
2. Consulta su información.
3. Selecciona una cohorte abierta.
4. Inicia sesión o crea su cuenta.
5. Completa su solicitud.
6. Proporciona los requisitos necesarios.
7. Envía la solicitud.
8. Visualiza una confirmación.
9. Consulta el estado del trámite.
10. Continúa los pasos administrativos correspondientes hasta su matrícula, cuando proceda.

Investiga las reglas de negocio existentes para definir los estados y transiciones correctas.

No asumas que enviar una solicitud significa estar admitido, haber pagado o encontrarse matriculado.

Evita solicitudes duplicadas y operaciones inconsistentes.

Cuando un trámite requiera intervención administrativa, la interfaz debe explicar claramente el estado actual y el siguiente paso.

## 3. PORTAL DEL ESTUDIANTE

El estudiante tendrá un dashboard personal que concentre toda su información académica y administrativa relevante.

No quiero que tenga que navegar por múltiples pantallas desorganizadas para descubrir qué debe hacer.

### 3.1. Dashboard principal

Mostrar, según los datos disponibles:

- Bienvenida personalizada.
- Cursos o programas activos.
- Solicitudes de inscripción en proceso.
- Próximas clases o actividades, si existe programación.
- Trámites académicos pendientes.
- Obligaciones de pago, cuando corresponda.
- Avisos o información relevante.
- Certificados disponibles.
- Accesos rápidos a las actividades principales.

Cada elemento debe llevar directamente a la función correspondiente.

### 3.2. Mis cursos y programas

El estudiante podrá consultar:

**En curso**
- Programas en los que se encuentra matriculado.
- Cohorte correspondiente.
- Información general del programa.
- Fechas y horarios, si están registrados.
- Docente asignado, si corresponde.
- Estado académico.
- Progreso académico, únicamente cuando existan datos que permitan calcularlo correctamente.

**Finalizados**
- Historial de programas cursados.
- Fechas de participación.
- Estado final.
- Resultados académicos cuando estén disponibles y autorizados.
- Certificados asociados.

**Solicitudes**
- Inscripciones pendientes.
- Solicitudes en revisión.
- Solicitudes aprobadas, rechazadas o que requieren acciones adicionales, conforme al modelo real.
- Información de los pasos pendientes.

Diferencia correctamente solicitud, matrícula, participación y finalización.

No inventes asistencia, calificaciones ni porcentajes de avance.

### 3.3. Detalle de un programa matriculado

Diseña una vista donde el estudiante pueda conocer:

- Información del programa.
- Cohorte.
- Docentes.
- Calendario de clases, cuando exista.
- Módulos o asignaturas, cuando estén modelados.
- Estado académico.
- Información de pagos autorizada.
- Certificados o documentos relacionados.

No conviertas automáticamente el sistema en un LMS completo. Si no existe gestión de tareas, evaluaciones, videoclases o contenidos didácticos, no la desarrolles sin necesidad.

Prioriza la consulta y gestión de información académica real.

### 3.4. Certificados digitales verificables

Implementa o integra un módulo de certificados digitales.

El estudiante podrá:

- Consultar certificados emitidos.
- Descargar certificados en PDF.
- Consultar sus detalles.
- Compartir un enlace de verificación pública.
- Verificar la autenticidad mediante un código o QR.

Cada certificado deberá tener un identificador público difícil de adivinar, un estado de validez y un mecanismo de verificación.

Diseña una página pública para verificar certificados sin necesidad de iniciar sesión.

La verificación deberá mostrar solamente los datos institucionales y académicos estrictamente necesarios para comprobar la autenticidad, evitando exponer datos personales innecesarios.

Considera:

- Certificado válido.
- Certificado revocado.
- Certificado inexistente.
- Control de quién puede emitir, modificar o revocar certificados.
- Protección contra emisión indebida.
- Registro de acciones relevantes.
- Prevención de falsificación o manipulación.

Los certificados solo deben emitirse conforme a las reglas académicas y autorizaciones correspondientes.

Revisa primero si existe un módulo, plantilla, formato o mecanismo institucional de certificación. No inventes diseños oficiales ni reglas de emisión.

Si la normativa o el diseño institucional no están suficientemente definidos, implementa únicamente los componentes que puedan validarse y documenta lo pendiente.

## 4. BACKEND: GESTIÓN INTEGRAL DE USUARIOS

Implementa o completa las funcionalidades de usuarios en POSGRADOSETECAPI.

Debe permitir:

- Registro público de estudiantes.
- Autenticación.
- Consulta de usuarios.
- Creación administrativa de usuarios.
- Actualización de usuarios.
- Activación y desactivación.
- Asignación controlada de roles.
- Gestión de perfiles.
- Consulta de permisos.

Reutiliza las tablas y mecanismos de autorización existentes.

Evita crear entidades duplicadas.

### Roles principales

**Estudiante**
- Gestiona su perfil.
- Consulta sus solicitudes.
- Consulta cursos y programas.
- Visualiza su información académica.
- Consulta pagos y certificados autorizados.

**Administrador**
- Gestiona usuarios y las operaciones correspondientes a sus permisos.
- Consulta información administrativa.
- Gestiona solicitudes.
- Gestiona procesos académicos autorizados.

**Docente**
- Conserva las funcionalidades docentes existentes.
- Consulta únicamente su información y actividades académicas autorizadas.

**Cajero**
- Accede únicamente al módulo de Caja.
- Consulta información de pagos relevante.
- Registra o gestiona operaciones de cobro autorizadas.
- Consulta comprobantes o historial de operaciones según sus permisos.

Un cajero no debe acceder a funcionalidades de configuración general, gestión de usuarios o administración académica si no dispone de permisos adicionales.

Los permisos deben comprobarse en la API, no solamente ocultando opciones visuales.

El registro público nunca debe permitir asignar privilegios administrativos.

## 5. MEJORAR LA PLATAFORMA ADMINISTRATIVA

Modifica `setecweb` para completar los procesos administrativos necesarios.

Mantén las funcionalidades existentes y su identidad institucional.

### 5.1. Dashboard administrativo general

Diseña una pantalla principal profesional y funcional.

Debe concentrar información relevante para operar la plataforma.

Incluye, cuando existan datos que lo respalden:

- Total de estudiantes.
- Programas publicados.
- Cohortes activas.
- Cohortes con inscripciones abiertas.
- Solicitudes pendientes.
- Matrículas.
- Solicitudes que requieren intervención.
- Operaciones administrativas recientes.
- Accesos rápidos a funcionalidades importantes.

Considera tablas, filtros, tarjetas de indicadores y gráficos solo cuando aporten valor real.

Los indicadores deben obtenerse de consultas reales, no de datos ficticios.

### 5.2. Dashboard de Caja

Cuando un usuario con rol Cajero inicie sesión, debe encontrar un entorno enfocado en sus tareas.

Ejemplos de información pertinente:

- Pagos pendientes de gestión.
- Operaciones recientes.
- Historial de cobros.
- Consulta de obligaciones.
- Comprobantes.
- Accesos rápidos para registrar operaciones permitidas.

Solo mostrar información que corresponda a sus permisos.

No permitas acceder a operaciones administrativas ajenas al módulo de Caja.

No inventes estados financieros, reglas de facturación ni mecanismos de pago.

### 5.3. Dashboard docente

Si el sistema actual permite que los docentes accedan a la plataforma, diseña una experiencia adecuada a ese rol.

Puede incluir:

- Cursos o programas asignados.
- Cohortes vinculadas.
- Información académica pertinente.
- Estudiantes asociados cuando esté permitido.
- Próximas actividades, si existe programación.

Respeta las funcionalidades y reglas ya implementadas.

### 5.4. Gestión de usuarios

Incorpora interfaces para:

- Listar y buscar usuarios.
- Crear usuarios.
- Editar datos.
- Activar y desactivar.
- Asignar roles autorizados.
- Identificar estudiantes, docentes y personal administrativo.

### 5.5. Gestión de inscripciones

Proporciona un flujo administrativo claro para consultar y gestionar solicitudes.

El personal autorizado debe poder:

- Consultar solicitudes.
- Filtrar por programa, cohorte y estado.
- Revisar información.
- Ejecutar las acciones permitidas.
- Consultar el historial del trámite cuando corresponda.

No permitas transiciones de estado arbitrarias.

### 5.6. Gestión de certificados

Cuando las reglas académicas lo permitan, incorpora herramientas administrativas para:

- Consultar certificados.
- Emitir certificados autorizados.
- Verificar su estado.
- Revocarlos mediante acciones controladas.
- Consultar su historial.

No permitas emisión automática basada únicamente en que un estudiante aparezca matriculado.

## 6. EXPERIENCIA DE USUARIO Y DISEÑO DE PROCESOS

Esta sección es prioritaria.

Quiero una plataforma que se sienta organizada y fácil de utilizar, no una colección de formularios y tablas sin conexión.

Analiza los procesos completos antes de diseñar las interfaces.

### Principios UX/UI

- Navegación simple.
- Jerarquía visual clara.
- Interfaces consistentes.
- Diseño responsive.
- Accesibilidad.
- Formularios comprensibles.
- Validaciones y mensajes útiles.
- Estados vacíos informativos.
- Indicadores de carga.
- Confirmación de acciones importantes.
- Prevención de acciones duplicadas.
- Menús adaptados al rol.
- Búsqueda y filtros cuando sean necesarios.
- Reducir pasos innecesarios.
- Mantener el contexto entre pantallas.

### Procesos guiados

Para trámites que incluyan varias etapas, utiliza una representación clara del progreso.

Por ejemplo, el estudiante debe poder identificar visualmente dónde se encuentra dentro del proceso de inscripción y qué acciones faltan.

No utilices pasos ficticios ni fuerces un orden que contradiga las reglas institucionales.

### Organización del frontend

Diseña una navegación lógica.

**Portal público:** Inicio, Oferta académica, Detalle de programa, Acceso y Registro.

**Portal del estudiante:** Inicio, Mis cursos, Mis solicitudes, Certificados, Mi perfil.

**Plataforma administrativa:** Dashboard, Oferta académica, Cohortes, Inscripciones, Usuarios, Caja, Certificados y Configuración, según permisos.

No muestres opciones que no correspondan al rol ni funcionalidades inexistentes.

Reutiliza componentes visuales y evita inconsistencias entre pantallas.

No introduzcas bibliotecas de UI innecesarias si el sistema ya cuenta con componentes reutilizables.

## 7. COORDINACIÓN ENTRE LOS TRES PROYECTOS

Esta regla es obligatoria.

Los tres proyectos deben mantenerse sincronizados:

1. POSGRADOSETECAPI.
2. setecweb.
3. Nueva aplicación pública y portal del estudiante.

Analiza los archivos `FRONTEND_API_CONTRACT.md` y `frontend-types.ts` existentes.

Establece una fuente de verdad clara para el contrato de la API.

Cuando modifiques endpoints:

- Comprueba sus consumidores.
- Evita cambios incompatibles.
- Actualiza los frontends afectados.
- Actualiza tipos y contratos.
- Ejecuta pruebas de integración.
- Verifica que no existan regresiones conocidas.

Puedes introducir OpenAPI para formalizar el contrato cuando aporte valor.

Si trabajas con múltiples agentes, coordina sus responsabilidades y evita modificaciones contradictorias sobre los mismos archivos.

## 8. USO DE OPENSPEC

Este proyecto debe gestionarse con OpenSpec debido a su alcance.

No generes un único cambio gigantesco y difícil de comprobar.

Divide el trabajo en incrementos funcionales:

1. Auditoría de sistemas y contratos existentes.
2. Gestión de usuarios y permisos.
3. Oferta académica y cohortes.
4. Inscripciones y seguimiento.
5. Integración administrativa y dashboards.
6. Portal privado del estudiante e historial académico.
7. Certificados digitales y verificación pública.
8. Pruebas integrales y revisión de experiencia de usuario.

Define dependencias y ajusta el orden cuando sea necesario.

Cada incremento debe tener requisitos claros, tareas concretas y criterios de aceptación verificables.

No conviertas OpenSpec en burocracia. Utiliza documentación breve y útil.

## 9. PRUEBAS INTEGRALES

Debes comprobar el funcionamiento del sistema completo.

### Flujo público

- Consultar catálogo.
- Visualizar un programa.
- Seleccionar cohorte abierta.
- Registrarse.
- Iniciar sesión.
- Enviar solicitud de inscripción.
- Consultar su estado.

### Flujo administrativo

- Iniciar sesión con permisos administrativos.
- Consultar dashboard.
- Gestionar usuarios.
- Revisar solicitudes.
- Ejecutar las acciones autorizadas.
- Verificar cambios reflejados en la cuenta del estudiante.

### Flujo académico

- Consultar programas matriculados.
- Consultar programas finalizados.
- Visualizar información académica.
- Consultar certificados emitidos.

### Flujo de certificación

- Emitir certificado autorizado utilizando datos de prueba.
- Descargar PDF.
- Acceder al enlace público.
- Verificar autenticidad.
- Comprobar el comportamiento de certificados inexistentes o revocados.

### Flujo de Caja

- Acceder con rol Cajero.
- Consultar únicamente información autorizada.
- Ejecutar operaciones de prueba permitidas.
- Verificar restricciones de acceso.

### Seguridad y calidad

Comprueba:

- Autenticación.
- Autorización por rol.
- Acceso restringido a datos de otros usuarios.
- Validación de entradas.
- Estados de cohortes.
- Solicitudes duplicadas.
- Integridad referencial.
- Compatibilidad de contratos.
- Pruebas de backend y frontend.
- Recorridos de extremo a extremo.

Utiliza datos de prueba aislados. Nunca ejecutes cobros reales para probar el sistema.

## 10. AUTONOMÍA Y REGLAS DE TRABAJO

Quiero que trabajes autónomamente durante el tiempo de ejecución disponible.

Tienes autorización para:

- Investigar.
- Diseñar soluciones técnicas.
- Programar.
- Crear archivos.
- Modificar proyectos.
- Ejecutar pruebas locales.
- Corregir errores.
- Actualizar documentación.
- Crear commits locales.

No necesitas preguntarme sobre decisiones técnicas pequeñas y reversibles.

Sin embargo, no debes:

- Inventar normativas académicas.
- Inventar reglas de admisión o certificación.
- Ejecutar operaciones destructivas sobre datos reales.
- Modificar producción.
- Realizar despliegues o push.
- Eliminar funcionalidades existentes sin autorización.
- Introducir dependencias innecesarias.
- Desarrollar módulos no solicitados.
- Ejecutar cambios irreversibles sin aprobación.

Si una decisión de negocio importante no está definida, busca evidencia en el sistema y la documentación. Si sigue sin resolverse, documenta el bloqueo y continúa con trabajo independiente.

Evita sobreingeniería.

Prefiere soluciones simples, seguras, coherentes con la arquitectura actual y fáciles de mantener.

## 11. COMMITS Y SEGUIMIENTO

Trabaja mediante incrementos funcionales.

En cada incremento:

1. Implementa.
2. Prueba.
3. Corrige.
4. Actualiza contratos.
5. Revisa Git.
6. Crea un commit local descriptivo.
7. Actualiza el progreso.

Respeta los límites de cada repositorio.

Mantén documentación del avance para permitir continuar después de interrupciones.

No declares completada una tarea que no hayas verificado.

## 12. RESULTADO ESPERADO

El objetivo final es contar con un ecosistema donde:

- Un visitante descubre una oferta académica.
- El estudiante se registra.
- Solicita inscripción en una cohorte.
- El personal administrativo procesa la solicitud.
- La matrícula se gestiona según las reglas institucionales.
- El estudiante consulta sus cursos actuales e historial.
- El personal autorizado gestiona los procesos académicos.
- Caja puede realizar sus operaciones específicas.
- Los certificados se emiten cuando corresponde.
- El estudiante puede descargar y compartir certificados verificables.
- Cada rol tiene un dashboard funcional.
- Los tres proyectos funcionan coordinadamente.

Todo debe tener una experiencia de usuario clara, consistente y organizada.

## INSTRUCCIÓN FINAL

No te quedes únicamente en la planificación.

Utiliza OpenSpec, implementa por etapas, ejecuta pruebas y corrige los problemas detectados.

Trabaja autónomamente hasta completar el objetivo, alcanzar los límites de ejecución o encontrar bloqueos que realmente requieran intervención humana.

Al finalizar, presenta:

- Funcionalidades implementadas.
- Funcionalidades pendientes.
- Cambios en la base de datos.
- Endpoints creados o modificados.
- Dashboards y pantallas desarrolladas.
- Pruebas ejecutadas y resultados.
- Commits realizados.
- Problemas pendientes.
- Instrucciones para ejecutar los tres proyectos.

**La prioridad es conseguir un proceso académico y administrativo integral, funcional, seguro, fácil de utilizar y verificable, manteniendo compatibilidad con lo que ya existe.**

### L2 — 2026-10-21 initial evidence and route
Both repositories were inspected before source edits. API baseline 6678f3d on Main; backoffice baseline 91cbb79 on feat/uncsm-backoffice; both clean. New feature branches created in each. Independent repository boundaries are retained. No extra user-owned chat is created.
Existing catalog, cohorts, applications, payments, grades and graduation dossiers will be reused. No official certificate template or revocation policy has been established. PostgreSQL integration availability remains unproven; tests must not touch configured real data.
No project skill registry or Engram tools are available. Engram mirror odd/uncsm-ecosystem/tasks: PENDING (provider unavailable); this local document is the recovery source. gentle-ai is unavailable: native assessment/review unavailable, never treated as PASS. Independent security verification remains required.

### L3 — Verified implementation and bounded correction
Public registration, self-account editing and controlled administrative users were implemented by the identity worker. Its own 23 identity checks and TypeScript build passed. Parent ownership/application/file-safety checks brought the suite to 48, then pagination and assigned teaching checks to 51. Native gentle-ai assessment is unavailable and treated as high risk; it was not silently skipped as a PASS.
The independent verifier created a fresh scratch copy and a single isolated cached PostgreSQL container. Real-schema probes confirmed role-injection rejection, application 201/duplicate409/other-user403, own grades200, cashier restrictions and test-only payment approval, live permission removal/deactivation, and baseline-compatible login envelopes. It found private-file SQL using the wrong convalidation column, student URL assignment manufacturing ownership, and acceptance of a nonexistent certificate PDF. One correction batch fixed all three; targeted recheck passed owner200/other403/anonymous401, forged-reference403 without state changes, legitimate upload200, invalidPDF400 without state changes and valid fixture issuance200/minimal verification200. The temporary container was stopped and removed.
Backend test/data migrations were not applied to the configured project database. Existing default cashier permission cleanup is supplied as an optional reviewed SQL migration, not run automatically. Native review and Engram mirror remain unavailable.
Backoffice writer observed124 tests/build passed; portal writer25 tests/build passed. Browser checks and final teacher/portal verification are pending. Parent added protected-document download support to existing backoffice client (13 focused client/download checks passed) and retained all existing client tests.

### L4 — Complete teaching/browser evidence and certification increment
Assigned-teacher scope and complete own-history pagination were implemented and independently checked against isolated PostgreSQL: own class200/other403, invalid class400, cross-class import403 before uploads, whole other-student transcript403, and101 own records returned as100+1. Teacher/backoffice focused17 checks and portal25+3 independent probes passed. Baseline grade-log SQL used nonexistent usuarios.rol; parent corrected it to the roles join while preserving the response field.
Browser suites: backoffice8/8 passed. Initial portal suite failed due an unrelated occupied port and a broad route glob intercepting its JavaScript source; the corrected dedicated-port/exact-API fixture suite passed3/3. Four isolated screenshots show desktop/mobile catalog and dashboard, no mobile overflow. No real service/payment was reached.
Certification remains an explicitly requested increment, not a reason to stop at existing file links. Parent selected a linked technical certificate registry with cryptographically random public identifiers, SHA-256 document integrity, immutable minimal issued metadata, permission-controlled revocation and audit events. This changes no academic admission/completion rule or official document design. Fresh issuance continues through existing graduation requirements; legacy documents require explicit authorized registry association. New tables/migration are tested only on isolated databases and not applied to real configured data. Backend and frontend units may run in parallel with disjoint surfaces under the same task T7.

### L5 — Final functional checks and local work units
API identity commit 7cc5120 and academic ownership/teaching/application commit dff1cf4 are local only. The latter staged snapshot passed 50 tests and TypeScript build in a fresh scratch copy. Administrative integration commit a8c1162 passed its staged full Vitest suite/build; final backoffice 141 tests/build passed after isolating revocation-only registry operators from academic dossier lookups. Portal 45 tests/build passed after source normalization.
The finalized certificate unit passed 15 boundary tests, independent isolated PostgreSQL verification and parent replay. The complete API 69 tests/build passed. The retained integration runner now includes independent regression probes for academic gates and concurrent issuance, role/program count/list filters, title edit revalidation/no-op/rejected state injection and grade-audit role join. All injected failure cases preserved data and all owned PostgreSQL containers were removed. No configured database was touched.
The ownership unit exceeds the advisory 400-line heuristic because the same gate must protect existing resource routes together; the certificate unit includes its schema, migration, lifecycle tests and disposable integration runner as one verifiable transaction boundary. Delivery remains the previously selected single-pr strategy, with local commits only and no PR creation. Native review assessment remains unavailable, treated as high risk and never reported as approved. Engram mirror remains pending. Real connected browser verification is running as a separate read-only test action.

### L6 — Contract closure and preserved verification state
Canonical certificate routes/DTOs, role/program filters, degree revalidation and legacy verification booleans were read back against current code. All three contract copies match and standalone TypeScript compilation passed. Certificate commit a11fca0 and backoffice certificate commit bc34f66 close their local source units; new portal commit f8295b7 captures the runnable public/student application. Its copied contracts and generated lockfile are excluded from the authored-line heuristic; keeping the initial application runnable is preferable to splitting shared routing/styles into artificial fragments.
Final checks: API 69, backoffice 141 and portal 45 deterministic tests passed; all three production builds passed; fixture browser suites passed admin 8/8 and portal 3/3; strict OpenSpec validation passed 8/8. Parent replay of the safe isolated PostgreSQL integration runner returned complete: true, including retained independent regression probes. Native assessment and Engram mirror remain unavailable. No real data, push, deployment or charge occurred.
Two remaining delegated turns stopped at a usage limit. Their partial contract/report artifacts were preserved and structurally validated. The attempted connected-browser scratch was empty, no result was claimed, and the filtered local Docker inventory had no owned UNCSM test container. A subsequent read-only usage check confirmed execution allowed again; the connected-browser actor resumed. A separate read-only completion map compares the entire original scope to current source; it does not replace functional verification.

### L7 — Completion-map corrections within S4/S5
The read-only completion map covered the original scope and identified the administrative creation selector offering non-open cohorts. A focused RED test reproduced four offered states instead of only INSCRIPCION_ABIERTA; the filter and honest empty state were corrected, and focused checks passed.
Parent's bounded spot check of the original requirement "No permitas transiciones de estado arbitrarias." found documentary observations accepted after matriculation/finalization and approval state read before the cohort lock. The same transaction pattern permitted concurrent payment decisions and a rejected second receipt to undo established matriculation. These existing defects are in the explicitly requested integration boundary and must be corrected before acceptance. Nineteen public HTTP regression probes observed17 failures before implementation, including terminal-state changes, double quorum counting, duplicate receipt decisions and payment before own documentary approval. Preserve normal observation/approval/quorum/payment behavior and avoid inventing committee or waitlist promotion rules; those unresolved institutional processes remain documented. Independent high-risk verification is required after own checks for this additional work unit.

### L8 — Transition guards ready for independent verification
The30 public HTTP regression checks now pass after observed RED (17/19 failures initially;10 additional closed-cohort/quorum failures before their guards). A common transactional lock order—cohort, enrollment, receipt—rechecks fresh rows before a decision. Only documentary review/observed states accept document decisions; maximum capacity and closed cohorts cannot be bypassed. Receipt decisions are single-use, require prior own documentary approval and enabled collection, and cannot reactivate withdrawn/completed records. Rejecting another pending receipt preserves an existing matriculation/date. Existing below-quorum reservation and normal collection/matriculation behavior remain covered.
Own API suite99/build and backoffice 153/build passed. Administrative cohort choices are open-only, documentary actions reflect eligible states, and legacy observed-payment UI requires recorded prior approval. This is a contained new correction unit under T4/T5; no academic completion, committee, waiting-list or financial calculation rule was invented. Risk: items1,3,4; independent disposable PostgreSQL verification and final connected normal-flow replay remain pending.

### L9 — Explicit documentary input validation
A final bounded input-validation check reproduced malformed `aprobado` values being coerced to approval by the inherited boolean preprocessor. One RED public HTTP test failed before the fix; the compatibility test passed. The scoped documentary schema now rejects malformed/empty/null/numeric/object/array values with400 before the decision service, while preserving JSON booleans, recognized multipart strings and the existing omitted-field default. The generic creation preprocessor was not changed. Own focused2 checks and complete API 101/build passed. Independent narrow PostgreSQL validation remains pending; no broader review is requested.

### L10 — Final observed closure
The final strict documentary parser passed independent actual PostgreSQL/HTTP checks: malformed values 400 with unchanged enrollment/cohort rows; valid booleans, recognized multipart strings and omission retain behavior. Baseline 240ba76 misparsed all seven malformed cases as approval. Parent spot-check 2 tests and retained PostgreSQL replay passed; source fix commit 618d8e0. No new blocker remained.
Retained connected runner `npm run test:connected` passed 6/6 independently, exit0, real API/Chrome/PostgreSQL with no interception. It binds private ephemeral loopback ports and verifies a new disposable DB before SQL. All owned browsers, servers, pools and containers were closed; source hashes matched before/after. Previous public/profile/application and certificate 8 successful stages remain preserved; two harness failures (searchbox selector and numeric display precision) are explicitly retained, and corrected replay passes. Official PDFs, EGRESADO and grades are clearly labeled test inputs, not generated institutional decisions.
Final results: API 101 tests, backoffice 153, portal 45 (299 total); all three builds passed. Browser fixtures admin 8/8 and portal 3/3 passed. Strict OpenSpec 8/8 and contract-copy/type checks passed. Technical completion map covered the original requirements; its actionable selector/state/input findings were fixed and verified. Undefined committee/waitlist/egreso procedures, official PDF/signature and recovery delivery remain explicit institutional/configuration inputs, as permitted by the original request. No deployment, push, real charge or configured-database migration was performed.
Acceptance tooling and durable evidence commit 05afb6b includes the three-project run guide and screenshots. Native assessment/review remains unavailable, treated as high risk and never fabricated as PASS; independent functional verification was completed. Engram recovery mirror remains PENDING because the provider is unavailable; this local document is the durable recovery record.
Running non-generated added/deleted lines through acceptance commit 05afb6b (copied frontend contracts, lockfiles and binaries excluded; documentation included): POSGRADOSETECAPI 5983, setecweb 1939, setecportal 8152. The original forecast was advisory; the selected single-pr-per-repository delivery strategy remains local only.

### L11 — Needs your decision: native review unavailable
All authorized local implementation, functional verification, contract synchronization, OpenSpec and execution documentation are complete. The only unresolved workflow proof is native high-risk review: a fresh command-availability check confirms `gentle-ai` is unavailable, so mode/assessment/preflight cannot be negotiated. No native consent envelope, target binding, receipt or approval was invented, and no review preference was changed. Independent functional checks do not stand in for that native transaction.
The AGENTS.md unavailable-proof rule requires one human disposition: explicitly leave these local source candidates without native review, or keep review pending until the native CLI is available. This question concerns review only; it grants no push, deployment or real-database operation. T8 remains pending that decision. Engram mirror is separately pending as already documented, with the full recovery record preserved locally.
