import { randomUUID } from 'node:crypto';
import { DbClient, withTransaction } from '../../db/pool';
import { AuthUserPayload } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { InstitutionalPdf, readInstitutionalPdf } from '../graduation/document.validation';
import { CertificatesDao, CertificateRecord, CertificateSource } from './certificates.dao';
import { revokeCertificateSchema } from './certificates.schema';

export const certificateAdministrativePermissions = ['TITULO_EMITIR', 'CERTIFICADO_REVOCAR'];

export class CertificatesService {
  static isAdministrator(actor: AuthUserPayload): boolean {
    return actor.rol === 'SUPER_ADMIN' || certificateAdministrativePermissions.some(code => actor.permisos.includes(code));
  }
  private static requirePermission(actor: AuthUserPayload, permission?: string): void {
    const allowed = permission ? actor.rol === 'SUPER_ADMIN' || actor.permisos.includes(permission) : this.isAdministrator(actor);
    if (!allowed) throw new AppError('Certificate operation is not authorized', 403);
  }
  private static async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (['42P01', '42703', '3F000', '42883'].includes(code || '')) {
        throw new AppError('Certificate registry is unavailable; apply the certificate registry migration', 503);
      }
      if (code === '23505') throw new AppError('The dossier already has a registered certificate', 409);
      throw error;
    }
  }
  static publicView(record: CertificateRecord) {
    return {
      token_publico: record.token_publico, estado: record.estado,
      titular_nombre: record.titular_nombre, programa_nombre: record.programa_nombre,
      cohorte_codigo: record.cohorte_codigo, tipo_documento: record.tipo_documento,
      fecha_emision: record.fecha_emision, fecha_revocacion: record.fecha_revocacion,
    };
  }
  private static view(record: CertificateRecord, available: boolean) {
    return { id: record.id, ...this.publicView(record), puede_descargar: record.estado === 'VIGENTE' && available, expediente_id: record.expediente_id };
  }
  private static async checkedPdf(record: CertificateRecord): Promise<InstitutionalPdf> {
    if (record.estado !== 'VIGENTE') throw new AppError('This certificate has been revoked', 409);
    try {
      const pdf = await readInstitutionalPdf(record.documento_url);
      if (pdf.sha256 !== record.documento_sha256) throw new Error('Integrity mismatch');
      return pdf;
    } catch {
      throw new AppError('Certificate document is missing or its integrity could not be verified', 409);
    }
  }
  private static async downloadable(record: CertificateRecord): Promise<boolean> {
    try { await this.checkedPdf(record); return true; } catch { return false; }
  }
  static async verify(token: string) {
    return this.guarded(async () => {
      await CertificatesDao.requireAvailable();
      const record = await CertificatesDao.byToken(token);
      if (!record) throw new AppError('Certificate not found', 404);
      // Revoked records report their immutable identity and state, never a valid integrity assertion.
      if (record.estado === 'VIGENTE') await this.checkedPdf(record);
      return { ...this.publicView(record), integridad_verificada: record.estado === 'VIGENTE' };
    });
  }
  static async list(actor: AuthUserPayload, options: { page: number; limit: number; search?: string; estado?: string }, own: boolean) {
    if (!own) this.requirePermission(actor);
    return this.guarded(async () => {
      await CertificatesDao.requireAvailable();
      const result = await CertificatesDao.list({ ...options, ...(own ? { ownerId: actor.id } : {}) });
      const data = [];
      for (const record of result.records) data.push(this.view(record, await this.downloadable(record)));
      return { data, total: result.total, pagination: { total: result.total, page: options.page, limit: options.limit, totalPages: Math.ceil(result.total / options.limit) } };
    });
  }
  static async download(id: string, actor: AuthUserPayload): Promise<{ bytes: Buffer; filename: string }> {
    return this.guarded(async () => {
      await CertificatesDao.requireAvailable();
      const record = await CertificatesDao.byId(id);
      if (!record || (record.titular_usuario_id !== actor.id && !this.isAdministrator(actor))) throw new AppError('Certificate not found', 404);
      const pdf = await this.checkedPdf(record);
      return { bytes: pdf.bytes, filename: `certificate-${record.id}.pdf` };
    });
  }
  static async events(id: string, actor: AuthUserPayload) {
    this.requirePermission(actor);
    return this.guarded(async () => {
      await CertificatesDao.requireAvailable();
      if (!await CertificatesDao.byId(id)) throw new AppError('Certificate not found', 404);
      return CertificatesDao.events(id);
    });
  }
  /** Called only inside the graduation transaction after all existing academic gates succeed. */
  static async recordIssuedDocument(source: CertificateSource, actorId: string, db: DbClient, pdf: InstitutionalPdf): Promise<CertificateRecord> {
    return this.guarded(() => this.record(source, actorId, 'EMITIDO', db, pdf));
  }
  private static async record(source: CertificateSource, actorId: string, action: 'EMITIDO' | 'REGISTRADO', db: DbClient, pdf: InstitutionalPdf): Promise<CertificateRecord> {
    if (!source.fecha_emision || !source.documento_final_url || !source.codigo_registro_titulo_emitido) {
      throw new AppError('Only an already issued institutional document can be registered', 409);
    }
    const record = await CertificatesDao.create({
      expediente_id: source.id, token_publico: randomUUID(), titular_usuario_id: source.aspirante_usuario_id,
      titular_nombre: `${source.aspirante_nombres} ${source.aspirante_apellidos}`.trim(),
      programa_nombre: source.programa_nombre, cohorte_codigo: source.codigo_cohorte,
      tipo_documento: source.tipo_documento_final, fecha_emision: source.fecha_emision,
      documento_url: source.documento_final_url, documento_sha256: pdf.sha256, registrado_por_usuario_id: actorId,
    }, db);
    await CertificatesDao.addEvent(record.id, action, actorId, null, db);
    return record;
  }
  static async register(expedienteId: string, actor: AuthUserPayload) {
    this.requirePermission(actor, 'TITULO_EMITIR');
    return this.guarded(() => withTransaction(async client => {
      await CertificatesDao.requireAvailable(client);
      const source = await CertificatesDao.sourceForRegistration(expedienteId, client);
      if (!source) throw new AppError('Graduation dossier not found', 404);
      if (await CertificatesDao.byExpediente(expedienteId, client)) throw new AppError('The dossier already has a registered certificate', 409);
      if (!source.fecha_emision || !source.codigo_registro_titulo_emitido || !source.documento_final_url) throw new AppError('The dossier has no issued institutional document', 409);
      const pdf = await readInstitutionalPdf(source.documento_final_url);
      return this.view(await this.record(source, actor.id, 'REGISTRADO', client, pdf), true);
    }));
  }
  static async revoke(id: string, actor: AuthUserPayload, reason: string) {
    this.requirePermission(actor, 'CERTIFICADO_REVOCAR');
    const { motivo } = revokeCertificateSchema.parse({ motivo: reason });
    return this.guarded(() => withTransaction(async client => {
      await CertificatesDao.requireAvailable(client);
      const record = await CertificatesDao.revoke(id, actor.id, motivo, client);
      if (!record) {
        if (!await CertificatesDao.byId(id, client)) throw new AppError('Certificate not found', 404);
        throw new AppError('Certificate has already been revoked', 409);
      }
      await CertificatesDao.addEvent(id, 'REVOCADO', actor.id, motivo, client);
      return this.view(record, false);
    }));
  }
  /** Legacy reads remain available before this optional migration; no digital assurance is fabricated. */
  static async optionalForExpediente(expedienteId: string): Promise<{ available: boolean; record: CertificateRecord | null }> {
    try {
      if (!await CertificatesDao.available()) return { available: false, record: null };
      return { available: true, record: await CertificatesDao.byExpediente(expedienteId) };
    } catch (error) {
      if (['42P01', '42703'].includes((error as { code?: string }).code || '')) return { available: false, record: null };
      throw error;
    }
  }
  /** Call after existing ownership/resource permission proof; this method never grants access. */
  static async assertStoredDocumentDownloadAllowed(storedUrl: string, _actor: AuthUserPayload): Promise<void> {
    await this.guarded(async () => {
      if (!await CertificatesDao.available()) return;
      const records = await CertificatesDao.byDocumentPath(storedUrl);
      for (const record of records) await this.checkedPdf(record);
    });
  }
  static async legacyVerification(expedienteId: string) {
    const registry = await this.optionalForExpediente(expedienteId);
    if (!registry.record) return { registro_digital_disponible: registry.available, autenticidad_verificada: false, integridad_verificada: false, estado_certificado: null, certificado_digital_id: null };
    const record = registry.record;
    if (record.estado === 'VIGENTE') await this.checkedPdf(record);
    return { registro_digital_disponible: true, autenticidad_verificada: record.estado === 'VIGENTE', integridad_verificada: record.estado === 'VIGENTE', estado_certificado: record.estado, token_publico: record.token_publico, snapshot: this.publicView(record) };
  }
}
