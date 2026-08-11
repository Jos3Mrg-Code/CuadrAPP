-- Tabla de trazabilidad de transacciones
create table public.transaction_logs (
  id uuid default uuid_generate_v4() primary key,
  transaction_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null check (action in ('created', 'edited', 'deleted')),
  snapshot jsonb not null,
  changes jsonb,
  created_at timestamptz default now()
);

alter table public.transaction_logs enable row level security;
create policy "Users see own logs" on public.transaction_logs for select using (auth.uid() = user_id);
-- Sin esta política los inserts se rechazan y la trazabilidad queda vacía
create policy "Users insert own logs" on public.transaction_logs
  for insert with check (auth.uid() = user_id);
create index on public.transaction_logs(transaction_id);
create index on public.transaction_logs(user_id, created_at desc);

-- OBLIGATORIO en este proyecto (las tablas creadas por SQL editor no reciben grants automáticos)
grant all on public.transaction_logs to anon, authenticated, service_role;
