-- Additive academic billing model. Run only against an explicitly authorized database.
-- No historical price/debt is inferred and no existing records are rewritten.
CREATE TABLE IF NOT EXISTS planes_pago_cohorte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohorte_id UUID NOT NULL REFERENCES cohortes_apertura(id),
  nombre VARCHAR(120) NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  modalidad VARCHAR(20) NOT NULL CHECK (modalidad IN ('GRATUITO','PAGO_UNICO','CUOTAS','MODULOS')),
  predeterminado BOOLEAN NOT NULL DEFAULT FALSE,
  monto_matricula NUMERIC(12,2) NOT NULL CHECK (monto_matricula >= 0),
  precio_academico NUMERIC(12,2) NOT NULL CHECK (precio_academico >= 0),
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cohorte_id,nombre,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS planes_pago_un_predeterminado ON planes_pago_cohorte(cohorte_id) WHERE predeterminado;
CREATE TABLE IF NOT EXISTS cuotas_plan_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES planes_pago_cohorte(id),
  numero INTEGER NOT NULL CHECK (numero > 0),
  concepto VARCHAR(255) NOT NULL,
  importe NUMERIC(12,2) NOT NULL CHECK (importe > 0),
  fecha_vencimiento DATE,
  componente_id UUID REFERENCES componentes_curriculares(id),
  UNIQUE(plan_id,numero)
);
CREATE TABLE IF NOT EXISTS planes_asignados_inscripcion (
  inscripcion_id UUID PRIMARY KEY REFERENCES inscripciones(id),
  plan_id UUID NOT NULL REFERENCES planes_pago_cohorte(id),
  asignado_por UUID NOT NULL REFERENCES usuarios(id),
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Versioned prices above are offers; this row is the student's immutable accepted agreement.
CREATE TABLE IF NOT EXISTS acuerdos_pago_inscripcion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscripcion_id UUID NOT NULL UNIQUE REFERENCES inscripciones(id),
  plan_id UUID REFERENCES planes_pago_cohorte(id),
  nombre_plan VARCHAR(120) NOT NULL,
  modalidad VARCHAR(20) NOT NULL,
  monto_matricula NUMERIC(12,2) NOT NULL CHECK (monto_matricula >= 0),
  precio_academico NUMERIC(12,2) NOT NULL CHECK (precio_academico >= 0),
  aceptado_por UUID REFERENCES usuarios(id),
  aceptado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id,inscripcion_id)
);
CREATE TABLE IF NOT EXISTS obligaciones_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acuerdo_id UUID NOT NULL,
  inscripcion_id UUID NOT NULL,
  numero INTEGER NOT NULL CHECK (numero >= 0),
  tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('MATRICULA','ACADEMICO')),
  concepto VARCHAR(255) NOT NULL,
  importe NUMERIC(12,2) NOT NULL CHECK (importe > 0),
  fecha_vencimiento DATE,
  componente_id UUID REFERENCES componentes_curriculares(id),
  anulada_en TIMESTAMPTZ,
  anulada_por UUID REFERENCES usuarios(id),
  motivo_anulacion TEXT,
  FOREIGN KEY(acuerdo_id,inscripcion_id) REFERENCES acuerdos_pago_inscripcion(id,inscripcion_id),
  UNIQUE(acuerdo_id,numero),
  UNIQUE(id,inscripcion_id),
  CHECK ((anulada_en IS NULL AND anulada_por IS NULL AND motivo_anulacion IS NULL) OR
         (anulada_en IS NOT NULL AND anulada_por IS NOT NULL AND length(trim(motivo_anulacion)) >= 5))
);
CREATE INDEX IF NOT EXISTS obligaciones_por_inscripcion ON obligaciones_pago(inscripcion_id,numero);
CREATE TABLE IF NOT EXISTS auditoria_economica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscripcion_id UUID REFERENCES inscripciones(id),
  cohorte_id UUID REFERENCES cohortes_apertura(id),
  pago_id UUID REFERENCES pagos_inscripcion(id),
  usuario_id UUID REFERENCES usuarios(id),
  accion VARCHAR(60) NOT NULL,
  motivo TEXT,
  detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auditoria_economica_inscripcion ON auditoria_economica(inscripcion_id,creado_en);
