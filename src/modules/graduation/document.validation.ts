import path from 'node:path';
import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { AppError } from '../../middlewares/error.middleware';

export interface InstitutionalPdf { bytes: Buffer; sha256: string }

/** Read the exact bytes that will be hashed and served; never reopen a checked path for download. */
export async function readInstitutionalPdf(storedUrl: string): Promise<InstitutionalPdf> {
  try {
    if (!/^\/uploads\/documentos\/[^/]+\.pdf$/i.test(storedUrl)) throw new Error('Invalid path');
    const root = await realpath(path.resolve(process.cwd(), 'uploads/documentos'));
    const actual = await realpath(path.resolve(process.cwd(), `.${storedUrl}`));
    if (!actual.startsWith(`${root}${path.sep}`)) throw new Error('Invalid path');
    const file = await open(actual, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size < 5 || stat.size > 20 * 1024 * 1024) throw new Error('Invalid PDF size');
      const bytes = await file.readFile();
      if (!/^%PDF-[12]\.\d/.test(bytes.subarray(0, 9).toString('ascii'))) throw new Error('Invalid PDF');
      // Check the terminal cross-reference marker as well as the signature; a header-only text file is not a PDF.
      // Both classic xref tables and PDF 1.5+ cross-reference stream objects are accepted.
      const footer = bytes.subarray(Math.max(0, bytes.length - 2048)).toString('latin1');
      const terminal = footer.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
      if (!terminal) throw new Error('Invalid PDF trailer');
      const offset = Number(terminal[1]);
      if (!Number.isSafeInteger(offset) || offset <= 0 || offset >= bytes.length) throw new Error('Invalid PDF cross reference');
      const reference = bytes.subarray(offset, Math.min(offset + 100, bytes.length)).toString('latin1');
      if (!/^xref\b/.test(reference) && !/^\d+\s+\d+\s+obj\b/.test(reference)) throw new Error('Invalid PDF cross reference');
      return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
    } finally { await file.close(); }
  } catch {
    throw new AppError('La emisión requiere un archivo PDF institucional existente cargado en documentos', 400);
  }
}

/** Validate an already supplied institutional PDF; no layout or digital signature is fabricated. */
export async function requireInstitutionalPdf(storedUrl: string): Promise<void> {
  await readInstitutionalPdf(storedUrl);
}
