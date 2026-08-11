-- RF-017: Logros desbloqueados (el catálogo vive en src/lib/achievements.ts)
create table public.achievements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  code text not null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, code)
);

alter table public.achievements enable row level security;
create policy "Users manage own achievements"
  on public.achievements for all using (auth.uid() = user_id);
create index on public.achievements(user_id, unlocked_at desc);

-- OBLIGATORIO en este proyecto (las tablas creadas por SQL editor no reciben grants automáticos)
grant all on public.achievements to anon, authenticated, service_role;
