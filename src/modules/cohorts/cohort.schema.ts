import { z } from 'zod';
import { createPlanSchema } from '../billing/billing.schema';
import { cents } from '../billing/billing.money';
import { ModalidadEducativa, EstadoCohorte } from '../../types/enums';

const modalidadEnum = z.enum([
  ModalidadEducativa.PRESENCIAL,
  ModalidadEducativa.SEMIPRESENCIAL,
  ModalidadEducativa.VIRTUAL,
  ModalidadEducativa.MIXTA,
]);

const estadoCohorteEnum = z.enum([
  EstadoCohorte.PLANIFICADA,
  EstadoCohorte.INSCRIPCION_ABIERTA,
  EstadoCohorte.QUORUM_ALCANZADO_COBRANDO,
  EstadoCohorte.EN_EJECUCION,
  EstadoCohorte.FINALIZADA_PENDIENTE_EVAL,
  EstadoCohorte.EVALUADA_SETEC,
  EstadoCohorte.CANCELADA,
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

const numberPreprocessor = (defaultValue: number | undefined = undefined) =>
  z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return defaultValue;
    if (typeof val === 'string') {
      const parsed = Number(val);
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  }, defaultValue !== undefined ? z.number() : z.number().optional());

const nullableUuidPreprocessor = () =>
  z.preprocess((val) => {
    if (val === '' || val === null || val === undefined || val === 'null') return null;
    return val;
  }, z.string().uuid('UUID inválido').nullable().optional());

// ==========================================
// COHORTES DE APERTURA SCHEMAS
// ==========================================

// Embedded cohort schedules have required dates; standalone legacy offers retain their contract.
export const cohortPaymentPlanSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
  createPlanSchema.superRefine((plan, context) => {
    const issue = (message: string, path: (string | number)[] = []) =>
      context.addIssue({ code: "custom", message, path });
    if (!plan.predeterminado)
      issue("El plan de la cohorte debe ser predeterminado");
    if (cents(plan.precio_academico) > 0n && plan.modalidad !== "MODULOS")
      issue("Configure el precio y fecha de pago de cada módulo");
    if (plan.modalidad === "MODULOS") {
      const ids = new Set<string>();
      plan.cuotas.forEach((row, index) => {
        if (!row.fecha_vencimiento)
          issue("Indique la fecha de pago del módulo", [
            "cuotas",
            index,
            "fecha_vencimiento",
          ]);
        if (row.componente_id && ids.has(row.componente_id))
          issue("El módulo ya tiene un cobro", [
            "cuotas",
            index,
            "componente_id",
          ]);
        if (row.componente_id) ids.add(row.componente_id);
      });
    }
  }),
);

export const createCohorteSchema = z.object({
  plan_pago: cohortPaymentPlanSchema.optional(),
  programa_id: z.string().uuid('Formato de programa_id inválido (UUID requerido)'),
  sede_id: z.string().uuid('Formato de sede_id inválido (UUID requerido)'),
  modalidad: modalidadEnum,
  codigo_cohorte: z
    .string()
    .trim()
    .min(2, 'El código de cohorte debe tener al menos 2 caracteres')
    .max(50, 'El código de cohorte no puede exceder 50 caracteres'),
  numero_edicion: numberPreprocessor(1).pipe(
    z.number().int().min(1, 'El número de edición debe ser mayor o igual a 1')
  ),
  coordinador_id: z.string().uuid('Formato de coordinador_id inválido (UUID requerido)'),
  fecha_inicio_inscripcion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  fecha_fin_inscripcion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  fecha_inicio_clases: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  fecha_fin_clases: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  horario_general: z.string().trim().max(255).nullable().optional(),
  precio_matricula: numberPreprocessor(0).pipe(
    z.number().min(0, 'El precio de matrícula no puede ser negativo')
  ),
  precio_total_cohorte: numberPreprocessor(0).pipe(
    z.number().min(0, 'El precio total de la cohorte no puede ser negativo')
  ),
  descuento_porcentaje: numberPreprocessor(0).pipe(
    z.number().int().min(0, 'Mínimo 0%').max(100, 'Máximo 100%')
  ),
  cupo_minimo: numberPreprocessor(15).pipe(
    z.number().int().min(1, 'El cupo mínimo debe ser al menos 1')
  ),
  cupo_maximo: numberPreprocessor(30).pipe(
    z.number().int().min(1, 'El cupo máximo debe ser al menos 1')
  ),
  tiene_excepcion_cupo_setec: booleanPreprocessor(false),
  excepcion_cupo_setec_url: z.string().trim().nullable().optional(),
  estado_cohorte: estadoCohorteEnum.optional().default(EstadoCohorte.PLANIFICADA),
});

export const updateCohorteSchema = createCohorteSchema
  .partial()
  .extend({
    cupos_actuales_verificados: numberPreprocessor().pipe(z.number().int().min(0).optional()),
    cobro_habilitado: booleanPreprocessor().optional(),
    informe_evaluacion_cohorte_url: z.string().trim().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar la cohorte',
  });

export const cohorteIdParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de cohorte inválido (UUID requerido)'),
});

// ==========================================
// PROGRAMACIÓN DE COMPONENTES POR COHORTE
// ==========================================

export const programarComponenteSchema = z.object({
  componente_id: z.string().uuid('Formato de componente_id inválido (UUID requerido)'),
  docente_titular_id: nullableUuidPreprocessor(),
  fecha_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .nullable()
    .optional(),
  fecha_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .nullable()
    .optional(),
  horario: z.string().trim().max(255).nullable().optional(),
  aula: z.string().trim().max(60).nullable().optional(),
  codigo_aula_virtual_externa: z.string().trim().max(100).nullable().optional(),
  actas_notas_cerradas: booleanPreprocessor(false),
});

export const updateProgramacionSchema = programarComponenteSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar la programación del componente',
  });

export const programacionParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de cohorte inválido (UUID requerido)'),
  componenteId: z.string().uuid('Formato de identificador de componente curricular inválido (UUID requerido)'),
});

export const cohorteQuerySchema = z.object({
  programa_id: z.string().uuid().optional(),
  sede_id: z.string().uuid().optional(),
  modalidad: modalidadEnum.optional(),
  estado_cohorte: estadoCohorteEnum.optional(),
  search: z.string().trim().optional(),
});

export type CreateCohorteInput = z.infer<typeof createCohorteSchema>;
export type UpdateCohorteInput = z.infer<typeof updateCohorteSchema>;
export type ProgramarComponenteInput = z.infer<typeof programarComponenteSchema>;
export type UpdateProgramacionInput = z.infer<typeof updateProgramacionSchema>;
export type CohorteQueryInput = z.infer<typeof cohorteQuerySchema>;
