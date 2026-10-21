import { Router, RequestHandler } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { CertificatesService } from './certificates.service';
import { certificateIdSchema, certificateTokenSchema, certificateListSchema, certificatePaginationSchema, registerCertificateSchema, revokeCertificateSchema } from './certificates.schema';

export const certificatesRouter = Router();
certificatesRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
certificatesRouter.get('/verify/:token', validateSchema({ params: certificateTokenSchema }), async (req, res, next) => {
  try { res.json({ success: true, data: await CertificatesService.verify(req.params.token as string) }); }
  catch (error) { next(error); }
});
certificatesRouter.use(requireAuth);
const requireCertificateAdministration: RequestHandler = (req, _res, next) => {
  if (!CertificatesService.isAdministrator(req.user!)) return next(new AppError('Certificate operation is not authorized', 403));
  next();
};
certificatesRouter.get('/me', validateSchema({ query: certificatePaginationSchema }), async (req, res, next) => {
  try { res.json({ success: true, ...await CertificatesService.list(req.user!, certificatePaginationSchema.parse(req.query), true) }); }
  catch (error) { next(error); }
});
certificatesRouter.get('/', requireCertificateAdministration, validateSchema({ query: certificateListSchema }), async (req, res, next) => {
  try { res.json({ success: true, ...await CertificatesService.list(req.user!, certificateListSchema.parse(req.query), false) }); }
  catch (error) { next(error); }
});
certificatesRouter.get('/:id/download', validateSchema({ params: certificateIdSchema }), async (req, res, next) => {
  try {
    const result = await CertificatesService.download(req.params.id as string, req.user!);
    res.type('application/pdf').attachment(result.filename).send(result.bytes);
  } catch (error) { next(error); }
});
certificatesRouter.get('/:id/events', requireCertificateAdministration, validateSchema({ params: certificateIdSchema }), async (req, res, next) => {
  try { res.json({ success: true, data: await CertificatesService.events(req.params.id as string, req.user!) }); }
  catch (error) { next(error); }
});
certificatesRouter.post('/expediente/:id/register', requirePermission('TITULO_EMITIR'), validateSchema({ params: certificateIdSchema, body: registerCertificateSchema }), async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await CertificatesService.register(req.params.id as string, req.user!) }); }
  catch (error) { next(error); }
});
certificatesRouter.post('/:id/revoke', requirePermission('CERTIFICADO_REVOCAR'), validateSchema({ params: certificateIdSchema, body: revokeCertificateSchema }), async (req, res, next) => {
  try { res.json({ success: true, data: await CertificatesService.revoke(req.params.id as string, req.user!, req.body.motivo) }); }
  catch (error) { next(error); }
});
