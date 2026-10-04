create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  firstname text not null,
  age int,
  whatsapp text not null,
  email text,
  situation text,
  problem text,
  goal_90d text,
  intent text,
  source text default 'site-liav',
  status text not null default 'nouveau' check (status in ('nouveau','a_qualifier','qualifie','liste_attente','session','client','perdu')),
  score int not null default 0 check (score between 0 and 100),
  notes text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text
);

create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_next_follow_up_idx on public.leads(next_follow_up_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

revoke all on public.leads from anon;
grant insert on public.leads to anon;
grant select, insert, update, delete on public.leads to authenticated;

create policy "public can submit leads"
on public.leads
for insert
to anon
with check (
  length(trim(firstname)) between 1 and 80
  and length(trim(whatsapp)) between 6 and 40
);

create policy "authenticated admin can read leads"
on public.leads
for select
to authenticated
using (true);

create policy "authenticated admin can insert leads"
on public.leads
for insert
to authenticated
with check (true);

create policy "authenticated admin can update leads"
on public.leads
for update
to authenticated
using (true)
with check (true);

create policy "authenticated admin can delete leads"
on public.leads
for delete
to authenticated
using (true);
