import { z } from 'zod';

export const createAreaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(120, 'El nombre no puede exceder 120 caracteres'),
  slug: z
    .string()
    .trim()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .max(140, 'El slug no puede exceder 140 caracteres')
    .optional(),
  icono_url: z.string().trim().nullable().optional(),
  activa: z.boolean().optional().default(true),
});

export const updateAreaSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(120, 'El nombre no puede exceder 120 caracteres')
      .optional(),
    slug: z
      .string()
      .trim()
      .min(2, 'El slug debe tener al menos 2 caracteres')
      .max(140, 'El slug no puede exceder 140 caracteres')
      .optional(),
    icono_url: z.string().trim().nullable().optional(),
    activa: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

export const areaIdParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de área inválido (UUID requerido)'),
});

export const createTagSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'),
  slug: z
    .string()
    .trim()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .max(100, 'El slug no puede exceder 100 caracteres')
    .optional(),
});

export const updateTagSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(80, 'El nombre no puede exceder 80 caracteres')
      .optional(),
    slug: z
      .string()
      .trim()
      .min(2, 'El slug debe tener al menos 2 caracteres')
      .max(100, 'El slug no puede exceder 100 caracteres')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

export const tagIdParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de tag inválido (UUID requerido)'),
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
