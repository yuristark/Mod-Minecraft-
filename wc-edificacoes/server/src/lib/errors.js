export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (msg = 'Requisição inválida', details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Não autenticado') => new HttpError(401, msg);
export const forbidden = (msg = 'Acesso negado') => new HttpError(403, msg);
export const notFound = (msg = 'Não encontrado') => new HttpError(404, msg);
export const conflict = (msg = 'Conflito') => new HttpError(409, msg);
export const tooMany = (msg = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.') => new HttpError(429, msg);
