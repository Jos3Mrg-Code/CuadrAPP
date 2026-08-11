-- Token personal para registrar movimientos desde atajos del celular
-- (app Atajos de iOS, widgets, botón de acción, etc.) sin abrir la app.
--
-- El token solo permite CREAR movimientos en la cuenta de su dueño. No sirve
-- para leer, editar ni borrar nada, así que su exposición tiene alcance
-- limitado; aun así se puede rotar desde Ajustes cuando se quiera.
create table public.quick_add_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.quick_add_tokens enable row level security;

-- Cada quien administra su propio token: no hay escalada posible porque el
-- token queda atado a su propio user_id y el UNIQUE impide copiar el de otro.
create policy "Users manage own quick-add token"
  on public.quick_add_tokens for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on public.quick_add_tokens(token);

grant select, insert, update, delete on public.quick_add_tokens to authenticated;
grant all on public.quick_add_tokens to service_role;
