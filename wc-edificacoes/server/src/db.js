import pg from 'pg';
import { config } from './config.js';
import { logger } from './lib/logger.js';

// NUMERIC e BIGINT chegam como string por padrão; convertemos de forma explícita.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number.parseFloat(v))); // numeric
pg.types.setTypeParser(20, (v) => (v === null ? null : Number.parseInt(v, 10))); // int8 (count)

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000, // nenhuma consulta trava a API por mais de 10s
  application_name: 'wc-edificacoes-api',
});

pool.on('error', (err) => logger.error({ err }, 'Erro inesperado no pool do PostgreSQL'));

/**
 * Sempre use parâmetros ($1, $2...) — nunca concatene valores do usuário no SQL.
 */
export function query(text, params = []) {
  return pool.query(text, params);
}

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
