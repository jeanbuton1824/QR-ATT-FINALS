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
import { getAttendanceHistory, type AttendanceRecord } from '@/lib/attendance';
import { getUpcomingEvents, type CloudEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';

type DashboardSelection =
  | { kind: 'event'; item: CloudEvent }
  | { kind: 'attendance'; item: AttendanceRecord };

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
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
      const [profile, history, upcomingEvents] = await Promise.all([
        getProfile(user.id),
        getAttendanceHistory(user.id),
        getUpcomingEvents(),
      ]);
      setRole(profile?.role ?? null);
      setName(profile?.full_name?.trim() || 'there');
      setRecords(history);
      setEvents(upcomingEvents);
      setEventsError(false);
    } catch (error) {
      setEvents([]);
      setRecords([]);
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
