// Planilha Segura — cria o pagamento único no Mercado Pago (Checkout Pro) para quem está logado.
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   MP_ACCESS_TOKEN  token de acesso de produção (ou de teste) da conta Mercado Pago do dono
//   SITE_URL         endereço do site, ex.: https://planilhasegura.com.br/
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem em todo projeto Supabase.

declare const Deno: {
  env: { get(nome: string): string | undefined };
  serve(tratador: (req: Request) => Response | Promise<Response>): void;
} | undefined;

export interface Ambiente {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MP_ACCESS_TOKEN: string;
  SITE_URL: string;
}

const ERROS_DO_BANCO: Record<string, [number, string]> = {
  vendas_fechadas: [409, 'As vendas estão fechadas no momento.'],
  ja_tem_acesso: [409, 'Você já tem acesso. Recarregue a página.'],
  muitas_tentativas: [429, 'Muitas tentativas seguidas. Aguarde alguns minutos.'],
};

export async function tratar(req: Request, env: Ambiente, buscar: typeof fetch = fetch): Promise<Response> {
  const site = new URL(env.SITE_URL);
  const origem = site.origin;
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido.' });
  const deOnde = req.headers.get('origin');
  if (deOnde && deOnde !== origem) return responder(403, { erro: 'Origem não permitida.' });

  const autorizacao = req.headers.get('authorization') || '';
  if (!/^Bearer [\w.-]{20,}$/.test(autorizacao)) return responder(401, { erro: 'Entre na sua conta para comprar.' });

  // 1. Quem está pedindo (o token é conferido pelo próprio Supabase Auth).
  const ru = await buscar(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: autorizacao },
  });
  if (!ru.ok) return responder(401, { erro: 'Sua sessão expirou. Entre de novo.' });
  const usuario = await ru.json();
  if (!usuario || typeof usuario.id !== 'string') return responder(401, { erro: 'Sua sessão expirou. Entre de novo.' });
  if (!usuario.email_confirmed_at) return responder(403, { erro: 'Confirme seu e-mail antes de comprar.' });

  const corpo = await req.json().catch(() => ({}));
  if (corpo && corpo.acao === 'verificar') return responder(200, await verificarPagamentos(usuario.id, env, buscar));

  // 2. Registra a compra pendente com o preço atual (o banco confere vendas abertas e acesso existente).
  const rc = await buscar(`${env.SUPABASE_URL}/rest/v1/rpc/criar_compra`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user: usuario.id }),
  });
  if (!rc.ok) {
    const e = await rc.json().catch(() => ({}));
    const conhecido = ERROS_DO_BANCO[String(e && e.message)];
    if (conhecido) return responder(conhecido[0], { erro: conhecido[1] });
    console.error('criar_compra falhou', rc.status, e);
    return responder(500, { erro: 'Não foi possível iniciar a compra. Tente de novo.' });
  }
  const compra = await rc.json();

  // 3. Cria a preferência de pagamento no Mercado Pago.
  const voltar = (situacao: string) => { const u = new URL(site.href); u.search = '?pagamento=' + situacao; u.hash = ''; return u.href; };
  const preferencia = {
    items: [{
      id: 'acesso-vitalicio',
      title: `${compra.nome_produto} — acesso vitalício`.slice(0, 250),
      quantity: 1,
      unit_price: compra.valor_centavos / 100,
      currency_id: 'BRL',
    }],
    payer: { email: compra.email },
    external_reference: compra.compra_id,
    notification_url: `${env.SUPABASE_URL}/functions/v1/webhook-mp`,
    back_urls: { success: voltar('aprovado'), pending: voltar('pendente'), failure: voltar('falhou') },
    auto_return: 'approved',
    // Aceita tudo o que a conta do Mercado Pago tiver habilitado: Pix de qualquer banco, cartões de crédito
    // (Visa, Mastercard, Elo, Amex, Hipercard) em até 12x, boleto e saldo Mercado Pago.
    payment_methods: { installments: 12 },
    // Nome que aparece na fatura do cartão: evita "não reconheço esta compra" (contestação).
    statement_descriptor: String(compra.nome_produto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, 22) || 'LOJA',
  };
  const rp = await buscar('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': compra.compra_id,
    },
    body: JSON.stringify(preferencia),
  });
  if (!rp.ok) {
    console.error('Mercado Pago recusou a preferência', rp.status, await rp.text().catch(() => ''));
    return responder(502, { erro: 'O Mercado Pago não respondeu. Tente de novo em instantes.' });
  }
  const resposta = await rp.json();
  if (!resposta || typeof resposta.init_point !== 'string') return responder(502, { erro: 'Resposta inesperada do Mercado Pago.' });
  return responder(200, { url: resposta.init_point });
}

// "Já paguei": quando o aviso automático do Mercado Pago não chegou, consulta direto no Mercado Pago
// os pagamentos das compras pendentes deste usuário e registra o que encontrar.
export async function verificarPagamentos(userId: string, env: Ambiente, buscar: typeof fetch = fetch) {
  const servidor = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const rp = await buscar(`${env.SUPABASE_URL}/rest/v1/rpc/compras_pendentes`, { method: 'POST', headers: servidor, body: JSON.stringify({ p_user: userId }) });
  if (!rp.ok) return { verificadas: 0 };
  const ids = ((await rp.json()) || []).map((x: any) => typeof x === 'string' ? x : x && x.compras_pendentes).filter(Boolean).slice(0, 5);
  let registrados = 0;
  for (const id of ids) {
    const rs = await buscar(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=asc`, {
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
    });
    if (!rs.ok) continue;
    const lista = ((await rs.json()) || {}).results || [];
    for (const pg of lista.slice(0, 10)) {
      if (String(pg.external_reference) !== id) continue;
      const rr = await buscar(`${env.SUPABASE_URL}/rest/v1/rpc/registrar_pagamento`, {
        method: 'POST', headers: servidor,
        body: JSON.stringify({ p_compra: id, p_payment_id: String(pg.id), p_status_mp: String(pg.status ?? ''), p_valor_centavos: Math.round(Number(pg.transaction_amount) * 100), p_moeda: String(pg.currency_id ?? '') }),
      });
      if (rr.ok) registrados++;
    }
  }
  return { verificadas: ids.length, registrados };
}

function ambiente(): Ambiente {
  const ler = (nome: string) => {
    const v = Deno!.env.get(nome);
    if (!v) throw new Error('Segredo não configurado: ' + nome);
    return v;
  };
  return {
    SUPABASE_URL: ler('SUPABASE_URL'),
    SUPABASE_ANON_KEY: ler('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: ler('SUPABASE_SERVICE_ROLE_KEY'),
    MP_ACCESS_TOKEN: ler('MP_ACCESS_TOKEN'),
    SITE_URL: ler('SITE_URL'),
  };
}

if (typeof Deno !== 'undefined') {
  Deno.serve(async (req) => {
    try {
      return await tratar(req, ambiente());
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ erro: 'Erro interno. Avise o suporte.' }), {
        status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  });
}
