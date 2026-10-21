import { z } from 'zod';
import {
  NivelIdiomaMcer,
  TipoDocumentoFinal,
  TipoPublicacionCientifica,
  AlcancePublicacion,
} from '../../types/enums';

// UUID Parameters
export const expedienteIdParamSchema = z.object({
  id: z.string().uuid({ message: 'ID de expediente inválido' }),
});
export type ExpedienteIdParamInput = z.infer<typeof expedienteIdParamSchema>;

export const inscripcionIdParamSchema = z.object({
  inscripcionId: z.string().uuid({ message: 'ID de inscripción inválido' }),
});
export type InscripcionIdParamInput = z.infer<typeof inscripcionIdParamSchema>;

export const publicationIdParamSchema = z.object({
  publicationId: z.string().uuid({ message: 'ID de publicación científica inválido' }),
});
export type PublicationIdParamInput = z.infer<typeof publicationIdParamSchema>;

export const verifyCodeParamSchema = z.object({
  codigoRegistro: z.string().min(1, { message: 'El código de registro de título es obligatorio' }),
});
export type VerifyCodeParamInput = z.infer<typeof verifyCodeParamSchema>;

// Expediente Schemas
export const createExpedienteSchema = z.object({
  inscripcion_id: z.string().uuid({ message: 'ID de inscripción requerido' }),
  tipo_documento_final: z.nativeEnum(TipoDocumentoFinal, {
    error: () => ({ message: 'Tipo de documento final inválido' }),
  }),
  idioma_acreditado: z.string().optional(),
  nivel_idioma_alcanzado: z.nativeEnum(NivelIdiomaMcer).default(NivelIdiomaMcer.NINGUNO),
  institucion_aval_idioma: z.string().optional(),
  modalidad_graduacion_tipo: z.string().optional(),
  titulo_trabajo_graduacion: z.string().optional(),
  aplico_salida_intermedia: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .default(false),
});
export type CreateExpedienteInput = z.infer<typeof createExpedienteSchema>;

export const updateExpedienteSchema = z.object({
  idioma_acreditado: z.string().optional(),
  nivel_idioma_alcanzado: z.nativeEnum(NivelIdiomaMcer).optional(),
  institucion_aval_idioma: z.string().optional(),
  idioma_validado: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .optional(),
  modalidad_graduacion_tipo: z.string().optional(),
  titulo_trabajo_graduacion: z.string().optional(),
  aplico_salida_intermedia: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .optional(),
  tipo_documento_final: z.nativeEnum(TipoDocumentoFinal).optional(),
});
export type UpdateExpedienteInput = z.infer<typeof updateExpedienteSchema>;

// Scientific Publication Schemas
export const createPublicationSchema = z.object({
  tipo_publicacion: z.nativeEnum(TipoPublicacionCientifica, {
    error: () => ({ message: 'Tipo de publicación inválido (ENSAYO o ARTICULO_CIENTIFICO)' }),
  }),
  titulo_publicacion: z
    .string()
    .min(3, { message: 'El título de la publicación debe tener al menos 3 caracteres' }),
  nombre_revista_o_medio: z
    .string()
    .min(2, { message: 'El nombre de la revista o medio es obligatorio' }),
  es_revista_indexada: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .default(false),
  tiene_revision_pares: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .default(false),
  alcance: z.nativeEnum(AlcancePublicacion).optional(),
  url_o_doi: z
    .string()
    .min(3, { message: 'La URL o DOI de la publicación es obligatoria' }),
});
export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;

export const validatePublicationSchema = z.object({
  validado_coordinacion: z.boolean({
    message: 'El estado de validación debe ser un booleano (true o false)',
  }),
});
export type ValidatePublicationInput = z.infer<typeof validatePublicationSchema>;

// Issue Final Document Schema
export const issueDocumentSchema = z.object({
  codigo_registro_titulo_emitido: z.string().optional(),
  documento_final_url: z.string().optional(),
  fecha_emision: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de emisión debe tener formato YYYY-MM-DD' })
    .optional(),
  tipo_documento_final: z.nativeEnum(TipoDocumentoFinal).optional(),
});
export type IssueDocumentInput = z.infer<typeof issueDocumentSchema>;
