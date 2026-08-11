-- ============================================================================
-- Planes de suscripción + rol de administrador
--
-- REGLA CENTRAL: esta tabla es SOLO-LECTURA para los usuarios.
-- El plan NO puede vivir en public.profiles porque profiles tiene
-- "for all using (auth.uid() = id)": cualquiera podría auto-ascenderse.
--
-- Ausencia de fila = plan gratis. Así no hay que rellenar usuarios existentes
-- ni tocar handle_new_user().
--
-- ORDEN DE EJECUCIÓN: correr los bloques 1 y 2, luego el bootstrap del final,
-- y SOLO DESPUÉS el bloque 3. Si los triggers van antes del bootstrap, el
-- dueño queda como usuario gratis y se bloquea a sí mismo.
-- ============================================================================

-- ============================ BLOQUE 1: tabla ===============================
create table public.user_plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free', 'premium')),
  expires_at timestamptz,                    -- null = sin vencimiento
  is_admin   boolean not null default false, -- SOLO se escribe desde el SQL editor
  note       text,                           -- nota interna, nunca visible al usuario
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.user_plans enable row level security;
-- OJO: NO usar "force row level security": rompería el bootstrap del admin,
-- que se ejecuta como el dueño de la tabla (postgres) desde el SQL editor.

-- Única política: leer la propia fila. Sin políticas de insert/update/delete,
-- RLS deniega por defecto; no hacen falta políticas restrictivas.
create policy "Users read own plan"
  on public.user_plans for select to authenticated
  using (auth.uid() = user_id);

-- Privilegios: revoke primero para no depender de grants heredados
revoke all on public.user_plans from anon, authenticated, service_role;

-- El usuario lee su plan pero NO la nota interna del admin.
-- Por esto el cliente NUNCA debe hacer select('*') sobre user_plans.
grant select (user_id, plan, expires_at, is_admin) on public.user_plans to authenticated;

-- service_role (Edge Function admin) puede escribir el plan pero NO is_admin:
-- la escalada de privilegios la bloquea Postgres, no una promesa del código.
grant select, delete                                                  on public.user_plans to service_role;
grant insert (user_id, plan, expires_at, note, updated_at, updated_by) on public.user_plans to service_role;
grant update (plan, expires_at, note, updated_at, updated_by)          on public.user_plans to service_role;

-- ========================== BLOQUE 2: helpers ===============================
create or replace function public.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_plans p
    where p.user_id = uid
      and p.plan = 'premium'
      and (p.expires_at is null or p.expires_at > now())
  );
$$;
revoke execute on function public.is_premium(uuid) from public, anon, authenticated;

-- Versión sin argumentos para usar dentro de políticas RLS
create or replace function public.has_premium()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_premium(auth.uid());
$$;
revoke execute on function public.has_premium() from public, anon;
grant execute on function public.has_premium() to authenticated;

-- >>> AQUÍ va el BOOTSTRAP del final del archivo, antes de seguir. <<<

-- =================== BLOQUE 3: límites y funciones premium ==================
-- Límites del plan gratis: 2 cuentas / 2 metas / 2 presupuestos.
--
-- Se usa un TRIGGER AFTER INSERT, no una política RLS con subconsulta:
--   1. Una subconsulta sobre la misma tabla dentro de su política provoca
--      "infinite recursion detected in policy".
--   2. WITH CHECK se evalúa contra el snapshot previo al statement, así que
--      un insert masivo (insert([a,b,c])) lo esquivaría por completo.
--   3. Un trigger AFTER ROW sí ve las filas del propio statement.
create or replace function public.enforce_free_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  used int;
  max_free constant int := 2;
begin
  if public.is_premium(new.user_id) then
    return new;
  end if;

  if tg_table_name = 'accounts' then
    select count(*) into used from public.accounts
      where user_id = new.user_id and is_active;
  elsif tg_table_name = 'savings_goals' then
    select count(*) into used from public.savings_goals where user_id = new.user_id;
  elsif tg_table_name = 'budgets' then
    select count(*) into used from public.budgets where user_id = new.user_id;
  else
    return new;
  end if;

  -- Trigger AFTER: la fila nueva ya está contada
  if used > max_free then
    raise exception 'plan_limit_reached'
      using errcode = 'check_violation', hint = tg_table_name;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_free_limits() from public, anon, authenticated;

create trigger enforce_free_limit_accounts
  after insert on public.accounts
  for each row execute function public.enforce_free_limits();

create trigger enforce_free_limit_goals
  after insert on public.savings_goals
  for each row execute function public.enforce_free_limits();

create trigger enforce_free_limit_budgets
  after insert on public.budgets
  for each row execute function public.enforce_free_limits();

-- Calendario / pagos programados = premium. Booleano puro, sin conteo: aquí
-- una política restrictiva sí es la herramienta correcta. Solo se bloquea
-- CREAR; leer y editar lo existente sigue permitido para que nadie pierda
-- datos al bajar a gratis.
create policy "Premium: crear pagos programados"
  on public.scheduled_payments as restrictive for insert to authenticated
  with check (public.has_premium());

-- Estadísticas agregadas para el panel de admin (evita N+1).
-- El REVOKE es obligatorio: al ser SECURITY DEFINER, sin él cualquier usuario
-- autenticado podría leer los conteos de todos los demás.
create or replace function public.admin_user_stats()
returns table (user_id uuid, tx_count bigint, last_tx date)
language sql stable security definer set search_path = '' as $$
  select t.user_id, count(*)::bigint, max(t.date)
  from public.transactions t
  group by t.user_id;
$$;
revoke execute on function public.admin_user_stats() from public, anon, authenticated;
grant execute on function public.admin_user_stats() to service_role;

-- Índices que los conteos del trigger dan por sentados
create index if not exists accounts_user_id_idx      on public.accounts(user_id);
create index if not exists savings_goals_user_id_idx on public.savings_goals(user_id);
create index if not exists budgets_user_id_idx       on public.budgets(user_id);

-- ======================= BOOTSTRAP (correr una vez) =========================
-- El SQL editor corre como postgres = dueño de la tabla: exento de RLS y con
-- privilegios sobre todas las columnas, incluida is_admin. Por eso no hay
-- problema del huevo y la gallina aunque ningún usuario pueda escribir aquí.
--
-- insert into public.user_plans (user_id, plan, expires_at, is_admin, note)
-- select id, 'premium', null, true, 'Owner — cuenta del administrador'
-- from auth.users
-- where email = 'joseramirezgarcia325@gmail.com'
-- on conflict (user_id) do update
--   set plan = 'premium', expires_at = null, is_admin = true;
--
-- Verificar (debe devolver exactamente 1 fila con is_admin = true):
-- select u.email, p.plan, p.is_admin, p.expires_at
-- from public.user_plans p join auth.users u on u.id = p.user_id
-- where p.is_admin;
