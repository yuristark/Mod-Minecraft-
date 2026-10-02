import { Router } from 'express';
import argon2 from 'argon2';
import { query } from '../db.js';
import { config } from '../config.js';
import { audit } from '../lib/audit.js';
import { badRequest, tooMany, unauthorized } from '../lib/errors.js';
import { createSession, destroySession, requireAuth, requireCsrf } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimits.js';
import { changePasswordBody, loginBody } from '../schemas.js';

export const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

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
    await argon2.verify(await dummyHashPromise, password).catch(() => false);
    throw unauthorized(INVALID);
  }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    await argon2.verify(await dummyHashPromise, password).catch(() => false);
    throw tooMany();
  }

  const ok = await argon2.verify(admin.password_hash, password).catch(() => false);
  if (!ok) {
    const attempts = admin.failed_attempts + 1;
    const lock = attempts >= config.maxLoginAttempts;
    await query(
      `UPDATE admins SET failed_attempts = $2,
              locked_until = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE locked_until END
        WHERE id = $1`,
      [admin.id, lock ? 0 : attempts, lock, String(config.lockMinutes)],
    );
    req.admin = { id: admin.id };
    await audit(req, lock ? 'login.locked' : 'login.failed', 'admin', admin.id);
    throw lock ? tooMany() : unauthorized(INVALID);
  }

  if (argon2.needsRehash(admin.password_hash, ARGON_OPTS)) {
    const newHash = await argon2.hash(password, ARGON_OPTS);
    await query('UPDATE admins SET password_hash = $2 WHERE id = $1', [admin.id, newHash]);
  }

  await query('UPDATE admins SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [admin.id]);

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
  const ok = rows[0] && (await argon2.verify(rows[0].password_hash, currentPassword).catch(() => false));
  if (!ok) throw badRequest('Senha atual incorreta.', { currentPassword: 'Senha atual incorreta' });
  if (newPassword.toLowerCase().includes(rows[0].email.split('@')[0].toLowerCase())) {
    throw badRequest('A nova senha não pode conter seu e-mail.', { newPassword: 'Não use seu e-mail na senha' });
  }
  if (newPassword === currentPassword) {
    throw badRequest('A nova senha precisa ser diferente da atual.', { newPassword: 'Escolha uma senha diferente' });
  }
  const hash = await argon2.hash(newPassword, ARGON_OPTS);
  await query('UPDATE admins SET password_hash = $2, password_changed_at = now() WHERE id = $1', [req.admin.id, hash]);
  // Encerra todas as outras sessões (ex.: um dispositivo esquecido logado)
  await query('DELETE FROM sessions WHERE admin_id = $1 AND token_hash <> $2', [req.admin.id, req.session.tokenHash]);
  await audit(req, 'password.changed', 'admin', req.admin.id);
  res.status(204).end();
});
