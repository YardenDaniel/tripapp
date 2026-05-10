-- =====================================================
-- Expanded activity types
-- Run this in Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- Drop the old check constraint and recreate it with the expanded set
-- of allowed activity types. Existing rows with the old types remain
-- valid because all original values are kept in the new list.
alter table public.activities drop constraint activities_type_check;

alter table public.activities add constraint activities_type_check
  check (type in (
    'food',
    'lodging',
    'attraction',
    'transport',
    'other',
    'flight',
    'train',
    'shopping',
    'beach',
    'coffee',
    'hike',
    'adventure'
  ));
