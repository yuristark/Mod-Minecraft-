// Testa as Edge Functions com respostas simuladas do Supabase e do Mercado Pago.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import * as criar from '../supabase/functions/criar-pagamento/index.ts';
import * as webhook from '../supabase/functions/webhook-mp/index.ts';

let n = 0; const ok = m => { n++; console.log('  ✓ ' + m); };
const SB = 'https://abcd.supabase.co';
const envC = { SUPABASE_URL: SB, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', MP_ACCESS_TOKEN: 'mp-token', SITE_URL: 'https://loja.exemplo.com.br/' };
const envW = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'service', MP_ACCESS_TOKEN: 'mp-token', MP_WEBHOOK_SECRET: 'segredo-do-webhook' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const TOKEN = 'Bearer ' + 'x'.repeat(40);

function falsoFetch(rotas) {
  const chamadas = [];
  const f = async (url, init = {}) => {
    chamadas.push({ url: String(url), init });
    for (const [padrao, fn] of rotas) if (String(url).includes(padrao)) return fn(url, init);
    throw new Error('rota inesperada ' + url);
  };
  f.chamadas = chamadas;
  return f;
}
const usuario = (extra = {}) => ['/auth/v1/user', () => json(200, { id: 'u1', email: 'c@x.com', email_confirmed_at: '2026-01-01', ...extra })];
const pedido = (headers = {}, method = 'POST') => new Request(SB + '/functions/v1/criar-pagamento', { method, headers: { authorization: TOKEN, origin: 'https://loja.exemplo.com.br', ...headers } });

// ---- criar-pagamento
let r = await criar.tratar(pedido({}, 'OPTIONS'), envC, falsoFetch([]));
assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), 'https://loja.exemplo.com.br'); ok('CORS liberado só para o site do dono');
r = await criar.tratar(pedido({ origin: 'https://golpe.com' }), envC, falsoFetch([])); assert.equal(r.status, 403); ok('outra origem é recusada');
r = await criar.tratar(pedido({ authorization: '' }), envC, falsoFetch([])); assert.equal(r.status, 401); ok('sem login não compra');
r = await criar.tratar(pedido(), envC, falsoFetch([['/auth/v1/user', () => json(401, {})]])); assert.equal(r.status, 401); ok('token inválido é recusado');
r = await criar.tratar(pedido(), envC, falsoFetch([usuario({ email_confirmed_at: null })])); assert.equal(r.status, 403); ok('exige e-mail confirmado');
r = await criar.tratar(pedido(), envC, falsoFetch([usuario(), ['/rpc/criar_compra', () => json(400, { message: 'vendas_fechadas' })]]));
assert.equal(r.status, 409); assert.match((await r.json()).erro, /fechadas/); ok('vendas fechadas viram mensagem clara');
r = await criar.tratar(pedido(), envC, falsoFetch([usuario(), ['/rpc/criar_compra', () => json(400, { message: 'ja_tem_acesso' })]])); assert.equal(r.status, 409); ok('quem já tem acesso não paga de novo');

const compra = { compra_id: '0b6c1f8e-1111-4222-8333-944455556666', valor_centavos: 4990, nome_produto: 'Planilha Segura', email: 'c@x.com' };
let f = falsoFetch([usuario(), ['/rpc/criar_compra', () => json(200, compra)],
  ['/checkout/preferences', () => json(201, { init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1' })]]);
r = await criar.tratar(pedido(), envC, f);
assert.equal(r.status, 200); assert.match((await r.json()).url, /^https:\/\/www\.mercadopago\.com\.br\//);
const chRpc = f.chamadas.find(c => c.url.includes('criar_compra'));
assert.equal(JSON.parse(chRpc.init.body).p_user, 'u1'); ok('compra é criada para o usuário do token, não para um id enviado pelo navegador');
const pref = JSON.parse(f.chamadas.find(c => c.url.includes('preferences')).init.body);
assert.equal(pref.items[0].unit_price, 49.9); assert.equal(pref.items[0].currency_id, 'BRL'); assert.equal(pref.external_reference, compra.compra_id);
assert.equal(pref.notification_url, SB + '/functions/v1/webhook-mp'); assert.equal(pref.back_urls.success, 'https://loja.exemplo.com.br/?pagamento=aprovado');
assert.equal(f.chamadas.find(c => c.url.includes('preferences')).init.headers['X-Idempotency-Key'], compra.compra_id); ok('preferência com preço do banco, retorno ao site e aviso no webhook');

// ---- webhook-mp
const assinar = (dataId, reqId, ts, segredo = envW.MP_WEBHOOK_SECRET) =>
  `ts=${ts},v1=${createHmac('sha256', segredo).update(`id:${dataId};request-id:${reqId};ts:${ts};`).digest('hex')}`;
const aviso = (dataId, headers, corpo = { type: 'payment', data: { id: dataId } }) =>
  new Request(`${SB}/functions/v1/webhook-mp?data.id=${dataId}&type=payment`, { method: 'POST', headers, body: JSON.stringify(corpo) });

assert.equal(await webhook.assinaturaValida(assinar('123', 'req-1', '1700000000'), 'req-1', '123', envW.MP_WEBHOOK_SECRET), true);
assert.equal(await webhook.assinaturaValida(assinar('123', 'req-1', '1700000000', 'outro'), 'req-1', '123', envW.MP_WEBHOOK_SECRET), false);
assert.equal(await webhook.assinaturaValida(assinar('124', 'req-1', '1700000000'), 'req-1', '123', envW.MP_WEBHOOK_SECRET), false);
assert.equal(await webhook.assinaturaValida('lixo', 'req-1', '123', envW.MP_WEBHOOK_SECRET), false); ok('assinatura HMAC do Mercado Pago conferida');

r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1', 'falso') }), envW, falsoFetch([]));
assert.equal(r.status, 401); ok('aviso falso é recusado sem consultar nada');

const pagamento = (extra = {}) => ['/v1/payments/555', () => json(200, { id: 555, status: 'approved', transaction_amount: 49.9, currency_id: 'BRL', external_reference: compra.compra_id, ...extra })];
f = falsoFetch([pagamento(), ['/rpc/registrar_pagamento', () => json(200, 'aprovada')]]);
r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1') }), envW, f);
assert.equal(r.status, 200); assert.equal((await r.json()).resultado, 'aprovada');
const reg = JSON.parse(f.chamadas.find(c => c.url.includes('registrar_pagamento')).init.body);
assert.deepEqual(reg, { p_compra: compra.compra_id, p_payment_id: '555', p_status_mp: 'approved', p_valor_centavos: 4990, p_moeda: 'BRL' }); ok('pagamento consultado no Mercado Pago e registrado com valor em centavos');

f = falsoFetch([pagamento(), ['/rpc/registrar_pagamento', () => json(200, 'aprovada')]]);
r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1') }, { type: 'payment', data: { id: '555' }, status: 'approved', transaction_amount: 0.01 }), envW, f);
assert.equal(JSON.parse(f.chamadas.find(c => c.url.includes('registrar_pagamento')).init.body).p_valor_centavos, 4990); ok('dados do corpo do aviso são ignorados');

r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1') }), envW, falsoFetch([pagamento({ external_reference: 'outra-coisa' })]));
assert.equal((await r.json()).resultado, 'nao_e_desta_loja'); ok('pagamento de outra origem é ignorado');
r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1') }), envW, falsoFetch([['/v1/payments/', () => json(404, {})]]));
assert.equal(r.status, 200); ok('teste do painel do Mercado Pago responde 200');
r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1') }), envW, falsoFetch([['/v1/payments/', () => json(500, {})]]));
assert.equal(r.status, 502); ok('falha temporária pede para o Mercado Pago tentar de novo');
r = await webhook.tratar(new Request(`${SB}/functions/v1/webhook-mp?data.id=9&type=merchant_order`, { method: 'POST', headers: { 'x-request-id': 'r', 'x-signature': assinar('9', 'r', '1') }, body: '{}' }), envW, falsoFetch([]));
assert.equal((await r.json()).resultado, 'ignorado'); ok('outros tipos de aviso são ignorados');

// reembolso automático de cobrança em dobro
f = falsoFetch([pagamento(), ['/rpc/registrar_pagamento', () => json(200, 'duplicado')], ['/v1/payments/555/refunds', () => json(201, { id: 1 })]]);
r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1') }), envW, f);
const rb = await r.json();
assert.equal(rb.reembolso, 'solicitado');
const chRef = f.chamadas.find(c => c.url.includes('/refunds'));
assert.equal(chRef.init.headers['X-Idempotency-Key'], 'reembolso-555'); ok('cobrança em dobro é devolvida automaticamente, uma única vez');
f = falsoFetch([pagamento({ status: 'refunded' }), ['/rpc/registrar_pagamento', () => json(200, 'reembolsada')]]);
r = await webhook.tratar(aviso('555', { 'x-request-id': 'r', 'x-signature': assinar('555', 'r', '1') }), envW, f);
assert.ok(!f.chamadas.some(c => c.url.includes('/refunds'))); ok('aviso de reembolso não gera outro reembolso');

// "Já paguei": confere no Mercado Pago as compras pendentes
const pedidoVerif = () => new Request(SB + '/functions/v1/criar-pagamento', { method: 'POST', headers: { authorization: TOKEN, origin: 'https://loja.exemplo.com.br' }, body: JSON.stringify({ acao: 'verificar' }) });
f = falsoFetch([usuario(), ['/rpc/compras_pendentes', () => json(200, [compra.compra_id])],
  ['/v1/payments/search', () => json(200, { results: [{ id: 777, status: 'approved', transaction_amount: 49.9, currency_id: 'BRL', external_reference: compra.compra_id }, { id: 778, status: 'approved', transaction_amount: 49.9, currency_id: 'BRL', external_reference: 'outra' }] })],
  ['/rpc/registrar_pagamento', () => json(200, 'aprovada')]]);
r = await criar.tratar(pedidoVerif(), envC, f);
assert.equal(r.status, 200); assert.deepEqual(await r.json(), { verificadas: 1, registrados: 1 });
assert.equal(JSON.parse(f.chamadas.find(c => c.url.includes('registrar_pagamento')).init.body).p_compra, compra.compra_id);
assert.ok(!f.chamadas.some(c => c.url.includes('/checkout/preferences'))); ok('“já paguei” confere no Mercado Pago só as compras do próprio usuário');

console.log(`funções: ${n} verificações OK`);
