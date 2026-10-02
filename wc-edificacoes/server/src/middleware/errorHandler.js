import { ZodError } from 'zod';
import multer from 'multer';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export function notFoundApi(_req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return res.status(400).json({ error: 'Verifique os campos destacados.', fields });
  }

  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? `Arquivo muito grande (máx. ${config.maxUploadMb} MB).`
      : err.code === 'LIMIT_FILE_COUNT' ? 'Envie no máximo 10 imagens por vez.' : 'Upload inválido.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: msg });
  }

  // Erros do body-parser (JSON malformado / corpo grande demais)
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Conteúdo grande demais' });

  // Violação de unicidade do Postgres
  if (err.code === '23505') return res.status(409).json({ error: 'Registro duplicado' });

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) {
    logger.error({ err, reqId: req.id }, 'erro interno');
    // Nunca expõe stack trace / mensagem interna ao cliente
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.', requestId: req.id });
  }
  const body = { error: err.expose ? err.message : 'Requisição inválida' };
  if (err.details) body.fields = err.details;
  return res.status(status).json(body);
}
