import { Router } from 'express';
import { config } from '../config.js';
import { query, transaction } from '../db.js';
import { audit } from '../lib/audit.js';
import { toCsv } from '../lib/csv.js';
import { badRequest, notFound } from '../lib/errors.js';
import { escapeLike, slugify } from '../lib/security.js';
import { deleteImageFiles, imageUpload, processImage } from '../lib/uploads.js';
import { requireAuth, requireCsrf } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import {
  idParam, imageUpdate, projectBody, quoteListQuery, quoteUpdate, simulatorSettings,
} from '../schemas.js';
import { getSimulatorSettings, mapImage, mapProject, PROJECT_SELECT } from './public.js';
import { clearSitemapCache } from './seo.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireCsrf);

/* ----------------------------- Dashboard ----------------------------- */

adminRouter.get('/stats', async (_req, res) => {
  const [byStatus, last30, projects, recent] = await Promise.all([
    query('SELECT status, count(*) AS n FROM quotes GROUP BY status'),
    query(`SELECT to_char((created_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS day, count(*) AS n
             FROM quotes WHERE created_at > now() - interval '31 days' GROUP BY 1 ORDER BY 1`, [config.reportTimezone]),
    query('SELECT count(*) FILTER (WHERE published) AS published, count(*) AS total FROM projects'),
    query(`SELECT id, protocol, name, city, project_type, status, created_at FROM quotes ORDER BY created_at DESC LIMIT 6`),
  ]);
  const statusCounts = Object.fromEntries(byStatus.rows.map((r) => [r.status, r.n]));
  res.json({
    quotesByStatus: statusCounts,
    quotesTotal: byStatus.rows.reduce((a, r) => a + r.n, 0),
    quotesPerDay: last30.rows,
    projects: projects.rows[0],
    recentQuotes: recent.rows.map(mapQuoteRow),
  });
});

/* ----------------------------- Orçamentos ---------------------------- */

function mapQuoteRow(r) {
  return {
    id: r.id,
    protocol: r.protocol,
    name: r.name,
    email: r.email,
    phone: r.phone,
    city: r.city,
    projectType: r.project_type,
    standard: r.standard,
    areaM2: r.area_m2,
    hasLand: r.has_land,
    hasProject: r.has_project,
    startWindow: r.start_window,
    estimateMin: r.estimate_min,
    estimateMax: r.estimate_max,
    message: r.message,
    status: r.status,
    notes: r.notes,
    consentAt: r.consent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function quoteFilters(q) {
  const where = [];
  const params = [];
  if (q.status) { params.push(q.status); where.push(`status = $${params.length}`); }
  if (q.q) {
    params.push(`%${escapeLike(q.q)}%`);
    const i = params.length;
    where.push(`(name ILIKE $${i} OR email::text ILIKE $${i} OR city ILIKE $${i} OR protocol ILIKE $${i} OR phone LIKE $${i})`);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

adminRouter.get('/quotes', async (req, res) => {
  const q = quoteListQuery.parse(req.query);
  const { whereSql, params } = quoteFilters(q);
  const total = await query(`SELECT count(*) AS n FROM quotes ${whereSql}`, params);
  const { rows } = await query(
    `SELECT * FROM quotes ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, (q.page - 1) * q.limit],
  );
  res.json({ items: rows.map(mapQuoteRow), total: total.rows[0].n, page: q.page, limit: q.limit });
});

adminRouter.get('/quotes/export.csv', async (req, res) => {
  const q = quoteListQuery.parse(req.query);
  const { whereSql, params } = quoteFilters(q);
  const { rows } = await query(`SELECT * FROM quotes ${whereSql} ORDER BY created_at DESC LIMIT 10000`, params);
  const csv = toCsv([
    { label: 'Protocolo', key: 'protocol' },
    { label: 'Data', get: (r) => new Date(r.created_at).toLocaleString('pt-BR', { timeZone: config.reportTimezone }) },
    { label: 'Nome', key: 'name' },
    { label: 'E-mail', key: 'email' },
    { label: 'Telefone', key: 'phone' },
    { label: 'Cidade', key: 'city' },
    { label: 'Tipo', key: 'project_type' },
    { label: 'Padrão', key: 'standard' },
    { label: 'Área (m²)', key: 'area_m2' },
    { label: 'Estimativa mín.', key: 'estimate_min' },
    { label: 'Estimativa máx.', key: 'estimate_max' },
    { label: 'Status', key: 'status' },
    { label: 'Mensagem', key: 'message' },
    { label: 'Notas internas', key: 'notes' },
  ], rows);
  await audit(req, 'quotes.export', 'quote', null);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orcamentos-${stamp}.csv"`);
  res.send(csv);
});

adminRouter.get('/quotes/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { rows } = await query('SELECT * FROM quotes WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Orçamento não encontrado');
  res.json(mapQuoteRow(rows[0]));
});

adminRouter.patch('/quotes/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = quoteUpdate.parse(req.body);
  const { rows } = await query(
    `UPDATE quotes SET status = COALESCE($2, status), notes = COALESCE($3, notes), updated_at = now()
      WHERE id = $1 RETURNING *`,
    [id, data.status ?? null, data.notes ?? null],
  );
  if (!rows[0]) throw notFound('Orçamento não encontrado');
  await audit(req, 'quote.update', 'quote', id);
  res.json(mapQuoteRow(rows[0]));
});

// Exclusão definitiva — atende pedidos de eliminação de dados (LGPD art. 18)
adminRouter.delete('/quotes/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { rowCount } = await query('DELETE FROM quotes WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Orçamento não encontrado');
  await audit(req, 'quote.delete', 'quote', id);
  res.status(204).end();
});

/* ------------------------------- Obras ------------------------------- */

adminRouter.get('/projects', async (_req, res) => {
  const { rows } = await query(`${PROJECT_SELECT} ORDER BY p.updated_at DESC LIMIT 500`);
  res.json({ items: rows.map(mapProject) });
});

adminRouter.get('/projects/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { rows } = await query(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
  if (!rows[0]) throw notFound('Obra não encontrada');
  const images = await query('SELECT * FROM project_images WHERE project_id = $1 ORDER BY position, id', [id]);
  res.json({ ...mapProject(rows[0]), images: images.rows.map(mapImage) });
});

async function uniqueSlug(base, ignoreId = null) {
  const root = base || 'obra';
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { rows } = await query('SELECT id FROM projects WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)', [candidate, ignoreId]);
    if (!rows[0]) return candidate;
  }
  throw badRequest('Não foi possível gerar um endereço único para a obra.');
}

adminRouter.post('/projects', async (req, res) => {
  const d = projectBody.parse(req.body);
  const slug = await uniqueSlug(d.slug || slugify(d.title));
  const { rows } = await query(
    `INSERT INTO projects (slug, title, category, status, city, area_m2, year, duration_months, summary, description, featured, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [slug, d.title, d.category, d.status, d.city, d.areaM2, d.year, d.durationMonths, d.summary, d.description, d.featured, d.published],
  );
  clearSitemapCache();
  await audit(req, 'project.create', 'project', rows[0].id);
  res.status(201).json({ id: rows[0].id, slug });
});

adminRouter.put('/projects/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const d = projectBody.parse(req.body);
  const slug = await uniqueSlug(d.slug || slugify(d.title), id);
  const { rowCount } = await query(
    `UPDATE projects SET slug=$2, title=$3, category=$4, status=$5, city=$6, area_m2=$7, year=$8, duration_months=$9,
            summary=$10, description=$11, featured=$12, published=$13, updated_at=now()
      WHERE id = $1`,
    [id, slug, d.title, d.category, d.status, d.city, d.areaM2, d.year, d.durationMonths, d.summary, d.description, d.featured, d.published],
  );
  if (!rowCount) throw notFound('Obra não encontrada');
  clearSitemapCache();
  await audit(req, 'project.update', 'project', id);
  res.json({ id, slug });
});

adminRouter.delete('/projects/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const files = await transaction(async (client) => {
    const imgs = await client.query('SELECT filename FROM project_images WHERE project_id = $1', [id]);
    const del = await client.query('DELETE FROM projects WHERE id = $1', [id]);
    if (!del.rowCount) throw notFound('Obra não encontrada');
    return imgs.rows.map((r) => r.filename);
  });
  await Promise.all(files.map(deleteImageFiles));
  clearSitemapCache();
  await audit(req, 'project.delete', 'project', id);
  res.status(204).end();
});

/* ------------------------------- Fotos ------------------------------- */

adminRouter.post('/projects/:id/images', uploadLimiter, imageUpload.array('images', 10), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const exists = await query('SELECT id FROM projects WHERE id = $1', [id]);
  if (!exists.rows[0]) throw notFound('Obra não encontrada');
  const files = req.files || [];
  if (!files.length) throw badRequest('Selecione ao menos uma imagem.');

  const { rows: posRows } = await query('SELECT COALESCE(max(position), -1) AS p FROM project_images WHERE project_id = $1', [id]);
  let position = posRows[0].p + 1;
  const created = [];
  const written = [];
  try {
    for (const file of files) {
      const img = await processImage(file.buffer);
      written.push(img.filename);
      const { rows } = await query(
        `INSERT INTO project_images (project_id, filename, width, height, alt, position)
         VALUES ($1,$2,$3,$4,'',$5) RETURNING *`,
        [id, img.filename, img.width, img.height, position++],
      );
      created.push(mapImage(rows[0]));
    }
  } catch (err) {
    // Desfaz arquivos já gravados deste lote se algum falhar
    await query('DELETE FROM project_images WHERE filename = ANY($1::text[])', [written]);
    await Promise.all(written.map(deleteImageFiles));
    throw err;
  }
  await query('UPDATE projects SET updated_at = now() WHERE id = $1', [id]);
  await audit(req, 'images.upload', 'project', id);
  res.status(201).json({ items: created });
});

adminRouter.patch('/images/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const d = imageUpdate.parse(req.body);
  const { rows } = await query(
    `UPDATE project_images SET alt = COALESCE($2, alt), position = COALESCE($3, position) WHERE id = $1 RETURNING *`,
    [id, d.alt ?? null, d.position ?? null],
  );
  if (!rows[0]) throw notFound('Imagem não encontrada');
  res.json(mapImage(rows[0]));
});

adminRouter.delete('/images/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { rows } = await query('DELETE FROM project_images WHERE id = $1 RETURNING filename, project_id', [id]);
  if (!rows[0]) throw notFound('Imagem não encontrada');
  await deleteImageFiles(rows[0].filename);
  await audit(req, 'image.delete', 'project', rows[0].project_id);
  res.status(204).end();
});

/* ----------------------------- Simulador ----------------------------- */

adminRouter.get('/simulator', async (_req, res) => {
  res.json(await getSimulatorSettings());
});

adminRouter.put('/simulator', async (req, res) => {
  const data = simulatorSettings.parse(req.body);
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('simulator', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(data)],
  );
  await audit(req, 'simulator.update', 'settings', 'simulator');
  res.json(data);
});

/* ----------------------------- Auditoria ----------------------------- */

adminRouter.get('/audit', async (_req, res) => {
  const { rows } = await query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.created_at, a.name AS admin_name
       FROM audit_log l LEFT JOIN admins a ON a.id = l.admin_id
      ORDER BY l.created_at DESC LIMIT 100`,
  );
  res.json({ items: rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entity_id, createdAt: r.created_at, adminName: r.admin_name })) });
});
