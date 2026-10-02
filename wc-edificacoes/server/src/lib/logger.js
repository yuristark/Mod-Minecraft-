import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : process.env.NODE_ENV === 'test' ? 'silent' : 'debug');

export const logger = pino({
  level,
  // Nunca registrar segredos ou dados pessoais em log.
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.password_hash',
      '*.email',
      '*.phone',
    ],
    censor: '[oculto]',
  },
});
