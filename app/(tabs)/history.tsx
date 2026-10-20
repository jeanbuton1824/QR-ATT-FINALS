
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import ScreenHeader from '@/components/ScreenHeader';
import CampusBackground from '@/components/CampusBackground';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAdminEventAttendance,
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { getProfile, type Role } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

export default function HistoryScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveUpdateError, setLiveUpdateError] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? 'student';

      setRole(currentRole);

      if (currentRole === 'admin') {
        const events = await getAdminEventAttendance();
        setTeacherEvents(events);
        setStudentRecords([]);
      } else if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(user.id);
        setTeacherEvents(events);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(user.id);
        setStudentRecords(records);
        setTeacherEvents([]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load attendance history.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!user || (role !== 'teacher' && role !== 'admin')) return;

    const channel = supabase
      .channel(`event-attendance:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          void load();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance' },
        () => {
          void load();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLiveUpdateError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setLiveUpdateError(
            'Live attendance updates are unavailable. Reopen this tab to refresh.'
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, role, user]);

  if (loading) {
    return (
      <CampusBackground>
        <View style={styles.container}>
          <ScreenHeader
            title="Attendance history"
            subtitle="Your attendance at a glance"
            icon="time-outline"
          />
          <Text style={styles.subtitle}>Loading records...</Text>
        </View>
      </CampusBackground>
    );
  }

  if (error) {
    return (
      <CampusBackground>
        <View style={styles.container}>
          <ScreenHeader
            title="Attendance history"
            subtitle="Your attendance at a glance"
            icon="time-outline"
          />
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Could not load attendance</Text>
            <Text style={styles.subtitle}>{error}</Text>
          </View>
        </View>
      </CampusBackground>
    );
  }

  // Event manager view for teachers and administrators.
  if (role === 'teacher' || role === 'admin') {
    return (
      <CampusBackground>
        <View style={styles.container}>
          <ScreenHeader
            title="Attendance history"
            subtitle={
              role === 'admin'
                ? 'Your events and student check-ins'
                : 'Events and student check-ins'
            }
            icon="time-outline"
          />

          {liveUpdateError ? (
            <View style={styles.emptyCard}>
              <Text style={styles.subtitle}>{liveUpdateError}</Text>
            </View>
          ) : null}

          {teacherEvents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No event records yet</Text>
              <Text style={styles.subtitle}>
                {role === 'admin'
                  ? 'Events and attendance records will appear here when available.'
                  : 'Create an event from the Create Event tab to see attendance here.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={teacherEvents}
              keyExtractor={(item) => item.eventId}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{item.attendeeCount}</Text>
                    </View>
                  </View>

                  <Text style={styles.eventMeta}>{item.eventCode}</Text>

                  {item.startTime ? (
                    <Text style={styles.eventMeta}>
                      {formatDate(item.startTime)}
                    </Text>
                  ) : null}

                  {item.venue ? (
                    <Text style={styles.eventMeta}>Venue: {item.venue}</Text>
                  ) : null}

                  {item.attendees.length === 0 ? (
                    <Text style={styles.attendeeEmpty}>No attendees yet.</Text>
                  ) : (
                    <View style={styles.attendeeList}>
                      {item.attendees.map((attendee) => (
                        <View
                          key={attendee.studentId}
                          style={styles.attendeeRow}
                        >
                          <Text style={styles.attendeeName}>
                            {attendee.studentName ||
                              shortId(attendee.studentId)}
                          </Text>

                          <Text style={styles.eventMeta}>
                            {[
                              attendee.sex && `Sex: ${attendee.sex}`,
                              attendee.department &&
                                `Department: ${attendee.department}`,
                              attendee.courseYear &&
                                `Course Year: ${attendee.courseYear}`,
                              attendee.block && `Block: ${attendee.block}`,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Student details not provided'}
                          </Text>

                          <Text style={styles.eventMeta}>
                            {formatDate(attendee.scannedAt)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </CampusBackground>
    );
  }

  // STUDENT VIEW
  return (
    <CampusBackground>
      <View style={styles.container}>
        <ScreenHeader
          title="Attendance history"
          subtitle="Your attendance at a glance"
          icon="time-outline"
        />

        {studentRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No records yet</Text>
            <Text style={styles.subtitle}>
              Scan an event QR code to register your attendance.
            </Text>
          </View>
        ) : (
          <FlatList
            data={studentRecords}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.eventTitle}>{item.eventTitle}</Text>
                <Text style={styles.eventMeta}>{item.eventId}</Text>
                <Text style={styles.eventMeta}>
                  {formatDate(item.scannedAt)}
                </Text>
                <Text style={styles.presentStatus}>
                  Status:{' '}
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </CampusBackground>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 0,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  list: {
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
    flex: 1,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: COLORS.softPink,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.deepPink,
  },
  attendeeList: {
    marginTop: 12,
  },
  attendeeRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 10,
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  presentStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: 5,
  },
  attendeeEmpty: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptyCard: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  adminIcon: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.deepPink,
    marginBottom: 8,
  },
  adminNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 4,
  },
});
