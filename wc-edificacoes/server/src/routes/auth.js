import { Router } from 'express';
import argon2 from 'argon2';
import { query } from '../db.js';
import { config } from '../config.js';
import { audit } from '../lib/audit.js';
import { badRequest, tooMany, unauthorized } from '../lib/errors.js';
import { createLimiter } from '../lib/limiter.js';
import { createSession, destroySession, requireAuth, requireCsrf } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimits.js';
import { changePasswordBody, loginBody } from '../schemas.js';

export const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// No máximo 4 hashes Argon2 simultâneos (≈ 80 MB de RAM) e 40 na fila; acima disso, 503.
const argonSlot = createLimiter(4, 40);
const verifyPassword = (hash, password) => argonSlot(() => argon2.verify(hash, password).catch(() => false));
const hashPassword = (password) => argonSlot(() => argon2.hash(password, ARGON_OPTS));

// Hash "falso" para que e-mails inexistentes levem o mesmo tempo para responder
// (evita enumeração de usuários por tempo de resposta).
const dummyHashPromise = argon2.hash('senha-inexistente-para-tempo-constante', ARGON_OPTS);

export const authRouter = Router();
const INVALID = 'E-mail ou senha incorretos.';

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  const { rows } = await query(
    'SELECT id, name, email, password_hash, failed_attempts, locked_until FROM admins WHERE email = $1',
    [email],
  );
  const admin = rows[0];

  if (!admin) {
    await verifyPassword(await dummyHashPromise, password);
    throw unauthorized(INVALID);
  }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    await verifyPassword(await dummyHashPromise, password);
    throw tooMany();
  }

  const ok = await verifyPassword(admin.password_hash, password);
  if (!ok) {
    // Incremento atômico: tentativas simultâneas não "pulam" o contador (corrida de leitura/escrita)
    const { rows: upd } = await query(
      `UPDATE admins
          SET failed_attempts = CASE WHEN failed_attempts + 1 >= $2 THEN 0 ELSE failed_attempts + 1 END,
              locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
        WHERE id = $1
        RETURNING locked_until IS NOT NULL AND locked_until > now() AS locked`,
      [admin.id, config.maxLoginAttempts, String(config.lockMinutes)],
    );
    const lock = Boolean(upd[0]?.locked);
    req.admin = { id: admin.id };
    await audit(req, lock ? 'login.locked' : 'login.failed', 'admin', admin.id);
    throw lock ? tooMany() : unauthorized(INVALID);
  }

  // Confirma que a conta não foi bloqueada por outra tentativa durante a verificação da senha
  const { rows: okRows } = await query(
    `UPDATE admins SET failed_attempts = 0, locked_until = NULL, last_login_at = now()
      WHERE id = $1 AND (locked_until IS NULL OR locked_until <= now())
      RETURNING id`,
    [admin.id],
  );
  if (!okRows[0]) throw tooMany();

  if (argon2.needsRehash(admin.password_hash, ARGON_OPTS)) {
    const newHash = await hashPassword(password);
    await query('UPDATE admins SET password_hash = $2 WHERE id = $1', [admin.id, newHash]);
  }

  // Rotação de sessão: descarta qualquer sessão anterior trazida no cookie (anti session fixation)
  if (req.session) await query('DELETE FROM sessions WHERE token_hash = $1', [req.session.tokenHash]);
  const csrfToken = await createSession(res, req, admin.id);
  req.admin = { id: admin.id };
  await audit(req, 'login.success', 'admin', admin.id);
  res.json({ admin: { id: admin.id, name: admin.name, email: admin.email }, csrfToken });
});

// Sempre 200: evita erro 401 no console de quem só abre a tela de login
authRouter.get('/me', (req, res) => {
  if (!req.admin) return res.json({ admin: null, csrfToken: null });
  res.json({ admin: req.admin, csrfToken: req.session.csrf });
});

authRouter.post('/logout', requireAuth, requireCsrf, async (req, res) => {
  await audit(req, 'logout', 'admin', req.admin.id);
  await destroySession(req, res);
  res.status(204).end();
});

authRouter.post('/password', requireAuth, requireCsrf, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordBody.parse(req.body);
  const { rows } = await query('SELECT password_hash, email FROM admins WHERE id = $1', [req.admin.id]);
  const ok = rows[0] && (await verifyPassword(rows[0].password_hash, currentPassword));
  if (!ok) throw badRequest('Senha atual incorreta.', { currentPassword: 'Senha atual incorreta' });
  if (newPassword.toLowerCase().includes(rows[0].email.split('@')[0].toLowerCase())) {
    throw badRequest('A nova senha não pode conter seu e-mail.', { newPassword: 'Não use seu e-mail na senha' });
  }
  if (newPassword === currentPassword) {
    throw badRequest('A nova senha precisa ser diferente da atual.', { newPassword: 'Escolha uma senha diferente' });
  }
  const hash = await hashPassword(newPassword);
  await query('UPDATE admins SET password_hash = $2, password_changed_at = now() WHERE id = $1', [req.admin.id, hash]);
  // Encerra todas as outras sessões (ex.: um dispositivo esquecido logado)
  await query('DELETE FROM sessions WHERE admin_id = $1 AND token_hash <> $2', [req.admin.id, req.session.tokenHash]);
  await audit(req, 'password.changed', 'admin', req.admin.id);
  res.status(204).end();
});
