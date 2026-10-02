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

create table if not exists public.compras (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  valor_centavos integer not null check (valor_centavos > 0),
  status         text not null default 'pendente'
                 check (status in ('pendente', 'aprovada', 'recusada', 'cancelada', 'reembolsada', 'contestada', 'divergente')),
  mp_payment_id  text unique,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists compras_user_idx on public.compras (user_id, criado_em desc);

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
    'tem_dono',       c.dono_id is not null
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
    'pendencias',       (select count(*) from public.compras where status in ('divergente', 'contestada'))
                      + (select count(*) from public.eventos where tipo = 'pagamento_duplicado' and quando > now() - interval '30 days'),
    'config', (select jsonb_build_object(
                 'nome_produto', c.nome_produto, 'descricao', c.descricao, 'preco_centavos', c.preco_centavos,
                 'vendas_abertas', c.vendas_abertas, 'email_suporte', c.email_suporte,
                 'dono_email', public._email_de(c.dono_id),
                 'dono_pendente_email', c.dono_pendente_email, 'dono_pendente_expira', c.dono_pendente_expira)
               from public.configuracao c)
  ) into v;
  return v;
end;
$$;

create or replace function public.admin_listar_compras(p_limite integer default 200)
returns table (id uuid, email text, valor_centavos integer, status text, mp_payment_id text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_dono();
  return query
    select c.id, u.email::text, c.valor_centavos, c.status, c.mp_payment_id, c.criado_em
      from public.compras c join auth.users u on u.id = c.user_id
     where c.status <> 'pendente' or c.criado_em > now() - interval '2 days'
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
  if not v_conf.vendas_abertas or v_conf.preco_centavos is null then
    raise exception 'vendas_fechadas';
  end if;
  if public.tem_acesso(p_user) then
    raise exception 'ja_tem_acesso';
  end if;
  if (select count(*) from public.compras
       where user_id = p_user and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'muitas_tentativas';
  end if;
  insert into public.compras (user_id, valor_centavos) values (p_user, v_conf.preco_centavos)
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

  -- O valor pago tem de ser exatamente o preço registrado na compra.
  if v_status = 'aprovada' and (p_moeda is distinct from 'BRL' or p_valor_centavos is distinct from v_compra.valor_centavos) then
    v_status := 'divergente';
  end if;

  update public.compras
     set status = v_status, mp_payment_id = p_payment_id, atualizado_em = now()
   where id = p_compra;

  if v_status = 'aprovada' then
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
grant execute on function public.criar_compra(uuid)              to service_role;
grant execute on function public.registrar_pagamento(uuid, text, text, integer, text) to service_role;

-- ---------------------------------------------------------------- arquivo do aplicativo

-- O aplicativo fica num depósito privado: só é entregue a quem tem acesso.
insert into storage.buckets (id, name, public) values ('app', 'app', false) on conflict (id) do nothing;

drop policy if exists "baixar o app com acesso" on storage.objects;
create policy "baixar o app com acesso" on storage.objects
  for select to authenticated
  using (bucket_id = 'app' and (select public.tem_acesso(auth.uid())));
