-- Monthly FX rates table: stores avg and closing exchange rates per month.
-- Used by report pages for historical ARS→USD conversion.
-- Populated via POST /api/fx-rates/backfill — never updated on report render.

create table if not exists monthly_fx_rates (
  id           serial primary key,
  year         integer not null,
  month        integer not null check (month between 1 and 12),
  rate_type    text    not null,          -- 'oficial', 'blue'
  avg_rate     numeric(12,4) not null,   -- simple mean of daily closing values
  closing_rate numeric(12,4) not null,   -- value on last available trading day
  source       text    default 'bluelytics',
  updated_at   timestamptz default now(),
  unique (year, month, rate_type)
);

-- Index for report queries (year + rate_type is the most common lookup)
create index if not exists monthly_fx_rates_year_type
  on monthly_fx_rates (year, rate_type);

-- Settings keys used by the app:
--   reports_usd_mode  → 'true' | 'false'
--   reports_rate_type → 'oficial' | 'blue'
-- Insert default values if they don't exist yet
insert into settings (key, value)
values
  ('reports_usd_mode',  'false'),
  ('reports_rate_type', 'oficial')
on conflict (key) do nothing;
