import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import CampusBackground from '@/components/CampusBackground';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getAdminDashboardData, type AdminDashboardData } from '@/lib/admin';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { getUpcomingEvents, type CloudEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';

type DashboardSelection =
  | { kind: 'event'; item: CloudEvent }
  | { kind: 'attendance'; item: AttendanceRecord };

type ManagedEventDetails = {
  key: string;
  title: string;
  eventCode: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  description: string | null;
  meta: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [selection, setSelection] = useState<DashboardSelection | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setDashboardError(null);
    try {
      const profile = await getProfile(user.id);
      setRole(profile?.role ?? null);
      setName(profile?.full_name?.trim() || 'there');

      if (profile?.role === 'teacher') {
        setTeacherEvents(await getTeacherEventAttendance(user.id));
        setAdminData(null);
        setRecords([]);
        setEvents([]);
      } else if (profile?.role === 'admin') {
        setAdminData(await getAdminDashboardData());
        setTeacherEvents([]);
        setRecords([]);
        setEvents([]);
      } else if (profile?.role === 'student') {
        const [history, upcomingEvents] = await Promise.all([
          getAttendanceHistory(user.id),
          getUpcomingEvents(),
        ]);
        setRecords(history);
        setEvents(upcomingEvents);
        setTeacherEvents([]);
        setAdminData(null);
        setEventsError(false);
      } else {
        setRecords([]);
        setEvents([]);
        setTeacherEvents([]);
        setAdminData(null);
      }
    } catch (error) {
      setEvents([]);
      setRecords([]);
      setTeacherEvents([]);
      setAdminData(null);
      setEventsError(true);
      setDashboardError(
        error instanceof Error ? error.message : 'Unable to load dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  if (role === null) {
    return (
      <CampusBackground>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.roleLoading}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <Ionicons
                name="alert-circle-outline"
                size={34}
                color={COLORS.danger}
              />
            )}
            <Text style={styles.roleLoadingTitle}>
              {loading ? 'Loading your dashboard...' : 'Account role unavailable'}
            </Text>
            <Text style={styles.roleLoadingText}>
              {loading
                ? 'Please wait while we verify your account.'
                : dashboardError || 'Ask an administrator to verify your account role.'}
            </Text>
          </View>
        </SafeAreaView>
      </CampusBackground>
    );
  }

  if (role === 'teacher') {
    return (
      <RoleDashboard
        role="teacher"
        name={name}
        loading={loading}
        error={dashboardError}
        events={teacherEvents}
        onProfile={() => router.push('/profile')}
        onPrimaryAction={() => router.push('/teacher')}
        onSecondaryAction={() => router.push('/history')}
      />
    );
  }

  if (role === 'admin') {
    return (
      <RoleDashboard
        role="admin"
        name={name}
        loading={loading}
        error={dashboardError}
        adminData={adminData}
        onProfile={() => router.push('/profile')}
        onPrimaryAction={() => router.push('/admin')}
        onSecondaryAction={() => router.push('/events')}
      />
    );
  }

  return (
    <CampusBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#B86ACD', '#815BC7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>CCTC  •  YOUR ATTENDANCE</Text>
              <Text style={styles.greeting}>Hello!</Text>
              <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
                {name}
              </Text>
              <Text style={styles.heroSubtitle}>Your campus day, at a glance.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile')}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {name === 'there' ? '?' : name.charAt(0).toUpperCase()}
              </Text>
              <View style={styles.avatarIndicator} />
            </Pressable>
          </View>
          <View style={styles.heroBottom}>
            <Ionicons name="sparkles" size={16} color="#FFE6F4" />
            <Text style={styles.heroFootnote}>Every check-in moves you forward.</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.attendedCard]}>
              <View style={[styles.summaryIcon, { backgroundColor: COLORS.softPink }]}>
                <Ionicons name="checkmark-done" size={19} color={COLORS.deepPink} />
              </View>
              <Text style={styles.summaryLabel}>Attended</Text>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.summaryValue}>
                  {dashboardError ? '—' : records.length}
                </Text>
              )}
            </View>
            <Pressable
              style={[styles.summaryCard, styles.actionSummary]}
              onPress={() => router.push('/history')}
              accessibilityRole="button"
            >
              <View style={[styles.summaryIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="time-outline" size={19} color={COLORS.deepPurple} />
              </View>
              <Text style={styles.summaryLabel}>My history</Text>
              <Text style={styles.summaryLink}>View records <Ionicons name="arrow-forward" size={13} /></Text>
            </Pressable>
          </View>

          {role === 'student' ? (
            <AppButton
              theme="primary"
              title="Scan QR Code"
              icon="qr-code-outline"
              onPress={() => router.push('/scan')}
            />
          ) : null}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Upcoming events</Text>
              <Text style={styles.sectionSubtitle}>Find your next campus moment</Text>
            </View>
            <View style={styles.sectionIcon}>
              <Ionicons name="calendar-outline" size={19} color={COLORS.deepPurple} />
            </View>
          </View>

          {loading ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.emptyText}>Finding events...</Text>
            </View>
          ) : eventsError ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cloud-offline-outline" size={26} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>Dashboard unavailable</Text>
              <Text style={styles.emptyText}>
                {dashboardError || 'Please check your connection and try again.'}
              </Text>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-clear-outline" size={23} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No upcoming events</Text>
              <Text style={styles.emptyText}>New events will appear here when they are announced.</Text>
            </View>
          ) : (
            events.map((event) => {
              const isUpcoming = Boolean(
                event.start_time && new Date(event.start_time).getTime() > Date.now()
              );
              return (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [styles.eventCard, pressed && styles.cardPressed]}
                  onPress={() => setSelection({ kind: 'event', item: event })}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${event.title}`}
                >
                  <View style={styles.eventIcon}>
                    <Ionicons name="calendar" size={20} color={COLORS.deepPink} />
                  </View>
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventMeta}>
                      {event.start_time ? formatDate(event.start_time) : 'Time to be announced'}
                    </Text>
                    {event.venue ? (
                      <Text style={styles.eventMeta}>Venue: {event.venue}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.openBadge, isUpcoming && styles.upcomingBadge]}>
                    <Text style={[styles.openBadgeText, isUpcoming && styles.upcomingBadgeText]}>
                      {isUpcoming ? 'UPCOMING' : 'OPEN'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Recent attendance</Text>
              <Text style={styles.sectionSubtitle}>Your latest check-ins</Text>
            </View>
            <Pressable onPress={() => router.push('/history')} accessibilityRole="button">
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {records.slice(0, 3).map((record) => (
            <Pressable
              key={record.id}
              style={({ pressed }) => [styles.recordCard, pressed && styles.cardPressed]}
              onPress={() => setSelection({ kind: 'attendance', item: record })}
              accessibilityRole="button"
              accessibilityLabel={`View attendance details for ${record.eventTitle || 'event'}`}
            >
              <View style={styles.recordIcon}>
                <Ionicons name="checkmark" size={18} color={COLORS.success} />
              </View>
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle}>{record.eventTitle || 'Attendance recorded'}</Text>
                <Text style={styles.eventMeta}>{formatDate(record.scannedAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </Pressable>
          ))}
          {!loading && records.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Your completed check-ins will show up here.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <Modal
        visible={selection !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelection(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelection(null)}
            accessibilityRole="button"
            accessibilityLabel="Close details"
          />
          {selection ? (
            <View style={styles.detailCard}>
              <Pressable
                style={styles.closeButton}
                onPress={() => setSelection(null)}
                accessibilityRole="button"
                accessibilityLabel="Close details"
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
              <View style={styles.detailIcon}>
                <Ionicons
                  name={selection.kind === 'event' ? 'calendar' : 'checkmark'}
                  size={22}
                  color={selection.kind === 'event' ? COLORS.deepPink : COLORS.success}
                />
              </View>
              <Text style={styles.detailTitle}>
                {selection.kind === 'event' ? selection.item.title : selection.item.eventTitle || 'Attendance recorded'}
              </Text>
              {selection.kind === 'event' ? (
                <>
                  <Text style={styles.detailLabel}>Event code</Text>
                  <Text style={styles.detailValue}>{selection.item.event_code}</Text>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>
                    {selection.item.start_time && new Date(selection.item.start_time).getTime() > Date.now()
                      ? 'Upcoming'
                      : selection.item.status}
                  </Text>
                  {selection.item.start_time ? (
                    <>
                      <Text style={styles.detailLabel}>Starts</Text>
                      <Text style={styles.detailValue}>{formatDate(selection.item.start_time)}</Text>
                    </>
                  ) : null}
                  {selection.item.end_time ? (
                    <>
                      <Text style={styles.detailLabel}>Ends</Text>
                      <Text style={styles.detailValue}>{formatDate(selection.item.end_time)}</Text>
                    </>
                  ) : null}
                  {selection.item.venue ? (
                    <>
                      <Text style={styles.detailLabel}>Venue</Text>
                      <Text style={styles.detailValue}>{selection.item.venue}</Text>
                    </>
                  ) : null}
                  {selection.item.description ? (
                    <>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>{selection.item.description}</Text>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.detailLabel}>Event code</Text>
                  <Text style={styles.detailValue}>{selection.item.eventId || 'Not available'}</Text>
                  <Text style={styles.detailLabel}>Checked in</Text>
                  <Text style={styles.detailValue}>{formatDate(selection.item.scannedAt)}</Text>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>
                    {selection.item.status.charAt(0).toUpperCase() + selection.item.status.slice(1)}
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </View>
      </Modal>
      </SafeAreaView>
    </CampusBackground>
  );
}

function RoleDashboard({
  role,
  name,
  loading,
  error,
  events,
  adminData,
  onProfile,
  onPrimaryAction,
  onSecondaryAction,
}: {
  role: 'teacher' | 'admin';
  name: string;
  loading: boolean;
  error: string | null;
  events?: TeacherEventAttendance[];
  adminData?: AdminDashboardData | null;
  onProfile: () => void;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<ManagedEventDetails | null>(null);
  const isTeacher = role === 'teacher';
  const teacherEvents = events ?? [];
  const eventItems = isTeacher
    ? teacherEvents.slice(0, 4).map((event) => ({
        key: event.eventId,
        title: event.title,
        eventCode: event.eventCode,
        status: event.status,
        startTime: event.startTime,
        endTime: event.endTime,
        venue: event.venue,
        description: event.description,
        meta: `${event.attendeeCount} student check-in${event.attendeeCount === 1 ? '' : 's'}`,
      }))
    : (adminData?.events ?? []).slice(0, 4).map((event) => ({
        key: event.id,
        title: event.title,
        eventCode: event.event_code,
        status: event.status,
        startTime: event.start_time,
        endTime: event.end_time,
        venue: event.venue,
        description: event.description,
        meta: event.venue || 'Venue not set',
      }));
  const metrics = isTeacher
    ? [
        { label: 'My events', value: teacherEvents.length, icon: 'calendar-outline' as const },
        {
          label: 'Open now',
          value: teacherEvents.filter((event) => event.status === 'open').length,
          icon: 'radio-button-on-outline' as const,
        },
        {
          label: 'Check-ins',
          value: teacherEvents.reduce((total, event) => total + event.attendeeCount, 0),
          icon: 'people-outline' as const,
        },
      ]
    : [
        { label: 'Users', value: adminData?.totals.users ?? 0, icon: 'people-outline' as const },
        { label: 'Events', value: adminData?.totals.events ?? 0, icon: 'calendar-outline' as const },
        {
          label: 'Check-ins',
          value: adminData?.totals.attendance ?? 0,
          icon: 'checkmark-done-outline' as const,
        },
      ];

  return (
    <CampusBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#B86ACD', '#815BC7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>
                  {isTeacher ? 'TEACHER DASHBOARD' : 'ADMIN DASHBOARD'}
                </Text>
                <Text style={styles.greeting}>Hello!</Text>
                <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
                  {name}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {isTeacher
                    ? 'Your events and student attendance.'
                    : 'System activity and campus-wide attendance.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={onProfile}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {name === 'there' ? '?' : name.charAt(0).toUpperCase()}
                </Text>
                <View style={styles.avatarIndicator} />
              </Pressable>
            </View>
            <View style={styles.heroBottom}>
              <Ionicons
                name={isTeacher ? 'briefcase-outline' : 'analytics-outline'}
                size={16}
                color="#FFE6F4"
              />
              <Text style={styles.heroFootnote}>
                {isTeacher
                  ? 'Keep your events and check-ins on track.'
                  : 'Monitor users, events, and attendance.'}
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>
                  {isTeacher ? 'Your teaching overview' : 'System overview'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {isTeacher ? 'Activity from your events' : 'Campus-wide totals'}
                </Text>
              </View>
              <View style={styles.sectionIcon}>
                <Ionicons
                  name={isTeacher ? 'briefcase-outline' : 'analytics-outline'}
                  size={19}
                  color={COLORS.deepPurple}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.dashboardError}>
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
                <Text style={styles.dashboardErrorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.roleMetrics}>
              {metrics.map((metric) => (
                <View key={metric.label} style={styles.roleMetricCard}>
                  <View style={styles.roleMetricIcon}>
                    <Ionicons name={metric.icon} size={18} color={COLORS.deepPurple} />
                  </View>
                  <Text style={styles.roleMetricValue}>
                    {loading ? '—' : metric.value.toLocaleString()}
                  </Text>
                  <Text style={styles.roleMetricLabel}>{metric.label}</Text>
                </View>
              ))}
            </View>

            {!isTeacher && adminData ? (
              <View style={styles.roleBreakdown}>
                <RoleCount label="Students" value={adminData.totals.students} />
                <RoleCount label="Teachers" value={adminData.totals.teachers} />
                <RoleCount label="Admins" value={adminData.totals.admins} />
              </View>
            ) : null}

            <View style={styles.roleActions}>
              <RoleAction
                title={isTeacher ? 'Manage my events' : 'Users & reports'}
                subtitle={
                  isTeacher
                    ? 'Create and manage your events'
                    : 'Manage accounts and attendance'
                }
                icon={isTeacher ? 'calendar-outline' : 'shield-checkmark-outline'}
                onPress={onPrimaryAction}
              />
              <RoleAction
                title={isTeacher ? 'Attendance' : 'Manage events'}
                subtitle={
                  isTeacher
                    ? 'Review student check-ins'
                    : 'Review campus events'
                }
                icon={isTeacher ? 'list-outline' : 'calendar-outline'}
                onPress={onSecondaryAction}
              />
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>
                  {isTeacher ? 'My recent events' : 'Recent events'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {isTeacher
                    ? 'Check-in totals for your events'
                    : 'Latest activity across campus'}
                </Text>
              </View>
              <Pressable onPress={onSecondaryAction} accessibilityRole="button">
                <Text style={styles.seeAll}>{isTeacher ? 'Manage' : 'View all'}</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.emptyText}>Loading dashboard data...</Text>
              </View>
            ) : eventItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {isTeacher ? 'No events yet' : 'No events to show'}
                </Text>
                <Text style={styles.emptyText}>
                  {isTeacher
                    ? 'Create an event to start collecting student attendance.'
                    : 'Campus events will appear here once they are created.'}
                </Text>
              </View>
            ) : (
              eventItems.map((event) => (
                <View key={event.key} style={styles.eventCard}>
                  <View style={styles.eventIcon}>
                    <Ionicons name="calendar" size={20} color={COLORS.deepPurple} />
                  </View>
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventMeta}>{event.meta}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.openDetailButton,
                      pressed && styles.openDetailButtonPressed,
                    ]}
                    onPress={() => setSelectedEvent(event)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open details for ${event.title}`}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="open-outline"
                      size={20}
                      color={COLORS.deepPurple}
                    />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </ScrollView>
        <Modal
          visible={selectedEvent !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedEvent(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setSelectedEvent(null)}
              accessibilityRole="button"
              accessibilityLabel="Close event details"
            />
            {selectedEvent ? (
              <View style={styles.detailCard}>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setSelectedEvent(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close event details"
                >
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </Pressable>
                <View style={styles.detailIcon}>
                  <Ionicons name="calendar" size={22} color={COLORS.deepPurple} />
                </View>
                <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
                <Text style={styles.detailLabel}>Event code</Text>
                <Text style={styles.detailValue}>{selectedEvent.eventCode}</Text>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>
                  {selectedEvent.status.charAt(0).toUpperCase() +
                    selectedEvent.status.slice(1)}
                </Text>
                {selectedEvent.startTime ? (
                  <>
                    <Text style={styles.detailLabel}>Starts</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedEvent.startTime)}
                    </Text>
                  </>
                ) : null}
                {selectedEvent.endTime ? (
                  <>
                    <Text style={styles.detailLabel}>Ends</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedEvent.endTime)}
                    </Text>
                  </>
                ) : null}
                {selectedEvent.venue ? (
                  <>
                    <Text style={styles.detailLabel}>Venue</Text>
                    <Text style={styles.detailValue}>{selectedEvent.venue}</Text>
                  </>
                ) : null}
                {selectedEvent.description ? (
                  <>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>
                      {selectedEvent.description}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </Modal>
      </SafeAreaView>
    </CampusBackground>
  );
}

function RoleAction({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: 'calendar-outline' | 'shield-checkmark-outline' | 'list-outline';
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.roleAction}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.roleActionIcon}>
        <Ionicons name={icon} size={19} color={COLORS.deepPurple} />
      </View>
      <Text style={styles.roleActionTitle}>{title}</Text>
      <Text style={styles.roleActionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function RoleCount({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.roleCount}>
      <Text style={styles.roleCountValue}>{value.toLocaleString()}</Text>
      <Text style={styles.roleCountLabel}>{label}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  roleLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  roleLoadingTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  roleLoadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 24 },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCopy: { flex: 1, paddingRight: 14 },
  eyebrow: {
    color: '#FFE6F4',
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: '800',
    marginBottom: 11,
  },
  greeting: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 16,
    fontWeight: '600',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  heroSubtitle: {
    color: '#FFF0F8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D1747',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  avatarIndicator: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#A9F0C5',
    borderWidth: 2,
    borderColor: '#9562C5',
  },
  heroBottom: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroFootnote: {
    color: '#FFFFFF',
    fontSize: 11,
    marginLeft: 7,
    fontWeight: '600',
  },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  summaryRow: { flexDirection: 'row', marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    minHeight: 117,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  attendedCard: { marginRight: 10 },
  actionSummary: { marginLeft: 0 },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 8, fontWeight: '600' },
  summaryValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 1 },
  summaryLink: { color: COLORS.deepPurple, fontSize: 12, marginTop: 5, fontWeight: '700' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.lavender, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    minHeight: 112,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.softPink, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 9 },
  emptyText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardPressed: { opacity: 0.82 },
  eventIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.softPink, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  eventCopy: { flex: 1 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  eventMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
  openBadge: { backgroundColor: '#E8F7ED', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  openBadgeText: { color: COLORS.success, fontSize: 9, letterSpacing: 0.4, fontWeight: '800' },
  upcomingBadge: { backgroundColor: COLORS.lavender },
  upcomingBadgeText: { color: COLORS.deepPurple },
  seeAll: { color: COLORS.deepPurple, fontSize: 12, fontWeight: '700' },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recordIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E8F7ED', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  roleMetrics: { flexDirection: 'row', marginHorizontal: -4 },
  roleMetricCard: {
    flex: 1,
    minHeight: 120,
    marginHorizontal: 4,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: COLORS.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleMetricValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
  },
  roleMetricLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  roleBreakdown: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    marginTop: 10,
    paddingVertical: 13,
  },
  roleCount: { flex: 1, alignItems: 'center' },
  roleCountValue: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
  roleCountLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  roleActions: { flexDirection: 'row', marginHorizontal: -5, marginTop: 14 },
  roleAction: {
    flex: 1,
    minHeight: 135,
    marginHorizontal: 5,
    padding: 13,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.softPink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  roleActionTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  roleActionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  openDetailButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.softPink,
  },
  openDetailButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
  dashboardError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#F2C9CE',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  dashboardErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(28,18,36,0.5)',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  closeButton: { alignSelf: 'flex-end', padding: 4 },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.softPink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detailTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  detailLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 9 },
  detailValue: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 2 },
});
