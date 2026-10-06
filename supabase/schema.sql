-- ============================================================
-- Mastering — schema strategie su Supabase
-- Esegui questo file nel SQL Editor del progetto Supabase nuovo.
-- ============================================================

-- Tabella: una riga per strategia nominata (stesso payload di raccogliDati()).
-- user_id è NULL nell'uso personale; servirà per multi-utente con Auth.
create table if not exists public.strategie (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  dati        jsonb not null,
  salvato_il  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid references auth.users (id) on delete cascade default null
);

-- Nome univoco (per uso personale). In multi-utente: unique (user_id, nome).
create unique index if not exists strategie_nome_unique
  on public.strategie (nome);

create index if not exists strategie_updated_at_idx
  on public.strategie (updated_at desc);

-- Aggiorna updated_at a ogni modifica
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists strategie_set_updated_at on public.strategie;
create trigger strategie_set_updated_at
  before update on public.strategie
  for each row execute function public.set_updated_at();

-- RLS
alter table public.strategie enable row level security;

-- Uso personale ORA: accesso completo con anon key (l'app è personale).
-- ATTENZIONE: chi conosce URL + anon key dell'app può leggere/scrivere.
-- Quando passi a multi-utente, elimina questa policy e attiva quelle sotto.
drop policy if exists "strategie_open_personal" on public.strategie;
create policy "strategie_open_personal"
  on public.strategie
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---------- MULTI-UTENTE (da attivare più avanti) ----------
-- 1) drop policy "strategie_open_personal" on public.strategie;
-- 2) drop index strategie_nome_unique;
-- 3) create unique index strategie_user_nome_unique on public.strategie (user_id, nome);
-- 4) create policy "strategie_own_select" on public.strategie
--      for select to authenticated using (auth.uid() = user_id);
-- 5) create policy "strategie_own_insert" on public.strategie
--      for insert to authenticated with check (auth.uid() = user_id);
-- 6) create policy "strategie_own_update" on public.strategie
--      for update to authenticated using (auth.uid() = user_id)
--      with check (auth.uid() = user_id);
-- 7) create policy "strategie_own_delete" on public.strategie
--      for delete to authenticated using (auth.uid() = user_id);
