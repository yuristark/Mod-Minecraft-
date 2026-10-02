import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value.trim();
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} precisa ser um número inteiro`);
  return n;
}

const env = process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'test' ? 'test' : 'development';
const isProd = env === 'production';

const ipHashSecret = required('IP_HASH_SECRET');
if (isProd && ipHashSecret.length < 32) {
  throw new Error('IP_HASH_SECRET precisa ter pelo menos 32 caracteres em produção');
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (isProd && allowedOrigins.some((o) => !o.startsWith('https://'))) {
  throw new Error('Em produção, ALLOWED_ORIGINS deve conter apenas origens https://');
}

const reportTimezone = process.env.REPORT_TIMEZONE || 'America/Sao_Paulo';
try { new Intl.DateTimeFormat('pt-BR', { timeZone: reportTimezone }); } catch { throw new Error('REPORT_TIMEZONE inválido'); }

const siteUrl = (process.env.SITE_URL || allowedOrigins[0] || '').trim().replace(/\/$/, '');
if (isProd && !siteUrl.startsWith('https://')) {
  throw new Error('Em produção, SITE_URL (ou o primeiro item de ALLOWED_ORIGINS) deve começar com https://');
}

const smtpPort = int('SMTP_PORT', 587);

export const config = Object.freeze({
  env,
  isProd,
  port: int('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  databaseSsl: process.env.DATABASE_SSL === 'true',
  // Número de proxies reversos à frente da app (Nginx, Cloudflare, Render...). 0 = acesso direto.
  trustProxy: int('TRUST_PROXY', 0),
  allowedOrigins,
  ipHashSecret,
  sessionTtlHours: int('SESSION_TTL_HOURS', 8),
  sessionIdleMinutes: int('SESSION_IDLE_MINUTES', 60),
  maxLoginAttempts: int('MAX_LOGIN_ATTEMPTS', 5),
  lockMinutes: int('LOCK_MINUTES', 15),
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  maxUploadMb: int('MAX_UPLOAD_MB', 8),
  clientDist: path.resolve(__dirname, '..', process.env.CLIENT_DIST || '../client/dist'),
  turnstileSecret: process.env.TURNSTILE_SECRET?.trim() || '',
  // Fuso usado em relatórios do painel (gráfico por dia, datas do CSV)
  reportTimezone,
  logLevel: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  // Endereço público do site (sitemap.xml, robots.txt, links nos e-mails)
  siteUrl,
  // Aviso por e-mail a cada novo pedido de orçamento (opcional — só ativa com SMTP_HOST e NOTIFY_EMAIL)
  mail: {
    host: process.env.SMTP_HOST?.trim() || '',
    port: smtpPort,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM?.trim() || '',
    notifyTo: (process.env.NOTIFY_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean),
  },
});
