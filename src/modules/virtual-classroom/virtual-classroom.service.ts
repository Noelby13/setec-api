import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import { withTransaction } from '../../db/pool';
import { AppError } from '../../middlewares/error.middleware';
import type { AuthUserPayload } from '../../middlewares/auth.middleware';
import { VirtualClassroomDAO } from './virtual-classroom.dao';

const USER_HEADERS = ['username', 'firstname', 'lastname', 'email'];
const COURSE_HEADERS = ['shortname', 'fullname', 'summary', 'category'];
const contentType = (format: string) => format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=utf-8';

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: unknown[][]): Buffer {
  return Buffer.from(`\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`, 'utf8');
}

function opaqueUsernames(personKey: string) {
  const [type,id] = personKey.split(':');
  const base = `pep.${type}.${String(id ?? '').replaceAll('-','')}`;
  return [base,...Array.from({length:10},(_,index)=>`${base}.${index + 1}`)];
}

function emailUsername(email: unknown) {
  return String(email ?? '').trim().split('@')[0]?.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._+-]/g,'').toLowerCase() ?? '';
}

function proposedCourseCodes(schedule: any) {
  const scheduleSuffix = String(schedule.schedule_id).replaceAll('-','');
  const readable = `${schedule.codigo_cohorte ?? ''}-${schedule.componente_codigo ?? ''}`.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'course';
  const base = `${readable}-${scheduleSuffix}`;
  return [base,...Array.from({length:10},(_,index)=>`${base}-${index + 1}`)];
}

function validatedScheduleIds(ids: string[], rows: any[]) {
  if (rows.length !== ids.length) throw new AppError('Una o más programaciones no existen o no son accesibles.', 404);
  return rows;
}

function validatedCategory(category?: string): string | undefined {
  if (category === undefined) return undefined;
  const value = String(category).trim();
  if (!value || value.length > 120) throw new AppError('La categoría Moodle debe ser texto no vacío de hasta 120 caracteres.',400);
  return value;
}

function gradeStateFingerprint(rows: any[]) {
  return createHash('sha256').update(JSON.stringify(rows.map(row => ({
    enrollment_id: row.enrollment_id,
    username: row.username ?? null,
    verified: row.verified ?? null,
    grade_id: row.grade_id ?? null,
    current_grade: row.current_grade ?? null,
  })))).digest('hex');
}

export class VirtualClassroomService {
  static async candidates(query: { from?: string; to?: string; programa_id?: string; cohorte_id?: string; estado_cohorte?: string; category?: string }, user: AuthUserPayload) {
    const category = validatedCategory(query.category);
    const hasLegacyDateFilter = query.from !== undefined || query.to !== undefined;
    let start: string | undefined;
    let end: string | undefined;
    if (hasLegacyDateFilter) {
      start = query.from ?? new Date().toISOString().slice(0, 10);
      const endDate = query.to ? new Date(`${query.to}T00:00:00Z`) : new Date(`${start}T00:00:00Z`);
      if (!query.to) endDate.setUTCDate(endDate.getUTCDate() + 30);
      end = endDate.toISOString().slice(0, 10);
      if (start > end) throw new AppError('La fecha inicial debe ser anterior a la fecha final.', 400);
    }
    const admin = user.rol === 'SUPER_ADMIN' || user.permisos.includes('COHORTE_GESTIONAR');
    const grades = user.rol === 'SUPER_ADMIN' || user.permisos.includes('NOTA_IMPORTAR');
    if (!admin && !grades) throw new AppError('Se requiere permiso COHORTE_GESTIONAR o NOTA_IMPORTAR.', 403);
    return VirtualClassroomDAO.candidates({ from: start, to: end, programaId: query.programa_id,
      cohorteId: query.cohorte_id, estadoCohorte: query.estado_cohorte, category,
      defaultOperationalStates: !hasLegacyDateFilter && query.estado_cohorte === undefined,
      userId: user.id, teacherOnly: !admin && user.rol === 'DOCENTE' });
  }

  static async previewExport(scheduleIds: string[], requestedCategory?: string) {
    const categoryFilter = validatedCategory(requestedCategory);
    const schedules = validatedScheduleIds(scheduleIds, (await VirtualClassroomDAO.exportContext(scheduleIds)).rows);
    const defaults = new Map<string, any>((await VirtualClassroomDAO.proposalDefaults(scheduleIds)).rows.map((row: any) => [row.schedule_id,row]));
    const generatedCodes = new Map<string,string[]>();
    for (const schedule of schedules) {
      if (schedule.shortname || schedule.codigo_aula_virtual_externa) continue;
      generatedCodes.set(schedule.schedule_id,proposedCourseCodes(schedule));
    }
    const codes = [...schedules.map(schedule => String(schedule.shortname ?? schedule.codigo_aula_virtual_externa ?? '').trim()).filter(Boolean),
      ...[...generatedCodes.values()].flat()];
    const codeOwners = (await VirtualClassroomDAO.courseCodeOwners(codes)).rows;
    const peopleResult = await VirtualClassroomDAO.exportPeople(scheduleIds);
    const globalPeople = (await VirtualClassroomDAO.globalProposalPeople()).rows;
    const globalByPerson = new Map<string,any>();
    for (const source of globalPeople) {
      if (!globalByPerson.has(source.person_key)) globalByPerson.set(source.person_key,source);
    }
    const emailCandidateCounts = new Map<string,number>();
    for (const person of globalByPerson.values()) {
      const localPart = emailUsername(person.email);
      if (localPart) emailCandidateCounts.set(localPart,(emailCandidateCounts.get(localPart) ?? 0) + 1);
    }
    const usernamesToCheck = [...peopleResult.rows,...globalByPerson.values()].flatMap((source: any) => [source.username,source.suggested_username,
      emailUsername(source.email_override || source.email),...opaqueUsernames(source.person_key)]);
    const usernameOwners = (await VirtualClassroomDAO.usernameOwners(usernamesToCheck)).rows;
    const people = new Map<string, any>();
    const issues: { code: string; message: string; person_key?: string; schedule_id?: string }[] = [];
    const courses = schedules.map(schedule => {
      const legacyCode = String(schedule.codigo_aula_virtual_externa ?? '').trim();
      const mappedCode = String(schedule.shortname ?? '').trim();
      const fallbackCodes = generatedCodes.get(schedule.schedule_id) ?? [];
      const candidateCode = fallbackCodes.find(code => !codeOwners.some((owner: any) => owner.code === code.toLowerCase() && owner.schedule_id !== schedule.schedule_id));
      const shortname = mappedCode || legacyCode || candidateCode || fallbackCodes[0] || `pep.${String(schedule.schedule_id).replaceAll('-','')}`;
      const category = String(schedule.category || defaults.get(schedule.schedule_id)?.category || '1').trim();
      const teacherRole = schedule.teacher_role || defaults.get(schedule.schedule_id)?.teacher_role || 'teacher';
      const fullname = schedule.fullname_override || `${schedule.componente_nombre} - ${schedule.codigo_cohorte}`;
      const summary = schedule.summary_override || `${schedule.programa_nombre}; ${schedule.fecha_inicio ?? ''} a ${schedule.fecha_fin ?? ''}`;
      if (!schedule.course_mapping_id) issues.push({ code:'COURSE_CONFIRMATION_REQUIRED',message:'Revise y guarde la propuesta del curso antes de generar.',schedule_id:schedule.schedule_id });
      if (!schedule.teacher_id) issues.push({ code: 'TEACHER_REQUIRED', message: 'La programación requiere un docente asignado.', schedule_id: schedule.schedule_id });
      if (legacyCode && mappedCode && legacyCode.toLowerCase() !== mappedCode.toLowerCase()) {
        issues.push({ code:'LEGACY_COURSE_CODE_MISMATCH',message:'El shortname configurado no coincide con el código de aula virtual existente.',schedule_id:schedule.schedule_id });
      }
      const key = shortname.toLowerCase();
      if (key && codeOwners.some(owner => owner.code === key && owner.schedule_id !== schedule.schedule_id)) {
        issues.push({ code:'LEGACY_COURSE_CODE_CONFLICT',message:'El código Moodle ya pertenece a otra programación.',schedule_id:schedule.schedule_id });
      }
      return { schedule_id: schedule.schedule_id, shortname, fullname, summary, category, teacher_role: teacherRole,
        confirmed:Boolean(schedule.course_mapping_id),
        fecha_inicio: schedule.fecha_inicio, fecha_fin: schedule.fecha_fin };
    });
    if (categoryFilter !== undefined && courses.some(course => course.category !== categoryFilter)) {
      throw new AppError('La selección incluye cursos fuera de la categoría solicitada o su categoría cambió; revise nuevamente la selección.',409);
    }
    const reservedUsernames = new Set<string>();
    for (const source of peopleResult.rows) {
      const existingPerson = people.get(source.person_key);
      const fallbackUsernames = opaqueUsernames(source.person_key);
      const fallbackUsername = fallbackUsernames[0];
      const emailLocalPart = emailUsername(source.email_override || source.email);
      const emailProposal = emailCandidateCounts.get(emailLocalPart) === 1 ? emailLocalPart : '';
      const proposed = String(source.username || source.suggested_username || emailProposal || fallbackUsername).trim();
      const candidate = /^[A-Za-z0-9._@+-]{1,100}$/.test(proposed) ? proposed : fallbackUsername;
      const lowerCandidate = candidate.toLowerCase();
      const savedUsernameInvalid = Boolean(source.username) && !/^[A-Za-z0-9._@+-]{1,100}$/.test(String(source.username).trim());
      const collides = !existingPerson && (usernameOwners.some((owner: any) => owner.username === lowerCandidate && owner.person_key !== source.person_key)
        || reservedUsernames.has(lowerCandidate));
      const savedUsernameConflict = Boolean(source.username) && collides;
      const availableFallback = fallbackUsernames.find(fallback => !usernameOwners.some((owner: any) => owner.username === fallback.toLowerCase() && owner.person_key !== source.person_key)
        && !reservedUsernames.has(fallback.toLowerCase()));
      const username = existingPerson?.username ?? (source.username ? String(source.username).trim() : collides ? (availableFallback ?? '') : candidate);
      if (!existingPerson && username) reservedUsernames.add(username.toLowerCase());
      const person = existingPerson ?? {
        person_key: source.person_key, firstname: source.firstname_override || source.firstname,
        lastname: source.lastname_override || source.lastname, email: source.email_override || source.email || '',
        username, suggested_username: source.suggested_username ?? '',
        verified: Boolean(source.verified), kind: source.kind, courses: [],
      };
      if (!person.firstname?.trim() || !person.lastname?.trim() || !person.email?.trim()) {
        issues.push({ code: 'PERSON_DATA_MISSING', message: 'La persona requiere nombres, apellidos y correo.', person_key: source.person_key, schedule_id: source.schedule_id });
      }
      if (!source.verified || !source.username || savedUsernameInvalid || savedUsernameConflict || !username) {
        issues.push({ code: 'ACCOUNT_LINK_REQUIRED', message: 'Complete y verifique la vinculación Moodle antes de generar.', person_key: source.person_key, schedule_id: source.schedule_id });
      }
      if (!person.email?.trim()) {
        issues.push({ code: 'EMAIL_REQUIRED', message: 'La cuenta Moodle requiere correo electrónico.', person_key: source.person_key, schedule_id: source.schedule_id });
      }
      if (savedUsernameInvalid) issues.push({code:'USERNAME_INVALID',message:'El username Moodle guardado no tiene un formato válido.',person_key:source.person_key,schedule_id:source.schedule_id});
      if (savedUsernameConflict || !username) issues.push({code:'USERNAME_CONFLICT',message:'El username configurado pertenece a otra persona; indique una cuenta Moodle única.',person_key:source.person_key,schedule_id:source.schedule_id});
      const course = courses.find(item => item.schedule_id === source.schedule_id)!;
      person.courses.push({ schedule_id: source.schedule_id, shortname: course.shortname,
        role: source.kind === 'teacher' ? course.teacher_role : source.role });
      people.set(source.person_key, person);
    }
    const seen = new Set<string>();
    for (const person of people.values()) {
      if (person.username && seen.has(person.username.toLowerCase())) issues.push({ code: 'USERNAME_CONFLICT', message: 'El username aparece asociado a más de una persona.', person_key: person.person_key });
      if (person.username) seen.add(person.username.toLowerCase());
    }
    return { courses, people: [...people.values()], issues,
      ...(categoryFilter === undefined ? {} : { category: categoryFilter }) };
  }

  static async configureAccount(personKey: string, config: { username: string; firstname?: string; lastname?: string; email?: string }, actor: AuthUserPayload) {
    const [personType, personId, extra] = personKey.split(':');
    if (!['user','applicant','teacher'].includes(personType) || !/^[0-9a-f-]{36}$/i.test(personId ?? '') || extra) throw new AppError('La persona indicada no es válida.', 400);
    const relation = personType === 'user' ? 'usuarios' : personType === 'applicant' ? 'personas_aspirantes' : 'personal_academico';
    const found = await import('../../db/pool').then(({ pool }) => personType === 'user'
      ? pool.query(`SELECT id FROM usuarios u WHERE u.id=$1 AND EXISTS (SELECT 1 FROM personas_aspirantes a WHERE a.usuario_id=u.id)
          UNION SELECT id FROM usuarios u WHERE u.id=$1 AND EXISTS (SELECT 1 FROM personal_academico p WHERE p.usuario_id=u.id)`,[personId])
      : pool.query(`SELECT id,usuario_id FROM ${relation} WHERE id=$1`,[personId]));
    if (!found.rows.length) throw new AppError('La persona indicada no existe.', 404);
    if (personType !== 'user' && found.rows[0].usuario_id) throw new AppError(`Use user:${found.rows[0].usuario_id} para mantener la identidad vinculada.`,400);
    return (await VirtualClassroomDAO.upsertAccount(personType,personId,config,actor.id)).rows[0];
  }

  static async configureCourse(scheduleId: string, config: { shortname: string; category: string; teacher_role: string; fullname?: string; summary?: string }, actor: AuthUserPayload) {
    const schedule = (await VirtualClassroomDAO.schedule(scheduleId)).rows[0];
    if (!schedule) throw new AppError('Programación de componente no encontrada.', 404);
    const legacyCode = String(schedule.codigo_aula_virtual_externa ?? '').trim();
    if (legacyCode && legacyCode.toLowerCase() !== config.shortname.toLowerCase()) {
      throw new AppError('El shortname debe conservar el código de aula virtual ya asignado.',409);
    }
    const codeOwners=(await VirtualClassroomDAO.courseCodeOwners([config.shortname])).rows;
    if (codeOwners.some(owner=>owner.code===config.shortname.toLowerCase() && owner.schedule_id!==scheduleId)) {
      throw new AppError('El código Moodle ya pertenece a otra programación.',409);
    }
    return (await VirtualClassroomDAO.upsertCourse(scheduleId,config,actor.id)).rows[0];
  }

  static async createExport(scheduleIds: string[], format: 'xlsx'|'users_csv'|'courses_csv', actor: AuthUserPayload, requestedCategory?: string) {
    const categoryFilter = validatedCategory(requestedCategory);
    const preview = await this.previewExport(scheduleIds,categoryFilter);
    if (preview.issues.length) throw new AppError('Resuelva los problemas de validación antes de generar los archivos.', 400, preview.issues);
    const users = new Map<string, any>();
    for (const person of preview.people) {
      let row = users.get(person.username);
      if (!row) { row = { username: person.username, firstname: person.firstname, lastname: person.lastname, email: person.email, courses: [] }; users.set(person.username,row); }
      for (const course of person.courses) row.courses.push(course);
    }
    const userHeaders = [...USER_HEADERS, ...Array.from({ length: scheduleIds.length }, (_,i) => [`course${i+1}`,`role${i+1}`]).flat()];
    const userRows = [...users.values()].map(person => [person.username,person.firstname,person.lastname,person.email,
      ...scheduleIds.flatMap(id => { const match = person.courses.find((c: any) => c.schedule_id === id); return [match?.shortname ?? '',match?.role ?? '']; })]);
    const courseRows = preview.courses.map(course => [course.shortname,course.fullname,course.summary,course.category]);
    let content: Buffer;
    if (format === 'users_csv') content = csv([userHeaders,...userRows]);
    else if (format === 'courses_csv') content = csv([COURSE_HEADERS,...courseRows]);
    else {
      const workbook = new ExcelJS.Workbook();
      const userSheet = workbook.addWorksheet('Usuarios'); userSheet.addRow(userHeaders); userRows.forEach(row => userSheet.addRow(row));
      const courseSheet = workbook.addWorksheet('Cursos'); courseSheet.addRow(COURSE_HEADERS); courseRows.forEach(row => courseSheet.addRow(row));
      content = Buffer.from(await workbook.xlsx.writeBuffer());
    }
    const filename = format === 'xlsx' ? 'aula-virtual.xlsx' : format === 'users_csv' ? 'usuarios.csv' : 'cursos.csv';
    const saved = await VirtualClassroomDAO.saveExport({ actorId: actor.id, format, filename, contentType: contentType(format), content, snapshot: preview });
    return { content, filename, contentType: contentType(format), export: saved };
  }

  static async listExports(actor: AuthUserPayload) {
    return VirtualClassroomDAO.exports(actor.id,actor.rol === 'SUPER_ADMIN' || actor.permisos.includes('COHORTE_GESTIONAR'));
  }

  private static cellValue(value: ExcelJS.CellValue): unknown {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if ('formula' in value || 'sharedFormula' in value || 'error' in value) return { unsafe: true };
      if ('text' in value) return value.text;
      if ('richText' in value) return value.richText.map(item => item.text).join('');
      if ('result' in value) return value.result;
    }
    return value;
  }

  private static async parseWorkbook(file: Express.Multer.File) {
    const workbook = new ExcelJS.Workbook();
    try {
      if (/\.csv$/i.test(file.originalname) || file.mimetype === 'text/csv') {
        await workbook.csv.read(Readable.from([file.buffer]), { map: value => value });
      }
      else {
        const xlsxBytes = Buffer.alloc(file.buffer.byteLength);
        file.buffer.copy(xlsxBytes);
        await workbook.xlsx.load(xlsxBytes as any);
      }
    } catch { throw new AppError('No se pudo leer el archivo Excel o CSV.',400); }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new AppError('El archivo no contiene filas.',400);
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell,col) => { headers[col-1] = String(this.cellValue(cell.value) ?? '').replace(/^\uFEFF/,'').trim(); });
    if (!headers.length || headers.some(value => typeof value !== 'string')) throw new AppError('No se encontró una fila de encabezados válida.',400);
    return { sheet, headers };
  }

  static async previewGrades(scheduleId: string, file: Express.Multer.File | undefined, usernameColumn: string | undefined,
    gradeColumn: string | undefined, actor: AuthUserPayload) {
    if (!file) throw new AppError('Adjunte el archivo en el campo archivo.',400);
    const schedule = (await VirtualClassroomDAO.schedule(scheduleId)).rows[0];
    if (!schedule) throw new AppError('Programación de componente no encontrada.',404);
    if (schedule.actas_notas_cerradas) throw new AppError('Las actas de notas están cerradas.',400);
    if (!schedule.docente_usuario_id && actor.rol === 'DOCENTE') throw new AppError('La programación no tiene docente asignado.',403);
    const { sheet, headers } = await this.parseWorkbook(file);
    if (!usernameColumn || !gradeColumn) return { columns: headers, rows: [], issues: [], can_confirm: false };
    const usernameIndex = headers.indexOf(usernameColumn);
    const gradeIndex = headers.indexOf(gradeColumn);
    if (usernameIndex < 0 || gradeIndex < 0 || usernameIndex === gradeIndex) throw new AppError('Seleccione columnas distintas de username y nota que existan en el archivo.',400);
    const rawRows: { row: number; username: string; grade: number | null; error?: string }[] = [];
    const usernames = new Set<string>();
    sheet.eachRow((row,rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as ExcelJS.CellValue[];
      const usernameValue = this.cellValue(values[usernameIndex+1]);
      const gradeValue = this.cellValue(values[gradeIndex+1]);
      if (usernameValue === '' && gradeValue === '') return;
      const username = typeof usernameValue === 'string' || typeof usernameValue === 'number' ? String(usernameValue).trim() : '';
      const rawGrade = gradeValue;
      const numeric = typeof rawGrade === 'number' ? rawGrade : typeof rawGrade === 'string' && rawGrade.trim() !== '' ? Number(rawGrade.trim()) : NaN;
      let error: string | undefined;
      if ((usernameValue as any)?.unsafe || (gradeValue as any)?.unsafe ||
        (typeof usernameValue === 'string' && /^\s*[=+@]/.test(usernameValue)) ||
        (typeof gradeValue === 'string' && /^\s*[=+@]/.test(gradeValue))) error = 'No se permiten fórmulas ni celdas de error.';
      else if (!username) error = 'Falta username.';
      else if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) error = 'La nota debe ser un número entre 0 y 100.';
      else if (usernames.has(username)) error = 'Username repetido en el archivo.';
      if (username) usernames.add(username);
      rawRows.push({ row: rowNumber, username, grade: error ? null : numeric, ...(error ? { error } : {}) });
    });
    const snapshot = (await VirtualClassroomDAO.gradePreviewSnapshot(scheduleId)).rows;
    const byUsername = new Map(snapshot.filter(row => row.verified && row.username).map(row => [row.username,row]));
    const rows = rawRows.map(row => {
      const match = byUsername.get(row.username);
      let error = row.error;
      if (!error && !match) error = 'Username no vinculado o no pertenece a una matrícula activa del componente.';
      const current = match?.current_grade === null || match?.current_grade === undefined ? null : Number(match.current_grade);
      const status = error ? 'error' : current === null ? 'new' : current === row.grade ? 'unchanged' : 'change';
      return { row: row.row, username: row.username, student_name: match?.student_name ?? null,
        expediente: match?.codigo_expediente ?? null, current_grade: current, grade: row.grade,
        status, ...(error ? { error } : {}), ...(match ? { enrollment_id: match.enrollment_id, grade_id: match.grade_id ?? null } : {}) };
    });
    const valid = rows.filter(row => row.status !== 'error');
    const fingerprint = gradeStateFingerprint(snapshot);
    const issues = rows.some(row => row.status === 'error') ? [{ code: 'ROW_ERRORS', message: 'Corrija todas las filas con error antes de confirmar.' }] : [];
    const canConfirm = rows.length > 0 && !issues.length;
    let previewId: string | undefined;
    if (canConfirm) {
      previewId = randomUUID();
      await VirtualClassroomDAO.insertPreview({ id: previewId,scheduleId,actorId: actor.id,source: file.buffer,
        filename: file.originalname,rows: valid,fingerprint });
    }
    return { columns: headers, ...(previewId ? { preview_id: previewId } : {}), rows: rows.map(({ enrollment_id: _id, grade_id: _gradeId, ...row }) => row), issues,
      can_confirm: canConfirm };
  }

  static async confirmGrades(scheduleId: string, input: { preview_id: string; reason?: string }, actor: AuthUserPayload) {
    return withTransaction(async client => {
      const locked = (await VirtualClassroomDAO.lockSchedule(scheduleId,client)).rows[0];
      if (!locked) throw new AppError('Programación de componente no encontrada.',404);
      if (locked.actas_notas_cerradas) throw new AppError('Las actas de notas están cerradas.',400);
      if (actor.rol === 'DOCENTE' && locked.docente_usuario_id !== actor.id) throw new AppError('No tiene acceso a esta programación.',403);
      const preview = (await VirtualClassroomDAO.getPreview(input.preview_id,actor.id,client)).rows[0];
      if (!preview || preview.schedule_id !== scheduleId) throw new AppError('La vista previa expiró o no pertenece a esta programación. Genere una nueva.',409);
      await VirtualClassroomDAO.lockGradeFingerprint(scheduleId,locked.cohorte_id,client);
      const fresh = (await VirtualClassroomDAO.gradeFingerprint(scheduleId,client)).rows;
      const fingerprint = gradeStateFingerprint(fresh);
      if (fingerprint !== preview.fingerprint) throw new AppError('Los estudiantes, vinculaciones o notas cambiaron desde la vista previa. Genere una nueva.',409);
      const rows = preview.preview_rows as any[];
      const changes = rows.filter(row => row.status === 'change');
      if (changes.length && !actor.permisos.includes('NOTA_MODIFICAR') && actor.rol !== 'SUPER_ADMIN') throw new AppError('Se requiere permiso NOTA_MODIFICAR para reemplazar notas existentes.',403);
      if (changes.length && !input.reason?.trim()) throw new AppError('Indique un motivo para reemplazar las notas existentes.',400);
      const lotId = await VirtualClassroomDAO.createLot({ scheduleId,actorId:actor.id,previewId:preview.id,filename:preview.source_filename,db:client });
      let processed = 0; let unchanged = 0;
      for (const row of rows) {
        if (row.status === 'unchanged') { unchanged++; continue; }
        await VirtualClassroomDAO.applyGrade({ enrollmentId:row.enrollment_id,scheduleId,componentId:locked.componente_id,
          grade:Number(row.grade),lotId,actorId:actor.id,reason:input.reason?.trim(),db:client });
        processed++;
      }
      await VirtualClassroomDAO.finishLot(lotId,processed,client);
      await VirtualClassroomDAO.finishPreview(preview.id,client);
      return { processed,unchanged,lot_id:lotId };
    });
  }
}
