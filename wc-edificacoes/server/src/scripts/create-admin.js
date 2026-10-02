/**
 * Cria (ou redefine a senha de) um administrador.
 *   npm run create-admin
 * A senha é digitada no terminal e nunca fica salva em arquivo ou histórico.
 */
import readline from 'node:readline';
import argon2 from 'argon2';
import { z } from 'zod';
import { pool } from '../db.js';
import { migrate } from './migrate.js';
import { ARGON_OPTS } from '../routes/auth.js';
import { passwordPolicy } from '../schemas.js';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

async function main() {
  await migrate({ silent: true });
  const name = (process.env.ADMIN_NAME || (await ask('Nome: '))).trim();
  const email = (process.env.ADMIN_EMAIL || (await ask('E-mail: '))).trim().toLowerCase();
  if (!z.email().safeParse(email).success) throw new Error('E-mail inválido');
  if (name.length < 2) throw new Error('Nome inválido');

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask('Senha (mín. 12 caracteres, letras e números): ', { hidden: true });
    const again = await ask('Repita a senha: ', { hidden: true });
    if (password !== again) throw new Error('As senhas não conferem');
  }
  const check = passwordPolicy.safeParse(password);
  if (!check.success) throw new Error(check.error.issues[0].message);

  const hash = await argon2.hash(password, ARGON_OPTS);
  await pool.query(
    `INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
       failed_attempts = 0, locked_until = NULL, password_changed_at = now()`,
    [name, email, hash],
  );
  await pool.query('DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = $1)', [email]);
  console.log(`✔ Administrador ${email} pronto.`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => { console.error('✖', err.message); await pool.end(); process.exit(1); });
