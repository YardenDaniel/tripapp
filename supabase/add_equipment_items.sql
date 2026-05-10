-- =====================================================
-- Equipment / Packing List (added after initial schema)
-- Run this in Supabase Dashboard → SQL Editor → New query
-- =====================================================

create table public.equipment_items (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  name text not null,
  packed boolean default false not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

create index idx_equipment_trip on public.equipment_items(trip_id, created_at);

alter table public.equipment_items enable row level security;

create policy "Members can view equipment"
  on public.equipment_items for select using (public.is_trip_member(trip_id));

create policy "Members can create equipment"
  on public.equipment_items for insert with check (public.is_trip_member(trip_id));

create policy "Members can update equipment"
  on public.equipment_items for update using (public.is_trip_member(trip_id));

create policy "Members can delete equipment"
  on public.equipment_items for delete using (public.is_trip_member(trip_id));

-- Enable realtime so co-travelers see additions/changes live (without this,
-- changes only show after a manual refresh).
alter publication supabase_realtime add table public.equipment_items;
