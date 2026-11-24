-- HONRA: assinatura por escritório, teste grátis de 7 dias e bloqueio de escrita ao fim do teste
create table if not exists public.assinaturas (
  escritorio_id uuid primary key references public.escritorios(id) on delete cascade,
  status text not null default 'teste' check (status in ('teste','ativa','atrasada','cancelada','cortesia')),
  plano text,
  teste_ate timestamptz not null default (now() + interval '7 days'),
  pago_ate timestamptz,
  gateway text,
  gateway_cliente text,
  gateway_assinatura text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
-- só leitura para a equipe; quem grava é o servidor (webhook do pagamento, com a chave de serviço)
drop policy if exists "membros veem a assinatura" on public.assinaturas;
create policy "membros veem a assinatura" on public.assinaturas for select to authenticated using (public.eh_membro(escritorio_id));

-- todo escritório novo nasce com 7 dias de teste
create or replace function public.cria_assinatura_teste() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assinaturas (escritorio_id) values (new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function public.cria_assinatura_teste() from public, anon, authenticated;
drop trigger if exists escritorio_cria_assinatura on public.escritorios;
create trigger escritorio_cria_assinatura after insert on public.escritorios
  for each row execute function public.cria_assinatura_teste();

-- escritórios que já existiam: o do Gabriel (dono do produto) fica como cortesia
insert into public.assinaturas (escritorio_id, status, teste_ate)
  select id, 'cortesia', now() + interval '7 days' from public.escritorios
  on conflict do nothing;

-- pode gravar? teste no prazo, cortesia, ou pago até a data (+3 dias de tolerância)
create or replace function public.assinatura_ok(esc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assinaturas a
    where a.escritorio_id = esc
      and (a.status = 'cortesia'
           or a.teste_ate > now()
           or coalesce(a.pago_ate, '-infinity'::timestamptz) + interval '3 days' > now()));
$$;
revoke all on function public.assinatura_ok(uuid) from public, anon;
grant execute on function public.assinatura_ok(uuid) to authenticated;

-- resumo para a tela
create or replace function public.minha_assinatura(esc uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'status', a.status, 'plano', a.plano, 'teste_ate', a.teste_ate, 'pago_ate', a.pago_ate,
    'liberado', public.assinatura_ok(esc),
    'agora', now())
  from public.assinaturas a
  where a.escritorio_id = esc and public.eh_membro(esc);
$$;
revoke all on function public.minha_assinatura(uuid) from public, anon;
grant execute on function public.minha_assinatura(uuid) to authenticated;

-- fim do teste sem assinatura: dados continuam visíveis e exportáveis, mas não dá para gravar
do $$
declare t text;
begin
  foreach t in array array['clientes','parcelas','compromissos','acoes','avulsos','empresas','devedores','acordos','acordo_parcelas'] loop
    execute format('drop policy if exists "assinatura cria" on public.%I', t);
    execute format('drop policy if exists "assinatura altera" on public.%I', t);
    execute format('drop policy if exists "assinatura apaga" on public.%I', t);
    execute format('create policy "assinatura cria" on public.%I as restrictive for insert to authenticated with check (public.assinatura_ok(escritorio_id))', t);
    execute format('create policy "assinatura altera" on public.%I as restrictive for update to authenticated using (public.assinatura_ok(escritorio_id)) with check (public.assinatura_ok(escritorio_id))', t);
    execute format('create policy "assinatura apaga" on public.%I as restrictive for delete to authenticated using (public.assinatura_ok(escritorio_id))', t);
  end loop;
end $$;
drop policy if exists "assinatura altera" on public.escritorios;
create policy "assinatura altera" on public.escritorios as restrictive for update to authenticated
  using (public.assinatura_ok(id)) with check (public.assinatura_ok(id));
