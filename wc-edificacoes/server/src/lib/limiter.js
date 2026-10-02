import { HttpError } from './errors.js';

/**
 * Semáforo simples: limita quantas operações pesadas rodam ao mesmo tempo.
 * Usado no Argon2 (cada verificação de senha usa ~19 MB de RAM e CPU de propósito):
 * sem limite, uma rajada de logins simultâneos poderia esgotar a memória do servidor.
 * Pedidos além da fila recebem 503 em vez de derrubar o processo.
 */
export function createLimiter(maxConcurrent, maxQueue) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= maxConcurrent || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
  };
  return function run(fn) {
    if (queue.length >= maxQueue) {
      return Promise.reject(new HttpError(503, 'Servidor ocupado. Tente novamente em instantes.'));
    }
    return new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
  };
}
