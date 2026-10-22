import { moneyInput, allocationsInput } from '../billing/billing.schema';
import { cents } from '../billing/billing.money';
import { z } from 'zod';
import {
  EstadoInscripcion,
  RolParticipacionEp,
  MetodoPago,
  EstadoPago,
  TipoOrigenConvalidacion,
  EstadoDictamenConvalidacion,
} from '../../types/enums';

// Helper for parsing booleans in multipart/form-data
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

// Helper for parsing numbers in multipart/form-data
const numberPreprocessor = (defaultValue = 0) =>
  z.preprocess((val) => {
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    if (typeof val === 'number') return val;
    return defaultValue;
  }, z.number());

// ==========================================
// SCHEMAS FOR ENROLLMENTS (INSCRIPCIONES)
// ==========================================

export const createEnrollmentSchema = z.object({
  aspirante_id: z.string().uuid().optional(),
  cohorte_id: z.string().uuid(),
  titulo_presentado_id: z.string().uuid().optional().nullable(),
  rol_participacion: z
    .nativeEnum(RolParticipacionEp)
    .default(RolParticipacionEp.ESTUDIANTE_EVALUADO),
  titulo_ponencia: z.string().max(250).optional().nullable(),
  resumen_ponencia: z.string().optional().nullable(),
  archivo_ponencia_url: z.string().optional().nullable(),
  es_reingreso_cambio_plan: booleanPreprocessor(false),
  inscripcion_origen_id: z.string().uuid().optional().nullable(),
  requiere_nivelacion_investigativa: booleanPreprocessor(false),
  acepta_compromiso_idioma_y_publicacion: booleanPreprocessor(false),
  observaciones_administracion: z.string().optional().nullable(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

export const validateDocumentsSchema = z.object({
  aprobado: z.preprocess((value) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return value;
  }, z.boolean().default(true)),
  observaciones_administracion: z.string().optional().nullable(),
});

export type ValidateDocumentsInput = z.infer<typeof validateDocumentsSchema>;

// ==========================================
// SCHEMAS FOR PAYMENTS (PAGOS_INSCRIPCION)
// ==========================================

export const createPaymentSchema = z.object({
  metodo_pago: z.nativeEnum(MetodoPago),
  numero_referencia_o_recibo: z.string().min(1, 'El número de referencia o recibo es obligatorio').max(100),
  banco_origen: z.string().max(100).optional().nullable(),
  monto_subtotal: moneyInput,
  descuento_aplicado: moneyInput.default('0.00'),
  total_pagado: moneyInput.refine(value=>cents(value)>0n,'El pago debe ser mayor que cero'),
  clave_idempotencia: z.string().trim().min(8).max(100).optional(),
  aplicaciones: allocationsInput.optional(),
  concepto: z.string().min(1, 'El concepto es obligatorio').max(255),
  comprobante_baucher_url: z.string().optional().nullable(),
  fecha_pago_reportada: z.string().refine(value=>Number.isFinite(Date.parse(value)),'Fecha de pago inválida').optional(),
}).refine(value=>cents(value.monto_subtotal)-cents(value.descuento_aplicado)===cents(value.total_pagado),{path:['total_pagado'],message:'Subtotal menos descuento debe coincidir con el pago reportado'});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const validatePaymentSchema = z.object({
  estado: z.enum([EstadoPago.APROBADO, EstadoPago.RECHAZADO]),
  motivo_rechazo: z.string().optional().nullable(),
});

export type ValidatePaymentInput = z.infer<typeof validatePaymentSchema>;

// ==========================================
// SCHEMAS FOR CONVALIDATIONS
// ==========================================

export const createConvalidationSchema = z.object({
  componente_destino_id: z.string().uuid(),
  origen_tipo: z.nativeEnum(TipoOrigenConvalidacion),
  inscripcion_origen_ep_id: z.string().uuid().optional().nullable(),
  creditos_reconocidos: z.preprocess((val) => {
    if (typeof val === 'string') return parseInt(val, 10);
    return val;
  }, z.number().int().min(1, 'Mínimo 1 crédito').max(15, 'Máximo 15 créditos')),
  justificacion_aporte_perfil: z.string().min(10, 'La justificación debe tener al menos 10 caracteres'),
  certificado_origen_url: z.string().optional().nullable(),
});

export type CreateConvalidationInput = z.infer<typeof createConvalidationSchema>;

export const dictamenConvalidationSchema = z.object({
  estado_dictamen: z.enum([
    EstadoDictamenConvalidacion.APROBADA,
    EstadoDictamenConvalidacion.RECHAZADA,
  ]),
  coordinador_dictaminador_id: z.string().uuid().optional().nullable(),
});

export type DictamenConvalidationInput = z.infer<typeof dictamenConvalidationSchema>;

// ==========================================
// PARAM AND QUERY SCHEMAS
// ==========================================

export const enrollmentIdParamSchema = z.object({
  id: z.string().uuid('ID de inscripción inválido'),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().uuid('ID de pago inválido'),
});

export const convalidationIdParamSchema = z.object({
  convalidationId: z.string().uuid('ID de solicitud de convalidación inválido'),
});

export const listEnrollmentsQuerySchema = z.object({
  programa_id: z.string().uuid().optional(),
  cohorte_id: z.string().uuid().optional(),
  aspirante_id: z.string().uuid().optional(),
  estado: z.nativeEnum(EstadoInscripcion).optional(),
  page: z.preprocess((val) => (val ? parseInt(val as string, 10) : 1), z.number().int().min(1)).optional(),
  limit: z.preprocess((val) => (val ? parseInt(val as string, 10) : 20), z.number().int().min(1).max(100)).optional(),
  search: z.string().optional(),
});

export type ListEnrollmentsQueryInput = z.infer<typeof listEnrollmentsQuerySchema>;

export const ownEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).strict();
