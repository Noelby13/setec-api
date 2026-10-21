import crypto from 'crypto';
import { GraduationDAO } from './graduation.dao';
import {
  CreateExpedienteInput,
  UpdateExpedienteInput,
  CreatePublicationInput,
  IssueDocumentInput,
} from './graduation.schema';
import { withTransaction } from '../../db/pool';
import { AppError } from '../../middlewares/error.middleware';
import { NivelIdiomaMcer, EstadoInscripcion } from '../../types/enums';

// MCER language proficiency ranking
const MCER_LEVEL_RANK: Record<NivelIdiomaMcer, number> = {
  [NivelIdiomaMcer.NINGUNO]: 0,
  [NivelIdiomaMcer.A1]: 1,
  [NivelIdiomaMcer.A2]: 2,
  [NivelIdiomaMcer.B1]: 3,
  [NivelIdiomaMcer.B2]: 4,
  [NivelIdiomaMcer.C1]: 5,
  [NivelIdiomaMcer.C2]: 6,
};

export interface UploadedExpedienteFiles {
  certificado_idioma_url?: string;
  acta_defensa_url?: string;
  titulo_intermedio_emitido_url?: string;
  documento_final_url?: string;
}

export class GraduationService {
  /**
   * Create or open an academic graduation file for an enrollment.
   */
  static async createExpediente(
    data: CreateExpedienteInput,
    uploadedFiles: UploadedExpedienteFiles = {}
  ): Promise<any> {
    // Check if an expediente already exists for this enrollment
    const existing = await GraduationDAO.getExpedienteByInscripcionId(data.inscripcion_id);
    if (existing) {
      throw new AppError(
        'Ya existe un expediente de graduación registrado para esta inscripción académica',
        400
      );
    }

    return await GraduationDAO.createExpediente({
      inscripcion_id: data.inscripcion_id,
      tipo_documento_final: data.tipo_documento_final,
      idioma_acreditado: data.idioma_acreditado,
      nivel_idioma_alcanzado: data.nivel_idioma_alcanzado,
      institucion_aval_idioma: data.institucion_aval_idioma,
      certificado_idioma_url: uploadedFiles.certificado_idioma_url,
      modalidad_graduacion_tipo: data.modalidad_graduacion_tipo,
      titulo_trabajo_graduacion: data.titulo_trabajo_graduacion,
      acta_defensa_url: uploadedFiles.acta_defensa_url,
      aplico_salida_intermedia: data.aplico_salida_intermedia,
      titulo_intermedio_emitido_url: uploadedFiles.titulo_intermedio_emitido_url,
    });
  }

  /**
   * Get graduation dossier by ID with full applicant and program details.
   */
  static async getExpedienteById(id: string): Promise<any> {
    const expediente = await GraduationDAO.getExpedienteById(id);
    if (!expediente) {
      throw new AppError('Expediente de graduación no encontrado', 404);
    }
    const publicaciones = await GraduationDAO.getPublicacionesByExpedienteId(id);
    return {
      ...expediente,
      publicaciones,
    };
  }

  /**
   * Get graduation dossier by enrollment ID (inscripcion_id).
   */
  static async getExpedienteByInscripcionId(inscripcionId: string): Promise<any> {
    const expediente = await GraduationDAO.getExpedienteByInscripcionId(inscripcionId);
    if (!expediente) {
      throw new AppError('No existe expediente de graduación para esta inscripción', 404);
    }
    const publicaciones = await GraduationDAO.getPublicacionesByExpedienteId(expediente.id);
    return {
      ...expediente,
      publicaciones,
    };
  }

  /**
   * Update graduation dossier.
   */
  static async updateExpediente(
    id: string,
    data: UpdateExpedienteInput,
    uploadedFiles: UploadedExpedienteFiles = {}
  ): Promise<any> {
    const existing = await GraduationDAO.getExpedienteById(id);
    if (!existing) {
      throw new AppError('Expediente de graduación no encontrado', 404);
    }

    const updated = await GraduationDAO.updateExpediente(id, {
      ...data,
      certificado_idioma_url: uploadedFiles.certificado_idioma_url,
      acta_defensa_url: uploadedFiles.acta_defensa_url,
      titulo_intermedio_emitido_url: uploadedFiles.titulo_intermedio_emitido_url,
    });

    return updated;
  }

  /**
   * Register a student scientific publication with PDF evidence.
   */
  static async addScientificPublication(
    expedienteId: string,
    data: CreatePublicationInput,
    evidenciaPdfUrl: string
  ): Promise<any> {
    const expediente = await GraduationDAO.getExpedienteById(expedienteId);
    if (!expediente) {
      throw new AppError('Expediente de graduación no encontrado', 404);
    }

    return await GraduationDAO.createPublicacionCientifica({
      expediente_graduacion_id: expedienteId,
      tipo_publicacion: data.tipo_publicacion,
      titulo_publicacion: data.titulo_publicacion,
      nombre_revista_o_medio: data.nombre_revista_o_medio,
      es_revista_indexada: data.es_revista_indexada,
      tiene_revision_pares: data.tiene_revision_pares,
      alcance: data.alcance || null,
      url_o_doi: data.url_o_doi,
      evidencia_pdf_url: evidenciaPdfUrl,
      validado_coordinacion: false,
    });
  }

  /**
   * Get all publications registered under an expediente.
   */
  static async getPublicationsByExpediente(expedienteId: string): Promise<any[]> {
    return await GraduationDAO.getPublicacionesByExpedienteId(expedienteId);
  }

  /**
   * Academic Coordination validates or rejects a scientific publication.
   */
  static async validateScientificPublication(
    publicationId: string,
    validado: boolean
  ): Promise<any> {
    const pub = await GraduationDAO.getPublicacionById(publicationId);
    if (!pub) {
      throw new AppError('Publicación científica no encontrada', 404);
    }

    const updated = await GraduationDAO.updatePublicacionValidacion(publicationId, validado);
    return updated;
  }

  /**
   * Emit final graduation degree/certificate after strictly validating program exit requirements:
   * 1. Required exit language level vs student achieved and validated level.
   * 2. Required scientific publications vs coordination-validated publications.
   * 3. Sets fecha_emision & codigo_registro_titulo_emitido.
   * 4. Updates inscripciones.estado = 'GRADUADO_O_CERTIFICADO'.
   */
  static async issueGraduationDocument(
    expedienteId: string,
    data: IssueDocumentInput,
    uploadedDocUrl: string | undefined,
    currentUserId: string
  ): Promise<any> {
    return await withTransaction(async (client) => {
      // 1. Fetch complete requirements context
      const context = await GraduationDAO.getGraduationRequirementsContext(expedienteId, client);
      if (!context) {
        throw new AppError('Expediente de graduación no encontrado', 404);
      }

      // Check if already issued
      if (context.fecha_emision && context.codigo_registro_titulo_emitido) {
        throw new AppError(
          `Este título o certificado ya fue emitido con código de registro: ${context.codigo_registro_titulo_emitido}`,
          400
        );
      }

      // 2. Validate Language Requirement (SETEC Art. 68, 73, 78)
      const requiredLanguage: NivelIdiomaMcer = context.idioma_egreso_requerido || NivelIdiomaMcer.NINGUNO;
      const requiredRank = MCER_LEVEL_RANK[requiredLanguage] || 0;

      if (requiredRank > 0) {
        const studentLevel: NivelIdiomaMcer = context.nivel_idioma_alcanzado || NivelIdiomaMcer.NINGUNO;
        const studentRank = MCER_LEVEL_RANK[studentLevel] || 0;

        if (studentRank < requiredRank) {
          throw new AppError(
            `No cumple con el requisito de idioma de egreso del programa. Requiere nivel: ${requiredLanguage}, pero el estudiante cuenta con: ${studentLevel}`,
            400
          );
        }

        if (!context.idioma_validado) {
          throw new AppError(
            'El certificado de acreditación de idioma aún no ha sido validado formalmente por coordinación académica',
            400
          );
        }
      }

      // 3. Validate Scientific Publications Requirement (SETEC Posgrados)
      const requiredPublications: number = context.num_publicaciones_requeridas || 0;
      if (requiredPublications > 0) {
        const validPublicationsCount = await GraduationDAO.countValidatedPublications(
          expedienteId,
          Boolean(context.requiere_revista_indexada),
          Boolean(context.requiere_pares_evaluadores),
          client
        );

        if (validPublicationsCount < requiredPublications) {
          throw new AppError(
            `No cumple con el requisito de publicaciones científicas. Requiere ${requiredPublications} publicación(es) válidas (Indexada: ${Boolean(
              context.requiere_revista_indexada
            )}, Revisión por pares: ${Boolean(
              context.requiere_pares_evaluadores
            )}), pero actualmente tiene ${validPublicationsCount} validada(s).`,
            400
          );
        }
      }

      // 4. Generate unique official registration code if not provided
      let codigoRegistro = data.codigo_registro_titulo_emitido?.trim();
      if (!codigoRegistro) {
        const year = new Date().getFullYear();
        const randToken = crypto.randomBytes(3).toString('hex').toUpperCase();
        const cleanSubtipo = (context.programa_subtipo || 'TIT').replace(/[^A-Z0-9]/g, '');
        codigoRegistro = `SETEC-${cleanSubtipo}-${year}-${randToken}`;
      }

      const fechaEmision = data.fecha_emision || new Date().toISOString().split('T')[0];
      const finalDocUrl = uploadedDocUrl || data.documento_final_url || context.documento_final_url;

      // 5. Update expediente record
      const updatedExpediente = await GraduationDAO.issueExpedienteDocument(
        expedienteId,
        {
          codigo_registro_titulo_emitido: codigoRegistro,
          documento_final_url: finalDocUrl,
          fecha_emision: fechaEmision,
          emitido_por_usuario_id: currentUserId,
          tipo_documento_final: data.tipo_documento_final,
        },
        client
      );

      // 6. Update student enrollment state to GRADUADO_O_CERTIFICADO
      await GraduationDAO.updateInscripcionEstado(
        context.inscripcion_id,
        EstadoInscripcion.GRADUADO_O_CERTIFICADO,
        client
      );

      return {
        expediente: updatedExpediente,
        codigo_registro: codigoRegistro,
        fecha_emision: fechaEmision,
        estado_inscripcion: EstadoInscripcion.GRADUADO_O_CERTIFICADO,
        estudiante: `${context.aspirante_nombres} ${context.aspirante_apellidos}`,
        programa: context.programa_nombre,
      };
    });
  }

  /**
   * Public QR or code verification of academic degree or certificate.
   * GET /api/graduation/verify/:codigoRegistro
   */
  static async verifyGraduationCode(codigoRegistro: string): Promise<any> {
    const record = await GraduationDAO.findExpedienteByCodigoRegistro(codigoRegistro);

    if (!record || !record.fecha_emision) {
      throw new AppError(
        'El título o certificado consultado no fue encontrado o no ha sido emitido oficialmente por la institución',
        404
      );
    }

    return {
      autenticidad_verificada: true,
      codigo_registro: record.codigo_registro_titulo_emitido,
      tipo_documento: record.tipo_documento_final,
      fecha_emision: record.fecha_emision,
      estudiante: {
        nombres: record.aspirante_nombres,
        apellidos: record.aspirante_apellidos,
        tipo_identificacion: record.tipo_identificacion,
        numero_identificacion: record.numero_identificacion,
      },
      programa: {
        nombre: record.programa_nombre,
        categoria: record.programa_categoria,
        subtipo: record.programa_subtipo,
        titulo_o_certificado_otorgado: record.titulo_o_certificado_otorgado,
      },
      cohorte: {
        codigo_cohorte: record.codigo_cohorte,
        sede: record.nombre_sede,
      },
      documento_digital_url: record.documento_final_url,
    };
  }
}
