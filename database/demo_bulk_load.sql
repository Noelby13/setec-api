-- Readable synthetic presentation dataset, version 2. PostgreSQL 16+, UTF-8.
-- Read docs/demo-bulk-load.md first. Never run against production.
-- Explicitly opt in ON THE SAME CONNECTION before executing this file:
--   SET demo.allow_seed = 'yes';
-- Existing academic definitions are preserved; three known IT programs receive missing media only.
-- All demo users are inactive and have unusable password hashes.
BEGIN;
SET LOCAL search_path = public, pg_temp;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';
SET LOCAL TIME ZONE 'America/Managua';

DO $$
BEGIN
  IF current_setting('demo.allow_seed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Demo load refused. Select a disposable demo database and SET demo.allow_seed = ''yes'' on this connection.';
  END IF;
  IF EXISTS (SELECT FROM cohortes_apertura WHERE codigo_cohorte ~ '^DEMO-[0-9a-f]{32}-[123]$') THEN
    RAISE EXCEPTION 'Remove the previous v1 dataset with demo_bulk_rollback.sql before loading version 2.';
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
CREATE OR REPLACE FUNCTION pg_temp.demo_id(key text) RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT AS $$
  WITH named AS (
    SELECT decode(md5(uuid_send('4a47ba67-d994-42b8-8ca0-ce2136c9a891'::uuid)
      || convert_to('pep-demo-v2:' || key,'UTF8')),'hex') AS bytes
  )
  SELECT encode(set_byte(set_byte(bytes,6,(get_byte(bytes,6) & 15) | 48),
    8,(get_byte(bytes,8) & 63) | 128),'hex')::uuid FROM named
$$;

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
ALTER TABLE demo_catalog ADD COLUMN short_code text, ADD COLUMN degree_name text,
  ADD COLUMN modules text[], ADD COLUMN image_url text, ADD COLUMN video_url text,
  ADD COLUMN image_credit text, ADD COLUMN video_credit text;
UPDATE demo_catalog SET
  short_code = (ARRAY['MED','ENF','ODO','SP','SIS','CIV','IND','AGR','VET','DER','ADM','CON','EDU','PSI','COM','ECO'])[
    array_position(ARRAY['medicina','enfermeria','odontologia','salud-publica','sistemas','civil','industrial','agronomia',
      'veterinaria','derecho','administracion','contabilidad','educacion','psicologia','comunicacion','economia'],career_key)];
UPDATE demo_catalog SET degree_name = CASE career_key
  WHEN 'medicina' THEN 'Medicina y Cirugía' WHEN 'enfermeria' THEN 'Licenciatura en Enfermería'
  WHEN 'odontologia' THEN 'Cirugía Dental' WHEN 'salud-publica' THEN 'Licenciatura en Salud Pública'
  WHEN 'sistemas' THEN 'Ingeniería de Sistemas' WHEN 'civil' THEN 'Ingeniería Civil'
  WHEN 'industrial' THEN 'Ingeniería Industrial' WHEN 'agronomia' THEN 'Ingeniería Agronómica'
  WHEN 'veterinaria' THEN 'Medicina Veterinaria' WHEN 'derecho' THEN 'Licenciatura en Derecho'
  WHEN 'administracion' THEN 'Licenciatura en Administración de Empresas'
  WHEN 'contabilidad' THEN 'Licenciatura en Contaduría Pública'
  WHEN 'educacion' THEN 'Licenciatura en Ciencias de la Educación'
  WHEN 'psicologia' THEN 'Licenciatura en Psicología'
  WHEN 'comunicacion' THEN 'Licenciatura en Comunicación Social' ELSE 'Licenciatura en Economía' END,
  modules = CASE career_key
  WHEN 'medicina' THEN ARRAY['Calidad de la Atención Clínica','Seguridad del Paciente','Gestión de Servicios Médicos','Proyecto de Mejora Asistencial']
  WHEN 'enfermeria' THEN ARRAY['Valoración Integral del Paciente','Cuidados de Enfermería','Gestión del Cuidado','Proyecto de Atención Comunitaria']
  WHEN 'odontologia' THEN ARRAY['Planificación de Servicios Odontológicos','Bioseguridad en Odontología','Gestión de la Clínica Dental','Proyecto de Salud Bucal']
  WHEN 'salud-publica' THEN ARRAY['Métodos de Epidemiología','Bioestadística Aplicada','Vigilancia en Salud Pública','Proyecto de Salud Comunitaria']
  WHEN 'sistemas' THEN ARRAY['Arquitectura de Software','Desarrollo de Aplicaciones Web','Calidad y Pruebas de Software','Proyecto de Ingeniería de Software']
  WHEN 'civil' THEN ARRAY['Planificación de Obras','Presupuestos de Construcción','Supervisión y Seguridad de Obras','Proyecto de Obra Civil']
  WHEN 'industrial' THEN ARRAY['Análisis de Procesos','Gestión de Calidad','Logística y Operaciones','Proyecto de Mejora Continua']
  WHEN 'agronomia' THEN ARRAY['Manejo de Suelos','Producción de Cultivos','Riego y Agricultura Sostenible','Proyecto de Producción Agrícola']
  WHEN 'veterinaria' THEN ARRAY['Bienestar Animal','Salud Preventiva Animal','Gestión de Servicios Veterinarios','Proyecto de Salud Animal']
  WHEN 'derecho' THEN ARRAY['Argumentación Jurídica','Investigación y Análisis Normativo','Gestión de Expedientes Jurídicos','Proyecto de Asesoría Jurídica']
  WHEN 'administracion' THEN ARRAY['Planeación Estratégica','Gestión del Talento Humano','Finanzas para la Dirección','Plan de Desarrollo Empresarial']
  WHEN 'contabilidad' THEN ARRAY['Información Financiera','Control Interno','Auditoría Financiera','Proyecto de Auditoría']
  WHEN 'educacion' THEN ARRAY['Diseño Curricular','Estrategias de Enseñanza','Evaluación del Aprendizaje','Proyecto de Innovación Educativa']
  WHEN 'psicologia' THEN ARRAY['Diagnóstico Psicosocial','Diseño de Intervenciones','Acompañamiento Comunitario','Proyecto de Intervención Psicosocial']
  WHEN 'comunicacion' THEN ARRAY['Comunicación Institucional','Producción de Contenidos','Estrategia de Medios Digitales','Plan de Comunicación']
  ELSE ARRAY['Análisis Económico','Desarrollo Territorial','Evaluación de Proyectos','Proyecto de Desarrollo Local'] END;
-- Verified subject-specific media is assigned below before any program insert.
-- BEGIN VERIFIED PROGRAM MEDIA
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-medicina.png',
  video_url='https://www.youtube.com/watch?v=uBGl2BujkPQ',
  image_credit='Wikimedia Commons contributors; Public domain (Wikimedia Commons file page)',
  video_credit='CrashCourse — Introduction to Anatomy & Physiology' WHERE career_key='medicina';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-enfermeria.jpg',
  video_url='https://www.youtube.com/watch?v=uBGl2BujkPQ',
  image_credit='Pexels Free License; Pavel Danilyuk; Pexels Free License',
  video_credit='CrashCourse — Introduction to Anatomy & Physiology' WHERE career_key='enfermeria';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-odontologia.jpg',
  video_url='https://www.youtube.com/watch?v=XNbzd6yqNbg',
  image_credit='Leeds City Council / Wikimedia Commons listing; Leeds City Council royalty-free reuse permission stated on Commons; not a Creative Commons license',
  video_credit='Dr Teeth — Introduction to Dental Anatomy' WHERE career_key='odontologia';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-salud-publica.jpg',
  video_url='https://www.youtube.com/watch?v=-dmJSLNgjxo',
  image_credit='Pexels Free License; Pavel Danilyuk; Pexels Free License',
  video_credit='Centers for Disease Control and Prevention — Introduction to Public Health' WHERE career_key='salud-publica';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-sistemas.jpg',
  video_url='https://www.youtube.com/watch?v=AEaKrq3SpW8',
  image_credit='Pexels Free License; Brett Sayles; Pexels Free License',
  video_credit='CrashCourse — The Internet: Computer Science #29' WHERE career_key='sistemas';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-civil.jpg',
  video_url='https://www.youtube.com/watch?v=DX_zkaK5PaI',
  image_credit='Library of Congress, Prints & Photographs Division / HAER; Public domain; U.S. Library of Congress / HAER source',
  video_credit='Practical Engineering — Every Kind of Bridge Explained in 15 Minutes' WHERE career_key='civil';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-industrial.jpg',
  video_url='https://www.youtube.com/watch?v=Um_g8sQ_p3Y',
  image_credit='falco / Pixabay (via Wikimedia Commons); CC0 1.0',
  video_credit='The Efficient Engineer — How Things Are Made: An Animated Introduction to Manufacturing Processes' WHERE career_key='industrial';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-agronomia.jpg',
  video_url='https://www.youtube.com/watch?v=uQlqP0F0VAA',
  image_credit='Pexels Free License; Mark Stebnicki; Pexels Free License',
  video_credit='Food and Agriculture Organization of the United Nations — Smart farming and climate technologies' WHERE career_key='agronomia';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-veterinaria.jpg',
  video_url='https://www.youtube.com/watch?v=bADLEuKGu8w',
  image_credit='Pexels Free License; Mikhail Nilov; Pexels Free License',
  video_credit='Food and Agriculture Organization of the United Nations — Livestock Farmer Field School: good practices to reduce antimicrobial resistance' WHERE career_key='veterinaria';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-derecho.jpg',
  video_url='https://www.youtube.com/watch?v=mXw-hEB263k',
  image_credit='Pexels Free License; Connor Scott McManus; Pexels Free License',
  video_credit='CrashCourse — Legal System Basics: Government and Politics #18' WHERE career_key='derecho';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-administracion.jpg',
  video_url='https://www.youtube.com/watch?v=UHiUYj5EA0w',
  image_credit='Pexels Free License; Ketut Subiyanto; Pexels Free License',
  video_credit='CrashCourse — Productivity and Growth' WHERE career_key='administracion';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-contabilidad.jpg',
  video_url='https://www.youtube.com/watch?v=yYX4bvQSqbo',
  image_credit='Pixabay / Pexels; CC0 1.0 (Pexels listing identifies asset as free to use)',
  video_credit='Accounting Stuff — Accounting Basics: a Guide to (Almost) Everything' WHERE career_key='contabilidad';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-educacion.jpg',
  video_url='https://www.youtube.com/watch?v=IhuwS5ZLwKY',
  image_credit='Pavel Danilyuk / Pexels; Pexels Free License',
  video_credit='CrashCourse — Crash Course Study Skills Preview' WHERE career_key='educacion';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-psicologia.jpg',
  video_url='https://www.youtube.com/watch?v=vo4pMVb0R6M',
  image_credit='Pexels Free License; Antoni Shkraba; Pexels Free License',
  video_credit='CrashCourse — Intro to Psychology' WHERE career_key='psicologia';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-comunicacion.jpg',
  video_url='https://www.youtube.com/watch?v=AD7N-1Mj-DU',
  image_credit='Pexels Free License; cottonbro studio; Pexels Free License',
  video_credit='CrashCourse — Introduction to Media Literacy' WHERE career_key='comunicacion';
UPDATE demo_catalog SET image_url='/uploads/programas/demo-v2-economia.jpg',
  video_url='https://www.youtube.com/watch?v=d8uTB5XorBw',
  image_credit='Pixabay / Pexels; CC0 1.0 (Pexels listing identifies asset as free to use)',
  video_credit='CrashCourse — Macroeconomics' WHERE career_key='economia';
-- The user additionally requested media for the original IT offerings; fill missing fields only.
UPDATE programas_academicos
  SET imagen_portada_url=coalesce(nullif(imagen_portada_url,''),'/uploads/programas/demo-v2-ccna.jpg'),
      video_promo_url=coalesce(nullif(video_promo_url,''),'https://www.youtube.com/watch?v=Vi5RPgUH7go')
  WHERE codigo_interno='001-CCNA-NIC';
UPDATE programas_academicos
  SET imagen_portada_url=coalesce(nullif(imagen_portada_url,''),'/uploads/programas/demo-v2-ciberseguridad.jpg'),
      video_promo_url=coalesce(nullif(video_promo_url,''),'https://www.youtube.com/watch?v=bPVaOlJ6ln0')
  WHERE codigo_interno='CIB-SEG-1';
UPDATE programas_academicos
  SET imagen_portada_url=coalesce(nullif(imagen_portada_url,''),'/uploads/programas/demo-v2-ia-redes.jpg'),
      video_promo_url=coalesce(nullif(video_promo_url,''),'https://www.youtube.com/watch?v=VY0s4JUp-K8')
  WHERE codigo_interno='PR-IA-REDES';
-- END VERIFIED PROGRAM MEDIA

DO $$
DECLARE
  r record; p record; component record; obligation record;
  actor uuid := pg_temp.demo_id('operator');
  teacher uuid; student uuid; applicant uuid; degree uuid; enrollment uuid;
  campus uuid := pg_temp.demo_id('campus');
  cohort uuid; schedule uuid; plan uuid; agreement uuid; payment uuid; grade uuid; dossier uuid;
  base_key text; person_key text; enrollment_state text; payment_state text;
  first_name text; last_name text; email text; modality text; course_state text;
  display_code text; cohort_code text; enrollment_code text; person_code text; person_login text; payment_reference text;
  previous_degree text; program_no integer := 0; cohort_days integer; module_count integer; module_days integer;
  phase integer; n integer; module_no integer; variant integer; role_id uuid; area_id uuid; tag_id uuid;
  academic_price numeric(12,2); fee numeric(12,2) := 500;
  paid numeric(12,2); allocated numeric(12,2); score integer;
  start_date date; qualifies boolean;
  names text[] := ARRAY['Ana','José','María','Luis','Lucía','Carlos','Sofía','Diego','Valeria','Andrés',
                       'Camila','Óscar','Isabel','Miguel','Gabriela','Daniel','Elena','Raúl','Paola','Javier'];
  surnames text[] := ARRAY['García','López','Martínez','González','Hernández','Pérez','Ramírez','Torres',
    'Mendoza','Castro','Flores','Morales','Vargas','Reyes','Gutiérrez','Castillo','Navarro','Rojas','Méndez','Rivera'];
BEGIN
  -- Existing role definitions and permissions are reused, never rewritten.
  INSERT INTO roles(nombre, descripcion) VALUES
    ('COORDINADOR','Coordinación académica'),('DOCENTE','Personal docente'),('ESTUDIANTE','Estudiante')
    ON CONFLICT (nombre) DO NOTHING;
  SELECT id INTO STRICT role_id FROM roles WHERE nombre='COORDINADOR';
  INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id,activo,email_verificado)
    VALUES(actor,'demo.operador','demo.operador@example.invalid','!DEMO-LOGIN-DISABLED!',
           'Andrea','Mendoza Castillo',role_id,false,false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO sedes_ies(id,codigo_sede,nombre,tipo_sede,direccion)
    VALUES(campus,'CAMPUS-ACADEMICO','Campus de Formación Profesional','SEDE_CENTRAL','Managua, Nicaragua (ubicación de ejemplo)')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO personal_academico(id,usuario_id,identificacion,nombres,apellidos,maximo_grado_academico,cv_url)
    VALUES(pg_temp.demo_id('coordinator'),actor,'DOC-COORD-001','Andrea','Mendoza Castillo','DOCTOR',
           '/demo/no-documento/cv') ON CONFLICT (id) DO NOTHING;
  FOR n IN 1..8 LOOP
    teacher := pg_temp.demo_id('teacher:'||n);
    SELECT id INTO STRICT role_id FROM roles WHERE nombre='DOCENTE';
    INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id,activo)
      VALUES(teacher,'demo.docente.'||n,'demo.docente.'||n||'@example.invalid','!DEMO-LOGIN-DISABLED!',
             names[n],surnames[n]||' '||surnames[n+8],role_id,false) ON CONFLICT (id) DO NOTHING;
    INSERT INTO personal_academico(id,usuario_id,identificacion,nombres,apellidos,maximo_grado_academico,cv_url)
      VALUES(teacher,teacher,'DOC-2026-'||lpad(n::text,3,'0'),names[n],surnames[n]||' '||surnames[n+8],'DOCTOR','/demo/no-documento/cv')
      ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR r IN SELECT DISTINCT area_key,area_name FROM demo_catalog LOOP
    IF NOT EXISTS (SELECT FROM areas_conocimiento WHERE nombre=r.area_name) THEN
      INSERT INTO areas_conocimiento(id,nombre,slug)
        VALUES(pg_temp.demo_id('area:'||r.area_key),r.area_name,'formacion-'||r.area_key)
        ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM demo_catalog ORDER BY career_key LOOP
    SELECT id INTO STRICT area_id FROM areas_conocimiento WHERE nombre=r.area_name;
    IF NOT EXISTS (SELECT FROM tags_academicos WHERE nombre=r.career_name) THEN
      INSERT INTO tags_academicos(id,nombre,slug)
        VALUES(pg_temp.demo_id('tag:'||r.career_key),r.career_name,'formacion-'||r.career_key)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    SELECT id INTO STRICT tag_id FROM tags_academicos WHERE nombre=r.career_name;
    FOR variant IN 1..2 LOOP
      base_key := 'program:'||r.career_key||':'||variant;
      INSERT INTO programas_academicos(id,codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,
        resumen_corto_web,descripcion_comercial,imagen_portada_url,video_promo_url,precio_total_referencia,visible_en_web,es_ciencias_salud,
        aval_minsa_url,duracion_meses,horas_totales,creditos_totales,creditos_investigacion,
        requiere_titulo_grado_rn,titulo_o_certificado_otorgado)
      VALUES(pg_temp.demo_id(base_key),(CASE variant WHEN 1 THEN 'MAE-' ELSE 'DIP-' END)||r.short_code,
        (CASE variant WHEN 1 THEN 'Maestría Profesional en ' ELSE 'Diplomado Profesional en ' END)||r.focus,
        'formacion-'||r.career_key||'-'||variant,
        (CASE variant WHEN 1 THEN 'POSGRADO' ELSE 'EDUCACION_PERMANENTE' END)::categoria_programa_enum,
        (CASE variant WHEN 1 THEN 'MAESTRIA_PROFESIONAL' ELSE 'DIPLOMADO_PROFESIONAL' END)::subtipo_programa_enum,
        area_id,'Formación aplicada en '||r.focus||' con estudio de casos y proyecto final.',
        'Desarrolla competencias en '||r.focus||' mediante estudio de casos, actividades prácticas y un proyecto aplicado. '
          ||'Registro de demostración; no constituye una oferta institucional aprobada. Imagen: '||coalesce(r.image_credit,'')
          ||'. Video educativo de referencia: '||coalesce(r.video_credit,'')||'.',
        r.image_url,r.video_url,
        CASE variant WHEN 1 THEN 24000 ELSE 4000 END,true,r.area_key='salud',
        CASE WHEN r.area_key='salud' THEN '/demo/no-documento/aval-minsa' END,
        CASE variant WHEN 1 THEN 12 ELSE 4 END,CASE variant WHEN 1 THEN 960 ELSE 160 END,
        CASE variant WHEN 1 THEN 32 ELSE 4 END,CASE variant WHEN 1 THEN 8 ELSE 0 END,
        variant=1,(CASE variant WHEN 1 THEN 'Máster en ' ELSE 'Diploma en ' END)||r.focus) ON CONFLICT (id) DO NOTHING;
      INSERT INTO programas_tags(programa_id,tag_id)
        VALUES(pg_temp.demo_id(base_key),tag_id) ON CONFLICT DO NOTHING;
      FOR module_no IN 1..4 LOOP
        INSERT INTO componentes_curriculares(id,programa_id,codigo,nombre,descripcion_temario,orden_bloque,
          horas,creditos,es_investigacion,es_modalidad_graduacion,costo_base_asignatura)
        VALUES(pg_temp.demo_id(base_key||':module:'||module_no),pg_temp.demo_id(base_key),r.short_code||'-M'||module_no,
          r.modules[module_no],
          'Estudio de casos, actividades prácticas y evaluación de '||lower(r.modules[module_no])||'.',module_no,
          CASE variant WHEN 1 THEN 240 ELSE 40 END,CASE variant WHEN 1 THEN 8 ELSE 1 END,
          module_no=4 AND variant=1,module_no=4,CASE variant WHEN 1 THEN 6000 ELSE 1000 END)
          ON CONFLICT (id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Every program already in the selected demo DB is included, even if hidden.
  -- Its original curriculum, price, visibility and state are never changed.
  FOR p IN SELECT * FROM programas_academicos ORDER BY codigo_interno,id LOOP
    program_no := program_no+1;
    base_key := 'existing-program:'||p.id;
    display_code := left(trim(both '-' FROM regexp_replace(upper(p.codigo_interno),'[^A-Z0-9]+','-','g')),18);
    IF display_code='' OR EXISTS (SELECT FROM programas_academicos other WHERE other.id<>p.id
      AND left(trim(both '-' FROM regexp_replace(upper(other.codigo_interno),'[^A-Z0-9]+','-','g')),18)=display_code) THEN
      RAISE EXCEPTION 'A unique readable program code of at most 18 characters is required for %',p.codigo_interno;
    END IF;
    SELECT count(*)::integer INTO module_count FROM componentes_curriculares WHERE programa_id=p.id;
    cohort_days := greatest(coalesce((p.duracion_meses*30)::integer,180),30,module_count);
    module_days := greatest(cohort_days/greatest(module_count,1),1);
    SELECT degree_name INTO previous_degree FROM demo_catalog
      WHERE pg_temp.demo_id('program:'||career_key||':1')=p.id OR pg_temp.demo_id('program:'||career_key||':2')=p.id;
    previous_degree := coalesce(previous_degree,'Título universitario afín a '||left(p.nombre,120));
    academic_price := greatest(p.precio_total_referencia,0);
    modality := CASE WHEN p.es_ciencias_salud THEN 'PRESENCIAL' ELSE 'SEMIPRESENCIAL' END;
    FOR phase IN 1..3 LOOP
      cohort := pg_temp.demo_id(base_key||':cohort:'||phase);
      start_date := CASE phase WHEN 1 THEN current_date+30 WHEN 2 THEN current_date-cohort_days/2
        ELSE current_date-cohort_days-90 END;
      cohort_code := display_code||'-'||extract(year FROM start_date)::integer||'-'||(ARRAY['I','II','III'])[phase];
      course_state := (ARRAY['INSCRIPCION_ABIERTA','EN_EJECUCION','EVALUADA_SETEC'])[phase];
      INSERT INTO cohortes_apertura(id,programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,
        fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,horario_general,
        precio_matricula,precio_total_cohorte,cupo_minimo,cupo_maximo,cupos_actuales_verificados,cobro_habilitado,estado_cohorte)
      VALUES(cohort,p.id,campus,modality::modalidad_educativa_enum,cohort_code,
        phase,pg_temp.demo_id('coordinator'),start_date-60,start_date-1,start_date,
        start_date+cohort_days-1,
        'Sábados de 08:00 a 16:00',fee,academic_price,15,30,
        CASE phase WHEN 1 THEN 14 WHEN 2 THEN 18 ELSE 20 END,phase>1,course_state)
        ON CONFLICT (id) DO NOTHING;
      plan := pg_temp.demo_id(cohort||':plan');
      INSERT INTO planes_pago_cohorte(id,cohorte_id,nombre,version,modalidad,predeterminado,monto_matricula,precio_academico,creado_por)
        VALUES(plan,cohort,'Matrícula y arancel académico',1,'PAGO_UNICO',true,fee,academic_price,actor)
        ON CONFLICT (id) DO NOTHING;
      IF academic_price>0 THEN
        INSERT INTO cuotas_plan_pago(id,plan_id,numero,concepto,importe,fecha_vencimiento)
          VALUES(pg_temp.demo_id(plan||':quota'),plan,1,'Arancel académico de '||left(p.nombre,190),academic_price,start_date+30)
          ON CONFLICT (id) DO NOTHING;
      END IF;
      module_no := 0;
      FOR component IN SELECT * FROM componentes_curriculares WHERE programa_id=p.id ORDER BY orden_bloque,id LOOP
        module_no := module_no+1;
        schedule := pg_temp.demo_id(cohort||':schedule:'||component.id);
        teacher := pg_temp.demo_id('teacher:'||((module_no-1)%8+1));
        INSERT INTO programacion_componentes_cohorte(id,cohorte_id,componente_id,docente_titular_id,fecha_inicio,fecha_fin,horario,aula)
          VALUES(schedule,cohort,component.id,teacher,start_date+(module_no-1)*module_days,
            CASE WHEN module_no=module_count THEN start_date+cohort_days-1 ELSE start_date+module_no*module_days-1 END,
            'Sábados de 08:00 a 16:00','Aula A-'||lpad(module_no::text,2,'0')) ON CONFLICT (id) DO NOTHING;
        INSERT INTO virtual_classroom_courses(id,schedule_id,shortname,category,teacher_role,fullname,summary,updated_by)
          VALUES(pg_temp.demo_id(schedule||':lms'),schedule,cohort_code||'-M'||module_no,'Formación Profesional',
            'editingteacher',left(component.nombre||' · '||cohort_code,254),'Curso de ejemplo para intercambio académico; sin sincronización externa.',actor)
          ON CONFLICT (id) DO NOTHING;
      END LOOP;

      FOR n IN 1..20 LOOP
        person_key := cohort||':student:'||n;
        student := pg_temp.demo_id(person_key||':user'); applicant := pg_temp.demo_id(person_key);
        degree := pg_temp.demo_id(person_key||':degree'); enrollment := pg_temp.demo_id(person_key||':enrollment');
        first_name := names[(n+phase+program_no-3)%array_length(names,1)+1];
        last_name := surnames[(n+program_no-2)%array_length(surnames,1)+1]||' '||surnames[(n*3+phase+program_no-2)%array_length(surnames,1)+1];
        person_code := display_code||'-'||extract(year FROM start_date)::integer||'-'||phase||'-'||lpad(n::text,2,'0');
        person_login := left(translate(lower(first_name||'.'||split_part(last_name,' ',1)),'áéíóúüñ','aeiouun'),20)||'.'||lower(person_code);
        email := person_login||'@example.test';
        enrollment_code := 'EXP-'||person_code;
        payment_reference := 'TRF-'||person_code;
        SELECT id INTO STRICT role_id FROM roles WHERE nombre='ESTUDIANTE';
        INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id,activo)
          VALUES(student,person_login,email,'!DEMO-LOGIN-DISABLED!',
            first_name,last_name,role_id,false) ON CONFLICT (id) DO NOTHING;
        qualifies := phase>1 OR n>6;
        INSERT INTO personas_aspirantes(id,usuario_id,tipo_identificacion,numero_identificacion,nombres,apellidos,
          fecha_nacimiento,email,telefono,identidad_verificada,fecha_verificacion,verificado_por_usuario_id)
          VALUES(applicant,student,'PASAPORTE','EST-'||person_code,first_name,last_name,
            date '1978-01-01'+((program_no*113+phase*277+n*397)%7000),email,
            '+505 8'||lpad((program_no*1000+phase*100+n)::text,7,'0'),qualifies,
            CASE WHEN qualifies THEN least(start_date-15,current_date-1)::timestamptz END,CASE WHEN qualifies THEN actor END)
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO aspirantes_intereses_areas(aspirante_id,area_conocimiento_id)
          VALUES(applicant,p.area_conocimiento_id) ON CONFLICT DO NOTHING;
        INSERT INTO titulos_academicos_aspirante(id,aspirante_id,area_conocimiento_id,nivel_titulo,denominacion_titulo,
          institucion_emisora,fecha_emision,titulo_pdf_url,estado_validacion,fecha_validacion,usuario_validador_id,
          inscrito_registro_nacional,codigo_registro_nacional)
          VALUES(degree,applicant,p.area_conocimiento_id,
            CASE WHEN p.subtipo='POSDOCTORADO' THEN 'DOCTORADO'
              WHEN p.subtipo='DOCTORADO_MAESTRIA' THEN 'MAESTRIA' ELSE 'GRADO' END,left(previous_degree,200),
            'Universidad de Estudios Aplicados (simulada)',date '2020-12-15','/demo/no-documento/titulo',
            CASE WHEN qualifies THEN 'VALIDADO' ELSE 'PENDIENTE' END,
            CASE WHEN qualifies THEN least(start_date-15,current_date-1)::timestamptz END,CASE WHEN qualifies THEN actor END,
            qualifies AND p.requiere_titulo_grado_rn,CASE WHEN qualifies AND p.requiere_titulo_grado_rn THEN 'RN-'||person_code END)
          ON CONFLICT (id) DO NOTHING;
        enrollment_state := CASE
          WHEN phase=1 THEN CASE WHEN n<=3 THEN 'EN_REVISION_DOCUMENTAL' WHEN n<=6 THEN 'DOCUMENTACION_OBSERVADA' ELSE 'INSCRITO_RESERVADO' END
          WHEN phase=2 THEN CASE WHEN n<=16 THEN 'MATRICULADO_ACTIVO' WHEN n=17 THEN 'PENDIENTE_PAGO' WHEN n=18 THEN 'PAGO_EN_REVISION' WHEN n=19 THEN 'RETIRADO' ELSE 'LISTA_ESPERA' END
          ELSE 'EGRESADO' END;
        INSERT INTO inscripciones(id,codigo_expediente,aspirante_id,cohorte_id,titulo_presentado_id,estado,
          observaciones_administracion,acepta_compromiso_idioma_y_publicacion,fecha_inscripcion,
          fecha_aprobacion_documental,fecha_formalizacion_matricula)
          VALUES(enrollment,enrollment_code,applicant,cohort,degree,
            enrollment_state::estado_inscripcion_enum,'Registro sintético para presentación.',true,least(start_date-30,current_date-20)::timestamptz,
            CASE WHEN qualifies THEN least(start_date-15,current_date-1)::timestamptz END,
            CASE WHEN phase=3 OR (phase=2 AND n<=16) THEN start_date::timestamptz END)
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO virtual_classroom_accounts(id,person_type,person_id,username,verified,firstname,lastname,email,updated_by)
          VALUES(pg_temp.demo_id(student||':lms'),'user',student,person_login,
            false,first_name,last_name,email,actor) ON CONFLICT (id) DO NOTHING;

        IF phase=3 OR (phase=2 AND n<=18) THEN
          agreement := pg_temp.demo_id(enrollment||':agreement');
          INSERT INTO planes_asignados_inscripcion(inscripcion_id,plan_id,asignado_por)
            VALUES(enrollment,plan,actor) ON CONFLICT (inscripcion_id) DO NOTHING;
          INSERT INTO acuerdos_pago_inscripcion(id,inscripcion_id,plan_id,nombre_plan,modalidad,monto_matricula,precio_academico,aceptado_por)
            VALUES(agreement,enrollment,plan,'Matrícula y arancel académico','PAGO_UNICO',fee,academic_price,actor)
            ON CONFLICT (id) DO NOTHING;
          INSERT INTO obligaciones_pago(id,acuerdo_id,inscripcion_id,numero,tipo,concepto,importe,fecha_vencimiento)
            VALUES(pg_temp.demo_id(agreement||':fee'),agreement,enrollment,0,'MATRICULA','Matrícula de '||cohort_code,fee,start_date-1)
            ON CONFLICT (id) DO NOTHING;
          IF academic_price>0 THEN
            INSERT INTO obligaciones_pago(id,acuerdo_id,inscripcion_id,numero,tipo,concepto,importe,fecha_vencimiento)
              VALUES(pg_temp.demo_id(agreement||':academic'),agreement,enrollment,1,'ACADEMICO',
                'Arancel académico de '||left(p.nombre,190),academic_price,start_date+30) ON CONFLICT (id) DO NOTHING;
          END IF;
          IF phase=3 OR n<>17 THEN
            payment := pg_temp.demo_id(enrollment||':payment');
            paid := CASE WHEN phase=3 OR n%3=0 THEN fee+academic_price ELSE fee END;
            payment_state := CASE WHEN phase=2 AND n=18 THEN 'PENDIENTE_REVISION' ELSE 'APROBADO' END;
            INSERT INTO pagos_inscripcion(id,inscripcion_id,aspirante_id,metodo_pago,numero_referencia_o_recibo,
              monto_subtotal,total_pagado,concepto,estado,fecha_pago_reportada,usuario_validador_caja_id,fecha_validacion_caja)
              VALUES(payment,enrollment,applicant,'TRANSFERENCIA',payment_reference,paid,paid,
                CASE WHEN paid=fee THEN 'Pago de matrícula' ELSE 'Pago de matrícula y arancel académico' END,payment_state::estado_pago_enum,
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
                  'apellidos',last_name,'identificacion','EST-'||person_code),
                'programa',p.nombre,'cohorte',cohort_code,
                'expediente',enrollment_code,'total',paid::text,
                'metodo_pago','TRANSFERENCIA','referencia',payment_reference,
                'fecha_pago',(SELECT fecha_pago_reportada FROM pagos_inscripcion WHERE id=payment),
                'conceptos',(SELECT jsonb_agg(jsonb_build_object('concepto',o.concepto,'tipo',o.tipo,'importe',a.importe::text) ORDER BY o.numero)
                  FROM aplicaciones_pago a JOIN obligaciones_pago o ON o.id=a.obligacion_id WHERE a.pago_id=payment))
              WHERE NOT EXISTS (SELECT FROM comprobantes_internos WHERE id=pg_temp.demo_id(payment||':receipt'))
              ON CONFLICT (id) DO NOTHING;
            END IF;
          END IF;
          INSERT INTO auditoria_economica(id,inscripcion_id,cohorte_id,usuario_id,accion,motivo,detalle)
            VALUES(pg_temp.demo_id(enrollment||':audit'),enrollment,cohort,actor,'DEMO_CARGA_INICIAL',
              'Datos sintéticos; no representa una operación económica real.',jsonb_build_object('demo',true,'version',2))
            ON CONFLICT (id) DO NOTHING;
        END IF;

        IF phase=3 OR (phase=2 AND n<=16) THEN
          module_no := 0;
          FOR component IN SELECT * FROM componentes_curriculares WHERE programa_id=p.id ORDER BY orden_bloque,id LOOP
            module_no := module_no+1;
            schedule := pg_temp.demo_id(cohort||':schedule:'||component.id);
            IF phase=2 AND (SELECT fecha_fin FROM programacion_componentes_cohorte WHERE id=schedule)>=current_date THEN CONTINUE; END IF;
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
            VALUES(dossier,enrollment,CASE WHEN p.categoria='POSGRADO' THEN 'TITULO_POSGRADO'
              WHEN p.subtipo IN ('DIPLOMADO_PROFESIONAL','DIPLOMADO_EXTENSION') THEN 'DIPLOMA_PROFESIONAL' ELSE 'CERTIFICADO_APROBACION' END,
              'Inglés',CASE WHEN p.idioma_egreso_requerido='NINGUNO' THEN 'B2'::nivel_idioma_mcer_enum ELSE p.idioma_egreso_requerido END,
              true,'PROYECTO','Plan de mejora aplicado a '||left(p.nombre,180)) ON CONFLICT (id) DO NOTHING;
          IF p.categoria='POSGRADO' THEN
            INSERT INTO publicaciones_cientificas_estudiante(id,expediente_graduacion_id,tipo_publicacion,titulo_publicacion,
              nombre_revista_o_medio,alcance,url_o_doi,evidencia_pdf_url,validado_coordinacion)
              VALUES(pg_temp.demo_id(dossier||':publication'),dossier,'ARTICULO_CIENTIFICO',left('Evaluación de un proyecto de '||p.nombre,300),
                'Cuadernos de Formación Aplicada (simulada)','UNIVERSITARIA','https://example.invalid/demo/publicacion',
                '/demo/no-documento/publicacion',true) ON CONFLICT (id) DO NOTHING;
          END IF;
        END IF;
        IF phase=2 AND n=17 THEN
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
           WHERE id IN (SELECT pg_temp.demo_id('teacher:'||series.teacher_no) FROM generate_series(1,8) AS series(teacher_no)) LOOP
    INSERT INTO virtual_classroom_accounts(id,person_type,person_id,username,verified,firstname,lastname,email,updated_by)
      VALUES(pg_temp.demo_id(r.usuario_id||':lms'),'user',r.usuario_id,'docente.'||translate(lower(r.nombres||'.'||split_part(r.apellidos,' ',1)),'áéíóúüñ','aeiouun'),
        false,r.nombres,r.apellidos,'demo.docente@example.invalid',actor) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Empty tables for sessions, real document registries, file imports/exports and
-- previews are intentional: no tokens, real PDFs or external operations are fabricated.
SELECT p.codigo_interno,p.nombre,count(DISTINCT c.id) AS cohortes_demo,
       count(i.id) AS inscripciones_demo
FROM programas_academicos p
JOIN cohortes_apertura c ON c.programa_id=p.id AND c.sede_id=pg_temp.demo_id('campus')
LEFT JOIN inscripciones i ON i.cohorte_id=c.id AND i.codigo_expediente LIKE 'EXP-%'
GROUP BY p.id ORDER BY p.nombre;
COMMIT;
