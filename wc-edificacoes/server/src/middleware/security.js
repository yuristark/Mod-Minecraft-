import helmet from 'helmet';
import { config } from '../config.js';
import { forbidden } from '../lib/errors.js';

const TURNSTILE = 'https://challenges.cloudflare.com';

/** Cabeçalhos de segurança + Content-Security-Policy estrita (sem scripts inline). */
export function securityHeaders() {
  const useTurnstile = Boolean(config.turnstileSecret);
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...(useTurnstile ? [TURNSTILE] : [])],
        scriptSrcAttr: ["'none'"], // nenhum onclick="" etc.
        // nenhum style="" vindo do HTML (o React aplica estilos via CSSOM). O widget do Turnstile precisa deles.
        ...(useTurnstile ? {} : { styleSrcAttr: ["'none'"] }),
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", ...(useTurnstile ? [TURNSTILE] : [])],
        frameSrc: useTurnstile ? [TURNSTILE] : ["'none'"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    crossOriginEmbedderPolicy: false, // imagens próprias apenas; manter false evita quebrar o widget anti-spam
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
    xDnsPrefetchControl: { allow: false },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
  });
}

export function permissionsPolicy(_req, res, next) {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
  );
  next();
}

/** Respostas da API nunca devem ser guardadas em cache (dados do painel). */
export function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defesa contra CSRF (camada 1): toda requisição que altera estado precisa vir
 * de uma origem permitida. Complementa o cookie SameSite=Strict e o token CSRF
 * exigido nas rotas autenticadas.
 */
export function verifyOrigin(req, _res, next) {
  if (!UNSAFE.has(req.method)) return next();
  const origin = req.get('origin');
  let source = origin;
  if (!source) {
    const referer = req.get('referer');
    if (referer) {
      try { source = new URL(referer).origin; } catch { source = null; }
    }
  }
  if (!source) return next(forbidden('Origem da requisição ausente'));
  const selfOrigin = `${req.protocol}://${req.get('host')}`;
  if (source === selfOrigin || config.allowedOrigins.includes(source)) return next();
  return next(forbidden('Origem da requisição não permitida'));
}

/** Aceita apenas JSON nas rotas que recebem corpo (exceto upload multipart). */
export function requireJson(req, _res, next) {
  if (!UNSAFE.has(req.method) || req.method === 'DELETE') return next();
  const len = Number(req.get('content-length') || 0);
  if (len === 0 && !req.get('transfer-encoding')) return next();
  if (req.is('application/json') || req.is('multipart/form-data')) return next();
  const err = new Error('Content-Type não suportado');
  err.status = 415;
  err.expose = true;
  return next(err);
}
