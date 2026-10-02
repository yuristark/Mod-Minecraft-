/**
 * Insere obras de EXEMPLO para visualizar o site.
 * Antes de publicar para o cliente, apague-as no painel ou rode: npm run seed -- --remove
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { migrate } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samples = JSON.parse(await fs.readFile(path.join(__dirname, 'sample-projects.json'), 'utf8'));

await migrate({ silent: true });

if (process.argv.includes('--remove')) {
  const { rowCount } = await pool.query('DELETE FROM projects WHERE slug = ANY($1::text[])', [samples.map((s) => s.slug)]);
  console.log(`✔ ${rowCount} obras de exemplo removidas.`);
} else {
  let n = 0;
  for (const p of samples) {
    const r = await pool.query(
      `INSERT INTO projects (slug, title, category, status, city, area_m2, year, duration_months, summary, description, featured, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true) ON CONFLICT (slug) DO NOTHING`,
      [p.slug, p.title, p.category, p.status, p.city, p.areaM2, p.year, p.durationMonths, p.summary, p.description, p.featured],
    );
    n += r.rowCount;
  }
  console.log(`✔ ${n} obras de exemplo inseridas.`);
}
await pool.end();
