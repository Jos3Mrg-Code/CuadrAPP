-- Extensiones
create extension if not exists "uuid-ossp";

-- Perfiles de usuario (extiende auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  currency text not null default 'USD',
  created_at timestamptz default now()
);

-- Cuentas financieras
create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'credit', 'savings', 'investment')),
  balance numeric(12,2) not null default 0,
  color text not null default '#6366F1',
  icon text not null default '💳',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Categorías (default + personalizadas)
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text not null,
  color text not null,
  type text not null check (type in ('income', 'expense')),
  is_default boolean not null default false,
  created_at timestamptz default now()
);

-- Transacciones (ingresos y gastos)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  description text not null default '',
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Metas de ahorro
create table public.savings_goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0,
  deadline date,
  color text not null default '#6366F1',
  icon text not null default '🎯',
  is_completed boolean not null default false,
  created_at timestamptz default now()
);

-- Presupuestos
create table public.budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  amount numeric(12,2) not null check (amount > 0),
  period text not null check (period in ('monthly', 'weekly')) default 'monthly',
  created_at timestamptz default now(),
  unique(user_id, category_id, period)
);

-- Deudas
create table public.debts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  debt_type text not null check (debt_type in ('loan', 'credit_card', 'personal', 'mortgage', 'other')),
  total_amount numeric(12,2) not null check (total_amount > 0),
  remaining_amount numeric(12,2) not null default 0,
  interest_rate numeric(5,2),
  due_date date,
  color text not null default '#6366F1',
  icon text not null default '🧾',
  is_paid boolean not null default false,
  created_at timestamptz default now()
);

-- Pagos programados (RF-012 Calendario Financiero)
create table public.scheduled_payments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  frequency text not null check (frequency in ('once', 'weekly', 'monthly', 'yearly')) default 'monthly',
  next_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  color text not null default '#6366F1',
  icon text not null default '📅',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.savings_goals enable row level security;
alter table public.budgets enable row level security;
alter table public.debts enable row level security;
alter table public.scheduled_payments enable row level security;

-- Políticas RLS
create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id);
create policy "Users manage own accounts" on public.accounts for all using (auth.uid() = user_id);
create policy "Users see default + own categories" on public.categories for select using (is_default = true or auth.uid() = user_id);
create policy "Users manage own categories" on public.categories for insert with check (auth.uid() = user_id);
create policy "Users update own categories" on public.categories for update using (auth.uid() = user_id);
create policy "Users delete own categories" on public.categories for delete using (auth.uid() = user_id);
create policy "Users manage own transactions" on public.transactions for all using (auth.uid() = user_id);
create policy "Users manage own goals" on public.savings_goals for all using (auth.uid() = user_id);
create policy "Users manage own budgets" on public.budgets for all using (auth.uid() = user_id);
create policy "Users manage own debts" on public.debts for all using (auth.uid() = user_id);
create policy "Users manage own scheduled payments" on public.scheduled_payments for all using (auth.uid() = user_id);

-- Trigger: crear perfil automático al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Categorías default
insert into public.categories (user_id, name, icon, color, type, is_default) values
  (null, 'Alimentación', '🍔', '#EF4444', 'expense', true),
  (null, 'Transporte', '🚗', '#F97316', 'expense', true),
  (null, 'Salud', '💊', '#10B981', 'expense', true),
  (null, 'Entretenimiento', '🎮', '#8B5CF6', 'expense', true),
  (null, 'Educación', '📚', '#3B82F6', 'expense', true),
  (null, 'Ropa', '👕', '#EC4899', 'expense', true),
  (null, 'Hogar', '🏠', '#F59E0B', 'expense', true),
  (null, 'Servicios', '💡', '#6366F1', 'expense', true),
  (null, 'Otros gastos', '💸', '#64748B', 'expense', true),
  (null, 'Salario', '💼', '#10B981', 'income', true),
  (null, 'Freelance', '💻', '#6366F1', 'income', true),
  (null, 'Inversiones', '📈', '#F59E0B', 'income', true),
  (null, 'Otros ingresos', '💰', '#64748B', 'income', true);
