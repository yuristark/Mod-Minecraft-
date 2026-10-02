import { config } from '../config.js';
import { query } from '../db.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { randomToken, safeEqual, sha256, hashIp } from '../lib/security.js';

// Em produção (HTTPS) usamos o prefixo __Host-: o navegador só aceita o cookie
// se for Secure, sem Domain e com Path=/ — impede que subdomínios o sobrescrevam.
export const SESSION_COOKIE = config.isProd ? '__Host-wc_sid' : 'wc_sid';

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true, // inacessível ao JavaScript → token não vaza por XSS
    secure: config.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export async function createSession(res, req, adminId) {
  const token = randomToken(32);
  const csrf = randomToken(32);
  const ttlMs = config.sessionTtlHours * 3600 * 1000;
  await query(
    `INSERT INTO sessions (token_hash, admin_id, csrf_token, ip_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' milliseconds')::interval)`,
    [sha256(token), adminId, csrf, hashIp(req.ip), (req.get('user-agent') || '').slice(0, 300), String(ttlMs)],
  );
  // Limita a 5 sessões simultâneas por administrador
  await query(
    `DELETE FROM sessions WHERE admin_id = $1 AND token_hash NOT IN (
       SELECT token_hash FROM sessions WHERE admin_id = $1 ORDER BY created_at DESC LIMIT 5)`,
    [adminId],
  );
  res.cookie(SESSION_COOKIE, token, cookieOptions(ttlMs));
  return csrf;
}

export async function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

/** Carrega a sessão (se existir) e anexa req.admin / req.session. */
export async function loadSession(req, _res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return next();
    const { rows } = await query(
      `SELECT s.token_hash, s.csrf_token, s.last_seen_at, s.expires_at,
              a.id, a.name, a.email
         FROM sessions s JOIN admins a ON a.id = s.admin_id
        WHERE s.token_hash = $1
          AND s.expires_at > now()
          AND s.last_seen_at > now() - ($2 || ' minutes')::interval`,
      [sha256(token), String(config.sessionIdleMinutes)],
    );
    const row = rows[0];
    if (!row) return next();
    req.session = { tokenHash: row.token_hash, csrf: row.csrf_token };
    req.admin = { id: row.id, name: row.name, email: row.email };
    // Renova o "último acesso" no máximo 1x por minuto
    if (Date.now() - new Date(row.last_seen_at).getTime() > 60_000) {
      await query('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [row.token_hash]);
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.admin) return next(unauthorized('Sessão expirada. Entre novamente.'));
  next();
}

/** Defesa contra CSRF (camada 2): token sincronizado por sessão no cabeçalho X-CSRF-Token. */
export function requireCsrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('x-csrf-token');
  if (!req.session || !safeEqual(sent || '', req.session.csrf)) {
    return next(forbidden('Token de segurança inválido. Recarregue a página.'));
  }
  next();
}
