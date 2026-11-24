-- HONRA: correções da revisão de segurança (2026-11-24)

-- 1) Ninguém troca o dono (nem o id) de um escritório pelo app.
--    Antes, qualquer membro podia gravar dono = ele mesmo e, como dono, apagar o escritório inteiro.
create or replace function public.protege_dono_escritorio() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.dono is distinct from old.dono or new.id is distinct from old.id)
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'não é permitido trocar o dono do escritório';
  end if;
  return new;
end $$;
revoke all on function public.protege_dono_escritorio() from public, anon, authenticated;
drop trigger if exists escritorio_protege_dono on public.escritorios;
create trigger escritorio_protege_dono before update on public.escritorios
  for each row execute function public.protege_dono_escritorio();

-- 2) Situação da assinatura só para quem é do escritório (antes qualquer usuário consultava qualquer id).
create or replace function public.assinatura_ok(esc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_membro(esc) and exists (
    select 1 from public.assinaturas a
    where a.escritorio_id = esc
      and (a.status = 'cortesia'
           or a.teste_ate > now()
           or coalesce(a.pago_ate, '-infinity'::timestamptz) + interval '3 days' > now()));
$$;
revoke all on function public.assinatura_ok(uuid) from public, anon;
grant execute on function public.assinatura_ok(uuid) to authenticated;

-- 3) Usuário só cria escritório pelo meu_escritorio() (que já o coloca como dono e membro).
--    A inserção direta criava escritórios soltos, cada um com 7 dias de teste novos.
drop policy if exists "dono cria o proprio escritorio" on public.escritorios;

-- 4) TRUNCATE ignora o RLS: tira essa permissão dos papéis do site.
do $$
declare t text;
begin
  foreach t in array array['escritorios','membros','perfis','assinaturas','aceites','acessos','clientes','parcelas',
    'compromissos','acoes','avulsos','empresas','devedores','acordos','acordo_parcelas'] loop
    execute format('revoke truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
