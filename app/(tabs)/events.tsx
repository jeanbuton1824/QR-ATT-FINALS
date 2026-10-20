import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import CampusBackground from '@/components/CampusBackground';
import ScreenHeader from '@/components/ScreenHeader';
import { COLORS } from '@/constants/colors';
import { closeEvent, createEvent } from '@/lib/events';
import { getEventsByTeacher } from '@/lib/events';
import { getAdminEvents, type AdminEvent } from '@/lib/admin';
import { getProfile, type Role } from '@/lib/profiles';
import { useAuth } from '@/lib/auth';
import { buildQRPayload } from '@/lib/qr';

export default function AdminEventsScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? null;
      setRole(currentRole);
      if (currentRole === 'admin') {
        setEvents(await getAdminEvents());
      } else if (currentRole === 'teacher') {
        setEvents(await getEventsByTeacher(user.id));
      } else {
        setEvents([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load events.');
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const handleCreateEvent = async () => {
    const cleanTitle = title.trim();
    const cleanCode = eventCode.trim().toUpperCase();
    if (!cleanTitle || !cleanCode) {
      setMessage('Enter an event title and unique event code.');
      setMessageIsError(true);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await createEvent({
        eventId: cleanCode,
        title: cleanTitle,
        start: '',
        end: '',
        venue: venue.trim(),
        description: description.trim(),
      });
      if (result.error) throw new Error(result.error);
      setTitle('');
      setEventCode('');
      setVenue('');
      setDescription('');
      setMessage('Event created. Generate its QR code from the event list.');
      setMessageIsError(false);
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create event.');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseEvent = async (event: AdminEvent) => {
    setMessage(null);
    try {
      await closeEvent(event.id);
      setMessage(`${event.title} is now closed.`);
      setMessageIsError(false);
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to close event.');
      setMessageIsError(true);
    }
  };

  return (
    <CampusBackground>
      <View style={styles.page}>
        <ScreenHeader
          title="Events"
            icon="calendar-outline"
        />
        {role !== 'admin' && role !== 'teacher' && !loading ? (
          <View style={styles.noticeCard}>
            <Ionicons name="lock-closed-outline" size={24} color={COLORS.deepPurple} />
            <Text style={styles.sectionTitle}>Teachers and Admins Only</Text>
            <Text style={styles.bodyText}>
              Event management is available to teacher and administrator accounts.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <>
                <View style={styles.statsCard}>
                  <Ionicons name="calendar" size={20} color={COLORS.deepPurple} />
                  <Text style={styles.statsText}>{events.length} recent events</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Refresh events"
                    onPress={loadEvents}
                    style={styles.refresh}
                  >
                    <Ionicons name="refresh-outline" size={19} color={COLORS.deepPurple} />
                  </Pressable>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.sectionTitle}>Create an event</Text>
                  <Text style={styles.bodyText}>Add the event details, then generate a QR code for check-in.</Text>
                  <Text style={styles.label}>Event title</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Campus orientation"
                    placeholderTextColor={COLORS.textSecondary}
                    editable={!saving}
                  />
                  <Text style={styles.label}>Unique event code</Text>
                  <TextInput
                    style={styles.input}
                    value={eventCode}
                    onChangeText={(value) => setEventCode(value.toUpperCase())}
                    placeholder="e.g. EVT-2026-001"
                    placeholderTextColor={COLORS.textSecondary}
                    autoCapitalize="characters"
                    editable={!saving}
                  />
                  <Text style={styles.label}>Venue</Text>
                  <TextInput
                    style={styles.input}
                    value={venue}
                    onChangeText={setVenue}
                    placeholder="e.g. Main auditorium"
                    placeholderTextColor={COLORS.textSecondary}
                    editable={!saving}
                  />
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.description]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Event details"
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    textAlignVertical="top"
                    editable={!saving}
                  />
                  {message ? (
                    <Text style={[styles.message, messageIsError && styles.error]}>
                      {message}
                    </Text>
                  ) : null}
                  <AppButton
                    theme="primary"
                    title="Create Event"
                    icon="add-circle-outline"
                    onPress={handleCreateEvent}
                    loading={saving}
                    disabled={saving}
                  />
                </View>

                <Text style={styles.sectionTitle}>Events</Text>
                {events.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="calendar-clear-outline" size={25} color={COLORS.primary} />
                    <Text style={styles.bodyText}>No events have been created yet.</Text>
                  </View>
                ) : (
                  events.map((event) => (
                    <View key={event.id} style={styles.eventCard}>
                      <View style={styles.eventHeader}>
                        <View style={styles.eventCopy}>
                          <Text style={styles.eventTitle}>{event.title}</Text>
                          <Text style={styles.bodyText}>{event.event_code}</Text>
                        </View>
                        <Text style={[styles.status, event.status === 'open' ? styles.open : styles.closed]}>
                          {event.status.toUpperCase()}
                        </Text>
                      </View>
                      {event.venue ? <Text style={styles.bodyText}>Venue: {event.venue}</Text> : null}
                      {event.start_time ? (
                        <Text style={styles.bodyText}>Starts {new Date(event.start_time).toLocaleString()}</Text>
                      ) : null}
                      <View style={styles.eventActions}>
                        <Pressable
                          onPress={() => setQrPayload(buildQRPayload({
                            event: event.event_code,
                            title: event.title,
                            start: event.start_time ?? undefined,
                            end: event.end_time ?? undefined,
                          }))}
                          style={styles.action}
                          accessibilityRole="button"
                        >
                          <Ionicons name="qr-code-outline" size={18} color={COLORS.deepPurple} />
                          <Text style={styles.actionText}>Generate QR</Text>
                        </Pressable>
                        {event.status !== 'closed' ? (
                          <Pressable
                            onPress={() => handleCloseEvent(event)}
                            style={styles.action}
                            accessibilityRole="button"
                          >
                            <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                            <Text style={[styles.actionText, styles.error]}>Close event</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}

                {qrPayload ? (
                  <View style={styles.qrCard}>
                    <Pressable
                      onPress={() => setQrPayload(null)}
                      style={styles.closeQr}
                      accessibilityRole="button"
                      accessibilityLabel="Close QR code"
                    >
                      <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                    </Pressable>
                    <Text style={styles.sectionTitle}>Event attendance QR</Text>
                    <QRCode value={qrPayload} size={220} />
                    <Text style={styles.bodyText}>{qrPayload}</Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </CampusBackground>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    marginBottom: 15,
  },
  statsText: { flex: 1, color: COLORS.textPrimary, fontWeight: '700', marginLeft: 9 },
  refresh: { padding: 4 },
  formCard: {
    padding: 17,
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 7 },
  bodyText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  label: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#FFFBFE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  description: { minHeight: 76 },
  message: { color: COLORS.success, fontSize: 12, textAlign: 'center', marginVertical: 10 },
  error: { color: COLORS.danger },
  eventCard: {
    padding: 15,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  eventCopy: { flex: 1 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  status: { fontSize: 9, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, overflow: 'hidden' },
  open: { color: COLORS.success, backgroundColor: '#E8F7ED' },
  closed: { color: COLORS.textSecondary, backgroundColor: '#F1EFF3' },
  eventActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 12, paddingTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', marginRight: 18, paddingVertical: 5 },
  actionText: { color: COLORS.deepPurple, fontSize: 12, fontWeight: '700', marginLeft: 6 },
  emptyCard: { alignItems: 'center', padding: 22, borderRadius: 17, backgroundColor: '#FFFFFF', marginTop: 10 },
  qrCard: { alignItems: 'center', gap: 14, padding: 20, backgroundColor: '#FFFFFF', borderRadius: 20, marginTop: 18 },
  closeQr: { alignSelf: 'flex-end' },
  noticeCard: { alignItems: 'center', gap: 12, margin: 20, padding: 24, borderRadius: 18, backgroundColor: '#FFFFFF' },
});
