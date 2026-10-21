import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { EscalaCualitativaSnepa } from '../types/enums';

/**
 * Script Generador de Plantilla Oficial de Actas de Calificación SNEPA-SETEC
 * Genera `./uploads/actas_excel/plantilla_acta_snepa.xlsx` con cabeceras estilizadas,
 * validación de datos (Data Validation dropdowns) y filas de ejemplo listas para importar.
 */
async function generateSnepaTemplate(): Promise<void> {
  console.log('📊 Iniciando generación de Plantilla Excel SNEPA...');

  const outputDir = path.resolve(process.cwd(), 'uploads', 'actas_excel');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Directorio creado: ${outputDir}`);
  }

  const outputPath = path.join(outputDir, 'plantilla_acta_snepa.xlsx');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SETEC - Dirección de Posgrados y Educación Permanente';
  workbook.lastModifiedBy = 'Sistema SNEPA';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Acta_Calificaciones_SNEPA', {
    views: [{ showGridLines: true }],
  });

  // Definición de Columnas con Anchos Óptimos
  worksheet.columns = [
    { header: 'codigo_expediente', key: 'codigo_expediente', width: 22 },
    { header: 'identificacion', key: 'identificacion', width: 22 },
    { header: 'nombre_completo', key: 'nombre_completo', width: 38 },
    { header: 'calificacion_cuantitativa', key: 'calificacion_cuantitativa', width: 26 },
    { header: 'valoracion_cualitativa', key: 'valoracion_cualitativa', width: 30 },
    { header: 'autoevaluacion_completada', key: 'autoevaluacion_completada', width: 26 },
    { header: 'coevaluacion_completada', key: 'coevaluacion_completada', width: 26 },
    { header: 'observacion_acompanamiento_pedagogico', key: 'observacion_acompanamiento_pedagogico', width: 50 },
  ];

  // Estilización de la Fila de Cabecera (Fila 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D233A' }, // Azul Marino Institucional SETEC
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = borderStyle;
  });

  // 3 Filas de Ejemplo Listas para Importar
  const sampleData = [
    {
      codigo_expediente: 'EXP-2026-0001',
      identificacion: '001-150890-0045V',
      nombre_completo: 'Lic. Carlos Alberto Morales Ruiz',
      calificacion_cuantitativa: 95.5,
      valoracion_cualitativa: EscalaCualitativaSnepa.APRENDIZAJE_AVANZADO,
      autoevaluacion_completada: 'SI',
      coevaluacion_completada: 'SI',
      observacion_acompanamiento_pedagogico: 'Desempeño sobresaliente en el análisis epidemiológico y defensa de casos prácticos.',
    },
    {
      codigo_expediente: 'EXP-2026-0002',
      identificacion: '001-220492-0012A',
      nombre_completo: 'Dra. Elena María Mendoza Silva',
      calificacion_cuantitativa: 84.0,
      valoracion_cualitativa: EscalaCualitativaSnepa.APRENDIZAJE_SATISFACTORIO,
      autoevaluacion_completada: 'SI',
      coevaluacion_completada: 'SI',
      observacion_acompanamiento_pedagogico: 'Cumplió satisfactoriamente con las metas del componente modular.',
    },
    {
      codigo_expediente: 'EXP-2026-0003',
      identificacion: '281-051188-0001C',
      nombre_completo: 'Ing. Roberto José Castillo Vega',
      calificacion_cuantitativa: 72.0,
      valoracion_cualitativa: EscalaCualitativaSnepa.APRENDIZAJE_FUNDAMENTAL,
      autoevaluacion_completada: 'SI',
      coevaluacion_completada: 'NO',
      observacion_acompanamiento_pedagogico: 'Requiere reforzar técnicas de investigación estadística para el siguiente módulo.',
    },
  ];

  // Agregar filas de ejemplo y aplicar estilos a las celdas
  sampleData.forEach((item) => {
    worksheet.addRow(item);
  });

  // Aplicar formato, bordes y Data Validation a las filas (ejemplos + 100 filas disponibles para captura)
  const maxRowsToValidate = 100;
  for (let rowIdx = 2; rowIdx <= maxRowsToValidate; rowIdx++) {
    const row = worksheet.getRow(rowIdx);
    row.height = 24;

    // Columna A: codigo_expediente
    const cellA = row.getCell(1);
    cellA.alignment = { vertical: 'middle', horizontal: 'center' };

    // Columna B: identificacion
    const cellB = row.getCell(2);
    cellB.alignment = { vertical: 'middle', horizontal: 'center' };

    // Columna C: nombre_completo
    const cellC = row.getCell(3);
    cellC.alignment = { vertical: 'middle', horizontal: 'left' };

    // Columna D: calificacion_cuantitativa (Validación decimal 0 - 100)
    const cellD = row.getCell(4);
    cellD.alignment = { vertical: 'middle', horizontal: 'center' };
    cellD.numFmt = '0.00';
    cellD.dataValidation = {
      type: 'decimal',
      operator: 'between',
      allowBlank: true,
      formulae: [0, 100],
      showErrorMessage: true,
      errorTitle: 'Calificación Inválida',
      error: 'La calificación cuantitativa debe ser un valor numérico entre 0.00 y 100.00.',
    };

    // Columna E: valoracion_cualitativa (Dropdown con ENUM SNEPA)
    const cellE = row.getCell(5);
    cellE.alignment = { vertical: 'middle', horizontal: 'center' };
    cellE.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"APRENDIZAJE_AVANZADO,APRENDIZAJE_SATISFACTORIO,APRENDIZAJE_FUNDAMENTAL,APRENDIZAJE_INICIAL"'],
      showErrorMessage: true,
      errorTitle: 'Escala SNEPA Inválida',
      error: 'Seleccione una escala válida: APRENDIZAJE_AVANZADO, APRENDIZAJE_SATISFACTORIO, APRENDIZAJE_FUNDAMENTAL o APRENDIZAJE_INICIAL.',
    };

    // Columna F: autoevaluacion_completada (Dropdown SI / NO)
    const cellF = row.getCell(6);
    cellF.alignment = { vertical: 'middle', horizontal: 'center' };
    cellF.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"SI,NO"'],
      showErrorMessage: true,
      errorTitle: 'Valor Booleano Inválido',
      error: 'Seleccione SI o NO.',
    };

    // Columna G: coevaluacion_completada (Dropdown SI / NO)
    const cellG = row.getCell(7);
    cellG.alignment = { vertical: 'middle', horizontal: 'center' };
    cellG.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"SI,NO"'],
      showErrorMessage: true,
      errorTitle: 'Valor Booleano Inválido',
      error: 'Seleccione SI o NO.',
    };

    // Columna H: observacion_acompanamiento_pedagogico
    const cellH = row.getCell(8);
    cellH.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Bordes para filas con datos de ejemplo (2 a 4)
    if (rowIdx <= 4) {
      for (let colIdx = 1; colIdx <= 8; colIdx++) {
        row.getCell(colIdx).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    }
  }

  // Guardar archivo Excel
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Plantilla generada con éxito en: ${outputPath}`);
}

// Ejecutar script
generateSnepaTemplate()
  .then(() => {
    console.log('🎉 Generación de plantilla completada.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error al generar plantilla Excel SNEPA:', err);
    process.exit(1);
  });
