import { pool, withTransaction, DbClient } from '../../db/pool';
import { AppError } from '../../middlewares/error.middleware';
import {
  ApplicantDao,
  AspiranteRecord,
  AspiranteDetailRecord,
  ApplicantInterestRecord,
  TituloAcademicoRecord,
  CreateApplicantProfileData,
  UpdateApplicantProfileData,
  CreateAcademicDegreeData,
  UpdateAcademicDegreeData,
  ListApplicantsFilters,
} from './applicant.dao';
import {
  CreateApplicantProfileInput,
  UpdateApplicantProfileInput,
  CreateAcademicDegreeInput,
  UpdateAcademicDegreeInput,
  ValidateAcademicDegreeInput,
} from './applicant.schema';
import { EstadoValidacionTitulo } from '../../types/enums';

/**
 * Calculates current age from a birth date string (YYYY-MM-DD).
 */
export function calculateAge(birthDateString: string): number {
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) {
    throw new AppError('Fecha de nacimiento inválida', 400);
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

export interface UploadedProfileFiles {
  cedula_identidad_pdf_url?: string;
  tutor_documento_url?: string;
}

export interface UploadedDegreeFiles {
  titulo_pdf_url?: string;
  certificado_rn_url?: string;
}

export class ApplicantService {
  // ==========================================
  // PERFIL DEL ASPIRANTE
  // ==========================================

  /**
   * Create an applicant profile with SETEC Art. 86 minor validation and atomic interests assignment.
   */
  static async createProfile(
    input: CreateApplicantProfileInput,
    uploadedFiles: UploadedProfileFiles = {}
  ): Promise<AspiranteDetailRecord> {
    const cedulaPdfUrl = uploadedFiles.cedula_identidad_pdf_url || input.cedula_identidad_pdf_url || null;
    const tutorDocUrl = uploadedFiles.tutor_documento_url || input.tutor_documento_url || null;

    // 1. SETEC Art. 86 Validation: Minor of age (< 18 years old)
    const age = calculateAge(input.fecha_nacimiento);
    if (age < 18) {
      const tutorNombre = input.tutor_nombre_completo?.trim();
      const tutorId = input.tutor_identificacion?.trim();
      const tutorDoc = tutorDocUrl?.trim();

      if (!tutorNombre || !tutorId || !tutorDoc) {
        throw new AppError(
          'Requisito Art. 86 SETEC: El aspirante es menor de edad (< 18 años). Es obligatorio proporcionar tutor_nombre_completo, tutor_identificacion y tutor_documento_url para cursos de extensión.',
          400
        );
      }
    }

    // 2. Uniqueness Checks
    const existingById = await ApplicantDao.getProfileByNumeroIdentificacion(input.numero_identificacion);
    if (existingById) {
      throw new AppError(
        `Ya existe un perfil de aspirante registrado con la identificación '${input.numero_identificacion}'.`,
        409
      );
    }

    const existingByEmail = await ApplicantDao.getProfileByEmail(input.email);
    if (existingByEmail) {
      throw new AppError(
        `Ya existe un perfil de aspirante registrado con el correo electrónico '${input.email}'.`,
        409
      );
    }

    if (input.usuario_id) {
      const existingByUser = await ApplicantDao.getProfileByUsuarioId(input.usuario_id);
      if (existingByUser) {
        throw new AppError(
          'El usuario ya cuenta con un perfil de aspirante vinculado.',
          409
        );
      }
    }

    // 3. Validate knowledge areas if provided
    if (input.intereses_areas_ids && input.intereses_areas_ids.length > 0) {
      await this.validateAreaIds(input.intereses_areas_ids);
    }

    // 4. Atomic execution with transaction
    return await withTransaction(async (client) => {
      const profileData: CreateApplicantProfileData = {
        usuario_id: input.usuario_id || null,
        tipo_identificacion: input.tipo_identificacion,
        numero_identificacion: input.numero_identificacion,
        nombres: input.nombres,
        apellidos: input.apellidos,
        fecha_nacimiento: input.fecha_nacimiento,
        email: input.email,
        telefono: input.telefono,
        cedula_identidad_pdf_url: cedulaPdfUrl,
        tiene_discapacidad: input.tiene_discapacidad ?? false,
        descripcion_ajuste_razonable: input.descripcion_ajuste_razonable || null,
        tutor_nombre_completo: input.tutor_nombre_completo || null,
        tutor_identificacion: input.tutor_identificacion || null,
        tutor_documento_url: tutorDocUrl,
      };

      const createdProfile = await ApplicantDao.createProfile(profileData, client);

      let savedInterests: ApplicantInterestRecord[] = [];
      if (input.intereses_areas_ids && input.intereses_areas_ids.length > 0) {
        savedInterests = await ApplicantDao.replaceInterests(
          createdProfile.id,
          input.intereses_areas_ids,
          client
        );
      }

      return {
        ...createdProfile,
        intereses: savedInterests,
        titulos: [],
      };
    });
  }

  /**
   * Update an applicant profile with SETEC Art. 86 minor validation.
   */
  static async updateProfile(
    id: string,
    input: UpdateApplicantProfileInput,
    uploadedFiles: UploadedProfileFiles = {}
  ): Promise<AspiranteDetailRecord> {
    const existing = await ApplicantDao.getProfileById(id);
    if (!existing) {
      throw new AppError('Perfil de aspirante no encontrado', 404);
    }

    const cedulaPdfUrl = uploadedFiles.cedula_identidad_pdf_url || input.cedula_identidad_pdf_url;
    const tutorDocUrl = uploadedFiles.tutor_documento_url || input.tutor_documento_url;

    // 1. Determine effective birth date and minor status
    const effectiveBirthDate = input.fecha_nacimiento || existing.fecha_nacimiento;
    const age = calculateAge(effectiveBirthDate);

    if (age < 18) {
      const effectiveTutorNombre =
        input.tutor_nombre_completo !== undefined
          ? input.tutor_nombre_completo?.trim()
          : existing.tutor_nombre_completo?.trim();
      const effectiveTutorId =
        input.tutor_identificacion !== undefined
          ? input.tutor_identificacion?.trim()
          : existing.tutor_identificacion?.trim();
      const effectiveTutorDoc =
        tutorDocUrl !== undefined ? tutorDocUrl?.trim() : existing.tutor_documento_url?.trim();

      if (!effectiveTutorNombre || !effectiveTutorId || !effectiveTutorDoc) {
        throw new AppError(
          'Requisito Art. 86 SETEC: El aspirante es menor de edad (< 18 años). Es obligatorio registrar tutor_nombre_completo, tutor_identificacion y tutor_documento_url para cursos de extensión.',
          400
        );
      }
    }

    // 2. Uniqueness checks on modification
    if (
      input.numero_identificacion &&
      input.numero_identificacion !== existing.numero_identificacion
    ) {
      const existingById = await ApplicantDao.getProfileByNumeroIdentificacion(
        input.numero_identificacion
      );
      if (existingById && existingById.id !== id) {
        throw new AppError(
          `El número de identificación '${input.numero_identificacion}' ya está en uso por otro aspirante.`,
          409
        );
      }
    }

    if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
      const existingByEmail = await ApplicantDao.getProfileByEmail(input.email);
      if (existingByEmail && existingByEmail.id !== id) {
        throw new AppError(
          `El correo electrónico '${input.email}' ya está registrado por otro aspirante.`,
          409
        );
      }
    }

    // 3. Validate knowledge areas if provided
    if (input.intereses_areas_ids && input.intereses_areas_ids.length > 0) {
      await this.validateAreaIds(input.intereses_areas_ids);
    }

    // 4. Update transaccionalmente
    return await withTransaction(async (client) => {
      const updateData: UpdateApplicantProfileData = {
        tipo_identificacion: input.tipo_identificacion,
        numero_identificacion: input.numero_identificacion,
        nombres: input.nombres,
        apellidos: input.apellidos,
        fecha_nacimiento: input.fecha_nacimiento,
        email: input.email,
        telefono: input.telefono,
        cedula_identidad_pdf_url: cedulaPdfUrl,
        tiene_discapacidad: input.tiene_discapacidad,
        descripcion_ajuste_razonable: input.descripcion_ajuste_razonable,
        tutor_nombre_completo: input.tutor_nombre_completo,
        tutor_identificacion: input.tutor_identificacion,
        tutor_documento_url: tutorDocUrl,
      };

      const updatedProfile = await ApplicantDao.updateProfile(id, updateData, client);
      if (!updatedProfile) {
        throw new AppError('Error al actualizar el perfil del aspirante', 500);
      }

      let interests: ApplicantInterestRecord[] = [];
      if (input.intereses_areas_ids !== undefined) {
        interests = await ApplicantDao.replaceInterests(id, input.intereses_areas_ids, client);
      } else {
        interests = await ApplicantDao.getInterests(id, client);
      }

      const degrees = await ApplicantDao.listAcademicDegreesByAspirante(id, client);

      return {
        ...updatedProfile,
        intereses: interests,
        titulos: degrees,
      };
    });
  }

  /**
   * Get an applicant's complete profile by applicant ID.
   */
  static async getProfileById(id: string): Promise<AspiranteDetailRecord> {
    const profile = await ApplicantDao.getProfileById(id);
    if (!profile) {
      throw new AppError('Perfil de aspirante no encontrado', 404);
    }

    const [intereses, titulos] = await Promise.all([
      ApplicantDao.getInterests(id),
      ApplicantDao.listAcademicDegreesByAspirante(id),
    ]);

    return {
      ...profile,
      intereses,
      titulos,
    };
  }

  /**
   * Get an applicant's complete profile by linked user ID (from JWT).
   */
  static async getProfileByUsuarioId(usuarioId: string): Promise<AspiranteDetailRecord | null> {
    const profile = await ApplicantDao.getProfileByUsuarioId(usuarioId);
    if (!profile) {
      return null;
    }

    const [intereses, titulos] = await Promise.all([
      ApplicantDao.getInterests(profile.id),
      ApplicantDao.listAcademicDegreesByAspirante(profile.id),
    ]);

    return {
      ...profile,
      intereses,
      titulos,
    };
  }

  /**
   * List applicant profiles with administrative filters and search.
   */
  static async listProfiles(filters: ListApplicantsFilters = {}): Promise<AspiranteRecord[]> {
    return ApplicantDao.listProfiles(filters);
  }

  /**
   * Administrative verification of identity (Estudiante.isVerificado V2).
   */
  static async verifyIdentity(
    id: string,
    verificadoPorUsuarioId: string
  ): Promise<AspiranteRecord> {
    const profile = await ApplicantDao.getProfileById(id);
    if (!profile) {
      throw new AppError('Perfil de aspirante no encontrado', 404);
    }

    const updated = await ApplicantDao.verifyIdentity(id, verificadoPorUsuarioId);
    if (!updated) {
      throw new AppError('No se pudo verificar la identidad del aspirante', 500);
    }

    return updated;
  }

  // ==========================================
  // INTERESES EN ÁREAS DE CONOCIMIENTO
  // ==========================================

  /**
   * Replace all interests of an applicant transaccionalmente.
   */
  static async replaceInterests(
    aspiranteId: string,
    areaConocimientoIds: string[]
  ): Promise<ApplicantInterestRecord[]> {
    const profile = await ApplicantDao.getProfileById(aspiranteId);
    if (!profile) {
      throw new AppError('Perfil de aspirante no encontrado', 404);
    }

    if (areaConocimientoIds.length > 0) {
      await this.validateAreaIds(areaConocimientoIds);
    }

    return withTransaction(async (client) => {
      return ApplicantDao.replaceInterests(aspiranteId, areaConocimientoIds, client);
    });
  }

  /**
   * Get declared interests of an applicant.
   */
  static async getInterests(aspiranteId: string): Promise<ApplicantInterestRecord[]> {
    const profile = await ApplicantDao.getProfileById(aspiranteId);
    if (!profile) {
      throw new AppError('Perfil de aspirante no encontrado', 404);
    }
    return ApplicantDao.getInterests(aspiranteId);
  }

  // ==========================================
  // TÍTULOS ACADÉMICOS PREVIOS
  // ==========================================

  /**
   * Register a new academic degree with Multer uploaded documents.
   */
  static async createAcademicDegree(
    aspiranteId: string,
    input: CreateAcademicDegreeInput,
    uploadedFiles: UploadedDegreeFiles = {}
  ): Promise<TituloAcademicoRecord> {
    const profile = await ApplicantDao.getProfileById(aspiranteId);
    if (!profile) {
      throw new AppError('Perfil de aspirante no encontrado', 404);
    }

    const tituloPdfUrl = uploadedFiles.titulo_pdf_url || input.titulo_pdf_url;
    const certificadoRnUrl = uploadedFiles.certificado_rn_url || input.certificado_rn_url || null;

    if (!tituloPdfUrl) {
      throw new AppError(
        'El archivo PDF del título académico (titulo_pdf) es obligatorio',
        400
      );
    }

    if (input.area_conocimiento_id) {
      await this.validateAreaIds([input.area_conocimiento_id]);
    }

    const degreeData: CreateAcademicDegreeData = {
      aspirante_id: aspiranteId,
      area_conocimiento_id: input.area_conocimiento_id || null,
      nivel_titulo: input.nivel_titulo,
      denominacion_titulo: input.denominacion_titulo,
      institucion_emisora: input.institucion_emisora,
      fecha_emision: input.fecha_emision,
      inscrito_registro_nacional: input.inscrito_registro_nacional ?? false,
      codigo_registro_nacional: input.codigo_registro_nacional || null,
      certificado_rn_url: certificadoRnUrl,
      titulo_pdf_url: tituloPdfUrl,
      porcentaje_creditos_investigacion: input.porcentaje_creditos_investigacion ?? null,
    };

    return ApplicantDao.createAcademicDegree(degreeData);
  }

  /**
   * Get an academic degree by ID.
   */
  static async getAcademicDegreeById(degreeId: string): Promise<TituloAcademicoRecord> {
    const degree = await ApplicantDao.getAcademicDegreeById(degreeId);
    if (!degree) {
      throw new AppError('Título académico no encontrado', 404);
    }
    return degree;
  }

  /**
   * List all academic degrees of an applicant.
   */
  static async listAcademicDegrees(aspiranteId: string): Promise<TituloAcademicoRecord[]> {
    const profile = await ApplicantDao.getProfileById(aspiranteId);
    if (!profile) {
      throw new AppError('Perfil de aspirante no encontrado', 404);
    }
    return ApplicantDao.listAcademicDegreesByAspirante(aspiranteId);
  }

  /**
   * Update an academic degree.
   */
  static async updateAcademicDegree(
    degreeId: string,
    input: UpdateAcademicDegreeInput,
    uploadedFiles: UploadedDegreeFiles = {}
  ): Promise<TituloAcademicoRecord> {
    const existing = await ApplicantDao.getAcademicDegreeById(degreeId);
    if (!existing) {
      throw new AppError('Título académico no encontrado', 404);
    }

    if (input.area_conocimiento_id) {
      await this.validateAreaIds([input.area_conocimiento_id]);
    }

    const tituloPdfUrl = uploadedFiles.titulo_pdf_url || input.titulo_pdf_url;
    const certificadoRnUrl = uploadedFiles.certificado_rn_url || input.certificado_rn_url;

    const updateData: UpdateAcademicDegreeData = {
      area_conocimiento_id: input.area_conocimiento_id,
      nivel_titulo: input.nivel_titulo,
      denominacion_titulo: input.denominacion_titulo,
      institucion_emisora: input.institucion_emisora,
      fecha_emision: input.fecha_emision,
      inscrito_registro_nacional: input.inscrito_registro_nacional,
      codigo_registro_nacional: input.codigo_registro_nacional,
      certificado_rn_url: certificadoRnUrl,
      titulo_pdf_url: tituloPdfUrl || undefined,
      porcentaje_creditos_investigacion: input.porcentaje_creditos_investigacion,
    };

    // Changed evidence cannot retain an approval of the previous document.
    if (Object.values(updateData).some(value => value !== undefined)) {
      updateData.estado_validacion = EstadoValidacionTitulo.PENDIENTE;
    }
    const updated = await ApplicantDao.updateAcademicDegree(degreeId, updateData);
    if (!updated) {
      throw new AppError('Error al actualizar el título académico', 500);
    }

    return updated;
  }

  /**
   * Delete an academic degree if not linked to existing inscriptions.
   */
  static async deleteAcademicDegree(degreeId: string): Promise<boolean> {
    const existing = await ApplicantDao.getAcademicDegreeById(degreeId);
    if (!existing) {
      throw new AppError('Título académico no encontrado', 404);
    }

    // Verify if this degree is used as backing document in any inscription
    const checkInscription = await pool.query(
      'SELECT id FROM inscripciones WHERE titulo_presentado_id = $1 LIMIT 1;',
      [degreeId]
    );

    if (checkInscription.rows.length > 0) {
      throw new AppError(
        'No es posible eliminar el título académico porque se encuentra respaldando una o más inscripciones activas.',
        400
      );
    }

    return ApplicantDao.deleteAcademicDegree(degreeId);
  }

  /**
   * Validate or reject an academic degree by administration.
   */
  static async validateAcademicDegree(
    degreeId: string,
    input: ValidateAcademicDegreeInput,
    usuarioValidadorId: string
  ): Promise<TituloAcademicoRecord> {
    const degree = await ApplicantDao.getAcademicDegreeById(degreeId);
    if (!degree) {
      throw new AppError('Título académico no encontrado', 404);
    }

    if (
      input.estado_validacion === EstadoValidacionTitulo.RECHAZADO &&
      (!input.observacion_rechazo || input.observacion_rechazo.trim().length === 0)
    ) {
      throw new AppError(
        'Es obligatorio proporcionar una observación de rechazo cuando se rechaza la validez del título.',
        400
      );
    }

    const observacionRechazo =
      input.estado_validacion === EstadoValidacionTitulo.RECHAZADO
        ? input.observacion_rechazo?.trim() || null
        : null;

    const validated = await ApplicantDao.validateAcademicDegree(
      degreeId,
      input.estado_validacion,
      observacionRechazo,
      usuarioValidadorId
    );

    if (!validated) {
      throw new AppError('Error al procesar la validación administrativa del título', 500);
    }

    return validated;
  }

  // ==========================================
  // HELPERS PRIVADOS
  // ==========================================

  private static async validateAreaIds(areaIds: string[], db: DbClient = pool): Promise<void> {
    const uniqueIds = Array.from(new Set(areaIds));
    const query = `
      SELECT id FROM areas_conocimiento 
      WHERE id = ANY($1::uuid[]) AND activa = TRUE;
    `;
    const res = await db.query<{ id: string }>(query, [uniqueIds]);
    const foundIds = new Set(res.rows.map((r) => r.id));

    const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new AppError(
        `Una o más áreas de conocimiento no existen o no están activas: ${missingIds.join(', ')}`,
        400
      );
    }
  }
}
