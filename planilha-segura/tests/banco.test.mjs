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
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz);
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

async function como(papel, uid, sql, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${papel}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || '']);
    const r = await db.query(sql, params);
    await db.exec('commit');
    return r.rows;
  } catch (e) { await db.exec('rollback'); throw e; }
}
const um = async (...a) => Object.values((await como(...a))[0])[0];
const falha = async (p, re) => { await assert.rejects(p, re); };
let n = 0; const ok = m => { n++; console.log('  ✓ ' + m); };

const novo = async (email, confirmado = true) =>
  (await db.query(`insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id`, [email, confirmado ? new Date() : null])).rows[0].id;
const A = await novo('dono@teste.local', false), B = await novo('cliente@teste.local'), C = await novo('novo.dono@teste.local');

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

// Isolamento entre clientes
assert.equal((await como('authenticated', B, 'select * from public.compras')).length, 2);
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
assert.equal(resumo.pendencias, 2); // valor divergente + cobrança em dobro assert.equal(resumo.config.dono_email, 'dono@teste.local');
assert.equal((await como('authenticated', A, 'select * from public.admin_listar_compras(50)')).length, 2); ok('painel mostra resumo e vendas');

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

console.log(`banco: ${n} verificações OK`);
