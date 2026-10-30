-- Remove only the deterministic fixtures produced by v1 of demo_bulk_load.sql.
-- PostgreSQL 16+. Run on the same connection after explicit disposable-DB opt-in:
--   SET demo.allow_remove = 'yes';
-- The caller owns the transaction when composing this with a replacement load.
BEGIN;
SET LOCAL search_path = public, pg_temp;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $$
BEGIN
  IF current_setting('demo.allow_remove', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Demo rollback refused. Select the intended demo database and SET demo.allow_remove = ''yes'' on this connection.';
  END IF;
  IF to_regclass('public.programas_academicos') IS NULL
     OR to_regclass('public.cohortes_apertura') IS NULL
     OR to_regclass('public.inscripciones') IS NULL THEN
    RAISE EXCEPTION 'Current schema required to identify v1 demo rows safely.';
  END IF;
END $$;

SELECT pg_advisory_xact_lock(20261029, 1601);
CREATE OR REPLACE FUNCTION pg_temp.demo_v1_id(key text) RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT md5('pep-demo-v1:' || key)::uuid $$;
CREATE TEMP TABLE demo_owned_ids(table_name text NOT NULL, id uuid NOT NULL,
  PRIMARY KEY(table_name,id)) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.demo_v1_add(table_name text, row_id uuid) RETURNS void
LANGUAGE sql VOLATILE AS $$
  INSERT INTO pg_temp.demo_owned_ids VALUES (table_name,row_id) ON CONFLICT DO NOTHING
$$;
CREATE TEMP TABLE demo_v1_programs(id uuid PRIMARY KEY, synthetic boolean NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_cohorts(id uuid PRIMARY KEY, program_id uuid NOT NULL, phase integer NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_components(id uuid PRIMARY KEY, program_id uuid NOT NULL,
  module_order integer NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_schedules(id uuid PRIMARY KEY, cohort_id uuid NOT NULL,
  component_id uuid NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_enrollments(id uuid PRIMARY KEY, cohort_id uuid NOT NULL,
  program_id uuid NOT NULL, phase integer NOT NULL, student_no integer NOT NULL,
  applicant_id uuid NOT NULL, user_id uuid NOT NULL, degree_id uuid NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_plans(id uuid PRIMARY KEY, cohort_id uuid NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_agreements(id uuid PRIMARY KEY, enrollment_id uuid NOT NULL,
  phase integer NOT NULL, student_no integer NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_payments(id uuid PRIMARY KEY, enrollment_id uuid NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE demo_v1_tag_links(program_id uuid NOT NULL, tag_id uuid NOT NULL,
  PRIMARY KEY(program_id,tag_id)) ON COMMIT DROP;

DO $$
DECLARE career_key text; area_key text; variant integer; program_row record; cohort_row record;
  component_row record; phase_no integer; student_no integer; module_no integer;
  program_id uuid; cohort_id uuid; enrollment_id uuid; applicant_id uuid; student_id uuid;
  degree_id uuid; agreement_id uuid; payment_id uuid; plan_id uuid; schedule_id uuid;
  grade_id uuid; dossier_id uuid; area_id uuid; tag_id uuid;
  careers text[] := ARRAY['sistemas','civil','industrial','agronomia','veterinaria','derecho',
    'administracion','contabilidad','educacion','psicologia','comunicacion','economia',
    'medicina','enfermeria','odontologia','salud-publica'];
  areas text[] := ARRAY['ingenieria','ingenieria','ingenieria','agro','agro','derecho',
    'economia','economia','educacion','sociales','comunicacion','economia',
    'salud','salud','salud','salud'];
BEGIN
  -- The 32 synthetic program IDs and their exact catalog area/tag IDs are stable.
  FOR variant IN 1..2 LOOP
    FOREACH career_key IN ARRAY careers LOOP
      program_id := pg_temp.demo_v1_id('program:'||career_key||':'||variant);
      INSERT INTO demo_v1_programs VALUES(program_id,true) ON CONFLICT DO NOTHING;
      PERFORM pg_temp.demo_v1_add('programas_academicos',program_id);
      area_key := areas[array_position(careers,career_key)];
      area_id := pg_temp.demo_v1_id('area:'||area_key);
      tag_id := pg_temp.demo_v1_id('tag:'||career_key);
      PERFORM pg_temp.demo_v1_add('areas_conocimiento',area_id);
      PERFORM pg_temp.demo_v1_add('tags_academicos',tag_id);
      INSERT INTO demo_v1_tag_links VALUES(program_id,tag_id) ON CONFLICT DO NOTHING;
      FOR student_no IN 1..4 LOOP
        PERFORM pg_temp.demo_v1_add('componentes_curriculares',
          pg_temp.demo_v1_id('program:'||career_key||':'||variant||':module:'||student_no));
      END LOOP;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.demo_v1_add('sedes_ies',pg_temp.demo_v1_id('campus'));
  PERFORM pg_temp.demo_v1_add('usuarios',pg_temp.demo_v1_id('operator'));
  PERFORM pg_temp.demo_v1_add('personal_academico',pg_temp.demo_v1_id('coordinator'));
  FOR student_no IN 1..8 LOOP
    PERFORM pg_temp.demo_v1_add('usuarios',pg_temp.demo_v1_id('teacher:'||student_no));
    PERFORM pg_temp.demo_v1_add('personal_academico',pg_temp.demo_v1_id('teacher:'||student_no));
    PERFORM pg_temp.demo_v1_add('virtual_classroom_accounts',
      pg_temp.demo_v1_id(pg_temp.demo_v1_id('teacher:'||student_no)||':lms'));
  END LOOP;

  -- The v1 loader made three deterministic cohorts for every program present then.
  -- Candidate IDs for later programs cannot match any v1 row unless its exact ID matches.
  INSERT INTO demo_v1_programs
    SELECT id,false FROM programas_academicos ON CONFLICT DO NOTHING;
  INSERT INTO demo_v1_cohorts
    SELECT pg_temp.demo_v1_id('existing-program:'||p.id||':cohort:'||n),p.id,n
    FROM demo_v1_programs p CROSS JOIN generate_series(1,3) n;
  INSERT INTO demo_v1_components SELECT id,programa_id,orden_bloque FROM componentes_curriculares;
  INSERT INTO demo_v1_schedules
    SELECT pg_temp.demo_v1_id(c.id||':schedule:'||m.id),c.id,m.id
    FROM demo_v1_cohorts c JOIN demo_v1_components m ON m.program_id=c.program_id;

  FOR cohort_row IN SELECT * FROM demo_v1_cohorts LOOP
    PERFORM pg_temp.demo_v1_add('cohortes_apertura',cohort_row.id);
    plan_id := pg_temp.demo_v1_id(cohort_row.id||':plan');
    INSERT INTO demo_v1_plans VALUES(plan_id,cohort_row.id);
    PERFORM pg_temp.demo_v1_add('planes_pago_cohorte',plan_id);
    IF EXISTS (SELECT FROM cuotas_plan_pago q
      WHERE q.id=pg_temp.demo_v1_id(pg_temp.demo_v1_id(cohort_row.id||':plan')||':quota')
        AND q.plan_id=pg_temp.demo_v1_id(cohort_row.id||':plan')) THEN
      PERFORM pg_temp.demo_v1_add('cuotas_plan_pago',pg_temp.demo_v1_id(plan_id||':quota'));
    END IF;
    FOR component_row IN SELECT m0.id,m0.program_id,m0.module_order FROM demo_v1_components m0
      WHERE m0.program_id=cohort_row.program_id ORDER BY m0.module_order,m0.id LOOP
      schedule_id := pg_temp.demo_v1_id(cohort_row.id||':schedule:'||component_row.id);
      INSERT INTO demo_v1_schedules VALUES(schedule_id,cohort_row.id,component_row.id) ON CONFLICT DO NOTHING;
      PERFORM pg_temp.demo_v1_add('programacion_componentes_cohorte',schedule_id);
      PERFORM pg_temp.demo_v1_add('virtual_classroom_courses',pg_temp.demo_v1_id(schedule_id||':lms'));
    END LOOP;
    FOR student_no IN 1..20 LOOP
      applicant_id := pg_temp.demo_v1_id(cohort_row.id||':student:'||student_no);
      student_id := pg_temp.demo_v1_id(cohort_row.id||':student:'||student_no||':user');
      degree_id := pg_temp.demo_v1_id(cohort_row.id||':student:'||student_no||':degree');
      enrollment_id := pg_temp.demo_v1_id(cohort_row.id||':student:'||student_no||':enrollment');
      INSERT INTO demo_v1_enrollments VALUES(enrollment_id,cohort_row.id,cohort_row.program_id,
        cohort_row.phase,student_no,applicant_id,student_id,degree_id);
      PERFORM pg_temp.demo_v1_add('usuarios',student_id);
      PERFORM pg_temp.demo_v1_add('personas_aspirantes',applicant_id);
      PERFORM pg_temp.demo_v1_add('titulos_academicos_aspirante',degree_id);
      PERFORM pg_temp.demo_v1_add('inscripciones',enrollment_id);
      PERFORM pg_temp.demo_v1_add('virtual_classroom_accounts',pg_temp.demo_v1_id(student_id||':lms'));
      IF cohort_row.phase=3 OR (cohort_row.phase=2 AND student_no<=18) THEN
        agreement_id := pg_temp.demo_v1_id(enrollment_id||':agreement');
        INSERT INTO demo_v1_agreements VALUES(agreement_id,enrollment_id,cohort_row.phase,student_no);
        PERFORM pg_temp.demo_v1_add('acuerdos_pago_inscripcion',agreement_id);
        PERFORM pg_temp.demo_v1_add('obligaciones_pago',pg_temp.demo_v1_id(agreement_id||':fee'));
        PERFORM pg_temp.demo_v1_add('obligaciones_pago',pg_temp.demo_v1_id(agreement_id||':academic'));
        PERFORM pg_temp.demo_v1_add('auditoria_economica',pg_temp.demo_v1_id(enrollment_id||':audit'));
        IF cohort_row.phase=3 OR student_no<>17 THEN
          payment_id := pg_temp.demo_v1_id(enrollment_id||':payment');
          INSERT INTO demo_v1_payments VALUES(payment_id,enrollment_id);
          PERFORM pg_temp.demo_v1_add('pagos_inscripcion',payment_id);
          PERFORM pg_temp.demo_v1_add('comprobantes_internos',pg_temp.demo_v1_id(payment_id||':receipt'));
        END IF;
      END IF;
      IF cohort_row.phase=3 OR (cohort_row.phase=2 AND student_no<=16) THEN
        module_no := 0;
        FOR component_row IN SELECT m0.id,m0.program_id,m0.module_order FROM demo_v1_components m0
          WHERE m0.program_id=cohort_row.program_id ORDER BY m0.module_order,m0.id LOOP
          module_no := module_no+1;
          IF cohort_row.phase=2 AND module_no>2 THEN CONTINUE; END IF;
          grade_id := pg_temp.demo_v1_id(enrollment_id||':grade:'||component_row.id);
          PERFORM pg_temp.demo_v1_add('matricula_componentes_snepa',grade_id);
          PERFORM pg_temp.demo_v1_add('notas_snepa_logs',pg_temp.demo_v1_id(grade_id||':log'));
        END LOOP;
      END IF;
      IF cohort_row.phase=3 THEN
        dossier_id := pg_temp.demo_v1_id(enrollment_id||':dossier');
        PERFORM pg_temp.demo_v1_add('expediente_graduacion_certificacion',dossier_id);
        PERFORM pg_temp.demo_v1_add('publicaciones_cientificas_estudiante',
          pg_temp.demo_v1_id(dossier_id||':publication'));
      END IF;
      IF cohort_row.phase=2 AND student_no=1 THEN
        PERFORM pg_temp.demo_v1_add('solicitudes_convalidacion_acreditacion',
          pg_temp.demo_v1_id(enrollment_id||':recognition'));
      END IF;
    END LOOP;
  END LOOP;

  -- Guard relationships whose FK actions would silently mutate non-v1 rows.
  IF EXISTS (
    SELECT FROM virtual_classroom_courses c
    WHERE c.schedule_id IN (SELECT id FROM demo_owned_ids
      WHERE table_name='programacion_componentes_cohorte')
      AND c.id NOT IN (SELECT id FROM demo_owned_ids WHERE table_name='virtual_classroom_courses')
  ) THEN
    RAISE EXCEPTION 'Demo rollback refused: an unrecognized virtual classroom course references a v1 schedule.';
  END IF;
  IF EXISTS (
    SELECT FROM personal_academico a
    WHERE a.usuario_id IN (SELECT id FROM demo_owned_ids WHERE table_name='usuarios')
      AND a.id NOT IN (SELECT id FROM demo_owned_ids WHERE table_name='personal_academico')
  ) THEN
    RAISE EXCEPTION 'Demo rollback refused: unrecognized academic staff references a v1 user.';
  END IF;

  -- Composite-key fixtures are selected by exact deterministic parent identity.
  DELETE FROM aspirantes_intereses_areas x USING demo_v1_enrollments e,
    cohortes_apertura c,programas_academicos p
    WHERE x.aspirante_id=e.applicant_id AND c.id=e.cohort_id AND p.id=c.programa_id
      AND x.area_conocimiento_id=p.area_conocimiento_id;
  DELETE FROM programas_tags x USING demo_v1_tag_links l
    WHERE x.programa_id=l.program_id AND x.tag_id=l.tag_id;
  DELETE FROM planes_asignados_inscripcion x USING demo_v1_agreements a,demo_v1_enrollments e
    WHERE x.inscripcion_id=a.enrollment_id AND e.id=a.enrollment_id
      AND x.plan_id=pg_temp.demo_v1_id(e.cohort_id||':plan');
  DELETE FROM aplicaciones_pago x USING demo_v1_payments p,demo_v1_enrollments e,
    obligaciones_pago o
    WHERE x.pago_id=p.id AND x.inscripcion_id=e.id AND p.enrollment_id=e.id AND x.obligacion_id=o.id
      AND o.id IN (SELECT id FROM demo_owned_ids WHERE table_name='obligaciones_pago');

  -- Delete only IDs from the original v1 key scheme, from leaves toward roots.
  DELETE FROM publicaciones_cientificas_estudiante WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='publicaciones_cientificas_estudiante');
  DELETE FROM notas_snepa_logs WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='notas_snepa_logs');
  DELETE FROM matricula_componentes_snepa WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='matricula_componentes_snepa');
  DELETE FROM comprobantes_internos WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='comprobantes_internos');
  DELETE FROM auditoria_economica WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='auditoria_economica');
  DELETE FROM pagos_inscripcion WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='pagos_inscripcion');
  DELETE FROM obligaciones_pago WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='obligaciones_pago');
  DELETE FROM acuerdos_pago_inscripcion WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='acuerdos_pago_inscripcion');
  DELETE FROM cuotas_plan_pago WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='cuotas_plan_pago');
  DELETE FROM planes_pago_cohorte WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='planes_pago_cohorte');
  DELETE FROM expediente_graduacion_certificacion WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='expediente_graduacion_certificacion');
  DELETE FROM solicitudes_convalidacion_acreditacion WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='solicitudes_convalidacion_acreditacion');
  DELETE FROM virtual_classroom_courses WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='virtual_classroom_courses');
  DELETE FROM virtual_classroom_accounts WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='virtual_classroom_accounts');
  DELETE FROM programacion_componentes_cohorte WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='programacion_componentes_cohorte');
  DELETE FROM inscripciones WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='inscripciones');
  DELETE FROM titulos_academicos_aspirante WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='titulos_academicos_aspirante');
  DELETE FROM personas_aspirantes WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='personas_aspirantes');
  DELETE FROM cohortes_apertura WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='cohortes_apertura');
  DELETE FROM componentes_curriculares WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='componentes_curriculares');
  DELETE FROM programas_academicos WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='programas_academicos');
  DELETE FROM personal_academico WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='personal_academico');
  DELETE FROM usuarios WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='usuarios');
  DELETE FROM sedes_ies WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='sedes_ies');
  DELETE FROM tags_academicos WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='tags_academicos');
  DELETE FROM areas_conocimiento WHERE id IN (SELECT id FROM demo_owned_ids WHERE table_name='areas_conocimiento');
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Demo rollback refused: an unrecognized dependent row references a v1 fixture. No rollback changes were committed. Database detail: %', SQLERRM;
END $$;

COMMIT;
