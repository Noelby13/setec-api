import ExcelJS from 'exceljs';
import fs from 'fs';
import { GradesDAO } from './grades.dao';
import { ModifyGradeInput, ExcelGradeRow } from './grades.schema';
import { withTransaction } from '../../db/pool';
import { AppError } from '../../middlewares/error.middleware';
import { EscalaCualitativaSnepa } from '../../types/enums';

/**
 * Normalizes text for header matching (lowercased, accents removed, non-alphanumeric replaced).
 */
function normalizeHeaderName(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Extracts plain primitive value from an ExcelJS cell.
 */
function getCellPrimitiveValue(cellValue: ExcelJS.CellValue): any {
  if (cellValue === null || cellValue === undefined) return null;
  if (typeof cellValue === 'object') {
    if ('result' in cellValue) return (cellValue as any).result;
    if ('text' in cellValue) return (cellValue as any).text;
    if ('richText' in cellValue) {
      return (cellValue as any).richText.map((t: any) => t.text).join('');
    }
  }
  return cellValue;
}

/**
 * Safe boolean parser supporting common Spanish and English spreadsheet conventions.
 */
function parseSpreadsheetBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return ['si', 's', 'true', '1', 'v', 'verdadero', 'yes', 'y'].includes(s);
  }
  return false;
}

/**
 * Calculates SNEPA qualitative assessment based on quantitative grade.
 * Art. SNEPA:
 * >= 90: APRENDIZAJE_AVANZADO
 * >= 80: APRENDIZAJE_SATISFACTORIO
 * >= 70: APRENDIZAJE_FUNDAMENTAL
 * < 70: APRENDIZAJE_INICIAL
 */
export function calculateSnepaQualitativeScale(score: number): EscalaCualitativaSnepa {
  if (score >= 90) return EscalaCualitativaSnepa.APRENDIZAJE_AVANZADO;
  if (score >= 80) return EscalaCualitativaSnepa.APRENDIZAJE_SATISFACTORIO;
  if (score >= 70) return EscalaCualitativaSnepa.APRENDIZAJE_FUNDAMENTAL;
  return EscalaCualitativaSnepa.APRENDIZAJE_INICIAL;
}

/**
 * Determines passing state based on quantitative score and qualitative valuation.
 */
export function isGradeApproved(score: number, qualitative?: EscalaCualitativaSnepa): boolean {
  if (qualitative) {
    return qualitative !== EscalaCualitativaSnepa.APRENDIZAJE_INICIAL;
  }
  return score >= 70;
}

export class GradesService {
  /**
   * Import Grades from Excel file (.xlsx) under SNEPA guidelines.
   * POST /api/grades/import/:programacionComponenteId
   */
  static async importGradesFromExcel(
    programacionComponenteId: string,
    filePath: string,
    relativeUrl: string,
    currentUserId: string,
    observacionesLote?: string
  ): Promise<{
    lote: any;
    total_filas_leidas: number;
    total_registros_procesados: number;
    errores_filas: { fila: number; error: string }[];
  }> {
    // 1. Verify existence of Excel file on disk
    if (!fs.existsSync(filePath)) {
      throw new AppError('El archivo Excel subido no fue encontrado en el servidor', 400);
    }

    // 2. Verify modular schedule and check if actas are closed
    const programacion = await GradesDAO.getProgramacionComponenteById(programacionComponenteId);
    if (!programacion) {
      throw new AppError('Programación de componente curricular no encontrada', 404);
    }

    if (programacion.actas_notas_cerradas) {
      throw new AppError(
        'Las actas de notas para esta programación ya se encuentran cerradas. No es posible importar más calificaciones.',
        400
      );
    }

    // 3. Parse Excel file using ExcelJS
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch (err: any) {
      throw new AppError(`Error al leer el archivo Excel: ${err?.message || 'Formato inválido'}`, 400);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new AppError('El archivo Excel no contiene ninguna hoja de cálculo válida', 400);
    }

    // 4. Identify column headers
    const headerRow = worksheet.getRow(1);
    const colMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const rawText = getCellPrimitiveValue(cell.value);
      if (rawText) {
        const norm = normalizeHeaderName(String(rawText));
        if (norm.includes('codigo') || norm.includes('expediente')) {
          colMap['codigo_expediente'] = colNumber;
        } else if (norm.includes('cuantitativa') || norm === 'nota' || norm === 'calificacion') {
          colMap['calificacion_cuantitativa'] = colNumber;
        } else if (norm.includes('cualitativa') || norm.includes('valoracion')) {
          colMap['valoracion_cualitativa'] = colNumber;
        } else if (norm.includes('auto') || norm.includes('autoevaluacion')) {
          colMap['autoevaluacion_completada'] = colNumber;
        } else if (norm.includes('coe') || norm.includes('coevaluacion')) {
          colMap['coevaluacion_completada'] = colNumber;
        } else if (norm.includes('observacion') || norm.includes('pedagogico') || norm.includes('acompanamiento')) {
          colMap['observacion_acompanamiento_pedagogico'] = colNumber;
        }
      }
    });

    if (!colMap['codigo_expediente'] || !colMap['calificacion_cuantitativa']) {
      throw new AppError(
        'El archivo Excel debe contener al menos las columnas obligatorias: "codigo_expediente" y "calificacion_cuantitativa"',
        400
      );
    }

    // 5. Extract rows data
    const parsedRows: ExcelGradeRow[] = [];
    const erroresFilas: { fila: number; error: string }[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip headers

      const codigoExpedienteRaw = getCellPrimitiveValue(row.getCell(colMap['codigo_expediente']).value);
      if (!codigoExpedienteRaw) return; // Skip blank rows

      const codigoExpediente = String(codigoExpedienteRaw).trim();
      const rawScore = getCellPrimitiveValue(row.getCell(colMap['calificacion_cuantitativa']).value);
      const score = Number(rawScore);

      if (isNaN(score) || score < 0 || score > 100) {
        erroresFilas.push({
          fila: rowNumber,
          error: `Calificación cuantitativa inválida ("${rawScore}") para el expediente ${codigoExpediente}. Debe ser entre 0 y 100.`,
        });
        return;
      }

      // Qualitative score
      let cualitativa: EscalaCualitativaSnepa | undefined = undefined;
      if (colMap['valoracion_cualitativa']) {
        const rawCualitativa = getCellPrimitiveValue(row.getCell(colMap['valoracion_cualitativa']).value);
        if (rawCualitativa) {
          const normCualitativa = String(rawCualitativa).trim().toUpperCase();
          if (Object.values(EscalaCualitativaSnepa).includes(normCualitativa as EscalaCualitativaSnepa)) {
            cualitativa = normCualitativa as EscalaCualitativaSnepa;
          }
        }
      }

      // If qualitative was not supplied or was invalid, calculate from quantitative
      if (!cualitativa) {
        cualitativa = calculateSnepaQualitativeScale(score);
      }

      // Self and Peer evaluations
      let autoevaluacion: boolean | undefined = undefined;
      if (colMap['autoevaluacion_completada']) {
        const rawAuto = getCellPrimitiveValue(row.getCell(colMap['autoevaluacion_completada']).value);
        autoevaluacion = parseSpreadsheetBoolean(rawAuto);
      }

      let coevaluacion: boolean | undefined = undefined;
      if (colMap['coevaluacion_completada']) {
        const rawCoe = getCellPrimitiveValue(row.getCell(colMap['coevaluacion_completada']).value);
        coevaluacion = parseSpreadsheetBoolean(rawCoe);
      }

      // Pedagogical accompaniment observation
      let observacion: string | undefined = undefined;
      if (colMap['observacion_acompanamiento_pedagogico']) {
        const rawObs = getCellPrimitiveValue(row.getCell(colMap['observacion_acompanamiento_pedagogico']).value);
        if (rawObs) observacion = String(rawObs).trim();
      }

      parsedRows.push({
        codigo_expediente: codigoExpediente,
        calificacion_cuantitativa: score,
        valoracion_cualitativa: cualitativa,
        autoevaluacion_completada: autoevaluacion,
        coevaluacion_completada: coevaluacion,
        observacion_acompanamiento_pedagogico: observacion,
        rowNumber,
      });
    });

    if (parsedRows.length === 0 && erroresFilas.length > 0) {
      throw new AppError(
        `No se pudo procesar ninguna fila del Excel. Errores: ${erroresFilas.map((e) => e.error).join('; ')}`,
        400
      );
    }

    // 6. Execute atomic transaction to persist lote and grades
    return await withTransaction(async (client) => {
      // Create import lote record
      const lote = await GradesDAO.createLoteImportacion(
        {
          programacion_componente_id: programacionComponenteId,
          subido_por_usuario_id: currentUserId,
          archivo_excel_url: relativeUrl,
          total_registros_procesados: 0,
          observaciones: observacionesLote || `Importación de ${parsedRows.length} calificaciones`,
        },
        client
      );

      let processedCount = 0;

      for (const row of parsedRows) {
        // Find enrollment by codigo_expediente
        const inscripcion = await GradesDAO.findInscripcionByCodigoExpediente(row.codigo_expediente, client);
        if (!inscripcion) {
          erroresFilas.push({
            fila: row.rowNumber,
            error: `El expediente "${row.codigo_expediente}" no existe en el sistema.`,
          });
          continue;
        }

        // Verify if enrollment belongs to the scheduled cohort
        if (inscripcion.cohorte_id !== programacion.cohorte_id) {
          erroresFilas.push({
            fila: row.rowNumber,
            error: `El expediente "${row.codigo_expediente}" pertenece a otra cohorte distinta a la programada.`,
          });
          continue;
        }

        const approved = isGradeApproved(row.calificacion_cuantitativa, row.valoracion_cualitativa);

        // Upsert grade into matricula_componentes_snepa
        await GradesDAO.upsertMatriculaComponenteSnepa(
          {
            inscripcion_id: inscripcion.id,
            programacion_componente_id: programacionComponenteId,
            componente_id: programacion.componente_id,
            lote_importacion_id: lote.id,
            calificacion_cuantitativa: row.calificacion_cuantitativa,
            valoracion_cualitativa: row.valoracion_cualitativa || calculateSnepaQualitativeScale(row.calificacion_cuantitativa),
            observacion_acompanamiento_pedagogico: row.observacion_acompanamiento_pedagogico,
            autoevaluacion_completada: row.autoevaluacion_completada,
            coevaluacion_completada: row.coevaluacion_completada,
            aprobado: approved,
            registrado_por_usuario_id: currentUserId,
          },
          client
        );

        processedCount++;
      }

      // Update total processed in lotes_importacion_notas
      const updatedLote = await GradesDAO.updateLoteImportacionTotal(
        lote.id,
        processedCount,
        observacionesLote || `Procesados: ${processedCount}, con ${erroresFilas.length} observaciones`,
        client
      );

      return {
        lote: updatedLote,
        total_filas_leidas: parsedRows.length + erroresFilas.length,
        total_registros_procesados: processedCount,
        errores_filas: erroresFilas,
      };
    });
  }

  /**
   * Manual Grade Modification with Full Audit Trail.
   * PATCH /api/grades/:matriculaComponenteId
   */
  static async modifyGradeManually(
    matriculaComponenteId: string,
    data: ModifyGradeInput,
    currentUserId: string
  ): Promise<{
    grade: any;
    auditLog: any;
  }> {
    return await withTransaction(async (client) => {
      // 1. Fetch current grade
      const currentGrade = await GradesDAO.getMatriculaComponenteById(matriculaComponenteId, client);
      if (!currentGrade) {
        throw new AppError('Registro de calificación no encontrado', 404);
      }

      const notaAnterior = currentGrade.calificacion_cuantitativa !== null
        ? Number(currentGrade.calificacion_cuantitativa)
        : null;
      const cualitativaAnterior = currentGrade.valoracion_cualitativa as EscalaCualitativaSnepa | null;

      // 2. Compute new quantitative and qualitative values
      let notaNueva = notaAnterior;
      if (data.calificacion_cuantitativa !== undefined) {
        notaNueva = data.calificacion_cuantitativa;
      }

      let cualitativaNueva = cualitativaAnterior;
      if (data.valoracion_cualitativa !== undefined) {
        cualitativaNueva = data.valoracion_cualitativa;
      } else if (data.calificacion_cuantitativa !== undefined) {
        cualitativaNueva = calculateSnepaQualitativeScale(data.calificacion_cuantitativa);
      }

      // Compute approval status
      let aprobadoNuevo = currentGrade.aprobado;
      if (notaNueva !== null) {
        aprobadoNuevo = isGradeApproved(notaNueva, cualitativaNueva || undefined);
      }

      // 3. Update grade in matricula_componentes_snepa
      const updatedGrade = await GradesDAO.updateMatriculaComponenteManual(
        matriculaComponenteId,
        {
          calificacion_cuantitativa: notaNueva !== null ? notaNueva : undefined,
          valoracion_cualitativa: cualitativaNueva || undefined,
          observacion_acompanamiento_pedagogico: data.observacion_acompanamiento_pedagogico,
          autoevaluacion_completada: data.autoevaluacion_completada,
          coevaluacion_completada: data.coevaluacion_completada,
          aprobado: aprobadoNuevo,
          modificado_por_usuario_id: currentUserId,
        },
        client
      );

      // 4. Insert audit record in notas_snepa_logs
      const auditLog = await GradesDAO.insertNotaSnepaLog(
        {
          matricula_componente_id: matriculaComponenteId,
          nota_anterior: notaAnterior,
          nota_nueva: notaNueva,
          cualitativa_anterior: cualitativaAnterior,
          cualitativa_nueva: cualitativaNueva,
          motivo_modificacion: data.motivo_modificacion,
          modificado_por_usuario_id: currentUserId,
        },
        client
      );

      return {
        grade: updatedGrade,
        auditLog,
      };
    });
  }

  /**
   * Get all grades for a scheduled component.
   */
  static async getGradesByComponent(programacionComponenteId: string): Promise<any[]> {
    const programacion = await GradesDAO.getProgramacionComponenteById(programacionComponenteId);
    if (!programacion) {
      throw new AppError('Programación de componente curricular no encontrada', 404);
    }
    return await GradesDAO.getGradesByComponent(programacionComponenteId);
  }

  /**
   * Get academic history (transcript) for a student enrollment.
   */
  static async getGradesByInscripcion(inscripcionId: string): Promise<any[]> {
    return await GradesDAO.getGradesByInscripcion(inscripcionId);
  }

  /**
   * Get audit log history for a grade record.
   */
  static async getGradeLogs(matriculaComponenteId: string): Promise<any[]> {
    const grade = await GradesDAO.getMatriculaComponenteById(matriculaComponenteId);
    if (!grade) {
      throw new AppError('Registro de calificación no encontrado', 404);
    }
    return await GradesDAO.getGradeLogsByMatricula(matriculaComponenteId);
  }

  /**
   * Get all import lots for a scheduled component.
   */
  static async getImportLots(programacionComponenteId: string): Promise<any[]> {
    return await GradesDAO.getLotesByProgramacionComponente(programacionComponenteId);
  }
}
