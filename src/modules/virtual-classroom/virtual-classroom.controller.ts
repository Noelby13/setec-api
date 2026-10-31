import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middlewares/error.middleware';
import { VirtualClassroomService } from './virtual-classroom.service';

function actor(req: Request) {
  if (!req.user) throw new AppError('Authentication required.',401);
  return req.user;
}

export class VirtualClassroomController {
  static async candidates(req: Request,res: Response,next: NextFunction) {
    try { res.json({ data: await VirtualClassroomService.candidates(req.query as any,actor(req)) }); }
    catch (error) { next(error); }
  }

  static async previewExport(req: Request,res: Response,next: NextFunction) {
    try { res.json({ data: await VirtualClassroomService.previewExport(req.body.schedule_ids,req.body.category,req.body.area_id) }); }
    catch (error) { next(error); }
  }

  static async configureAccount(req: Request,res: Response,next: NextFunction) {
    try { res.json({ data: await VirtualClassroomService.configureAccount(String(req.params.personKey),req.body,actor(req)) }); }
    catch (error) { next(error); }
  }

  static async configureCourse(req: Request,res: Response,next: NextFunction) {
    try { res.json({ data: await VirtualClassroomService.configureCourse(String(req.params.scheduleId),req.body,actor(req)) }); }
    catch (error) { next(error); }
  }

  static async createExport(req: Request,res: Response,next: NextFunction) {
    try {
      const result = await VirtualClassroomService.createExport(req.body.schedule_ids,req.body.format,actor(req),req.body.category,req.body.area_id);
      res.status(200).setHeader('Content-Type',result.contentType)
        .setHeader('Content-Disposition',`attachment; filename="${result.filename}"`)
        .setHeader('X-Export-Id',result.export.id).send(result.content);
    } catch (error) { next(error); }
  }

  static async listExports(req: Request,res: Response,next: NextFunction) {
    try { res.json({ data: await VirtualClassroomService.listExports(actor(req)) }); }
    catch (error) { next(error); }
  }

  static async previewGrades(req: Request,res: Response,next: NextFunction) {
    try { res.json({ data: await VirtualClassroomService.previewGrades(String(req.params.programacionComponenteId),req.file,
      req.body.username_column as string | undefined,req.body.grade_column as string | undefined,actor(req)) }); }
    catch (error) { next(error); }
  }

  static async confirmGrades(req: Request,res: Response,next: NextFunction) {
    try { res.json({ data: await VirtualClassroomService.confirmGrades(String(req.params.programacionComponenteId),req.body,actor(req)) }); }
    catch (error) { next(error); }
  }
}
