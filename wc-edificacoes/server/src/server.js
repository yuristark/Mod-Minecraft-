import { createApp } from './app.js';
import { config } from './config.js';
import { pool, query } from './db.js';
import { logger } from './lib/logger.js';
import { ensureUploadDir } from './lib/uploads.js';
import { migrate } from './scripts/migrate.js';

await ensureUploadDir();
await migrate({ silent: true });

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info(`WC Edificações rodando em http://localhost:${config.port} (${config.env})`);
});

// Proteção contra conexões lentas (slowloris)
server.headersTimeout = 20_000;
server.requestTimeout = 60_000;
server.keepAliveTimeout = 5_000;

// Limpeza periódica de sessões expiradas
const cleanup = setInterval(() => {
  query('DELETE FROM sessions WHERE expires_at < now()').catch((err) => logger.warn({ err }, 'falha na limpeza de sessões'));
}, 60 * 60 * 1000);
cleanup.unref();

function shutdown(signal) {
  logger.info(`${signal} recebido, encerrando...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
