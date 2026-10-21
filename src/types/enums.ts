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

