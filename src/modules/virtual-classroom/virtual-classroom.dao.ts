import { pool, DbClient } from '../../db/pool';

export class VirtualClassroomDAO {
  static async candidates(filters: { from: string; to: string; programaId?: string; cohorteId?: string; userId: string; teacherOnly: boolean }) {
    const result = await pool.query(`
      SELECT DISTINCT p.id AS programa_id, p.nombre AS programa_nombre,
        c.id AS cohorte_id, c.codigo_cohorte,
        pcc.id AS schedule_id, cc.nombre AS componente_nombre, pcc.fecha_inicio, pcc.fecha_fin,
        pa.nombres || ' ' || pa.apellidos AS docente_nombre,
        pcc.actas_notas_cerradas
      FROM programacion_componentes_cohorte pcc
      JOIN cohortes_apertura c ON c.id=pcc.cohorte_id
      JOIN programas_academicos p ON p.id=c.programa_id
      JOIN componentes_curriculares cc ON cc.id=pcc.componente_id
      LEFT JOIN personal_academico pa ON pa.id=pcc.docente_titular_id
      WHERE COALESCE(pcc.fecha_inicio,c.fecha_inicio_clases) BETWEEN $1::date AND $2::date
        AND ($3::uuid IS NULL OR p.id=$3)
        AND ($4::uuid IS NULL OR c.id=$4)
        AND (NOT $5::boolean OR pa.usuario_id=$6)
      ORDER BY p.nombre,c.codigo_cohorte,pcc.fecha_inicio,cc.nombre`,
      [filters.from, filters.to, filters.programaId ?? null, filters.cohorteId ?? null, filters.teacherOnly, filters.userId]);
    const programs = new Map<string, { id: string; nombre: string }>();
    const cohorts = new Map<string, { id: string; programa_id: string; codigo_cohorte: string }>();
    const schedules = result.rows.map(row => {
      programs.set(row.programa_id, { id: row.programa_id, nombre: row.programa_nombre });
      cohorts.set(row.cohorte_id, { id: row.cohorte_id, programa_id: row.programa_id, codigo_cohorte: row.codigo_cohorte });
      return { id: row.schedule_id, cohorte_id: row.cohorte_id, programa_id: row.programa_id,
        componente_nombre: row.componente_nombre, codigo_cohorte: row.codigo_cohorte,
        fecha_inicio: row.fecha_inicio, fecha_fin: row.fecha_fin, docente_nombre: row.docente_nombre,
        actas_notas_cerradas: row.actas_notas_cerradas };
    });
    return { programs: [...programs.values()], cohorts: [...cohorts.values()], schedules };
  }

  static async exportContext(scheduleIds: string[], db: DbClient = pool) {
    return db.query(`
      SELECT pcc.id AS schedule_id,pcc.cohorte_id,pcc.componente_id,pcc.fecha_inicio,pcc.fecha_fin,
        pcc.actas_notas_cerradas,cc.nombre AS componente_nombre,cc.codigo AS componente_codigo,
        c.codigo_cohorte,p.nombre AS programa_nombre,
        pcc.codigo_aula_virtual_externa,
        cm.shortname,cm.category,cm.teacher_role,
        pa.id AS teacher_id,pa.nombres AS teacher_firstname,pa.apellidos AS teacher_lastname,
        pa.usuario_id AS teacher_user_id,tu.username AS teacher_suggested_username,tu.email AS teacher_email,
        cm.shortname AS mapped_shortname,cm.id AS course_mapping_id
      FROM programacion_componentes_cohorte pcc
      JOIN cohortes_apertura c ON c.id=pcc.cohorte_id
      JOIN programas_academicos p ON p.id=c.programa_id
      JOIN componentes_curriculares cc ON cc.id=pcc.componente_id
      LEFT JOIN virtual_classroom_courses cm ON cm.schedule_id=pcc.id
      LEFT JOIN personal_academico pa ON pa.id=pcc.docente_titular_id
      LEFT JOIN usuarios tu ON tu.id=pa.usuario_id
      WHERE pcc.id=ANY($1::uuid[]) ORDER BY c.codigo_cohorte,cc.nombre`, [scheduleIds]);
  }

  static async courseCodeOwners(codes: string[]) {
    const normalized = [...new Set(codes.map(code => code.trim().toLowerCase()).filter(Boolean))];
    if (!normalized.length) return { rows: [] as any[] };
    return pool.query(`SELECT pcc.id AS schedule_id,lower(btrim(pcc.codigo_aula_virtual_externa)) AS code,'legacy'::text AS source
        FROM programacion_componentes_cohorte pcc
        WHERE NULLIF(btrim(pcc.codigo_aula_virtual_externa),'') IS NOT NULL
          AND lower(btrim(pcc.codigo_aula_virtual_externa))=ANY($1::text[])
      UNION ALL
      SELECT vc.schedule_id,lower(btrim(vc.shortname)) AS code,'mapping'::text AS source
        FROM virtual_classroom_courses vc
        WHERE lower(btrim(vc.shortname))=ANY($1::text[])`,[normalized]);
  }

  static async exportPeople(scheduleIds: string[], db: DbClient = pool) {
    return db.query(`
      SELECT pcc.id AS schedule_id, CASE WHEN pa.usuario_id IS NULL THEN 'applicant:' || pa.id::text ELSE 'user:' || pa.usuario_id::text END AS person_key,
        pa.nombres AS firstname,pa.apellidos AS lastname,pa.email,
        u.username AS suggested_username,
        vm.username,vm.verified,
        'student'::text AS kind,'student'::text AS role
      FROM programacion_componentes_cohorte pcc
      JOIN inscripciones i ON i.cohorte_id=pcc.cohorte_id AND i.estado='MATRICULADO_ACTIVO'
      JOIN personas_aspirantes pa ON pa.id=i.aspirante_id
      LEFT JOIN usuarios u ON u.id=pa.usuario_id
      LEFT JOIN virtual_classroom_accounts vm ON vm.person_type=CASE WHEN pa.usuario_id IS NULL THEN 'applicant' ELSE 'user' END
        AND vm.person_id=COALESCE(pa.usuario_id,pa.id)
      WHERE pcc.id=ANY($1::uuid[])
      UNION ALL
      SELECT pcc.id, CASE WHEN pa.usuario_id IS NULL THEN 'teacher:' || pa.id::text ELSE 'user:' || pa.usuario_id::text END, pa.nombres,pa.apellidos,u.email,u.username,
        vm.username,vm.verified,'teacher'::text,COALESCE(cm.teacher_role,'teacher')
      FROM programacion_componentes_cohorte pcc
      JOIN personal_academico pa ON pa.id=pcc.docente_titular_id
      LEFT JOIN usuarios u ON u.id=pa.usuario_id
      LEFT JOIN virtual_classroom_accounts vm ON vm.person_type=CASE WHEN pa.usuario_id IS NULL THEN 'teacher' ELSE 'user' END
        AND vm.person_id=COALESCE(pa.usuario_id,pa.id)
      LEFT JOIN virtual_classroom_courses cm ON cm.schedule_id=pcc.id
      WHERE pcc.id=ANY($1::uuid[]) ORDER BY person_key,schedule_id`, [scheduleIds]);
  }

  static async saveExport(input: { actorId: string; format: string; filename: string; contentType: string; content: Uint8Array; snapshot: unknown }) {
    const result = await pool.query(`INSERT INTO virtual_classroom_exports
      (created_by,format,filename,content_type,content_bytes,content_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,format,filename,content_type,created_at`,
    [input.actorId,input.format,input.filename,input.contentType,input.content,JSON.stringify(input.snapshot)]);
    return result.rows[0];
  }

  static async exports(actorId: string, canManage: boolean) {
    const result = await pool.query(`SELECT id,format,filename,content_type,created_at,content_snapshot
      FROM virtual_classroom_exports WHERE ($2::boolean OR created_by=$1)
      ORDER BY created_at DESC LIMIT 100`, [actorId, canManage]);
    return result.rows;
  }

  static async account(personType: string, personId: string) {
    return pool.query('SELECT username,verified FROM virtual_classroom_accounts WHERE person_type=$1 AND person_id=$2', [personType, personId]);
  }

  static async upsertAccount(personType: string, personId: string, username: string, actorId: string) {
    return pool.query(`INSERT INTO virtual_classroom_accounts(person_type,person_id,username,verified,updated_by,updated_at)
      VALUES($1,$2,$3,TRUE,$4,NOW()) ON CONFLICT(person_type,person_id) DO UPDATE
      SET username=EXCLUDED.username,verified=TRUE,updated_by=EXCLUDED.updated_by,updated_at=NOW()
      RETURNING person_type,person_id,username,verified`, [personType,personId,username,actorId]);
  }

  static async upsertCourse(scheduleId: string, config: { shortname: string; category: string; teacher_role: string }, actorId: string) {
    return pool.query(`INSERT INTO virtual_classroom_courses(schedule_id,shortname,category,teacher_role,updated_by,updated_at)
      VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(schedule_id) DO UPDATE SET shortname=EXCLUDED.shortname,
      category=EXCLUDED.category,teacher_role=EXCLUDED.teacher_role,updated_by=EXCLUDED.updated_by,updated_at=NOW()
      RETURNING *`, [scheduleId,config.shortname,config.category,config.teacher_role,actorId]);
  }

  static async schedule(scheduleId: string, db: DbClient = pool) {
    return db.query(`SELECT pcc.id,pcc.cohorte_id,pcc.componente_id,pcc.actas_notas_cerradas,pcc.codigo_aula_virtual_externa,
      pa.usuario_id AS docente_usuario_id FROM programacion_componentes_cohorte pcc
      LEFT JOIN personal_academico pa ON pa.id=pcc.docente_titular_id WHERE pcc.id=$1`, [scheduleId]);
  }

  static async previewRows(scheduleId: string, usernames: string[], db: DbClient = pool) {
    return db.query(`SELECT vm.username,pa.nombres || ' ' || pa.apellidos AS student_name,
      i.codigo_expediente,i.id AS inscripcion_id,mcs.id AS grade_id,
      mcs.calificacion_cuantitativa AS current_grade
      FROM virtual_classroom_accounts vm
      JOIN personas_aspirantes pa ON ((vm.person_type='applicant' AND pa.usuario_id IS NULL AND vm.person_id=pa.id)
        OR (vm.person_type='user' AND vm.person_id=pa.usuario_id))
      JOIN inscripciones i ON i.aspirante_id=pa.id AND i.estado='MATRICULADO_ACTIVO'
      JOIN programacion_componentes_cohorte pcc ON pcc.cohorte_id=i.cohorte_id AND pcc.id=$1
      LEFT JOIN matricula_componentes_snepa mcs ON mcs.inscripcion_id=i.id AND mcs.componente_id=pcc.componente_id
      WHERE vm.username=ANY($2::text[]) AND vm.verified=TRUE`, [scheduleId,usernames]);
  }

  static async gradePreviewSnapshot(scheduleId: string, db: DbClient = pool) {
    return db.query(`SELECT i.id AS enrollment_id,pa.nombres || ' ' || pa.apellidos AS student_name,
      i.codigo_expediente,vm.username,vm.verified,mcs.id AS grade_id,
      mcs.calificacion_cuantitativa AS current_grade
      FROM programacion_componentes_cohorte pcc
      JOIN inscripciones i ON i.cohorte_id=pcc.cohorte_id AND i.estado='MATRICULADO_ACTIVO'
      JOIN personas_aspirantes pa ON pa.id=i.aspirante_id
      LEFT JOIN virtual_classroom_accounts vm ON ((vm.person_type='applicant' AND pa.usuario_id IS NULL AND vm.person_id=pa.id)
        OR (vm.person_type='user' AND vm.person_id=pa.usuario_id))
      LEFT JOIN matricula_componentes_snepa mcs ON mcs.inscripcion_id=i.id AND mcs.componente_id=pcc.componente_id
      WHERE pcc.id=$1 ORDER BY i.id`,[scheduleId]);
  }

  static async insertPreview(input: { id: string; scheduleId: string; actorId: string; source: Buffer; filename: string; rows: unknown[]; fingerprint: string }) {
    return pool.query(`INSERT INTO virtual_classroom_grade_previews
      (id,schedule_id,actor_id,source_filename,source_bytes,preview_rows,fingerprint,expires_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,NOW()+INTERVAL '2 hours')`,
    [input.id,input.scheduleId,input.actorId,input.filename,input.source,JSON.stringify(input.rows),input.fingerprint]);
  }

  static async lockSchedule(scheduleId: string, db: DbClient) {
    return db.query(`SELECT pcc.*,pa.usuario_id AS docente_usuario_id FROM programacion_componentes_cohorte pcc
      JOIN cohortes_apertura c ON c.id=pcc.cohorte_id
      LEFT JOIN personal_academico pa ON pa.id=pcc.docente_titular_id
      WHERE pcc.id=$1 FOR UPDATE OF pcc,c`, [scheduleId]);
  }

  static async lockGradeFingerprint(scheduleId: string, cohortId: string, db: DbClient) {
    await db.query(`SELECT id FROM inscripciones WHERE cohorte_id=$1 ORDER BY id FOR UPDATE`, [cohortId]);
    await db.query(`SELECT vm.id FROM virtual_classroom_accounts vm
      WHERE (vm.person_type='applicant' AND vm.person_id IN
        (SELECT aspirante_id FROM inscripciones WHERE cohorte_id=$1 AND estado='MATRICULADO_ACTIVO'))
        OR (vm.person_type='user' AND vm.person_id IN
        (SELECT pa.usuario_id FROM personas_aspirantes pa JOIN inscripciones i ON i.aspirante_id=pa.id
         WHERE i.cohorte_id=$1 AND i.estado='MATRICULADO_ACTIVO' AND pa.usuario_id IS NOT NULL))
      ORDER BY vm.id FOR UPDATE`, [cohortId]);
    await db.query(`SELECT mcs.id FROM matricula_componentes_snepa mcs
      JOIN programacion_componentes_cohorte pcc ON pcc.id=mcs.programacion_componente_id
      WHERE pcc.id=$1 ORDER BY mcs.id FOR UPDATE OF mcs`, [scheduleId]);
  }

  static async getPreview(id: string, actorId: string, db: DbClient) {
    return db.query(`SELECT * FROM virtual_classroom_grade_previews WHERE id=$1 AND actor_id=$2 AND consumed_at IS NULL
      AND expires_at>NOW() FOR UPDATE`, [id,actorId]);
  }

  static async gradeFingerprint(scheduleId: string, db: DbClient = pool) {
    return db.query(`SELECT i.id AS enrollment_id,vm.username,vm.verified,mcs.id AS grade_id,
      mcs.calificacion_cuantitativa AS current_grade
      FROM programacion_componentes_cohorte pcc JOIN inscripciones i ON i.cohorte_id=pcc.cohorte_id
      AND i.estado='MATRICULADO_ACTIVO' LEFT JOIN personas_aspirantes pa ON pa.id=i.aspirante_id
      LEFT JOIN virtual_classroom_accounts vm ON ((vm.person_type='applicant' AND pa.usuario_id IS NULL AND vm.person_id=pa.id)
        OR (vm.person_type='user' AND vm.person_id=pa.usuario_id)) AND vm.verified=TRUE
      LEFT JOIN matricula_componentes_snepa mcs ON mcs.inscripcion_id=i.id AND mcs.componente_id=pcc.componente_id
      WHERE pcc.id=$1 ORDER BY i.id`, [scheduleId]);
  }

  static async createLot(input: { scheduleId: string; actorId: string; previewId: string; filename: string; db: DbClient }) {
    const result = await input.db.query(`INSERT INTO lotes_importacion_notas(programacion_componente_id,subido_por_usuario_id,archivo_excel_url,total_registros_procesados,observaciones)
      VALUES($1,$2,$3,0,$4) RETURNING id`, [input.scheduleId,input.actorId,`virtual-classroom:${input.previewId}`,`Moodle grade return: ${input.filename}`]);
    return result.rows[0].id as string;
  }

  static async applyGrade(input: { enrollmentId: string; scheduleId: string; componentId: string; grade: number; lotId: string; actorId: string; reason?: string; db: DbClient }) {
    const current = await input.db.query(`SELECT * FROM matricula_componentes_snepa WHERE inscripcion_id=$1 AND componente_id=$2 FOR UPDATE`, [input.enrollmentId,input.componentId]);
    let row = current.rows[0];
    if (row && (row.calificacion_cuantitativa === null || row.calificacion_cuantitativa === undefined)) {
      await input.db.query(`UPDATE matricula_componentes_snepa SET programacion_componente_id=$1,lote_importacion_id=$2,
        calificacion_cuantitativa=$3,valoracion_cualitativa=CASE WHEN $3::numeric>=90 THEN 'APRENDIZAJE_AVANZADO'::escala_cualitativa_snepa_enum
        WHEN $3::numeric>=80 THEN 'APRENDIZAJE_SATISFACTORIO'::escala_cualitativa_snepa_enum
        WHEN $3::numeric>=70 THEN 'APRENDIZAJE_FUNDAMENTAL'::escala_cualitativa_snepa_enum
        ELSE 'APRENDIZAJE_INICIAL'::escala_cualitativa_snepa_enum END,aprobado=$3::numeric>=70,
        registrado_por_usuario_id=$4 WHERE id=$5`,[input.scheduleId,input.lotId,input.grade,input.actorId,row.id]);
      const qualitative = input.grade >= 90 ? 'APRENDIZAJE_AVANZADO' : input.grade >= 80 ? 'APRENDIZAJE_SATISFACTORIO' : input.grade >= 70 ? 'APRENDIZAJE_FUNDAMENTAL' : 'APRENDIZAJE_INICIAL';
      await input.db.query(`INSERT INTO notas_snepa_logs(matricula_componente_id,nota_anterior,nota_nueva,
        cualitativa_anterior,cualitativa_nueva,motivo_modificacion,modificado_por_usuario_id)
        VALUES($1,NULL,$2,$3,$4,'Primera calificación final importada desde Moodle',$5)`,
      [row.id,input.grade,row.valoracion_cualitativa,qualitative,input.actorId]);
      return;
    }
    if (!row) {
      const created = await input.db.query(`INSERT INTO matricula_componentes_snepa
        (inscripcion_id,programacion_componente_id,componente_id,lote_importacion_id,calificacion_cuantitativa,
        valoracion_cualitativa,aprobado,registrado_por_usuario_id)
        VALUES($1,$2,$3,$4,$5,CASE WHEN $5::numeric>=90 THEN 'APRENDIZAJE_AVANZADO'::escala_cualitativa_snepa_enum
        WHEN $5::numeric>=80 THEN 'APRENDIZAJE_SATISFACTORIO'::escala_cualitativa_snepa_enum
        WHEN $5::numeric>=70 THEN 'APRENDIZAJE_FUNDAMENTAL'::escala_cualitativa_snepa_enum
        ELSE 'APRENDIZAJE_INICIAL'::escala_cualitativa_snepa_enum END,$5::numeric>=70,$6) RETURNING *`,
      [input.enrollmentId,input.scheduleId,input.componentId,input.lotId,input.grade,input.actorId]);
      row = created.rows[0];
      await input.db.query(`INSERT INTO notas_snepa_logs(matricula_componente_id,nota_anterior,nota_nueva,
        cualitativa_anterior,cualitativa_nueva,motivo_modificacion,modificado_por_usuario_id)
        VALUES($1,NULL,$2,NULL,$3,'Importación Moodle',$4)`, [row.id,input.grade,row.valoracion_cualitativa,input.actorId]);
    } else {
      await input.db.query(`UPDATE matricula_componentes_snepa SET programacion_componente_id=$1,lote_importacion_id=$2,
        calificacion_cuantitativa=$3,valoracion_cualitativa=CASE WHEN $3::numeric>=90 THEN 'APRENDIZAJE_AVANZADO'::escala_cualitativa_snepa_enum
        WHEN $3::numeric>=80 THEN 'APRENDIZAJE_SATISFACTORIO'::escala_cualitativa_snepa_enum
        WHEN $3::numeric>=70 THEN 'APRENDIZAJE_FUNDAMENTAL'::escala_cualitativa_snepa_enum
        ELSE 'APRENDIZAJE_INICIAL'::escala_cualitativa_snepa_enum END,aprobado=$3::numeric>=70,
        es_modificada_manualmente=TRUE,registrado_por_usuario_id=$4 WHERE id=$5`,
      [input.scheduleId,input.lotId,input.grade,input.actorId,row.id]);
      const qualitative = input.grade >= 90 ? 'APRENDIZAJE_AVANZADO' : input.grade >= 80 ? 'APRENDIZAJE_SATISFACTORIO' : input.grade >= 70 ? 'APRENDIZAJE_FUNDAMENTAL' : 'APRENDIZAJE_INICIAL';
      await input.db.query(`INSERT INTO notas_snepa_logs(matricula_componente_id,nota_anterior,nota_nueva,
        cualitativa_anterior,cualitativa_nueva,motivo_modificacion,modificado_por_usuario_id)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [row.id,row.calificacion_cuantitativa,input.grade,row.valoracion_cualitativa,qualitative,input.reason,input.actorId]);
    }
  }

  static async finishPreview(id: string, db: DbClient) {
    await db.query('UPDATE virtual_classroom_grade_previews SET consumed_at=NOW() WHERE id=$1', [id]);
  }

  static async finishLot(id: string, count: number, db: DbClient) {
    await db.query('UPDATE lotes_importacion_notas SET total_registros_procesados=$2 WHERE id=$1', [id,count]);
  }
}
