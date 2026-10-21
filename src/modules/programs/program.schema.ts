import { z } from 'zod';
import {
  CategoriaPrograma,
  SubtipoPrograma,
  NivelIdiomaMcer,
  EstadoVigenciaPrograma,
} from '../../types/enums';

const categoriaEnum = z.enum([
  CategoriaPrograma.POSGRADO,
  CategoriaPrograma.EDUCACION_PERMANENTE,
]);

const subtipoEnum = z.enum([
  SubtipoPrograma.ESPECIALIDAD,
  SubtipoPrograma.MAESTRIA_PROFESIONAL,
  SubtipoPrograma.MAESTRIA_ACADEMICA,
  SubtipoPrograma.DOCTORADO_LICENCIATURA,
  SubtipoPrograma.DOCTORADO_MAESTRIA,
  SubtipoPrograma.POSDOCTORADO,
  SubtipoPrograma.CURSO_ESPECIALIZADO,
  SubtipoPrograma.CURSO_EXTENSION,
  SubtipoPrograma.TALLER,
  SubtipoPrograma.SEMINARIO,
  SubtipoPrograma.CONGRESO,
  SubtipoPrograma.DIPLOMADO_PROFESIONAL,
  SubtipoPrograma.DIPLOMADO_EXTENSION,
]);

const idiomaEgresoEnum = z.enum([
  NivelIdiomaMcer.NINGUNO,
  NivelIdiomaMcer.A1,
  NivelIdiomaMcer.A2,
  NivelIdiomaMcer.B1,
  NivelIdiomaMcer.B2,
  NivelIdiomaMcer.C1,
  NivelIdiomaMcer.C2,
]);

const estadoVigenciaEnum = z.enum([
  EstadoVigenciaPrograma.ACTIVO,
  EstadoVigenciaPrograma.EN_REDISENO,
  EstadoVigenciaPrograma.PAUSADO,
  EstadoVigenciaPrograma.LIQUIDADO,
]);

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

// Helper for parsing optional numbers in multipart/form-data
const numberPreprocessor = (defaultValue: number | undefined = undefined) =>
  z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return defaultValue;
    if (typeof val === 'string') {
      const parsed = Number(val);
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  }, defaultValue !== undefined ? z.number() : z.number().optional());

// Helper for parsing nullable UUIDs in multipart/form-data
const nullableUuidPreprocessor = () =>
  z.preprocess((val) => {
    if (val === '' || val === null || val === undefined || val === 'null') return null;
    return val;
  }, z.string().uuid('UUID inválido').nullable().optional());

// ==========================================
// PROGRAMAS ACADÉMICOS SCHEMAS
// ==========================================

export const createProgramSchema = z.object({
  codigo_interno: z
    .string()
    .trim()
    .min(2, 'El código interno debe tener al menos 2 caracteres')
    .max(30, 'El código interno no puede exceder 30 caracteres'),
  codigo_dictamen_setec: z
    .string()
    .trim()
    .max(80, 'El código de dictamen SETEC no puede exceder 80 caracteres')
    .nullable()
    .optional(),
  fecha_aprobacion_setec: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .nullable()
    .optional(),
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre del programa debe tener al menos 3 caracteres')
    .max(250, 'El nombre del programa no puede exceder 250 caracteres'),
  slug: z
    .string()
    .trim()
    .max(280, 'El slug no puede exceder 280 caracteres')
    .optional(),
  categoria: categoriaEnum,
  subtipo: subtipoEnum,
  area_conocimiento_id: z.string().uuid('Formato de área de conocimiento inválido (UUID requerido)'),

  // Commercial / Web Showcase (Estilo Udemy)
  resumen_corto_web: z
    .string()
    .trim()
    .max(500, 'El resumen corto no puede exceder 500 caracteres')
    .nullable()
    .optional(),
  descripcion_comercial: z.string().trim().nullable().optional(),
  imagen_portada_url: z.string().trim().nullable().optional(),
  video_promo_url: z.string().trim().nullable().optional(),
  brochure_pdf_url: z.string().trim().nullable().optional(),
  precio_total_referencia: numberPreprocessor(0).pipe(z.number().min(0, 'El precio no puede ser negativo')),
  descuento_porcentaje: numberPreprocessor(0).pipe(
    z.number().int().min(0, 'Mínimo 0%').max(100, 'Máximo 100%')
  ),
  visible_en_web: booleanPreprocessor(false),

  // SETEC Normative Rigor
  es_ciencias_salud: booleanPreprocessor(false),
  aval_minsa_url: z.string().trim().nullable().optional(),
  duracion_meses: numberPreprocessor().pipe(z.number().positive('La duración debe ser positiva').optional()),
  horas_totales: numberPreprocessor(0).pipe(
    z.number().int().min(1, 'Las horas totales deben ser al menos 1 hora')
  ),
  creditos_totales: numberPreprocessor(0).pipe(
    z.number().int().min(0, 'Los créditos totales no pueden ser negativos')
  ),
  creditos_investigacion: numberPreprocessor(0).pipe(
    z.number().int().min(0, 'Los créditos de investigación no pueden ser negativos')
  ),

  // Continuity and intermediate exits
  permite_continuidad_doctorado: booleanPreprocessor(false),
  programa_salida_intermedia_id: nullableUuidPreprocessor(),
  programa_destino_acreditable_id: nullableUuidPreprocessor(),
  es_acreditable_a_posgrado: booleanPreprocessor(false),
  estructurado_por_cursos: booleanPreprocessor(true),

  // Admission / Graduation requirements
  requiere_titulo_grado_rn: booleanPreprocessor(false),
  requiere_titulo_profesional: booleanPreprocessor(false),
  permite_menores_edad: booleanPreprocessor(false),
  idioma_egreso_requerido: idiomaEgresoEnum.optional().default(NivelIdiomaMcer.NINGUNO),
  num_publicaciones_requeridas: numberPreprocessor(0).pipe(
    z.number().int().min(0, 'El número de publicaciones no puede ser negativo')
  ),
  requiere_revista_indexada: booleanPreprocessor(false),
  requiere_pares_evaluadores: booleanPreprocessor(false),

  titulo_o_certificado_otorgado: z
    .string()
    .trim()
    .min(2, 'El título o certificado otorgado debe tener al menos 2 caracteres')
    .max(200, 'El título o certificado otorgado no puede exceder 200 caracteres'),
  abreviatura_grado: z
    .string()
    .trim()
    .max(20, 'La abreviatura del grado no puede exceder 20 caracteres')
    .nullable()
    .optional(),
  estado_vigencia: estadoVigenciaEnum.optional().default(EstadoVigenciaPrograma.ACTIVO),
  tag_ids: z.array(z.string().uuid('UUID de tag inválido')).optional(),
});

export const updateProgramSchema = createProgramSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar el programa',
  });

export const programIdParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de programa inválido (UUID requerido)'),
});

export const programSlugParamSchema = z.object({
  slug: z.string().trim().min(1, 'El slug del programa es requerido'),
});

export const aspiranteIdParamSchema = z.object({
  aspiranteId: z.string().uuid('Formato de identificador de aspirante inválido (UUID requerido)'),
});

// ==========================================
// COMPONENTES CURRICULARES SCHEMAS
// ==========================================

export const createComponenteSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, 'El código del componente debe tener al menos 1 caracter')
    .max(30, 'El código no puede exceder 30 caracteres'),
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre del componente debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  descripcion_temario: z.string().trim().nullable().optional(),
  orden_bloque: numberPreprocessor(1).pipe(
    z.number().int().min(1, 'El orden de bloque debe ser al menos 1')
  ),
  horas: numberPreprocessor(1).pipe(
    z.number().int().min(1, 'Las horas del componente deben ser al menos 1')
  ),
  creditos: numberPreprocessor(0).pipe(
    z.number().int().min(0, 'Los créditos no pueden ser negativos')
  ),
  es_investigacion: booleanPreprocessor(false),
  es_modalidad_graduacion: booleanPreprocessor(false),
  es_practica_profesional: booleanPreprocessor(false),
  costo_base_asignatura: numberPreprocessor(0).pipe(
    z.number().min(0, 'El costo base no puede ser negativo')
  ),
  url_silabo_pdf: z.string().trim().nullable().optional(),
});

export const updateComponenteSchema = createComponenteSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar el componente curricular',
  });

export const componenteParamSchema = z.object({
  id: z.string().uuid('Formato de identificador de programa inválido (UUID requerido)'),
  componenteId: z.string().uuid('Formato de identificador de componente inválido (UUID requerido)'),
});

export const assignTagsSchema = z.object({
  tag_ids: z.array(z.string().uuid('UUID de tag inválido')),
});

export const catalogQuerySchema = z.object({
  area_id: z.string().uuid().optional(),
  categoria: categoriaEnum.optional(),
  subtipo: subtipoEnum.optional(),
  search: z.string().trim().optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type CreateComponenteInput = z.infer<typeof createComponenteSchema>;
export type UpdateComponenteInput = z.infer<typeof updateComponenteSchema>;
export type AssignTagsInput = z.infer<typeof assignTagsSchema>;
export type CatalogQueryInput = z.infer<typeof catalogQuerySchema>;
