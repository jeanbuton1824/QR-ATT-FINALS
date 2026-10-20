
import { parseQRPayload } from './qr';
import { supabase } from './supabase';
import type {
  StudentCourseYear,
  StudentDepartment,
  StudentSex,
} from './profiles';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  status: 'present';
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: parsed.message,
    };
  }

  if (!studentId) {
    return { success: false, message: 'Please sign in with a student account.' };
  }

  const { data, error } = await supabase.rpc('record_event_attendance', {
    p_event_code: parsed.payload.event,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : null;
  const eventTitle = result?.event_title ?? undefined;
  switch (result?.result) {
    case 'success':
      return {
        success: true,
        message: 'Attendance recorded!',
        eventTitle,
      };
    case 'duplicate':
      return {
        success: false,
        message: 'Already registered for this event.',
        eventTitle,
      };
    case 'not_started':
      return {
        success: false,
        message: 'Event has not started yet.',
        eventTitle,
      };
    case 'closed':
      return {
        success: false,
        message: 'Event is closed or has ended.',
        eventTitle,
      };
    case 'not_found':
      return {
        success: false,
        message: 'Event not found. Ask the event organizer to check the event setup.',
      };
    case 'unauthorized':
      return {
        success: false,
        message: 'Only a student account can record attendance.',
      };
    default:
      throw new Error('The attendance service returned an unexpected response.');
  }
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, attendance_status, events(event_code, title)')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
    status: row.attendance_status,
  }));
}

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  status: 'draft' | 'open' | 'closed';
  venue: string | null;
  description: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName: string | null;
    sex: StudentSex | null;
    department: StudentDepartment | null;
    courseYear: StudentCourseYear | null;
    block: string | null;
    scannedAt: string;
    status: 'present';
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  return getEventAttendance(teacherId);
}

export async function getAdminEventAttendance(): Promise<TeacherEventAttendance[]> {
  return getEventAttendance();
}

async function getEventAttendance(
  createdBy?: string
): Promise<TeacherEventAttendance[]> {
  let eventsQuery = supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, status, venue, description')
    .order('created_at', { ascending: false });

  if (createdBy) {
    eventsQuery = eventsQuery.eq('created_by', createdBy);
  }

  const { data: events, error: eventError } = await eventsQuery;

  if (eventError) throw eventError;

  const eventIds = (events ?? []).map((event: any) => event.id);

  if (eventIds.length === 0) {
    return [];
  }

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id, attendance_status')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attError) throw attError;

  const studentIds = [
    ...new Set(
      (attendance ?? []).map((record: any) => record.student_id)
    ),
  ];

  const { data: profilesData, error: profilesError } =
    studentIds.length > 0
      ? await supabase
          .from('profiles')
        .select('id, full_name, email, sex, department, course_year, block')
          .in('id', studentIds)
      : { data: [], error: null };
  if (profilesError) throw profilesError;

  const profilesById = new Map(
    (profilesData ?? []).map((profile: any) => [
      profile.id,
      profile,
    ])
  );

  const attendanceRows = attendance ?? [];

  return (events ?? []).map((event: any) => {
    const rows = attendanceRows.filter(
      (record: any) => record.event_id === event.id
    );

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      status: event.status,
      venue: event.venue,
      description: event.description,
      attendeeCount: rows.length,

      attendees: rows.map((record: any) => ({
        studentId: record.student_id,
        studentName:
          profilesById.get(record.student_id)?.full_name ?? null,
        sex: profilesById.get(record.student_id)?.sex ?? null,
        department: profilesById.get(record.student_id)?.department ?? null,
        courseYear: profilesById.get(record.student_id)?.course_year ?? null,
        block: profilesById.get(record.student_id)?.block ?? null,
        scannedAt: record.scanned_at,
        status: record.attendance_status,
      })),
    };
  });
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) {
    return [];
  }

  const eventIds = events.map((event: any) => event.id);

  if (eventIds.length === 0) {
    return [];
  }

  const { data: attRows, error: attError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    return [];
  }

  const counts: Record<string, number> = {};

  attRows.forEach((row: any) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}
