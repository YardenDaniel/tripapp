-- Enable realtime broadcasts for trip_members so MembersTab's
-- subscription receives INSERT/DELETE events when invitees join or
-- are removed. Without this, the membership list only refreshes when
-- the component remounts.
alter publication supabase_realtime add table public.trip_members;
