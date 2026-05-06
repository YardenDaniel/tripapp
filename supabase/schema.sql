-- =====================================================
-- TripApp Database Schema
-- PostgreSQL + PostGIS extension for Supabase
-- =====================================================

-- Enable PostGIS for geographic queries
create extension if not exists postgis;

-- =====================================================
-- TABLES
-- =====================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trips
create table public.trips (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  country text not null,
  description text,
  cover_image_url text,
  start_date date not null,
  end_date date not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint valid_dates check (end_date >= start_date)
);

-- Trip members (who can access a trip)
create table public.trip_members (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'editor', 'viewer')) default 'editor' not null,
  joined_at timestamptz default now() not null,
  unique(trip_id, user_id)
);

-- Itinerary days
create table public.itinerary_days (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  date date not null,
  day_number int not null,
  title text,
  notes text,
  created_at timestamptz default now() not null,
  unique(trip_id, date)
);

-- Activities (within a day)
create table public.activities (
  id uuid default gen_random_uuid() primary key,
  day_id uuid references public.itinerary_days(id) on delete cascade not null,
  trip_id uuid references public.trips(id) on delete cascade not null,
  title text not null,
  type text check (type in ('food', 'lodging', 'attraction', 'transport', 'other')) default 'other',
  start_time time,
  end_time time,
  location_name text,
  location_address text,
  location_coords geography(point, 4326),
  notes text,
  cost_amount numeric(10, 2),
  cost_currency text default 'VND',
  created_by uuid references public.profiles(id) on delete set null,
  position int default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Memories (photos & videos pinned on map)
create table public.memories (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  media_url text not null,
  media_type text check (media_type in ('photo', 'video')) not null,
  thumbnail_url text,
  caption text,
  location_coords geography(point, 4326) not null,
  location_name text,
  taken_at timestamptz not null,
  created_at timestamptz default now() not null
);

-- Emergency contacts (per country)
create table public.emergency_contacts (
  id uuid default gen_random_uuid() primary key,
  country text not null,
  name text not null,
  number text not null,
  type text check (type in ('police', 'ambulance', 'fire', 'embassy', 'insurance', 'other')) default 'other',
  description text,
  is_default boolean default false,
  trip_id uuid references public.trips(id) on delete cascade,
  created_at timestamptz default now() not null
);

-- AI chat messages (per trip)
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz default now() not null
);

-- =====================================================
-- INDEXES (for performance)
-- =====================================================

create index idx_trips_owner on public.trips(owner_id);
create index idx_trip_members_trip on public.trip_members(trip_id);
create index idx_trip_members_user on public.trip_members(user_id);
create index idx_days_trip on public.itinerary_days(trip_id, date);
create index idx_activities_day on public.activities(day_id, position);
create index idx_activities_trip on public.activities(trip_id);
create index idx_memories_trip on public.memories(trip_id, taken_at desc);
create index idx_memories_location on public.memories using gist(location_coords);
create index idx_chat_trip on public.chat_messages(trip_id, created_at desc);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trips_updated_at before update on public.trips
  for each row execute function public.handle_updated_at();

create trigger activities_updated_at before update on public.activities
  for each row execute function public.handle_updated_at();

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-add trip owner as a member
create or replace function public.handle_new_trip()
returns trigger as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.handle_new_trip();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.activities enable row level security;
alter table public.memories enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles: anyone can view, only owner can update
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Helper function: check if user is a trip member
create or replace function public.is_trip_member(_trip_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = auth.uid()
  );
$$ language sql stable security definer;

-- Helper function: check if user is trip owner
create or replace function public.is_trip_owner(_trip_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.trips
    where id = _trip_id and owner_id = auth.uid()
  );
$$ language sql stable security definer;

-- Trips policies
create policy "Members can view their trips"
  on public.trips for select using (public.is_trip_member(id));

create policy "Authenticated users can create trips"
  on public.trips for insert with check (auth.uid() = owner_id);

create policy "Owners can update their trips"
  on public.trips for update using (auth.uid() = owner_id);

create policy "Owners can delete their trips"
  on public.trips for delete using (auth.uid() = owner_id);

-- Trip members policies
create policy "Members can view trip membership"
  on public.trip_members for select using (public.is_trip_member(trip_id));

create policy "Owners can add members"
  on public.trip_members for insert with check (public.is_trip_owner(trip_id));

create policy "Owners can remove members"
  on public.trip_members for delete using (public.is_trip_owner(trip_id));

-- Itinerary days policies
create policy "Members can view days"
  on public.itinerary_days for select using (public.is_trip_member(trip_id));

create policy "Members can create days"
  on public.itinerary_days for insert with check (public.is_trip_member(trip_id));

create policy "Members can update days"
  on public.itinerary_days for update using (public.is_trip_member(trip_id));

create policy "Members can delete days"
  on public.itinerary_days for delete using (public.is_trip_member(trip_id));

-- Activities policies
create policy "Members can view activities"
  on public.activities for select using (public.is_trip_member(trip_id));

create policy "Members can create activities"
  on public.activities for insert with check (public.is_trip_member(trip_id));

create policy "Members can update activities"
  on public.activities for update using (public.is_trip_member(trip_id));

create policy "Members can delete activities"
  on public.activities for delete using (public.is_trip_member(trip_id));

-- Memories policies
create policy "Members can view memories"
  on public.memories for select using (public.is_trip_member(trip_id));

create policy "Members can create memories"
  on public.memories for insert with check (public.is_trip_member(trip_id) and auth.uid() = user_id);

create policy "Users can update own memories"
  on public.memories for update using (auth.uid() = user_id);

create policy "Users can delete own memories"
  on public.memories for delete using (auth.uid() = user_id);

-- Emergency contacts policies
create policy "Anyone can view default emergency contacts"
  on public.emergency_contacts for select using (is_default = true or public.is_trip_member(trip_id));

create policy "Members can create custom contacts"
  on public.emergency_contacts for insert with check (public.is_trip_member(trip_id));

create policy "Members can update custom contacts"
  on public.emergency_contacts for update using (public.is_trip_member(trip_id));

create policy "Members can delete custom contacts"
  on public.emergency_contacts for delete using (public.is_trip_member(trip_id));

-- Chat messages policies
create policy "Members can view chat"
  on public.chat_messages for select using (public.is_trip_member(trip_id));

create policy "Members can create messages"
  on public.chat_messages for insert with check (public.is_trip_member(trip_id) and auth.uid() = user_id);

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Note: Run these in Supabase dashboard or via API
-- They cannot be created via SQL directly

-- Bucket: memories (for photos & videos)
-- Bucket: avatars (for profile pictures)
-- Bucket: trip-covers (for trip cover images)

-- =====================================================
-- SEED DATA - Vietnam Emergency Contacts
-- =====================================================

insert into public.emergency_contacts (country, name, number, type, description, is_default) values
  ('Vietnam', 'Police', '113', 'police', 'משטרה', true),
  ('Vietnam', 'Ambulance', '115', 'ambulance', 'אמבולנס', true),
  ('Vietnam', 'Fire', '114', 'fire', 'כיבוי אש', true),
  ('Vietnam', 'Tourist Police Hanoi', '+84-24-3942-3076', 'police', 'משטרת תיירים האנוי', true),
  ('Vietnam', 'Israeli Embassy Hanoi', '+84-24-3843-3140', 'embassy', 'שגרירות ישראל בהאנוי', true);
