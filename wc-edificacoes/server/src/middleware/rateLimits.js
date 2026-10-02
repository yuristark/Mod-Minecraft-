import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';

/*
 * Limites em memória: adequados para 1 instância. Se rodar várias instâncias
 * (cluster/PM2/Kubernetes), troque por um store compartilhado (ex.: rate-limit-redis).
 * Em ambiente de teste os limites ficam desligados, exceto quando um teste os habilita.
 */
const skipInTests = () => config.env === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== '1';

const message = (msg) => ({ error: msg });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipInTests,
  message: message('Muitas requisições. Aguarde alguns minutos.'),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTests,
  message: message('Muitas tentativas. Aguarde alguns minutos e tente novamente.'),
});

export const quoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipInTests,
  message: message('Você já enviou vários pedidos. Tente novamente mais tarde ou fale pelo telefone.'),
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipInTests,
  message: message('Limite de envios atingido. Aguarde alguns minutos.'),
});
