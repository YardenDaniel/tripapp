-- =====================================================
-- Trip Invites (shareable join-by-link)
-- Run this in Supabase Dashboard → SQL Editor → New query
-- =====================================================

create table public.trip_invites (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  token text unique not null,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz default (now() + interval '30 days'),
  max_uses int,
  uses int default 0 not null,
  created_at timestamptz default now() not null
);

create index idx_trip_invites_token on public.trip_invites(token);
create index idx_trip_invites_trip on public.trip_invites(trip_id);

alter table public.trip_invites enable row level security;

-- Direct table access is restricted to trip members. Unauthenticated
-- visitors read invites only via the SECURITY DEFINER function below.
create policy "Members can view invites for their trips"
  on public.trip_invites for select using (public.is_trip_member(trip_id));

create policy "Members can create invites"
  on public.trip_invites for insert with check (
    public.is_trip_member(trip_id) and auth.uid() = created_by
  );

create policy "Creators can revoke their invites"
  on public.trip_invites for delete using (auth.uid() = created_by);


-- Returns enough information for an invite landing page to show the
-- visitor what trip they're being invited to, BEFORE they sign in.
-- Returns an empty result when the token doesn't exist (don't leak which
-- tokens are valid via different error messages).
create or replace function public.get_invite_preview(p_token text)
returns table (
  trip_name text,
  trip_country text,
  trip_start_date date,
  trip_end_date date,
  trip_cover_image_url text,
  inviter_name text,
  expired boolean
) as $$
declare
  v_invite public.trip_invites%rowtype;
begin
  select * into v_invite from public.trip_invites where token = p_token;
  if v_invite.id is null then
    return;
  end if;
  return query
    select
      t.name,
      t.country,
      t.start_date,
      t.end_date,
      t.cover_image_url,
      coalesce(p.full_name, p.email),
      (v_invite.expires_at is not null and v_invite.expires_at < now())
        or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses)
    from public.trips t
    left join public.profiles p on p.id = v_invite.created_by
    where t.id = v_invite.trip_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.get_invite_preview(text) to anon, authenticated;


-- Accept the invite as the currently-authenticated user. Idempotent —
-- a user clicking the same link twice just stays a member.
create or replace function public.accept_trip_invite(p_token text)
returns uuid as $$
declare
  v_invite public.trip_invites%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  select * into v_invite from public.trip_invites where token = p_token;
  if v_invite.id is null then
    raise exception 'This invite link is invalid';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'This invite has expired';
  end if;
  if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then
    raise exception 'This invite has reached its limit';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, v_user_id, 'editor')
  on conflict (trip_id, user_id) do nothing;

  update public.trip_invites set uses = uses + 1 where id = v_invite.id;

  return v_invite.trip_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.accept_trip_invite(text) to authenticated;
