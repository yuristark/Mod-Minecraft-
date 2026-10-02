// Planilha Segura — recebe os avisos de pagamento do Mercado Pago e libera ou retira o acesso.
//
// Esta função precisa ser publicada SEM verificação de JWT (o Mercado Pago não tem login no Supabase).
// A segurança vem da assinatura secreta do aviso e da consulta do pagamento direto no Mercado Pago.
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   MP_ACCESS_TOKEN    o mesmo token usado em criar-pagamento
//   MP_WEBHOOK_SECRET  "assinatura secreta" mostrada no painel do Mercado Pago, em Webhooks

declare const Deno: {
  env: { get(nome: string): string | undefined };
  serve(tratador: (req: Request) => Response | Promise<Response>): void;
} | undefined;

export interface Ambiente {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MP_ACCESS_TOKEN: string;
  MP_WEBHOOK_SECRET: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function paraHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// Confere o cabeçalho x-signature ("ts=...,v1=...") conforme a documentação do Mercado Pago:
// HMAC-SHA256 do texto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a assinatura secreta.
export async function assinaturaValida(
  xSignature: string | null, xRequestId: string | null, dataId: string | null, segredo: string,
): Promise<boolean> {
  if (!xSignature || !segredo) return false;
  let ts = '', v1 = '';
  for (const parte of xSignature.split(',')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const chave = parte.slice(0, i).trim(), valor = parte.slice(i + 1).trim();
    if (chave === 'ts') ts = valor;
    else if (chave === 'v1') v1 = valor.toLowerCase();
  }
  if (!ts || !/^[0-9a-f]{64}$/.test(v1)) return false;
  let texto = '';
  if (dataId) texto += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (xRequestId) texto += `request-id:${xRequestId};`;
  texto += `ts:${ts};`;
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const esperado = paraHex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto)));
  return iguaisEmTempoConstante(esperado, v1);
}

export async function tratar(req: Request, env: Ambiente, buscar: typeof fetch = fetch): Promise<Response> {
  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido.' });

  const url = new URL(req.url);
  const texto = await req.text();
  if (texto.length > 20000) return responder(413, { erro: 'Aviso grande demais.' });
  let corpo: any = {};
  try { corpo = texto ? JSON.parse(texto) : {}; } catch { corpo = {}; }

  const idNaUrl = url.searchParams.get('data.id');
  const dataId = String(idNaUrl ?? corpo?.data?.id ?? url.searchParams.get('id') ?? '');
  if (!(await assinaturaValida(req.headers.get('x-signature'), req.headers.get('x-request-id'), idNaUrl ?? (dataId || null), env.MP_WEBHOOK_SECRET))) {
    return responder(401, { erro: 'Assinatura inválida.' });
  }

  const tipo = url.searchParams.get('type') ?? corpo?.type ?? url.searchParams.get('topic') ?? corpo?.topic;
  if (tipo !== 'payment') return responder(200, { resultado: 'ignorado' });
  if (!/^\d{1,30}$/.test(dataId)) return responder(400, { erro: 'Identificador de pagamento inválido.' });

  // Nunca confia no conteúdo do aviso: consulta o pagamento direto no Mercado Pago.
  const rp = await buscar(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  if (rp.status === 404) return responder(200, { resultado: 'pagamento_inexistente' }); // ex.: teste do painel do MP
  if (!rp.ok) return responder(502, { erro: 'Mercado Pago indisponível.' }); // o Mercado Pago tenta de novo depois
  const pg = await rp.json();

  const compra = String(pg?.external_reference ?? '');
  if (!UUID.test(compra)) return responder(200, { resultado: 'nao_e_desta_loja' });

  const rr = await buscar(`${env.SUPABASE_URL}/rest/v1/rpc/registrar_pagamento`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_compra: compra,
      p_payment_id: String(pg.id ?? dataId),
      p_status_mp: String(pg.status ?? ''),
      p_valor_centavos: Math.round(Number(pg.transaction_amount) * 100),
      p_moeda: String(pg.currency_id ?? ''),
    }),
  });
  if (!rr.ok) {
    console.error('registrar_pagamento falhou', rr.status, await rr.text().catch(() => ''));
    return responder(500, { erro: 'Falha ao registrar.' }); // o Mercado Pago tenta de novo depois
  }
  const resultado = await rr.json();
  // Protege o comprador: cobrança em dobro ou valor diferente do preço é devolvida automaticamente.
  let reembolso: string | undefined;
  if (pg.status === 'approved' && (resultado === 'duplicado' || resultado === 'divergente')) {
    reembolso = await reembolsar(String(pg.id ?? dataId), env, buscar);
  }
  return responder(200, { resultado, reembolso });
}

// Devolve o valor total de um pagamento. A chave de idempotência evita devolver duas vezes.
export async function reembolsar(paymentId: string, env: Ambiente, buscar: typeof fetch = fetch): Promise<string> {
  try {
    const r = await buscar(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': 'reembolso-' + paymentId },
      body: '{}',
    });
    if (r.ok) return 'solicitado';
    console.error('reembolso automático falhou', paymentId, r.status, await r.text().catch(() => ''));
    return 'falhou';
  } catch (e) {
    console.error('reembolso automático falhou', paymentId, e);
    return 'falhou';
  }
}

function ambiente(): Ambiente {
  const ler = (nome: string) => {
    const v = Deno!.env.get(nome);
    if (!v) throw new Error('Segredo não configurado: ' + nome);
    return v;
  };
  return {
    SUPABASE_URL: ler('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: ler('SUPABASE_SERVICE_ROLE_KEY'),
    MP_ACCESS_TOKEN: ler('MP_ACCESS_TOKEN'),
    MP_WEBHOOK_SECRET: ler('MP_WEBHOOK_SECRET'),
  };
}

if (typeof Deno !== 'undefined') {
  Deno.serve(async (req) => {
    try {
      return await tratar(req, ambiente());
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ erro: 'Erro interno.' }), {
        status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  });
}
