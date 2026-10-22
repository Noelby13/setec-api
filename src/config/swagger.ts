import { billingOpenApiPaths } from '../modules/billing/billing.openapi';
import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API REST SNEPA-SETEC - Gestión de Posgrados y Educación Permanente',
    version: '1.0.0',
    description: `## Especificación OpenAPI 3.0.0
Sistema de Gestión Académica y Control Normativo para Programas de Posgrado y Educación Permanente, en estricto cumplimiento del Marco Normativo **SETEC** (Secretaría Técnica del Consejo Nacional de Universidades) y el Sistema Nacional de Evaluación, Calificación y Acreditación (**SNEPA**).

### Módulos Principales:
1. **Autenticación y Seguridad (RBAC):** Login con identificador/email, JWT access/refresh tokens, perfiles y control granular de roles y permisos.
2. **Taxonomía Académica:** Áreas de conocimiento estandarizadas y etiquetas temáticas para indexación y motores de recomendación.
3. **Infraestructura y Claustro Docente:** Sedes, subsedes, extensiones autorizadas por SETEC y docentes con legajo académico.
4. **Catálogo de Programas y Mallas:** Programas académicos (Posgrados y Educación Permanente), avales de MINSA, brochures, y asignaturas/componentes curriculares con sílabos.
5. **Cohortes y Programación Modular:** Apertura de ediciones, control de cupos máximos normativos y asignación de docentes/aulas por módulo.
6. **Aspirantes y Títulos Previos:** Ficha biopsicosocial, validación de títulos de grado en Registro Nacional y verificación de identidad.
7. **Inscripciones y Quórum Transaccional:** Admisiones, ponencias para congresos, quórum automático por cohorte, validación de bauchers de pago y dictámenes de convalidación.
8. **Calificaciones SNEPA y Auditoría:** Importación masiva de actas en Excel (.xlsx), escala cualitativa SNEPA, kardex estudiantil y bitácora inmutable de modificaciones manuales.
9. **Expedientes de Graduación y Verificación QR:** Requisitos de egreso (idioma MCER, defensa, salida intermedia), publicaciones científicas (ensayos/artículos indexados) y verificación pública de títulos por código de registro.`,
    contact: {
      name: 'Dirección de Posgrados y Educación Permanente SETEC',
      email: 'posgrados@setec.edu.ni',
    },
    license: {
      name: 'Propiedad Institucional SETEC',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Servidor Actual / Base Path',
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Entorno de Desarrollo Local',
    },
  ],
  tags: [
    { name: 'Billing', description: 'Exact academic obligations, cashier operations and internal receipts' },
    { name: 'Auth', description: 'Autenticación, emisión y renovación de tokens JWT, control de sesiones' },
    { name: 'Taxonomy', description: 'Áreas de conocimiento y etiquetas temáticas del catálogo' },
    { name: 'Infrastructure', description: 'Sedes universitarias autorizadas por SETEC y gestión de docentes' },
    { name: 'Programs', description: 'Programas de posgrado / educación permanente y componentes curriculares' },
    { name: 'Cohorts', description: 'Cohortes de apertura, control de quórum normativo y programación modular' },
    { name: 'Applicants', description: 'Perfiles de aspirantes, verificación de identidad y títulos de grado previo' },
    { name: 'Enrollments', description: 'Inscripciones, quórum transaccional, bauchers de pago y convalidaciones' },
    { name: 'Grades', description: 'Importación Excel SNEPA, calificaciones cualitativas/cuantitativas y bitácora de auditoría' },
    { name: 'Graduation', description: 'Expedientes de titulación, publicaciones científicas y verificación pública por QR' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el Token JWT obtenido en `/auth/login` (Ejemplo: `Bearer eyJhbGci...`)',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Descripción detallada del error o validación' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          errors: {
            type: 'array',
            items: { type: 'object' },
            example: [{ field: 'email', message: 'Formato de correo electrónico inválido' }],
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operación ejecutada exitosamente' },
          data: { type: 'object' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['password'],
        properties: {
          identifier: { type: 'string', example: 'admin@setec.edu.ni', description: 'Email o nombre de usuario' },
          email: { type: 'string', format: 'email', example: 'admin@setec.edu.ni' },
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', format: 'password', example: 'Admin123*' },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
        },
      },
      CreateAreaRequest: {
        type: 'object',
        required: ['nombre'],
        properties: {
          nombre: { type: 'string', example: 'Ciencias Médicas y de la Salud' },
          slug: { type: 'string', example: 'ciencias-medicas-y-de-la-salud' },
          icono_url: { type: 'string', nullable: true, example: 'https://cdn.setec.edu.ni/icons/health.svg' },
          activa: { type: 'boolean', default: true, example: true },
        },
      },
      CreateTagRequest: {
        type: 'object',
        required: ['nombre'],
        properties: {
          nombre: { type: 'string', example: 'Epidemiología' },
          slug: { type: 'string', example: 'epidemiologia' },
        },
      },
      CreateSedeRequest: {
        type: 'object',
        required: ['codigo_sede', 'nombre', 'tipo_sede'],
        properties: {
          codigo_sede: { type: 'string', example: 'SEDE-MGA-01' },
          nombre: { type: 'string', example: 'Sede Central Managua' },
          tipo_sede: {
            type: 'string',
            enum: ['SEDE_CENTRAL', 'SEDE', 'SUBSEDE', 'EXTENSION', 'UNICAM'],
            example: 'SEDE_CENTRAL',
          },
          resolucion_autorizacion_setec: { type: 'string', nullable: true, example: 'RES-SETEC-2024-089' },
          direccion: { type: 'string', nullable: true, example: 'Costado Oeste Rotonda Universitaria, Managua' },
          activa: { type: 'boolean', default: true },
        },
      },
      CreateDocenteRequest: {
        type: 'object',
        required: ['identificacion', 'nombres', 'apellidos', 'maximo_grado_academico'],
        properties: {
          usuario_id: { type: 'string', format: 'uuid', nullable: true },
          identificacion: { type: 'string', example: '001-120580-0021A' },
          nombres: { type: 'string', example: 'Guillermo Antonio' },
          apellidos: { type: 'string', example: 'González López' },
          maximo_grado_academico: {
            type: 'string',
            enum: ['LICENCIADO', 'ESPECIALISTA', 'MASTER', 'DOCTOR'],
            example: 'DOCTOR',
          },
          biografia_comercial: { type: 'string', nullable: true, example: 'Especialista en Salud Pública con más de 20 años de experiencia' },
          activo: { type: 'boolean', default: true },
          foto_perfil: { type: 'string', format: 'binary', description: 'Archivo JPG/PNG de foto de perfil' },
          cv_pdf: { type: 'string', format: 'binary', description: 'Curriculum Vitae en PDF' },
        },
      },
      CreateProgramRequest: {
        type: 'object',
        required: ['codigo_interno', 'nombre', 'categoria', 'subtipo', 'area_conocimiento_id', 'titulo_o_certificado_otorgado'],
        properties: {
          codigo_interno: { type: 'string', example: 'MGS-2026' },
          codigo_dictamen_setec: { type: 'string', example: 'DICT-SETEC-2025-014' },
          fecha_aprobacion_setec: { type: 'string', format: 'date', example: '2025-11-15' },
          nombre: { type: 'string', example: 'Maestría en Gestión de Salud Pública' },
          slug: { type: 'string', example: 'maestria-gestion-salud-publica' },
          categoria: { type: 'string', enum: ['POSGRADO', 'EDUCACION_PERMANENTE'], example: 'POSGRADO' },
          subtipo: {
            type: 'string',
            enum: [
              'ESPECIALIDAD', 'MAESTRIA_PROFESIONAL', 'MAESTRIA_ACADEMICA',
              'DOCTORADO_LICENCIATURA', 'DOCTORADO_MAESTRIA', 'POSDOCTORADO',
              'CURSO_ESPECIALIZADO', 'CURSO_EXTENSION', 'TALLER', 'SEMINARIO',
              'CONGRESO', 'DIPLOMADO_PROFESIONAL', 'DIPLOMADO_EXTENSION'
            ],
            example: 'MAESTRIA_PROFESIONAL',
          },
          area_conocimiento_id: { type: 'string', format: 'uuid' },
          precio_total_referencia: { type: 'number', example: 3500 },
          descuento_porcentaje: { type: 'integer', example: 10 },
          visible_en_web: { type: 'boolean', example: true },
          es_ciencias_salud: { type: 'boolean', example: true },
          duracion_meses: { type: 'number', example: 24 },
          horas_totales: { type: 'integer', example: 1200 },
          creditos_totales: { type: 'integer', example: 60 },
          creditos_investigacion: { type: 'integer', example: 15 },
          requiere_titulo_grado_rn: { type: 'boolean', example: true },
          idioma_egreso_requerido: {
            type: 'string',
            enum: ['NINGUNO', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
            example: 'B1',
          },
          num_publicaciones_requeridas: { type: 'integer', example: 1 },
          requiere_revista_indexada: { type: 'boolean', example: true },
          titulo_o_certificado_otorgado: { type: 'string', example: 'Máster en Gestión de Salud Pública' },
          aval_minsa: { type: 'string', format: 'binary', description: 'PDF de aval MINSA para ciencias de la salud' },
          imagen_portada: { type: 'string', format: 'binary', description: 'Imagen de portada para vitrina web' },
          brochure_pdf: { type: 'string', format: 'binary', description: 'Brochure informativo en PDF' },
        },
      },
      CreateComponenteRequest: {
        type: 'object',
        required: ['codigo', 'nombre', 'orden_bloque', 'horas', 'creditos'],
        properties: {
          codigo: { type: 'string', example: 'MOD-01' },
          nombre: { type: 'string', example: 'Epidemiología Avanzada y Bioestadística' },
          descripcion_temario: { type: 'string', example: 'Métodos epidemiológicos, análisis multivariado y bioestadística' },
          orden_bloque: { type: 'integer', example: 1 },
          horas: { type: 'integer', example: 60 },
          creditos: { type: 'integer', example: 4 },
          es_investigacion: { type: 'boolean', example: false },
          costo_base_asignatura: { type: 'number', example: 250 },
          silabo_pdf: { type: 'string', format: 'binary', description: 'Documento PDF con el sílabo analítico' },
        },
      },
      CreateCohorteRequest: {
        type: 'object',
        required: [
          'programa_id', 'sede_id', 'modalidad', 'codigo_cohorte',
          'coordinador_id', 'fecha_inicio_inscripcion', 'fecha_fin_inscripcion',
          'fecha_inicio_clases', 'fecha_fin_clases'
        ],
        properties: {
          programa_id: { type: 'string', format: 'uuid' },
          sede_id: { type: 'string', format: 'uuid' },
          modalidad: {
            type: 'string',
            enum: ['PRESENCIAL', 'SEMIPRESENCIAL', 'VIRTUAL', 'MIXTA'],
            example: 'SEMIPRESENCIAL',
          },
          codigo_cohorte: { type: 'string', example: 'MGS-2026-I' },
          numero_edicion: { type: 'integer', example: 1 },
          coordinador_id: { type: 'string', format: 'uuid' },
          fecha_inicio_inscripcion: { type: 'string', format: 'date', example: '2026-01-15' },
          fecha_fin_inscripcion: { type: 'string', format: 'date', example: '2026-03-01' },
          fecha_inicio_clases: { type: 'string', format: 'date', example: '2026-03-15' },
          fecha_fin_clases: { type: 'string', format: 'date', example: '2028-03-15' },
          precio_matricula: { type: 'number', example: 150 },
          precio_total_cohorte: { type: 'number', example: 3500 },
          cupo_minimo: { type: 'integer', example: 15 },
          cupo_maximo: { type: 'integer', example: 30 },
          tiene_excepcion_cupo_setec: { type: 'boolean', example: false },
          excepcion_cupo_pdf: { type: 'string', format: 'binary', description: 'PDF de autorización excepcional de cupo' },
        },
      },
      ProgramarComponenteRequest: {
        type: 'object',
        required: ['componente_id'],
        properties: {
          componente_id: { type: 'string', format: 'uuid' },
          docente_titular_id: { type: 'string', format: 'uuid', nullable: true },
          fecha_inicio: { type: 'string', format: 'date', example: '2026-03-15' },
          fecha_fin: { type: 'string', format: 'date', example: '2026-04-30' },
          horario: { type: 'string', example: 'Sábados de 8:00 AM a 1:00 PM' },
          aula: { type: 'string', example: 'Aula Magna 3' },
          codigo_aula_virtual_externa: { type: 'string', example: 'MOODLE-MGS-MOD01' },
        },
      },
      CreateApplicantRequest: {
        type: 'object',
        required: ['tipo_identificacion', 'numero_identificacion', 'nombres', 'apellidos', 'fecha_nacimiento', 'email', 'telefono'],
        properties: {
          usuario_id: { type: 'string', format: 'uuid', nullable: true },
          tipo_identificacion: {
            type: 'string',
            enum: ['CEDULA', 'PASAPORTE', 'CEDULA_RESIDENCIA', 'PARTIDA_NACIMIENTO'],
            example: 'CEDULA',
          },
          numero_identificacion: { type: 'string', example: '001-150890-0045V' },
          nombres: { type: 'string', example: 'Carlos Alberto' },
          apellidos: { type: 'string', example: 'Morales Ruiz' },
          fecha_nacimiento: { type: 'string', format: 'date', example: '1990-08-15' },
          email: { type: 'string', format: 'email', example: 'carlos.morales@gmail.com' },
          telefono: { type: 'string', example: '+50588990011' },
          tiene_discapacidad: { type: 'boolean', example: false },
          cedula_identidad_pdf: { type: 'string', format: 'binary', description: 'Copia escaneada en PDF de cédula de identidad' },
          tutor_documento: { type: 'string', format: 'binary', description: 'Documento legal del tutor si es menor' },
        },
      },
      CreateAcademicDegreeRequest: {
        type: 'object',
        required: ['nivel_titulo', 'denominacion_titulo', 'institucion_emisora', 'fecha_emision'],
        properties: {
          area_conocimiento_id: { type: 'string', format: 'uuid', nullable: true },
          nivel_titulo: {
            type: 'string',
            enum: ['TECNICO_SUPERIOR', 'GRADO', 'ESPECIALIDAD', 'MAESTRIA', 'DOCTORADO', 'CARTA_EGRESADO'],
            example: 'GRADO',
          },
          denominacion_titulo: { type: 'string', example: 'Licenciado en Medicina y Cirugía' },
          institucion_emisora: { type: 'string', example: 'Universidad Nacional Autónoma' },
          fecha_emision: { type: 'string', format: 'date', example: '2015-12-10' },
          inscrito_registro_nacional: { type: 'boolean', example: true },
          codigo_registro_nacional: { type: 'string', example: 'RN-MED-2016-4589' },
          porcentaje_creditos_investigacion: { type: 'number', example: 10 },
          titulo_pdf: { type: 'string', format: 'binary', description: 'Escaneo PDF del título' },
          certificado_rn: { type: 'string', format: 'binary', description: 'Certificado de inscripción en Registro Nacional' },
        },
      },
      ValidateDegreeRequest: {
        type: 'object',
        required: ['estado_validacion'],
        properties: {
          estado_validacion: { type: 'string', enum: ['PENDIENTE', 'VALIDADO', 'RECHAZADO'], example: 'VALIDADO' },
          observacion_rechazo: { type: 'string', nullable: true, example: 'Título no verificado en el Registro Nacional' },
        },
      },
      CreateEnrollmentRequest: {
        type: 'object',
        required: ['cohorte_id'],
        properties: {
          aspirante_id: { type: 'string', format: 'uuid', description: 'Requerido para administradores si inscriben a un tercero' },
          cohorte_id: { type: 'string', format: 'uuid' },
          titulo_presentado_id: { type: 'string', format: 'uuid', nullable: true },
          rol_participacion: {
            type: 'string',
            enum: ['ESTUDIANTE_EVALUADO', 'PARTICIPANTE_ASISTENTE', 'PONENTE_CONGRESO'],
            example: 'ESTUDIANTE_EVALUADO',
          },
          titulo_ponencia: { type: 'string', nullable: true },
          resumen_ponencia: { type: 'string', nullable: true },
          archivo_ponencia: { type: 'string', format: 'binary', description: 'PDF del resumen o ponencia para congresos' },
        },
      },
      ValidateDocumentsRequest: {
        type: 'object',
        required: ['aprobado'],
        properties: {
          aprobado: { type: 'boolean', example: true },
          observaciones_administracion: { type: 'string', nullable: true, example: 'Expediente documental validado conforme a SETEC' },
        },
      },
      CreatePaymentRequest: {
        type: 'object',
        required: ['metodo_pago', 'numero_referencia_o_recibo', 'monto_subtotal', 'total_pagado', 'concepto'],
        properties: {
          metodo_pago: {
            type: 'string',
            enum: ['BAUCHER_BANCARIO', 'CAJA_ADMINISTRATIVA', 'TRANSFERENCIA'],
            example: 'BAUCHER_BANCARIO',
          },
          numero_referencia_o_recibo: { type: 'string', example: 'REF-BAC-98765432' },
          banco_origen: { type: 'string', example: 'BAC Credomatic' },
          monto_subtotal: { type: 'number', example: 150 },
          descuento_aplicado: { type: 'number', example: 0 },
          total_pagado: { type: 'number', example: 150 },
          concepto: { type: 'string', example: 'Pago de Matrícula MGS-2026' },
          comprobante_baucher: { type: 'string', format: 'binary', description: 'Imagen o PDF del comprobante/baucher' },
        },
      },
      ValidatePaymentRequest: {
        type: 'object',
        required: ['estado'],
        properties: {
          estado: { type: 'string', enum: ['APROBADO', 'RECHAZADO'], example: 'APROBADO' },
          motivo_rechazo: { type: 'string', nullable: true },
        },
      },
      CreateConvalidationRequest: {
        type: 'object',
        required: ['componente_destino_id', 'origen_tipo', 'creditos_reconocidos', 'justificacion_aporte_perfil'],
        properties: {
          componente_destino_id: { type: 'string', format: 'uuid' },
          origen_tipo: {
            type: 'string',
            enum: ['CURSO_ESPECIALIZADO', 'DIPLOMADO_PROFESIONAL', 'SEMINARIO_EVALUADO', 'CONGRESO_PONENTE', 'CAMBIO_PLAN_ESTUDIOS', 'EXTERNO'],
            example: 'DIPLOMADO_PROFESIONAL',
          },
          creditos_reconocidos: { type: 'integer', example: 4 },
          justificacion_aporte_perfil: { type: 'string', example: 'Acredita competencias equivalentes en Bioestadística aplicada' },
          certificado_origen: { type: 'string', format: 'binary', description: 'Certificado oficial o acta de calificaciones previas' },
        },
      },
      DictamenConvalidationRequest: {
        type: 'object',
        required: ['estado_dictamen'],
        properties: {
          estado_dictamen: { type: 'string', enum: ['APROBADA', 'RECHAZADA'], example: 'APROBADA' },
          coordinador_dictaminador_id: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      ModifyGradeRequest: {
        type: 'object',
        required: ['motivo_modificacion'],
        properties: {
          motivo_modificacion: { type: 'string', example: 'Corrección de nota por reclamo justificado en trabajo de fin de módulo' },
          calificacion_cuantitativa: { type: 'number', minimum: 0, maximum: 100, example: 92 },
          valoracion_cualitativa: {
            type: 'string',
            enum: ['APRENDIZAJE_AVANZADO', 'APRENDIZAJE_SATISFACTORIO', 'APRENDIZAJE_FUNDAMENTAL', 'APRENDIZAJE_INICIAL'],
            example: 'APRENDIZAJE_AVANZADO',
          },
          observacion_acompanamiento_pedagogico: { type: 'string', example: 'Excelente dominio teórico y metodológico' },
          autoevaluacion_completada: { type: 'boolean', example: true },
          coevaluacion_completada: { type: 'boolean', example: true },
        },
      },
      CreateExpedienteGraduacionRequest: {
        type: 'object',
        required: ['inscripcion_id', 'tipo_documento_final'],
        properties: {
          inscripcion_id: { type: 'string', format: 'uuid' },
          tipo_documento_final: {
            type: 'string',
            enum: ['TITULO_POSGRADO', 'CERTIFICADO_APROBACION', 'CERTIFICADO_PARTICIPACION', 'CERTIFICADO_PONENTE', 'DIPLOMA_PROFESIONAL'],
            example: 'TITULO_POSGRADO',
          },
          idioma_acreditado: { type: 'string', example: 'Inglés' },
          nivel_idioma_alcanzado: {
            type: 'string',
            enum: ['NINGUNO', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
            example: 'B1',
          },
          institucion_aval_idioma: { type: 'string', example: 'Centro de Idiomas Universitario' },
          modalidad_graduacion_tipo: { type: 'string', example: 'TESIS_INVESTIGACION' },
          titulo_trabajo_graduacion: { type: 'string', example: 'Estudio Epidemiológico de Enfermedades Emergentes' },
          aplico_salida_intermedia: { type: 'boolean', default: false },
          certificado_idioma: { type: 'string', format: 'binary', description: 'PDF del certificado oficial de idioma' },
          acta_defensa: { type: 'string', format: 'binary', description: 'PDF del acta formal de defensa o evaluación final' },
          titulo_intermedio: { type: 'string', format: 'binary', description: 'PDF de título intermedio emitido' },
        },
      },
      CreatePublicationRequest: {
        type: 'object',
        required: ['tipo_publicacion', 'titulo_publicacion', 'nombre_revista_o_medio', 'url_o_doi'],
        properties: {
          tipo_publicacion: { type: 'string', enum: ['ENSAYO', 'ARTICULO_CIENTIFICO'], example: 'ARTICULO_CIENTIFICO' },
          titulo_publicacion: { type: 'string', example: 'Impacto de la vigilancia comunitaria en la prevención del dengue' },
          nombre_revista_o_medio: { type: 'string', example: 'Revista Iberoamericana de Salud Pública' },
          es_revista_indexada: { type: 'boolean', example: true },
          tiene_revision_pares: { type: 'boolean', example: true },
          alcance: { type: 'string', enum: ['UNIVERSITARIA', 'NACIONAL', 'REGIONAL', 'INTERNACIONAL'], example: 'INTERNACIONAL' },
          url_o_doi: { type: 'string', example: 'https://doi.org/10.1016/j.risp.2026.02.015' },
          evidencia_pdf: { type: 'string', format: 'binary', description: 'PDF del artículo publicado o carta de aceptación' },
        },
      },
      ValidatePublicationRequest: {
        type: 'object',
        required: ['validado_coordinacion'],
        properties: {
          validado_coordinacion: { type: 'boolean', example: true },
        },
      },
      IssueGraduationDocumentRequest: {
        type: 'object',
        properties: {
          codigo_registro_titulo_emitido: { type: 'string', example: 'REG-SETEC-POS-2026-0042' },
          fecha_emision: { type: 'string', format: 'date', example: '2026-11-20' },
          tipo_documento_final: {
            type: 'string',
            enum: ['TITULO_POSGRADO', 'CERTIFICADO_APROBACION', 'CERTIFICADO_PARTICIPACION', 'CERTIFICADO_PONENTE', 'DIPLOMA_PROFESIONAL'],
            example: 'TITULO_POSGRADO',
          },
          documento_final: { type: 'string', format: 'binary', description: 'Documento PDF oficial del título/diploma con sellos' },
        },
      },
    },
  },
  paths: {
    ...billingOpenApiPaths,
    // ==========================================
    // HEALTH CHECK
    // ==========================================
    '/health': {
      get: {
        summary: 'Verificación del estado del servidor y PostgreSQL',
        tags: ['Auth'],
        responses: {
          200: {
            description: 'Servicio en línea y base de datos conectada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },

    // ==========================================
    // AUTHENTICATION MODULE
    // ==========================================
    '/auth/login': {
      post: {
        summary: 'Autenticación de usuario con emisión de Access y Refresh Token JWT',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: {
            description: 'Autenticación exitosa',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Renovación de token de acceso mediante Refresh Token rotativo',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } },
        },
        responses: {
          200: { description: 'Token renovado con éxito', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          401: { description: 'Refresh token expirado o revocado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Cierre de sesión y revocación del Refresh Token',
        tags: ['Auth'],
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } },
        },
        responses: {
          200: { description: 'Sesión finalizada con éxito', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Obtiene el perfil y permisos del usuario actualmente autenticado',
        tags: ['Auth'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Perfil recuperado con éxito', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          401: { description: 'No autorizado / Token faltante o expirado' },
        },
      },
    },
    '/auth/profile': {
      get: {
        summary: 'Alias de consulta del perfil de usuario autenticado',
        tags: ['Auth'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Perfil recuperado con éxito' },
        },
      },
    },

    // ==========================================
    // TAXONOMY MODULE
    // ==========================================
    '/taxonomy/areas': {
      get: {
        summary: 'Lista pública de áreas de conocimiento activas',
        tags: ['Taxonomy'],
        responses: { 200: { description: 'Listado de áreas' } },
      },
      post: {
        summary: 'Crear nueva área de conocimiento (Requiere CATALOGO_GESTIONAR)',
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAreaRequest' } } },
        },
        responses: {
          201: { description: 'Área creada exitosamente' },
          403: { description: 'Permisos insuficientes' },
        },
      },
    },
    '/taxonomy/areas/{id}': {
      get: {
        summary: 'Obtener detalle de área de conocimiento por UUID',
        tags: ['Taxonomy'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle de área' }, 404: { description: 'Área no encontrada' } },
      },
      put: {
        summary: 'Actualizar área de conocimiento por UUID',
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAreaRequest' } } } },
        responses: { 200: { description: 'Área actualizada' } },
      },
      delete: {
        summary: 'Eliminar área de conocimiento',
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Área eliminada' } },
      },
    },
    '/taxonomy/tags': {
      get: {
        summary: 'Lista pública de etiquetas temáticas',
        tags: ['Taxonomy'],
        responses: { 200: { description: 'Listado de etiquetas' } },
      },
      post: {
        summary: 'Crear nueva etiqueta temática (Requiere CATALOGO_GESTIONAR)',
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTagRequest' } } } },
        responses: { 201: { description: 'Etiqueta creada' } },
      },
    },
    '/taxonomy/tags/{id}': {
      get: {
        summary: 'Obtener etiqueta por UUID',
        tags: ['Taxonomy'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle de etiqueta' } },
      },
      put: {
        summary: 'Actualizar etiqueta temática',
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTagRequest' } } } },
        responses: { 200: { description: 'Etiqueta actualizada' } },
      },
      delete: {
        summary: 'Eliminar etiqueta temática',
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Etiqueta eliminada' } },
      },
    },

    // ==========================================
    // INFRASTRUCTURE MODULE
    // ==========================================
    '/infrastructure/sedes': {
      get: {
        summary: 'Listado institucional de sedes universitarias autorizadas por SETEC',
        tags: ['Infrastructure'],
        responses: { 200: { description: 'Listado de sedes' } },
      },
      post: {
        summary: 'Registrar nueva sede universitaria (Requiere SEDE_GESTIONAR)',
        tags: ['Infrastructure'],
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSedeRequest' } } } },
        responses: { 201: { description: 'Sede creada exitosamente' } },
      },
    },
    '/infrastructure/sedes/{id}': {
      get: {
        summary: 'Obtener sede universitaria por ID',
        tags: ['Infrastructure'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle de sede' } },
      },
      put: {
        summary: 'Actualizar sede universitaria',
        tags: ['Infrastructure'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSedeRequest' } } } },
        responses: { 200: { description: 'Sede actualizada' } },
      },
      delete: {
        summary: 'Eliminar sede universitaria',
        tags: ['Infrastructure'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Sede eliminada' } },
      },
    },
    '/infrastructure/docentes': {
      get: {
        summary: 'Vitrina pública de docentes y claustro académico',
        tags: ['Infrastructure'],
        responses: { 200: { description: 'Listado de docentes' } },
      },
      post: {
        summary: 'Registrar nuevo docente con foto y CV en PDF (Requiere DOCENTE_GESTIONAR)',
        tags: ['Infrastructure'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateDocenteRequest' } } },
        },
        responses: { 201: { description: 'Docente registrado' } },
      },
    },
    '/infrastructure/docentes/{id}': {
      get: {
        summary: 'Obtener información y trayectoria de un docente',
        tags: ['Infrastructure'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle del docente' } },
      },
      put: {
        summary: 'Actualizar docente y archivos de legajo académico (foto, CV)',
        tags: ['Infrastructure'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateDocenteRequest' } } } },
        responses: { 200: { description: 'Docente actualizado' } },
      },
      delete: {
        summary: 'Eliminar docente del claustro',
        tags: ['Infrastructure'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Docente eliminado' } },
      },
    },

    // ==========================================
    // PROGRAMS MODULE
    // ==========================================
    '/programs/catalog': {
      get: {
        summary: 'Catálogo comercial público de programas académicos con filtros y cohortes abiertas',
        tags: ['Programs'],
        parameters: [
          { in: 'query', name: 'area_id', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'categoria', schema: { type: 'string', enum: ['POSGRADO', 'EDUCACION_PERMANENTE'] } },
          { in: 'query', name: 'subtipo', schema: { type: 'string' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Catálogo de programas para la vitrina web' } },
      },
    },
    '/programs/recommendations/{aspiranteId}': {
      get: {
        summary: 'Motor de recomendaciones inteligentes de programas según intereses del aspirante',
        tags: ['Programs'],
        parameters: [{ in: 'path', name: 'aspiranteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Programas sugeridos' } },
      },
    },
    '/programs/slug/{slug}': {
      get: {
        summary: 'Obtiene el detalle comercial y académico completo de un programa por su Slug URL',
        tags: ['Programs'],
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Ficha del programa con malla curricular y cohortes' } },
      },
    },
    '/programs': {
      get: {
        summary: 'Listado administrativo general de programas académicos',
        tags: ['Programs'],
        responses: { 200: { description: 'Lista de programas' } },
      },
      post: {
        summary: 'Crear nuevo programa académico con carga de aval MINSA, brochure y portada (Requiere CATALOGO_GESTIONAR)',
        tags: ['Programs'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateProgramRequest' } } },
        },
        responses: { 201: { description: 'Programa académico creado' } },
      },
    },
    '/programs/{id}': {
      get: {
        summary: 'Obtener programa académico por ID',
        tags: ['Programs'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle del programa' } },
      },
      put: {
        summary: 'Actualizar programa académico y documentos asociados',
        tags: ['Programs'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateProgramRequest' } } } },
        responses: { 200: { description: 'Programa actualizado' } },
      },
      delete: {
        summary: 'Eliminar programa académico',
        tags: ['Programs'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Programa eliminado' } },
      },
    },
    '/programs/{id}/tags': {
      post: {
        summary: 'Asignar etiquetas temáticas a un programa académico',
        tags: ['Programs'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { tag_ids: { type: 'array', items: { type: 'string', format: 'uuid' } } } } } },
        },
        responses: { 200: { description: 'Etiquetas asignadas' } },
      },
    },
    '/programs/{id}/componentes': {
      get: {
        summary: 'Malla curricular: Lista de componentes / asignaturas de un programa',
        tags: ['Programs'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Malla curricular' } },
      },
      post: {
        summary: 'Agregar componente curricular / asignatura con sílabo en PDF (Requiere CATALOGO_GESTIONAR)',
        tags: ['Programs'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateComponenteRequest' } } },
        },
        responses: { 201: { description: 'Componente curricular agregado' } },
      },
    },
    '/programs/{id}/componentes/{componenteId}': {
      put: {
        summary: 'Actualizar componente curricular y subir nueva versión del sílabo',
        tags: ['Programs'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'path', name: 'componenteId', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateComponenteRequest' } } } },
        responses: { 200: { description: 'Componente curricular actualizado' } },
      },
      delete: {
        summary: 'Eliminar componente curricular de la malla',
        tags: ['Programs'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'path', name: 'componenteId', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Componente eliminado' } },
      },
    },

    // ==========================================
    // COHORTS MODULE
    // ==========================================
    '/cohorts': {
      get: {
        summary: 'Listado público y filtrado de cohortes de apertura',
        tags: ['Cohorts'],
        parameters: [
          { in: 'query', name: 'programa_id', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'sede_id', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'modalidad', schema: { type: 'string' } },
          { in: 'query', name: 'estado_cohorte', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Listado de cohortes' } },
      },
      post: {
        summary: 'Aperturar nueva cohorte de programa con validación normativa de cupos SETEC (Requiere COHORTE_GESTIONAR)',
        tags: ['Cohorts'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateCohorteRequest' } } },
        },
        responses: { 201: { description: 'Cohorte creada exitosamente' } },
      },
    },
    '/cohorts/{id}': {
      get: {
        summary: 'Obtener detalle de cohorte, coordinador, sede y programación modular',
        tags: ['Cohorts'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle de la cohorte' } },
      },
      put: {
        summary: 'Actualizar cohorte (fechas, cupos, cobro habilitado, estado)',
        tags: ['Cohorts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateCohorteRequest' } } } },
        responses: { 200: { description: 'Cohorte actualizada' } },
      },
      delete: {
        summary: 'Eliminar cohorte',
        tags: ['Cohorts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Cohorte eliminada' } },
      },
    },
    '/cohorts/{id}/componentes': {
      get: {
        summary: 'Lista de módulos programados para una cohorte específica',
        tags: ['Cohorts'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Cronograma modular' } },
      },
      post: {
        summary: 'Programar componente en la cohorte (Asignar docente titular, fechas, aula y horario)',
        tags: ['Cohorts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProgramarComponenteRequest' } } },
        },
        responses: { 201: { description: 'Componente programado' } },
      },
    },
    '/cohorts/{id}/componentes/{componenteId}': {
      put: {
        summary: 'Actualizar programación de componente modular en una cohorte',
        tags: ['Cohorts'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'path', name: 'componenteId', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ProgramarComponenteRequest' } } } },
        responses: { 200: { description: 'Programación actualizada' } },
      },
      delete: {
        summary: 'Eliminar programación de componente en una cohorte',
        tags: ['Cohorts'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'path', name: 'componenteId', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Programación eliminada' } },
      },
    },

    // ==========================================
    // APPLICANTS MODULE
    // ==========================================
    '/applicants/me': {
      get: {
        summary: 'Obtiene el expediente / ficha biopsicosocial del aspirante actualmente autenticado',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Ficha del aspirante' } },
      },
      put: {
        summary: 'Actualizar perfil del aspirante autenticado (con subida de cédula en PDF)',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateApplicantRequest' } } } },
        responses: { 200: { description: 'Perfil actualizado' } },
      },
    },
    '/applicants': {
      get: {
        summary: 'Listado administrativo de aspirantes (Requiere INSCRIPCION_VALIDAR)',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'identidad_verificada', schema: { type: 'boolean' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Listado de aspirantes' } },
      },
      post: {
        summary: 'Registrar nueva ficha de aspirante con escaneo de documento de identidad',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateApplicantRequest' } } },
        },
        responses: { 201: { description: 'Aspirante registrado' } },
      },
    },
    '/applicants/{id}': {
      get: {
        summary: 'Obtener ficha de aspirante por UUID',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle de aspirante' } },
      },
      put: {
        summary: 'Actualizar ficha de aspirante por UUID',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateApplicantRequest' } } } },
        responses: { 200: { description: 'Aspirante actualizado' } },
      },
    },
    '/applicants/{id}/verify-identity': {
      patch: {
        summary: 'Verificación administrativa formal de la identidad del aspirante (Art. 86 SETEC)',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Identidad verificada exitosamente' } },
      },
    },
    '/applicants/{id}/interests': {
      get: {
        summary: 'Consultar áreas de interés formativo declaradas por el aspirante',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Intereses del aspirante' } },
      },
      put: {
        summary: 'Reemplazar áreas de interés formativo del aspirante',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { area_conocimiento_ids: { type: 'array', items: { type: 'string', format: 'uuid' } } } } } },
        },
        responses: { 200: { description: 'Intereses actualizados' } },
      },
    },
    '/applicants/{id}/degrees': {
      get: {
        summary: 'Listar títulos académicos previos del aspirante',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Lista de títulos' } },
      },
      post: {
        summary: 'Registrar título universitario previo con escaneo PDF y constancia de Registro Nacional',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateAcademicDegreeRequest' } } },
        },
        responses: { 201: { description: 'Título académico registrado' } },
      },
    },
    '/applicants/degrees/{degreeId}': {
      get: {
        summary: 'Obtener detalle de título académico por ID',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'degreeId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle del título' } },
      },
      put: {
        summary: 'Actualizar título académico previo',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'degreeId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateAcademicDegreeRequest' } } } },
        responses: { 200: { description: 'Título actualizado' } },
      },
      delete: {
        summary: 'Eliminar título académico previo',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'degreeId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Título eliminado' } },
      },
    },
    '/applicants/degrees/{degreeId}/validate': {
      patch: {
        summary: 'Validar o rechazar administrativamente un título de grado presentado (Requiere INSCRIPCION_VALIDAR)',
        tags: ['Applicants'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'degreeId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateDegreeRequest' } } },
        },
        responses: { 200: { description: 'Estado de validación actualizado' } },
      },
    },

    // ==========================================
    // ENROLLMENTS MODULE
    // ==========================================
    '/enrollments/me': {
      get: {
        summary: 'Historial de inscripciones y matrículas del estudiante autenticado',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Mis inscripciones' } },
      },
    },
    '/enrollments': {
      get: {
        summary: 'Listado administrativo de inscripciones con filtros y paginación (Requiere INSCRIPCION_VALIDAR)',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'cohorte_id', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'aspirante_id', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'estado', schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Listado de inscripciones' } },
      },
      post: {
        summary: 'Registrar nueva inscripción a cohorte (genera código de expediente EXP-YYYY-HEX)',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateEnrollmentRequest' } } },
        },
        responses: { 201: { description: 'Inscripción registrada en revisión documental' } },
      },
    },
    '/enrollments/{id}': {
      get: {
        summary: 'Obtener detalle completo de una inscripción (pagos, documentos, convalidaciones)',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle de la inscripción' } },
      },
    },
    '/enrollments/{id}/validate-documents': {
      patch: {
        summary: 'Validar documentos y activar quórum normativo transaccional (Requiere INSCRIPCION_VALIDAR)',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateDocumentsRequest' } } },
        },
        responses: { 200: { description: 'Documentos validados y quórum actualizado' } },
      },
    },
    '/enrollments/{id}/payments': {
      get: {
        summary: 'Listado de comprobantes de pago registrados para la inscripción',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Pagos registrados' } },
      },
      post: {
        summary: 'Subir comprobante o baucher bancario de pago para matrícula o arancel',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreatePaymentRequest' } } },
        },
        responses: { 201: { description: 'Pago registrado en revisión de caja' } },
      },
    },
    '/enrollments/payments/{paymentId}/validate': {
      patch: {
        summary: 'Caja aprueba o rechaza el baucher de pago (Requiere PAGO_VALIDAR)',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'paymentId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidatePaymentRequest' } } },
        },
        responses: { 200: { description: 'Pago validado y aplicado a obligaciones. La matrícula se activa únicamente por decisión administrativa.' } },
      },
    },
    '/enrollments/{id}/convalidations': {
      get: {
        summary: 'Listar solicitudes de convalidación académica asociadas a la inscripción',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Convalidaciones' } },
      },
      post: {
        summary: 'Solicitar convalidación o reconocimiento de créditos previos con certificado en PDF',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateConvalidationRequest' } } },
        },
        responses: { 201: { description: 'Solicitud de convalidación registrada' } },
      },
    },
    '/enrollments/convalidations/{convalidationId}/dictamen': {
      patch: {
        summary: 'Emitir dictamen de coordinación sobre convalidación (Requiere CONVALIDACION_DICTAMINAR)',
        tags: ['Enrollments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'convalidationId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DictamenConvalidationRequest' } } },
        },
        responses: { 200: { description: 'Dictamen emitido' } },
      },
    },

    // ==========================================
    // GRADES MODULE (SNEPA)
    // ==========================================
    '/grades/import/{programacionComponenteId}': {
      post: {
        summary: 'Importar calificaciones masivas desde archivo Excel (.xlsx) bajo escala SNEPA (Requiere NOTA_IMPORTAR)',
        tags: ['Grades'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'programacionComponenteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['archivo_excel'],
                properties: {
                  archivo_excel: { type: 'string', format: 'binary', description: 'Hoja de cálculo Excel (.xlsx)' },
                  observaciones: { type: 'string', example: 'Acta de calificaciones finales Módulo I' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Notas importadas y lotes procesados exitosamente' },
          400: { description: 'Actas cerradas o columnas requeridas faltantes en Excel' },
        },
      },
    },
    '/grades/{matriculaComponenteId}': {
      patch: {
        summary: 'Modificación manual de calificación con justificación obligatoria y auditoría (Requiere NOTA_MODIFICAR)',
        tags: ['Grades'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'matriculaComponenteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ModifyGradeRequest' } } },
        },
        responses: { 200: { description: 'Calificación modificada y registrada en bitácora inmutable' } },
      },
    },
    '/grades/component/{programacionComponenteId}': {
      get: {
        summary: 'Listado de notas de todos los estudiantes inscritos en una asignatura modular',
        tags: ['Grades'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'programacionComponenteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Listado de notas del módulo' } },
      },
    },
    '/grades/lots/{programacionComponenteId}': {
      get: {
        summary: 'Historial de lotes de importación Excel subidos para una programación modular',
        tags: ['Grades'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'programacionComponenteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Historial de lotes de actas' } },
      },
    },
    '/grades/student/{inscripcionId}': {
      get: {
        summary: 'Kardex / Historial académico completo del estudiante para una inscripción',
        tags: ['Grades'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'inscripcionId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Kardex con promedio cuantitativo y cualitativo SNEPA' } },
      },
    },
    '/grades/{matriculaComponenteId}/logs': {
      get: {
        summary: 'Bitácora inmutable de auditoría forense para una calificación específica',
        tags: ['Grades'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'matriculaComponenteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Historial cronológico de cambios y responsables' } },
      },
    },

    // ==========================================
    // GRADUATION & QR VERIFICATION MODULE
    // ==========================================
    '/graduation/verify/{codigoRegistro}': {
      get: {
        summary: 'Verificación pública de autenticidad de títulos y certificados (Acceso público sin JWT para validación por QR)',
        tags: ['Graduation'],
        parameters: [{ in: 'path', name: 'codigoRegistro', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Título / Certificado auténtico y vigente' },
          404: { description: 'Código de registro no encontrado o no emitido' },
        },
      },
    },
    '/graduation/expediente': {
      post: {
        summary: 'Iniciar expediente de titulación de posgrado o egreso (Requiere TITULO_EMITIR)',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateExpedienteGraduacionRequest' } } },
        },
        responses: { 201: { description: 'Expediente de graduación aperturado' } },
      },
    },
    '/graduation/expediente/{id}': {
      get: {
        summary: 'Consultar estado integral de expediente de graduación por UUID',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Detalle del expediente de graduación' } },
      },
      patch: {
        summary: 'Actualizar requisitos del expediente (idioma validado, acta de defensa, salida intermedia)',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreateExpedienteGraduacionRequest' } } } },
        responses: { 200: { description: 'Expediente actualizado' } },
      },
    },
    '/graduation/enrollment/{inscripcionId}': {
      get: {
        summary: 'Obtener expediente de graduación asociado a un ID de inscripción',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'inscripcionId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Expediente del estudiante' } },
      },
    },
    '/graduation/expediente/{expedienteId}/publications': {
      get: {
        summary: 'Lista de publicaciones científicas registradas en el expediente',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'expedienteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Publicaciones del estudiante' } },
      },
      post: {
        summary: 'Registrar publicación científica (ensayo o artículo indexado) con PDF de evidencia',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'expedienteId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CreatePublicationRequest' } } },
        },
        responses: { 201: { description: 'Publicación científica registrada' } },
      },
    },
    '/graduation/publications/{publicationId}/validate': {
      patch: {
        summary: 'Coordinación académica valida o rechaza publicación científica (Requiere TITULO_EMITIR)',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'publicationId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidatePublicationRequest' } } },
        },
        responses: { 200: { description: 'Publicación validada con éxito' } },
      },
    },
    '/graduation/expediente/{id}/issue': {
      post: {
        summary: 'Emisión oficial de Título o Certificado de Posgrado con validación estricta de requisitos (Requiere TITULO_EMITIR)',
        tags: ['Graduation'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/IssueGraduationDocumentRequest' } } },
        },
        responses: {
          200: { description: 'Título / Diploma emitido exitosamente con código único de registro' },
          400: { description: 'Requisitos pendientes (calificaciones reprobadas, idioma no validado, falta de publicaciones)' },
        },
      },
    },
  },
};

export const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #0d233a; }
    .swagger-ui .info { margin: 25px 0; }
    .swagger-ui .info .title { color: #0d233a; font-family: sans-serif; font-weight: 700; }
    .swagger-ui .btn.authorize { background-color: #0d233a; color: #fff; border-color: #0d233a; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
  `,
  customSiteTitle: 'Documentación API SNEPA-SETEC (OpenAPI 3.0)',
};

export { swaggerUi };
