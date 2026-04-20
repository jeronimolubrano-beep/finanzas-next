-- Budget vs Actuals tables
-- business_id is integer (matches existing businesses table)
-- category_id is integer (matches existing categories table)

create table if not exists budgets (
  id          serial primary key,
  business_id integer references businesses(id) on delete cascade,
  category_id integer not null references categories(id) on delete cascade,
  year        integer not null,
  month       integer not null check (month between 1 and 12),
  amount_ars  numeric(18,2) not null default 0,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(business_id, category_id, year, month)
);
alter table budgets disable row level security;

create index if not exists budgets_year_month on budgets (year, month);
create index if not exists budgets_business_id on budgets (business_id);

create table if not exists budget_templates (
  id          serial primary key,
  business_id integer references businesses(id) on delete cascade,
  category_id integer not null references categories(id) on delete cascade,
  amount_ars  numeric(18,2) not null default 0,
  active      boolean default true,
  unique(business_id, category_id)
);
alter table budget_templates disable row level security;
