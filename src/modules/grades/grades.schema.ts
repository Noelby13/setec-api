import { z } from 'zod';
import { EscalaCualitativaSnepa } from '../../types/enums';

// UUID Params
export const programacionComponenteIdParamSchema = z.object({
  programacionComponenteId: z.string().uuid({ message: 'ID de programación de componente inválido' }),
});
export type ProgramacionComponenteIdParamInput = z.infer<typeof programacionComponenteIdParamSchema>;

export const matriculaComponenteIdParamSchema = z.object({
  matriculaComponenteId: z.string().uuid({ message: 'ID de matrícula de componente inválido' }),
});
export type MatriculaComponenteIdParamInput = z.infer<typeof matriculaComponenteIdParamSchema>;

export const inscripcionIdParamSchema = z.object({
  inscripcionId: z.string().uuid({ message: 'ID de inscripción inválido' }),
});
export type InscripcionIdParamInput = z.infer<typeof inscripcionIdParamSchema>;

// Schema for manual grade modification with audit
export const modifyGradeSchema = z.object({
  motivo_modificacion: z
    .string()
    .min(5, { message: 'El motivo de modificación es obligatorio y debe tener al menos 5 caracteres' }),
  calificacion_cuantitativa: z
    .number()
    .min(0, { message: 'La calificación cuantitativa mínima es 0' })
    .max(100, { message: 'La calificación cuantitativa máxima es 100' })
    .optional(),
  valoracion_cualitativa: z
    .nativeEnum(EscalaCualitativaSnepa, {
      error: () => ({ message: 'Valoración cualitativa inválida según escala SNEPA' }),
    })
    .optional(),
  observacion_acompanamiento_pedagogico: z.string().optional(),
  autoevaluacion_completada: z.boolean().optional(),
  coevaluacion_completada: z.boolean().optional(),
});
export type ModifyGradeInput = z.infer<typeof modifyGradeSchema>;

// Excel Row Data representation
export interface ExcelGradeRow {
  codigo_expediente: string;
  calificacion_cuantitativa: number;
  valoracion_cualitativa?: EscalaCualitativaSnepa;
  autoevaluacion_completada?: boolean;
  coevaluacion_completada?: boolean;
  observacion_acompanamiento_pedagogico?: string;
  rowNumber: number;
}
