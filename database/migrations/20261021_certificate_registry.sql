-- Additive certificate registry migration. Apply explicitly to an authorized database.
-- Existing dossiers are not registered or changed by this migration.
BEGIN;
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

INSERT INTO permisos (codigo, nombre, descripcion)
VALUES ('CERTIFICADO_REVOCAR', 'Revocación de certificados', 'Permite revocar certificados registrados con motivo y auditoría')
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'SUPER_ADMIN' AND p.codigo = 'CERTIFICADO_REVOCAR'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
COMMIT;
