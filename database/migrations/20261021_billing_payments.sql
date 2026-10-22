-- Apply after 20261021_academic_billing.sql. No historical payments are rewritten.
ALTER TYPE estado_pago_enum ADD VALUE IF NOT EXISTS 'ANULADO';
ALTER TABLE pagos_inscripcion ADD COLUMN IF NOT EXISTS clave_idempotencia VARCHAR(100);
ALTER TABLE pagos_inscripcion ADD COLUMN IF NOT EXISTS solicitud_hash CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS pago_reintento_unico ON pagos_inscripcion(inscripcion_id,clave_idempotencia) WHERE clave_idempotencia IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pago_inscripcion_identidad ON pagos_inscripcion(id,inscripcion_id);
CREATE TABLE IF NOT EXISTS aplicaciones_pago (
  pago_id UUID NOT NULL,
  obligacion_id UUID NOT NULL,
  inscripcion_id UUID NOT NULL,
  importe NUMERIC(12,2) NOT NULL CHECK(importe > 0),
  PRIMARY KEY(pago_id,obligacion_id),
  FOREIGN KEY(pago_id,inscripcion_id) REFERENCES pagos_inscripcion(id,inscripcion_id),
  FOREIGN KEY(obligacion_id,inscripcion_id) REFERENCES obligaciones_pago(id,inscripcion_id)
);
CREATE TABLE IF NOT EXISTS comprobantes_internos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  pago_id UUID NOT NULL UNIQUE REFERENCES pagos_inscripcion(id),
  inscripcion_id UUID NOT NULL REFERENCES inscripciones(id),
  datos JSONB NOT NULL,
  emitido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulado_en TIMESTAMPTZ,
  anulado_por UUID REFERENCES usuarios(id),
  motivo_anulacion TEXT,
  CHECK ((anulado_en IS NULL AND anulado_por IS NULL AND motivo_anulacion IS NULL) OR
         (anulado_en IS NOT NULL AND anulado_por IS NOT NULL AND length(trim(motivo_anulacion)) >= 5))
);
CREATE INDEX IF NOT EXISTS comprobantes_por_inscripcion ON comprobantes_internos(inscripcion_id,emitido_en);

INSERT INTO permisos(codigo,nombre,descripcion) VALUES
('PAGO_ANULAR','Anulación de cobros','Anular cobros aprobados con motivo y auditoría'),
('OBLIGACION_ANULAR','Anulación de obligaciones','Anular obligaciones sin aplicaciones de pago')
ON CONFLICT(codigo) DO NOTHING;
