import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import { badRequest, notFound } from '../lib/errors.js';
import { computeEstimate } from '../lib/estimate.js';
import { hashIp, makeProtocol } from '../lib/security.js';
import { imageUrls } from '../lib/uploads.js';
import { logger } from '../lib/logger.js';
import { notifyNewQuote } from '../lib/mailer.js';
import { quoteLimiter } from '../middleware/rateLimits.js';
import { projectListQuery, quoteCreate, slugParam } from '../schemas.js';

export const publicRouter = Router();

export function mapProject(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    status: row.status,
    city: row.city,
    areaM2: row.area_m2,
    year: row.year,
    durationMonths: row.duration_months,
    summary: row.summary,
    description: row.description,
    featured: row.featured,
    published: row.published,
    cover: row.cover_filename
      ? { ...imageUrls(row.cover_filename), width: row.cover_width, height: row.cover_height, alt: row.cover_alt || row.title }
      : null,
    imageCount: row.image_count ?? undefined,
    updatedAt: row.updated_at,
  };
}

export function mapImage(img) {
  return { id: img.id, ...imageUrls(img.filename), width: img.width, height: img.height, alt: img.alt, position: img.position };
}

export const PROJECT_SELECT = `
  SELECT p.*, c.filename AS cover_filename, c.width AS cover_width, c.height AS cover_height, c.alt AS cover_alt,
         (SELECT count(*) FROM project_images i WHERE i.project_id = p.id) AS image_count
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT filename, width, height, alt FROM project_images
       WHERE project_id = p.id ORDER BY position, id LIMIT 1
    ) c ON true`;

export async function getSimulatorSettings() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'simulator'");
  return rows[0]?.value ?? null;
}

publicRouter.get('/health', async (_req, res) => {
  await query('SELECT 1');
  res.json({ ok: true });
});

publicRouter.get('/projects', async (req, res) => {
  const q = projectListQuery.parse(req.query);
  const where = ['p.published = true'];
  const params = [];
  if (q.category) { params.push(q.category); where.push(`p.category = $${params.length}`); }
  if (q.status) { params.push(q.status); where.push(`p.status = $${params.length}`); }
  if (q.featured) where.push('p.featured = true');
  const whereSql = where.join(' AND ');

  const countRes = await query(`SELECT count(*) AS total FROM projects p WHERE ${whereSql}`, params);
  params.push(q.limit, (q.page - 1) * q.limit);
  const { rows } = await query(
    `${PROJECT_SELECT} WHERE ${whereSql}
      ORDER BY p.featured DESC, COALESCE(p.year, 0) DESC, p.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ items: rows.map(mapProject), total: countRes.rows[0].total, page: q.page, limit: q.limit });
});

publicRouter.get('/projects/:slug', async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  const { rows } = await query(`${PROJECT_SELECT} WHERE p.slug = $1 AND p.published = true`, [slug]);
  if (!rows[0]) throw notFound('Obra não encontrada');
  const images = await query(
    'SELECT id, filename, width, height, alt, position FROM project_images WHERE project_id = $1 ORDER BY position, id',
    [rows[0].id],
  );
  res.json({ ...mapProject(rows[0]), images: images.rows.map(mapImage) });
});

publicRouter.get('/simulator', async (_req, res) => {
  const settings = await getSimulatorSettings();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(settings);
});

async function verifyTurnstile(token, ip) {
  if (!config.turnstileSecret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: config.turnstileSecret, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    return data.success === true;
  } catch (err) {
    logger.warn({ err }, 'falha ao validar Turnstile');
    return false;
  }
}

publicRouter.post('/quotes', quoteLimiter, async (req, res) => {
  const data = quoteCreate.parse(req.body);

  // Honeypot preenchido ou envio rápido demais → provavelmente robô.
  // Respondemos "sucesso" sem salvar, para não ensinar o robô a contornar.
  const elapsed = Date.now() - data.startedAt;
  if ((data.website && data.website.trim() !== '') || elapsed < 3000 || elapsed > 6 * 3600 * 1000) {
    logger.info({ reqId: req.id }, 'orçamento descartado pelo anti-spam');
    return res.status(201).json({ protocol: makeProtocol() });
  }
  if (!(await verifyTurnstile(data.turnstileToken, req.ip))) {
    throw badRequest('Não foi possível confirmar que você não é um robô. Tente novamente.');
  }

  const settings = await getSimulatorSettings();
  const estimate = computeEstimate(settings, data);
  const protocol = makeProtocol();

  await query(
    `INSERT INTO quotes (protocol, name, email, phone, city, project_type, standard, area_m2, has_land, has_project,
                         start_window, estimate_min, estimate_max, message, consent_at, ip_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now(), $15)`,
    [protocol, data.name, data.email, data.phone, data.city, data.projectType, data.standard, data.areaM2,
      data.hasLand, data.hasProject, data.startWindow, estimate?.min ?? null, estimate?.max ?? null,
      data.message, hashIp(req.ip)],
  );
  res.status(201).json({ protocol });
  // Depois de responder: o visitante não espera o e-mail, e uma falha de envio não perde o pedido
  void notifyNewQuote({ ...data, protocol, estimateMin: estimate?.min ?? null, estimateMax: estimate?.max ?? null });
});
