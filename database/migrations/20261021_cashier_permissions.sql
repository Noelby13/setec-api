-- Optional local migration. Review before applying to any existing database.
-- Do not run the full destructive schema/seed to change an existing role.
-- Removes the legacy DEFAULT admission privilege from CAJERO; explicitly grant
-- academic privileges again only when institutional authorization requires them.
BEGIN;
DELETE FROM roles_permisos rp USING roles r, permisos p
WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
  AND r.nombre = 'CAJERO' AND p.codigo = 'INSCRIPCION_VALIDAR';
COMMIT;
