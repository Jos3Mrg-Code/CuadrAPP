-- RF-015: Historial del asistente financiero
create table public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;
create policy "Users manage own chat messages"
  on public.chat_messages for all using (auth.uid() = user_id);
create index on public.chat_messages(user_id, created_at);

-- OBLIGATORIO en este proyecto (las tablas creadas por SQL editor no reciben grants automáticos)
grant all on public.chat_messages to anon, authenticated, service_role;
