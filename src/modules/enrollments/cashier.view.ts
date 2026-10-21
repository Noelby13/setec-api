import type { InscripcionDetailRecord } from './enrollment.dao';

/** Cashier discovery exposes only the context needed to locate and manage payments. */
export function cashierEnrollmentView(record: InscripcionDetailRecord) {
  const { id, codigo_expediente, estado, aspirante_nombres, aspirante_apellidos,
    cohorte_codigo, programa_nombre, precio_matricula, precio_total_cohorte,
    cobro_habilitado, cupos_actuales_verificados, cupo_minimo } = record;
  return { id, codigo_expediente, estado, aspirante_nombres, aspirante_apellidos,
    cohorte_codigo, programa_nombre, precio_matricula, precio_total_cohorte,
    cobro_habilitado, cupos_actuales_verificados, cupo_minimo };
}
