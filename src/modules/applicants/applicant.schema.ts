import { z } from 'zod';
import {
  TipoIdentificacion,
  NivelTitulo,
  EstadoValidacionTitulo,
} from '../../types/enums';

const tipoIdentificacionEnum = z.enum([
  TipoIdentificacion.CEDULA,
  TipoIdentificacion.PASAPORTE,
  TipoIdentificacion.CEDULA_RESIDENCIA,
  TipoIdentificacion.PARTIDA_NACIMIENTO,
]);

const nivelTituloEnum = z.enum([
  NivelTitulo.TECNICO_SUPERIOR,
  NivelTitulo.GRADO,
  NivelTitulo.ESPECIALIDAD,
  NivelTitulo.MAESTRIA,
  NivelTitulo.DOCTORADO,
  NivelTitulo.CARTA_EGRESADO,
]);

const estadoValidacionTituloEnum = z.enum([
  EstadoValidacionTitulo.PENDIENTE,
  EstadoValidacionTitulo.VALIDADO,
  EstadoValidacionTitulo.RECHAZADO,
]);

const booleanPreprocessor = (defaultValue = false) =>
  z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    if (typeof val === 'boolean') return val;
    return defaultValue;
  }, z.boolean());

const optionalBooleanPreprocessor = () =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    if (typeof val === 'boolean') return val;
    return undefined;
  }, z.boolean().optional());

const numberPreprocessor = () =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    if (typeof val === 'number') return val;
    return undefined;
  }, z.number().optional());

const jsonArrayPreprocessor = () =>
  z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, z.array(z.string().uuid('Identificador de área inválido')).optional().default([]));

// ==========================================
// APPLICANT PROFILE SCHEMAS
// ==========================================

export const createApplicantProfileSchema = z.object({
  usuario_id: z.string().uuid('ID de usuario debe ser UUID válido').optional(),
  tipo_identificacion: tipoIdentificacionEnum,
  numero_identificacion: z
    .string()
    .trim()
    .min(3, 'El número de identificación debe tener al menos 3 caracteres')
    .max(40, 'El número de identificación no puede superar 40 caracteres'),
  nombres: z
    .string()
    .trim()
    .min(2, 'Los nombres deben tener al menos 2 caracteres')
    .max(100, 'Los nombres no pueden superar 100 caracteres'),
  apellidos: z
    .string()
    .trim()
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden superar 100 caracteres'),
  fecha_nacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  email: z
    .string()
    .email('Formato de correo electrónico inválido')
    .max(150, 'El correo electrónico no puede superar 150 caracteres'),
  telefono: z
    .string()
    .trim()
    .min(5, 'El teléfono debe tener al menos 5 caracteres')
    .max(30, 'El teléfono no puede superar 30 caracteres'),
  cedula_identidad_pdf_url: z.string().optional().nullable(),
  tiene_discapacidad: booleanPreprocessor(false),
  descripcion_ajuste_razonable: z.string().trim().optional().nullable(),
  tutor_nombre_completo: z.string().trim().max(200).optional().nullable(),
  tutor_identificacion: z.string().trim().max(40).optional().nullable(),
  tutor_documento_url: z.string().optional().nullable(),
  intereses_areas_ids: jsonArrayPreprocessor(),
});

export const updateApplicantProfileSchema = z.object({
  tipo_identificacion: tipoIdentificacionEnum.optional(),
  numero_identificacion: z
    .string()
    .trim()
    .min(3, 'El número de identificación debe tener al menos 3 caracteres')
    .max(40, 'El número de identificación no puede superar 40 caracteres')
    .optional(),
  nombres: z
    .string()
    .trim()
    .min(2, 'Los nombres deben tener al menos 2 caracteres')
    .max(100, 'Los nombres no pueden superar 100 caracteres')
    .optional(),
  apellidos: z
    .string()
    .trim()
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden superar 100 caracteres')
    .optional(),
  fecha_nacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  email: z
    .string()
    .email('Formato de correo electrónico inválido')
    .max(150, 'El correo electrónico no puede superar 150 caracteres')
    .optional(),
  telefono: z
    .string()
    .trim()
    .min(5, 'El teléfono debe tener al menos 5 caracteres')
    .max(30, 'El teléfono no puede superar 30 caracteres')
    .optional(),
  cedula_identidad_pdf_url: z.string().optional().nullable(),
  tiene_discapacidad: optionalBooleanPreprocessor(),
  descripcion_ajuste_razonable: z.string().trim().optional().nullable(),
  tutor_nombre_completo: z.string().trim().max(200).optional().nullable(),
  tutor_identificacion: z.string().trim().max(40).optional().nullable(),
  tutor_documento_url: z.string().optional().nullable(),
  intereses_areas_ids: jsonArrayPreprocessor(),
});

export const replaceInterestsSchema = z.object({
  area_conocimiento_ids: z.array(
    z.string().uuid('Cada área de conocimiento debe ser un UUID válido')
  ),
});

// ==========================================
// ACADEMIC DEGREES SCHEMAS
// ==========================================

export const createAcademicDegreeSchema = z.object({
  area_conocimiento_id: z.string().uuid('ID de área de conocimiento debe ser UUID válido').optional().nullable(),
  nivel_titulo: nivelTituloEnum,
  denominacion_titulo: z
    .string()
    .trim()
    .min(2, 'La denominación debe tener al menos 2 caracteres')
    .max(200, 'La denominación no puede superar 200 caracteres'),
  institucion_emisora: z
    .string()
    .trim()
    .min(2, 'La institución emisora debe tener al menos 2 caracteres')
    .max(200, 'La institución emisora no puede superar 200 caracteres'),
  fecha_emision: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  inscrito_registro_nacional: booleanPreprocessor(false),
  codigo_registro_nacional: z.string().trim().max(80).optional().nullable(),
  certificado_rn_url: z.string().optional().nullable(),
  titulo_pdf_url: z.string().optional().nullable(),
  porcentaje_creditos_investigacion: numberPreprocessor(),
});

export const updateAcademicDegreeSchema = z.object({
  area_conocimiento_id: z.string().uuid('ID de área de conocimiento debe ser UUID válido').optional().nullable(),
  nivel_titulo: nivelTituloEnum.optional(),
  denominacion_titulo: z
    .string()
    .trim()
    .min(2, 'La denominación debe tener al menos 2 caracteres')
    .max(200, 'La denominación no puede superar 200 caracteres')
    .optional(),
  institucion_emisora: z
    .string()
    .trim()
    .min(2, 'La institución emisora debe tener al menos 2 caracteres')
    .max(200, 'La institución emisora no puede superar 200 caracteres')
    .optional(),
  fecha_emision: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  inscrito_registro_nacional: optionalBooleanPreprocessor(),
  codigo_registro_nacional: z.string().trim().max(80).optional().nullable(),
  certificado_rn_url: z.string().optional().nullable(),
  titulo_pdf_url: z.string().optional().nullable(),
  porcentaje_creditos_investigacion: numberPreprocessor(),
}).strict();

export const validateAcademicDegreeSchema = z.object({
  estado_validacion: estadoValidacionTituloEnum,
  observacion_rechazo: z.string().trim().optional().nullable(),
}).refine(
  (data) => {
    if (data.estado_validacion === EstadoValidacionTitulo.RECHAZADO) {
      return !!data.observacion_rechazo && data.observacion_rechazo.trim().length > 0;
    }
    return true;
  },
  {
    message: 'Es obligatorio ingresar la observación de rechazo cuando el estado es RECHAZADO',
    path: ['observacion_rechazo'],
  }
);

// ==========================================
// PARAMS & QUERY SCHEMAS
// ==========================================

export const applicantIdParamSchema = z.object({
  id: z.string().uuid('Identificador de aspirante inválido (UUID requerido)'),
});

export const degreeIdParamSchema = z.object({
  degreeId: z.string().uuid('Identificador de título inválido (UUID requerido)'),
});

export const applicantDegreeParamSchema = z.object({
  id: z.string().uuid('Identificador de aspirante inválido (UUID requerido)'),
  degreeId: z.string().uuid('Identificador de título inválido (UUID requerido)'),
});

export const listApplicantsQuerySchema = z.object({
  identidad_verificada: optionalBooleanPreprocessor(),
  search: z.string().trim().optional(),
  limit: numberPreprocessor(),
  offset: numberPreprocessor(),
});

// Infer TypeScript Types
export type CreateApplicantProfileInput = z.infer<typeof createApplicantProfileSchema>;
export type UpdateApplicantProfileInput = z.infer<typeof updateApplicantProfileSchema>;
export type ReplaceInterestsInput = z.infer<typeof replaceInterestsSchema>;
export type CreateAcademicDegreeInput = z.infer<typeof createAcademicDegreeSchema>;
export type UpdateAcademicDegreeInput = z.infer<typeof updateAcademicDegreeSchema>;
export type ValidateAcademicDegreeInput = z.infer<typeof validateAcademicDegreeSchema>;
export type ListApplicantsQueryInput = z.infer<typeof listApplicantsQuerySchema>;
