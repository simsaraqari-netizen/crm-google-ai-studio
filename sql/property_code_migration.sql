-- Property code migration
-- Adds a unique 4-digit code for each property (existing + new).

begin;

alter table public.properties
  add column if not exists property_code text;

create or replace function public.generate_unique_property_code()
returns text
language plpgsql
as $$
declare
  generated_code text;
  attempts int := 0;
begin
  loop
    if attempts > 20000 then
      raise exception 'No available 4-digit property codes left';
    end if;

    generated_code := lpad((floor(random() * 10000))::int::text, 4, '0');

    exit when not exists (
      select 1
      from public.properties p
      where p.property_code = generated_code
    );

    attempts := attempts + 1;
  end loop;

  return generated_code;
end;
$$;

-- Backfill missing/invalid codes.
update public.properties p
set property_code = public.generate_unique_property_code()
where p.property_code is null
   or p.property_code !~ '^[0-9]{4}$';

-- Resolve duplicates among already-valid codes (keep first row, regenerate the rest).
with ranked as (
  select
    id,
    row_number() over (
      partition by property_code
      order by created_at nulls last, id
    ) as rn
  from public.properties
  where property_code ~ '^[0-9]{4}$'
)
update public.properties p
set property_code = public.generate_unique_property_code()
from ranked r
where p.id = r.id
  and r.rn > 1;

alter table public.properties
  alter column property_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_property_code_format_check'
  ) then
    alter table public.properties
      add constraint properties_property_code_format_check
      check (property_code ~ '^[0-9]{4}$');
  end if;
end $$;

create unique index if not exists properties_property_code_unique_idx
  on public.properties(property_code);

create or replace function public.ensure_property_code()
returns trigger
language plpgsql
as $$
begin
  if new.property_code is null or new.property_code !~ '^[0-9]{4}$' then
    new.property_code := public.generate_unique_property_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_property_code on public.properties;

create trigger trg_ensure_property_code
before insert or update of property_code
on public.properties
for each row
execute function public.ensure_property_code();

commit;

