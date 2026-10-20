import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue: string;
  description: string;
};

export type EventStatus = 'draft' | 'open' | 'closed';

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
};

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('events').insert({
      event_code: event.eventId,
      title: event.title,
      start_time: event.start || null,
      end_time: event.end || null,
      venue: event.venue || null,
      description: event.description || null,
      status: 'open',
      created_by: user?.id ?? null,
    }).select('id').single();

  return { error: error?.message ?? null };
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []) as CloudEvent[];
}

export async function getUpcomingEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, venue, description, status, created_by, created_at')
    .gte('end_time', new Date().toISOString())
    .eq('status', 'open')
    .order('start_time', { ascending: true })
    .limit(5);

  if (error) {
    throw error;
  }

  return (data ?? []) as CloudEvent[];
}

export async function getAvailableEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, venue, description, status, created_by, created_at')
    .eq('status', 'open')
    .or(`end_time.is.null,end_time.gte.${new Date().toISOString()}`)
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CloudEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CloudEvent | null;
}

export async function closeEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'closed' })
    .eq('id', eventId)
    .select('id')
    .single();

  if (error) throw error;
}

export async function updateEvent(
  id: string,
  event: Event
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .update({
      event_code: event.eventId,
      title: event.title,
      start_time: event.start || null,
      end_time: event.end || null,
      venue: event.venue || null,
      description: event.description || null,
    })
    .eq('id', id)
    .select('id')
    .single();

  return { error: error?.message ?? null };
}
