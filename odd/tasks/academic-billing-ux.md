# Academic billing and administrative usability
Objective: deliver the full attached academic UX, financial obligations, cashier, documents, dashboards and student-account request.
Branch: feat/uncsm-student-ecosystem in each affected repository. Delivery: ask-on-risk with feature-branch-chain selected by delegated user judgment, local only; forecast >400 authored lines; no publication authorized. Runners: Vitest/Playwright, Node/tsx, PostgreSQL isolated integration, Vite/TypeScript builds.

## Specs

- S1: "Quiero una experiencia visual coherente con dicho portal." "El botón Guardar debe estar disponible de forma clara y consistente." "Puede navegar libremente entre secciones." "Debe poder cancelar y salir del formulario." "Si existen modificaciones sin guardar, se debe advertir y permitir elegir entre continuar editando o descartarlas." "No deben perderse datos debido a cambios de pestaña." "Revisa también los formularios de cohortes y otros procesos administrativos relacionados."
- S2: "No debes confundir el precio de matrícula con el precio del programa." "El total de cuotas debe coincidir con el precio acordado, salvo reglas explícitas existentes." "La matrícula se contabiliza separadamente cuando corresponda." "No inventes intereses, recargos, descuentos ni sanciones por mora."
- S3: "se deben activar por un administrador" "No generes las mismas obligaciones dos veces." "No permitas que cambios posteriores en los precios generales alteren silenciosamente las obligaciones ya aceptadas por estudiantes." "No inventes esa decisión si no está definida." "Utiliza importes decimales exactos y reglas de redondeo consistentes. No realices cálculos monetarios usando números de punto flotante sin control."
- S4: "El sistema debe permitir registrar pagos contra obligaciones existentes." "Utiliza transacciones de base de datos para las operaciones que lo requieran." "Conserva un historial auditable de cobros, anulaciones y modificaciones autorizadas."
- S5: "Importante: distingue entre factura fiscal y comprobante interno de pago. No declares que un documento cumple requisitos legales sin verificar su formato y procedimiento. Si faltan datos o reglas fiscales, implementa lo que sea seguro y deja documentada la parte pendiente de aprobación." "No inventes integraciones bancarias ni procesadores de tarjetas."
- S6: "Prioriza las tareas operativas sobre gráficos decorativos." "Programa → Cohorte → Plan de pagos → Estudiante → Estado de cuenta → Caja." "El usuario no debería tener que buscar manualmente información que el sistema ya conoce."
- S7: "No habilites pagos electrónicos si todavía no existe un mecanismo configurado y autorizado." "Mantén consistencia entre la información mostrada al estudiante y la utilizada por Caja."
- S8: "Utiliza OpenSpec para organizar los cambios, manteniendo especificaciones breves y orientadas a implementación." "Antes de programar, inspecciona lo que ya existe." "No consideres terminada una funcionalidad solamente porque el código compila."

The complete original request in L1 defines all acceptance details, examples and scope; quoted excerpts above do not narrow it. Existing Spanish UI copy remains Spanish.

## Tasks

- [x] T1 · S1,S8 · inline: shared-form/program/cohort UX; no writer reason · setecweb commit a28e61b0bcd5e0caaa9cb9c854d77d84fe387723
- [ ] T2 · S2,S3,S8 · inline: exact-money plans, snapshots, obligations at existing quorum/documentary boundary · manual administrator activation confirmed; implementation pending · commit pending
- [ ] T3 · S4,S5,S8 · inline: transactional allocations, idempotency, auditable internal receipts/PDF · commit pending
- [ ] T4 · S1,S2,S4,S6,S8 · inline: cohort plan configuration and obligation-based cashier · commit pending
- [ ] T5 · S6,S7,S8 · inline: authorized financial dashboards and student account · commit pending
- [ ] T6 · S1-S8 · independent verifier: high-risk financial/security/concurrency/shared-contract changes; isolated connected verification · commit pending

## Log

### L1 · 2026-10-21 · Original request (verbatim)

# Objetivo: Rediseño UX/UI administrativo y mejora integral de la gestión de pagos académicos

Actúa como Senior Full-Stack Engineer, UX/UI Designer y Software Architect especializado en sistemas de gestión académica, procesos administrativos y facturación.

Quiero que analices e implementes mejoras sobre el sistema existente de Educación Permanente y Posgrado.

Trabajarás sobre:
- `POSGRADOSETECAPI`: backend y base de datos.
- `setecweb`: plataforma administrativa.
- Los demás proyectos consumidores de la API cuando resulte necesario.

El objetivo no es reconstruir el sistema, sino corregir problemas existentes, mejorar los procesos administrativos y completar el flujo económico de matrícula, cuotas, cobros y facturación.

Utiliza OpenSpec para organizar los cambios, manteniendo especificaciones breves y orientadas a implementación.

Antes de programar, inspecciona lo que ya existe.

# CAMBIO 1. MEJORA INTEGRAL DE UX/UI ADMINISTRATIVA

## 1.1. Consistencia visual

Analiza la interfaz administrativa actual y compárala con el diseño del SETEC Portal existente.

Quiero una experiencia visual coherente con dicho portal.

Revisa:
- Navegación y menú lateral.
- Jerarquía visual.
- Tipografía.
- Colores institucionales.
- Formularios.
- Tablas.
- Botones.
- Modales.
- Espaciados.
- Mensajes de error.
- Estados de carga.
- Notificaciones.
- Adaptación a dispositivos móviles.

Reutiliza los componentes y estilos existentes siempre que sea conveniente.

No quiero un rediseño puramente estético. La prioridad es mejorar la usabilidad de las operaciones reales.

## 1.2. Corregir el formulario de programas académicos

Actualmente, crear y editar programas académicos presenta problemas de usabilidad.

Por ejemplo:

El formulario está dividido en secciones o pestañas y, en determinados casos, el usuario tiene que desplazarse hasta la sección de etiquetas para poder guardar modificaciones realizadas en otras secciones.

Además, el comportamiento del guardado y la navegación resulta confuso. En ocasiones, no permite abandonar el proceso sin guardar.

Investiga el código y reproduce los problemas antes de implementar la solución.

### Comportamiento esperado

- El usuario puede crear un programa mediante un flujo ordenado.
- Puede navegar libremente entre secciones.
- Puede editar información de cualquier sección sin desplazarse artificialmente a otra para guardar.
- El botón Guardar debe estar disponible de forma clara y consistente.
- El sistema debe mostrar qué información es obligatoria.
- Los errores deben aparecer cerca del campo correspondiente.
- El usuario debe poder corregir errores sin perder información.
- Debe poder cancelar y salir del formulario.
- Si existen modificaciones sin guardar, se debe advertir y permitir elegir entre continuar editando o descartarlas.
- No debe bloquearse la navegación innecesariamente.
- No deben perderse datos debido a cambios de pestaña.
- Después de guardar, debe proporcionar confirmación y un destino de navegación claro.

Evalúa si conviene utilizar:
- Formulario por pasos.
- Secciones organizadas.
- Guardado de borradores.
- Barra de acciones persistente.
- Validación progresiva.

Selecciona la alternativa que reduzca la carga cognitiva y resulte más coherente con la estructura actual.

No implementes todas estas alternativas simultáneamente.

### Principios de diseño

Aplica:
- Divulgación progresiva de información.
- Reconocimiento en lugar de memorización.
- Prevención de errores.
- Consistencia.
- Retroalimentación inmediata.
- Reducción de pasos innecesarios.
- Acciones claramente identificables.

Revisa también los formularios de cohortes y otros procesos administrativos relacionados.

Corrige inconsistencias similares cuando se encuentren directamente relacionadas con el flujo.

Evita refactorizaciones globales innecesarias.

# CAMBIO 2. GESTIÓN ECONÓMICA DE PROGRAMAS Y COHORTES

Necesito mejorar la administración de precios, matrículas, modalidades de pago y obligaciones económicas de los estudiantes.

El sistema debe permitir que el administrador defina cómo se cobra un programa o una cohorte, y que Caja conozca automáticamente qué debe pagar cada estudiante.

## 2.1. Precios académicos

Considera que los programas de Educación Permanente y Posgrado pueden tener diferentes estructuras de cobro.

Por ejemplo:

- Curso gratuito.
- Curso con un único pago.
- Programa con matrícula y un pago único.
- Programa con matrícula y pagos por módulos.
- Programa con matrícula y cuotas programadas.
- Cohortes de un mismo programa con precios diferentes, cuando la administración lo permita.

Antes de implementar, analiza cómo se representan actualmente los precios en la base de datos.

Reutiliza las tablas existentes siempre que sea posible.

Establece claramente la relación entre:
- Programa académico.
- Cohorte.
- Matrícula.
- Precio total.
- Plan de pagos.
- Obligaciones de pago.
- Pagos realizados.

Evita duplicar importes o generar inconsistencias.

## 2.2. Configuración de matrícula

El administrador debe poder establecer si un programa o cohorte requiere pago de matrícula.

Cuando aplique, podrá definir su importe.

El sistema debe distinguir entre:

- Matrícula.
- Costo académico del programa o cohorte.
- Saldo total pendiente.

No debes confundir el precio de matrícula con el precio del programa.

Si un programa no requiere matrícula pagada, no debe generarse un cobro por ese concepto.

La exigibilidad de la matrícula debe respetar las reglas institucionales existentes.

## 2.3. Planes y modalidades de pago

El administrador debe poder configurar cómo se cobrará el costo académico de una cohorte.

Ejemplo:

Un diplomado tiene un precio total de C$30,000 y consta de tres módulos.

El administrador decide permitir:

- Módulo 1: C$10,000.
- Módulo 2: C$10,000.
- Módulo 3: C$10,000.

Cada pago puede tener una fecha de vencimiento configurada.

También podría ofrecer pago único por C$30,000.

Debes distinguir el concepto de módulo académico del concepto de cuota. Una cuota puede estar vinculada a un módulo, pero no siempre son equivalentes.

Implementa, según las necesidades y datos actuales:

- Pago único.
- Pago por cuotas programadas.
- Pago por módulos, cuando exista relación académica real.
- Fechas de vencimiento.
- Conceptos de cobro.
- Importes de cada cuota.
- Estado de las obligaciones.

El total de cuotas debe coincidir con el precio acordado, salvo reglas explícitas existentes.

La matrícula se contabiliza separadamente cuando corresponda.

No inventes intereses, recargos, descuentos ni sanciones por mora.

Diseña una interfaz sencilla para configurar los pagos. El administrador no debería necesitar conocimientos contables ni técnicos para hacerlo.

## 2.4. Generación de obligaciones de pago

Este punto es fundamental.

Cuando un estudiante alcanza el estado académico o administrativo que corresponda para generar cobros, el sistema debe registrar sus obligaciones económicas.

Por ejemplo:

Estudiante: Juan Pérez

Programa: Diplomado en Gestión Académica

Cohorte: 2026-II

Matrícula: C$2,000

Costo académico: C$30,000

Plan: Tres cuotas de C$10,000.

Total comprometido: C$32,000.

El sistema debe conocer:
- Qué conceptos debe pagar.
- Cuánto corresponde a cada concepto.
- Cuánto ha pagado.
- Cuánto queda pendiente.
- Qué cuotas están vencidas.
- Cuál es el próximo vencimiento.

No generes las mismas obligaciones dos veces.

No permitas que cambios posteriores en los precios generales alteren silenciosamente las obligaciones ya aceptadas por estudiantes.

Investiga las reglas actuales para determinar en qué momento se generan los cobros: solicitud, admisión, matrícula u otro estado.

No inventes esa decisión si no está definida.

## 2.5. Estados de obligaciones

Implementa estados económicos coherentes.

Considera, si son aplicables:

- Pendiente.
- Parcialmente pagado.
- Pagado.
- Vencido.
- Anulado.

Distingue los estados persistidos de aquellos que pueden calcularse a partir de importes y fechas.

Evita mantener múltiples campos redundantes que puedan contradecirse.

Utiliza importes decimales exactos y reglas de redondeo consistentes. No realices cálculos monetarios usando números de punto flotante sin control.

# CAMBIO 3. MEJORAR EL MÓDULO DE CAJA

El módulo de Caja debe funcionar como una herramienta operativa para registrar y consultar cobros académicos.

El cajero no debería calcular manualmente cuánto debe un estudiante.

## 3.1. Selección del estudiante

Implementa un proceso sencillo:

1. El cajero busca al estudiante por los identificadores disponibles.
2. Selecciona al estudiante.
3. El sistema muestra sus programas o cohortes vinculadas.
4. Visualiza sus obligaciones económicas.
5. Selecciona el concepto o los conceptos que desea cobrar.
6. El sistema calcula el total.
7. El cajero registra el pago.
8. Se actualiza el saldo.
9. Se genera el documento de cobro correspondiente.

La interfaz debe ser clara, rápida y adecuada para trabajo continuo.

## 3.2. Estado de cuenta del estudiante

Al seleccionar un estudiante, Caja debe mostrar información como:

- Programa y cohorte.
- Matrícula pendiente, si corresponde.
- Cuotas programadas.
- Pagos realizados.
- Saldo pendiente.
- Próximos vencimientos.
- Obligaciones vencidas.

El cajero debe poder identificar fácilmente qué pago está registrando.

No mezcles importes de diferentes cohortes sin identificar su origen.

## 3.3. Registro de pagos

El sistema debe permitir registrar pagos contra obligaciones existentes.

Analiza si los pagos parciales son compatibles con las reglas actuales. Si lo son, impleméntalos de forma segura.

Por ejemplo:

Una cuota de C$10,000 recibe un abono de C$4,000.

El saldo pendiente pasa a ser C$6,000.

Cuando se registra el resto, la cuota queda completamente pagada.

El sistema debe impedir:
- Cobros duplicados por reintentos.
- Saldos negativos.
- Pagos aplicados a estudiantes equivocados.
- Modificaciones no autorizadas.
- Inconsistencias entre pagos y obligaciones.

Utiliza transacciones de base de datos para las operaciones que lo requieran.

Conserva un historial auditable de cobros, anulaciones y modificaciones autorizadas.

## 3.4. Facturación y comprobantes

Después de registrar un pago, Caja debe poder emitir el documento correspondiente.

Analiza primero los mecanismos de facturación existentes y los requisitos institucionales aplicables.

Si existe un formato de factura válido, reutilízalo.

El documento debe incluir los datos de identificación, conceptos, importes, fecha y referencias exigidos por las reglas aplicables.

Debe permitir:
- Consultar documentos emitidos.
- Imprimirlos.
- Descargar PDF.
- Vincularlos con el pago.
- Evitar numeración duplicada.
- Consultar anulaciones o correcciones.

Importante: distingue entre factura fiscal y comprobante interno de pago. No declares que un documento cumple requisitos legales sin verificar su formato y procedimiento. Si faltan datos o reglas fiscales, implementa lo que sea seguro y deja documentada la parte pendiente de aprobación.

No inventes integraciones bancarias ni procesadores de tarjetas.

# CAMBIO 4. MEJORAR EL DASHBOARD Y LOS PROCESOS

Actualiza los dashboards administrativos pertinentes.

El administrador debe poder visualizar, según sus permisos:

- Estudiantes inscritos.
- Cohortes activas.
- Programas con procesos abiertos.
- Solicitudes pendientes.
- Obligaciones económicas pendientes.
- Indicadores de cobranza, cuando existan datos verificables.

El cajero debe disponer de un dashboard específico con:

- Acceso rápido a cobrar.
- Búsqueda de estudiantes.
- Cobros recientes.
- Pagos pendientes y vencidos.
- Consulta de documentos emitidos.
- Resumen de operaciones autorizadas.

Prioriza las tareas operativas sobre gráficos decorativos.

También mejora la navegación entre:

Programa → Cohorte → Plan de pagos → Estudiante → Estado de cuenta → Caja.

El usuario no debería tener que buscar manualmente información que el sistema ya conoce.

# CAMBIO 5. SINCRONIZACIÓN CON EL PORTAL DEL ESTUDIANTE

Comprueba si el portal del estudiante necesita modificaciones por los nuevos mecanismos de pago.

Cuando corresponda, el estudiante debería poder consultar:

- Matrícula pendiente.
- Costo académico.
- Plan de pagos asignado.
- Cuotas.
- Fechas de vencimiento.
- Historial de pagos.
- Saldo pendiente.
- Comprobantes disponibles.

No habilites pagos electrónicos si todavía no existe un mecanismo configurado y autorizado.

Mantén consistencia entre la información mostrada al estudiante y la utilizada por Caja.

# CAMBIO 6. VALIDACIÓN Y PRUEBAS

No consideres terminada una funcionalidad solamente porque el código compila.

## Pruebas UX

Comprueba que:

- Se puede crear un programa completo.
- Se puede guardar desde

### L2 · 2026-10-21 · Initial evidence and routing
Read-only explorer map_academic_system completed; skill_resolution paths-injected. All three repositories clean on feat/uncsm-student-ecosystem. Shared RecordForm actions are bottom-only; switching program detail tabs unmounts the editor. Existing collection trigger is documentary approval plus quorum; approving any payment activates matriculation. New automatic coverage/free-cohort rule is not defined. User clarification pending; financial implementation must wait on that decision. UI implementation is independent. No fiscal format is defined; only clearly labelled internal receipts can be implemented. No remote operations authorized. Engram tools unavailable: full recovery mirror pending; local file is authoritative. Native gentle-ai executable not found in current shell, native review mode/assessment unavailable; independent functional verification remains required. Attached source ends at "- Se puede guardar desde"; no missing content inferred.

### L3 · 2026-10-21 · Institutional clarification (verbatim)

se deben activar por un administrador

Decision: enrollment activation requires an explicit administrator decision. Recording or approving money must not automatically activate an enrollment; free cohorts also require an administrator decision. Preserve existing documentary/quorum eligibility for collection. Update the existing payment-to-matriculation coupling with explicit authorized activation and regression tests.

### L4 · 2026-10-21 · T1 RED evidence

Focused Vitest run of src/shared/ui.test.jsx and src/features/programs/ProgramsPage.test.jsx: 5 failing new regression tests, 9 existing tests passing. Reproduced lost program values across tabs, cancellation/close without confirmation, missing browser unload protection and bottom-only actions. The tags-specific requirement to save is not reproduced in this version; existing public edit submission saves without tags. Preserve that behavior.

### L5 · 2026-10-21 · Delivery choice (verbatim)

lo que consideres mejor

The user authorizes selecting the delivery strategy. Chosen: feature-branch-chain; retain local work-unit commits on the existing feature branch in each affected repository. No push, pull request, merge or remote operation. First slice: administrative form usability. Later slices: financial model/obligations, transactional payments/documents, administrative/portal integration and connected validation. Final slice boundaries depend on verified coherent units, not a hard line limit.

### L6 · 2026-10-21 · T1 checks

After source normalization with existing Prettier: focused Vitest 14/14 passing, full backoffice Vitest 158/158 passing across 25 files, Vite production build successful. Independent browser verification pending in an isolated scratch copy. T1 remains unchecked until that result is observed. Native gentle-ai command unavailable, no native risk assessment or approval claimed. Risk item 3: opt-in protection changes shared form/modal infrastructure; existing ordinary form behavior remains covered.

### L7 · 2026-10-21 · T1 verified and committed

Local setecweb work-unit commit a28e61b0bcd5e0caaa9cb9c854d77d84fe387723 (511 additions, 87 deletions including public regression tests/docs; coherent shared form behavior kept together). Focused 16/16; full suite 160/160; full format check and Vite build passed after final normalization. Independent scratch Chrome verification: initial 10/10 desktop/mobile journeys passed; additional unsaved tag probe exposed requested pre-existing loss. One correction batch retained tagSession outside resource reloads and set close button type explicitly. Recheck limited to both reported findings: 16/16 focused and 4/4 desktop/mobile browser probes passed. Parent repeated focused 16/16. No new sweep. All receipts/native assessment unavailable because gentle-ai executable absent, no approval claimed. Engram mirror pending. No remote operations or real data changes. Risk: item 3 (shared form/modal behavior used by other administrative operations).
