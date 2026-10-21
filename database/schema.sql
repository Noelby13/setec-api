-- Habilitar extensión para UUIDs en PostgreSQL (si es menor a PG 13, aunque gen_random_uuid() es nativo en PG 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS NORMATIVOS (SETEC NT-GC-02-GDC) Y OPERATIVOS
-- ============================================================================

CREATE TYPE categoria_programa_enum AS ENUM ('POSGRADO', 'EDUCACION_PERMANENTE');

CREATE TYPE subtipo_programa_enum AS ENUM (
    -- Posgrado (Art. 58 - 81)
    'ESPECIALIDAD',
    'MAESTRIA_PROFESIONAL',
    'MAESTRIA_ACADEMICA',
    'DOCTORADO_LICENCIATURA',
    'DOCTORADO_MAESTRIA',
    'POSDOCTORADO',
    -- Educación Permanente (Art. 84 - 92)
    'CURSO_ESPECIALIZADO',
    'CURSO_EXTENSION',
    'TALLER',
    'SEMINARIO',
    'CONGRESO',
    'DIPLOMADO_PROFESIONAL',
    'DIPLOMADO_EXTENSION'
);

CREATE TYPE modalidad_educativa_enum AS ENUM (
    'PRESENCIAL',          -- Art. 96
    'SEMIPRESENCIAL',      -- Art. 97 (Por encuentro)
    'VIRTUAL',             -- Art. 98, 99 (Prohibido en Salud)
    'MIXTA'                -- Art. 100
);

CREATE TYPE nivel_idioma_mcer_enum AS ENUM ('NINGUNO', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2');

CREATE TYPE estado_inscripcion_enum AS ENUM (
    'BORRADOR',
    'EN_REVISION_DOCUMENTAL',     -- Admin revisando título y cédula
    'DOCUMENTACION_OBSERVADA',    -- Admin rechazó algún documento para que el alumno corrija
    'PENDIENTE_COMITE_PONENCIA',  -- Para Congresos rol PONENTE
    'LISTA_ESPERA',               -- Cuando cohorte > 30 en Posgrado
    'INSCRITO_RESERVADO',         -- Documentos OK, esperando quórum >= 15 para habilitar cobro
    'PENDIENTE_PAGO',             -- Quórum alcanzado, esperando baucher o pago en caja
    'PAGO_EN_REVISION',           -- Estudiante subió baucher, esperando validación de caja/admin
    'MATRICULADO_ACTIVO',         -- Todo validado y pagado
    'RETIRADO',
    'EGRESADO',
    'GRADUADO_O_CERTIFICADO'
);

CREATE TYPE rol_participacion_ep_enum AS ENUM (
    'ESTUDIANTE_EVALUADO',
    'PARTICIPANTE_ASISTENTE',
    'PONENTE_CONGRESO'
);

CREATE TYPE escala_cualitativa_snepa_enum AS ENUM (
    'APRENDIZAJE_AVANZADO',
    'APRENDIZAJE_SATISFACTORIO',
    'APRENDIZAJE_FUNDAMENTAL',
    'APRENDIZAJE_INICIAL'
);

CREATE TYPE metodo_pago_enum AS ENUM ('BAUCHER_BANCARIO', 'CAJA_ADMINISTRATIVA', 'TRANSFERENCIA', 'PASARELA_ONLINE');
CREATE TYPE estado_pago_enum AS ENUM ('PENDIENTE_REVISION', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- ============================================================================
-- 2. MÓDULO DE SEGURIDAD, AUTENTICACIÓN Y USUARIOS (Heredado de V2 -> UUID)
-- ============================================================================

CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL, -- Ej: 'CURSO_CREAR', 'NOTA_IMPORTAR', 'PAGO_VALIDAR'
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) UNIQUE NOT NULL, -- Ej: 'SUPER_ADMIN', 'COORDINADOR', 'CAJERO', 'DOCENTE', 'ESTUDIANTE'
    descripcion TEXT
);

CREATE TABLE roles_permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id UUID NOT NULL REFERENCES roles(id),
    permiso_id UUID NOT NULL REFERENCES permisos(id),
    UNIQUE(rol_id, permiso_id)
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(60) UNIQUE,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(30),
    avatar_url TEXT,
    rol_id UUID NOT NULL REFERENCES roles(id),
    activo BOOLEAN DEFAULT TRUE,
    email_verificado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sesiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    direccion_ip VARCHAR(48),
    user_agent TEXT,
    payload TEXT,
    refresh_token_hash VARCHAR(255) NOT NULL,
    is_token_revocado BOOLEAN DEFAULT FALSE,
    creacion_token TIMESTAMPTZ DEFAULT NOW(),
    expiracion_token TIMESTAMPTZ NOT NULL,
    ultima_actividad TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. TAXONOMÍA Y MOTOR DE RECOMENDACIONES (Para sugerir cursos tipo Udemy)
-- ============================================================================

CREATE TABLE areas_conocimiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(120) UNIQUE NOT NULL, -- Ej: 'Ciencias de la Salud', 'Ingeniería y Tecnología'
    slug VARCHAR(140) UNIQUE NOT NULL,
    icono_url TEXT,
    activa BOOLEAN DEFAULT TRUE
);

CREATE TABLE tags_academicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(80) UNIQUE NOT NULL,  -- Ej: 'Ciberseguridad', 'Redes', 'Salud Pública', 'Ultrasonido'
    slug VARCHAR(100) UNIQUE NOT NULL
);

-- ============================================================================
-- 4. INFRAESTRUCTURA Y PERSONAL ACADÉMICO / DOCENTES (SETEC Art. 22-28)
-- ============================================================================

CREATE TABLE sedes_ies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_sede VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    tipo_sede VARCHAR(30) NOT NULL CHECK (tipo_sede IN ('SEDE_CENTRAL', 'SEDE', 'SUBSEDE', 'EXTENSION', 'UNICAM')),
    resolucion_autorizacion_setec VARCHAR(100),
    direccion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE personal_academico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL, -- Vínculo para login del docente/coordinador
    identificacion VARCHAR(30) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    maximo_grado_academico VARCHAR(50) NOT NULL CHECK (maximo_grado_academico IN ('LICENCIADO', 'ESPECIALISTA', 'MASTER', 'DOCTOR')),
    biografia_comercial TEXT,                       -- Para mostrar "Acerca del Instructor" estilo Udemy
    foto_perfil_url TEXT,
    cv_url TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. CATÁLOGO DE PROGRAMAS, MARKETING UDEMY Y DISEÑO CURRICULAR
-- ============================================================================

CREATE TABLE programas_academicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_interno VARCHAR(30) UNIQUE NOT NULL,
    codigo_dictamen_setec VARCHAR(80) UNIQUE,       -- Nullable en borradores o cursos de extensión libres si aplica
    fecha_aprobacion_setec DATE,
    nombre VARCHAR(250) NOT NULL,
    slug VARCHAR(280) UNIQUE NOT NULL,              -- Para URL amigable en la web de ventas
    categoria categoria_programa_enum NOT NULL,
    subtipo subtipo_programa_enum NOT NULL,
    area_conocimiento_id UUID NOT NULL REFERENCES areas_conocimiento(id),
    
    -- Campos Comerciales / Escaparate Web (Estilo Udemy - Fusionado de V2)
    resumen_corto_web VARCHAR(500),                 -- Subtítulo comercial en la tarjeta del curso
    descripcion_comercial TEXT,                     -- Qué aprenderás, requisitos comerciales, etc.
    imagen_portada_url TEXT,
    video_promo_url TEXT,
    brochure_pdf_url TEXT,
    precio_total_referencia NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    descuento_porcentaje INT DEFAULT 0 CHECK (descuento_porcentaje BETWEEN 0 AND 100),
    visible_en_web BOOLEAN DEFAULT FALSE,           -- Flag para publicar/ocultar en la tienda pública
    
    -- Rigor Normativo SETEC
    es_ciencias_salud BOOLEAN DEFAULT FALSE,
    aval_minsa_url TEXT,
    duracion_meses NUMERIC(4,1),
    horas_totales INT NOT NULL,
    creditos_totales INT NOT NULL DEFAULT 0,
    creditos_investigacion INT NOT NULL DEFAULT 0,
    
    -- Continuidad y salidas intermedias (Art. 68, 73, 78, 85, 91)
    permite_continuidad_doctorado BOOLEAN DEFAULT FALSE,
    programa_salida_intermedia_id UUID REFERENCES programas_academicos(id),
    programa_destino_acreditable_id UUID REFERENCES programas_academicos(id), -- Para recomendar la Maestría si llevó el Curso/Diplomado
    es_acreditable_a_posgrado BOOLEAN DEFAULT FALSE,
    estructurado_por_cursos BOOLEAN DEFAULT TRUE,
    
    -- Requisitos de ingreso y egreso
    requiere_titulo_grado_rn BOOLEAN DEFAULT FALSE,
    requiere_titulo_profesional BOOLEAN DEFAULT FALSE,
    permite_menores_edad BOOLEAN DEFAULT FALSE,
    idioma_egreso_requerido nivel_idioma_mcer_enum DEFAULT 'NINGUNO',
    num_publicaciones_requeridas INT DEFAULT 0,
    requiere_revista_indexada BOOLEAN DEFAULT FALSE,
    requiere_pares_evaluadores BOOLEAN DEFAULT FALSE,
    
    titulo_o_certificado_otorgado VARCHAR(200) NOT NULL,
    abreviatura_grado VARCHAR(20),
    estado_vigencia VARCHAR(30) DEFAULT 'ACTIVO' CHECK (estado_vigencia IN ('ACTIVO', 'EN_REDISENO', 'PAUSADO', 'LIQUIDADO')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_salud_aval CHECK (NOT es_ciencias_salud OR aval_minsa_url IS NOT NULL),
    CONSTRAINT chk_doctorado_sin_cursos CHECK (
        subtipo NOT IN ('DOCTORADO_LICENCIATURA', 'DOCTORADO_MAESTRIA') OR estructurado_por_cursos = FALSE
    ),
    CONSTRAINT chk_doc_lic_salida_intermedia CHECK (
        subtipo != 'DOCTORADO_LICENCIATURA' OR programa_salida_intermedia_id IS NOT NULL
    )
);

-- Etiquetas del Programa para el Motor de Recomendaciones
CREATE TABLE programas_tags (
    programa_id UUID NOT NULL REFERENCES programas_academicos(id),
    tag_id UUID NOT NULL REFERENCES tags_academicos(id),
    PRIMARY KEY (programa_id, tag_id)
);

-- Malla Curricular / Módulos o Cursos dentro de un Programa (Fusión Modulo/Curso V2 + Componente V1)
CREATE TABLE componentes_curriculares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programa_id UUID NOT NULL REFERENCES programas_academicos(id),
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion_temario TEXT,                       -- Para mostrar el "Contenido del programa" en la web pública
    orden_bloque INT NOT NULL DEFAULT 1,            -- Módulo 1, Módulo 2...
    horas INT NOT NULL,
    creditos INT NOT NULL DEFAULT 0,
    es_investigacion BOOLEAN DEFAULT FALSE,
    es_modalidad_graduacion BOOLEAN DEFAULT FALSE,
    es_practica_profesional BOOLEAN DEFAULT FALSE,
    costo_base_asignatura NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    url_silabo_pdf TEXT,
    UNIQUE(programa_id, codigo)
);


-- ============================================================================
-- 6. COHORTES Y PROGRAMACIÓN DE DOCENTES POR MÓDULO (Fusión Cohorte V1 + GrupoCurso V2)
-- ============================================================================

CREATE TABLE cohortes_apertura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programa_id UUID NOT NULL REFERENCES programas_academicos(id),
    sede_id UUID NOT NULL REFERENCES sedes_ies(id),
    modalidad modalidad_educativa_enum NOT NULL,
    codigo_cohorte VARCHAR(50) UNIQUE NOT NULL,
    numero_edicion INT NOT NULL,
    coordinador_id UUID NOT NULL REFERENCES personal_academico(id),
    
    fecha_inicio_inscripcion DATE NOT NULL,
    fecha_fin_inscripcion DATE NOT NULL,
    fecha_inicio_clases DATE NOT NULL,
    fecha_fin_clases DATE NOT NULL,
    horario_general VARCHAR(255),                   -- Ej: "Sábados de 8:00 AM a 4:00 PM" (Visible en web)
    
    -- Precios específicos de esta edición/cohorte
    precio_matricula NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    precio_total_cohorte NUMERIC(12,2) NOT NULL,
    descuento_porcentaje INT DEFAULT 0,
    
    -- Control de Cupos Normativos (Art. 34: Posgrado 15-30)
    cupo_minimo INT NOT NULL DEFAULT 15,
    cupo_maximo INT NOT NULL DEFAULT 30,
    cupos_actuales_verificados INT NOT NULL DEFAULT 0, -- Se incrementa al validar documentos
    cobro_habilitado BOOLEAN DEFAULT FALSE,            -- Se activa cuando cupos_actuales_verificados >= cupo_minimo
    tiene_excepcion_cupo_setec BOOLEAN DEFAULT FALSE,
    excepcion_cupo_setec_url TEXT,
    
    estado_cohorte VARCHAR(30) DEFAULT 'PLANIFICADA' CHECK (
        estado_cohorte IN ('PLANIFICADA', 'INSCRIPCION_ABIERTA', 'QUORUM_ALCANZADO_COBRANDO', 'EN_EJECUCION', 'FINALIZADA_PENDIENTE_EVAL', 'EVALUADA_SETEC', 'CANCELADA')
    ),
    informe_evaluacion_cohorte_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla que une la Cohorte con cada Módulo/Curso y su Docente (Equivalente a GrupoCurso de V2)
CREATE TABLE programacion_componentes_cohorte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohorte_id UUID NOT NULL REFERENCES cohortes_apertura(id),
    componente_id UUID NOT NULL REFERENCES componentes_curriculares(id),
    docente_titular_id UUID REFERENCES personal_academico(id),
    fecha_inicio DATE,
    fecha_fin DATE,
    horario VARCHAR(255),
    aula VARCHAR(60),
    codigo_aula_virtual_externa VARCHAR(100),       -- ID de referencia por si el otro equipo (LMS) necesita mapear el grupo
    actas_notas_cerradas BOOLEAN DEFAULT FALSE,
    UNIQUE(cohorte_id, componente_id)
);

-- ============================================================================
-- 7. PERFIL DEL ESTUDIANTE, TÍTULOS Y PREFERENCIAS
-- ============================================================================

CREATE TABLE personas_aspirantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID UNIQUE REFERENCES usuarios(id), -- Relación 1:1 con su cuenta de login web
    tipo_identificacion VARCHAR(20) NOT NULL CHECK (tipo_identificacion IN ('CEDULA', 'PASAPORTE', 'CEDULA_RESIDENCIA', 'PARTIDA_NACIMIENTO')),
    numero_identificacion VARCHAR(40) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    cedula_identidad_pdf_url TEXT,
    
    -- Verificación general de perfil por Administración (De tu V2: Estudiante.isVerificado)
    identidad_verificada BOOLEAN DEFAULT FALSE,
    fecha_verificacion TIMESTAMPTZ,
    verificado_por_usuario_id UUID REFERENCES usuarios(id),
    
    -- Política de Inclusividad y Discapacidad (Anexo SNEPA)
    tiene_discapacidad BOOLEAN DEFAULT FALSE,
    descripcion_ajuste_razonable TEXT,
    
    -- Tutor legal (Para menores de edad en Cursos de Extensión - Art. 86)
    tutor_nombre_completo VARCHAR(200),
    tutor_identificacion VARCHAR(40),
    tutor_documento_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intereses del Estudiante (Para alimentar el motor de recomendaciones desde que se crea la cuenta)
CREATE TABLE aspirantes_intereses_areas (
    aspirante_id UUID NOT NULL REFERENCES personas_aspirantes(id),
    area_conocimiento_id UUID NOT NULL REFERENCES areas_conocimiento(id),
    PRIMARY KEY (aspirante_id, area_conocimiento_id)
);

-- Títulos Previos del Aspirante (Para validar ingreso SETEC y recomendar cursos afines a su carrera)
CREATE TABLE titulos_academicos_aspirante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aspirante_id UUID NOT NULL REFERENCES personas_aspirantes(id),
    area_conocimiento_id UUID REFERENCES areas_conocimiento(id), -- Clave para recomendarle posgrados de su carrera
    nivel_titulo VARCHAR(40) NOT NULL CHECK (nivel_titulo IN ('TECNICO_SUPERIOR', 'GRADO', 'ESPECIALIDAD', 'MAESTRIA', 'DOCTORADO', 'CARTA_EGRESADO')),
    denominacion_titulo VARCHAR(200) NOT NULL,
    institucion_emisora VARCHAR(200) NOT NULL,
    fecha_emision DATE NOT NULL,
    
    inscrito_registro_nacional BOOLEAN DEFAULT FALSE,
    codigo_registro_nacional VARCHAR(80),
    certificado_rn_url TEXT,
    titulo_pdf_url TEXT NOT NULL,
    porcentaje_creditos_investigacion NUMERIC(5,2),
    
    -- Validación Administrativa
    estado_validacion VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado_validacion IN ('PENDIENTE', 'VALIDADO', 'RECHAZADO')),
    observacion_rechazo TEXT,
    fecha_validacion TIMESTAMPTZ,
    usuario_validador_id UUID REFERENCES usuarios(id)
);

-- ============================================================================
-- 8. INSCRIPCIONES, CAJA/BAUCHERS Y CONVALIDACIONES
-- ============================================================================

CREATE TABLE inscripciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_expediente VARCHAR(40) UNIQUE NOT NULL,
    aspirante_id UUID NOT NULL REFERENCES personas_aspirantes(id),
    cohorte_id UUID NOT NULL REFERENCES cohortes_apertura(id),
    titulo_presentado_id UUID REFERENCES titulos_academicos_aspirante(id), -- Con qué título respalda su ingreso a este posgrado
    estado estado_inscripcion_enum NOT NULL DEFAULT 'EN_REVISION_DOCUMENTAL',
    observaciones_administracion TEXT,              -- Por si admin le rechaza un documento o baucher
    
    -- Rol específico para Educación Permanente
    rol_participacion rol_participacion_ep_enum NOT NULL DEFAULT 'ESTUDIANTE_EVALUADO',
    titulo_ponencia VARCHAR(250),
    resumen_ponencia TEXT,
    archivo_ponencia_url TEXT,
    
    -- Flags de Reingreso / Continuidad
    es_reingreso_cambio_plan BOOLEAN DEFAULT FALSE,
    inscripcion_origen_id UUID REFERENCES inscripciones(id),
    requiere_nivelacion_investigativa BOOLEAN DEFAULT FALSE,
    
    acepta_compromiso_idioma_y_publicacion BOOLEAN DEFAULT FALSE,
    fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
    fecha_aprobacion_documental TIMESTAMPTZ,
    fecha_formalizacion_matricula TIMESTAMPTZ,
    
    UNIQUE(aspirante_id, cohorte_id)
);

-- Módulo de Facturación, Bauchers y Caja Administrativa (Fusión de InscripcionPago y DetalleInscripcion V2)
CREATE TABLE pagos_inscripcion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id UUID NOT NULL REFERENCES inscripciones(id),
    aspirante_id UUID NOT NULL REFERENCES personas_aspirantes(id),
    metodo_pago metodo_pago_enum NOT NULL,          -- BAUCHER_BANCARIO o CAJA_ADMINISTRATIVA
    numero_referencia_o_recibo VARCHAR(100) NOT NULL, -- Número de minuta bancaria o recibo oficial de caja
    banco_origen VARCHAR(100),
    comprobante_baucher_url TEXT,                   -- Foto/PDF subido por el estudiante o cajero
    
    monto_subtotal NUMERIC(12,2) NOT NULL,
    descuento_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_pagado NUMERIC(12,2) NOT NULL,
    concepto VARCHAR(255) NOT NULL,                 -- Ej: 'Pago Matrícula / Arancel Curso Completo'
    
    estado estado_pago_enum NOT NULL DEFAULT 'PENDIENTE_REVISION',
    motivo_rechazo TEXT,
    fecha_pago_reportada TIMESTAMPTZ DEFAULT NOW(),
    
    -- Auditoría de quién validó el baucher o cobró en caja
    usuario_validador_caja_id UUID REFERENCES usuarios(id),
    fecha_validacion_caja TIMESTAMPTZ
);

-- Motor de Acreditación y Convalidación (SETEC Art. 37, 44, 85, 88, 89, 91)
CREATE TABLE solicitudes_convalidacion_acreditacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_destino_id UUID NOT NULL REFERENCES inscripciones(id),
    componente_destino_id UUID NOT NULL REFERENCES componentes_curriculares(id),
    origen_tipo VARCHAR(40) NOT NULL CHECK (
        origen_tipo IN ('CURSO_ESPECIALIZADO', 'DIPLOMADO_PROFESIONAL', 'SEMINARIO_EVALUADO', 'CONGRESO_PONENTE', 'CAMBIO_PLAN_ESTUDIOS', 'EXTERNO')
    ),
    inscripcion_origen_ep_id UUID REFERENCES inscripciones(id),
    certificado_origen_url TEXT NOT NULL,
    creditos_reconocidos INT NOT NULL CHECK (creditos_reconocidos BETWEEN 1 AND 15),
    justificacion_aporte_perfil TEXT NOT NULL,
    estado_dictamen VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado_dictamen IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    coordinador_dictaminador_id UUID REFERENCES personal_academico(id),
    fecha_dictamen TIMESTAMPTZ
);

-- ============================================================================
-- 9. NOTAS POR EXCEL, AUDITORÍA Y CERTIFICACIONES (Fusión V1 + Nota/NotaLogs V2)
-- ============================================================================

-- Registro de los archivos Excel subidos por los docentes o administración
CREATE TABLE lotes_importacion_notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programacion_componente_id UUID NOT NULL REFERENCES programacion_componentes_cohorte(id),
    subido_por_usuario_id UUID NOT NULL REFERENCES usuarios(id),
    archivo_excel_url TEXT NOT NULL,                -- Evidencia del archivo Excel cargado
    total_registros_procesados INT NOT NULL DEFAULT 0,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calificaciones Oficiales SNEPA por cada estudiante y módulo
CREATE TABLE matricula_componentes_snepa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id UUID NOT NULL REFERENCES inscripciones(id),
    programacion_componente_id UUID NOT NULL REFERENCES programacion_componentes_cohorte(id),
    componente_id UUID NOT NULL REFERENCES componentes_curriculares(id),
    lote_importacion_id UUID REFERENCES lotes_importacion_notas(id), -- De qué Excel salió esta nota
    
    es_convalidada BOOLEAN DEFAULT FALSE,
    calificacion_cuantitativa NUMERIC(5,2),
    valoracion_cualitativa escala_cualitativa_snepa_enum,
    observacion_acompanamiento_pedagogico TEXT,
    autoevaluacion_completada BOOLEAN DEFAULT FALSE,
    coevaluacion_completada BOOLEAN DEFAULT FALSE,
    aprobado BOOLEAN DEFAULT FALSE,
    
    es_modificada_manualmente BOOLEAN DEFAULT FALSE, -- Equivalente a Nota.isModificado de tu V2
    registrado_por_usuario_id UUID REFERENCES usuarios(id),
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(inscripcion_id, componente_id)
);

-- Historial de Auditoría de Notas (Tu tabla NotaLogs de la V2 adaptada a SNEPA)
CREATE TABLE notas_snepa_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula_componente_id UUID NOT NULL REFERENCES matricula_componentes_snepa(id),
    nota_anterior NUMERIC(5,2),
    nota_nueva NUMERIC(5,2),
    cualitativa_anterior escala_cualitativa_snepa_enum,
    cualitativa_nueva escala_cualitativa_snepa_enum,
    motivo_modificacion TEXT NOT NULL,
    modificado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_modificacion TIMESTAMPTZ DEFAULT NOW()
);

-- Expediente de Graduación Posgrado y Certificados de Educación Permanente (Visible en el perfil del alumno)
CREATE TABLE expediente_graduacion_certificacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id UUID UNIQUE NOT NULL REFERENCES inscripciones(id),
    
    -- 1. Segundo Idioma (Posgrados)
    idioma_acreditado VARCHAR(50),
    nivel_idioma_alcanzado nivel_idioma_mcer_enum DEFAULT 'NINGUNO',
    institucion_aval_idioma VARCHAR(200),
    certificado_idioma_url TEXT,
    idioma_validado BOOLEAN DEFAULT FALSE,
    
    -- 2. Modalidad de Graduación
    modalidad_graduacion_tipo VARCHAR(50),
    titulo_trabajo_graduacion TEXT,
    acta_defensa_url TEXT,
    
    -- 3. Salida Intermedia
    aplico_salida_intermedia BOOLEAN DEFAULT FALSE,
    titulo_intermedio_emitido_url TEXT,
    
    -- 4. Emisión Final (Aquí lee el estudiante sus certificados desde su portal)
    tipo_documento_final VARCHAR(50) NOT NULL CHECK (
        tipo_documento_final IN ('TITULO_POSGRADO', 'CERTIFICADO_APROBACION', 'CERTIFICADO_PARTICIPACION', 'CERTIFICADO_PONENTE', 'DIPLOMA_PROFESIONAL')
    ),
    codigo_registro_titulo_emitido VARCHAR(80) UNIQUE, -- Para validación por QR o consulta pública
    documento_final_url TEXT,
    fecha_emision DATE,
    emitido_por_usuario_id UUID REFERENCES usuarios(id)
);

CREATE TABLE publicaciones_cientificas_estudiante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_graduacion_id UUID NOT NULL REFERENCES expediente_graduacion_certificacion(id),
    tipo_publicacion VARCHAR(40) NOT NULL CHECK (tipo_publicacion IN ('ENSAYO', 'ARTICULO_CIENTIFICO')),
    titulo_publicacion VARCHAR(300) NOT NULL,
    nombre_revista_o_medio VARCHAR(200) NOT NULL,
    es_revista_indexada BOOLEAN DEFAULT FALSE,
    tiene_revision_pares BOOLEAN DEFAULT FALSE,
    alcance VARCHAR(30) CHECK (alcance IN ('UNIVERSITARIA', 'NACIONAL', 'REGIONAL', 'INTERNACIONAL')),
    url_o_doi TEXT NOT NULL,
    evidencia_pdf_url TEXT NOT NULL,
    validado_coordinacion BOOLEAN DEFAULT FALSE
);

-- Technical registry of existing institutional documents; no automatic issuance.
CREATE TABLE IF NOT EXISTS certificados_registro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID UNIQUE NOT NULL REFERENCES expediente_graduacion_certificacion(id),
    token_publico UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    titular_usuario_id UUID REFERENCES usuarios(id),
    titular_nombre TEXT NOT NULL CHECK (length(trim(titular_nombre)) > 0),
    programa_nombre TEXT NOT NULL,
    cohorte_codigo VARCHAR(80) NOT NULL,
    tipo_documento VARCHAR(50) NOT NULL,
    fecha_emision DATE NOT NULL,
    documento_url TEXT NOT NULL,
    documento_sha256 CHAR(64) NOT NULL CHECK (documento_sha256 ~ '^[0-9a-f]{64}$'),
    estado VARCHAR(10) NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'REVOCADO')),
    registrado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_revocacion TIMESTAMPTZ,
    motivo_revocacion TEXT,
    revocado_por_usuario_id UUID REFERENCES usuarios(id),
    CHECK ((estado = 'VIGENTE' AND fecha_revocacion IS NULL AND motivo_revocacion IS NULL AND revocado_por_usuario_id IS NULL)
        OR (estado = 'REVOCADO' AND fecha_revocacion IS NOT NULL AND motivo_revocacion IS NOT NULL AND length(trim(motivo_revocacion)) BETWEEN 1 AND 1000 AND revocado_por_usuario_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS certificados_registro_titular_idx ON certificados_registro(titular_usuario_id, fecha_emision DESC);
CREATE TABLE IF NOT EXISTS certificados_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificado_id UUID NOT NULL REFERENCES certificados_registro(id),
    accion VARCHAR(12) NOT NULL CHECK (accion IN ('EMITIDO', 'REGISTRADO', 'REVOCADO')),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id UUID NOT NULL REFERENCES usuarios(id),
    motivo TEXT,
    CHECK ((accion = 'REVOCADO' AND motivo IS NOT NULL AND length(trim(motivo)) BETWEEN 1 AND 1000) OR (accion <> 'REVOCADO' AND motivo IS NULL))
);
CREATE INDEX IF NOT EXISTS certificados_eventos_certificado_idx ON certificados_eventos(certificado_id, fecha);

CREATE OR REPLACE FUNCTION proteger_snapshot_certificado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.id, NEW.expediente_id, NEW.token_publico, NEW.titular_usuario_id, NEW.titular_nombre,
           NEW.programa_nombre, NEW.cohorte_codigo, NEW.tipo_documento, NEW.fecha_emision, NEW.documento_url,
           NEW.documento_sha256, NEW.registrado_por_usuario_id, NEW.fecha_registro)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.expediente_id, OLD.token_publico, OLD.titular_usuario_id, OLD.titular_nombre,
           OLD.programa_nombre, OLD.cohorte_codigo, OLD.tipo_documento, OLD.fecha_emision, OLD.documento_url,
           OLD.documento_sha256, OLD.registrado_por_usuario_id, OLD.fecha_registro)
       OR OLD.estado = 'REVOCADO' THEN
        RAISE EXCEPTION 'Certificate snapshot is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS certificados_snapshot_inmutable ON certificados_registro;
CREATE TRIGGER certificados_snapshot_inmutable BEFORE UPDATE ON certificados_registro
    FOR EACH ROW EXECUTE FUNCTION proteger_snapshot_certificado();
