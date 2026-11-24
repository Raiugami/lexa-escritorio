-- HONRA: várias contas no mesmo escritório (2026-11-24)
-- O dono convida por link (token de uso único, vale 7 dias, preso ao e-mail convidado).
-- Toda a gestão passa por funções: a tabela membros continua sem INSERT/UPDATE/DELETE direto pelo site.
-- Pode ser rodado mais de uma vez.

-- 1) Convites: guardamos só o hash do token; o link completo só aparece uma vez para o dono.
create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  email text not null,
  papel text not null check (papel in ('advogado','estagiario','secretaria')),
  token_hash text not null unique,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  usado_por uuid references auth.users(id) on delete set null,
  cancelado_em timestamptz
);
create index if not exists convites_escritorio_idx on public.convites(escritorio_id);
alter table public.convites enable row level security;
revoke all on public.convites from anon, authenticated;

-- 2) Apoio
create or replace function public.eh_dono(esc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros m where m.escritorio_id = esc and m.usuario = auth.uid() and m.papel = 'dono');
$$;
revoke all on function public.eh_dono(uuid) from public, anon;
grant execute on function public.eh_dono(uuid) to authenticated;

create or replace function public.convite_hash(token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(coalesce(token, ''), 'UTF8'), 'sha256'), 'hex');
$$;
revoke all on function public.convite_hash(text) from public, anon, authenticated;

-- 3) Quem está na equipe (qualquer membro vê nome, e-mail e papel dos colegas)
create or replace function public.equipe(esc uuid)
returns table (usuario uuid, papel text, nome text, email text, desde timestamptz, eu boolean)
language sql stable security definer set search_path = '' as $$
  select m.usuario, m.papel,
         coalesce(nullif(p.dados->>'nome', ''), nullif(u.raw_user_meta_data->>'nome', ''), split_part(u.email, '@', 1)),
         u.email, m.criado_em, m.usuario = auth.uid()
  from public.membros m
  join auth.users u on u.id = m.usuario
  left join public.perfis p on p.usuario = m.usuario
  where m.escritorio_id = esc and public.eh_membro(esc)
  order by (m.papel = 'dono') desc, m.criado_em;
$$;
revoke all on function public.equipe(uuid) from public, anon;
grant execute on function public.equipe(uuid) to authenticated;

-- 4) Convites pendentes (só o dono)
create or replace function public.convites_pendentes(esc uuid)
returns table (id uuid, email text, papel text, criado_em timestamptz, expira_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.email, c.papel, c.criado_em, c.expira_em
  from public.convites c
  where c.escritorio_id = esc and public.eh_dono(esc)
    and c.usado_em is null and c.cancelado_em is null and c.expira_em > now()
  order by c.criado_em desc;
$$;
revoke all on function public.convites_pendentes(uuid) from public, anon;
grant execute on function public.convites_pendentes(uuid) to authenticated;

-- 5) Convidar: devolve o token uma única vez
create or replace function public.convidar(esc uuid, email text, papel text) returns text
language plpgsql security definer set search_path = '' as $$
declare em text := lower(trim(coalesce(email, ''))); tk text;
begin
  if not public.eh_dono(esc) or not public.sessao_ok() then raise exception 'só o dono do escritório pode convidar'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(em) > 254 then raise exception 'e-mail inválido'; end if;
  if papel not in ('advogado','estagiario','secretaria') then raise exception 'papel inválido'; end if;
  if exists (select 1 from public.membros m join auth.users u on u.id = m.usuario where m.escritorio_id = esc and lower(u.email) = em) then
    raise exception 'essa pessoa já faz parte da equipe';
  end if;
  if (select count(*) from public.convites c where c.escritorio_id = esc and c.criado_em > now() - interval '1 day') >= 30 then
    raise exception 'limite de convites por dia atingido';
  end if;
  -- um convite vivo por e-mail: o novo substitui o anterior
  update public.convites c set cancelado_em = now()
   where c.escritorio_id = esc and lower(c.email) = em and c.usado_em is null and c.cancelado_em is null;
  tk := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.convites (escritorio_id, email, papel, token_hash, criado_por)
  values (esc, em, papel, public.convite_hash(tk), auth.uid());
  return tk;
end $$;
revoke all on function public.convidar(uuid, text, text) from public, anon;
grant execute on function public.convidar(uuid, text, text) to authenticated;

create or replace function public.cancelar_convite(convite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare esc uuid;
begin
  select c.escritorio_id into esc from public.convites c where c.id = convite;
  if esc is null or not public.eh_dono(esc) or not public.sessao_ok() then raise exception 'convite não encontrado'; end if;
  update public.convites c set cancelado_em = now() where c.id = convite and c.usado_em is null;
end $$;
revoke all on function public.cancelar_convite(uuid) from public, anon;
grant execute on function public.cancelar_convite(uuid) to authenticated;

-- 6) Ver o convite antes de entrar (tela de login): nome do escritório, papel e e-mail convidado
create or replace function public.ver_convite(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'escritorio', coalesce(nullif(e.nome, ''), nullif(e.marca->>'nome', ''), nullif(p.dados->>'nome', ''), 'Escritório'),
    'papel', c.papel, 'email', c.email, 'expira_em', c.expira_em)
  from public.convites c
  join public.escritorios e on e.id = c.escritorio_id
  left join public.perfis p on p.usuario = e.dono
  where c.token_hash = public.convite_hash(token)
    and c.usado_em is null and c.cancelado_em is null and c.expira_em > now();
$$;
revoke all on function public.ver_convite(text) from public;
grant execute on function public.ver_convite(text) to anon, authenticated;

-- 7) Aceitar: só a conta com o e-mail convidado (já confirmado). Uso único.
--    Se a pessoa já tinha um escritório próprio vazio (criado no cadastro), ele é descartado.
create or replace function public.aceitar_convite(token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.convites; meu_email text; outro uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into c from public.convites x where x.token_hash = public.convite_hash(token) for update;
  if c.id is null or c.usado_em is not null or c.cancelado_em is not null or c.expira_em <= now() then
    raise exception 'convite inválido, expirado ou já usado';
  end if;
  select lower(u.email) into meu_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if meu_email is null or meu_email <> lower(c.email) then
    raise exception 'este convite é para %', c.email;
  end if;
  if exists (select 1 from public.membros m where m.escritorio_id = c.escritorio_id and m.usuario = auth.uid()) then
    update public.convites set usado_em = now(), usado_por = auth.uid() where id = c.id;
    return c.escritorio_id;
  end if;
  if exists (select 1 from public.membros m where m.usuario = auth.uid() and m.papel <> 'dono') then
    raise exception 'sua conta já participa de outro escritório; saia dele antes de aceitar';
  end if;
  for outro in select m.escritorio_id from public.membros m where m.usuario = auth.uid() and m.papel = 'dono' loop
    if exists (select 1 from public.membros m where m.escritorio_id = outro and m.usuario <> auth.uid())
       or exists (select 1 from public.clientes t where t.escritorio_id = outro)
       or exists (select 1 from public.compromissos t where t.escritorio_id = outro)
       or exists (select 1 from public.acoes t where t.escritorio_id = outro)
       or exists (select 1 from public.avulsos t where t.escritorio_id = outro)
       or exists (select 1 from public.empresas t where t.escritorio_id = outro)
       or exists (select 1 from public.acordos t where t.escritorio_id = outro)
       or exists (select 1 from public.assinaturas a where a.escritorio_id = outro and (a.status in ('ativa','atrasada','cortesia') or a.gateway_assinatura is not null)) then
      raise exception 'sua conta já é dona de um escritório com dados; use outro e-mail para entrar nesta equipe';
    end if;
    delete from public.escritorios e where e.id = outro;
  end loop;
  delete from public.escritorios e where e.dono = auth.uid()
    and not exists (select 1 from public.membros m where m.escritorio_id = e.id);
  insert into public.membros (escritorio_id, usuario, papel) values (c.escritorio_id, auth.uid(), c.papel);
  update public.convites set usado_em = now(), usado_por = auth.uid() where id = c.id;
  return c.escritorio_id;
end $$;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;

-- 8) Dono muda papel ou remove; membro pode sair. Ninguém vira dono por aqui.
create or replace function public.mudar_papel(esc uuid, membro uuid, papel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_dono(esc) or not public.sessao_ok() then raise exception 'só o dono do escritório pode mudar papéis'; end if;
  if papel not in ('advogado','estagiario','secretaria') then raise exception 'papel inválido'; end if;
  update public.membros m set papel = mudar_papel.papel
   where m.escritorio_id = esc and m.usuario = membro and m.papel <> 'dono';
  if not found then raise exception 'membro não encontrado'; end if;
end $$;
revoke all on function public.mudar_papel(uuid, uuid, text) from public, anon;
grant execute on function public.mudar_papel(uuid, uuid, text) to authenticated;

create or replace function public.remover_membro(esc uuid, membro uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_dono(esc) or not public.sessao_ok() then raise exception 'só o dono do escritório pode remover pessoas'; end if;
  delete from public.membros m where m.escritorio_id = esc and m.usuario = membro and m.papel <> 'dono';
  if not found then raise exception 'membro não encontrado'; end if;
end $$;
revoke all on function public.remover_membro(uuid, uuid) from public, anon;
grant execute on function public.remover_membro(uuid, uuid) to authenticated;

create or replace function public.sair_do_escritorio(esc uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.membros m where m.escritorio_id = esc and m.usuario = auth.uid() and m.papel <> 'dono';
  if not found then raise exception 'o dono não pode sair do próprio escritório'; end if;
end $$;
revoke all on function public.sair_do_escritorio(uuid) from public, anon;
grant execute on function public.sair_do_escritorio(uuid) to authenticated;

-- 9) Excluir a própria conta: membro sai do escritório (não apaga os dados do escritório);
--    dono continua apagando o escritório inteiro, como antes.
--    (sem mudança de código: membros.usuario já cai em cascata e escritorios.dono também)

-- 10) Permissões por papel, que o dono liga e desliga na tela Equipe.
--     financeiro: ver Financeiro, Relatórios, Cobrança de empresas e valores (controle na tela)
--     excluir: apagar clientes, compromissos, ações, recebimentos avulsos, empresas, devedores e acordos (controle no banco)
--     aparencia: mudar cor, logo e nome do escritório (controle no banco)
alter table public.escritorios add column if not exists permissoes jsonb not null default '{
  "advogado":   {"financeiro": true,  "excluir": true,  "aparencia": false},
  "estagiario": {"financeiro": false, "excluir": false, "aparencia": false},
  "secretaria": {"financeiro": true,  "excluir": false, "aparencia": false}}'::jsonb;

create or replace function public.pode(esc uuid, permissao text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when m.papel = 'dono' then true
                else coalesce((e.permissoes -> m.papel ->> permissao)::boolean, false) end
    from public.membros m join public.escritorios e on e.id = m.escritorio_id
    where m.escritorio_id = esc and m.usuario = auth.uid()), false);
$$;
revoke all on function public.pode(uuid, text) from public, anon;
grant execute on function public.pode(uuid, text) to authenticated;

create or replace function public.protege_permissoes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then return new; end if;
  if new.permissoes is distinct from old.permissoes and not public.eh_dono(old.id) then
    raise exception 'só o dono do escritório muda as permissões';
  end if;
  if (new.marca is distinct from old.marca or new.nome is distinct from old.nome) and not public.pode(old.id, 'aparencia') then
    raise exception 'sem permissão para mudar a aparência do escritório';
  end if;
  return new;
end $$;
revoke all on function public.protege_permissoes() from public, anon, authenticated;
drop trigger if exists escritorio_protege_permissoes on public.escritorios;
create trigger escritorio_protege_permissoes before update on public.escritorios
  for each row execute function public.protege_permissoes();

create or replace function public.definir_permissoes(esc uuid, permissoes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text; k text; out jsonb := '{}'::jsonb; papel jsonb;
begin
  if not public.eh_dono(esc) or not public.sessao_ok() then raise exception 'só o dono do escritório muda as permissões'; end if;
  foreach r in array array['advogado','estagiario','secretaria'] loop
    papel := '{}'::jsonb;
    foreach k in array array['financeiro','excluir','aparencia'] loop
      papel := papel || jsonb_build_object(k, coalesce((permissoes -> r ->> k)::boolean, false));
    end loop;
    out := out || jsonb_build_object(r, papel);
  end loop;
  update public.escritorios e set permissoes = out where e.id = esc;
  return out;
end $$;
revoke all on function public.definir_permissoes(uuid, jsonb) from public, anon;
grant execute on function public.definir_permissoes(uuid, jsonb) to authenticated;

-- Exclusão só para quem tem a permissão (sem ela, o DELETE simplesmente não apaga nada).
-- Parcelas ficam de fora: são refeitas ao editar o cliente.
do $$
declare t text;
begin
  foreach t in array array['clientes','compromissos','acoes','avulsos','empresas','devedores','acordos'] loop
    execute format('drop policy if exists "permissao para excluir" on public.%I', t);
    execute format('create policy "permissao para excluir" on public.%I as restrictive for delete to authenticated using (public.pode(escritorio_id, %L))', t, 'excluir');
  end loop;
end $$;
