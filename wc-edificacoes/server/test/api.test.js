/**
 * Testes de API e segurança. Requer um PostgreSQL de teste (banco é limpo a cada execução):
 *   TEST_DATABASE_URL=postgres://usuario:senha@localhost:5432/wc_test npm test
 */
import fs from 'node:fs/promises';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db.js';
import { config } from '../src/config.js';
import { migrate } from '../src/scripts/migrate.js';
import { ensureUploadDir } from '../src/lib/uploads.js';
import { ARGON_OPTS } from '../src/routes/auth.js';
import { setMailTransport } from '../src/lib/mailer.js';

const ORIGIN = 'http://localhost:5173';
const ADMIN = { email: 'admin@teste.com', password: 'SenhaMuitoForte2026' };
let app;

const validQuote = (over = {}) => ({
  name: 'Maria da Silva',
  email: 'maria@exemplo.com',
  phone: '(31) 98888-7777',
  city: 'Contagem – MG',
  projectType: 'residencial',
  standard: 'medio',
  areaM2: 100,
  hasLand: true,
  hasProject: false,
  startWindow: '3_meses',
  extras: [],
  message: 'Quero construir uma casa.',
  consent: true,
  website: '',
  startedAt: Date.now() - 60_000,
  ...over,
});

async function login(agent = request.agent(app), creds = ADMIN) {
  const res = await agent.post('/api/auth/login').set('Origin', ORIGIN).send(creds);
  return { agent, res, csrf: res.body.csrfToken };
}

beforeAll(async () => {
  await migrate({ silent: true });
  await query('TRUNCATE quotes, project_images, projects, sessions, audit_log, admins RESTART IDENTITY CASCADE');
  await query('INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)', ['Admin Teste', ADMIN.email, await argon2.hash(ADMIN.password, ARGON_OPTS)]);
  await query(`INSERT INTO projects (slug, title, category, status, city, summary, published) VALUES
    ('obra-publica', 'Obra Pública', 'residencial', 'concluida', 'BH', 'Resumo de teste com tamanho ok', true),
    ('obra-rascunho', 'Obra Rascunho', 'comercial', 'em_andamento', 'BH', 'Resumo de teste com tamanho ok', false)`);
  await ensureUploadDir();
  app = createApp();
});

afterAll(async () => {
  await fs.rm(config.uploadDir, { recursive: true, force: true });
  await pool.end();
});

describe('cabeçalhos de segurança', () => {
  it('envia CSP estrita, anti-clickjacking e nosniff; oculta X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).not.toContain('unsafe-inline');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });

  it('não expõe CORS para outras origens', async () => {
    const res = await request(app).get('/api/projects').set('Origin', 'https://site-malicioso.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('obras públicas', () => {
  it('lista apenas obras publicadas', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.items.map((p) => p.slug)).toEqual(['obra-publica']);
  });

  it('não revela rascunhos pelo slug', async () => {
    expect((await request(app).get('/api/projects/obra-rascunho')).status).toBe(404);
  });

  it('rejeita tentativas de SQL injection nos filtros e no slug', async () => {
    expect((await request(app).get("/api/projects?category=residencial' OR '1'='1")).status).toBe(400);
    expect((await request(app).get("/api/projects/obra'%20OR%201=1--")).status).toBe(400);
    expect((await request(app).get('/api/projects?limit=100000')).status).toBe(400);
  });

  it('ignora parâmetros aninhados na query string (sem injeção de operadores)', async () => {
    const res = await request(app).get('/api/projects?category[$ne]=x&published=false');
    expect(res.status).toBe(200);
    expect(res.body.items.map((p) => p.slug)).toEqual(['obra-publica']);
  });
});

describe('pedido de orçamento', () => {
  it('cria pedido válido, calcula estimativa no servidor e ignora campos extras', async () => {
    const res = await request(app).post('/api/quotes').set('Origin', ORIGIN)
      .send({ ...validQuote(), estimateMin: 1, status: 'fechado', notes: 'hack' });
    expect(res.status).toBe(201);
    expect(res.body.protocol).toMatch(/^WC\d{4}-[A-Z2-9]{6}$/);
    const { rows } = await query('SELECT * FROM quotes WHERE protocol = $1', [res.body.protocol]);
    expect(rows[0].status).toBe('novo');
    expect(rows[0].notes).toBe('');
    expect(rows[0].phone).toBe('31988887777');
    expect(rows[0].estimate_min).toBeGreaterThan(200000); // 100 m² × R$ 2.800 − 12%
    expect(rows[0].ip_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('valida campos e devolve mensagens por campo', async () => {
    const res = await request(app).post('/api/quotes').set('Origin', ORIGIN)
      .send(validQuote({ email: 'nao-e-email', phone: '123', consent: false }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['email', 'phone', 'consent']));
  });

  it('descarta silenciosamente robôs (honeypot e envio rápido demais)', async () => {
    const before = (await query('SELECT count(*) AS n FROM quotes')).rows[0].n;
    const a = await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ website: 'http://spam.com' }));
    const b = await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ startedAt: Date.now() - 500 }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((await query('SELECT count(*) AS n FROM quotes')).rows[0].n).toBe(before);
  });

  it('armazena HTML/JS como texto literal (sem interpretar) e responde só JSON', async () => {
    const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const res = await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ message: xss, name: 'Ana <b>Teste</b>' }));
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const { rows } = await query('SELECT message FROM quotes WHERE protocol = $1', [res.body.protocol]);
    expect(rows[0].message).toBe(xss);
  });

  it('remove caracteres de controle e de direção de texto (bidi)', async () => {
    const res = await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ name: 'Jo‮ão\u0000 Teste' }));
    const { rows } = await query('SELECT name FROM quotes WHERE protocol = $1', [res.body.protocol]);
    expect(rows[0].name).toBe('João Teste');
  });

  it('bloqueia requisições sem Origin ou de outra origem (CSRF)', async () => {
    expect((await request(app).post('/api/quotes').send(validQuote())).status).toBe(403);
    expect((await request(app).post('/api/quotes').set('Origin', 'https://evil.example').send(validQuote())).status).toBe(403);
  });

  it('recusa corpo grande demais e Content-Type inesperado', async () => {
    const big = await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ message: 'a'.repeat(40_000) }));
    expect(big.status).toBe(413);
    const form = await request(app).post('/api/quotes').set('Origin', ORIGIN).type('form').send('name=x');
    expect(form.status).toBe(415);
    const bad = await request(app).post('/api/quotes').set('Origin', ORIGIN).set('Content-Type', 'application/json').send('{"name":');
    expect(bad.status).toBe(400);
  });
});

describe('autenticação', () => {
  it('rotas do painel exigem login', async () => {
    expect((await request(app).get('/api/admin/quotes')).status).toBe(401);
    expect((await request(app).get('/api/admin/stats').set('Cookie', 'wc_sid=' + 'a'.repeat(64))).status).toBe(401);
  });

  it('mensagem idêntica para e-mail inexistente e senha errada (sem enumeração)', async () => {
    const a = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'ninguem@x.com', password: 'qualquer' });
    const b = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: ADMIN.email, password: 'errada' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
    await query('UPDATE admins SET failed_attempts = 0');
  });

  it('login define cookie HttpOnly + SameSite=Strict e não devolve o token no corpo', async () => {
    const { res } = await login();
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'].find((c) => /^wc_sid=[a-f0-9]{64};/.test(c));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(JSON.stringify(res.body)).not.toContain(cookie.split(';')[0].split('=')[1]);
    const { rows } = await query('SELECT token_hash FROM sessions');
    expect(rows.every((r) => r.token_hash !== cookie.split(';')[0].split('=')[1])).toBe(true); // só o hash fica no banco
  });

  it('exige token CSRF em ações do painel', async () => {
    const { agent, csrf } = await login();
    const noToken = await agent.put('/api/admin/simulator').set('Origin', ORIGIN).send({});
    expect(noToken.status).toBe(403);
    const wrong = await agent.post('/api/auth/logout').set('Origin', ORIGIN).set('X-CSRF-Token', 'f'.repeat(64));
    expect(wrong.status).toBe(403);
    const ok = await agent.post('/api/auth/logout').set('Origin', ORIGIN).set('X-CSRF-Token', csrf);
    expect(ok.status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.admin).toBeNull(); // sessão realmente encerrada
  });

  it('bloqueia a conta após tentativas seguidas, mesmo com a senha certa', async () => {
    for (let i = 0; i < config.maxLoginAttempts; i++) {
      await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: ADMIN.email, password: 'errada' + i });
    }
    const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send(ADMIN);
    expect(res.status).toBe(429);
    await query('UPDATE admins SET failed_attempts = 0, locked_until = NULL');
  });
});

describe('painel administrativo', () => {
  it('busca trata curingas/SQL como texto e exporta CSV protegido contra fórmulas', async () => {
    await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ name: '=HYPERLINK("http://evil","clique")' }));
    const { agent } = await login();
    const search = await agent.get("/api/admin/quotes?q=%25' OR '1'='1");
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(0);
    const pct = await agent.get('/api/admin/quotes?q=%25');
    expect(pct.body.total).toBe(0); // "%" é literal, não "tudo"
    const csv = await agent.get('/api/admin/quotes/export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-disposition']).toMatch(/attachment/);
    expect(csv.text).toContain(`"'=HYPERLINK(""http://evil"",""clique"")"`);
    expect(csv.text).not.toMatch(/;=HYPERLINK/);
  });

  it('valida as configurações do simulador (sem chaves extras ou valores absurdos)', async () => {
    const { agent, csrf } = await login();
    const current = (await agent.get('/api/admin/simulator')).body;
    const bad = await agent.put('/api/admin/simulator').set('Origin', ORIGIN).set('X-CSRF-Token', csrf)
      .send({ ...current, variationPercent: 999, __proto__: { admin: true } });
    expect(bad.status).toBe(400);
    const extraKey = await agent.put('/api/admin/simulator').set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send({ ...current, hack: 1 });
    expect(extraKey.status).toBe(400);
    const ok = await agent.put('/api/admin/simulator').set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send({ ...current, variationPercent: 10 });
    expect(ok.status).toBe(200);
  });

  it('upload: rejeita SVG/arquivo disfarçado e reprocessa imagens reais sem metadados', async () => {
    const { agent, csrf } = await login();
    const { rows } = await query("SELECT id FROM projects WHERE slug = 'obra-publica'");
    const pid = rows[0].id;

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const fake = await agent.post(`/api/admin/projects/${pid}/images`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf)
      .attach('images', svg, { filename: 'foto.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);

    const svgMime = await agent.post(`/api/admin/projects/${pid}/images`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf)
      .attach('images', svg, { filename: 'foto.svg', contentType: 'image/svg+xml' });
    expect(svgMime.status).toBe(400);

    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#e8642c' } })
      .jpeg().withExif({ IFD0: { Copyright: 'GPS secreto' } }).toBuffer();
    const ok = await agent.post(`/api/admin/projects/${pid}/images`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf)
      .attach('images', jpeg, { filename: '../../etc/passwd.jpg', contentType: 'image/jpeg' });
    expect(ok.status).toBe(201);
    const img = ok.body.items[0];
    expect(img.url).toMatch(/^\/uploads\/[a-f0-9-]{36}\.webp$/);

    const served = await request(app).get(img.url).buffer(true);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    const meta = await sharp(served.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });

  it('não permite path traversal na pasta de uploads', async () => {
    const res = await request(app).get('/uploads/..%2f.env');
    expect([403, 404]).toContain(res.status);
    expect(res.text).not.toContain('DATABASE_URL');
  });

  it('troca de senha aplica política e encerra outras sessões', async () => {
    const s1 = await login();
    const s2 = await login();
    const weak = await s1.agent.post('/api/auth/password').set('Origin', ORIGIN).set('X-CSRF-Token', s1.csrf)
      .send({ currentPassword: ADMIN.password, newPassword: 'curta' });
    expect(weak.status).toBe(400);
    const ok = await s1.agent.post('/api/auth/password').set('Origin', ORIGIN).set('X-CSRF-Token', s1.csrf)
      .send({ currentPassword: ADMIN.password, newPassword: 'NovaSenhaSegura2027' });
    expect(ok.status).toBe(204);
    expect((await s2.agent.get('/api/auth/me')).body.admin).toBeNull();
    expect((await s1.agent.get('/api/auth/me')).body.admin.email).toBe(ADMIN.email);
    const audit = await s1.agent.get('/api/admin/audit');
    expect(audit.body.items.map((a) => a.action)).toContain('password.changed');
  });
});

describe('SEO e avisos', () => {
  it('gera sitemap.xml só com obras publicadas e robots.txt apontando para ele', async () => {
    const sm = await request(app).get('/sitemap.xml');
    expect(sm.status).toBe(200);
    expect(sm.headers['content-type']).toContain('xml');
    expect(sm.text).toContain('/obras/obra-publica</loc>');
    expect(sm.text).not.toContain('obra-rascunho');
    const rb = await request(app).get('/robots.txt');
    expect(rb.text).toContain('Disallow: /admin');
    expect(rb.text).toMatch(/Sitemap: http.+\/sitemap\.xml/);
  });

  it('envia aviso por e-mail de novo orçamento sem quebras de linha no assunto', async () => {
    const sent = [];
    setMailTransport({ sendMail: async (m) => { sent.push(m); } });
    const res = await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ name: 'Ana Souza', email: 'ana@exemplo.com' }));
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 50));
    setMailTransport(null);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain(res.body.protocol);
    expect(sent[0].subject).not.toMatch(/[\r\n]/);
    expect(sent[0].replyTo).toBe('ana@exemplo.com');
    expect(sent[0].text).toContain('Ana Souza');
  });

  it('falha no envio do e-mail não impede o pedido de ser salvo', async () => {
    setMailTransport({ sendMail: async () => { throw new Error('SMTP fora do ar'); } });
    const res = await request(app).post('/api/quotes').set('Origin', ORIGIN).send(validQuote({ name: 'Carlos Lima' }));
    setMailTransport(null);
    expect(res.status).toBe(201);
    const { rows } = await query('SELECT 1 FROM quotes WHERE protocol = $1', [res.body.protocol]);
    expect(rows).toHaveLength(1);
  });
});

describe('limites de requisição', () => {
  it('limita tentativas de login por IP', async () => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = '1';
    let last;
    for (let i = 0; i < 12; i++) {
      last = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'x@y.com', password: 'z' });
    }
    expect(last.status).toBe(429);
    delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
  });
});
