# UNCSM academic ecosystem
Objective: integrate the existing API/backoffice and a new local student portal. Branch: feat/uncsm-student-ecosystem.
Delivery: single-pr, local work-unit commits only; no push, PR or deployment. Forecast: ~3000 authored lines. Runners: node --import tsx --test; Vitest; Vite; OpenSpec.

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
Authorized scope and acceptance: Students submit only for open cohorts, see their own applications and next steps; duplicates and unauthorized reads are rejected.

### S5: Administrative integration and role dashboards
User requirement (verbatim): "Los permisos deben comprobarse en la API, no solamente ocultando opciones visuales."
Authorized scope and acceptance: Existing backoffice preserves its modules, adds authorized user management and real operational summaries, and isolates cashier actions.

### S6: Student dashboard and academic history
User requirement (verbatim): "No inventes asistencia, calificaciones ni porcentajes de avance."
Authorized scope and acceptance: Authenticated student routes show only real own profile, applications, enrolled programs and final academic records, with actionable empty/error states.

### S7: Safe academic certificate integration
User requirement (verbatim): "No inventes diseños oficiales ni reglas de emisión."
Authorized scope and acceptance: Existing issued documents can be consulted and publicly verified with minimal fields; unavailable official templates and revocation policy are recorded as blockers rather than fabricated.

### S8: Cross-project verification and execution guide
User requirement (verbatim): "Utiliza datos de prueba aislados. Nunca ejecutes cobros reales para probar el sistema."
Authorized scope and acceptance: Contract copies are checked automatically; local unit/build/isolated HTTP and frontend flow results and remaining integration gaps are documented honestly.

## Tasks
- [ ] T1 → S1; route: inline; status: pending; commit: pending. Parent owns coordination, documentation and seams.
- [ ] T2 → S2; route: delegated; status: pending; commit: pending. Writer trigger: parallel disjoint backend and new-portal units.
- [ ] T3 → S3; route: delegated; status: pending; commit: pending. Writer trigger: parallel disjoint backend and new-portal units.
- [ ] T4 → S4; route: delegated; status: pending; commit: pending. Writer trigger: parallel disjoint backend and new-portal units.
- [ ] T5 → S5; route: inline; status: pending; commit: pending. Parent owns coordination, documentation and seams.
- [ ] T6 → S6; route: delegated; status: pending; commit: pending. Writer trigger: parallel disjoint backend and new-portal units.
- [ ] T7 → S7; route: inline; status: pending; commit: pending. Parent owns coordination, documentation and seams.
- [ ] T8 → S8; route: inline; status: pending; commit: pending. Parent owns coordination, documentation and seams.

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
