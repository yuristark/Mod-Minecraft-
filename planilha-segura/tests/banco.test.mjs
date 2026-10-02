// Testa supabase/migrations/0001_planilha_segura.sql num Postgres real (PGlite),
// simulando o que o Supabase oferece: papéis anon/authenticated/service_role, auth.users, auth.uid() e storage.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const migracao = readFileSync(new URL('../supabase/migrations/0001_planilha_segura.sql', import.meta.url), 'utf8');
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz, raw_user_meta_data jsonb default '{}');
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, created_at timestamptz default now(), updated_at timestamptz default now(), refreshed_at timestamp, not_after timestamptz, user_agent text, ip inet);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select on storage.objects to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  -- Igual ao Supabase: tudo que é criado em public recebe permissão para os três papéis.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);
await db.exec(migracao);
await db.exec(migracao); // precisa poder rodar de novo

async function como(papel, uid, sql, params = [], headers = {}) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${papel}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || '']);
    await db.query(`select set_config('request.headers', $1, true)`, [JSON.stringify(headers)]);
    const r = await db.query(sql, params);
    await db.exec('commit');
    return r.rows;
  } catch (e) { await db.exec('rollback'); throw e; }
}
const um = async (...a) => Object.values((await como(...a))[0])[0];
const falha = async (p, re) => { await assert.rejects(p, re); };
let n = 0; const ok = m => { n++; console.log('  ✓ ' + m); };

const novo = async (email, confirmado = true, nome = '') =>
  (await db.query(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id`, [email, confirmado ? new Date() : null, JSON.stringify(nome ? { nome } : {})])).rows[0].id;
const A = await novo('dono@teste.local', false), B = await novo('cliente@teste.local', true, 'Cliente Teste'), C = await novo('novo.dono@teste.local');

// Vitrine
let pub = await um('anon', null, 'select public.config_publica()');
assert.equal(pub.vendas_abertas, false); assert.equal(pub.tem_dono, false); ok('vitrine pública começa com vendas fechadas e sem dono');

// Anônimo e cliente não leem nem escrevem direto
await falha(como('anon', null, 'select * from public.compras'), /permission denied/); ok('anônimo não lê compras');
await falha(como('anon', null, 'select public.admin_resumo()'), /permission denied/); ok('anônimo não acessa o painel');
await falha(como('authenticated', B, `select public.criar_compra($1)`, [B]), /permission denied/); ok('navegador não cria compra direto');
await falha(como('authenticated', B, `select public.registrar_pagamento(gen_random_uuid(), '1', 'approved', 1, 'BRL')`), /permission denied/); ok('navegador não registra pagamento');
await falha(como('authenticated', B, `insert into public.acessos (user_id, origem) values ($1, 'manual')`, [B]), /permission denied/); ok('navegador não se dá acesso');
await falha(como('authenticated', B, `update public.configuracao set dono_id = $1`, [B]), /permission denied/); ok('navegador não vira dono pela tabela');
await falha(como('service_role', null, `select public.definir_dono_pelo_sql('x@y.z')`), /permission denied/); ok('definir dono só pelo SQL Editor');

// Primeiro dono
await db.query(`select public.definir_dono_pelo_sql('Dono@Teste.local')`);
await falha(como('authenticated', B, 'select public.aceitar_propriedade()'), /Não há convite/); ok('outra pessoa não aceita o convite');
await falha(como('authenticated', A, 'select public.aceitar_propriedade()'), /Confirme seu e-mail/); ok('exige e-mail confirmado');
await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [A]);
assert.equal((await um('authenticated', A, 'select public.meu_status()')).convite_propriedade, true);
await como('authenticated', A, 'select public.aceitar_propriedade()');
let st = await um('authenticated', A, 'select public.meu_status()');
assert.equal(st.eh_dono, true); assert.equal(st.tem_acesso, true); assert.equal(st.convite_propriedade, false); ok('primeiro dono assume e tem acesso');

// Painel
await falha(como('authenticated', B, 'select public.admin_resumo()'), /Apenas o dono/); ok('cliente não abre o painel');
await falha(como('authenticated', A, `select public.admin_salvar_config('X', '', null, true, null)`), /Defina o preço/); ok('não abre vendas sem preço');
await como('authenticated', A, `select public.admin_salvar_config('Planilha Segura', 'Acesso vitalício', 4990, true, 'suporte@teste.local')`);
pub = await um('anon', null, 'select public.config_publica()');
assert.equal(pub.preco_centavos, 4990); assert.equal(pub.vendas_abertas, true); ok('dono define preço e abre vendas');

// Compra com valor errado
let c1 = await um('service_role', null, 'select public.criar_compra($1)', [B]);
assert.equal(c1.valor_centavos, 4990); assert.equal(c1.email, 'cliente@teste.local');
assert.equal(await um('service_role', null, `select public.registrar_pagamento($1, 'p1', 'approved', 100, 'BRL')`, [c1.compra_id]), 'divergente');
assert.equal((await um('authenticated', B, 'select public.meu_status()')).tem_acesso, false); ok('pagamento com valor diferente não libera');

// Compra correta
let c2 = await um('service_role', null, 'select public.criar_compra($1)', [B]);
assert.equal(await um('service_role', null, `select public.registrar_pagamento($1, 'p2', 'pending', 4990, 'BRL')`, [c2.compra_id]), 'pendente');
assert.equal((await um('authenticated', B, 'select public.meu_status()')).tem_acesso, false);
assert.equal(await um('service_role', null, `select public.registrar_pagamento($1, 'p2', 'approved', 4990, 'BRL')`, [c2.compra_id]), 'aprovada');
assert.equal((await um('authenticated', B, 'select public.meu_status()')).tem_acesso, true); ok('pagamento aprovado libera o acesso');
assert.equal(await um('service_role', null, `select public.registrar_pagamento($1, 'p2', 'approved', 4990, 'BRL')`, [c2.compra_id]), 'aprovada'); ok('aviso repetido do webhook não muda nada');
assert.equal(await um('service_role', null, `select public.registrar_pagamento($1, 'p3', 'rejected', 4990, 'BRL')`, [c2.compra_id]), 'ignorado'); ok('tentativa recusada depois não tira o acesso');
assert.equal(await um('service_role', null, `select public.registrar_pagamento($1, 'p4', 'approved', 4990, 'BRL')`, [c2.compra_id]), 'duplicado'); ok('cobrança em dobro vira alerta para o dono');
await falha(como('service_role', null, 'select public.criar_compra($1)', [B]), /ja_tem_acesso/); ok('quem já comprou não paga de novo');
// duas compras abertas ao mesmo tempo (duas abas): a segunda paga vira cobrança em dobro, sem mexer no acesso
await db.query(`insert into public.compras (id, user_id, email_comprador, valor_centavos) values ('00000000-0000-4000-8000-000000000001', $1, 'cliente@teste.local', 4990)`, [B]);
assert.deepEqual((await como('service_role', null, 'select * from public.compras_pendentes($1)', [B])).map(r => r.compras_pendentes), ['00000000-0000-4000-8000-000000000001']);
await falha(como('authenticated', B, 'select * from public.compras_pendentes($1)', [B]), /permission denied/);
assert.equal(await um('service_role', null, `select public.registrar_pagamento('00000000-0000-4000-8000-000000000001', 'p9', 'approved', 4990, 'BRL')`), 'duplicado');
assert.equal((await db.query(`select status from public.compras where id = '00000000-0000-4000-8000-000000000001'`)).rows[0].status, 'duplicada');
assert.equal(await um('service_role', null, `select public.registrar_pagamento('00000000-0000-4000-8000-000000000001', 'p9', 'refunded', 4990, 'BRL')`), 'reembolsada');
assert.equal((await um('authenticated', B, 'select public.meu_status()')).tem_acesso, true); ok('segunda compra paga vira cobrança em dobro e o reembolso dela não tira o acesso');

// Isolamento entre clientes
assert.equal((await como('authenticated', B, 'select * from public.compras')).length, 3);
assert.equal((await como('authenticated', C, 'select * from public.compras')).length, 0); ok('cada cliente só vê as próprias compras');
await db.query(`insert into storage.objects (bucket_id, name) values ('app', 'planilha-segura.html')`);
assert.equal((await como('authenticated', B, `select * from storage.objects where bucket_id = 'app'`)).length, 1);
assert.equal((await como('authenticated', C, `select * from storage.objects where bucket_id = 'app'`)).length, 0);
assert.equal((await como('anon', null, `select * from storage.objects where bucket_id = 'app'`)).length, 0); ok('só quem tem acesso baixa o aplicativo');

// Reembolso
assert.equal(await um('service_role', null, `select public.registrar_pagamento($1, 'p2', 'refunded', 4990, 'BRL')`, [c2.compra_id]), 'reembolsada');
assert.equal((await um('authenticated', B, 'select public.meu_status()')).tem_acesso, false); ok('reembolso retira o acesso');

// Acesso manual
await falha(como('authenticated', A, `select public.admin_definir_acesso('ninguem@teste.local', true)`), /Nenhuma conta/);
await como('authenticated', A, `select public.admin_definir_acesso('CLIENTE@teste.local', true)`);
assert.equal((await um('authenticated', B, 'select public.meu_status()')).tem_acesso, true); ok('dono libera acesso manual pelo e-mail');
const resumo = await um('authenticated', A, 'select public.admin_resumo()');
assert.equal(resumo.pendencias, 3); // valor divergente + duas cobranças em dobro
assert.equal(resumo.config.dono_email, 'dono@teste.local');
assert.equal((await como('authenticated', A, 'select * from public.admin_listar_compras(50)')).length, 3); ok('painel mostra resumo e vendas');

// Transferência de propriedade
await falha(como('authenticated', A, `select public.admin_transferir_propriedade('invalido')`), /E-mail inválido/);
await como('authenticated', A, `select public.admin_transferir_propriedade('Novo.Dono@teste.local')`);
assert.equal((await um('authenticated', C, 'select public.meu_status()')).convite_propriedade, true);
assert.equal((await um('authenticated', A, 'select public.meu_status()')).eh_dono, true); ok('dono atual continua até o novo aceitar');
await db.query(`update public.configuracao set dono_pendente_expira = now() - interval '1 minute'`);
await falha(como('authenticated', C, 'select public.aceitar_propriedade()'), /Não há convite/); ok('convite vencido não vale');
await como('authenticated', A, `select public.admin_transferir_propriedade('novo.dono@teste.local')`);
await como('authenticated', C, 'select public.aceitar_propriedade()');
assert.equal((await um('authenticated', C, 'select public.meu_status()')).eh_dono, true);
assert.equal((await um('authenticated', A, 'select public.meu_status()')).eh_dono, false);
await falha(como('authenticated', A, 'select public.admin_resumo()'), /Apenas o dono/); ok('novo dono assume e o antigo perde o painel');
const ev = (await db.query(`select tipo from public.eventos order by id`)).rows.map(r => r.tipo);
assert.ok(ev.includes('propriedade_transferida') && ev.includes('pagamento_duplicado'));
assert.ok((await como('authenticated', C, 'select * from public.admin_listar_eventos(10)')).length > 0);
await falha(como('authenticated', B, 'select * from public.admin_listar_eventos(10)'), /Apenas o dono/); ok('tudo fica registrado no histórico, visível só para o dono');


// Perfil, presença, sessões e registro de acessos
const H = { 'x-forwarded-for': '200.1.2.3, 10.0.0.1', 'user-agent': 'Mozilla/5.0 Teste' };
await como('authenticated', B, 'select public.registrar_presenca()', [], H);
let pf = (await db.query('select * from public.perfis where user_id = $1', [B])).rows[0];
assert.equal(pf.nome, 'Cliente Teste'); assert.equal(pf.visto_ip, '200.1.2.3'); assert.equal(pf.visto_navegador, 'Mozilla/5.0 Teste'); ok('presença guarda IP e navegador do cabeçalho e o nome do cadastro');
await como('authenticated', B, `select public.registrar_acesso('login')`, [], H);
await como('authenticated', B, `select public.registrar_acesso('login')`, [], H);
await como('authenticated', B, `select public.registrar_acesso('invasao')`, [], H);
assert.equal((await db.query('select count(*)::int n from public.acessos_log where user_id = $1', [B])).rows[0].n, 1); ok('registro de acesso sem repetição e só com tipos válidos');
await falha(como('anon', null, 'select public.meu_perfil()'), /permission denied/); ok('anônimo não vê perfil');
await db.query(`insert into auth.sessions (user_id, user_agent, ip, refreshed_at) values ($1, 'Chrome no Windows', '200.1.2.3', now()), ($1, 'Safari no iPhone', '177.9.8.7', now())`, [B]);
let meu = await um('authenticated', B, 'select public.meu_perfil()');
assert.equal(meu.email, 'cliente@teste.local'); assert.equal(meu.nome, 'Cliente Teste'); assert.equal(meu.sessoes.length, 2);
assert.equal(meu.acessos.length, 1); assert.equal(meu.acesso.ativo, true); assert.equal(meu.compras.length, 3); assert.equal(meu.online, true); ok('meu perfil traz conta, acesso, compras, aparelhos logados e acessos');
await falha(como('authenticated', B, `select public.salvar_meu_perfil('', '', '', '', '', '')`), /Informe seu nome/);
await falha(como('authenticated', B, `select public.salvar_meu_perfil('Cliente', '', '', '123', '', '')`), /Telefone inválido/);
await falha(como('authenticated', B, `select public.salvar_meu_perfil('Cliente', '', '', '', '123', '')`), /CPF ou CNPJ inválido/);
await como('authenticated', B, `select public.salvar_meu_perfil('Cliente Silva', 'Empresa X', 'Gerente', '(11) 98765-4321', '529.982.247-25', 'São Paulo')`, [], H);
meu = await um('authenticated', B, 'select public.meu_perfil()');
assert.equal(meu.nome, 'Cliente Silva'); assert.equal(meu.empresa, 'Empresa X'); ok('perfil é validado e salvo');
assert.equal((await como('authenticated', A, 'select * from public.perfis')).length, 0); ok('ninguém lê o perfil dos outros');
await falha(como('authenticated', B, 'select * from public.admin_listar_usuarios()'), /Apenas o dono/);
const us = await como('authenticated', C, 'select * from public.admin_listar_usuarios()');
assert.equal(us.length, 3);
const ub = us.find(u => u.email === 'cliente@teste.local');
assert.equal(ub.online, true); assert.equal(ub.sessoes, 2); assert.equal(ub.tem_acesso, true); assert.equal(ub.nome, 'Cliente Silva');
assert.equal(us.find(u => u.email === 'novo.dono@teste.local').origem, 'dono');
assert.equal((await como('authenticated', C, `select * from public.admin_listar_usuarios('empresa x')`)).length, 1); ok('dono vê todos os usuários, quem está online e quantos aparelhos estão logados');
const det = await um('authenticated', C, 'select public.admin_detalhe_usuario($1)', [B]);
assert.equal(det.sessoes.length, 2); assert.ok(det.eventos.length > 0); ok('dono vê o detalhe de cada usuário');
const res2 = await um('authenticated', C, 'select public.admin_resumo()');
assert.equal(res2.usuarios, 3); assert.equal(res2.online_agora, 1); assert.equal(res2.logados, 1); assert.equal(res2.vendas_30d.length, 30); ok('resumo traz usuários, online, logados e vendas dos últimos 30 dias');
await falha(como('authenticated', C, 'select public.admin_encerrar_sessoes($1)', [C]), /Sair de todos/);
assert.equal((await um('authenticated', C, 'select public.admin_encerrar_sessoes($1)', [B])).encerradas, 2);
assert.equal((await um('authenticated', B, 'select public.meu_perfil()')).sessoes.length, 0); ok('dono desconecta os aparelhos de um usuário');
await falha(como('authenticated', C, `select public.excluir_minha_conta('EXCLUIR')`), /dono da loja não pode/);
await falha(como('authenticated', B, `select public.excluir_minha_conta('sim')`), /Digite EXCLUIR/);
await como('authenticated', B, `select public.excluir_minha_conta('EXCLUIR')`);
assert.equal((await db.query('select count(*)::int n from auth.users where id = $1', [B])).rows[0].n, 0);
const restantes = await como('authenticated', C, 'select * from public.admin_listar_compras(50)');
assert.equal(restantes.length, 3); assert.ok(restantes.every(r => /cliente@teste.local \(conta excluída\)/.test(r.email)));
assert.equal((await db.query('select count(*)::int n from public.acessos_log where user_id is null')).rows[0].n, 2); ok('conta excluída: dados pessoais apagados, compras e registro de acesso guardados sem vínculo');


// Pix direto (qualquer banco)
const D = await novo('pix@teste.local', true, 'Comprador Pix');
await falha(como('authenticated', D, 'select public.solicitar_pix()'), /não está disponível/); ok('Pix direto começa desligado');
await falha(como('authenticated', D, `select public.admin_salvar_pagamentos(true, true, 'chave errada', 'Loja', 'SP')`), /Apenas o dono/);
await falha(como('authenticated', C, `select public.admin_salvar_pagamentos(false, false, null, null, null)`), /pelo menos uma/);
await falha(como('authenticated', C, `select public.admin_salvar_pagamentos(true, true, null, null, null)`), /preencha a chave/);
await falha(como('authenticated', C, `select public.admin_salvar_pagamentos(true, true, 'abc', 'LOJA', 'SAO PAULO')`), /Chave Pix inválida/);
await falha(como('authenticated', C, `select public.admin_salvar_pagamentos(true, true, '52998224725', 'JOSÉ', 'SAO PAULO')`), /sem acentos/);
await como('authenticated', C, `select public.admin_salvar_pagamentos(false, true, '+5511987654321', 'LOJA TESTE', 'SAO PAULO')`);
pub = await um('anon', null, 'select public.config_publica()');
assert.equal(pub.aceita_pix, true); assert.equal(pub.aceita_mp, false); assert.equal(pub.pix.chave, '+5511987654321'); ok('dono configura Pix direto e a vitrine mostra a chave');
await falha(como('service_role', null, 'select public.criar_compra($1)', [D]), /vendas_fechadas/); ok('com Mercado Pago desligado não cria checkout');
const px = await um('authenticated', D, 'select public.solicitar_pix()');
assert.equal(px.valor_centavos, 4990); assert.equal(px.codigo.length, 10);
assert.equal((await um('authenticated', D, 'select public.solicitar_pix()')).compra_id, px.compra_id); ok('pedido de Pix reaproveita a mesma compra');
await falha(como('authenticated', A, 'select public.informar_pix($1)', [px.compra_id]), /Compra não encontrada/); ok('ninguém informa Pix da compra dos outros');
await como('authenticated', D, 'select public.informar_pix($1)', [px.compra_id]);
assert.equal((await um('authenticated', D, 'select public.meu_status()')).tem_acesso, false); ok('avisar que pagou não libera sozinho');
let r3 = await um('authenticated', C, 'select public.admin_resumo()');
assert.equal(r3.pix_aguardando, 1);
const lc = (await como('authenticated', C, 'select * from public.admin_listar_compras(50)')).find(c => c.id === px.compra_id);
assert.equal(lc.metodo, 'pix_manual'); assert.equal(lc.codigo, px.codigo); assert.ok(lc.pix_informado_em); ok('painel mostra o Pix aguardando confirmação com o código');
await falha(como('authenticated', D, 'select public.admin_confirmar_pix($1, true)', [px.compra_id]), /Apenas o dono/);
await como('authenticated', C, 'select public.admin_confirmar_pix($1, true)', [px.compra_id]);
assert.equal((await um('authenticated', D, 'select public.meu_status()')).tem_acesso, true);
await falha(como('authenticated', C, 'select public.admin_confirmar_pix($1, false)', [px.compra_id]), /já foi resolvida/); ok('dono confirma o Pix e o acesso é liberado');
await falha(como('authenticated', D, 'select public.solicitar_pix()'), /já tem acesso/);
assert.equal((await um('authenticated', C, 'select public.admin_resumo()')).pix_aguardando, 0); ok('quem já tem acesso não paga de novo por Pix');

console.log(`banco: ${n} verificações OK`);
