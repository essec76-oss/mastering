-- Step 1 — Mastering: solo la tabella indispensabile
-- Esegui nel SQL Editor del progetto Supabase nuovo.

create table if not exists public.strategie (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  dati       jsonb not null,
  salvato_il timestamptz not null default now()
);

alter table public.strategie enable row level security;

-- Uso personale: lettura/scrittura con anon key
drop policy if exists "strategie_open" on public.strategie;
create policy "strategie_open"
  on public.strategie
  for all
  to anon, authenticated
  using (true)
  with check (true);
