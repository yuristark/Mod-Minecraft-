import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config.js';
import { badRequest } from './errors.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

sharp.cache(false);
sharp.concurrency(2);

/**
 * Upload em memória com limites rígidos. O mimetype enviado pelo navegador é
 * apenas um primeiro filtro — o conteúdo real é verificado pelo sharp.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 10, fields: 5, parts: 15 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(badRequest('Formato não permitido. Use JPG, PNG ou WebP.'));
    cb(null, true);
  },
});

export async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

/**
 * Decodifica e re-codifica a imagem:
 *  - rejeita qualquer coisa que não seja realmente JPG/PNG/WebP (inclusive SVG, que pode conter script);
 *  - limita pixels (proteção contra "decompression bomb");
 *  - remove metadados EXIF/GPS (privacidade de quem fotografou a obra);
 *  - gera nome aleatório — o nome original nunca é usado no disco.
 */
export async function processImage(buffer) {
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 50_000_000, failOn: 'error' }).metadata();
  } catch {
    throw badRequest('Arquivo de imagem inválido ou corrompido.');
  }
  if (!ALLOWED_FORMATS.has(meta.format)) throw badRequest('Formato não permitido. Use JPG, PNG ou WebP.');

  const id = crypto.randomUUID();
  const filename = `${id}.webp`;
  const thumb = `${id}-sm.webp`;
  const pipeline = sharp(buffer, { limitInputPixels: 50_000_000, failOn: 'error' }).rotate();

  const large = await pipeline.clone()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const small = await pipeline.clone()
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 74 })
    .toBuffer();

  await fs.writeFile(path.join(config.uploadDir, filename), large.data, { flag: 'wx', mode: 0o644 });
  await fs.writeFile(path.join(config.uploadDir, thumb), small, { flag: 'wx', mode: 0o644 });
  return { filename, width: large.info.width, height: large.info.height };
}

export async function deleteImageFiles(filename) {
  // path.basename impede path traversal mesmo se o banco fosse adulterado
  const safe = path.basename(String(filename));
  if (!/^[a-f0-9-]{36}\.webp$/.test(safe)) return;
  const thumb = safe.replace(/\.webp$/, '-sm.webp');
  await Promise.allSettled([
    fs.unlink(path.join(config.uploadDir, safe)),
    fs.unlink(path.join(config.uploadDir, thumb)),
  ]);
}

export function imageUrls(filename) {
  return { url: `/uploads/${filename}`, thumbUrl: `/uploads/${filename.replace(/\.webp$/, '-sm.webp')}` };
}
