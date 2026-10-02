import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { loadSession } from './middleware/auth.js';
import { errorHandler, notFoundApi } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimits.js';
import { noStore, permissionsPolicy, requireJson, securityHeaders, verifyOrigin } from './middleware/security.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { seoRouter } from './routes/seo.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('query parser', 'simple'); // evita objetos aninhados vindos da query string
  app.set('etag', false);

  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url.startsWith('/assets/') || req.url.startsWith('/uploads/') },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }));

  app.use(securityHeaders());
  app.use(permissionsPolicy);

  /* ------------------------------ API ------------------------------ */
  const api = express.Router();
  api.use(noStore);
  api.use(apiLimiter);
  api.use(verifyOrigin);
  api.use(requireJson);
  api.use(express.json({ limit: '32kb', strict: true }));
  api.use(cookieParser());
  api.use(loadSession);

  api.use('/', publicRouter);
  api.use('/auth', authRouter);
  api.use('/admin', adminRouter);
  api.use(notFoundApi);

  app.use('/api', api);

  /* ------------------- SEO: sitemap.xml e robots.txt ------------------- */
  app.use(seoRouter);

  /* ---------------------------- Uploads ---------------------------- */
  app.use('/uploads', express.static(config.uploadDir, {
    index: false,
    dotfiles: 'deny',
    redirect: false,
    fallthrough: false,
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    },
  }));

  /* ------------------------ Front-end (SPA) ------------------------ */
  const indexHtml = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use('/assets', express.static(path.join(config.clientDist, 'assets'), {
      index: false, dotfiles: 'deny', maxAge: '1y', immutable: true, fallthrough: false,
    }));
    app.use(express.static(config.clientDist, { index: false, dotfiles: 'deny', maxAge: '1h' }));
    app.get('/{*splat}', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  } else if (!config.isProd) {
    app.get('/', (_req, res) => res.type('text').send('API WC Edificações rodando. Inicie o front com `npm run dev` na pasta client.'));
  }

  app.use(errorHandler);
  return app;
}
