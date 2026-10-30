-- Synthetic presentation dataset, version 1. PostgreSQL 16+, UTF-8.
-- Read docs/demo-bulk-load.md first. Never run against production.
-- Explicitly opt in ON THE SAME CONNECTION before executing this file:
--   SET demo.allow_seed = 'yes';
-- Existing programs are included; no existing row is updated or deleted.
-- All demo users are inactive and have unusable password hashes.
BEGIN;
SET LOCAL search_path = public, pg_temp;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $$
BEGIN
  IF current_setting('demo.allow_seed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Demo load refused. Select a disposable demo database and SET demo.allow_seed = ''yes'' on this connection.';
  END IF;
  IF to_regclass('public.obligaciones_pago') IS NULL
     OR to_regclass('public.certificados_registro') IS NULL
     OR to_regclass('public.virtual_classroom_courses') IS NULL
     OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='virtual_classroom_courses' AND column_name='fullname') THEN
    RAISE EXCEPTION 'Current schema required: apply the documented additive migrations before loading demo data.';
  END IF;
END $$;
-- Serializes only this loader; never changes application locking behavior.
SELECT pg_advisory_xact_lock(20261029, 1601);
CREATE FUNCTION pg_temp.demo_id(key text) RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT md5('pep-demo-v1:' || key)::uuid $$;

CREATE TEMP TABLE demo_catalog ON COMMIT DROP AS
SELECT * FROM (VALUES
 ('salud','Ciencias de la Salud','medicina','Medicina','Gestión Clínica'),
 ('salud','Ciencias de la Salud','enfermeria','Enfermería','Cuidados Integrales de Enfermería'),
 ('salud','Ciencias de la Salud','odontologia','Odontología','Gestión de Servicios Odontológicos'),
 ('salud','Ciencias de la Salud','salud-publica','Salud Pública','Epidemiología y Salud Comunitaria'),
 ('ingenieria','Ingeniería y Tecnología','sistemas','Ingeniería de Sistemas','Ingeniería de Software'),
 ('ingenieria','Ingeniería y Tecnología','civil','Ingeniería Civil','Gestión de Obras Civiles'),
 ('ingenieria','Ingeniería y Tecnología','industrial','Ingeniería Industrial','Gestión de Procesos Industriales'),
 ('agro','Ciencias Agropecuarias','agronomia','Agronomía','Producción Agropecuaria Sostenible'),
 ('agro','Ciencias Agropecuarias','veterinaria','Medicina Veterinaria','Gestión de Salud Animal'),
 ('derecho','Derecho y Ciencias Jurídicas','derecho','Derecho','Gestión Jurídica'),
 ('economia','Economía y Negocios','administracion','Administración','Dirección de Empresas'),
 ('economia','Economía y Negocios','contabilidad','Contabilidad','Auditoría y Finanzas'),
 ('educacion','Ciencias de la Educación','educacion','Educación','Docencia e Innovación Educativa'),
 ('sociales','Ciencias Sociales','psicologia','Psicología','Intervención Psicosocial'),
 ('comunicacion','Comunicación y Humanidades','comunicacion','Comunicación','Comunicación Estratégica'),
 ('economia','Economía y Negocios','economia','Economía','Desarrollo Económico Territorial')
) AS c(area_key, area_name, career_key, career_name, focus);

DO $$
DECLARE
  r record; p record; component record; obligation record;
  actor uuid := pg_temp.demo_id('operator');
  teacher uuid; student uuid; applicant uuid; degree uuid; enrollment uuid;
  campus uuid := pg_temp.demo_id('campus');
  cohort uuid; schedule uuid; plan uuid; agreement uuid; payment uuid; grade uuid; dossier uuid;
  base_key text; person_key text; enrollment_state text; payment_state text;
  first_name text; last_name text; email text; modality text; course_state text;
  phase integer; n integer; module_no integer; variant integer; role_id uuid;
  academic_price numeric(12,2); fee numeric(12,2) := 500;
  paid numeric(12,2); allocated numeric(12,2); score integer;
  start_date date; qualifies boolean;
  names text[] := ARRAY['Ana','José','María','Luis','Lucía','Carlos','Sofía','Diego','Valeria','Andrés',
                       'Camila','Óscar','Isabel','Miguel','Gabriela','Daniel','Elena','Raúl','Paola','Javier'];
  surnames text[] := ARRAY['García','López','Martínez','González','Hernández','Pérez','Ramírez','Torres'];
BEGIN
  -- Existing role definitions and permissions are reused, never rewritten.
  INSERT INTO roles(nombre, descripcion) VALUES
    ('COORDINADOR','Coordinación académica'),('DOCENTE','Personal docente'),('ESTUDIANTE','Estudiante')
    ON CONFLICT (nombre) DO NOTHING;
  SELECT id INTO STRICT role_id FROM roles WHERE nombre='COORDINADOR';
  INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id,activo,email_verificado)
    VALUES(actor,'demo.operador','demo.operador@example.invalid','!DEMO-LOGIN-DISABLED!',
           'Operador','Demostración',role_id,false,false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO sedes_ies(id,codigo_sede,nombre,tipo_sede,direccion)
    VALUES(campus,'DEMO-CENTRAL','Sede de demostración','SEDE_CENTRAL','Dirección ficticia, Nicaragua')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO personal_academico(id,usuario_id,identificacion,nombres,apellidos,maximo_grado_academico,cv_url)
    VALUES(pg_temp.demo_id('coordinator'),actor,'DEMO-COORDINADOR','Operador','Demostración','DOCTOR',
           '/demo/no-documento/cv') ON CONFLICT (id) DO NOTHING;
  FOR n IN 1..8 LOOP
    teacher := pg_temp.demo_id('teacher:'||n);
    SELECT id INTO STRICT role_id FROM roles WHERE nombre='DOCENTE';
    INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id,activo)
      VALUES(teacher,'demo.docente.'||n,'demo.docente.'||n||'@example.invalid','!DEMO-LOGIN-DISABLED!',
             names[n],surnames[n]||' DEMO',role_id,false) ON CONFLICT (id) DO NOTHING;
    INSERT INTO personal_academico(id,usuario_id,identificacion,nombres,apellidos,maximo_grado_academico,cv_url)
      VALUES(teacher,teacher,'DEMO-DOCENTE-'||n,names[n],surnames[n]||' DEMO','DOCTOR','/demo/no-documento/cv')
      ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR r IN SELECT DISTINCT area_key,area_name FROM demo_catalog LOOP
    INSERT INTO areas_conocimiento(id,nombre,slug)
      VALUES(pg_temp.demo_id('area:'||r.area_key),'DEMO · '||r.area_name,'demo-'||r.area_key)
      ON CONFLICT (id) DO NOTHING;
  END LOOP;
  FOR r IN SELECT * FROM demo_catalog ORDER BY career_key LOOP
    INSERT INTO tags_academicos(id,nombre,slug)
      VALUES(pg_temp.demo_id('tag:'||r.career_key),'DEMO · '||r.career_name,'demo-'||r.career_key)
      ON CONFLICT (id) DO NOTHING;
    FOR variant IN 1..2 LOOP
      base_key := 'program:'||r.career_key||':'||variant;
      INSERT INTO programas_academicos(id,codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,
        resumen_corto_web,descripcion_comercial,precio_total_referencia,visible_en_web,es_ciencias_salud,
        aval_minsa_url,duracion_meses,horas_totales,creditos_totales,creditos_investigacion,
        requiere_titulo_grado_rn,titulo_o_certificado_otorgado)
      VALUES(pg_temp.demo_id(base_key),'DEMO-'||upper(r.career_key)||'-'||variant,
        (CASE variant WHEN 1 THEN 'Maestría Profesional en ' ELSE 'Diplomado Profesional en ' END)||r.focus||' [DEMO]',
        'demo-'||r.career_key||'-'||variant,
        (CASE variant WHEN 1 THEN 'POSGRADO' ELSE 'EDUCACION_PERMANENTE' END)::categoria_programa_enum,
        (CASE variant WHEN 1 THEN 'MAESTRIA_PROFESIONAL' ELSE 'DIPLOMADO_PROFESIONAL' END)::subtipo_programa_enum,
        pg_temp.demo_id('area:'||r.area_key),'Oferta ficticia para demostración de '||r.career_name,
        'DATOS SINTÉTICOS. No representa una oferta institucional, autorización ni acreditación real.',
        CASE variant WHEN 1 THEN 24000 ELSE 4000 END,true,r.area_key='salud',
        CASE WHEN r.area_key='salud' THEN '/demo/no-documento/aval-minsa' END,
        CASE variant WHEN 1 THEN 12 ELSE 4 END,CASE variant WHEN 1 THEN 960 ELSE 160 END,
        CASE variant WHEN 1 THEN 32 ELSE 4 END,CASE variant WHEN 1 THEN 8 ELSE 0 END,
        variant=1,'Documento demostrativo sin validez académica') ON CONFLICT (id) DO NOTHING;
      INSERT INTO programas_tags(programa_id,tag_id)
        VALUES(pg_temp.demo_id(base_key),pg_temp.demo_id('tag:'||r.career_key)) ON CONFLICT DO NOTHING;
      FOR module_no IN 1..4 LOOP
        INSERT INTO componentes_curriculares(id,programa_id,codigo,nombre,descripcion_temario,orden_bloque,
          horas,creditos,es_investigacion,es_modalidad_graduacion,costo_base_asignatura)
        VALUES(pg_temp.demo_id(base_key||':module:'||module_no),pg_temp.demo_id(base_key),'DEMO-M'||module_no,
          (ARRAY['Fundamentos de ','Herramientas para ','Práctica aplicada de ','Proyecto integrador de '])[module_no]||r.focus,
          'Contenido ilustrativo: estudio de casos, ejercicios y proyecto de '||r.career_name,module_no,
          CASE variant WHEN 1 THEN 240 ELSE 40 END,CASE variant WHEN 1 THEN 8 ELSE 1 END,
          module_no=4 AND variant=1,module_no=4,CASE variant WHEN 1 THEN 6000 ELSE 1000 END)
          ON CONFLICT (id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Every program already in the selected demo DB is included, even if hidden.
  -- Its original curriculum, price, visibility and state are never changed.
  FOR p IN SELECT * FROM programas_academicos ORDER BY id LOOP
    base_key := 'existing-program:'||p.id;
    academic_price := greatest(p.precio_total_referencia,0);
    modality := CASE WHEN p.es_ciencias_salud THEN 'PRESENCIAL' ELSE 'SEMIPRESENCIAL' END;
    FOR phase IN 1..3 LOOP
      cohort := pg_temp.demo_id(base_key||':cohort:'||phase);
      start_date := CASE phase WHEN 1 THEN current_date+30 WHEN 2 THEN current_date-60
        ELSE current_date-greatest(coalesce((p.duracion_meses*30)::integer,180),30)-90 END;
      course_state := (ARRAY['INSCRIPCION_ABIERTA','EN_EJECUCION','EVALUADA_SETEC'])[phase];
      INSERT INTO cohortes_apertura(id,programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,
        fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,horario_general,
        precio_matricula,precio_total_cohorte,cupo_minimo,cupo_maximo,cupos_actuales_verificados,cobro_habilitado,estado_cohorte)
      VALUES(cohort,p.id,campus,modality::modalidad_educativa_enum,'DEMO-'||replace(p.id::text,'-','')||'-'||phase,
        phase,pg_temp.demo_id('coordinator'),start_date-60,start_date-1,start_date,
        start_date+greatest(coalesce((p.duracion_meses*30)::integer,180),30),
        'Sábados 08:00–16:00 [DEMO]',fee,academic_price,15,30,
        CASE phase WHEN 1 THEN 14 WHEN 2 THEN 18 ELSE 20 END,phase>1,course_state)
        ON CONFLICT (id) DO NOTHING;
      plan := pg_temp.demo_id(cohort||':plan');
      INSERT INTO planes_pago_cohorte(id,cohorte_id,nombre,version,modalidad,predeterminado,monto_matricula,precio_academico,creado_por)
        VALUES(plan,cohort,'Plan demostrativo',1,'PAGO_UNICO',true,fee,academic_price,actor)
        ON CONFLICT (id) DO NOTHING;
      IF academic_price>0 THEN
        INSERT INTO cuotas_plan_pago(id,plan_id,numero,concepto,importe,fecha_vencimiento)
          VALUES(pg_temp.demo_id(plan||':quota'),plan,1,'Arancel académico [DEMO]',academic_price,start_date+30)
          ON CONFLICT (id) DO NOTHING;
      END IF;
      module_no := 0;
      FOR component IN SELECT * FROM componentes_curriculares WHERE programa_id=p.id ORDER BY orden_bloque,id LOOP
        module_no := module_no+1;
        schedule := pg_temp.demo_id(cohort||':schedule:'||component.id);
        teacher := pg_temp.demo_id('teacher:'||((module_no-1)%8+1));
        INSERT INTO programacion_componentes_cohorte(id,cohorte_id,componente_id,docente_titular_id,fecha_inicio,fecha_fin,horario,aula)
          VALUES(schedule,cohort,component.id,teacher,start_date+(module_no-1)*7,start_date+module_no*7-1,
            'Sábados 08:00–16:00 [DEMO]','Aula DEMO-'||module_no) ON CONFLICT (id) DO NOTHING;
        INSERT INTO virtual_classroom_courses(id,schedule_id,shortname,category,teacher_role,fullname,summary,updated_by)
          VALUES(pg_temp.demo_id(schedule||':lms'),schedule,'demo.'||replace(schedule::text,'-',''),'DEMO',
            'editingteacher',left(component.nombre||' [DEMO]',254),'Propuesta local de demostración; sin sincronización externa.',actor)
          ON CONFLICT (id) DO NOTHING;
      END LOOP;

      FOR n IN 1..20 LOOP
        person_key := cohort||':student:'||n;
        student := pg_temp.demo_id(person_key||':user'); applicant := pg_temp.demo_id(person_key);
        degree := pg_temp.demo_id(person_key||':degree'); enrollment := pg_temp.demo_id(person_key||':enrollment');
        first_name := names[n]; last_name := surnames[(n-1)%8+1]||' DEMO';
        email := 'demo.'||replace(applicant::text,'-','')||'@example.invalid';
        SELECT id INTO STRICT role_id FROM roles WHERE nombre='ESTUDIANTE';
        INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id,activo)
          VALUES(student,'demo.'||replace(student::text,'-',''),email,'!DEMO-LOGIN-DISABLED!',
            first_name,last_name,role_id,false) ON CONFLICT (id) DO NOTHING;
        qualifies := phase>1 OR n>6;
        INSERT INTO personas_aspirantes(id,usuario_id,tipo_identificacion,numero_identificacion,nombres,apellidos,
          fecha_nacimiento,email,telefono,identidad_verificada,fecha_verificacion,verificado_por_usuario_id)
          VALUES(applicant,student,'PASAPORTE','DEMO-'||replace(applicant::text,'-',''),first_name,last_name,
            date '1985-01-01'+n*130,email,'00000000',qualifies,
            CASE WHEN qualifies THEN (start_date-15)::timestamptz END,CASE WHEN qualifies THEN actor END)
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO aspirantes_intereses_areas(aspirante_id,area_conocimiento_id)
          VALUES(applicant,p.area_conocimiento_id) ON CONFLICT DO NOTHING;
        INSERT INTO titulos_academicos_aspirante(id,aspirante_id,area_conocimiento_id,nivel_titulo,denominacion_titulo,
          institucion_emisora,fecha_emision,titulo_pdf_url,estado_validacion,fecha_validacion,usuario_validador_id,
          inscrito_registro_nacional,codigo_registro_nacional)
          VALUES(degree,applicant,p.area_conocimiento_id,
            CASE WHEN p.subtipo='POSDOCTORADO' THEN 'DOCTORADO'
              WHEN p.subtipo='DOCTORADO_MAESTRIA' THEN 'MAESTRIA' ELSE 'GRADO' END,'Título previo [DEMO]',
            'Universidad ficticia de demostración',date '2020-12-15','/demo/no-documento/titulo',
            CASE WHEN qualifies THEN 'VALIDADO' ELSE 'PENDIENTE' END,
            CASE WHEN qualifies THEN (start_date-15)::timestamptz END,CASE WHEN qualifies THEN actor END,
            qualifies AND p.requiere_titulo_grado_rn,CASE WHEN qualifies AND p.requiere_titulo_grado_rn THEN 'DEMO-'||degree END)
          ON CONFLICT (id) DO NOTHING;
        enrollment_state := CASE
          WHEN phase=1 THEN CASE WHEN n<=3 THEN 'EN_REVISION_DOCUMENTAL' WHEN n<=6 THEN 'DOCUMENTACION_OBSERVADA' ELSE 'INSCRITO_RESERVADO' END
          WHEN phase=2 THEN CASE WHEN n<=16 THEN 'MATRICULADO_ACTIVO' WHEN n=17 THEN 'PENDIENTE_PAGO' WHEN n=18 THEN 'PAGO_EN_REVISION' WHEN n=19 THEN 'RETIRADO' ELSE 'LISTA_ESPERA' END
          ELSE 'EGRESADO' END;
        INSERT INTO inscripciones(id,codigo_expediente,aspirante_id,cohorte_id,titulo_presentado_id,estado,
          observaciones_administracion,acepta_compromiso_idioma_y_publicacion,fecha_inscripcion,
          fecha_aprobacion_documental,fecha_formalizacion_matricula)
          VALUES(enrollment,'DEMO-'||substr(replace(enrollment::text,'-',''),1,30),applicant,cohort,degree,
            enrollment_state::estado_inscripcion_enum,'Registro sintético para presentación.',true,(start_date-30)::timestamptz,
            CASE WHEN qualifies THEN (start_date-15)::timestamptz END,
            CASE WHEN phase=3 OR (phase=2 AND n<=16) THEN start_date::timestamptz END)
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO virtual_classroom_accounts(id,person_type,person_id,username,verified,firstname,lastname,email,updated_by)
          VALUES(pg_temp.demo_id(student||':lms'),'user',student,'demo.'||replace(student::text,'-',''),
            false,first_name,last_name,email,actor) ON CONFLICT (id) DO NOTHING;

        IF phase=3 OR (phase=2 AND n<=18) THEN
          agreement := pg_temp.demo_id(enrollment||':agreement');
          INSERT INTO planes_asignados_inscripcion(inscripcion_id,plan_id,asignado_por)
            VALUES(enrollment,plan,actor) ON CONFLICT (inscripcion_id) DO NOTHING;
          INSERT INTO acuerdos_pago_inscripcion(id,inscripcion_id,plan_id,nombre_plan,modalidad,monto_matricula,precio_academico,aceptado_por)
            VALUES(agreement,enrollment,plan,'Plan demostrativo','PAGO_UNICO',fee,academic_price,actor)
            ON CONFLICT (id) DO NOTHING;
          INSERT INTO obligaciones_pago(id,acuerdo_id,inscripcion_id,numero,tipo,concepto,importe,fecha_vencimiento)
            VALUES(pg_temp.demo_id(agreement||':fee'),agreement,enrollment,0,'MATRICULA','Matrícula [DEMO]',fee,start_date-1)
            ON CONFLICT (id) DO NOTHING;
          IF academic_price>0 THEN
            INSERT INTO obligaciones_pago(id,acuerdo_id,inscripcion_id,numero,tipo,concepto,importe,fecha_vencimiento)
              VALUES(pg_temp.demo_id(agreement||':academic'),agreement,enrollment,1,'ACADEMICO',
                'Arancel académico [DEMO]',academic_price,start_date+30) ON CONFLICT (id) DO NOTHING;
          END IF;
          IF phase=3 OR n<>17 THEN
            payment := pg_temp.demo_id(enrollment||':payment');
            paid := CASE WHEN phase=3 OR n%3=0 THEN fee+academic_price ELSE fee END;
            payment_state := CASE WHEN phase=2 AND n=18 THEN 'PENDIENTE_REVISION' ELSE 'APROBADO' END;
            INSERT INTO pagos_inscripcion(id,inscripcion_id,aspirante_id,metodo_pago,numero_referencia_o_recibo,
              monto_subtotal,total_pagado,concepto,estado,fecha_pago_reportada,usuario_validador_caja_id,fecha_validacion_caja)
              VALUES(payment,enrollment,applicant,'TRANSFERENCIA','DEMO-'||payment,paid,paid,
                'Pago de demostración',payment_state::estado_pago_enum,
                CASE WHEN phase=3 THEN (start_date+60)::timestamptz ELSE current_date::timestamptz END,
                CASE WHEN payment_state='APROBADO' THEN actor END,
                CASE WHEN payment_state='APROBADO' THEN now() END) ON CONFLICT (id) DO NOTHING;
            allocated := paid;
            FOR obligation IN SELECT * FROM obligaciones_pago WHERE acuerdo_id=agreement ORDER BY numero LOOP
              IF allocated<=0 THEN EXIT; END IF;
              INSERT INTO aplicaciones_pago(pago_id,obligacion_id,inscripcion_id,importe)
                VALUES(payment,obligation.id,enrollment,least(allocated,obligation.importe)) ON CONFLICT DO NOTHING;
              allocated := allocated-least(allocated,obligation.importe);
            END LOOP;
            IF payment_state='APROBADO' THEN
              INSERT INTO comprobantes_internos(id,pago_id,inscripcion_id,datos)
              SELECT pg_temp.demo_id(payment||':receipt'),payment,enrollment,jsonb_build_object(
                'tipo','COMPROBANTE_INTERNO','demo',true,'estudiante',jsonb_build_object('nombres',first_name,
                  'apellidos',last_name,'identificacion','DEMO-'||replace(applicant::text,'-','')),
                'programa',p.nombre,'cohorte','DEMO-'||replace(p.id::text,'-','')||'-'||phase,
                'expediente','DEMO-'||substr(replace(enrollment::text,'-',''),1,30),'total',paid::text,
                'metodo_pago','TRANSFERENCIA','referencia','DEMO-'||payment,
                'fecha_pago',(SELECT fecha_pago_reportada FROM pagos_inscripcion WHERE id=payment),
                'conceptos',(SELECT jsonb_agg(jsonb_build_object('concepto',o.concepto,'tipo',o.tipo,'importe',a.importe::text) ORDER BY o.numero)
                  FROM aplicaciones_pago a JOIN obligaciones_pago o ON o.id=a.obligacion_id WHERE a.pago_id=payment))
              WHERE NOT EXISTS (SELECT FROM comprobantes_internos WHERE id=pg_temp.demo_id(payment||':receipt'))
              ON CONFLICT (id) DO NOTHING;
            END IF;
          END IF;
          INSERT INTO auditoria_economica(id,inscripcion_id,cohorte_id,usuario_id,accion,motivo,detalle)
            VALUES(pg_temp.demo_id(enrollment||':audit'),enrollment,cohort,actor,'DEMO_CARGA_INICIAL',
              'Datos sintéticos; no representa una operación económica real.',jsonb_build_object('demo',true,'version',1))
            ON CONFLICT (id) DO NOTHING;
        END IF;

        IF phase=3 OR (phase=2 AND n<=16) THEN
          module_no := 0;
          FOR component IN SELECT * FROM componentes_curriculares WHERE programa_id=p.id ORDER BY orden_bloque,id LOOP
            module_no := module_no+1;
            IF phase=2 AND module_no>2 THEN CONTINUE; END IF;
            schedule := pg_temp.demo_id(cohort||':schedule:'||component.id);
            grade := pg_temp.demo_id(enrollment||':grade:'||component.id);
            score := CASE WHEN phase=3 THEN 80+n%20 ELSE 65+(n%4)*10 END;
            INSERT INTO matricula_componentes_snepa(id,inscripcion_id,programacion_componente_id,componente_id,
              calificacion_cuantitativa,valoracion_cualitativa,aprobado,registrado_por_usuario_id)
              VALUES(grade,enrollment,schedule,component.id,score,
                (CASE WHEN score>=90 THEN 'APRENDIZAJE_AVANZADO' WHEN score>=80 THEN 'APRENDIZAJE_SATISFACTORIO'
                  WHEN score>=70 THEN 'APRENDIZAJE_FUNDAMENTAL' ELSE 'APRENDIZAJE_INICIAL' END)::escala_cualitativa_snepa_enum,
                score>=70,actor) ON CONFLICT (id) DO NOTHING;
            INSERT INTO notas_snepa_logs(id,matricula_componente_id,nota_nueva,motivo_modificacion,modificado_por_usuario_id)
              VALUES(pg_temp.demo_id(grade||':log'),grade,score,'Carga inicial de demostración',actor)
              ON CONFLICT (id) DO NOTHING;
          END LOOP;
        END IF;
        IF phase=3 THEN
          dossier := pg_temp.demo_id(enrollment||':dossier');
          INSERT INTO expediente_graduacion_certificacion(id,inscripcion_id,tipo_documento_final,
            idioma_acreditado,nivel_idioma_alcanzado,idioma_validado,modalidad_graduacion_tipo,titulo_trabajo_graduacion)
            VALUES(dossier,enrollment,CASE WHEN p.categoria='POSGRADO' THEN 'TITULO_POSGRADO' ELSE 'DIPLOMA_PROFESIONAL' END,
              'Inglés','B2',true,'PROYECTO','Proyecto de demostración: '||left(p.nombre,180)) ON CONFLICT (id) DO NOTHING;
          IF p.categoria='POSGRADO' THEN
            INSERT INTO publicaciones_cientificas_estudiante(id,expediente_graduacion_id,tipo_publicacion,titulo_publicacion,
              nombre_revista_o_medio,alcance,url_o_doi,evidencia_pdf_url,validado_coordinacion)
              VALUES(pg_temp.demo_id(dossier||':publication'),dossier,'ARTICULO_CIENTIFICO','Investigación aplicada [DEMO]',
                'Revista ficticia de demostración','UNIVERSITARIA','https://example.invalid/demo/publicacion',
                '/demo/no-documento/publicacion',true) ON CONFLICT (id) DO NOTHING;
          END IF;
        END IF;
        IF phase=2 AND n=1 THEN
          FOR component IN SELECT * FROM componentes_curriculares WHERE programa_id=p.id ORDER BY orden_bloque,id LIMIT 1 LOOP
            INSERT INTO solicitudes_convalidacion_acreditacion(id,inscripcion_destino_id,componente_destino_id,
              origen_tipo,certificado_origen_url,creditos_reconocidos,justificacion_aporte_perfil)
              VALUES(pg_temp.demo_id(enrollment||':recognition'),enrollment,component.id,'EXTERNO',
                '/demo/no-documento/convalidacion',greatest(1,least(component.creditos,15)),
                'Solicitud pendiente de ejemplo; todavía no modifica las notas.') ON CONFLICT (id) DO NOTHING;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOR r IN SELECT id,usuario_id,nombres,apellidos FROM personal_academico
           WHERE identificacion LIKE 'DEMO-DOCENTE-%' LOOP
    INSERT INTO virtual_classroom_accounts(id,person_type,person_id,username,verified,firstname,lastname,email,updated_by)
      VALUES(pg_temp.demo_id(r.usuario_id||':lms'),'user',r.usuario_id,'demo.'||replace(r.usuario_id::text,'-',''),
        false,r.nombres,r.apellidos,'demo.docente@example.invalid',actor) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Empty tables for sessions, real document registries, file imports/exports and
-- previews are intentional: no tokens, real PDFs or external operations are fabricated.
SELECT p.codigo_interno,p.nombre,count(DISTINCT c.id) AS cohortes_demo,
       count(i.id) AS inscripciones_demo
FROM programas_academicos p
JOIN cohortes_apertura c ON c.programa_id=p.id AND c.codigo_cohorte LIKE 'DEMO-%'
LEFT JOIN inscripciones i ON i.cohorte_id=c.id AND i.codigo_expediente LIKE 'DEMO-%'
GROUP BY p.id ORDER BY p.nombre;
COMMIT;
