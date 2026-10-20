-- Run after admin-access.sql to enable validated event management and check-in.

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication is required for attendance monitoring';
  elsif not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
end;
$$;

alter table public.profiles
  add column if not exists sex text,
  add column if not exists department text,
  add column if not exists course_year text,
  add column if not exists block text;

alter table public.profiles
  drop constraint if exists profiles_sex_check,
  drop constraint if exists profiles_department_check,
  drop constraint if exists profiles_course_year_check;

alter table public.attendance
  add column if not exists attendance_status text not null default 'present';

alter table public.attendance
  drop constraint if exists attendance_attendance_status_check;

alter table public.attendance
  add constraint attendance_attendance_status_check
    check (attendance_status = 'present');

alter table public.profiles
  add constraint profiles_sex_check
    check (sex is null or sex in ('Female', 'Male')),
  add constraint profiles_department_check
    check (department is null or department in ('BSED', 'BSIT', 'BSHM', 'BSENTREP')),
  add constraint profiles_course_year_check
    check (
      course_year is null
      or course_year in ('First Year', 'Second Year', 'Third Year', 'Fourth Year')
    );

alter table public.events
  add column if not exists venue text,
  add column if not exists description text,
  add column if not exists status text not null default 'open';

alter table public.events
  drop constraint if exists events_status_check;

alter table public.events
  add constraint events_status_check
  check (status in ('draft', 'open', 'closed'));

alter table public.events
  drop constraint if exists events_valid_time_range;

alter table public.events
  add constraint events_valid_time_range
  check (
    start_time is null
    or end_time is null
    or end_time > start_time
  );

create or replace function public.current_user_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'teacher'
  );
$$;

revoke all on function public.current_user_is_teacher() from public;
grant execute on function public.current_user_is_teacher() to authenticated;

drop policy if exists "Teachers can view students attending their events" on public.profiles;
create policy "Teachers can view students attending their events"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_is_teacher()
    and exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id
        and e.created_by = auth.uid()
    )
  );

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events"
  on public.attendance for select
  to authenticated
  using (
    public.current_user_is_teacher()
    and exists (
      select 1
      from public.events e
      where e.id = attendance.event_id
        and e.created_by = auth.uid()
    )
  );

drop policy if exists "Teachers and administrators can create events" on public.events;
create policy "Teachers and administrators can create events"
  on public.events for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.current_user_is_teacher()
      or public.current_user_is_admin()
    )
  );

drop policy if exists "Teachers manage their events and administrators manage all events" on public.events;
create policy "Teachers manage their events and administrators manage all events"
  on public.events for update
  to authenticated
  using (
    public.current_user_is_admin()
    or (
      public.current_user_is_teacher()
      and created_by = auth.uid()
    )
  )
  with check (
    public.current_user_is_admin()
    or (
      public.current_user_is_teacher()
      and created_by = auth.uid()
    )
  );

drop policy if exists "Administrators can update user profiles" on public.profiles;
create policy "Administrators can update user profiles"
  on public.profiles for update
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Students can record their own attendance" on public.attendance;
revoke insert, update, delete on table public.attendance from public, anon, authenticated;
create unique index if not exists attendance_one_checkin_per_event
  on public.attendance (student_id, event_id);

create or replace function public.record_event_attendance(p_event_code text)
returns table (result text, event_title text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_student_id uuid := auth.uid();
begin
  if v_student_id is null or not public.current_user_is_student() then
    return query select 'unauthorized'::text, null::text;
    return;
  end if;

  select e.*
    into v_event
    from public.events e
    where e.event_code = trim(p_event_code)
    for share;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if v_event.status <> 'open' then
    return query select 'closed'::text, v_event.title;
    return;
  end if;

  if v_event.start_time is not null and now() < v_event.start_time then
    return query select 'not_started'::text, v_event.title;
    return;
  end if;

  if v_event.end_time is not null and now() > v_event.end_time then
    return query select 'closed'::text, v_event.title;
    return;
  end if;

  begin
    insert into public.attendance (student_id, event_id)
    values (v_student_id, v_event.id);
  exception
    when unique_violation then
      return query select 'duplicate'::text, v_event.title;
      return;
  end;

  return query select 'success'::text, v_event.title;
end;
$$;

revoke all on function public.record_event_attendance(text) from public;
grant execute on function public.record_event_attendance(text) to authenticated;

create table if not exists public.attendance_audit (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null,
  event_id uuid not null,
  student_id uuid not null,
  action text not null check (action = 'removed'),
  reason text not null,
  performed_by uuid not null references public.profiles(id),
  performed_at timestamptz not null default now()
);

alter table public.attendance_audit enable row level security;
revoke all on public.attendance_audit from anon, authenticated;
grant select on public.attendance_audit to authenticated;

drop policy if exists "Administrators can view attendance audit" on public.attendance_audit;
create policy "Administrators can view attendance audit"
  on public.attendance_audit for select
  to authenticated
  using (public.current_user_is_admin());

create or replace function public.admin_remove_attendance(
  p_attendance_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attendance public.attendance%rowtype;
  v_reason text := trim(p_reason);
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if length(v_reason) < 5 then
    raise exception 'Provide a correction reason with at least 5 characters';
  end if;

  delete from public.attendance
    where id = p_attendance_id
    returning * into v_attendance;

  if not found then
    return 'not_found';
  end if;

  insert into public.attendance_audit (
    attendance_id,
    event_id,
    student_id,
    action,
    reason,
    performed_by
  )
  values (
    v_attendance.id,
    v_attendance.event_id,
    v_attendance.student_id,
    'removed',
    v_reason,
    auth.uid()
  );

  return 'removed';
end;
$$;

revoke all on function public.admin_remove_attendance(uuid, text) from public;
grant execute on function public.admin_remove_attendance(uuid, text) to authenticated;
