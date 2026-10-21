import crypto from 'crypto';
import { pool, withTransaction } from '../../db/pool';
import { AppError } from '../../middlewares/error.middleware';
import {
  EnrollmentDao,
  InscripcionRecord,
  InscripcionDetailRecord,
  PagoInscripcionRecord,
  SolicitudConvalidacionRecord,
  ListEnrollmentsFilters,
} from './enrollment.dao';
import {
  CreateEnrollmentInput,
  ValidateDocumentsInput,
  CreatePaymentInput,
  ValidatePaymentInput,
  CreateConvalidationInput,
  DictamenConvalidationInput,
} from './enrollment.schema';
import {
  EstadoInscripcion,
  RolParticipacionEp,
  EstadoPago,
  EstadoDictamenConvalidacion,
} from '../../types/enums';

export interface UploadedEnrollmentFiles {
  archivo_ponencia_url?: string;
}

export interface UploadedPaymentFiles {
  comprobante_baucher_url?: string;
}

export interface UploadedConvalidationFiles {
  certificado_origen_url?: string;
}

export class EnrollmentService {
  // ==========================================
  // 1. NUEVA INSCRIPCIÓN
  // ==========================================

  /**
   * Registers a new student enrollment into a cohort.
   * Enforces SETEC rules:
   * - Resolves or validates aspirante profile.
   * - Enforces required university degree if program has requiere_titulo_grado_rn = true.
   * - Prevents duplicate enrollment (unique per aspirante and cohorte).
   * - Generates cryptographically unique codigo_expediente.
   * - Determines initial state: LISTA_ESPERA (if cohort cupo_maximo reached),
   *   PENDIENTE_COMITE_PONENCIA (if rol is PONENTE_CONGRESO), or EN_REVISION_DOCUMENTAL.
   */
  static async createEnrollment(
    data: CreateEnrollmentInput,
    uploadedFiles?: UploadedEnrollmentFiles,
    currentUserId?: string,
    canManageApplicants = false
  ): Promise<InscripcionDetailRecord> {
    return await withTransaction(async (client) => {
      // 1. Resolve aspirante_id
      let aspiranteId = data.aspirante_id;
      if (currentUserId && !canManageApplicants) {
        const ownApplicant = await EnrollmentDao.findAspiranteByUserId(currentUserId, client);
        if (!ownApplicant) throw new AppError('Complete su perfil de aspirante antes de solicitar inscripción', 400);
        if (aspiranteId && aspiranteId !== ownApplicant.id) {
          throw new AppError('No puede solicitar inscripción para otro aspirante', 403);
        }
        aspiranteId = ownApplicant.id;
      }
      if (!aspiranteId) {
        if (!currentUserId) {
          throw new AppError('Debe especificar el aspirante_id o estar autenticado', 400);
        }
        const aspirante = await EnrollmentDao.findAspiranteByUserId(currentUserId, client);
        if (!aspirante) {
          throw new AppError(
            'El usuario autenticado no posee un perfil de aspirante registrado. Complete su perfil primero.',
            400
          );
        }
        aspiranteId = aspirante.id;
      }

      // 2. Prevent duplicate enrollment in the same cohort
      const existing = await EnrollmentDao.findByAspiranteAndCohorte(
        aspiranteId,
        data.cohorte_id,
        client
      );
      if (existing) {
        throw new AppError('El aspirante ya se encuentra inscrito en esta cohorte académica', 409);
      }

      // 3. Retrieve Cohort and its Academic Program
      const cohorte = await EnrollmentDao.getCohorteWithProgramForUpdate(data.cohorte_id, client);
      if (!cohorte) {
        throw new AppError('La cohorte académica especificada no existe', 404);
      }

      // Check if cohort allows new enrollments
      if (cohorte.estado_cohorte !== 'INSCRIPCION_ABIERTA') {
        throw new AppError(
          `No es posible inscribirse en una cohorte en estado ${cohorte.estado_cohorte}`,
          400
        );
      }

      // 4. Validate Degree Requirement (SETEC Art. 60 / Art. 68)
      if (cohorte.requiere_titulo_grado_rn) {
        if (!data.titulo_presentado_id) {
          throw new AppError(
            'Este programa académico de posgrado exige presentar un título de grado universitario registrado',
            400
          );
        }

        const titulo = await EnrollmentDao.checkTituloBelongsToAspirante(
          data.titulo_presentado_id,
          aspiranteId,
          client
        );
        if (!titulo) {
          throw new AppError(
            'El título académico presentado no pertenece al aspirante o no existe',
            400
          );
        }
      }

      // 5. Determine initial enrollment status
      const activeEnrollmentsCount = await EnrollmentDao.countActiveEnrollmentsInCohorte(
        data.cohorte_id,
        client
      );

      let estadoInicial: string;
      if (
        activeEnrollmentsCount >= cohorte.cupo_maximo ||
        cohorte.cupos_actuales_verificados >= cohorte.cupo_maximo
      ) {
        estadoInicial = EstadoInscripcion.LISTA_ESPERA;
      } else if (data.rol_participacion === RolParticipacionEp.PONENTE_CONGRESO) {
        estadoInicial = EstadoInscripcion.PENDIENTE_COMITE_PONENCIA;
      } else {
        estadoInicial = EstadoInscripcion.EN_REVISION_DOCUMENTAL;
      }

      // 6. Generate unique codigo_expediente (Format: EXP-YYYY-HEX, max 40 chars)
      const year = new Date().getFullYear();
      const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
      const codigoExpediente = `EXP-${year}-${randomSuffix}`;

      // 7. Resolve ponencia file URL if uploaded
      const archivoPonenciaUrl =
        uploadedFiles?.archivo_ponencia_url || data.archivo_ponencia_url || null;

      // 8. Create Inscription record
      const createdInscripcion = await EnrollmentDao.createInscripcion(
        {
          codigo_expediente: codigoExpediente,
          aspirante_id: aspiranteId,
          cohorte_id: data.cohorte_id,
          titulo_presentado_id: data.titulo_presentado_id || null,
          estado: estadoInicial,
          observaciones_administracion: data.observaciones_administracion || null,
          rol_participacion: data.rol_participacion,
          titulo_ponencia: data.titulo_ponencia || null,
          resumen_ponencia: data.resumen_ponencia || null,
          archivo_ponencia_url: archivoPonenciaUrl,
          es_reingreso_cambio_plan: data.es_reingreso_cambio_plan,
          inscripcion_origen_id: data.inscripcion_origen_id || null,
          requiere_nivelacion_investigativa: data.requiere_nivelacion_investigativa,
          acepta_compromiso_idioma_y_publicacion: data.acepta_compromiso_idioma_y_publicacion,
        },
        client
      );

      const detailed = await EnrollmentDao.findDetailedById(createdInscripcion.id, client);
      if (!detailed) {
        throw new AppError('Error al recuperar la inscripción creada', 500);
      }
      return detailed;
    });
  }

  // ==========================================
  // 2. VALIDACIÓN DOCUMENTAL Y QUÓRUM AUTOMÁTICO
  // ==========================================

  /**
   * Critical Transactional Quorum and Document Validation:
   * When an admin approves an applicant's documents:
   * a) Locks cohort row with SELECT ... FOR UPDATE.
   * b) Increments cupos_actuales_verificados = cupos_actuales_verificados + 1.
   * c) If new cupos_actuales_verificados < cupo_minimo:
   *    Sets enrollment status to 'INSCRITO_RESERVADO'.
   * d) If new cupos_actuales_verificados >= cupo_minimo:
   *    Updates cohort to cobro_habilitado = TRUE and estado_cohorte = 'QUORUM_ALCANZADO_COBRANDO',
   *    sets this enrollment to 'PENDIENTE_PAGO', and mass-updates all previous 'INSCRITO_RESERVADO'
   *    to 'PENDIENTE_PAGO'.
   */
  static async validateDocuments(
    enrollmentId: string,
    input: ValidateDocumentsInput
  ): Promise<InscripcionDetailRecord> {
    return await withTransaction(async (client) => {
      // 1. Fetch current enrollment
      const inscripcion = await EnrollmentDao.findById(enrollmentId, client);
      if (!inscripcion) {
        throw new AppError('Inscripción no encontrada', 404);
      }

      // If administrative rejection / observation
      if (!input.aprobado) {
        await EnrollmentDao.updateInscripcionEstado(
          enrollmentId,
          EstadoInscripcion.DOCUMENTACION_OBSERVADA,
          {
            observaciones:
              input.observaciones_administracion || 'Documentación observada por la administración',
          },
          client
        );
        const detailed = await EnrollmentDao.findDetailedById(enrollmentId, client);
        return detailed!;
      }

      // Check if already approved/verified to prevent duplicate counter increment
      const alreadyApprovedStates: string[] = [
        EstadoInscripcion.INSCRITO_RESERVADO,
        EstadoInscripcion.PENDIENTE_PAGO,
        EstadoInscripcion.PAGO_EN_REVISION,
        EstadoInscripcion.MATRICULADO_ACTIVO,
      ];
      if (alreadyApprovedStates.includes(inscripcion.estado)) {
        throw new AppError(
          `La documentación de esta inscripción ya fue validada previamente (Estado actual: ${inscripcion.estado})`,
          400
        );
      }

      // a) Bloquea la fila de la cohorte con SELECT * FROM cohortes_apertura WHERE id = $1 FOR UPDATE
      const cohorte = await EnrollmentDao.getCohorteWithProgramForUpdate(
        inscripcion.cohorte_id,
        client
      );
      if (!cohorte) {
        throw new AppError('Cohorte asociada no encontrada', 404);
      }

      // b) Incrementa cupos_actuales_verificados = cupos_actuales_verificados + 1
      const nuevosCuposVerificados = cohorte.cupos_actuales_verificados + 1;
      let nuevoEstadoInscripcion: string;

      // c) Si el nuevo cupos_actuales_verificados < cupo_minimo
      if (nuevosCuposVerificados < cohorte.cupo_minimo) {
        nuevoEstadoInscripcion = EstadoInscripcion.INSCRITO_RESERVADO;

        await EnrollmentDao.updateCohorteQuorum(
          cohorte.id,
          nuevosCuposVerificados,
          cohorte.cobro_habilitado,
          null,
          client
        );
      } else {
        // d) Si el nuevo cupos_actuales_verificados >= cupo_minimo
        nuevoEstadoInscripcion = EstadoInscripcion.PENDIENTE_PAGO;

        // Actualiza la cohorte con cobro_habilitado = TRUE y estado_cohorte = 'QUORUM_ALCANZADO_COBRANDO'
        await EnrollmentDao.updateCohorteQuorum(
          cohorte.id,
          nuevosCuposVerificados,
          true,
          'QUORUM_ALCANZADO_COBRANDO',
          client
        );

        // Habilita el pago a todos los que estaban esperando quórum
        await EnrollmentDao.updateReservedToPendingPayment(cohorte.id, client);
      }

      // Actualiza la inscripción actual con su nuevo estado y fecha_aprobacion_documental = NOW()
      await EnrollmentDao.updateInscripcionEstado(
        enrollmentId,
        nuevoEstadoInscripcion,
        {
          fechaAprobacionDocumental: true,
          observaciones: input.observaciones_administracion || null,
        },
        client
      );

      const detailed = await EnrollmentDao.findDetailedById(enrollmentId, client);
      return detailed!;
    });
  }

  // ==========================================
  // 3. REGISTRO Y VALIDACIÓN DE PAGO (CAJA)
  // ==========================================

  /**
   * Registers a payment (voucher or cash) for an enrollment.
   * Enforces rule: Cohort cobro_habilitado must be TRUE (quorum reached).
   * Changes enrollment status to 'PAGO_EN_REVISION'.
   */
  static async registerPayment(
    enrollmentId: string,
    data: CreatePaymentInput,
    uploadedFiles?: UploadedPaymentFiles
  ): Promise<PagoInscripcionRecord> {
    return await withTransaction(async (client) => {
      // 1. Fetch enrollment
      const inscripcion = await EnrollmentDao.findById(enrollmentId, client);
      if (!inscripcion) {
        throw new AppError('Inscripción no encontrada', 404);
      }

      // 2. Fetch Cohort to check quorum and cobro_habilitado
      const cohorte = await EnrollmentDao.getCohorteWithProgram(inscripcion.cohorte_id, client);
      if (!cohorte) {
        throw new AppError('Cohorte asociada no encontrada', 404);
      }

      // Quorum / payment prerequisite check
      if (!cohorte.cobro_habilitado) {
        throw new AppError(
          'El cobro para esta cohorte no está habilitado porque aún no se ha alcanzado el quórum normativo mínimo',
          400
        );
      }

      // Enrollment status check
      if (
        inscripcion.estado !== EstadoInscripcion.PENDIENTE_PAGO &&
        inscripcion.estado !== EstadoInscripcion.PAGO_EN_REVISION &&
        inscripcion.estado !== EstadoInscripcion.DOCUMENTACION_OBSERVADA
      ) {
        throw new AppError(
          `La inscripción se encuentra en estado '${inscripcion.estado}'. Solo inscripciones en 'PENDIENTE_PAGO' pueden registrar pagos.`,
          400
        );
      }

      const comprobanteUrl =
        uploadedFiles?.comprobante_baucher_url || data.comprobante_baucher_url || null;

      // 3. Register payment
      const pago = await EnrollmentDao.createPago(
        {
          inscripcion_id: enrollmentId,
          aspirante_id: inscripcion.aspirante_id,
          metodo_pago: data.metodo_pago,
          numero_referencia_o_recibo: data.numero_referencia_o_recibo,
          banco_origen: data.banco_origen || null,
          comprobante_baucher_url: comprobanteUrl,
          monto_subtotal: data.monto_subtotal,
          descuento_aplicado: data.descuento_aplicado,
          total_pagado: data.total_pagado,
          concepto: data.concepto,
          estado: EstadoPago.PENDIENTE_REVISION,
          fecha_pago_reportada: data.fecha_pago_reportada,
        },
        client
      );

      // 4. Update enrollment state to PAGO_EN_REVISION
      await EnrollmentDao.updateInscripcionEstado(
        enrollmentId,
        EstadoInscripcion.PAGO_EN_REVISION,
        {},
        client
      );

      return pago;
    });
  }

  /**
   * Cashier / Admin validates a payment.
   * If approved: updates payment to 'APROBADO', enrollment to 'MATRICULADO_ACTIVO',
   * and sets fecha_formalizacion_matricula = NOW() in the same transaction.
   * If rejected: updates payment to 'RECHAZADO' and returns enrollment to 'PENDIENTE_PAGO'.
   */
  static async validatePayment(
    paymentId: string,
    input: ValidatePaymentInput,
    validatorUserId: string
  ): Promise<{ pago: PagoInscripcionRecord; inscripcion: InscripcionDetailRecord }> {
    return await withTransaction(async (client) => {
      const pago = await EnrollmentDao.findPagoById(paymentId, client);
      if (!pago) {
        throw new AppError('Registro de pago no encontrado', 404);
      }

      if (pago.estado !== EstadoPago.PENDIENTE_REVISION) {
        throw new AppError(`Este pago ya fue dictaminado previamente con estado '${pago.estado}'`, 400);
      }

      let updatedPago: PagoInscripcionRecord | null;

      if (input.estado === EstadoPago.APROBADO) {
        // Approve payment
        updatedPago = await EnrollmentDao.updatePagoValidation(
          paymentId,
          EstadoPago.APROBADO,
          null,
          validatorUserId,
          client
        );

        // Update enrollment to MATRICULADO_ACTIVO and set fecha_formalizacion_matricula = NOW()
        await EnrollmentDao.updateInscripcionEstado(
          pago.inscripcion_id,
          EstadoInscripcion.MATRICULADO_ACTIVO,
          { fechaFormalizacionMatricula: true },
          client
        );
      } else {
        // Reject payment
        updatedPago = await EnrollmentDao.updatePagoValidation(
          paymentId,
          EstadoPago.RECHAZADO,
          input.motivo_rechazo || 'Pago rechazado por inconsistencias en el comprobante',
          validatorUserId,
          client
        );

        // Revert enrollment to PENDIENTE_PAGO so applicant can re-submit
        await EnrollmentDao.updateInscripcionEstado(
          pago.inscripcion_id,
          EstadoInscripcion.PENDIENTE_PAGO,
          { observaciones: input.motivo_rechazo || 'Comprobante de pago rechazado por tesorería' },
          client
        );
      }

      const detailedInscripcion = await EnrollmentDao.findDetailedById(pago.inscripcion_id, client);
      return {
        pago: updatedPago!,
        inscripcion: detailedInscripcion!,
      };
    });
  }

  // ==========================================
  // 4. CONVALIDACIONES Y ACREDITACIONES
  // ==========================================

  /**
   * Request credit validation/convalidation for a curricular component.
   * Validates creditos_reconocidos between 1 and 15 (SETEC Norms).
   */
  static async requestConvalidation(
    enrollmentId: string,
    data: CreateConvalidationInput,
    uploadedFiles?: UploadedConvalidationFiles
  ): Promise<SolicitudConvalidacionRecord> {
    return await withTransaction(async (client) => {
      // 1. Fetch enrollment
      const inscripcion = await EnrollmentDao.findById(enrollmentId, client);
      if (!inscripcion) {
        throw new AppError('Inscripción no encontrada', 404);
      }

      // 2. Validate component belongs to cohort's program
      const compCheck = await EnrollmentDao.checkComponenteBelongsToCohorteProgram(
        data.componente_destino_id,
        inscripcion.cohorte_id,
        client
      );
      if (!compCheck) {
        throw new AppError(
          'El componente curricular destino no pertenece al programa académico de esta cohorte',
          400
        );
      }

      // 3. Validate credits
      if (data.creditos_reconocidos < 1 || data.creditos_reconocidos > 15) {
        throw new AppError(
          'Los créditos a convalidar deben estar entre 1 y 15 según normativa SETEC',
          400
        );
      }

      if (data.creditos_reconocidos > compCheck.creditos) {
        throw new AppError(
          `No se pueden reconocer más créditos (${data.creditos_reconocidos}) que los asignados a la asignatura (${compCheck.creditos})`,
          400
        );
      }

      // 4. Validate Certificate file
      const certificadoUrl =
        uploadedFiles?.certificado_origen_url || data.certificado_origen_url || null;
      if (!certificadoUrl) {
        throw new AppError(
          'Debe adjuntar el certificado de origen en formato PDF como evidencia de convalidación',
          400
        );
      }

      // 5. Create convalidation request
      const solicitud = await EnrollmentDao.createSolicitudConvalidacion(
        {
          inscripcion_destino_id: enrollmentId,
          componente_destino_id: data.componente_destino_id,
          origen_tipo: data.origen_tipo,
          inscripcion_origen_ep_id: data.inscripcion_origen_ep_id || null,
          certificado_origen_url: certificadoUrl,
          creditos_reconocidos: data.creditos_reconocidos,
          justificacion_aporte_perfil: data.justificacion_aporte_perfil,
        },
        client
      );

      return solicitud;
    });
  }

  /**
   * Academic Coordinator emits resolution (dictamen) on a convalidation request:
   * 'APROBADA' or 'RECHAZADA'.
   */
  static async dictamenConvalidation(
    convalidationId: string,
    input: DictamenConvalidationInput,
    userId: string
  ): Promise<SolicitudConvalidacionRecord> {
    return await withTransaction(async (client) => {
      const solicitud = await EnrollmentDao.findSolicitudConvalidacionById(convalidationId, client);
      if (!solicitud) {
        throw new AppError('Solicitud de convalidación no encontrada', 404);
      }

      if (solicitud.estado_dictamen !== 'PENDIENTE') {
        throw new AppError(
          `Esta solicitud ya fue dictaminada con resultado '${solicitud.estado_dictamen}'`,
          400
        );
      }

      // Resolve coordinator ID
      let coordinadorId = input.coordinador_dictaminador_id;
      if (!coordinadorId) {
        const personal = await EnrollmentDao.findPersonalAcademicoByUserId(userId, client);
        coordinadorId = personal?.id || null;
      }

      const updated = await EnrollmentDao.updateDictamenConvalidacion(
        convalidationId,
        input.estado_dictamen,
        coordinadorId,
        client
      );

      return updated!;
    });
  }

  // ==========================================
  // 5. CONSULTAS Y DETALLES
  // ==========================================

  static async getEnrollmentById(id: string): Promise<{
    inscripcion: InscripcionDetailRecord;
    pagos: PagoInscripcionRecord[];
    convalidaciones: SolicitudConvalidacionRecord[];
  }> {
    const inscripcion = await EnrollmentDao.findDetailedById(id);
    if (!inscripcion) {
      throw new AppError('Inscripción no encontrada', 404);
    }

    const [pagos, convalidaciones] = await Promise.all([
      EnrollmentDao.findPagosByInscripcionId(id),
      EnrollmentDao.findSolicitudesConvalidacionByInscripcionId(id),
    ]);

    return {
      inscripcion,
      pagos,
      convalidaciones,
    };
  }

  static async listEnrollments(
    filters: ListEnrollmentsFilters
  ): Promise<{ data: InscripcionDetailRecord[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const { data, total } = await EnrollmentDao.listInscripciones({
      ...filters,
      page,
      limit,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  static async getMyEnrollments(
    userId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 100 }
  ): Promise<{ data: InscripcionDetailRecord[]; total: number }> {
    const aspirante = await EnrollmentDao.findAspiranteByUserId(userId);
    if (!aspirante) {
      return { data: [], total: 0 };
    }

    return await EnrollmentDao.listInscripciones({
      aspirante_id: aspirante.id,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  static async getPaymentsByEnrollment(enrollmentId: string): Promise<PagoInscripcionRecord[]> {
    const inscripcion = await EnrollmentDao.findById(enrollmentId);
    if (!inscripcion) {
      throw new AppError('Inscripción no encontrada', 404);
    }
    return await EnrollmentDao.findPagosByInscripcionId(enrollmentId);
  }

  static async getConvalidationsByEnrollment(
    enrollmentId: string
  ): Promise<SolicitudConvalidacionRecord[]> {
    const inscripcion = await EnrollmentDao.findById(enrollmentId);
    if (!inscripcion) {
      throw new AppError('Inscripción no encontrada', 404);
    }
    return await EnrollmentDao.findSolicitudesConvalidacionByInscripcionId(enrollmentId);
  }
}
