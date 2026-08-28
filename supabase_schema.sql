-- ==============================================================================
-- FINANCEFLOW - SCHEMA DE BANCO DE DADOS POSTGRESQL (SUPABASE)
-- ==============================================================================
-- Execute este script no "SQL Editor" do seu painel Supabase para criar
-- todas as tabelas, índices e regras de segurança (Row Level Security).
-- ==============================================================================

-- 1. PERFIS DE USUÁRIOS (Vinculado ao auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger para criar perfil automaticamente no primeiro login
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CATEGORIAS PERSONALIZADAS
create table if not exists public.custom_categories (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  emoji text default '📦',
  color text default '#6b7280',
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- 3. CARTÕES DE CRÉDITO
create table if not exists public.custom_cards (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  initials text,
  color text,
  card_limit numeric(12,2) default 0,
  closing_day integer,
  due_day integer,
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- 4. TRANSAÇÕES FINANCEIRAS
create table if not exists public.transactions (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  type text not null check (type in ('income', 'expense')),
  description text not null,
  amount numeric(12,2) not null default 0,
  date date not null,
  category text not null,
  payment_method text default 'outro',
  notes text,
  recurring boolean default false,
  card_key text,
  card_label text,
  invoice_month text,
  installments integer,
  installment_paid integer,
  installment_value numeric(12,2),
  installment_total numeric(12,2),
  installment_group_id text,
  fixed_expense_id text,
  fixed_expense_month text,
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- 5. DESPESAS FIXAS
create table if not exists public.fixed_expenses (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  description text not null,
  amount numeric(12,2) not null default 0,
  charge_day integer not null default 1,
  start_month text not null,
  category text not null,
  payment_method text not null default 'pix',
  card_key text,
  active boolean default true,
  generated_months text[] default array[]::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id, user_id)
);

-- 6. VALORES EMPRESTADOS (EMPRESTADO)
create table if not exists public.loans (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  person text not null,
  amount numeric(12,2) not null default 0,
  loan_date date not null,
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id, user_id)
);

-- 7. PAGAMENTOS/RECEBIMENTOS DE EMPRÉSTIMOS
create table if not exists public.loan_payments (
  id text not null,
  loan_id text not null,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12,2) not null default 0,
  payment_date date not null,
  notes text,
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- 8. ORÇAMENTOS POR CATEGORIA
create table if not exists public.budgets (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  amount_limit numeric(12,2) not null default 0,
  month text,
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- 9. METAS FINANCEIRAS
create table if not exists public.goals (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  emoji text default '🎯',
  target_date date not null,
  target_value numeric(12,2) not null default 0,
  current_value numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- 10. AJUSTES MANUAIS DE FATURAS
create table if not exists public.card_invoice_adjustments (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  card_id text not null,
  month text not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- ==============================================================================
-- ÍNDICES DE PERFORMANCE (Buscas ultra-rápidas)
-- ==============================================================================
create index if not exists idx_tx_user_date on public.transactions(user_id, date desc);
create index if not exists idx_tx_user_cat on public.transactions(user_id, category);
create index if not exists idx_tx_user_card on public.transactions(user_id, card_key);
create index if not exists idx_fixed_user on public.fixed_expenses(user_id);
create index if not exists idx_loans_user on public.loans(user_id);
create index if not exists idx_loan_pay_loan on public.loan_payments(loan_id);
create index if not exists idx_budgets_user on public.budgets(user_id);
create index if not exists idx_goals_user on public.goals(user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANÇA TOTAL ENTRE CONTAS
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.custom_categories enable row level security;
alter table public.custom_cards enable row level security;
alter table public.transactions enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.card_invoice_adjustments enable row level security;

-- Políticas de acesso: Cada usuário acessa e gerencia EXCLUSIVAMENTE seus próprios dados
drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile" on public.profiles for all using (auth.uid() = id);

drop policy if exists "Users can manage own categories" on public.custom_categories;
create policy "Users can manage own categories" on public.custom_categories for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own cards" on public.custom_cards;
create policy "Users can manage own cards" on public.custom_cards for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own transactions" on public.transactions;
create policy "Users can manage own transactions" on public.transactions for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own fixed expenses" on public.fixed_expenses;
create policy "Users can manage own fixed expenses" on public.fixed_expenses for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own loans" on public.loans;
create policy "Users can manage own loans" on public.loans for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own loan payments" on public.loan_payments;
create policy "Users can manage own loan payments" on public.loan_payments for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own budgets" on public.budgets;
create policy "Users can manage own budgets" on public.budgets for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own goals" on public.goals;
create policy "Users can manage own goals" on public.goals for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own invoice adjustments" on public.card_invoice_adjustments;
create policy "Users can manage own invoice adjustments" on public.card_invoice_adjustments for all using (auth.uid() = user_id);
