import { z } from 'zod';

const uuid = z.string().uuid();
export const candidatesQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  programa_id: uuid.optional(),
  cohorte_id: uuid.optional(),
});
export const exportPreviewSchema = z.object({ schedule_ids: z.array(uuid).min(1).max(100) });
export const accountMappingSchema = z.object({ username: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._@+-]+$/), verified: z.literal(true) });
export const courseMappingSchema = z.object({
  shortname: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/),
  category: z.string().trim().min(1).max(120),
  teacher_role: z.string().trim().min(1).max(60),
});
export const exportSchema = z.object({ schedule_ids: z.array(uuid).min(1).max(100), format: z.enum(['xlsx', 'users_csv', 'courses_csv']) });
export const scheduleParamSchema = z.object({ programacionComponenteId: uuid });
export const gradePreviewQuerySchema = z.object({ username_column: z.string().max(200).optional(), grade_column: z.string().max(200).optional() });
export const gradeConfirmSchema = z.object({ preview_id: uuid, reason: z.string().trim().min(1).max(500).optional() });

export type CandidatesQuery = z.infer<typeof candidatesQuerySchema>;
export type CourseMapping = z.infer<typeof courseMappingSchema>;
