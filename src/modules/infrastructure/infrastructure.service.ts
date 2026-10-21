import {
  InfrastructureDao,
  SedeIesRecord,
  DocenteRecord,
  CreateSedeData,
  UpdateSedeData,
  CreateDocenteData,
  UpdateDocenteData,
} from './infrastructure.dao';
import { CreateSedeInput, UpdateSedeInput, CreateDocenteInput, UpdateDocenteInput } from './infrastructure.schema';
import { AppError } from '../../middlewares/error.middleware';
import { pool } from '../../db/pool';

const VALID_TIPOS_SEDE = ['SEDE_CENTRAL', 'SEDE', 'SUBSEDE', 'EXTENSION', 'UNICAM'] as const;
const VALID_GRADOS = ['LICENCIADO', 'ESPECIALISTA', 'MASTER', 'DOCTOR'] as const;

export class InfrastructureService {
  // ==========================================
  // SERVICIOS: SEDES UNIVERSITARIAS (SETEC Art. 22-28)
  // ==========================================

  /**
   * List university campuses.
   */
  static async listSedes(onlyActive = false): Promise<SedeIesRecord[]> {
    return InfrastructureDao.listSedes(onlyActive);
  }

  /**
   * Get campus details by UUID.
   */
  static async getSedeById(id: string): Promise<SedeIesRecord> {
    const sede = await InfrastructureDao.findSedeById(id);
    if (!sede) {
      throw new AppError('Sede universitaria no encontrada', 404);
    }
    return sede;
  }

  /**
   * Register a new campus verifying SETEC type constraints and unique code.
   */
  static async createSede(input: CreateSedeInput): Promise<SedeIesRecord> {
    // Validate CHECK constraint for tipo_sede
    if (!VALID_TIPOS_SEDE.includes(input.tipo_sede as any)) {
      throw new AppError(
        `Tipo de sede inválido. Los tipos permitidos por normativa SETEC son: ${VALID_TIPOS_SEDE.join(', ')}`,
        400
      );
    }

    const existingByCodigo = await InfrastructureDao.findSedeByCodigo(input.codigo_sede);
    if (existingByCodigo) {
      throw new AppError(
        `Ya existe una sede registrada con el código institucional "${input.codigo_sede.toUpperCase()}"`,
        409
      );
    }

    const data: CreateSedeData = {
      codigo_sede: input.codigo_sede,
      nombre: input.nombre.trim(),
      tipo_sede: input.tipo_sede,
      resolucion_autorizacion_setec: input.resolucion_autorizacion_setec?.trim() || null,
      direccion: input.direccion?.trim() || null,
      activa: input.activa ?? true,
    };

    return InfrastructureDao.createSede(data);
  }

  /**
   * Update an existing campus.
   */
  static async updateSede(id: string, input: UpdateSedeInput): Promise<SedeIesRecord> {
    const currentSede = await InfrastructureDao.findSedeById(id);
    if (!currentSede) {
      throw new AppError('Sede universitaria no encontrada', 404);
    }

    if (input.tipo_sede && !VALID_TIPOS_SEDE.includes(input.tipo_sede as any)) {
      throw new AppError(
        `Tipo de sede inválido. Los tipos permitidos son: ${VALID_TIPOS_SEDE.join(', ')}`,
        400
      );
    }

    if (input.codigo_sede && input.codigo_sede.toUpperCase() !== currentSede.codigo_sede.toUpperCase()) {
      const existingByCodigo = await InfrastructureDao.findSedeByCodigo(input.codigo_sede);
      if (existingByCodigo && existingByCodigo.id !== id) {
        throw new AppError(
          `Ya existe otra sede registrada con el código "${input.codigo_sede.toUpperCase()}"`,
          409
        );
      }
    }

    const data: UpdateSedeData = {
      codigo_sede: input.codigo_sede,
      nombre: input.nombre?.trim(),
      tipo_sede: input.tipo_sede,
      resolucion_autorizacion_setec:
        input.resolucion_autorizacion_setec !== undefined
          ? input.resolucion_autorizacion_setec?.trim() || null
          : undefined,
      direccion: input.direccion !== undefined ? input.direccion?.trim() || null : undefined,
      activa: input.activa,
    };

    const updated = await InfrastructureDao.updateSede(id, data);
    if (!updated) {
      throw new AppError('No se pudo actualizar la sede universitaria', 500);
    }

    return updated;
  }

  /**
   * Delete a campus by ID.
   */
  static async deleteSede(id: string): Promise<void> {
    const sede = await InfrastructureDao.findSedeById(id);
    if (!sede) {
      throw new AppError('Sede universitaria no encontrada', 404);
    }

    try {
      const deleted = await InfrastructureDao.deleteSede(id);
      if (!deleted) {
        throw new AppError('No se pudo eliminar la sede universitaria', 500);
      }
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new AppError(
          'No se puede eliminar la sede porque cuenta con cohortes, aulas o programas asociados',
          409
        );
      }
      throw error;
    }
  }

  // ==========================================
  // SERVICIOS: PERSONAL ACADÉMICO / DOCENTES
  // ==========================================

  /**
   * List academic staff members.
   */
  static async listDocentes(onlyActive = false): Promise<DocenteRecord[]> {
    return InfrastructureDao.listDocentes(onlyActive);
  }

  /**
   * Get an academic staff member by ID with user account details.
   */
  static async getDocenteById(id: string): Promise<DocenteRecord> {
    const docente = await InfrastructureDao.findDocenteById(id);
    if (!docente) {
      throw new AppError('Personal académico no encontrado', 404);
    }
    return docente;
  }

  /**
   * Register a new academic staff member.
   * Validates mandatory CV, degrees, unique identification, and optional user link.
   */
  static async createDocente(
    input: CreateDocenteInput,
    uploadedFiles?: { foto_perfil_url?: string; cv_url?: string }
  ): Promise<DocenteRecord> {
    // Validate CHECK constraint for maximo_grado_academico
    if (!VALID_GRADOS.includes(input.maximo_grado_academico as any)) {
      throw new AppError(
        `Grado académico inválido. Los grados permitidos son: ${VALID_GRADOS.join(', ')}`,
        400
      );
    }

    // Determine final CV URL (file takes priority over form string)
    const finalCvUrl = uploadedFiles?.cv_url || input.cv_url;
    if (!finalCvUrl) {
      throw new AppError(
        'El currículum vitae en formato PDF (cv_pdf) es un requisito normativo obligatorio para registrar personal académico',
        400
      );
    }

    // Determine final Foto Perfil URL
    const finalFotoUrl = uploadedFiles?.foto_perfil_url || input.foto_perfil_url || null;

    // Check unique identification (cédula / pasaporte)
    const existingByIdentificacion = await InfrastructureDao.findDocenteByIdentificacion(input.identificacion);
    if (existingByIdentificacion) {
      throw new AppError(
        `Ya existe un docente registrado con la identificación "${input.identificacion}"`,
        409
      );
    }

    // Validate optional usuario_id
    if (input.usuario_id) {
      const userCheck = await pool.query('SELECT id, rol_id FROM usuarios WHERE id = $1', [input.usuario_id]);
      if (userCheck.rowCount === 0) {
        throw new AppError('El usuario de autenticación especificado no existe en el sistema', 404);
      }

      const existingLinkedDocente = await InfrastructureDao.findDocenteByUsuarioId(input.usuario_id);
      if (existingLinkedDocente) {
        throw new AppError('El usuario especificado ya se encuentra vinculado a otro docente', 409);
      }
    }

    const data: CreateDocenteData = {
      usuario_id: input.usuario_id || null,
      identificacion: input.identificacion.trim(),
      nombres: input.nombres.trim(),
      apellidos: input.apellidos.trim(),
      maximo_grado_academico: input.maximo_grado_academico,
      biografia_comercial: input.biografia_comercial?.trim() || null,
      foto_perfil_url: finalFotoUrl,
      cv_url: finalCvUrl,
      activo: input.activo ?? true,
    };

    return InfrastructureDao.createDocente(data);
  }

  /**
   * Update an existing academic staff member.
   */
  static async updateDocente(
    id: string,
    input: UpdateDocenteInput,
    uploadedFiles?: { foto_perfil_url?: string; cv_url?: string }
  ): Promise<DocenteRecord> {
    const currentDocente = await InfrastructureDao.findDocenteById(id);
    if (!currentDocente) {
      throw new AppError('Personal académico no encontrado', 404);
    }

    if (input.maximo_grado_academico && !VALID_GRADOS.includes(input.maximo_grado_academico as any)) {
      throw new AppError(
        `Grado académico inválido. Los grados permitidos son: ${VALID_GRADOS.join(', ')}`,
        400
      );
    }

    if (
      input.identificacion &&
      input.identificacion.toUpperCase() !== currentDocente.identificacion.toUpperCase()
    ) {
      const existingByIdentificacion = await InfrastructureDao.findDocenteByIdentificacion(input.identificacion);
      if (existingByIdentificacion && existingByIdentificacion.id !== id) {
        throw new AppError(
          `Ya existe otro docente registrado con la identificación "${input.identificacion}"`,
          409
        );
      }
    }

    if (input.usuario_id !== undefined && input.usuario_id !== currentDocente.usuario_id) {
      if (input.usuario_id !== null) {
        const userCheck = await pool.query('SELECT id FROM usuarios WHERE id = $1', [input.usuario_id]);
        if (userCheck.rowCount === 0) {
          throw new AppError('El usuario de autenticación especificado no existe en el sistema', 404);
        }

        const existingLinkedDocente = await InfrastructureDao.findDocenteByUsuarioId(input.usuario_id);
        if (existingLinkedDocente && existingLinkedDocente.id !== id) {
          throw new AppError('El usuario especificado ya se encuentra vinculado a otro docente', 409);
        }
      }
    }

    const finalCvUrl = uploadedFiles?.cv_url || input.cv_url;
    const finalFotoUrl = uploadedFiles?.foto_perfil_url || input.foto_perfil_url;

    const data: UpdateDocenteData = {
      usuario_id: input.usuario_id,
      identificacion: input.identificacion?.trim(),
      nombres: input.nombres?.trim(),
      apellidos: input.apellidos?.trim(),
      maximo_grado_academico: input.maximo_grado_academico,
      biografia_comercial:
        input.biografia_comercial !== undefined ? input.biografia_comercial?.trim() || null : undefined,
      foto_perfil_url: finalFotoUrl !== undefined ? finalFotoUrl : undefined,
      cv_url: finalCvUrl !== undefined ? finalCvUrl : undefined,
      activo: input.activo,
    };

    const updated = await InfrastructureDao.updateDocente(id, data);
    if (!updated) {
      throw new AppError('No se pudo actualizar el personal académico', 500);
    }

    return updated;
  }

  /**
   * Delete an academic staff member.
   */
  static async deleteDocente(id: string): Promise<void> {
    const docente = await InfrastructureDao.findDocenteById(id);
    if (!docente) {
      throw new AppError('Personal académico no encontrado', 404);
    }

    try {
      const deleted = await InfrastructureDao.deleteDocente(id);
      if (!deleted) {
        throw new AppError('No se pudo eliminar el personal académico', 500);
      }
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new AppError(
          'No se puede eliminar el docente porque está asignado a módulos o actas de calificaciones',
          409
        );
      }
      throw error;
    }
  }
}
