import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireTeachingAssignment } from '../../middlewares/teaching.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { VirtualClassroomController } from './virtual-classroom.controller';
import { accountMappingSchema, candidatesQuerySchema, courseMappingSchema, exportPreviewSchema,
  exportSchema, gradeConfirmSchema, gradePreviewQuerySchema, scheduleParamSchema } from './virtual-classroom.schema';

export const virtualClassroomRouter = Router();

function requireAnyPermission(...permissions: string[]) {
  return (req: import('express').Request,_res: import('express').Response,next: import('express').NextFunction): void => {
    if (!req.user) return next(new AppError('Authentication required.',401));
    if (req.user.rol === 'SUPER_ADMIN' || permissions.some(permission => req.user!.permisos.includes(permission))) return next();
    next(new AppError(`Forbidden: requiere uno de estos permisos: ${permissions.join(', ')}.`,403));
  };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req,file,callback) => {
    if (!/\.(csv|xlsx)$/i.test(file.originalname)) return callback(new AppError('Solo se permiten archivos .xlsx o .csv.',400));
    callback(null,true);
  } });

virtualClassroomRouter.get('/candidates',requireAuth,requireAnyPermission('COHORTE_GESTIONAR','NOTA_IMPORTAR'),
  validateSchema({ query: candidatesQuerySchema }),VirtualClassroomController.candidates);
virtualClassroomRouter.post('/exports/preview',requireAuth,requireAnyPermission('COHORTE_GESTIONAR'),
  validateSchema({ body: exportPreviewSchema }),VirtualClassroomController.previewExport);
virtualClassroomRouter.put('/accounts/:personKey',requireAuth,requireAnyPermission('COHORTE_GESTIONAR'),
  validateSchema({ body: accountMappingSchema }),VirtualClassroomController.configureAccount);
virtualClassroomRouter.put('/courses/:scheduleId',requireAuth,requireAnyPermission('COHORTE_GESTIONAR'),
  validateSchema({ params: scheduleParamSchema, body: courseMappingSchema }),VirtualClassroomController.configureCourse);
virtualClassroomRouter.post('/exports',requireAuth,requireAnyPermission('COHORTE_GESTIONAR'),
  validateSchema({ body: exportSchema }),VirtualClassroomController.createExport);
virtualClassroomRouter.get('/exports',requireAuth,requireAnyPermission('COHORTE_GESTIONAR'),VirtualClassroomController.listExports);
virtualClassroomRouter.post('/grades/:programacionComponenteId/preview',requireAuth,requireAnyPermission('NOTA_IMPORTAR'),
  validateSchema({ params: scheduleParamSchema }),requireTeachingAssignment,upload.single('archivo'),
  validateSchema({ body: gradePreviewQuerySchema }),VirtualClassroomController.previewGrades);
virtualClassroomRouter.post('/grades/:programacionComponenteId/confirm',requireAuth,requireAnyPermission('NOTA_IMPORTAR'),
  validateSchema({ params: scheduleParamSchema, body: gradeConfirmSchema }),requireTeachingAssignment,VirtualClassroomController.confirmGrades);
