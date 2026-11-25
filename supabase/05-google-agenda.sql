-- HONRA: conexão definitiva (1 clique + refresh_token) com o Google Agenda por usuário
-- Pode ser rodado mais de uma vez com segurança.

create table if not exists public.google_conexoes (
  usuario uuid primary key references auth.users(id) on delete cascade,
  conta text,
  calendario_id text not null default 'primary',
  calendario_nome text not null default 'Agenda principal',
  modo text not null default 'enviar' check (modo in ('enviar', 'ambos')),
  refresh_token text not null,
  ultima_sync timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.google_conexoes enable row level security;

-- O refresh_token NUNCA pode ser lido ou escrito diretamente pelo navegador.
-- Apenas a Edge Function google-agenda (usando service_role) acessa esta tabela.
revoke all on public.google_conexoes from public, anon, authenticated;

-- Resumo seguro (sem token) para o próprio usuário autenticado consultar seu status.
create or replace function public.minha_conexao_google() returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select json_build_object(
      'conectado', true,
      'conta', g.conta,
      'calendario_id', g.calendario_id,
      'calendario_nome', g.calendario_nome,
      'modo', g.modo,
      'ultima_sync', g.ultima_sync
    )
    from public.google_conexoes g
    where g.usuario = auth.uid()),
    json_build_object('conectado', false)
  );
$$;

revoke all on function public.minha_conexao_google() from public, anon;
grant execute on function public.minha_conexao_google() to authenticated;
