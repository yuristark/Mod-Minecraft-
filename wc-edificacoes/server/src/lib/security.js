import crypto from 'node:crypto';
import { config } from '../config.js';

/** Token aleatório criptograficamente seguro (hex). 32 bytes = 256 bits. */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * IP é dado pessoal (LGPD). Guardamos apenas um HMAC, suficiente para
 * auditoria/antifraude sem armazenar o IP em si.
 */
export function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHmac('sha256', config.ipHashSecret).update(String(ip)).digest('hex');
}

/** Comparação em tempo constante para evitar ataques de temporização. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const PROTOCOL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
export function makeProtocol(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (const b of bytes) suffix += PROTOCOL_ALPHABET[b % PROTOCOL_ALPHABET.length];
  return `WC${yy}${mm}-${suffix}`;
}

/** Escapa curingas do LIKE/ILIKE para que a busca do usuário seja tratada como texto literal. */
export function escapeLike(value) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Remove caracteres de controle (exceto quebras de linha e tab) de textos livres. */
export function stripControl(value) {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
}

export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
