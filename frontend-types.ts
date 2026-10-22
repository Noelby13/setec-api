/**
 * Contrato de tipos copiable, sin imports ni dependencias de backend.
 * Fuente: código actual de src/modules, src/middlewares, src/types y database/init.sql.
 * Los tipos Request representan entrada: no obligan a enviar defaults del servidor.
 * Los tipos *Row representan columnas SQL, NO garantizan exposición por la API.
 * SQL DEFAULT no implica NOT NULL: se conserva la nulabilidad real del DDL.
 * Fechas serializadas: string; NUMERIC pg directo: string; NUMERIC dentro de json_build_object: number.
 * Los tipos de éxito afectados por divergencias SQL se documentan como proyecciones provisionales.
 * Véase FRONTEND_API_CONTRACT.md para validaciones, permisos y bloqueos observados.
 */
export type UUID = string;
export type DateOnly = string;
export type DateTime = string;
export type PgNumeric = string;
export type NumericInput = number | string;
export type BooleanInput = boolean | 'true' | 'false' | '1' | '0';
export type NullableUuidInput = UUID | null | '' | 'null';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
/** Descriptor neutral: el consumidor puede usar File/Blob como parámetro genérico F. */
export interface UploadDescriptor { name: string; type: string; size: number }

export const CategoriaPrograma = {
  POSGRADO: 'POSGRADO',
  EDUCACION_PERMANENTE: 'EDUCACION_PERMANENTE',
} as const;
export type CategoriaPrograma = (typeof CategoriaPrograma)[keyof typeof CategoriaPrograma];

export const SubtipoPrograma = {
  // Posgrado (Art. 58 - 81)
  ESPECIALIDAD: 'ESPECIALIDAD',
  MAESTRIA_PROFESIONAL: 'MAESTRIA_PROFESIONAL',
  MAESTRIA_ACADEMICA: 'MAESTRIA_ACADEMICA',
  DOCTORADO_LICENCIATURA: 'DOCTORADO_LICENCIATURA',
  DOCTORADO_MAESTRIA: 'DOCTORADO_MAESTRIA',
  POSDOCTORADO: 'POSDOCTORADO',
  // Educacion Permanente (Art. 84 - 92)
  CURSO_ESPECIALIZADO: 'CURSO_ESPECIALIZADO',
  CURSO_EXTENSION: 'CURSO_EXTENSION',
  TALLER: 'TALLER',
  SEMINARIO: 'SEMINARIO',
  CONGRESO: 'CONGRESO',
  DIPLOMADO_PROFESIONAL: 'DIPLOMADO_PROFESIONAL',
  DIPLOMADO_EXTENSION: 'DIPLOMADO_EXTENSION',
} as const;
export type SubtipoPrograma = (typeof SubtipoPrograma)[keyof typeof SubtipoPrograma];

export const ModalidadEducativa = {
  PRESENCIAL: 'PRESENCIAL',
  SEMIPRESENCIAL: 'SEMIPRESENCIAL',
  VIRTUAL: 'VIRTUAL',
  MIXTA: 'MIXTA',
} as const;
export type ModalidadEducativa = (typeof ModalidadEducativa)[keyof typeof ModalidadEducativa];

export const NivelIdiomaMcer = {
  NINGUNO: 'NINGUNO',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C1: 'C1',
  C2: 'C2',
} as const;
export type NivelIdiomaMcer = (typeof NivelIdiomaMcer)[keyof typeof NivelIdiomaMcer];

export const EstadoInscripcion = {
  BORRADOR: 'BORRADOR',
  EN_REVISION_DOCUMENTAL: 'EN_REVISION_DOCUMENTAL',
  DOCUMENTACION_OBSERVADA: 'DOCUMENTACION_OBSERVADA',
  PENDIENTE_COMITE_PONENCIA: 'PENDIENTE_COMITE_PONENCIA',
  LISTA_ESPERA: 'LISTA_ESPERA',
  INSCRITO_RESERVADO: 'INSCRITO_RESERVADO',
  PENDIENTE_PAGO: 'PENDIENTE_PAGO',
  PAGO_EN_REVISION: 'PAGO_EN_REVISION',
  MATRICULADO_ACTIVO: 'MATRICULADO_ACTIVO',
  RETIRADO: 'RETIRADO',
  EGRESADO: 'EGRESADO',
  GRADUADO_O_CERTIFICADO: 'GRADUADO_O_CERTIFICADO',
} as const;
export type EstadoInscripcion = (typeof EstadoInscripcion)[keyof typeof EstadoInscripcion];

export const RolParticipacionEp = {
  ESTUDIANTE_EVALUADO: 'ESTUDIANTE_EVALUADO',
  PARTICIPANTE_ASISTENTE: 'PARTICIPANTE_ASISTENTE',
  PONENTE_CONGRESO: 'PONENTE_CONGRESO',
} as const;
export type RolParticipacionEp = (typeof RolParticipacionEp)[keyof typeof RolParticipacionEp];

export const EscalaCualitativaSnepa = {
  APRENDIZAJE_AVANZADO: 'APRENDIZAJE_AVANZADO',
  APRENDIZAJE_SATISFACTORIO: 'APRENDIZAJE_SATISFACTORIO',
  APRENDIZAJE_FUNDAMENTAL: 'APRENDIZAJE_FUNDAMENTAL',
  APRENDIZAJE_INICIAL: 'APRENDIZAJE_INICIAL',
} as const;
export type EscalaCualitativaSnepa = (typeof EscalaCualitativaSnepa)[keyof typeof EscalaCualitativaSnepa];

export const MetodoPago = {
  BAUCHER_BANCARIO: 'BAUCHER_BANCARIO',
  CAJA_ADMINISTRATIVA: 'CAJA_ADMINISTRATIVA',
  TRANSFERENCIA: 'TRANSFERENCIA',
  PASARELA_ONLINE: 'PASARELA_ONLINE',
} as const;
export type MetodoPago = (typeof MetodoPago)[keyof typeof MetodoPago];

export const EstadoPago = {
  PENDIENTE_REVISION: 'PENDIENTE_REVISION',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO',
  REEMBOLSADO: 'REEMBOLSADO',
  ANULADO: 'ANULADO',
} as const;
export type EstadoPago = (typeof EstadoPago)[keyof typeof EstadoPago];

export const TipoSede = {
  SEDE_CENTRAL: 'SEDE_CENTRAL',
  SEDE: 'SEDE',
  SUBSEDE: 'SUBSEDE',
  EXTENSION: 'EXTENSION',
  UNICAM: 'UNICAM',
} as const;
export type TipoSede = (typeof TipoSede)[keyof typeof TipoSede];

export const MaximoGradoAcademico = {
  LICENCIADO: 'LICENCIADO',
  ESPECIALISTA: 'ESPECIALISTA',
  MASTER: 'MASTER',
  DOCTOR: 'DOCTOR',
} as const;
export type MaximoGradoAcademico = (typeof MaximoGradoAcademico)[keyof typeof MaximoGradoAcademico];

export const EstadoVigenciaPrograma = {
  ACTIVO: 'ACTIVO',
  EN_REDISENO: 'EN_REDISENO',
  PAUSADO: 'PAUSADO',
  LIQUIDADO: 'LIQUIDADO',
} as const;
export type EstadoVigenciaPrograma = (typeof EstadoVigenciaPrograma)[keyof typeof EstadoVigenciaPrograma];

export const EstadoCohorte = {
  PLANIFICADA: 'PLANIFICADA',
  INSCRIPCION_ABIERTA: 'INSCRIPCION_ABIERTA',
  QUORUM_ALCANZADO_COBRANDO: 'QUORUM_ALCANZADO_COBRANDO',
  EN_EJECUCION: 'EN_EJECUCION',
  FINALIZADA_PENDIENTE_EVAL: 'FINALIZADA_PENDIENTE_EVAL',
  EVALUADA_SETEC: 'EVALUADA_SETEC',
  CANCELADA: 'CANCELADA',
} as const;
export type EstadoCohorte = (typeof EstadoCohorte)[keyof typeof EstadoCohorte];

export const TipoIdentificacion = {
  CEDULA: 'CEDULA',
  PASAPORTE: 'PASAPORTE',
  CEDULA_RESIDENCIA: 'CEDULA_RESIDENCIA',
  PARTIDA_NACIMIENTO: 'PARTIDA_NACIMIENTO',
} as const;
export type TipoIdentificacion = (typeof TipoIdentificacion)[keyof typeof TipoIdentificacion];

export const NivelTitulo = {
  TECNICO_SUPERIOR: 'TECNICO_SUPERIOR',
  GRADO: 'GRADO',
  ESPECIALIDAD: 'ESPECIALIDAD',
  MAESTRIA: 'MAESTRIA',
  DOCTORADO: 'DOCTORADO',
  CARTA_EGRESADO: 'CARTA_EGRESADO',
} as const;
export type NivelTitulo = (typeof NivelTitulo)[keyof typeof NivelTitulo];

export const EstadoValidacionTitulo = {
  PENDIENTE: 'PENDIENTE',
  VALIDADO: 'VALIDADO',
  RECHAZADO: 'RECHAZADO',
} as const;
export type EstadoValidacionTitulo = (typeof EstadoValidacionTitulo)[keyof typeof EstadoValidacionTitulo];

export const TipoOrigenConvalidacion = {
  CURSO_ESPECIALIZADO: 'CURSO_ESPECIALIZADO',
  DIPLOMADO_PROFESIONAL: 'DIPLOMADO_PROFESIONAL',
  SEMINARIO_EVALUADO: 'SEMINARIO_EVALUADO',
  CONGRESO_PONENTE: 'CONGRESO_PONENTE',
  CAMBIO_PLAN_ESTUDIOS: 'CAMBIO_PLAN_ESTUDIOS',
  EXTERNO: 'EXTERNO',
} as const;
export type TipoOrigenConvalidacion = (typeof TipoOrigenConvalidacion)[keyof typeof TipoOrigenConvalidacion];

export const EstadoDictamenConvalidacion = {
  PENDIENTE: 'PENDIENTE',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
} as const;
export type EstadoDictamenConvalidacion = (typeof EstadoDictamenConvalidacion)[keyof typeof EstadoDictamenConvalidacion];

export const TipoDocumentoFinal = {
  TITULO_POSGRADO: 'TITULO_POSGRADO',
  CERTIFICADO_APROBACION: 'CERTIFICADO_APROBACION',
  CERTIFICADO_PARTICIPACION: 'CERTIFICADO_PARTICIPACION',
  CERTIFICADO_PONENTE: 'CERTIFICADO_PONENTE',
  DIPLOMA_PROFESIONAL: 'DIPLOMA_PROFESIONAL',
} as const;
export type TipoDocumentoFinal = (typeof TipoDocumentoFinal)[keyof typeof TipoDocumentoFinal];

export const TipoPublicacionCientifica = {
  ENSAYO: 'ENSAYO',
  ARTICULO_CIENTIFICO: 'ARTICULO_CIENTIFICO',
} as const;
export type TipoPublicacionCientifica = (typeof TipoPublicacionCientifica)[keyof typeof TipoPublicacionCientifica];

export const AlcancePublicacion = {
  UNIVERSITARIA: 'UNIVERSITARIA',
  NACIONAL: 'NACIONAL',
  REGIONAL: 'REGIONAL',
  INTERNACIONAL: 'INTERNACIONAL',
} as const;
export type AlcancePublicacion = (typeof AlcancePublicacion)[keyof typeof AlcancePublicacion];


export const RolNombre = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COORDINADOR: 'COORDINADOR',
  CAJERO: 'CAJERO',
  DOCENTE: 'DOCENTE',
  ESTUDIANTE: 'ESTUDIANTE',
} as const;
export type RolNombre = (typeof RolNombre)[keyof typeof RolNombre];

export const PermisoCodigo = {
  USUARIO_GESTIONAR: 'USUARIO_GESTIONAR',
  SEDE_GESTIONAR: 'SEDE_GESTIONAR',
  DOCENTE_GESTIONAR: 'DOCENTE_GESTIONAR',
  CATALOGO_GESTIONAR: 'CATALOGO_GESTIONAR',
  COHORTE_GESTIONAR: 'COHORTE_GESTIONAR',
  INSCRIPCION_VALIDAR: 'INSCRIPCION_VALIDAR',
  PAGO_VALIDAR: 'PAGO_VALIDAR',
  PAGO_ANULAR: 'PAGO_ANULAR',
  OBLIGACION_ANULAR: 'OBLIGACION_ANULAR',
  CONVALIDACION_DICTAMINAR: 'CONVALIDACION_DICTAMINAR',
  NOTA_IMPORTAR: 'NOTA_IMPORTAR',
  NOTA_MODIFICAR: 'NOTA_MODIFICAR',
  TITULO_EMITIR: 'TITULO_EMITIR',
  CERTIFICADO_REVOCAR: 'CERTIFICADO_REVOCAR',
} as const;
export type PermisoCodigo = (typeof PermisoCodigo)[keyof typeof PermisoCodigo];


/** Modelo SQL completo; usuarios/sesiones contienen secretos INTERNOS y no son DTO públicos. */
/** Tabla permisos. */
export interface PermisoRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

/** Tabla roles. */
export interface RolRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  nombre: string;
  descripcion: string | null;
}

/** Tabla roles_permisos. */
export interface RolPermisoRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  rol_id: UUID;
  permiso_id: UUID;
}

/** Tabla usuarios. Uso interno; no devolver al navegador. */
export interface UsuarioRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  username: string | null;
  email: string;
  password_hash: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  avatar_url: string | null;
  rol_id: UUID;
  /** Default SQL: TRUE; puede ser NULL. */
  activo: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  email_verificado: boolean | null;
  /** Default SQL: NOW(); puede ser NULL. */
  created_at: DateTime | null;
  /** Default SQL: NOW(); puede ser NULL. */
  updated_at: DateTime | null;
}

/** Tabla sesiones. Uso interno; no devolver al navegador. */
export interface SesionRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  usuario_id: UUID;
  direccion_ip: string | null;
  user_agent: string | null;
  payload: string | null;
  refresh_token_hash: string;
  /** Default SQL: FALSE; puede ser NULL. */
  is_token_revocado: boolean | null;
  /** Default SQL: NOW(); puede ser NULL. */
  creacion_token: DateTime | null;
  expiracion_token: DateTime;
  /** Default SQL: NOW(); puede ser NULL. */
  ultima_actividad: DateTime | null;
}

/** Tabla areas_conocimiento. */
export interface AreaConocimientoRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  nombre: string;
  slug: string;
  icono_url: string | null;
  /** Default SQL: TRUE; puede ser NULL. */
  activa: boolean | null;
}

/** Tabla tags_academicos. */
export interface TagAcademicoRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  nombre: string;
  slug: string;
}

/** Tabla sedes_ies. */
export interface SedeIesRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  codigo_sede: string;
  nombre: string;
  tipo_sede: TipoSede;
  resolucion_autorizacion_setec: string | null;
  direccion: string | null;
  /** Default SQL: TRUE; puede ser NULL. */
  activa: boolean | null;
  /** Default SQL: NOW(); puede ser NULL. */
  created_at: DateTime | null;
}

/** Tabla personal_academico. */
export interface PersonalAcademicoRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  usuario_id: UUID | null;
  identificacion: string;
  nombres: string;
  apellidos: string;
  maximo_grado_academico: MaximoGradoAcademico;
  biografia_comercial: string | null;
  foto_perfil_url: string | null;
  cv_url: string;
  /** Default SQL: TRUE; puede ser NULL. */
  activo: boolean | null;
  /** Default SQL: NOW(); puede ser NULL. */
  created_at: DateTime | null;
}

/** Tabla programas_academicos. */
export interface ProgramaAcademicoRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  codigo_interno: string;
  codigo_dictamen_setec: string | null;
  fecha_aprobacion_setec: DateOnly | null;
  nombre: string;
  slug: string;
  categoria: CategoriaPrograma;
  subtipo: SubtipoPrograma;
  area_conocimiento_id: UUID;
  resumen_corto_web: string | null;
  descripcion_comercial: string | null;
  imagen_portada_url: string | null;
  video_promo_url: string | null;
  brochure_pdf_url: string | null;
  /** Default SQL: 0.00. */
  precio_total_referencia: PgNumeric;
  /** Default SQL: 0; puede ser NULL. */
  descuento_porcentaje: number | null;
  /** Default SQL: FALSE; puede ser NULL. */
  visible_en_web: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  es_ciencias_salud: boolean | null;
  aval_minsa_url: string | null;
  duracion_meses: PgNumeric | null;
  horas_totales: number;
  /** Default SQL: 0. */
  creditos_totales: number;
  /** Default SQL: 0. */
  creditos_investigacion: number;
  /** Default SQL: FALSE; puede ser NULL. */
  permite_continuidad_doctorado: boolean | null;
  programa_salida_intermedia_id: UUID | null;
  programa_destino_acreditable_id: UUID | null;
  /** Default SQL: FALSE; puede ser NULL. */
  es_acreditable_a_posgrado: boolean | null;
  /** Default SQL: TRUE; puede ser NULL. */
  estructurado_por_cursos: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  requiere_titulo_grado_rn: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  requiere_titulo_profesional: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  permite_menores_edad: boolean | null;
  /** Default SQL: 'NINGUNO'; puede ser NULL. */
  idioma_egreso_requerido: NivelIdiomaMcer | null;
  /** Default SQL: 0; puede ser NULL. */
  num_publicaciones_requeridas: number | null;
  /** Default SQL: FALSE; puede ser NULL. */
  requiere_revista_indexada: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  requiere_pares_evaluadores: boolean | null;
  titulo_o_certificado_otorgado: string;
  abreviatura_grado: string | null;
  /** Default SQL: 'ACTIVO'; puede ser NULL. */
  estado_vigencia: EstadoVigenciaPrograma | null;
  /** Default SQL: NOW(); puede ser NULL. */
  created_at: DateTime | null;
}

/** Tabla programas_tags. */
export interface ProgramaTagRow {
  programa_id: UUID;
  tag_id: UUID;
}

/** Tabla componentes_curriculares. */
export interface ComponenteCurricularRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  programa_id: UUID;
  codigo: string;
  nombre: string;
  descripcion_temario: string | null;
  /** Default SQL: 1. */
  orden_bloque: number;
  horas: number;
  /** Default SQL: 0. */
  creditos: number;
  /** Default SQL: FALSE; puede ser NULL. */
  es_investigacion: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  es_modalidad_graduacion: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  es_practica_profesional: boolean | null;
  /** Default SQL: 0.00. */
  costo_base_asignatura: PgNumeric;
  url_silabo_pdf: string | null;
}

/** Tabla cohortes_apertura. */
export interface CohorteAperturaRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  programa_id: UUID;
  sede_id: UUID;
  modalidad: ModalidadEducativa;
  codigo_cohorte: string;
  numero_edicion: number;
  coordinador_id: UUID;
  fecha_inicio_inscripcion: DateOnly;
  fecha_fin_inscripcion: DateOnly;
  fecha_inicio_clases: DateOnly;
  fecha_fin_clases: DateOnly;
  horario_general: string | null;
  /** Default SQL: 0.00. */
  precio_matricula: PgNumeric;
  precio_total_cohorte: PgNumeric;
  /** Default SQL: 0; puede ser NULL. */
  descuento_porcentaje: number | null;
  /** Default SQL: 15. */
  cupo_minimo: number;
  /** Default SQL: 30. */
  cupo_maximo: number;
  /** Default SQL: 0. */
  cupos_actuales_verificados: number;
  /** Default SQL: FALSE; puede ser NULL. */
  cobro_habilitado: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  tiene_excepcion_cupo_setec: boolean | null;
  excepcion_cupo_setec_url: string | null;
  /** Default SQL: 'PLANIFICADA'; puede ser NULL. */
  estado_cohorte: EstadoCohorte | null;
  informe_evaluacion_cohorte_url: string | null;
  /** Default SQL: NOW(); puede ser NULL. */
  created_at: DateTime | null;
}

/** Tabla programacion_componentes_cohorte. */
export interface ProgramacionComponenteRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  cohorte_id: UUID;
  componente_id: UUID;
  docente_titular_id: UUID | null;
  fecha_inicio: DateOnly | null;
  fecha_fin: DateOnly | null;
  horario: string | null;
  aula: string | null;
  codigo_aula_virtual_externa: string | null;
  /** Default SQL: FALSE; puede ser NULL. */
  actas_notas_cerradas: boolean | null;
}

/** Tabla personas_aspirantes. */
export interface PersonaAspiranteRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  usuario_id: UUID | null;
  tipo_identificacion: TipoIdentificacion;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: DateOnly;
  email: string;
  telefono: string;
  cedula_identidad_pdf_url: string | null;
  /** Default SQL: FALSE; puede ser NULL. */
  identidad_verificada: boolean | null;
  fecha_verificacion: DateTime | null;
  verificado_por_usuario_id: UUID | null;
  /** Default SQL: FALSE; puede ser NULL. */
  tiene_discapacidad: boolean | null;
  descripcion_ajuste_razonable: string | null;
  tutor_nombre_completo: string | null;
  tutor_identificacion: string | null;
  tutor_documento_url: string | null;
  /** Default SQL: NOW(); puede ser NULL. */
  created_at: DateTime | null;
}

/** Tabla aspirantes_intereses_areas. */
export interface AspiranteInteresAreaRow {
  aspirante_id: UUID;
  area_conocimiento_id: UUID;
}

/** Tabla titulos_academicos_aspirante. */
export interface TituloAcademicoAspiranteRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  aspirante_id: UUID;
  area_conocimiento_id: UUID | null;
  nivel_titulo: NivelTitulo;
  denominacion_titulo: string;
  institucion_emisora: string;
  fecha_emision: DateOnly;
  /** Default SQL: FALSE; puede ser NULL. */
  inscrito_registro_nacional: boolean | null;
  codigo_registro_nacional: string | null;
  certificado_rn_url: string | null;
  titulo_pdf_url: string;
  porcentaje_creditos_investigacion: PgNumeric | null;
  /** Default SQL: 'PENDIENTE'; puede ser NULL. */
  estado_validacion: EstadoValidacionTitulo | null;
  observacion_rechazo: string | null;
  fecha_validacion: DateTime | null;
  usuario_validador_id: UUID | null;
}

/** Tabla inscripciones. */
export interface InscripcionRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  codigo_expediente: string;
  aspirante_id: UUID;
  cohorte_id: UUID;
  titulo_presentado_id: UUID | null;
  /** Default SQL: 'EN_REVISION_DOCUMENTAL'. */
  estado: EstadoInscripcion;
  observaciones_administracion: string | null;
  /** Default SQL: 'ESTUDIANTE_EVALUADO'. */
  rol_participacion: RolParticipacionEp;
  titulo_ponencia: string | null;
  resumen_ponencia: string | null;
  archivo_ponencia_url: string | null;
  /** Default SQL: FALSE; puede ser NULL. */
  es_reingreso_cambio_plan: boolean | null;
  inscripcion_origen_id: UUID | null;
  /** Default SQL: FALSE; puede ser NULL. */
  requiere_nivelacion_investigativa: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  acepta_compromiso_idioma_y_publicacion: boolean | null;
  /** Default SQL: NOW(); puede ser NULL. */
  fecha_inscripcion: DateTime | null;
  fecha_aprobacion_documental: DateTime | null;
  fecha_formalizacion_matricula: DateTime | null;
}

/** Tabla pagos_inscripcion. */
export interface PagoInscripcionRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  inscripcion_id: UUID;
  aspirante_id: UUID;
  metodo_pago: MetodoPago;
  numero_referencia_o_recibo: string;
  banco_origen: string | null;
  comprobante_baucher_url: string | null;
  monto_subtotal: PgNumeric;
  /** Default SQL: 0.00. */
  descuento_aplicado: PgNumeric;
  total_pagado: PgNumeric;
  concepto: string;
  /** Default SQL: 'PENDIENTE_REVISION'. */
  estado: EstadoPago;
  motivo_rechazo: string | null;
  /** Default SQL: NOW(); puede ser NULL. */
  fecha_pago_reportada: DateTime | null;
  usuario_validador_caja_id: UUID | null;
  fecha_validacion_caja: DateTime | null;
}

/** Tabla solicitudes_convalidacion_acreditacion. */
export interface SolicitudConvalidacionRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  inscripcion_destino_id: UUID;
  componente_destino_id: UUID;
  origen_tipo: TipoOrigenConvalidacion;
  inscripcion_origen_ep_id: UUID | null;
  certificado_origen_url: string;
  creditos_reconocidos: number;
  justificacion_aporte_perfil: string;
  /** Default SQL: 'PENDIENTE'; puede ser NULL. */
  estado_dictamen: EstadoDictamenConvalidacion | null;
  coordinador_dictaminador_id: UUID | null;
  fecha_dictamen: DateTime | null;
}

/** Tabla lotes_importacion_notas. */
export interface LoteImportacionNotasRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  programacion_componente_id: UUID;
  subido_por_usuario_id: UUID;
  archivo_excel_url: string;
  /** Default SQL: 0. */
  total_registros_procesados: number;
  observaciones: string | null;
  /** Default SQL: NOW(); puede ser NULL. */
  created_at: DateTime | null;
}

/** Tabla matricula_componentes_snepa. */
export interface MatriculaComponenteSnepaRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  inscripcion_id: UUID;
  programacion_componente_id: UUID;
  componente_id: UUID;
  lote_importacion_id: UUID | null;
  /** Default SQL: FALSE; puede ser NULL. */
  es_convalidada: boolean | null;
  calificacion_cuantitativa: PgNumeric | null;
  valoracion_cualitativa: EscalaCualitativaSnepa | null;
  observacion_acompanamiento_pedagogico: string | null;
  /** Default SQL: FALSE; puede ser NULL. */
  autoevaluacion_completada: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  coevaluacion_completada: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  aprobado: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  es_modificada_manualmente: boolean | null;
  registrado_por_usuario_id: UUID | null;
  /** Default SQL: NOW(); puede ser NULL. */
  fecha_registro: DateTime | null;
}

/** Tabla notas_snepa_logs. */
export interface NotaSnepaLogRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  matricula_componente_id: UUID;
  nota_anterior: PgNumeric | null;
  nota_nueva: PgNumeric | null;
  cualitativa_anterior: EscalaCualitativaSnepa | null;
  cualitativa_nueva: EscalaCualitativaSnepa | null;
  motivo_modificacion: string;
  modificado_por_usuario_id: UUID;
  /** Default SQL: NOW(); puede ser NULL. */
  fecha_modificacion: DateTime | null;
}

/** Tabla expediente_graduacion_certificacion. */
export interface ExpedienteGraduacionRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  inscripcion_id: UUID;
  idioma_acreditado: string | null;
  /** Default SQL: 'NINGUNO'; puede ser NULL. */
  nivel_idioma_alcanzado: NivelIdiomaMcer | null;
  institucion_aval_idioma: string | null;
  certificado_idioma_url: string | null;
  /** Default SQL: FALSE; puede ser NULL. */
  idioma_validado: boolean | null;
  modalidad_graduacion_tipo: string | null;
  titulo_trabajo_graduacion: string | null;
  acta_defensa_url: string | null;
  /** Default SQL: FALSE; puede ser NULL. */
  aplico_salida_intermedia: boolean | null;
  titulo_intermedio_emitido_url: string | null;
  tipo_documento_final: TipoDocumentoFinal;
  codigo_registro_titulo_emitido: string | null;
  documento_final_url: string | null;
  fecha_emision: DateOnly | null;
  emitido_por_usuario_id: UUID | null;
}

/** Tabla publicaciones_cientificas_estudiante. */
export interface PublicacionCientificaRow {
  /** Default SQL: gen_random_uuid(). */
  id: UUID;
  expediente_graduacion_id: UUID;
  tipo_publicacion: TipoPublicacionCientifica;
  titulo_publicacion: string;
  nombre_revista_o_medio: string;
  /** Default SQL: FALSE; puede ser NULL. */
  es_revista_indexada: boolean | null;
  /** Default SQL: FALSE; puede ser NULL. */
  tiene_revision_pares: boolean | null;
  alcance: AlcancePublicacion | null;
  url_o_doi: string;
  evidencia_pdf_url: string;
  /** Default SQL: FALSE; puede ser NULL. */
  validado_coordinacion: boolean | null;
}

export interface DatabaseRows {
  permisos: PermisoRow;
  roles: RolRow;
  roles_permisos: RolPermisoRow;
  usuarios: UsuarioRow;
  sesiones: SesionRow;
  areas_conocimiento: AreaConocimientoRow;
  tags_academicos: TagAcademicoRow;
  sedes_ies: SedeIesRow;
  personal_academico: PersonalAcademicoRow;
  programas_academicos: ProgramaAcademicoRow;
  programas_tags: ProgramaTagRow;
  componentes_curriculares: ComponenteCurricularRow;
  cohortes_apertura: CohorteAperturaRow;
  programacion_componentes_cohorte: ProgramacionComponenteRow;
  personas_aspirantes: PersonaAspiranteRow;
  aspirantes_intereses_areas: AspiranteInteresAreaRow;
  titulos_academicos_aspirante: TituloAcademicoAspiranteRow;
  inscripciones: InscripcionRow;
  pagos_inscripcion: PagoInscripcionRow;
  solicitudes_convalidacion_acreditacion: SolicitudConvalidacionRow;
  lotes_importacion_notas: LoteImportacionNotasRow;
  matricula_componentes_snepa: MatriculaComponenteSnepaRow;
  notas_snepa_logs: NotaSnepaLogRow;
  expediente_graduacion_certificacion: ExpedienteGraduacionRow;
  publicaciones_cientificas_estudiante: PublicacionCientificaRow;
}
// =============================================================================
// Entrada HTTP: campos opcionales/defaults no son obligaciones para el consumidor.
// =============================================================================
export interface LoginRequest {
  /** Enviar al menos uno; prioridad: identifier > email > username. */
  identifier?: string;
  email?: string;
  username?: string;
  password: string;
}
export interface RefreshTokenRequest { refreshToken: string }
export interface LogoutRequest { refreshToken?: string }
/** Existe en auth.schema.ts, pero NO tiene endpoint de registro montado. */
export interface RegisterUserRequest {
  email: string; username?: string; password: string; nombres: string; apellidos: string;
  telefono?: string; avatarUrl?: string; rolId: UUID;
}
export interface CreateAreaRequest { nombre: string; slug?: string; icono_url?: string | null; activa?: boolean }
export type UpdateAreaRequest = Partial<CreateAreaRequest>;
export interface CreateTagRequest { nombre: string; slug?: string }
export type UpdateTagRequest = Partial<CreateTagRequest>;
export interface AllQuery { /** Solo el texto literal 'true' incluye inactivos. */ all?: string }
export interface CreateSedeRequest {
  codigo_sede: string; nombre: string; tipo_sede: TipoSede;
  resolucion_autorizacion_setec?: string | null; direccion?: string | null; activa?: boolean;
}
export type UpdateSedeRequest = Partial<CreateSedeRequest>;
export interface CreateDocenteRequest {
  usuario_id?: UUID | null | ''; identificacion: string; nombres: string; apellidos: string;
  maximo_grado_academico: MaximoGradoAcademico; biografia_comercial?: string | null;
  foto_perfil_url?: string | null; cv_url?: string; activo?: boolean | string;
}
export type UpdateDocenteRequest = Partial<CreateDocenteRequest>;
export interface DocenteFiles<F = UploadDescriptor> { foto_perfil?: F; cv_pdf?: F }
export type CreateDocenteMultipart<F = UploadDescriptor> = CreateDocenteRequest & DocenteFiles<F>;
export type UpdateDocenteMultipart<F = UploadDescriptor> = UpdateDocenteRequest & DocenteFiles<F>;
export interface CreateProgramRequest {
  codigo_interno: string;
  codigo_dictamen_setec?: string | null;
  fecha_aprobacion_setec?: DateOnly | null;
  nombre: string;
  slug?: string;
  categoria: CategoriaPrograma;
  subtipo: SubtipoPrograma;
  area_conocimiento_id: UUID;
  resumen_corto_web?: string | null;
  descripcion_comercial?: string | null;
  imagen_portada_url?: string | null;
  video_promo_url?: string | null;
  brochure_pdf_url?: string | null;
  /** Default 0. */ precio_total_referencia?: NumericInput;
  /** Default 0. */ descuento_porcentaje?: NumericInput;
  /** Default false. */ visible_en_web?: BooleanInput;
  /** Default false. */ es_ciencias_salud?: BooleanInput;
  aval_minsa_url?: string | null;
  duracion_meses?: NumericInput;
  /** Si se omite, el default 0 incumple mínimo 1: enviar >= 1. */ horas_totales: NumericInput;
  /** Default 0. */ creditos_totales?: NumericInput;
  /** Default 0. */ creditos_investigacion?: NumericInput;
  permite_continuidad_doctorado?: BooleanInput;
  programa_salida_intermedia_id?: NullableUuidInput;
  programa_destino_acreditable_id?: NullableUuidInput;
  es_acreditable_a_posgrado?: BooleanInput;
  /** Default true; el servicio fuerza false en ambos doctorados. */ estructurado_por_cursos?: BooleanInput;
  requiere_titulo_grado_rn?: BooleanInput;
  requiere_titulo_profesional?: BooleanInput;
  permite_menores_edad?: BooleanInput;
  /** Default NINGUNO. */ idioma_egreso_requerido?: NivelIdiomaMcer;
  /** Default 0. */ num_publicaciones_requeridas?: NumericInput;
  requiere_revista_indexada?: BooleanInput;
  requiere_pares_evaluadores?: BooleanInput;
  titulo_o_certificado_otorgado: string;
  abreviatura_grado?: string | null;
  /** Default ACTIVO. */ estado_vigencia?: EstadoVigenciaPrograma;
  /** En multipart usar campos repetidos tag_ids[]; no JSON.stringify. */ tag_ids?: UUID[];
}
/** Zod partial conserva defaults de idioma_egreso_requerido y estado_vigencia aunque se omitan. */
export type UpdateProgramRequest = Partial<CreateProgramRequest>;
export interface ProgramFiles<F = UploadDescriptor> { aval_minsa?: F; imagen_portada?: F; brochure_pdf?: F }
export type CreateProgramMultipart<F = UploadDescriptor> = CreateProgramRequest & ProgramFiles<F>;
export type UpdateProgramMultipart<F = UploadDescriptor> = UpdateProgramRequest & ProgramFiles<F>;
export interface CreateComponenteRequest {
  codigo: string; nombre: string; descripcion_temario?: string | null;
  /** Default 1. */ orden_bloque?: NumericInput;
  /** Default 1. */ horas?: NumericInput;
  /** Default 0. */ creditos?: NumericInput;
  es_investigacion?: BooleanInput; es_modalidad_graduacion?: BooleanInput; es_practica_profesional?: BooleanInput;
  /** Default 0. */ costo_base_asignatura?: NumericInput;
  url_silabo_pdf?: string | null;
}
export type UpdateComponenteRequest = Partial<CreateComponenteRequest>;
export interface ComponenteFiles<F = UploadDescriptor> { silabo_pdf?: F }
export type CreateComponenteMultipart<F = UploadDescriptor> = CreateComponenteRequest & ComponenteFiles<F>;
export type UpdateComponenteMultipart<F = UploadDescriptor> = UpdateComponenteRequest & ComponenteFiles<F>;
export interface AssignTagsRequest { tag_ids: UUID[] }
export interface CatalogQuery { area_id?: UUID; categoria?: CategoriaPrograma; subtipo?: SubtipoPrograma; search?: string }
/** Esta ruta no aplica catalogQuerySchema: filtros no validados, se muestran dominios útiles para UI. */
export interface ListProgramsQuery extends CatalogQuery { estado_vigencia?: EstadoVigenciaPrograma; visible_en_web?: string }
export interface CreateCohorteRequest {
  programa_id: UUID; sede_id: UUID; modalidad: ModalidadEducativa; codigo_cohorte: string;
  /** Default 1. */ numero_edicion?: NumericInput;
  coordinador_id: UUID;
  fecha_inicio_inscripcion: DateOnly; fecha_fin_inscripcion: DateOnly;
  fecha_inicio_clases: DateOnly; fecha_fin_clases: DateOnly;
  horario_general?: string | null;
  /** Default 0. */ precio_matricula?: NumericInput;
  /** Default 0. */ precio_total_cohorte?: NumericInput;
  /** Default 0. */ descuento_porcentaje?: NumericInput;
  /** Default 15. */ cupo_minimo?: NumericInput;
  /** Default 30. */ cupo_maximo?: NumericInput;
  tiene_excepcion_cupo_setec?: BooleanInput;
  excepcion_cupo_setec_url?: string | null;
  /** Default PLANIFICADA; también se aplica si se omite en PUT. */ estado_cohorte?: EstadoCohorte;
}
export interface UpdateCohorteRequest extends Partial<CreateCohorteRequest> {
  cupos_actuales_verificados?: NumericInput; cobro_habilitado?: BooleanInput;
  informe_evaluacion_cohorte_url?: string | null;
}
export interface CohorteFiles<F = UploadDescriptor> { excepcion_cupo_pdf?: F }
export type CreateCohorteMultipart<F = UploadDescriptor> = CreateCohorteRequest & CohorteFiles<F>;
export type UpdateCohorteMultipart<F = UploadDescriptor> = UpdateCohorteRequest & CohorteFiles<F>;
export interface ProgramarComponenteRequest {
  componente_id: UUID; docente_titular_id?: NullableUuidInput;
  fecha_inicio?: DateOnly | null; fecha_fin?: DateOnly | null;
  horario?: string | null; aula?: string | null; codigo_aula_virtual_externa?: string | null;
  actas_notas_cerradas?: BooleanInput;
}
/** componente_id se acepta por schema, pero el DAO de actualización no lo modifica. */
export type UpdateProgramacionRequest = Partial<ProgramarComponenteRequest>;
export interface CohorteQuery {
  programa_id?: UUID; sede_id?: UUID; modalidad?: ModalidadEducativa; estado_cohorte?: EstadoCohorte; search?: string;
}
export interface CreateApplicantProfileRequest {
  usuario_id?: UUID; tipo_identificacion: TipoIdentificacion; numero_identificacion: string;
  nombres: string; apellidos: string; fecha_nacimiento: DateOnly; email: string; telefono: string;
  cedula_identidad_pdf_url?: string | null; tiene_discapacidad?: BooleanInput;
  descripcion_ajuste_razonable?: string | null;
  tutor_nombre_completo?: string | null; tutor_identificacion?: string | null; tutor_documento_url?: string | null;
  /** Array JSON o texto JSON en multipart; default []. */ intereses_areas_ids?: UUID[] | string;
}
/** Default [] en intereses_areas_ids puede borrar intereses si se omite. */
export type UpdateApplicantProfileRequest = Partial<Omit<CreateApplicantProfileRequest, 'usuario_id'>>;
export interface ApplicantProfileFiles<F = UploadDescriptor> {
  cedula_identidad_pdf?: F; tutor_documento?: F;
}
/** Los campos *_url admiten texto o archivo con ese mismo nombre. */
export type CreateApplicantProfileMultipart<F = UploadDescriptor> =
  Omit<CreateApplicantProfileRequest, 'cedula_identidad_pdf_url' | 'tutor_documento_url'> &
  ApplicantProfileFiles<F> & { cedula_identidad_pdf_url?: string | null | F; tutor_documento_url?: string | null | F };
export type UpdateApplicantProfileMultipart<F = UploadDescriptor> =
  Partial<Omit<CreateApplicantProfileMultipart<F>, 'usuario_id'>>;
export interface ReplaceInterestsRequest { area_conocimiento_ids: UUID[] }
export interface ListApplicantsQuery { identidad_verificada?: BooleanInput; search?: string; limit?: NumericInput; offset?: NumericInput }
export interface CreateAcademicDegreeRequest {
  area_conocimiento_id?: UUID | null; nivel_titulo: NivelTitulo; denominacion_titulo: string;
  institucion_emisora: string; fecha_emision: DateOnly; inscrito_registro_nacional?: BooleanInput;
  codigo_registro_nacional?: string | null; certificado_rn_url?: string | null; titulo_pdf_url?: string | null;
  porcentaje_creditos_investigacion?: NumericInput;
}
export type UpdateAcademicDegreeRequest = Partial<CreateAcademicDegreeRequest>;
export interface AcademicDegreeFiles<F = UploadDescriptor> { titulo_pdf?: F; certificado_rn?: F }
export type CreateAcademicDegreeMultipart<F = UploadDescriptor> =
  Omit<CreateAcademicDegreeRequest, 'titulo_pdf_url' | 'certificado_rn_url'> & AcademicDegreeFiles<F> &
  { titulo_pdf_url?: string | null | F; certificado_rn_url?: string | null | F };
export type UpdateAcademicDegreeMultipart<F = UploadDescriptor> = Partial<CreateAcademicDegreeMultipart<F>>;
/** RECHAZADO exige observacion_rechazo no vacía en Zod. */
export type ValidateAcademicDegreeRequest =
  | { estado_validacion: 'RECHAZADO'; observacion_rechazo: string }
  | { estado_validacion: 'PENDIENTE' | 'VALIDADO'; observacion_rechazo?: string | null };
export interface CreateEnrollmentRequest {
  aspirante_id?: UUID; cohorte_id: UUID; titulo_presentado_id?: UUID | null;
  /** Default ESTUDIANTE_EVALUADO. */ rol_participacion?: RolParticipacionEp;
  titulo_ponencia?: string | null; resumen_ponencia?: string | null; archivo_ponencia_url?: string | null;
  es_reingreso_cambio_plan?: BooleanInput; inscripcion_origen_id?: UUID | null;
  requiere_nivelacion_investigativa?: BooleanInput; acepta_compromiso_idioma_y_publicacion?: BooleanInput;
  observaciones_administracion?: string | null;
}
export type CreateEnrollmentMultipart<F = UploadDescriptor> = Omit<CreateEnrollmentRequest, 'archivo_ponencia_url'> &
  { archivo_ponencia?: F; archivo_ponencia_url?: string | null | F };
export interface ValidateDocumentsRequest { /** Default true. */ aprobado?: BooleanInput; observaciones_administracion?: string | null }
export interface CreatePaymentRequest {
  metodo_pago: MetodoPago; numero_referencia_o_recibo: string; banco_origen?: string | null;
  monto_subtotal: NumericInput;
  /** Default 0. */ descuento_aplicado?: NumericInput;
  total_pagado: NumericInput;
  clave_idempotencia?: string; aplicaciones?: BillingAllocation[];
  concepto: string; comprobante_baucher_url?: string | null; fecha_pago_reportada?: string;
}
export type CreatePaymentMultipart<F = UploadDescriptor> = Omit<CreatePaymentRequest, 'comprobante_baucher_url'> &
  { comprobante_baucher?: F; comprobante_baucher_url?: string | null | F; baucher?: F };
export interface ValidatePaymentRequest { estado: 'APROBADO' | 'RECHAZADO'; motivo_rechazo?: string | null }
export interface CreateConvalidationRequest {
  componente_destino_id: UUID; origen_tipo: TipoOrigenConvalidacion; inscripcion_origen_ep_id?: UUID | null;
  creditos_reconocidos: NumericInput; justificacion_aporte_perfil: string; certificado_origen_url?: string | null;
}
export type CreateConvalidationMultipart<F = UploadDescriptor> = Omit<CreateConvalidationRequest, 'certificado_origen_url'> &
  { certificado_origen?: F; certificado_origen_url?: string | null | F };
export interface DictamenConvalidationRequest {
  estado_dictamen: 'APROBADA' | 'RECHAZADA'; coordinador_dictaminador_id?: UUID | null;
}
export interface ListEnrollmentsQuery {
  programa_id?: UUID; cohorte_id?: UUID; aspirante_id?: UUID; estado?: EstadoInscripcion; page?: NumericInput; limit?: NumericInput; search?: string;
}
export interface ModifyGradeRequest {
  /** Obligatorio, mínimo 5 caracteres. */ motivo_modificacion: string;
  calificacion_cuantitativa?: number; valoracion_cualitativa?: EscalaCualitativaSnepa;
  observacion_acompanamiento_pedagogico?: string; autoevaluacion_completada?: boolean; coevaluacion_completada?: boolean;
}
export interface ImportGradesMultipart<F = UploadDescriptor> { archivo_excel: F; observaciones?: string }
/** Modelo tras leer Excel; rowNumber es interno, NO una columna del archivo. */
export interface ExcelGradeRow {
  codigo_expediente: string; calificacion_cuantitativa: number; valoracion_cualitativa?: EscalaCualitativaSnepa;
  autoevaluacion_completada?: boolean; coevaluacion_completada?: boolean;
  observacion_acompanamiento_pedagogico?: string; rowNumber: number;
}
export interface CreateExpedienteRequest {
  inscripcion_id: UUID; tipo_documento_final: TipoDocumentoFinal; idioma_acreditado?: string;
  /** Default NINGUNO. */ nivel_idioma_alcanzado?: NivelIdiomaMcer;
  institucion_aval_idioma?: string; modalidad_graduacion_tipo?: string; titulo_trabajo_graduacion?: string;
  /** Solo el texto exacto 'true' se convierte a true. Default false. */ aplico_salida_intermedia?: boolean | string;
}
export interface UpdateExpedienteRequest {
  idioma_acreditado?: string; nivel_idioma_alcanzado?: NivelIdiomaMcer; institucion_aval_idioma?: string;
  idioma_validado?: boolean | string; modalidad_graduacion_tipo?: string; titulo_trabajo_graduacion?: string;
  aplico_salida_intermedia?: boolean | string; tipo_documento_final?: TipoDocumentoFinal;
}
export interface ExpedienteFiles<F = UploadDescriptor> {
  certificado_idioma?: F; certificado_idioma_url?: F; acta_defensa?: F; acta_defensa_url?: F;
  titulo_intermedio?: F; titulo_intermedio_emitido_url?: F;
}
export type CreateExpedienteMultipart<F = UploadDescriptor> = CreateExpedienteRequest & ExpedienteFiles<F>;
export type UpdateExpedienteMultipart<F = UploadDescriptor> = UpdateExpedienteRequest & ExpedienteFiles<F>;
export interface CreatePublicationRequest {
  tipo_publicacion: TipoPublicacionCientifica; titulo_publicacion: string; nombre_revista_o_medio: string;
  /** Default false; solo texto exacto 'true' se convierte a true. */ es_revista_indexada?: boolean | string;
  tiene_revision_pares?: boolean | string; alcance?: AlcancePublicacion; url_o_doi: string;
}
export type CreatePublicationMultipart<F = UploadDescriptor> = CreatePublicationRequest & { evidencia_pdf: F };
/** JSON boolean real; no coerción de string en esta ruta. */
export interface ValidatePublicationRequest { validado_coordinacion: boolean }
export interface IssueDocumentRequest {
  codigo_registro_titulo_emitido?: string; documento_final_url?: string; fecha_emision?: DateOnly;
  tipo_documento_final?: TipoDocumentoFinal;
}
export type IssueDocumentMultipart<F = UploadDescriptor> = IssueDocumentRequest & { documento_final?: F };
// =============================================================================
// Respuestas JSON: proyecciones reales, no equivalencias con interfaces del DAO.
// =============================================================================
export interface ApiSuccess<T> { success: true; data: T }
export interface ApiMessageSuccess<T> extends ApiSuccess<T> { message: string }
export interface ApiMessageOnly { success: true; message: string }
export interface ApiCountSuccess<T> extends ApiSuccess<T[]> { count: number }
export interface Pagination { total: number; page: number; limit: number; totalPages: number }
export interface ApiPaginatedSuccess<T> extends ApiSuccess<T[]> { pagination: Pagination }
export interface ApiTotalSuccess<T> extends ApiSuccess<T[]> { total: number }
export interface ApiOperationalError { success: false; message: string; /** AppError admite cualquier valor. */ details?: unknown }
export interface ApiValidationError { success: false; message: 'Validation error'; errors: { field: string; message: string }[] }
export interface ApiDatabaseError {
  success: false; message: string;
  code: 'PG_UNIQUE_VIOLATION' | 'PG_FOREIGN_KEY_VIOLATION' | 'PG_CHECK_VIOLATION';
  detail?: string; constraint?: string;
}
export interface ApiInternalError { success: false; message: 'Internal server error'; error?: string; stack?: string }
export type ApiError = ApiOperationalError | ApiValidationError | ApiDatabaseError | ApiInternalError;
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export interface AuthTokens { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: 900 }
/** rol/permisos son strings de base de datos, no ENUM SQL cerrados; constantes seed disponibles arriba. */
export interface UserProfileResponse extends Pick<UsuarioRow, 'id' | 'username' | 'email' | 'nombres' | 'apellidos' | 'telefono' | 'avatar_url' | 'activo' | 'email_verificado' | 'created_at'> {
  rol: string; permisos: string[];
}
export interface LoginResponse { user: UserProfileResponse; tokens: AuthTokens }
export interface AccessTokenClaims { sub: UUID; sid: UUID; rol: string; permisos: string[]; iat: number; exp: number }
export interface RefreshTokenClaims { sub: UUID; jti: UUID; iat: number; exp: number }
export type AreaInfo = Pick<AreaConocimientoRow, 'id' | 'nombre' | 'slug' | 'icono_url'>;
export type TagInfo = TagAcademicoRow;
export interface DocenteDetail extends PersonalAcademicoRow { usuario_email: string | null; usuario_username: string | null; rol_nombre: string | null }
/** json_build_object no incluye programa_id y convierte NUMERIC a número JSON. */
export type EmbeddedComponente = Omit<ComponenteCurricularRow, 'programa_id' | 'costo_base_asignatura'> & { costo_base_asignatura: number };
export interface ProgramListItem extends ProgramaAcademicoRow { area_conocimiento: AreaInfo; tags: TagInfo[] }
export interface ProgramDetail extends ProgramListItem { componentes: EmbeddedComponente[] }
export interface CatalogCohorte extends Pick<CohorteAperturaRow,
  'id' | 'codigo_cohorte' | 'numero_edicion' | 'modalidad' | 'sede_id' | 'fecha_inicio_inscripcion' |
  'fecha_fin_inscripcion' | 'fecha_inicio_clases' | 'fecha_fin_clases' | 'horario_general' |
  'descuento_porcentaje' | 'cupo_minimo' | 'cupo_maximo' | 'cupos_actuales_verificados' | 'cobro_habilitado' | 'estado_cohorte'> {
  sede_nombre: string; precio_matricula: number; precio_total_cohorte: number;
}
/** Catalog SELECT omite aval_minsa_url, aunque ProgramCatalogItem backend hereda erróneamente ese campo. */
export interface ProgramCatalogItem extends Omit<ProgramListItem, 'aval_minsa_url'> {
  malla_curricular: EmbeddedComponente[]; cohortes_abiertas: CatalogCohorte[];
}
export type RecommendationReason = 'CONTINUIDAD_ACREDITABLE' | 'AFINIDAD_TITULO_PREVIO' | 'INTERES_DECLARADO' | 'CONVALIDABLE_A_POSGRADO';
export interface ProgramRecommendationItem extends ProgramaAcademicoRow {
  area_nombre: string; area_slug: string; area_icono_url: string | null;
  score_relevancia: number; motivos_match: RecommendationReason[]; tags: TagInfo[]; total_cohortes_abiertas: number;
}
export interface ProgramacionDetail extends ProgramacionComponenteRow {
  componente_codigo: string; componente_nombre: string; orden_bloque: number; horas: number; creditos: number;
  docente_nombres: string | null; docente_apellidos: string | null; docente_identificacion: string | null;
  docente_maximo_grado: MaximoGradoAcademico | null;
}
/** Alias SQL real: codigo_sede (NO sede_codigo). */
export interface CohorteListItem extends CohorteAperturaRow {
  programa_nombre: string; programa_codigo: string; programa_subtipo: SubtipoPrograma; es_ciencias_salud: boolean | null;
  sede_nombre: string; codigo_sede: string; coordinador_nombres: string; coordinador_apellidos: string; coordinador_identificacion: string;
}
export interface CohorteDetail extends CohorteListItem { programacion: ProgramacionDetail[] }
export interface ApplicantListItem extends PersonaAspiranteRow {
  usuario_email: string | null; verificador_nombres: string | null; verificador_apellidos: string | null;
}
/** Proyección SQL provisional: ac.codigo no existe en init.sql; esta consulta falla con ese esquema. */
export interface ApplicantInterest extends AspiranteInteresAreaRow { area_nombre: string; area_codigo: string | null }
export interface AcademicDegreeDetail extends TituloAcademicoAspiranteRow {
  area_nombre: string | null; validador_nombres: string | null; validador_apellidos: string | null;
}
export interface ApplicantDetail extends ApplicantListItem { intereses: ApplicantInterest[]; titulos: AcademicDegreeDetail[] }
/** INSERT/UPDATE retornan pa.* sin los tres alias de lectura de ApplicantListItem. */
export interface ApplicantMutationResult extends PersonaAspiranteRow { intereses: ApplicantInterest[]; titulos: AcademicDegreeDetail[] }
export interface EnrollmentDetail extends InscripcionRow {
  aspirante_nombres: string; aspirante_apellidos: string; aspirante_identificacion: string;
  aspirante_tipo_identificacion: TipoIdentificacion; aspirante_email: string; aspirante_telefono: string;
  aspirante_usuario_id: UUID | null; cohorte_codigo: string; numero_edicion: number; cohorte_modalidad: ModalidadEducativa;
  precio_matricula: PgNumeric; precio_total_cohorte: PgNumeric; cupo_minimo: number; cupo_maximo: number;
  cupos_actuales_verificados: number; cobro_habilitado: boolean | null; estado_cohorte: EstadoCohorte | null;
  programa_id: UUID; programa_nombre: string; programa_codigo: string; programa_categoria: CategoriaPrograma;
  programa_subtipo: SubtipoPrograma; requiere_titulo_grado_rn: boolean | null;
  titulo_denominacion: string | null; titulo_nivel: NivelTitulo | null; titulo_institucion: string | null;
  titulo_estado_validacion: EstadoValidacionTitulo | null;
}
export interface ConvalidationDetail extends SolicitudConvalidacionRow {
  componente_nombre: string; componente_codigo: string; componente_creditos: number;
  coordinador_nombres: string | null; coordinador_apellidos: string | null;
}
export interface EnrollmentDossier { inscripcion: EnrollmentDetail; pagos: PagoInscripcionRow[]; convalidaciones: ConvalidationDetail[] }
export interface ValidatePaymentResult { pago: PagoInscripcionRow; inscripcion: EnrollmentDetail }
export interface ImportGradesResult {
  lote: LoteImportacionNotasRow | null; total_filas_leidas: number; total_registros_procesados: number;
  errores_filas: { fila: number; error: string }[];
}
export interface ModifyGradeResult { grade: MatriculaComponenteSnepaRow | null; auditLog: NotaSnepaLogRow }
/** Proyección final de listado; el servicio primero usa consulta de programación con columnas inexistentes. */
export interface ComponentGrade extends MatriculaComponenteSnepaRow {
  codigo_expediente: string; nombres: string; apellidos: string; numero_identificacion: string; registrado_por_email: string | null;
}
/** Provisional: nombres de columna heredados no existen en componentes_curriculares de init.sql. */
export interface StudentGrade extends MatriculaComponenteSnepaRow {
  nombre_modulo: string; codigo_componente: string; creditos_academicos: number; orden_secuencia: number;
  fecha_inicio: DateOnly | null; fecha_fin: DateOnly | null;
}
/** Current role projection is joined through roles. */
export interface GradeLog extends NotaSnepaLogRow { modificado_por_email: string; modificado_por_rol: string }
export interface ImportLot extends LoteImportacionNotasRow { subido_por_email: string }
export interface GraduationDetail extends ExpedienteGraduacionRow {
  codigo_expediente: string; inscripcion_estado: EstadoInscripcion; aspirante_nombres: string; aspirante_apellidos: string;
  numero_identificacion: string; programa_nombre: string; programa_subtipo: SubtipoPrograma; codigo_cohorte: string;
  publicaciones: PublicacionCientificaRow[];
  certificado_digital_id: UUID | null; estado_certificado: CertificateStatus | null; registro_digital_disponible: boolean;
}
export interface IssueDocumentResult {
  expediente: ExpedienteGraduacionRow | null; codigo_registro: string; fecha_emision: DateOnly;
  estado_inscripcion: 'GRADUADO_O_CERTIFICADO'; estudiante: string; programa: string;
}
/** Public verification excludes identity numbers and private document URLs. */
export interface PublicGraduationVerification {
  autenticidad_verificada: boolean; registro_digital_disponible: boolean; integridad_verificada: boolean;
  estado_certificado: CertificateStatus | null; token_publico?: UUID; codigo_registro: string; tipo_documento: TipoDocumentoFinal; fecha_emision: DateOnly;
  estudiante: { nombres: string; apellidos: string };
  programa: { nombre: string; categoria: CategoriaPrograma; subtipo: SubtipoPrograma; titulo_o_certificado_otorgado: string };
  cohorte: { codigo_cohorte: string; sede: string };
}
/** Endpoint extra de app.ts, sin envelope success. */
export interface HealthResponse {
  status: 'ok'; uptime: number; timestamp: DateTime; database: { status: 'connected'; serverTime: DateTime };
}
// =============================================================================
// Parámetros y mapa de rutas montadas; incluye adiciones del ecosistema actual.
// =============================================================================
export interface IdParam { id: UUID }
export interface SlugParam { slug: string }
export interface AspiranteIdParam { aspiranteId: UUID }
export interface DegreeIdParam { degreeId: UUID }
export interface ApplicantDegreeParam extends IdParam { degreeId: UUID }
export interface ComponenteParam extends IdParam { componenteId: UUID }
export interface PaymentIdParam { paymentId: UUID }
export interface ConvalidationIdParam { convalidationId: UUID }
export interface ProgramacionComponenteIdParam { programacionComponenteId: UUID }
export interface MatriculaComponenteIdParam { matriculaComponenteId: UUID }
export interface InscripcionIdParam { inscripcionId: UUID }
export interface PublicationIdParam { publicationId: UUID }
export interface ExpedienteIdParam { expedienteId: UUID }
export interface VerifyCodeParam { codigoRegistro: string }
export interface BearerHeaders { Authorization: `Bearer ${string}` }
export interface LogoutHeaders { 'x-refresh-token'?: string }
/**
 * Descriptor estático, NO cliente ni validador ejecutable.
 * successStatus identifica el código de éxito; la respuesta también puede ser ApiError.
 * permission es el código del middleware; SUPER_ADMIN tiene bypass.
 * transport json|multipart indica ambas formas aceptadas por middleware; enviar FormData
 * con Content-Type/boundary administrado por el navegador, nunca JSON.stringify(archivo).
 */
export interface ApiEndpoint<Params, Query, Body, Success, Status extends number = 200,
  Auth extends boolean = false, Permission extends PermisoCodigo | null = null,
  Transport extends 'none' | 'json' | 'multipart' | 'json|multipart' = 'none'> {
  params: Params;
  query: Query;
  body: Body;
  success: Success;
  response: Success | ApiError;
  successStatus: Status;
  authenticated: Auth;
  headers: Auth extends true ? BearerHeaders : undefined;
  permission: Permission;
  transport: Transport;
}
export type NoInput = undefined;
/** Public registration never accepts role, status or permission fields. */
export interface PublicStudentRegistrationRequest {
  email: string; password: string; nombres: string; apellidos: string;
  username?: string; telefono?: string;
}
export type SelfAccountUpdateRequest = Partial<Omit<PublicStudentRegistrationRequest, 'password'>>;
export interface ManagedUserRequest extends PublicStudentRegistrationRequest { rolId: UUID; activo?: boolean }
export type ManagedUserUpdateRequest = SelfAccountUpdateRequest & { rolId?: UUID; activo?: boolean };
export type ManagedUser = Omit<UserProfileResponse, 'permisos'> & { rol_id: UUID };
export interface AssignableRole { id: UUID; nombre: string; descripcion: string | null; permisos: string[] }
export interface ManagedUserPage { items: ManagedUser[]; total: number; page: number; limit: number }
export interface ManagedUserQuery { search?: string; rol?: string; page?: number; limit?: number }
export type CashierEnrollment = Pick<EnrollmentDetail, 'id' | 'codigo_expediente' | 'estado' | 'aspirante_nombres' | 'aspirante_apellidos' | 'cohorte_codigo' | 'programa_nombre' | 'precio_matricula' | 'precio_total_cohorte' | 'cobro_habilitado' | 'cupos_actuales_verificados' | 'cupo_minimo'>;
export interface CashierEnrollmentDossier { inscripcion: CashierEnrollment; pagos: PagoInscripcionRow[]; convalidaciones: [] }

export interface TeachingAssignment {
  id: UUID; cohorte_id: UUID; componente_id: UUID; fecha_inicio: DateOnly | null;
  fecha_fin: DateOnly | null; horario: string | null; aula: string | null; actas_notas_cerradas: boolean;
  componente_nombre: string; componente_codigo: string; codigo_cohorte: string;
  estado_cohorte: EstadoCohorte; programa_nombre: string;
}
/** The registry records supplied institutional PDFs; no official design or digital signature is generated. */
export type CertificateStatus = 'VIGENTE' | 'REVOCADO';
export type CertificateEventAction = 'EMITIDO' | 'REGISTRADO' | 'REVOCADO';
export interface CertificatePublicView {
  token_publico: UUID; estado: CertificateStatus; titular_nombre: string; programa_nombre: string;
  cohorte_codigo: string; tipo_documento: TipoDocumentoFinal; fecha_emision: DateOnly;
  fecha_revocacion: DateTime | null;
}
export interface CertificateVerification extends CertificatePublicView { integridad_verificada: boolean }
export interface CertificateView extends CertificatePublicView {
  id: UUID; expediente_id: UUID; puede_descargar: boolean;
}
/** Protected administrative audit response; actor/reason are never in public verification. */
export interface CertificateEvent {
  id: UUID; accion: CertificateEventAction; fecha: DateTime; actor_id: UUID; motivo: string | null;
}
export interface CertificatePaginationQuery { page?: number; limit?: number }
export interface CertificateListQuery extends CertificatePaginationQuery { search?: string; estado?: CertificateStatus }
export interface CertificateRevokeRequest { motivo: string }
export type CertificateRegisterRequest = Record<string, never>;
export interface CertificateCollection extends ApiSuccess<CertificateView[]> { total: number; pagination: Pagination }
/** Internal SQL row only; its file reference, hash and actor data are not public DTO fields. */
export interface CertificateRegistryRow extends Omit<CertificateView, 'puede_descargar'> {
  titular_usuario_id: UUID | null; documento_url: string; documento_sha256: string;
  registrado_por_usuario_id: UUID; fecha_registro: DateTime; motivo_revocacion: string | null;
  revocado_por_usuario_id: UUID | null;
}
/** Successful download bytes; response Content-Type is application/pdf with attachment disposition. */
export type CertificatePdfDownload = Uint8Array;

export interface ApiEndpointMap<F = UploadDescriptor> {
  // Certificate collection/events require either administrative permission; download permits ownership too.
  'GET /api/certificates/verify/:token': ApiEndpoint<{ token: UUID }, NoInput, NoInput, ApiSuccess<CertificateVerification>, 200, false, null, 'none'>;
  'GET /api/certificates/me': ApiEndpoint<NoInput, CertificatePaginationQuery, NoInput, CertificateCollection, 200, true, null, 'none'>;
  'GET /api/certificates': ApiEndpoint<NoInput, CertificateListQuery, NoInput, CertificateCollection, 200, true, 'TITULO_EMITIR' | 'CERTIFICADO_REVOCAR', 'none'>;
  'GET /api/certificates/:id/download': ApiEndpoint<IdParam, NoInput, NoInput, CertificatePdfDownload, 200, true, null, 'none'>;
  'GET /api/certificates/:id/events': ApiEndpoint<IdParam, NoInput, NoInput, ApiSuccess<CertificateEvent[]>, 200, true, 'TITULO_EMITIR' | 'CERTIFICADO_REVOCAR', 'none'>;
  'POST /api/certificates/expediente/:id/register': ApiEndpoint<IdParam, NoInput, CertificateRegisterRequest, ApiSuccess<CertificateView>, 201, true, 'TITULO_EMITIR', 'json'>;
  'POST /api/certificates/:id/revoke': ApiEndpoint<IdParam, NoInput, CertificateRevokeRequest, ApiSuccess<CertificateView>, 200, true, 'CERTIFICADO_REVOCAR', 'json'>;
  'GET /api/cohorts/teaching/me': ApiEndpoint<NoInput, NoInput, NoInput, ApiSuccess<TeachingAssignment[]>, 200, true, null, 'none'>;
  'POST /api/auth/register': ApiEndpoint<NoInput, NoInput, PublicStudentRegistrationRequest, ApiMessageSuccess<UserProfileResponse>, 201, false, null, 'json'>;
  'PATCH /api/auth/profile': ApiEndpoint<NoInput, NoInput, SelfAccountUpdateRequest, ApiMessageSuccess<UserProfileResponse>, 200, true, null, 'json'>;
  'GET /api/users': ApiEndpoint<NoInput, ManagedUserQuery, NoInput, ApiSuccess<ManagedUserPage>, 200, true, 'USUARIO_GESTIONAR', 'none'>;
  'GET /api/users/roles': ApiEndpoint<NoInput, NoInput, NoInput, ApiSuccess<AssignableRole[]>, 200, true, 'USUARIO_GESTIONAR', 'none'>;
  'POST /api/users': ApiEndpoint<NoInput, NoInput, ManagedUserRequest, ApiMessageSuccess<ManagedUser>, 201, true, 'USUARIO_GESTIONAR', 'json'>;
  'PATCH /api/users/:id': ApiEndpoint<{ id: UUID }, NoInput, ManagedUserUpdateRequest, ApiMessageSuccess<ManagedUser>, 200, true, 'USUARIO_GESTIONAR', 'json'>;
  'GET /api/enrollments/cashier': ApiEndpoint<NoInput, ListEnrollmentsQuery, NoInput, ApiPaginatedSuccess<CashierEnrollment>, 200, true, 'PAGO_VALIDAR', 'none'>;
  // applicants
  'GET /api/applicants/me': ApiEndpoint<NoInput, NoInput, NoInput, ApiSuccess<ApplicantDetail>, 200, true, null, 'none'>;
  'PUT /api/applicants/me': ApiEndpoint<NoInput, NoInput, UpdateApplicantProfileMultipart<F>, ApiMessageSuccess<ApplicantMutationResult>, 200, true, null, 'json|multipart'>;
  'GET /api/applicants/degrees/:degreeId': ApiEndpoint<{ degreeId: UUID }, NoInput, NoInput, ApiSuccess<AcademicDegreeDetail>, 200, true, null, 'none'>;
  'PUT /api/applicants/degrees/:degreeId': ApiEndpoint<{ degreeId: UUID }, NoInput, UpdateAcademicDegreeMultipart<F>, ApiMessageSuccess<TituloAcademicoAspiranteRow>, 200, true, null, 'json|multipart'>;
  'DELETE /api/applicants/degrees/:degreeId': ApiEndpoint<{ degreeId: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, null, 'none'>;
  'PATCH /api/applicants/degrees/:degreeId/validate': ApiEndpoint<{ degreeId: UUID }, NoInput, ValidateAcademicDegreeRequest, ApiMessageSuccess<TituloAcademicoAspiranteRow>, 200, true, 'INSCRIPCION_VALIDAR', 'json'>;
  'GET /api/applicants': ApiEndpoint<NoInput, ListApplicantsQuery, NoInput, ApiCountSuccess<ApplicantListItem>, 200, true, 'INSCRIPCION_VALIDAR', 'none'>;
  'POST /api/applicants': ApiEndpoint<NoInput, NoInput, CreateApplicantProfileMultipart<F>, ApiMessageSuccess<ApplicantMutationResult>, 201, true, null, 'json|multipart'>;
  'GET /api/applicants/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<ApplicantDetail>, 200, true, null, 'none'>;
  'PUT /api/applicants/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateApplicantProfileMultipart<F>, ApiMessageSuccess<ApplicantMutationResult>, 200, true, null, 'json|multipart'>;
  'PATCH /api/applicants/:id/verify-identity': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiMessageSuccess<PersonaAspiranteRow>, 200, true, 'INSCRIPCION_VALIDAR', 'none'>;
  'PUT /api/applicants/:id/interests': ApiEndpoint<{ id: UUID }, NoInput, ReplaceInterestsRequest, ApiMessageSuccess<ApplicantInterest[]>, 200, true, null, 'json'>;
  'GET /api/applicants/:id/interests': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<ApplicantInterest[]>, 200, true, null, 'none'>;
  'POST /api/applicants/:id/degrees': ApiEndpoint<{ id: UUID }, NoInput, CreateAcademicDegreeMultipart<F>, ApiMessageSuccess<TituloAcademicoAspiranteRow>, 201, true, null, 'json|multipart'>;
  'GET /api/applicants/:id/degrees': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiCountSuccess<AcademicDegreeDetail>, 200, true, null, 'none'>;
  // auth
  'POST /api/auth/login': ApiEndpoint<NoInput, NoInput, LoginRequest, ApiMessageSuccess<LoginResponse>, 200, false, null, 'json'>;
  'POST /api/auth/refresh': ApiEndpoint<NoInput, NoInput, RefreshTokenRequest, ApiMessageSuccess<AuthTokens>, 200, false, null, 'json'>;
  'POST /api/auth/logout': Omit<ApiEndpoint<NoInput, NoInput, LogoutRequest | undefined, ApiMessageOnly, 200, false, null, 'json'>, 'headers'> & { headers: LogoutHeaders | undefined };
  'GET /api/auth/profile': ApiEndpoint<NoInput, NoInput, NoInput, ApiSuccess<UserProfileResponse>, 200, true, null, 'none'>;
  'GET /api/auth/me': ApiEndpoint<NoInput, NoInput, NoInput, ApiSuccess<UserProfileResponse>, 200, true, null, 'none'>;
  // cohorts
  'GET /api/cohorts': ApiEndpoint<NoInput, CohorteQuery, NoInput, ApiCountSuccess<CohorteListItem>, 200, false, null, 'none'>;
  'GET /api/cohorts/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<CohorteDetail>, 200, false, null, 'none'>;
  'GET /api/cohorts/:id/componentes': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<ProgramacionDetail[]>, 200, false, null, 'none'>;
  'POST /api/cohorts': ApiEndpoint<NoInput, NoInput, CreateCohorteMultipart<F>, ApiMessageSuccess<CohorteAperturaRow>, 201, true, 'COHORTE_GESTIONAR', 'json|multipart'>;
  'PUT /api/cohorts/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateCohorteMultipart<F>, ApiMessageSuccess<CohorteAperturaRow>, 200, true, 'COHORTE_GESTIONAR', 'json|multipart'>;
  'DELETE /api/cohorts/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'COHORTE_GESTIONAR', 'none'>;
  'POST /api/cohorts/:id/componentes': ApiEndpoint<{ id: UUID }, NoInput, ProgramarComponenteRequest, ApiMessageSuccess<ProgramacionComponenteRow>, 201, true, 'COHORTE_GESTIONAR', 'json'>;
  'PUT /api/cohorts/:id/componentes/:componenteId': ApiEndpoint<{ id: UUID; componenteId: UUID }, NoInput, UpdateProgramacionRequest, ApiMessageSuccess<ProgramacionComponenteRow>, 200, true, 'COHORTE_GESTIONAR', 'json'>;
  'DELETE /api/cohorts/:id/componentes/:componenteId': ApiEndpoint<{ id: UUID; componenteId: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'COHORTE_GESTIONAR', 'none'>;
  // enrollments
  'GET /api/enrollments/me': ApiEndpoint<NoInput, Pick<ListEnrollmentsQuery, 'page' | 'limit'>, NoInput, ApiTotalSuccess<EnrollmentDetail> & { pagination: Pagination }, 200, true, null, 'none'>;
  'PATCH /api/enrollments/payments/:paymentId/validate': ApiEndpoint<{ paymentId: UUID }, NoInput, ValidatePaymentRequest, ApiMessageSuccess<ValidatePaymentResult>, 200, true, 'PAGO_VALIDAR', 'json'>;
  'PATCH /api/enrollments/convalidations/:convalidationId/dictamen': ApiEndpoint<{ convalidationId: UUID }, NoInput, DictamenConvalidationRequest, ApiMessageSuccess<SolicitudConvalidacionRow>, 200, true, 'CONVALIDACION_DICTAMINAR', 'json'>;
  'GET /api/enrollments': ApiEndpoint<NoInput, ListEnrollmentsQuery, NoInput, ApiPaginatedSuccess<EnrollmentDetail>, 200, true, 'INSCRIPCION_VALIDAR', 'none'>;
  'POST /api/enrollments': ApiEndpoint<NoInput, NoInput, CreateEnrollmentMultipart<F>, ApiMessageSuccess<EnrollmentDetail>, 201, true, null, 'json|multipart'>;
  'GET /api/enrollments/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<EnrollmentDossier | CashierEnrollmentDossier>, 200, true, null, 'none'>;
  'PATCH /api/enrollments/:id/validate-documents': ApiEndpoint<{ id: UUID }, NoInput, ValidateDocumentsRequest, ApiMessageSuccess<EnrollmentDetail>, 200, true, 'INSCRIPCION_VALIDAR', 'json'>;
  'POST /api/enrollments/:id/payments': ApiEndpoint<{ id: UUID }, NoInput, CreatePaymentMultipart<F>, ApiMessageSuccess<PagoInscripcionRow>, 201, true, null, 'json|multipart'>;
  'GET /api/enrollments/:id/payments': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<PagoInscripcionRow[]>, 200, true, null, 'none'>;
  'POST /api/enrollments/:id/convalidations': ApiEndpoint<{ id: UUID }, NoInput, CreateConvalidationMultipart<F>, ApiMessageSuccess<SolicitudConvalidacionRow>, 201, true, null, 'json|multipart'>;
  'GET /api/enrollments/:id/convalidations': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<ConvalidationDetail[]>, 200, true, null, 'none'>;
  // grades
  'POST /api/grades/import/:programacionComponenteId': ApiEndpoint<{ programacionComponenteId: UUID }, NoInput, ImportGradesMultipart<F>, ApiMessageSuccess<ImportGradesResult>, 201, true, 'NOTA_IMPORTAR', 'multipart'>;
  'PATCH /api/grades/:matriculaComponenteId': ApiEndpoint<{ matriculaComponenteId: UUID }, NoInput, ModifyGradeRequest, ApiMessageSuccess<ModifyGradeResult>, 200, true, 'NOTA_MODIFICAR', 'json'>;
  'GET /api/grades/component/:programacionComponenteId': ApiEndpoint<{ programacionComponenteId: UUID }, NoInput, NoInput, ApiSuccess<ComponentGrade[]>, 200, true, null, 'none'>;
  'GET /api/grades/lots/:programacionComponenteId': ApiEndpoint<{ programacionComponenteId: UUID }, NoInput, NoInput, ApiSuccess<ImportLot[]>, 200, true, null, 'none'>;
  'GET /api/grades/student/:inscripcionId': ApiEndpoint<{ inscripcionId: UUID }, NoInput, NoInput, ApiSuccess<StudentGrade[]>, 200, true, null, 'none'>;
  'GET /api/grades/:matriculaComponenteId/logs': ApiEndpoint<{ matriculaComponenteId: UUID }, NoInput, NoInput, ApiSuccess<GradeLog[]>, 200, true, null, 'none'>;
  // graduation
  'GET /api/graduation/verify/:codigoRegistro': ApiEndpoint<{ codigoRegistro: string }, NoInput, NoInput, ApiSuccess<PublicGraduationVerification>, 200, false, null, 'none'>;
  'POST /api/graduation/expediente': ApiEndpoint<NoInput, NoInput, CreateExpedienteMultipart<F>, ApiMessageSuccess<ExpedienteGraduacionRow>, 201, true, 'TITULO_EMITIR', 'json|multipart'>;
  'GET /api/graduation/expediente/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<GraduationDetail>, 200, true, null, 'none'>;
  'GET /api/graduation/enrollment/:inscripcionId': ApiEndpoint<{ inscripcionId: UUID }, NoInput, NoInput, ApiSuccess<GraduationDetail>, 200, true, null, 'none'>;
  'PATCH /api/graduation/expediente/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateExpedienteMultipart<F>, ApiMessageSuccess<ExpedienteGraduacionRow | null>, 200, true, 'TITULO_EMITIR', 'json|multipart'>;
  'POST /api/graduation/expediente/:expedienteId/publications': ApiEndpoint<{ expedienteId: UUID }, NoInput, CreatePublicationMultipart<F>, ApiMessageSuccess<PublicacionCientificaRow>, 201, true, null, 'multipart'>;
  'GET /api/graduation/expediente/:expedienteId/publications': ApiEndpoint<{ expedienteId: UUID }, NoInput, NoInput, ApiSuccess<PublicacionCientificaRow[]>, 200, true, null, 'none'>;
  'PATCH /api/graduation/publications/:publicationId/validate': ApiEndpoint<{ publicationId: UUID }, NoInput, ValidatePublicationRequest, ApiMessageSuccess<PublicacionCientificaRow | null>, 200, true, 'TITULO_EMITIR', 'json'>;
  'POST /api/graduation/expediente/:id/issue': ApiEndpoint<{ id: UUID }, NoInput, IssueDocumentMultipart<F>, ApiMessageSuccess<IssueDocumentResult>, 200, true, 'TITULO_EMITIR', 'json|multipart'>;
  // infrastructure
  'GET /api/infrastructure/sedes': ApiEndpoint<NoInput, AllQuery, NoInput, ApiSuccess<SedeIesRow[]>, 200, false, null, 'none'>;
  'GET /api/infrastructure/sedes/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<SedeIesRow>, 200, false, null, 'none'>;
  'POST /api/infrastructure/sedes': ApiEndpoint<NoInput, NoInput, CreateSedeRequest, ApiMessageSuccess<SedeIesRow>, 201, true, 'SEDE_GESTIONAR', 'json'>;
  'PUT /api/infrastructure/sedes/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateSedeRequest, ApiMessageSuccess<SedeIesRow>, 200, true, 'SEDE_GESTIONAR', 'json'>;
  'DELETE /api/infrastructure/sedes/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'SEDE_GESTIONAR', 'none'>;
  'GET /api/infrastructure/docentes': ApiEndpoint<NoInput, AllQuery, NoInput, ApiSuccess<DocenteDetail[]>, 200, false, null, 'none'>;
  'GET /api/infrastructure/docentes/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<DocenteDetail>, 200, false, null, 'none'>;
  'POST /api/infrastructure/docentes': ApiEndpoint<NoInput, NoInput, CreateDocenteMultipart<F>, ApiMessageSuccess<PersonalAcademicoRow>, 201, true, 'DOCENTE_GESTIONAR', 'json|multipart'>;
  'PUT /api/infrastructure/docentes/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateDocenteMultipart<F>, ApiMessageSuccess<PersonalAcademicoRow>, 200, true, 'DOCENTE_GESTIONAR', 'json|multipart'>;
  'DELETE /api/infrastructure/docentes/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'DOCENTE_GESTIONAR', 'none'>;
  // programs
  'GET /api/programs/catalog': ApiEndpoint<NoInput, CatalogQuery, NoInput, ApiCountSuccess<ProgramCatalogItem>, 200, false, null, 'none'>;
  'GET /api/programs/recommendations/:aspiranteId': ApiEndpoint<{ aspiranteId: UUID }, NoInput, NoInput, ApiCountSuccess<ProgramRecommendationItem>, 200, false, null, 'none'>;
  'GET /api/programs/slug/:slug': ApiEndpoint<{ slug: string }, NoInput, NoInput, ApiSuccess<ProgramDetail>, 200, false, null, 'none'>;
  'GET /api/programs': ApiEndpoint<NoInput, ListProgramsQuery, NoInput, ApiSuccess<ProgramListItem[]>, 200, false, null, 'none'>;
  'GET /api/programs/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<ProgramDetail>, 200, false, null, 'none'>;
  'GET /api/programs/:id/componentes': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<ComponenteCurricularRow[]>, 200, false, null, 'none'>;
  'POST /api/programs': ApiEndpoint<NoInput, NoInput, CreateProgramMultipart<F>, ApiMessageSuccess<ProgramaAcademicoRow>, 201, true, 'CATALOGO_GESTIONAR', 'json|multipart'>;
  'PUT /api/programs/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateProgramMultipart<F>, ApiMessageSuccess<ProgramaAcademicoRow>, 200, true, 'CATALOGO_GESTIONAR', 'json|multipart'>;
  'DELETE /api/programs/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'CATALOGO_GESTIONAR', 'none'>;
  'POST /api/programs/:id/tags': ApiEndpoint<{ id: UUID }, NoInput, AssignTagsRequest, ApiMessageOnly, 200, true, 'CATALOGO_GESTIONAR', 'json'>;
  'POST /api/programs/:id/componentes': ApiEndpoint<{ id: UUID }, NoInput, CreateComponenteMultipart<F>, ApiMessageSuccess<ComponenteCurricularRow>, 201, true, 'CATALOGO_GESTIONAR', 'json|multipart'>;
  'PUT /api/programs/:id/componentes/:componenteId': ApiEndpoint<{ id: UUID; componenteId: UUID }, NoInput, UpdateComponenteMultipart<F>, ApiMessageSuccess<ComponenteCurricularRow>, 200, true, 'CATALOGO_GESTIONAR', 'json|multipart'>;
  'DELETE /api/programs/:id/componentes/:componenteId': ApiEndpoint<{ id: UUID; componenteId: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'CATALOGO_GESTIONAR', 'none'>;
  // taxonomy
  'GET /api/taxonomy/areas': ApiEndpoint<NoInput, AllQuery, NoInput, ApiSuccess<AreaConocimientoRow[]>, 200, false, null, 'none'>;
  'GET /api/taxonomy/areas/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<AreaConocimientoRow>, 200, false, null, 'none'>;
  'GET /api/taxonomy/tags': ApiEndpoint<NoInput, NoInput, NoInput, ApiSuccess<TagAcademicoRow[]>, 200, false, null, 'none'>;
  'GET /api/taxonomy/tags/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiSuccess<TagAcademicoRow>, 200, false, null, 'none'>;
  'POST /api/taxonomy/areas': ApiEndpoint<NoInput, NoInput, CreateAreaRequest, ApiMessageSuccess<AreaConocimientoRow>, 201, true, 'CATALOGO_GESTIONAR', 'json'>;
  'PUT /api/taxonomy/areas/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateAreaRequest, ApiMessageSuccess<AreaConocimientoRow>, 200, true, 'CATALOGO_GESTIONAR', 'json'>;
  'DELETE /api/taxonomy/areas/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'CATALOGO_GESTIONAR', 'none'>;
  'POST /api/taxonomy/tags': ApiEndpoint<NoInput, NoInput, CreateTagRequest, ApiMessageSuccess<TagAcademicoRow>, 201, true, 'CATALOGO_GESTIONAR', 'json'>;
  'PUT /api/taxonomy/tags/:id': ApiEndpoint<{ id: UUID }, NoInput, UpdateTagRequest, ApiMessageSuccess<TagAcademicoRow>, 200, true, 'CATALOGO_GESTIONAR', 'json'>;
  'DELETE /api/taxonomy/tags/:id': ApiEndpoint<{ id: UUID }, NoInput, NoInput, ApiMessageOnly, 200, true, 'CATALOGO_GESTIONAR', 'none'>;
}
export type ApiEndpointKey = keyof ApiEndpointMap;
export type ApiEndpointBody<K extends ApiEndpointKey, F = UploadDescriptor> = ApiEndpointMap<F>[K]['body'];
export type ApiEndpointSuccess<K extends ApiEndpointKey> = ApiEndpointMap[K]['success'];
// =============================================================================
// Salida del validador (para comparar con entrada HTTP, NO enviar estos defaults).
// =============================================================================
export type Override<T, U> = Omit<T, keyof U> & U;
export type ParsedCreateAreaInput = Override<CreateAreaRequest, { activa: boolean }>;
export type ParsedUpdateAreaInput = UpdateAreaRequest;
export type ParsedCreateTagInput = CreateTagRequest;
export type ParsedUpdateTagInput = UpdateTagRequest;
export type ParsedCreateSedeInput = Override<CreateSedeRequest, { activa: boolean }>;
export type ParsedUpdateSedeInput = UpdateSedeRequest;
export type ParsedCreateDocenteInput = Override<CreateDocenteRequest, { activo: boolean }>;
export type ParsedUpdateDocenteInput = Override<UpdateDocenteRequest, { activo?: boolean }>;
export interface ParsedProgramCoercions {
  precio_total_referencia: number; descuento_porcentaje: number; visible_en_web: boolean;
  es_ciencias_salud: boolean; duracion_meses?: number; horas_totales: number; creditos_totales: number;
  creditos_investigacion: number; permite_continuidad_doctorado: boolean;
  programa_salida_intermedia_id: UUID | null; programa_destino_acreditable_id: UUID | null;
  es_acreditable_a_posgrado: boolean; estructurado_por_cursos: boolean; requiere_titulo_grado_rn: boolean;
  requiere_titulo_profesional: boolean; permite_menores_edad: boolean; idioma_egreso_requerido: NivelIdiomaMcer;
  num_publicaciones_requeridas: number; requiere_revista_indexada: boolean; requiere_pares_evaluadores: boolean;
  estado_vigencia: EstadoVigenciaPrograma;
}
export type ParsedCreateProgramInput = Override<CreateProgramRequest, ParsedProgramCoercions>;
/** Defaults z.enum().default() sobreviven a partial() en el Zod instalado. */
export type ParsedUpdateProgramInput = Partial<ParsedCreateProgramInput> &
  Pick<ParsedCreateProgramInput, 'idioma_egreso_requerido' | 'estado_vigencia'>;
export interface ParsedComponenteCoercions {
  orden_bloque: number; horas: number; creditos: number; es_investigacion: boolean;
  es_modalidad_graduacion: boolean; es_practica_profesional: boolean; costo_base_asignatura: number;
}
export type ParsedCreateComponenteInput = Override<CreateComponenteRequest, ParsedComponenteCoercions>;
export type ParsedUpdateComponenteInput = Partial<ParsedCreateComponenteInput>;
export interface ParsedCohorteCoercions {
  numero_edicion: number; precio_matricula: number; precio_total_cohorte: number; descuento_porcentaje: number;
  cupo_minimo: number; cupo_maximo: number; tiene_excepcion_cupo_setec: boolean; estado_cohorte: EstadoCohorte;
}
export type ParsedCreateCohorteInput = Override<CreateCohorteRequest, ParsedCohorteCoercions>;
export type ParsedUpdateCohorteInput = Partial<ParsedCreateCohorteInput> & {
  estado_cohorte: EstadoCohorte; cupos_actuales_verificados?: number; cobro_habilitado?: boolean;
  informe_evaluacion_cohorte_url?: string | null;
};
export type ParsedProgramarComponenteInput = Override<ProgramarComponenteRequest,
  { docente_titular_id: UUID | null; actas_notas_cerradas: boolean }>;
export type ParsedUpdateProgramacionInput = Partial<ParsedProgramarComponenteInput>;
export type ParsedCreateApplicantProfileInput = Override<CreateApplicantProfileRequest,
  { tiene_discapacidad: boolean; intereses_areas_ids: UUID[] }>;
export type ParsedUpdateApplicantProfileInput = Override<UpdateApplicantProfileRequest,
  { tiene_discapacidad?: boolean; intereses_areas_ids: UUID[] }>;
export type ParsedCreateAcademicDegreeInput = Override<CreateAcademicDegreeRequest,
  { inscrito_registro_nacional: boolean; porcentaje_creditos_investigacion?: number }>;
export type ParsedUpdateAcademicDegreeInput = Override<UpdateAcademicDegreeRequest,
  { inscrito_registro_nacional?: boolean; porcentaje_creditos_investigacion?: number }>;
export type ParsedListApplicantsQueryInput = Override<ListApplicantsQuery,
  { identidad_verificada?: boolean; limit?: number; offset?: number }>;
export type ParsedCreateEnrollmentInput = Override<CreateEnrollmentRequest, {
  rol_participacion: RolParticipacionEp; es_reingreso_cambio_plan: boolean;
  requiere_nivelacion_investigativa: boolean; acepta_compromiso_idioma_y_publicacion: boolean;
}>;
export type ParsedValidateDocumentsInput = Override<ValidateDocumentsRequest, { aprobado: boolean }>;
export type ParsedCreatePaymentInput = Override<CreatePaymentRequest,
  { monto_subtotal: string; descuento_aplicado: string; total_pagado: string }>;
export type ParsedCreateConvalidationInput = Override<CreateConvalidationRequest, { creditos_reconocidos: number }>;
export type ParsedListEnrollmentsQueryInput = Override<ListEnrollmentsQuery, { page?: number; limit?: number }>;
export type ParsedCreateExpedienteInput = Override<CreateExpedienteRequest,
  { nivel_idioma_alcanzado: NivelIdiomaMcer; aplico_salida_intermedia: boolean }>;
export type ParsedUpdateExpedienteInput = Override<UpdateExpedienteRequest,
  { idioma_validado?: boolean; aplico_salida_intermedia?: boolean }>;
export type ParsedCreatePublicationInput = Override<CreatePublicationRequest,
  { es_revista_indexada: boolean; tiene_revision_pares: boolean }>;

/** Seed defaults; the API checks current account, session, role and permissions on every protected request. */
export const SEEDED_ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    'USUARIO_GESTIONAR',
    'SEDE_GESTIONAR',
    'DOCENTE_GESTIONAR',
    'CATALOGO_GESTIONAR',
    'COHORTE_GESTIONAR',
    'INSCRIPCION_VALIDAR',
    'PAGO_VALIDAR',
    'CONVALIDACION_DICTAMINAR',
    'NOTA_IMPORTAR',
    'NOTA_MODIFICAR',
    'TITULO_EMITIR',
  ],
  COORDINADOR: [
    'SEDE_GESTIONAR',
    'DOCENTE_GESTIONAR',
    'CATALOGO_GESTIONAR',
    'COHORTE_GESTIONAR',
    'INSCRIPCION_VALIDAR',
    'CONVALIDACION_DICTAMINAR',
    'NOTA_IMPORTAR',
    'NOTA_MODIFICAR',
    'TITULO_EMITIR',
  ],
  CAJERO: ['PAGO_VALIDAR'],
  DOCENTE: ['NOTA_IMPORTAR'],
  ESTUDIANTE: [],
} as const satisfies { [R in RolNombre]: readonly PermisoCodigo[] };

/** Nueve ENUM PostgreSQL; los otros doce dominios const corresponden a CHECK de VARCHAR. */
export interface PostgresEnumTypes {
  categoria_programa_enum: CategoriaPrograma;
  subtipo_programa_enum: SubtipoPrograma;
  modalidad_educativa_enum: ModalidadEducativa;
  nivel_idioma_mcer_enum: NivelIdiomaMcer;
  estado_inscripcion_enum: EstadoInscripcion;
  rol_participacion_ep_enum: RolParticipacionEp;
  escala_cualitativa_snepa_enum: EscalaCualitativaSnepa;
  metodo_pago_enum: MetodoPago;
  estado_pago_enum: EstadoPago;
}

export type ApiEndpointParams<K extends ApiEndpointKey> = ApiEndpointMap[K]['params'];
export type ApiEndpointQuery<K extends ApiEndpointKey> = ApiEndpointMap[K]['query'];
export type ApiEndpointResponse<K extends ApiEndpointKey> = ApiEndpointMap[K]['response'];


/** Academic billing: monetary responses and new requests use exact decimal strings. */
export interface BillingStudent { id: UUID; nombres: string; apellidos: string; tipo_identificacion: TipoIdentificacion; identificacion_terminacion: string }
export interface BillingStudentsQuery { search?: string; page?: number; limit?: number }
export interface BillingStudentsResponse { success: true; data: BillingStudent[]; pagination: { total: number; page: number; limit: number; totalPages: number } }
export type BillingMode = 'GRATUITO' | 'PAGO_UNICO' | 'CUOTAS' | 'MODULOS';
export interface BillingInstallment { concepto: string; importe: string; fecha_vencimiento?: DateOnly | null; componente_id?: UUID | null }
export interface BillingPlanRequest { nombre: string; modalidad: BillingMode; predeterminado?: boolean; monto_matricula: string; precio_academico: string; cuotas: BillingInstallment[] }
export interface BillingPlan extends BillingPlanRequest { id: UUID; cohorte_id: UUID; version: number; creado_en: DateTime }
export interface BillingAllocation { obligacion_id: UUID; importe: string }
export interface BillingCollectRequest { clave_idempotencia: string; metodo_pago: Exclude<MetodoPago, 'PASARELA_ONLINE'>; numero_referencia_o_recibo: string; banco_origen?: string | null; fecha_pago_reportada?: string; aplicaciones: BillingAllocation[] }
export interface BillingObligation { id: UUID; acuerdo_id: UUID; inscripcion_id: UUID; numero: number; tipo: 'MATRICULA' | 'ACADEMICO'; concepto: string; importe: string; fecha_vencimiento: DateOnly | null; componente_id: UUID | null; anulada_en: DateTime | null; pagado: string; en_revision: string; saldo: string; disponible: string; estado: 'PENDIENTE' | 'PARCIALMENTE_PAGADO' | 'PAGADO' | 'VENCIDO' | 'ANULADO' }
export interface BillingReceipt { id: UUID; numero: string; pago_id: UUID; inscripcion_id?: UUID; emitido_en: DateTime; anulado_en: DateTime | null; motivo_anulacion?: string | null; total: string }
export interface BillingAgreement { id: UUID; inscripcion_id: UUID; plan_id: UUID | null; nombre_plan: string; modalidad: BillingMode; monto_matricula: string; precio_academico: string; aceptado_en: DateTime }
export interface BillingAccount { inscripcion: Pick<EnrollmentDetail, 'id' | 'codigo_expediente' | 'estado' | 'cohorte_id' | 'programa_id' | 'programa_nombre' | 'cohorte_codigo' | 'aspirante_nombres' | 'aspirante_apellidos' | 'cobro_habilitado'>; acuerdo: BillingAgreement | null; obligaciones: BillingObligation[]; pagos: PagoInscripcionRow[]; requiere_conciliacion: boolean; comprobantes: BillingReceipt[]; resumen: { monto_matricula: string | null; costo_academico: string | null; total_comprometido: string | null; total_pagado: string; saldo_pendiente: string | null; matricula_pendiente: string | null; en_revision: string; importe_anulado: string; vencido: string | null; obligaciones_vencidas: number; proximo_vencimiento: DateOnly | null } }
export interface BillingCollectResult { pago: PagoInscripcionRow; comprobante: BillingReceipt | null; reintento: boolean }
export interface ApiEndpointMap<F = UploadDescriptor> {
  'GET /api/billing/students': ApiEndpoint<NoInput, BillingStudentsQuery, NoInput, BillingStudentsResponse, 200, true, 'PAGO_VALIDAR' | 'INSCRIPCION_VALIDAR'>;
  'GET /api/billing/cohorts/:id/plans': ApiEndpoint<IdParam, NoInput, NoInput, ApiSuccess<BillingPlan[]>, 200, true, 'COHORTE_GESTIONAR' | 'INSCRIPCION_VALIDAR' | 'PAGO_VALIDAR'>;
  'POST /api/billing/cohorts/:id/plans': ApiEndpoint<IdParam, NoInput, BillingPlanRequest, ApiSuccess<BillingPlan>, 200, true, 'COHORTE_GESTIONAR', 'json'>;
  'GET /api/billing/enrollments/:id/account': ApiEndpoint<IdParam, NoInput, NoInput, ApiSuccess<BillingAccount>, 200, true>;
  'POST /api/billing/enrollments/:id/plan': ApiEndpoint<IdParam, NoInput, {plan_id: UUID}, ApiSuccess<{inscripcion_id: UUID; plan_id: UUID}>, 200, true, 'INSCRIPCION_VALIDAR', 'json'>;
  'POST /api/billing/enrollments/:id/accept': ApiEndpoint<IdParam, NoInput, {plan_id?: UUID; motivo?: string}, ApiSuccess<BillingAgreement>, 200, true, 'INSCRIPCION_VALIDAR', 'json'>;
  'POST /api/billing/enrollments/:id/activate': ApiEndpoint<IdParam, NoInput, {motivo: string}, ApiSuccess<InscripcionRow>, 200, true, 'INSCRIPCION_VALIDAR', 'json'>;
  'POST /api/billing/enrollments/:id/payments': ApiEndpoint<IdParam, NoInput, BillingCollectRequest, ApiSuccess<BillingCollectResult>, 200, true, 'PAGO_VALIDAR', 'json'>;
  'POST /api/billing/enrollments/:id/payments/:paymentId/cancel': ApiEndpoint<IdParam & PaymentIdParam, NoInput, {motivo: string}, ApiSuccess<PagoInscripcionRow>, 200, true, 'PAGO_ANULAR', 'json'>;
  'POST /api/billing/enrollments/:id/obligations/:obligationId/cancel': ApiEndpoint<IdParam & {obligationId: UUID}, NoInput, {motivo: string}, ApiSuccess<BillingObligation>, 200, true, 'OBLIGACION_ANULAR', 'json'>;
  'GET /api/billing/enrollments/:id/receipts/:receiptId.pdf': ApiEndpoint<IdParam & {receiptId: UUID}, NoInput, NoInput, CertificatePdfDownload, 200, true>;
}
