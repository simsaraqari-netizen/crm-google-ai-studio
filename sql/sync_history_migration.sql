begin;

create table if not exists public.sync_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  direction text not null check (direction in ('app_to_sheet', 'sheet_to_app', 'rollback')),
  spreadsheet_id text not null,
  sheet_range text not null default 'Sheet1!A1:Z5000',
  payload jsonb not null,
  row_count integer not null default 0,
  triggered_by text null,
  note text null
);

create index if not exists sync_snapshots_created_at_idx
  on public.sync_snapshots (created_at desc);

create index if not exists sync_snapshots_direction_idx
  on public.sync_snapshots (direction);

commit;

