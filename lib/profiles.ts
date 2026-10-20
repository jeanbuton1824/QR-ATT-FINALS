
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';
export type StudentSex = 'Female' | 'Male';
export type StudentDepartment = 'BSED' | 'BSIT' | 'BSHM' | 'BSENTREP';
export type StudentCourseYear =
  | 'First Year'
  | 'Second Year'
  | 'Third Year'
  | 'Fourth Year';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  sex: StudentSex | null;
  department: StudentDepartment | null;
  course_year: StudentCourseYear | null;
  block: string | null;
};

const roleListeners = new Set<() => void>();
let profileRoles: Record<string, Role> = {};

function notifyRoleListeners() {
  roleListeners.forEach((listener) => listener());
}

function subscribeToRoles(listener: () => void) {
  roleListeners.add(listener);
  return () => roleListeners.delete(listener);
}

export function useProfileRole(userId: string | undefined): Role | null {
  return useSyncExternalStore(
    subscribeToRoles,
    () => (userId ? profileRoles[userId] ?? null : null),
    () => (userId ? profileRoles[userId] ?? null : null)
  );
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, sex, department, course_year, block')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const profile = data as Profile;
  if (profileRoles[userId] !== profile.role) {
    profileRoles = { ...profileRoles, [userId]: profile.role };
    notifyRoleListeners();
  }

  return profile;
}

export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    sex?: StudentSex;
    department?: StudentDepartment;
    course_year?: StudentCourseYear;
    block?: string;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}
