-- Planilha Segura: banco de dados da loja (pagamento único + dono transferível)
--
-- Como aplicar: no painel do Supabase, abra SQL Editor, cole este arquivo inteiro e clique em Run.
-- Pode ser executado de novo sem perder dados.
--
-- Regras de segurança:
--   * Todas as tabelas têm RLS ligado. O navegador só lê as próprias compras e o próprio acesso.
--   * Nada é gravado direto pelo navegador: toda alteração passa por funções que conferem quem chamou.
--   * Funções de pagamento só podem ser chamadas pelo servidor (service_role).


-- ---------------------------------------------------------------- tabelas

create table if not exists public.configuracao (
  id                   boolean primary key default true check (id),
  nome_produto         text not null default 'Planilha Segura' check (char_length(nome_produto) between 1 and 80),
  descricao            text not null default '' check (char_length(descricao) <= 500),
  preco_centavos       integer check (preco_centavos between 100 and 10000000),
  vendas_abertas       boolean not null default false,
  email_suporte        text check (email_suporte is null or email_suporte ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  dono_id              uuid references auth.users (id) on delete set null,
  dono_pendente_email  text,
  dono_pendente_expira timestamptz,
  atualizado_em        timestamptz not null default now(),
  constraint vendas_exigem_preco check (not vendas_abertas or preco_centavos is not null)
);
insert into public.configuracao (id) values (true) on conflict (id) do nothing;
-- Formas de pagamento: Mercado Pago (Pix, cartão e boleto, liberação automática) e/ou Pix direto
-- para a chave do dono (qualquer banco, sem taxa, liberação confirmada pelo dono no painel).
alter table public.configuracao add column if not exists aceita_mp  boolean not null default true;
alter table public.configuracao add column if not exists aceita_pix boolean not null default false;
alter table public.configuracao add column if not exists pix_chave  text check (pix_chave is null or char_length(pix_chave) between 5 and 77);
alter table public.configuracao add column if not exists pix_nome   text check (pix_nome is null or char_length(pix_nome) between 2 and 25);
alter table public.configuracao add column if not exists pix_cidade text check (pix_cidade is null or char_length(pix_cidade) between 2 and 15);

create table if not exists public.compras (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete set null,
  email_comprador text,
  valor_centavos integer not null check (valor_centavos > 0),
  status         text not null default 'pendente'
                 check (status in ('pendente', 'aprovada', 'recusada', 'cancelada', 'reembolsada', 'contestada', 'divergente', 'duplicada')),
  mp_payment_id  text unique,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists compras_user_idx on public.compras (user_id, criado_em desc);
-- Atualização de instalações antigas: a compra fica registrada (obrigação fiscal) mesmo se a conta for excluída.
alter table public.compras add column if not exists email_comprador text;
alter table public.compras alter column user_id drop not null;
alter table public.compras drop constraint if exists compras_user_id_fkey;
alter table public.compras add constraint compras_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
update public.compras c set email_comprador = u.email from auth.users u where u.id = c.user_id and c.email_comprador is null;
alter table public.compras add column if not exists metodo text not null default 'mercadopago';
alter table public.compras drop constraint if exists compras_metodo_check;
alter table public.compras add constraint compras_metodo_check check (metodo in ('mercadopago', 'pix_manual'));
alter table public.compras add column if not exists pix_informado_em timestamptz;
alter table public.compras drop constraint if exists compras_status_check;
alter table public.compras add constraint compras_status_check
  check (status in ('pendente', 'aprovada', 'recusada', 'cancelada', 'reembolsada', 'contestada', 'divergente', 'duplicada'));

create table if not exists public.acessos (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  ativo         boolean not null default true,
  origem        text not null check (origem in ('compra', 'manual')),
  compra_id     uuid references public.compras (id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.eventos (
  id      bigserial primary key,
  quando  timestamptz not null default now(),
  tipo    text not null,
  user_id uuid,
  detalhe jsonb not null default '{}'::jsonb
);

alter table public.configuracao enable row level security;
alter table public.compras      enable row level security;
alter table public.acessos      enable row level security;
alter table public.eventos      enable row level security;

-- O navegador nunca escreve direto nas tabelas.
revoke all on public.configuracao, public.compras, public.acessos, public.eventos from anon, authenticated;
grant select on public.compras, public.acessos to authenticated;

drop policy if exists "ver as próprias compras" on public.compras;
create policy "ver as próprias compras" on public.compras
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "ver o próprio acesso" on public.acessos;
create policy "ver o próprio acesso" on public.acessos
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- funções internas

create or replace function public.eh_dono()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and exists (select 1 from public.configuracao c where c.dono_id = auth.uid());
$$;

create or replace function public.tem_acesso(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and (
    exists (select 1 from public.configuracao c where c.dono_id = p_user)
    or exists (select 1 from public.acessos a where a.user_id = p_user and a.ativo)
  );
$$;

create or replace function public._registrar_evento(p_tipo text, p_user uuid, p_detalhe jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.eventos (tipo, user_id, detalhe) values (p_tipo, p_user, coalesce(p_detalhe, '{}'::jsonb));
$$;

create or replace function public._exigir_dono()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.eh_dono() then
    raise exception 'Apenas o dono da loja pode fazer isso.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._email_de(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text from auth.users u where u.id = p_user;
$$;

-- ---------------------------------------------------------------- funções públicas

-- Dados da vitrine (nome, preço). Pode ser lida sem login.
create or replace function public.config_publica()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nome_produto',   c.nome_produto,
    'descricao',      c.descricao,
    'preco_centavos', c.preco_centavos,
    'vendas_abertas', c.vendas_abertas and c.preco_centavos is not null,
    'email_suporte',  c.email_suporte,
    'tem_dono',       c.dono_id is not null,
    'aceita_mp',      c.aceita_mp,
    'aceita_pix',     c.aceita_pix and c.pix_chave is not null,
    'pix', case when c.aceita_pix and c.pix_chave is not null
                then jsonb_build_object('chave', c.pix_chave, 'nome', c.pix_nome, 'cidade', c.pix_cidade) end
  ) from public.configuracao c;
$$;

-- Situação de quem está logado.
create or replace function public.meu_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_conf  public.configuracao;
begin
  if v_uid is null then
    return jsonb_build_object('logado', false);
  end if;
  select u.email::text into v_email from auth.users u where u.id = v_uid;
  select * into v_conf from public.configuracao;
  return jsonb_build_object(
    'logado',     true,
    'email',      v_email,
    'tem_acesso', public.tem_acesso(v_uid),
    'eh_dono',    coalesce(v_conf.dono_id = v_uid, false),
    'convite_propriedade',
      v_conf.dono_pendente_email is not null
      and lower(v_conf.dono_pendente_email) = lower(v_email)
      and v_conf.dono_pendente_expira > now()
      and coalesce(v_conf.dono_id <> v_uid, true)
  );
end;
$$;

-- Aceitar a propriedade da loja (o e-mail precisa ter sido indicado pelo dono atual).
create or replace function public.aceitar_propriedade()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_user auth.users;
  v_conf public.configuracao;
  v_antigo uuid;
begin
  if v_uid is null then raise exception 'Entre na sua conta primeiro.' using errcode = '42501'; end if;
  select * into v_user from auth.users where id = v_uid;
  select * into v_conf from public.configuracao for update;
  if v_conf.dono_pendente_email is null
     or lower(v_conf.dono_pendente_email) <> lower(v_user.email)
     or v_conf.dono_pendente_expira <= now() then
    raise exception 'Não há convite de propriedade válido para este e-mail.' using errcode = '42501';
  end if;
  if v_user.email_confirmed_at is null then
    raise exception 'Confirme seu e-mail antes de assumir a loja.' using errcode = '42501';
  end if;
  v_antigo := v_conf.dono_id;
  update public.configuracao
     set dono_id = v_uid, dono_pendente_email = null, dono_pendente_expira = null, atualizado_em = now();
  perform public._registrar_evento('propriedade_transferida', v_uid,
    jsonb_build_object('de', public._email_de(v_antigo), 'para', v_user.email));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- painel do dono

create or replace function public.admin_resumo()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._exigir_dono();
  select jsonb_build_object(
    'vendas_aprovadas', (select count(*) from public.compras where status = 'aprovada'),
    'receita_centavos', (select coalesce(sum(valor_centavos), 0) from public.compras where status = 'aprovada'),
    'acessos_ativos',   (select count(*) from public.acessos where ativo),
    'pix_aguardando',   (select count(*) from public.compras where metodo = 'pix_manual' and status = 'pendente' and pix_informado_em is not null),
    'pendencias',       (select count(*) from public.compras where status in ('divergente', 'contestada'))
                      + (select count(*) from public.compras where metodo = 'pix_manual' and status = 'pendente' and pix_informado_em is not null)
                      + (select count(*) from public.eventos where tipo = 'pagamento_duplicado' and quando > now() - interval '30 days'),
    'usuarios',         (select count(*) from auth.users),
    'novos_7d',         (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'online_agora',     (select count(*) from public.perfis where visto_em > now() - interval '2 minutes'),
    'logados',          public._qtd_logados(),
    'vendas_30d', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'vendas', coalesce(x.n, 0), 'centavos', coalesce(x.c, 0)) order by d.dia), '[]'::jsonb)
                     from generate_series((now() at time zone 'America/Sao_Paulo')::date - 29, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') as d(dia)
                     left join (select (criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) n, sum(valor_centavos) c
                                  from public.compras where status = 'aprovada' group by 1) x on x.dia = d.dia::date),
    'config', (select jsonb_build_object(
                 'nome_produto', c.nome_produto, 'descricao', c.descricao, 'preco_centavos', c.preco_centavos,
                 'vendas_abertas', c.vendas_abertas, 'email_suporte', c.email_suporte,
                 'dono_email', public._email_de(c.dono_id),
                 'dono_pendente_email', c.dono_pendente_email, 'dono_pendente_expira', c.dono_pendente_expira,
                 'aceita_mp', c.aceita_mp, 'aceita_pix', c.aceita_pix, 'pix_chave', c.pix_chave, 'pix_nome', c.pix_nome, 'pix_cidade', c.pix_cidade)
               from public.configuracao c)
  ) into v;
  return v;
end;
$$;

drop function if exists public.admin_listar_compras(integer);
create or replace function public.admin_listar_compras(p_limite integer default 200)
returns table (id uuid, email text, valor_centavos integer, status text, mp_payment_id text, criado_em timestamptz, metodo text, pix_informado_em timestamptz, codigo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_dono();
  return query
    select c.id, coalesce(u.email::text, c.email_comprador || ' (conta excluída)', '(conta excluída)'), c.valor_centavos, c.status, c.mp_payment_id, c.criado_em,
           c.metodo, c.pix_informado_em, public._codigo_compra(c.id)
      from public.compras c left join auth.users u on u.id = c.user_id
     where c.status <> 'pendente' or c.criado_em > now() - interval '2 days' or c.pix_informado_em is not null
     order by c.criado_em desc
     limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end;
$$;

create or replace function public.admin_listar_acessos()
returns table (email text, ativo boolean, origem text, atualizado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_dono();
  return query
    select u.email::text, a.ativo, a.origem, a.atualizado_em
      from public.acessos a join auth.users u on u.id = a.user_id
     order by a.atualizado_em desc
     limit 2000;
end;
$$;

create or replace function public.admin_listar_eventos(p_limite integer default 100)
returns table (quando timestamptz, tipo text, email text, detalhe jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_dono();
  return query
    select e.quando, e.tipo, u.email::text, e.detalhe
      from public.eventos e left join auth.users u on u.id = e.user_id
     order by e.id desc
     limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$$;

-- Libera ou bloqueia o acesso de alguém pelo e-mail (a pessoa precisa ter criado a conta).
create or replace function public.admin_definir_acesso(p_email text, p_ativo boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  perform public._exigir_dono();
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Nenhuma conta com este e-mail. Peça para a pessoa criar a conta primeiro.';
  end if;
  insert into public.acessos (user_id, ativo, origem)
  values (v_user, coalesce(p_ativo, false), 'manual')
  on conflict (user_id) do update
    set ativo = excluded.ativo,
        origem = case when excluded.ativo then 'manual' else public.acessos.origem end,
        atualizado_em = now();
  perform public._registrar_evento(case when p_ativo then 'acesso_liberado' else 'acesso_bloqueado' end,
                                   v_user, jsonb_build_object('por', public._email_de(auth.uid())));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_salvar_config(
  p_nome_produto text, p_descricao text, p_preco_centavos integer, p_vendas_abertas boolean, p_email_suporte text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public._exigir_dono();
  if coalesce(p_vendas_abertas, false) and p_preco_centavos is null then
    raise exception 'Defina o preço antes de abrir as vendas.';
  end if;
  update public.configuracao
     set nome_produto   = left(trim(coalesce(nullif(trim(p_nome_produto), ''), 'Planilha Segura')), 80),
         descricao      = left(trim(coalesce(p_descricao, '')), 500),
         preco_centavos = p_preco_centavos,
         vendas_abertas = coalesce(p_vendas_abertas, false),
         email_suporte  = nullif(trim(coalesce(p_email_suporte, '')), ''),
         atualizado_em  = now();
  perform public._registrar_evento('config_alterada', auth.uid(),
    jsonb_build_object('preco_centavos', p_preco_centavos, 'vendas_abertas', p_vendas_abertas));
  return jsonb_build_object('ok', true);
end;
$$;

-- Indica o novo dono. A troca só acontece quando ele entrar com este e-mail e aceitar (prazo de 7 dias).
create or replace function public.admin_transferir_propriedade(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  perform public._exigir_dono();
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if v_email = lower(public._email_de(auth.uid())) then raise exception 'Este já é o seu e-mail.'; end if;
  update public.configuracao
     set dono_pendente_email = v_email, dono_pendente_expira = now() + interval '7 days', atualizado_em = now();
  perform public._registrar_evento('transferencia_iniciada', auth.uid(), jsonb_build_object('para', v_email));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_cancelar_transferencia()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public._exigir_dono();
  update public.configuracao set dono_pendente_email = null, dono_pendente_expira = null, atualizado_em = now();
  perform public._registrar_evento('transferencia_cancelada', auth.uid(), '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- uso exclusivo do servidor

-- Chamada pela função criar-pagamento depois de confirmar quem é o usuário.
create or replace function public.criar_compra(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_conf   public.configuracao;
  v_compra uuid;
begin
  select * into v_conf from public.configuracao;
  if not v_conf.vendas_abertas or v_conf.preco_centavos is null or not v_conf.aceita_mp then
    raise exception 'vendas_fechadas';
  end if;
  if public.tem_acesso(p_user) then
    raise exception 'ja_tem_acesso';
  end if;
  if (select count(*) from public.compras
       where user_id = p_user and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'muitas_tentativas';
  end if;
  insert into public.compras (user_id, email_comprador, valor_centavos) values (p_user, public._email_de(p_user), v_conf.preco_centavos)
  returning id into v_compra;
  return jsonb_build_object('compra_id', v_compra, 'valor_centavos', v_conf.preco_centavos,
                            'nome_produto', v_conf.nome_produto, 'email', public._email_de(p_user));
end;
$$;

-- Chamada pelo webhook com o status real consultado no Mercado Pago.
create or replace function public.registrar_pagamento(
  p_compra uuid, p_payment_id text, p_status_mp text, p_valor_centavos integer, p_moeda text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_compra public.compras;
  v_status text;
begin
  select * into v_compra from public.compras where id = p_compra for update;
  if not found then return 'compra_inexistente'; end if;

  v_status := case p_status_mp
    when 'approved'     then 'aprovada'
    when 'rejected'     then 'recusada'
    when 'cancelled'    then 'cancelada'
    when 'refunded'     then 'reembolsada'
    when 'charged_back' then 'contestada'
    else 'pendente' end;

  -- Outro pagamento para uma compra já aprovada: não rebaixa o acesso; avisa se for cobrança em dobro.
  if v_compra.status = 'aprovada' and v_compra.mp_payment_id is distinct from p_payment_id then
    if v_status = 'aprovada' then
      perform public._registrar_evento('pagamento_duplicado', v_compra.user_id,
        jsonb_build_object('compra', p_compra, 'payment_id', p_payment_id));
      return 'duplicado';
    end if;
    return 'ignorado';
  end if;

  -- Mesma pessoa pagou duas compras diferentes (ex.: abriu o pagamento em duas abas): a segunda é cobrança
  -- em dobro. O acesso continua pela primeira e o servidor devolve o dinheiro da segunda automaticamente.
  if v_status = 'aprovada' and v_compra.user_id is not null and exists (
       select 1 from public.acessos a join public.compras c on c.id = a.compra_id
        where a.user_id = v_compra.user_id and a.ativo and a.origem = 'compra' and a.compra_id <> p_compra and c.status = 'aprovada') then
    update public.compras set status = 'duplicada', mp_payment_id = p_payment_id, atualizado_em = now() where id = p_compra;
    perform public._registrar_evento('pagamento_duplicado', v_compra.user_id,
      jsonb_build_object('compra', p_compra, 'payment_id', p_payment_id));
    return 'duplicado';
  end if;

  -- O valor pago tem de ser exatamente o preço registrado na compra.
  if v_status = 'aprovada' and (p_moeda is distinct from 'BRL' or p_valor_centavos is distinct from v_compra.valor_centavos) then
    v_status := 'divergente';
  end if;

  update public.compras
     set status = v_status, mp_payment_id = p_payment_id, atualizado_em = now()
   where id = p_compra;

  if v_compra.user_id is null then
    null; -- conta excluída: só registra a situação da compra
  elsif v_status = 'aprovada' then
    insert into public.acessos (user_id, ativo, origem, compra_id)
    values (v_compra.user_id, true, 'compra', p_compra)
    on conflict (user_id) do update
      set ativo = true, origem = 'compra', compra_id = excluded.compra_id, atualizado_em = now();
  elsif v_status in ('reembolsada', 'contestada') then
    update public.acessos
       set ativo = false, atualizado_em = now()
     where user_id = v_compra.user_id and origem = 'compra' and compra_id = p_compra;
  end if;

  if v_status <> v_compra.status then
    perform public._registrar_evento('compra_' || v_status, v_compra.user_id,
      jsonb_build_object('compra', p_compra, 'payment_id', p_payment_id, 'valor_centavos', p_valor_centavos));
  end if;
  return v_status;
end;
$$;

-- Compras ainda pendentes de um usuário: usada para conferir no Mercado Pago quando o aviso automático não chegou.
create or replace function public.compras_pendentes(p_user uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.compras
   where user_id = p_user and status = 'pendente' and metodo = 'mercadopago' and criado_em > now() - interval '30 days'
   order by criado_em desc limit 5;
$$;

-- Primeiro dono, ou recuperação se o dono perder a conta. Só funciona pelo SQL Editor do Supabase.
create or replace function public.definir_dono_pelo_sql(p_email text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  update public.configuracao
     set dono_pendente_email = lower(trim(p_email)),
         dono_pendente_expira = now() + interval '7 days',
         atualizado_em = now();
  perform public._registrar_evento('dono_indicado_pelo_sql', null, jsonb_build_object('para', lower(trim(p_email))));
  return 'Pronto. Entre no site com ' || lower(trim(p_email)) || ' e clique em "Assumir a loja" em até 7 dias.';
end;
$$;


-- ---------------------------------------------------------------- perfis, presença e acessos

create table if not exists public.perfis (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  nome          text check (char_length(nome) <= 120),
  empresa       text check (char_length(empresa) <= 120),
  cargo         text check (char_length(cargo) <= 80),
  telefone      text check (char_length(telefone) <= 30),
  documento     text check (char_length(documento) <= 20),
  cidade        text check (char_length(cidade) <= 80),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  visto_em      timestamptz,
  visto_ip      text,
  visto_navegador text
);
create index if not exists perfis_visto_idx on public.perfis (visto_em desc);

-- Registro de acessos (Marco Civil da Internet, art. 15: guardar data, hora e IP por 6 meses).
-- Se a conta for excluída, o registro fica sem vínculo com a pessoa.
create table if not exists public.acessos_log (
  id        bigserial primary key,
  user_id   uuid references auth.users (id) on delete set null,
  quando    timestamptz not null default now(),
  tipo      text not null check (tipo in ('login', 'app', 'perfil', 'senha', 'saida')),
  ip        text,
  navegador text
);
create index if not exists acessos_log_user_idx on public.acessos_log (user_id, quando desc);
create index if not exists acessos_log_quando_idx on public.acessos_log (quando);

alter table public.perfis      enable row level security;
alter table public.acessos_log enable row level security;
revoke all on public.perfis, public.acessos_log from anon, authenticated;
grant select on public.perfis, public.acessos_log to authenticated;
drop policy if exists "ver o próprio perfil" on public.perfis;
create policy "ver o próprio perfil" on public.perfis for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "ver os próprios acessos" on public.acessos_log;
create policy "ver os próprios acessos" on public.acessos_log for select to authenticated using (user_id = (select auth.uid()));

-- Cabeçalhos da requisição (o Supabase repassa IP e navegador de quem chamou).
create or replace function public._cabecalho(p_nome text)
returns text language sql stable security definer set search_path = '' as $$
  select nullif(left(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> p_nome, 400), '');
$$;
create or replace function public._ip()
returns text language sql stable security definer set search_path = '' as $$
  select left(trim(coalesce(public._cabecalho('cf-connecting-ip'), split_part(public._cabecalho('x-forwarded-for'), ',', 1), public._cabecalho('x-real-ip'))), 64);
$$;

-- Sessões abertas de um usuário (aparelhos logados). Lidas da tabela interna do Supabase Auth.
create or replace function public._sessoes(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.j ->> 'id',
           'criada_em', x.j ->> 'created_at',
           'ultimo_uso', coalesce(x.j ->> 'refreshed_at', x.j ->> 'updated_at', x.j ->> 'created_at'),
           'ip', x.j ->> 'ip',
           'navegador', left(x.j ->> 'user_agent', 400))
         order by coalesce(x.j ->> 'refreshed_at', x.j ->> 'updated_at', x.j ->> 'created_at') desc), '[]'::jsonb)
    into v
    from (select to_jsonb(s) as j from auth.sessions s
           where s.user_id = p_user and (s.not_after is null or s.not_after > now())) x;
  return v;
exception when others then
  return '[]'::jsonb;
end;
$$;
create or replace function public._qtd_logados()
returns integer language plpgsql stable security definer set search_path = '' as $$
declare n integer;
begin
  select count(distinct s.user_id) into n from auth.sessions s where s.not_after is null or s.not_after > now();
  return n;
exception when others then
  return null;
end;
$$;

-- Chamada pelo site a cada minuto enquanto a página está aberta: alimenta o "online agora".
create or replace function public.registrar_presenca()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  insert into public.perfis (user_id, nome, visto_em, visto_ip, visto_navegador)
  select v_uid, left(nullif(trim(u.raw_user_meta_data ->> 'nome'), ''), 120), now(), public._ip(), public._cabecalho('user-agent')
    from auth.users u where u.id = v_uid
  on conflict (user_id) do update
    set visto_em = now(), visto_ip = excluded.visto_ip, visto_navegador = excluded.visto_navegador
    where public.perfis.visto_em is null or public.perfis.visto_em < now() - interval '20 seconds';
end;
$$;

-- Registra um acesso (login, abertura do aplicativo, alteração de perfil ou senha).
create or replace function public.registrar_acesso(p_tipo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or p_tipo not in ('login', 'app', 'perfil', 'senha', 'saida') then return; end if;
  perform public.registrar_presenca();
  if exists (select 1 from public.acessos_log where user_id = v_uid and tipo = p_tipo and quando > now() - interval '2 minutes') then return; end if;
  insert into public.acessos_log (user_id, tipo, ip, navegador) values (v_uid, p_tipo, public._ip(), public._cabecalho('user-agent'));
  -- limpeza ocasional: guarda 13 meses (o mínimo legal é 6)
  if random() < 0.01 then delete from public.acessos_log where quando < now() - interval '13 months'; end if;
end;
$$;

create or replace function public._perfil_completo(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user auth.users;
  v_perf public.perfis;
  v_ac   public.acessos;
  v_conf public.configuracao;
begin
  select * into v_user from auth.users where id = p_user;
  if not found then return null; end if;
  select * into v_perf from public.perfis where user_id = p_user;
  select * into v_ac from public.acessos where user_id = p_user;
  select * into v_conf from public.configuracao;
  return jsonb_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'email_confirmado', v_user.email_confirmed_at is not null,
    'conta_criada_em', v_user.created_at,
    'ultimo_login', v_user.last_sign_in_at,
    'nome', coalesce(v_perf.nome, nullif(trim(v_user.raw_user_meta_data ->> 'nome'), '')),
    'empresa', v_perf.empresa, 'cargo', v_perf.cargo, 'telefone', v_perf.telefone,
    'documento', v_perf.documento, 'cidade', v_perf.cidade,
    'visto_em', v_perf.visto_em, 'online', coalesce(v_perf.visto_em > now() - interval '2 minutes', false),
    'eh_dono', v_conf.dono_id = p_user,
    'acesso', case when v_conf.dono_id = p_user then jsonb_build_object('ativo', true, 'origem', 'dono')
                   when v_ac.user_id is not null then jsonb_build_object('ativo', v_ac.ativo, 'origem', v_ac.origem, 'desde', v_ac.atualizado_em)
                   else jsonb_build_object('ativo', false) end,
    'compras', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'valor_centavos', c.valor_centavos, 'status', c.status, 'metodo', c.metodo, 'codigo', public._codigo_compra(c.id),
                  'mp_payment_id', c.mp_payment_id, 'criado_em', c.criado_em) order by c.criado_em desc), '[]'::jsonb)
                from public.compras c where c.user_id = p_user and (c.status <> 'pendente' or c.criado_em > now() - interval '2 days')),
    'sessoes', public._sessoes(p_user),
    'acessos', (select coalesce(jsonb_agg(jsonb_build_object('quando', a.quando, 'tipo', a.tipo, 'ip', a.ip, 'navegador', a.navegador) order by a.quando desc), '[]'::jsonb)
                from (select * from public.acessos_log where user_id = p_user order by quando desc limit 30) a)
  );
end;
$$;

create or replace function public.meu_perfil()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta primeiro.' using errcode = '42501'; end if;
  return public._perfil_completo(auth.uid());
end;
$$;

create or replace function public.salvar_meu_perfil(
  p_nome text, p_empresa text, p_cargo text, p_telefone text, p_documento text, p_cidade text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_doc text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
begin
  if v_uid is null then raise exception 'Entre na sua conta primeiro.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe seu nome.'; end if;
  if v_tel <> '' and char_length(v_tel) not between 10 and 13 then raise exception 'Telefone inválido. Use DDD + número.'; end if;
  if v_doc <> '' and char_length(v_doc) not in (11, 14) then raise exception 'CPF ou CNPJ inválido.'; end if;
  insert into public.perfis (user_id, nome, empresa, cargo, telefone, documento, cidade, atualizado_em)
  values (v_uid, left(trim(p_nome), 120), nullif(left(trim(coalesce(p_empresa, '')), 120), ''), nullif(left(trim(coalesce(p_cargo, '')), 80), ''),
          nullif(left(trim(coalesce(p_telefone, '')), 30), ''), nullif(left(trim(coalesce(p_documento, '')), 20), ''), nullif(left(trim(coalesce(p_cidade, '')), 80), ''), now())
  on conflict (user_id) do update
    set nome = excluded.nome, empresa = excluded.empresa, cargo = excluded.cargo, telefone = excluded.telefone,
        documento = excluded.documento, cidade = excluded.cidade, atualizado_em = now();
  perform public.registrar_acesso('perfil');
  return jsonb_build_object('ok', true);
end;
$$;

-- Exclusão da conta pela própria pessoa (LGPD, art. 18). As compras ficam guardadas sem vínculo (obrigação fiscal).
create or replace function public.excluir_minha_conta(p_confirmacao text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Entre na sua conta primeiro.' using errcode = '42501'; end if;
  if p_confirmacao is distinct from 'EXCLUIR' then raise exception 'Digite EXCLUIR para confirmar.'; end if;
  if exists (select 1 from public.configuracao where dono_id = v_uid) then
    raise exception 'O dono da loja não pode excluir a conta. Passe a loja para outra pessoa primeiro.';
  end if;
  begin
    delete from auth.users where id = v_uid;
  exception when others then
    raise exception 'Não foi possível excluir a conta automaticamente. Peça a exclusão pelo e-mail de suporte.';
  end;
  perform public._registrar_evento('conta_excluida', v_uid, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

-- Painel do dono: todos os usuários, quem está online e quem está logado.
create or replace function public.admin_listar_usuarios(p_busca text default null, p_limite integer default 500)
returns table (user_id uuid, email text, nome text, empresa text, telefone text, criado_em timestamptz, ultimo_login timestamptz,
               visto_em timestamptz, online boolean, sessoes integer, tem_acesso boolean, origem text, eh_dono boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_busca text := lower(trim(coalesce(p_busca, '')));
begin
  perform public._exigir_dono();
  return query
    select u.id, u.email::text, coalesce(p.nome, nullif(trim(u.raw_user_meta_data ->> 'nome'), '')), p.empresa, p.telefone,
           u.created_at, u.last_sign_in_at, p.visto_em, coalesce(p.visto_em > now() - interval '2 minutes', false),
           jsonb_array_length(public._sessoes(u.id)),
           public.tem_acesso(u.id),
           case when c.dono_id = u.id then 'dono' else a.origem end,
           coalesce(c.dono_id = u.id, false)
      from auth.users u
      left join public.perfis p on p.user_id = u.id
      left join public.acessos a on a.user_id = u.id
      cross join public.configuracao c
     where v_busca = '' or lower(u.email) like '%' || v_busca || '%' or lower(coalesce(p.nome, '')) like '%' || v_busca || '%'
           or lower(coalesce(p.empresa, '')) like '%' || v_busca || '%'
     order by coalesce(p.visto_em, u.last_sign_in_at, u.created_at) desc nulls last
     limit least(greatest(coalesce(p_limite, 500), 1), 2000);
end;
$$;

create or replace function public.admin_detalhe_usuario(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._exigir_dono();
  v := public._perfil_completo(p_user);
  if v is null then raise exception 'Usuário não encontrado.'; end if;
  return v || jsonb_build_object('eventos', (select coalesce(jsonb_agg(jsonb_build_object('quando', e.quando, 'tipo', e.tipo, 'detalhe', e.detalhe) order by e.quando desc), '[]'::jsonb)
                                             from (select * from public.eventos where user_id = p_user order by id desc limit 50) e));
end;
$$;

-- Desconecta todos os aparelhos de um usuário (vale a partir da próxima renovação da sessão, em até 1 hora).
create or replace function public.admin_encerrar_sessoes(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform public._exigir_dono();
  if p_user = auth.uid() then raise exception 'Para sair dos seus aparelhos, use “Sair de todos os aparelhos” no seu perfil.'; end if;
  begin
    delete from auth.sessions where user_id = p_user;
    get diagnostics n = row_count;
  exception when others then
    raise exception 'O banco não permitiu encerrar as sessões. No Supabase, use Authentication > Users > (usuário) > Sign out.';
  end;
  perform public._registrar_evento('sessoes_encerradas', p_user, jsonb_build_object('por', public._email_de(auth.uid()), 'quantidade', n));
  return jsonb_build_object('ok', true, 'encerradas', n);
end;
$$;


-- ---------------------------------------------------------------- Pix direto (qualquer banco)

-- Código curto que o comprador vê e que vai na identificação do Pix (ajuda o dono a conferir no extrato).
create or replace function public._codigo_compra(p_id uuid)
returns text language sql immutable set search_path = '' as $$
  select upper(left(replace(p_id::text, '-', ''), 10));
$$;

-- O dono define as formas de pagamento.
create or replace function public.admin_salvar_pagamentos(
  p_aceita_mp boolean, p_aceita_pix boolean, p_pix_chave text, p_pix_nome text, p_pix_cidade text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_chave text := nullif(trim(coalesce(p_pix_chave, '')), '');
  v_nome  text := nullif(trim(coalesce(p_pix_nome, '')), '');
  v_cid   text := nullif(trim(coalesce(p_pix_cidade, '')), '');
begin
  perform public._exigir_dono();
  if not coalesce(p_aceita_mp, false) and not coalesce(p_aceita_pix, false) then
    raise exception 'Escolha pelo menos uma forma de pagamento.';
  end if;
  if coalesce(p_aceita_pix, false) then
    if v_chave is null or v_nome is null or v_cid is null then raise exception 'Para aceitar Pix direto, preencha a chave Pix, o nome e a cidade do recebedor.'; end if;
    if v_chave !~ '^(\d{11}|\d{14}|\+55\d{10,11}|[^@\s]+@[^@\s]+\.[^@\s]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$' then
      raise exception 'Chave Pix inválida. Use CPF ou CNPJ só com números, e-mail, telefone no formato +5511999998888 ou chave aleatória.';
    end if;
    if v_chave ~ '[^\x20-\x7E]' or v_nome ~ '[^\x20-\x7E]' or v_cid ~ '[^\x20-\x7E]' then
      raise exception 'Use a chave, o nome e a cidade sem acentos.';
    end if;
  end if;
  update public.configuracao
     set aceita_mp = coalesce(p_aceita_mp, false), aceita_pix = coalesce(p_aceita_pix, false),
         pix_chave = v_chave, pix_nome = left(v_nome, 25), pix_cidade = left(v_cid, 15), atualizado_em = now();
  perform public._registrar_evento('pagamentos_alterados', auth.uid(),
    jsonb_build_object('mercadopago', coalesce(p_aceita_mp, false), 'pix', coalesce(p_aceita_pix, false)));
  return jsonb_build_object('ok', true);
end;
$$;

-- O comprador pede para pagar por Pix direto: cria (ou reaproveita) a compra pendente com o preço atual.
create or replace function public.solicitar_pix()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_conf public.configuracao;
  v_c    public.compras;
begin
  if v_uid is null then raise exception 'Entre na sua conta primeiro.' using errcode = '42501'; end if;
  select * into v_conf from public.configuracao;
  if not v_conf.vendas_abertas or v_conf.preco_centavos is null or not v_conf.aceita_pix or v_conf.pix_chave is null then
    raise exception 'O pagamento por Pix direto não está disponível no momento.';
  end if;
  if public.tem_acesso(v_uid) then raise exception 'Você já tem acesso. Recarregue a página.'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'Confirme seu e-mail antes de comprar.';
  end if;
  select * into v_c from public.compras
   where user_id = v_uid and metodo = 'pix_manual' and status = 'pendente' and valor_centavos = v_conf.preco_centavos
     and criado_em > now() - interval '3 days'
   order by criado_em desc limit 1;
  if not found then
    if (select count(*) from public.compras where user_id = v_uid and criado_em > now() - interval '1 hour') >= 10 then
      raise exception 'Muitas tentativas seguidas. Aguarde alguns minutos.';
    end if;
    insert into public.compras (user_id, email_comprador, valor_centavos, metodo)
    values (v_uid, public._email_de(v_uid), v_conf.preco_centavos, 'pix_manual')
    returning * into v_c;
  end if;
  return jsonb_build_object('compra_id', v_c.id, 'codigo', public._codigo_compra(v_c.id), 'valor_centavos', v_c.valor_centavos,
                            'informado', v_c.pix_informado_em is not null);
end;
$$;

-- O comprador avisa que fez o Pix. O dono confere no extrato e confirma no painel.
create or replace function public.informar_pix(p_compra uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_c public.compras;
begin
  select * into v_c from public.compras where id = p_compra and user_id = v_uid and metodo = 'pix_manual' for update;
  if not found then raise exception 'Compra não encontrada.' using errcode = '42501'; end if;
  if v_c.status <> 'pendente' then return jsonb_build_object('ok', true, 'status', v_c.status); end if;
  if v_c.pix_informado_em is null then
    update public.compras set pix_informado_em = now(), atualizado_em = now() where id = p_compra;
    perform public._registrar_evento('pix_informado', v_uid, jsonb_build_object('compra', p_compra, 'codigo', public._codigo_compra(p_compra), 'valor_centavos', v_c.valor_centavos));
  end if;
  return jsonb_build_object('ok', true, 'status', 'pendente');
end;
$$;

-- O dono confirma (libera o acesso) ou recusa um Pix direto.
create or replace function public.admin_confirmar_pix(p_compra uuid, p_aprovar boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_c public.compras;
begin
  perform public._exigir_dono();
  select * into v_c from public.compras where id = p_compra and metodo = 'pix_manual' for update;
  if not found then raise exception 'Compra não encontrada.'; end if;
  if v_c.status <> 'pendente' then raise exception 'Esta compra já foi resolvida.'; end if;
  if coalesce(p_aprovar, false) then
    update public.compras set status = 'aprovada', atualizado_em = now() where id = p_compra;
    if v_c.user_id is not null then
      insert into public.acessos (user_id, ativo, origem, compra_id) values (v_c.user_id, true, 'compra', p_compra)
      on conflict (user_id) do update set ativo = true, origem = 'compra', compra_id = excluded.compra_id, atualizado_em = now();
    end if;
    perform public._registrar_evento('compra_aprovada', v_c.user_id, jsonb_build_object('compra', p_compra, 'metodo', 'pix_manual', 'por', public._email_de(auth.uid())));
  else
    update public.compras set status = 'recusada', atualizado_em = now() where id = p_compra;
    perform public._registrar_evento('compra_recusada', v_c.user_id, jsonb_build_object('compra', p_compra, 'metodo', 'pix_manual', 'por', public._email_de(auth.uid())));
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- permissões das funções

revoke execute on all functions in schema public from public, anon, authenticated, service_role;

grant execute on function public.config_publica()                to anon, authenticated;
grant execute on function public.meu_status()                    to anon, authenticated;
grant execute on function public.tem_acesso(uuid)                to authenticated;
grant execute on function public.eh_dono()                       to authenticated;
grant execute on function public.aceitar_propriedade()           to authenticated;
grant execute on function public.admin_resumo()                  to authenticated;
grant execute on function public.admin_listar_compras(integer)   to authenticated;
grant execute on function public.admin_listar_acessos()          to authenticated;
grant execute on function public.admin_listar_eventos(integer)   to authenticated;
grant execute on function public.admin_definir_acesso(text, boolean) to authenticated;
grant execute on function public.admin_salvar_config(text, text, integer, boolean, text) to authenticated;
grant execute on function public.admin_transferir_propriedade(text) to authenticated;
grant execute on function public.admin_cancelar_transferencia()  to authenticated;
grant execute on function public.registrar_presenca()             to authenticated;
grant execute on function public.registrar_acesso(text)           to authenticated;
grant execute on function public.meu_perfil()                     to authenticated;
grant execute on function public.salvar_meu_perfil(text, text, text, text, text, text) to authenticated;
grant execute on function public.excluir_minha_conta(text)        to authenticated;
grant execute on function public.admin_listar_usuarios(text, integer) to authenticated;
grant execute on function public.admin_detalhe_usuario(uuid)      to authenticated;
grant execute on function public.admin_encerrar_sessoes(uuid)     to authenticated;
grant execute on function public.admin_salvar_pagamentos(boolean, boolean, text, text, text) to authenticated;
grant execute on function public.solicitar_pix()                  to authenticated;
grant execute on function public.informar_pix(uuid)               to authenticated;
grant execute on function public.admin_confirmar_pix(uuid, boolean) to authenticated;
grant execute on function public.criar_compra(uuid)              to service_role;
grant execute on function public.registrar_pagamento(uuid, text, text, integer, text) to service_role;
grant execute on function public.compras_pendentes(uuid)         to service_role;

-- ---------------------------------------------------------------- arquivo do aplicativo

-- O aplicativo fica num depósito privado: só é entregue a quem tem acesso.
insert into storage.buckets (id, name, public) values ('app', 'app', false) on conflict (id) do nothing;

drop policy if exists "baixar o app com acesso" on storage.objects;
create policy "baixar o app com acesso" on storage.objects
  for select to authenticated
  using (bucket_id = 'app' and (select public.tem_acesso(auth.uid())));
