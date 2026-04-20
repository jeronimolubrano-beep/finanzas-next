-- Cash positions for Runway calculation
-- One row per company per recording date (manual input, updated periodically)

create table if not exists cash_positions (
  id          serial primary key,
  business_id integer references businesses(id) on delete cascade,
  amount_ars  numeric(18,2) not null,
  recorded_at date not null default current_date,
  notes       text
);
alter table cash_positions disable row level security;

create index if not exists cash_positions_business_date
  on cash_positions (business_id, recorded_at desc);
