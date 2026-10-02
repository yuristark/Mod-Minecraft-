import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';

/** sitemap.xml (páginas + obras publicadas) e robots.txt gerados com o endereço real do site. */
export const seoRouter = Router();

const PAGES = ['/', '/obras', '/servicos', '/simulador', '/empresa', '/orcamento', '/privacidade'];
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

seoRouter.get('/robots.txt', (_req, res) => {
  res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600');
  res.send(['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', '', `Sitemap: ${config.siteUrl}/sitemap.xml`, ''].join('\n'));
});

seoRouter.get('/sitemap.xml', async (_req, res) => {
  const { rows } = await query(
    "SELECT slug, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS lastmod FROM projects WHERE published = true ORDER BY id DESC LIMIT 5000",
  );
  const urls = [
    ...PAGES.map((p) => `<url><loc>${xml(config.siteUrl + p)}</loc></url>`),
    ...rows.map((r) => `<url><loc>${xml(`${config.siteUrl}/obras/${r.slug}`)}</loc><lastmod>${r.lastmod}</lastmod></url>`),
  ];
  res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
});
