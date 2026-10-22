import {
  CohortDao,
  CohorteRecord,
  CohorteDetailRecord,
  ProgramacionComponenteRecord,
  ProgramacionDetailRecord,
  CreateCohorteData,
  UpdateCohorteData,
  ProgramarComponenteData,
  UpdateProgramacionData,
  CohorteFilter,
} from './cohort.dao';
import {
  CreateCohorteInput,
  UpdateCohorteInput,
  ProgramarComponenteInput,
  UpdateProgramacionInput,
} from './cohort.schema';
import { AppError } from '../../middlewares/error.middleware';
import { pool, withTransaction } from '../../db/pool';
import { cents } from '../billing/billing.money';
import { ModalidadEducativa } from '../../types/enums';

export class CohortService {
  // ==========================================
  // COHORTES DE APERTURA (SETEC NORMATIVA)
  // ==========================================

  /**
   * Create a new cohort enforcing SETEC normative validations:
   * 1. If program has es_ciencias_salud = true, modality CANNOT be 'VIRTUAL' (Art. 98-99 SETEC).
   * 2. cupo_minimo >= 15 and cupo_maximo <= 30 unless tiene_excepcion_cupo_setec is true and has excepcion_cupo_setec_url.
   */
  static async createCohorte(
    input: CreateCohorteInput,
    excepcionCupoFileUrl?: string
  ): Promise<CohorteRecord> {
    const finalExcepcionUrl = excepcionCupoFileUrl || input.excepcion_cupo_setec_url;

    // 1. Verify program exists and retrieve health science flag
    const programRes = await pool.query(
      'SELECT id, nombre, es_ciencias_salud, estado_vigencia FROM programas_academicos WHERE id = $1;',
      [input.programa_id]
    );
    if (programRes.rows.length === 0) {
      throw new AppError('El programa académico especificado no existe', 404);
    }
    const program = programRes.rows[0];

    // Normative Rule 1: Health Sciences cannot have VIRTUAL modality (Art. 98-99 SETEC)
    if (program.es_ciencias_salud && input.modalidad === ModalidadEducativa.VIRTUAL) {
      throw new AppError(
        'Los programas del área de Ciencias de la Salud tienen expresamente prohibida la modalidad VIRTUAL según la normativa SETEC (Art. 98-99). Debe ser Presencial, Semipresencial o Mixta.',
        400
      );
    }

    // 2. Validate Quotas (Art. 34 SETEC: Posgrado 15 - 30)
    const cupoMin = input.cupo_minimo ?? 15;
    const cupoMax = input.cupo_maximo ?? 30;

    if (cupoMin > cupoMax) {
      throw new AppError(
        `El cupo mínimo (${cupoMin}) no puede ser mayor que el cupo máximo (${cupoMax})`,
        400
      );
    }

    if (!input.tiene_excepcion_cupo_setec) {
      if (cupoMin < 15) {
        throw new AppError(
          'El cupo mínimo normativo SETEC para posgrados debe ser mayor o igual a 15 estudiantes (Art. 34), a menos que cuente con excepción autorizada por SETEC',
          400
        );
      }
      if (cupoMax > 30) {
        throw new AppError(
          'El cupo máximo normativo SETEC para posgrados no puede exceder los 30 estudiantes (Art. 34), a menos que cuente con excepción autorizada por SETEC',
          400
        );
      }
    } else {
      // If exception is claimed, require document
      if (!finalExcepcionUrl) {
        throw new AppError(
          'Para autorizar una excepción al rango normativo de cupos SETEC (15-30), es obligatorio adjuntar la resolución de excepción (excepcion_cupo_setec_url o archivo adjunto)',
          400
        );
      }
    }

    // 3. Chronological dates validation
    const dateInicioInsc = new Date(input.fecha_inicio_inscripcion);
    const dateFinInsc = new Date(input.fecha_fin_inscripcion);
    const dateInicioClases = new Date(input.fecha_inicio_clases);
    const dateFinClases = new Date(input.fecha_fin_clases);

    if (dateInicioInsc > dateFinInsc) {
      throw new AppError(
        'La fecha de inicio de inscripción no puede ser posterior a la fecha de fin de inscripción',
        400
      );
    }
    if (dateFinInsc > dateInicioClases) {
      throw new AppError(
        'La fecha de cierre de inscripción no puede ser posterior a la fecha de inicio de clases',
        400
      );
    }
    if (dateInicioClases > dateFinClases) {
      throw new AppError(
        'La fecha de inicio de clases no puede ser posterior a la fecha de finalización de clases',
        400
      );
    }

    // 4. Verify campus exists and is active
    const sedeRes = await pool.query(
      'SELECT id, nombre, activa FROM sedes_ies WHERE id = $1;',
      [input.sede_id]
    );
    if (sedeRes.rows.length === 0) {
      throw new AppError('La sede universitaria especificada no existe', 404);
    }
    if (!sedeRes.rows[0].activa) {
      throw new AppError('La sede universitaria especificada se encuentra inactiva', 400);
    }

    // 5. Verify coordinator exists in personal_academico and is active
    const coordRes = await pool.query(
      'SELECT id, nombres, apellidos, activo FROM personal_academico WHERE id = $1;',
      [input.coordinador_id]
    );
    if (coordRes.rows.length === 0) {
      throw new AppError('El docente coordinador especificado no existe en el claustro académico', 404);
    }
    if (!coordRes.rows[0].activo) {
      throw new AppError('El docente coordinador especificado se encuentra inactivo', 400);
    }

    // 6. Check unique codigo_cohorte
    const existingCohorte = await CohortDao.findCohorteByCodigo(input.codigo_cohorte);
    if (existingCohorte) {
      throw new AppError(
        `Ya existe una cohorte registrada con el código "${input.codigo_cohorte.toUpperCase()}"`,
        409
      );
    }

    const data: CreateCohorteData = {
      ...input,
      cupo_minimo: cupoMin,
      cupo_maximo: cupoMax,
      excepcion_cupo_setec_url: finalExcepcionUrl || null,
    };

    return CohortDao.createCohorte(data);
  }

  /**
   * Get cohort details by UUID.
   */
  static async getCohorteById(id: string): Promise<CohorteDetailRecord> {
    const cohorte = await CohortDao.findCohorteById(id);
    if (!cohorte) {
      throw new AppError('Cohorte de apertura no encontrada', 404);
    }
    return cohorte;
  }

  /**
   * List cohorts with optional filters.
   */
  static async listCohortes(filter: CohorteFilter = {}): Promise<CohorteDetailRecord[]> {
    return CohortDao.listCohortes(filter);
  }

  /**
   * Update cohort enforcing SETEC constraints.
   */
  static async updateCohorte(
    id: string,
    input: UpdateCohorteInput,
    excepcionCupoFileUrl?: string
  ): Promise<CohorteRecord> {
    return withTransaction(async db => {
    await db.query('SELECT id FROM cohortes_apertura WHERE id=$1 FOR UPDATE', [id]);
    const current = await CohortDao.findCohorteById(id, db);
    if (!current) {
      throw new AppError('Cohorte de apertura no encontrada', 404);
    }

    const changesPrice = (input.precio_matricula !== undefined && cents(input.precio_matricula) !== cents(current.precio_matricula)) ||
      (input.precio_total_cohorte !== undefined && cents(input.precio_total_cohorte) !== cents(current.precio_total_cohorte));
    if (changesPrice) {
      const plan = await db.query('SELECT id FROM planes_pago_cohorte WHERE cohorte_id=$1 AND predeterminado', [id]);
      if (plan.rows.length) throw new AppError('Cambie los importes publicando una nueva versión en Plan de pagos; los acuerdos existentes se conservan', 409);
    }
    if (input.programa_id && input.programa_id !== current.programa_id) {
      const used = await db.query('SELECT id FROM planes_pago_cohorte WHERE cohorte_id=$1 UNION ALL SELECT a.id FROM acuerdos_pago_inscripcion a JOIN inscripciones i ON i.id=a.inscripcion_id WHERE i.cohorte_id=$1 LIMIT 1', [id]);
      if (used.rows.length) throw new AppError('No se puede cambiar el programa de una cohorte con planes u obligaciones económicas', 409);
    }
    const finalExcepcionUrl = excepcionCupoFileUrl || input.excepcion_cupo_setec_url || current.excepcion_cupo_setec_url;

    // Check health science vs virtual modality
    const targetModalidad = input.modalidad || current.modalidad;
    if (current.es_ciencias_salud && targetModalidad === ModalidadEducativa.VIRTUAL) {
      throw new AppError(
        'Los programas de Ciencias de la Salud tienen prohibida la modalidad VIRTUAL según la normativa SETEC (Art. 98-99)',
        400
      );
    }

    // Check quota rules
    const targetTieneExcepcion =
      input.tiene_excepcion_cupo_setec !== undefined
        ? input.tiene_excepcion_cupo_setec
        : current.tiene_excepcion_cupo_setec;

    const targetCupoMin = input.cupo_minimo !== undefined ? input.cupo_minimo : current.cupo_minimo;
    const targetCupoMax = input.cupo_maximo !== undefined ? input.cupo_maximo : current.cupo_maximo;

    if (targetCupoMin > targetCupoMax) {
      throw new AppError(
        `El cupo mínimo (${targetCupoMin}) no puede ser mayor que el cupo máximo (${targetCupoMax})`,
        400
      );
    }

    if (!targetTieneExcepcion) {
      if (targetCupoMin < 15) {
        throw new AppError(
          'El cupo mínimo normativo SETEC para posgrados debe ser mayor o igual a 15 estudiantes (Art. 34), a menos que cuente con excepción autorizada por SETEC',
          400
        );
      }
      if (targetCupoMax > 30) {
        throw new AppError(
          'El cupo máximo normativo SETEC para posgrados no puede exceder los 30 estudiantes (Art. 34), a menos que cuente con excepción autorizada por SETEC',
          400
        );
      }
    } else {
      if (!finalExcepcionUrl) {
        throw new AppError(
          'Para autorizar una excepción de cupo SETEC es obligatorio adjuntar la resolución de excepción (excepcion_cupo_setec_url)',
          400
        );
      }
    }

    // Check code collision if modified
    if (input.codigo_cohorte && input.codigo_cohorte !== current.codigo_cohorte) {
      const existing = await CohortDao.findCohorteByCodigo(input.codigo_cohorte, db);
      if (existing && existing.id !== id) {
        throw new AppError(
          `El código de cohorte "${input.codigo_cohorte.toUpperCase()}" ya está en uso`,
          409
        );
      }
    }

    const data: UpdateCohorteData = {
      ...input,
      ...(excepcionCupoFileUrl ? { excepcion_cupo_setec_url: excepcionCupoFileUrl } : {}),
    };

    const updated = await CohortDao.updateCohorte(id, data, db);
    if (!updated) {
      throw new AppError('Error al actualizar la cohorte', 500);
    }
    return updated;
    });
  }

  /**
   * Delete a cohort.
   */
  static async deleteCohorte(id: string): Promise<void> {
    const current = await CohortDao.findCohorteById(id);
    if (!current) {
      throw new AppError('Cohorte de apertura no encontrada', 404);
    }

    // Check if students are enrolled
    const inscripcionesCheck = await pool.query(
      'SELECT COUNT(*)::int AS count FROM inscripciones WHERE cohorte_id = $1;',
      [id]
    );
    if (inscripcionesCheck.rows[0].count > 0) {
      throw new AppError(
        'No se puede eliminar la cohorte porque ya cuenta con estudiantes inscritos',
        400
      );
    }

    await CohortDao.deleteCohorte(id);
  }

  // ==========================================
  // PROGRAMACIÓN MODULAR DE DOCENTES POR COHORTE
  // ==========================================

  /**
   * Assign a teacher, dates, and classroom to a curriculum component in a cohort.
   */
  static async programarComponente(
    cohorteId: string,
    input: ProgramarComponenteInput
  ): Promise<ProgramacionComponenteRecord> {
    const cohorte = await CohortDao.findCohorteById(cohorteId);
    if (!cohorte) {
      throw new AppError('Cohorte de apertura no encontrada', 404);
    }

    // Verify component exists and belongs to this cohort's academic program
    const compRes = await pool.query(
      'SELECT id, programa_id, nombre, codigo FROM componentes_curriculares WHERE id = $1;',
      [input.componente_id]
    );
    if (compRes.rows.length === 0) {
      throw new AppError('El componente curricular especificado no existe', 404);
    }
    const componente = compRes.rows[0];
    if (componente.programa_id !== cohorte.programa_id) {
      throw new AppError(
        `El componente curricular "${componente.nombre}" no pertenece a la malla curricular del programa "${cohorte.programa_nombre}"`,
        400
      );
    }

    // Verify assigned teacher if provided
    if (input.docente_titular_id) {
      const docRes = await pool.query(
        'SELECT id, nombres, apellidos, activo FROM personal_academico WHERE id = $1;',
        [input.docente_titular_id]
      );
      if (docRes.rows.length === 0) {
        throw new AppError('El docente titular especificado no existe en el claustro docente', 404);
      }
      if (!docRes.rows[0].activo) {
        throw new AppError('El docente titular especificado se encuentra inactivo', 400);
      }
    }

    // Check dates order if both provided
    if (input.fecha_inicio && input.fecha_fin) {
      if (new Date(input.fecha_inicio) > new Date(input.fecha_fin)) {
        throw new AppError(
          'La fecha de inicio del módulo no puede ser posterior a la fecha de finalización',
          400
        );
      }
    }

    const data: ProgramarComponenteData = {
      cohorte_id: cohorteId,
      componente_id: input.componente_id,
      docente_titular_id: input.docente_titular_id || null,
      fecha_inicio: input.fecha_inicio || null,
      fecha_fin: input.fecha_fin || null,
      horario: input.horario || null,
      aula: input.aula || null,
      codigo_aula_virtual_externa: input.codigo_aula_virtual_externa || null,
      actas_notas_cerradas: input.actas_notas_cerradas ?? false,
    };

    return CohortDao.programarComponente(data);
  }

  /**
   * List modular course scheduling for a cohort.
   */
  static async listProgramacionByCohorte(cohorteId: string): Promise<ProgramacionDetailRecord[]> {
    const cohorte = await CohortDao.findCohorteById(cohorteId);
    if (!cohorte) {
      throw new AppError('Cohorte de apertura no encontrada', 404);
    }
    return CohortDao.listProgramacionByCohorte(cohorteId);
  }

  /**
   * Update component scheduling in a cohort.
   */
  static async updateProgramacion(
    cohorteId: string,
    componenteId: string,
    input: UpdateProgramacionInput
  ): Promise<ProgramacionComponenteRecord> {
    const existing = await CohortDao.findProgramacionByCohorteAndComponente(cohorteId, componenteId);
    if (!existing) {
      throw new AppError(
        'No se encontró la programación del componente curricular en esta cohorte',
        404
      );
    }

    if (input.docente_titular_id) {
      const docRes = await pool.query(
        'SELECT id, nombres, apellidos, activo FROM personal_academico WHERE id = $1;',
        [input.docente_titular_id]
      );
      if (docRes.rows.length === 0) {
        throw new AppError('El docente titular especificado no existe', 404);
      }
      if (!docRes.rows[0].activo) {
        throw new AppError('El docente titular especificado se encuentra inactivo', 400);
      }
    }

    const fechaInicio = input.fecha_inicio !== undefined ? input.fecha_inicio : existing.fecha_inicio;
    const fechaFin = input.fecha_fin !== undefined ? input.fecha_fin : existing.fecha_fin;

    if (fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin)) {
      throw new AppError(
        'La fecha de inicio del módulo no puede ser posterior a la fecha de finalización',
        400
      );
    }

    const data: UpdateProgramacionData = { ...input };
    const updated = await CohortDao.updateProgramacion(cohorteId, componenteId, data);
    if (!updated) {
      throw new AppError('Error al actualizar la programación del módulo', 500);
    }
    return updated;
  }

  /**
   * Remove a component scheduling from a cohort.
   */
  static async deleteProgramacion(cohorteId: string, componenteId: string): Promise<void> {
    const existing = await CohortDao.findProgramacionByCohorteAndComponente(cohorteId, componenteId);
    if (!existing) {
      throw new AppError(
        'No se encontró la programación del componente curricular en esta cohorte',
        404
      );
    }

    if (existing.actas_notas_cerradas) {
      throw new AppError(
        'No se puede desprogramar el módulo porque el acta de calificaciones ya se encuentra cerrada',
        400
      );
    }

    await CohortDao.deleteProgramacion(cohorteId, componenteId);
  }
}
