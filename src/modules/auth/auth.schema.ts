import { z } from 'zod';

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Email or username is required').optional(),
    email: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.username), {
    message: 'Email, username, or identifier must be provided',
    path: ['identifier'],
  });

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const registerUserSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(60).trim().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  nombres: z.string().min(1, 'First name is required').max(100).trim(),
  apellidos: z.string().min(1, 'Last name is required').max(100).trim(),
  telefono: z.string().max(30).trim().optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  rolId: z.string().uuid('Valid role UUID is required'),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
