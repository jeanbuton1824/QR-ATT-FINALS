import { supabase } from './supabase';
import type {
  StudentCourseYear,
  StudentDepartment,
  StudentSex,
} from './profiles';

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'teacher' | 'admin';
  sex: StudentSex | null;
  department: StudentDepartment | null;
  course_year: StudentCourseYear | null;
  block: string | null;
  created_at: string;
};

export type AdminEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  status: 'draft' | 'open' | 'closed';
  created_by: string | null;
  created_at: string;
};

export type AdminAttendance = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
  attendance_status: 'present';
};

export type AttendanceAuditRecord = {
  id: string;
  attendance_id: string;
  event_id: string;
  student_id: string;
  action: 'removed';
  reason: string;
  performed_by: string;
  performed_at: string;
};

export type AdminDashboardData = {
  totals: {
    users: number;
    students: number;
    teachers: number;
    admins: number;
    events: number;
    attendance: number;
  };
  users: AdminProfile[];
  events: AdminEvent[];
  attendance: AdminAttendance[];
  attendanceAudit: AttendanceAuditRecord[];
};

async function countRows(table: 'profiles' | 'events' | 'attendance', role?: AdminProfile['role']) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (table === 'profiles' && role) {
    query = query.eq('role', role);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [usersResult, eventsResult, attendanceResult, auditResult, userCount, studentCount, teacherCount, adminCount, eventCount, attendanceCount] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, sex, department, course_year, block, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('events')
        .select('id, event_code, title, start_time, end_time, venue, description, status, created_by, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('attendance')
        .select('id, student_id, event_id, scanned_at, attendance_status')
        .order('scanned_at', { ascending: false })
        .limit(100),
      supabase
        .from('attendance_audit')
        .select('id, attendance_id, event_id, student_id, action, reason, performed_by, performed_at')
        .order('performed_at', { ascending: false })
        .limit(30),
      countRows('profiles'),
      countRows('profiles', 'student'),
      countRows('profiles', 'teacher'),
      countRows('profiles', 'admin'),
      countRows('events'),
      countRows('attendance'),
    ]);

  if (usersResult.error) throw usersResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (attendanceResult.error) throw attendanceResult.error;
  if (auditResult.error) throw auditResult.error;

  return {
    totals: {
      users: userCount,
      students: studentCount,
      teachers: teacherCount,
      admins: adminCount,
      events: eventCount,
      attendance: attendanceCount,
    },
    users: (usersResult.data ?? []) as AdminProfile[],
    events: (eventsResult.data ?? []) as AdminEvent[],
    attendance: (attendanceResult.data ?? []) as AdminAttendance[],
    attendanceAudit: (auditResult.data ?? []) as AttendanceAuditRecord[],
  };
}

export async function getAdminEvents(): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, venue, description, status, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as AdminEvent[];
}

export async function removeAttendanceRecord(
  attendanceId: string,
  reason: string
): Promise<'removed' | 'not_found'> {
  const { data, error } = await supabase.rpc('admin_remove_attendance', {
    p_attendance_id: attendanceId,
    p_reason: reason.trim(),
  });

  if (error) throw error;
  if (data === 'removed' || data === 'not_found') return data;
  throw new Error('The attendance correction returned an unexpected response.');
}

export async function changeProfileRole(
  profileId: string,
  role: 'student' | 'teacher'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', profileId);

  if (error) throw error;
}
