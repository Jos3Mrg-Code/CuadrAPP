-- RF-013: Suscripciones Web Push
create table public.push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all using (auth.uid() = user_id);
create index on public.push_subscriptions(user_id);

-- OBLIGATORIO en este proyecto (las tablas creadas por SQL editor no reciben grants automáticos)
grant all on public.push_subscriptions to anon, authenticated, service_role;
