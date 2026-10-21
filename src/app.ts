import { protectUploads } from './middlewares/private-upload.middleware';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { pool } from './db/pool';
import { AppError, errorHandler } from './middlewares/error.middleware';

import { certificatesRouter } from './modules/certificates/certificates.routes';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { taxonomyRouter } from './modules/taxonomy/taxonomy.routes';
import { infrastructureRouter } from './modules/infrastructure/infrastructure.routes';
import { programsRouter } from './modules/programs/program.routes';
import { cohortsRouter } from './modules/cohorts/cohort.routes';
import { applicantsRouter } from './modules/applicants/applicant.routes';
import { enrollmentRouter } from './modules/enrollments/enrollment.routes';
import { gradesRouter } from './modules/grades/grades.routes';
import { graduationRouter } from './modules/graduation/graduation.routes';

import { swaggerUi, swaggerDocument, swaggerOptions } from './config/swagger';

export const app: Application = express();

// Security and utility middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', protectUploads, express.static(path.resolve(process.cwd(), 'uploads')));

// Swagger / OpenAPI Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
app.get('/api/docs.json', (_req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerDocument);
});

// Health Check Endpoint
app.get('/api/health', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await pool.query('SELECT NOW() as now');
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        serverTime: result.rows[0].now,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Authentication and Security Routes
app.use('/api/auth', authRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/users', usersRouter);

// Academic Taxonomy and Recommendations Routes
app.use('/api/taxonomy', taxonomyRouter);

// University Infrastructure and Faculty Routes
app.use('/api/infrastructure', infrastructureRouter);

// Academic Programs, Curriculum & Recommendations Routes
app.use('/api/programs', programsRouter);

// Academic Cohorts & Modular Schedule Routes
app.use('/api/cohorts', cohortsRouter);

// Applicants and Previous Academic Degrees Routes (Fase 6)
app.use('/api/applicants', applicantsRouter);

// Enrollments, Quorum Control, Payments and Convalidations (Fase 7)
app.use('/api/enrollments', enrollmentRouter);

// SNEPA Grades Import, Manual Modification & Audit Trail (Fase 8)
app.use('/api/grades', gradesRouter);

// Graduation Dossiers, Scientific Publications & QR Verification (Fase 8)
app.use('/api/graduation', graduationRouter);

// 404 Handler for undefined routes
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
});

// Global Centralized Error Handler
app.use(errorHandler);

export default app;
