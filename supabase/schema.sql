-- Base schema and owner-scoped policies for QR-ATT.
-- Run before admin-access.sql and project-requirements.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student'
    check (role in ('student', 'teacher')),
  sex text,
  department text,
  course_year text,
  block text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  venue text,
  description text,
  status text not null default 'open'
    check (status in ('draft', 'open', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint events_valid_time_range
    check (start_time is null or end_time is null or end_time > start_time)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  attendance_status text not null default 'present'
    check (attendance_status = 'present'),
  constraint attendance_one_checkin_per_event unique (student_id, event_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case when requested_role = 'teacher' then 'teacher' else 'student' end
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Authenticated users can view events" on public.events;
create policy "Authenticated users can view events"
  on public.events for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance"
  on public.attendance for select
  to authenticated
  using (auth.uid() = student_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.events to authenticated;
grant select on public.attendance to authenticated;
revoke insert, update, delete on public.attendance from anon, authenticated;
