import { z } from 'zod';
import { TipoSede, MaximoGradoAcademico } from '../../types/enums';

const tipoSedeEnum = z.enum([
  TipoSede.SEDE_CENTRAL,
  TipoSede.SEDE,
  TipoSede.SUBSEDE,
  TipoSede.EXTENSION,
  TipoSede.UNICAM,
]);

const maximoGradoEnum = z.enum([
  MaximoGradoAcademico.LICENCIADO,
  MaximoGradoAcademico.ESPECIALISTA,
  MaximoGradoAcademico.MASTER,
  MaximoGradoAcademico.DOCTOR,
]);

// ==========================================
// SEDES UNIVERSITARIAS (SETEC Art. 22-28)
// ==========================================

export const createSedeSchema = z.object({
  codigo_sede: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(30, 'El código no puede exceder 30 caracteres'),
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  tipo_sede: tipoSedeEnum,
  resolucion_autorizacion_setec: z
    .string()
    .trim()
    .max(100, 'La resolución no puede exceder 100 caracteres')
    .nullable()
    .optional(),
  direccion: z.string().trim().nullable().optional(),
  activa: z.boolean().optional().default(true),
});

export const updateSedeSchema = z
  .object({
    codigo_sede: z
      .string()
      .trim()
      .min(2, 'El código debe tener al menos 2 caracteres')
      .max(30, 'El código no puede exceder 30 caracteres')
      .optional(),
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(150, 'El nombre no puede exceder 150 caracteres')
      .optional(),
    tipo_sede: tipoSedeEnum.optional(),
    resolucion_autorizacion_setec: z
      .string()
      .trim()
      .max(100, 'La resolución no puede exceder 100 caracteres')
      .nullable()
      .optional(),
    direccion: z.string().trim().nullable().optional(),
    activa: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar en la sede',
  });

export const sedeIdParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de sede inválido (UUID requerido)'),
});

// ==========================================
// PERSONAL ACADÉMICO / DOCENTES
// ==========================================

export const createDocenteSchema = z.object({
  usuario_id: z
    .string()
    .uuid('Formato de usuario_id inválido (UUID requerido)')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val)),
  identificacion: z
    .string()
    .trim()
    .min(3, 'La identificación debe tener al menos 3 caracteres')
    .max(30, 'La identificación no puede exceder 30 caracteres'),
  nombres: z
    .string()
    .trim()
    .min(2, 'Los nombres deben tener al menos 2 caracteres')
    .max(100, 'Los nombres no pueden exceder 100 caracteres'),
  apellidos: z
    .string()
    .trim()
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden exceder 100 caracteres'),
  maximo_grado_academico: maximoGradoEnum,
  biografia_comercial: z.string().trim().nullable().optional(),
  foto_perfil_url: z.string().trim().nullable().optional(),
  cv_url: z.string().trim().optional(),
  activo: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      if (typeof val === 'boolean') return val;
      return true;
    }, z.boolean())
    .optional()
    .default(true),
});

export const updateDocenteSchema = z
  .object({
    usuario_id: z
      .string()
      .uuid('Formato de usuario_id inválido (UUID requerido)')
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? null : val)),
    identificacion: z
      .string()
      .trim()
      .min(3, 'La identificación debe tener al menos 3 caracteres')
      .max(30, 'La identificación no puede exceder 30 caracteres')
      .optional(),
    nombres: z
      .string()
      .trim()
      .min(2, 'Los nombres deben tener al menos 2 caracteres')
      .max(100, 'Los nombres no pueden exceder 100 caracteres')
      .optional(),
    apellidos: z
      .string()
      .trim()
      .min(2, 'Los apellidos deben tener al menos 2 caracteres')
      .max(100, 'Los apellidos no pueden exceder 100 caracteres')
      .optional(),
    maximo_grado_academico: maximoGradoEnum.optional(),
    biografia_comercial: z.string().trim().nullable().optional(),
    foto_perfil_url: z.string().trim().nullable().optional(),
    cv_url: z.string().trim().optional(),
    activo: z
      .preprocess((val) => {
        if (val === undefined) return undefined;
        if (typeof val === 'string') return val.toLowerCase() === 'true';
        if (typeof val === 'boolean') return val;
        return val;
      }, z.boolean().optional()),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar en el docente',
  });

export const docenteIdParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de personal académico inválido (UUID requerido)'),
});

export type CreateSedeInput = z.infer<typeof createSedeSchema>;
export type UpdateSedeInput = z.infer<typeof updateSedeSchema>;
export type CreateDocenteInput = z.infer<typeof createDocenteSchema>;
export type UpdateDocenteInput = z.infer<typeof updateDocenteSchema>;
