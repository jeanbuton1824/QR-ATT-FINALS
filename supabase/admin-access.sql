-- Run this in the Supabase SQL Editor before provisioning an administrator.
-- Public sign-up remains limited to student/teacher roles.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

create or replace function public.current_user_is_admin()
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
      and role = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.current_user_is_student()
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
      and role = 'student'
  );
$$;

revoke all on function public.current_user_is_student() from public;
grant execute on function public.current_user_is_student() to authenticated;

create or replace function public.prevent_unprivileged_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role is distinct from new.role
     and session_user not in ('postgres', 'service_role')
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.current_user_is_admin() then
    raise exception 'Only an administrator can change user roles';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_unprivileged_admin_role_change on public.profiles;
create trigger prevent_unprivileged_admin_role_change
  before update of role on public.profiles
  for each row
  execute function public.prevent_unprivileged_admin_role_change();

drop policy if exists "Administrators can view all profiles" on public.profiles;
create policy "Administrators can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.current_user_is_admin());

drop policy if exists "Administrators can view all events" on public.events;
create policy "Administrators can view all events"
  on public.events for select
  to authenticated
  using (public.current_user_is_admin());

drop policy if exists "Authenticated users can view events" on public.events;
create policy "Authenticated users can view events"
  on public.events for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "Administrators can create events" on public.events;
create policy "Administrators can create events"
  on public.events for insert
  to authenticated
  with check (
    public.current_user_is_admin()
    and created_by = auth.uid()
  );

drop policy if exists "Administrators can view all attendance" on public.attendance;
create policy "Administrators can view all attendance"
  on public.attendance for select
  to authenticated
  using (public.current_user_is_admin());

drop policy if exists "Students can record their own attendance" on public.attendance;
create policy "Students can record their own attendance"
  on public.attendance for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and public.current_user_is_student()
  );

-- After running the setup above, promote one known existing account from the
-- SQL Editor (not from the public app):
-- update public.profiles set role = 'admin' where email = 'trusted-admin@example.edu';
