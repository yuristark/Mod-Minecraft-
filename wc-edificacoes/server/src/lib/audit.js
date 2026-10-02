import { query } from '../db.js';
import { hashIp } from './security.js';
import { logger } from './logger.js';

/** Registra ações administrativas sensíveis. Falha no log nunca derruba a requisição. */
export async function audit(req, action, entity = null, entityId = null) {
  try {
    await query(
      'INSERT INTO audit_log (admin_id, action, entity, entity_id, ip_hash) VALUES ($1, $2, $3, $4, $5)',
      [req.admin?.id ?? null, action, entity, entityId === null ? null : String(entityId), hashIp(req.ip)],
    );
  } catch (err) {
    logger.warn({ err }, 'falha ao gravar audit_log');
  }
}
