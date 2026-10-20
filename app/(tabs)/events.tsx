import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { getAdminEvents, type AdminEvent } from '@/lib/admin';
import { createEvent, getAvailableEvents, type CloudEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { useAuth } from '@/lib/auth';
import { buildQRPayload } from '@/lib/qr';

type EventDateField = 'start' | 'end';

function formatDateTime(date: Date) {
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${date.getFullYear()} at ${hour}:${minute}`;
}

function toInputDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function AdminEventsScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [dateTarget, setDateTarget] = useState<{
    field: EventDateField;
    mode: 'date' | 'time';
  } | null>(null);
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
        const loadedAdminEvents = await getAdminEvents();
        setAdminEvents(loadedAdminEvents);
      } else if (currentRole === 'student') {
        setEvents(await getAvailableEvents());
      } else {
        setEvents([]);
        setAdminEvents([]);
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
    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('The event end time must be after the start time.');
      setMessageIsError(true);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await createEvent({
        eventId: cleanCode,
        title: cleanTitle,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        venue: venue.trim(),
        description: description.trim(),
      });
      if (result.error) throw new Error(result.error);
      setTitle('');
      setEventCode('');
      setVenue('');
      setDescription('');
      setQrPayload(buildQRPayload({
        event: cleanCode,
        title: cleanTitle,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      }));
      setMessage('Event created successfully. Its attendance QR code is ready below.');
      setMessageIsError(false);
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create event.');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickEnd = (duration: number) => {
    setEndDate(new Date(startDate.getTime() + duration));
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!dateTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setDateTarget(null);
      return;
    }

    const current = dateTarget.field === 'start' ? startDate : endDate;
    const next = new Date(current);
    if (Platform.OS === 'android' && dateTarget.mode === 'date') {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      if (dateTarget.field === 'start') setStartDate(next);
      else setEndDate(next);
      setDateTarget({ field: dateTarget.field, mode: 'time' });
      return;
    }

    if (Platform.OS === 'android') {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      next.setTime(selected.getTime());
    }
    if (dateTarget.field === 'start') setStartDate(next);
    else setEndDate(next);
    setDateTarget(null);
  };

  const renderDateTimeField = (field: EventDateField) => {
    const date = field === 'start' ? startDate : endDate;
    const label = field === 'start' ? 'Starts' : 'Ends';
    const icon = field === 'start' ? 'sunny-outline' : 'moon-outline';

    if (Platform.OS === 'web') {
      return (
        <View style={styles.dateField}>
          <Ionicons
            name={icon}
            size={21}
            color={COLORS.deepPurple}
            style={styles.dateIcon}
          />
          <input
            type="datetime-local"
            value={toInputDateTimeValue(date)}
            onChange={(event) => {
              const selected = new Date(event.target.value);
              if (!Number.isNaN(selected.getTime())) {
                if (field === 'start') setStartDate(selected);
                else setEndDate(selected);
              }
            }}
            style={webDateInputStyle}
            aria-label={label}
          />
        </View>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose event ${label.toLowerCase()} date and time`}
        style={styles.dateField}
        onPress={() => setDateTarget({ field, mode: 'date' })}
        disabled={saving}
      >
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.deepPurple}
          style={styles.dateIcon}
        />
        <Text style={styles.dateValue} numberOfLines={1} ellipsizeMode="tail">
          {formatDateTime(date)}
        </Text>
        <Ionicons
          name="calendar-outline"
          size={19}
          color={COLORS.textSecondary}
          style={styles.dateChevron}
        />
      </Pressable>
    );
  };

  return (
    <CampusBackground>
      <View style={styles.page}>
        <View style={role === 'admin' ? styles.adminHeaderWrapper : undefined}>
          <ScreenHeader
            title={role === 'admin' ? ' Events' : 'Events'}
            subtitle={role === 'admin' ? 'Set event details, date, and time' : undefined}
            icon="calendar-outline"
          />
        </View>
        {role !== 'admin' && role !== 'student' && !loading ? (
          <View style={styles.noticeCard}>
            <Ionicons name="lock-closed-outline" size={24} color={COLORS.deepPurple} />
            <Text style={styles.sectionTitle}>
              {role === 'teacher' ? 'Use the Create Event tab' : 'Teachers and Admins Only'}
            </Text>
            <Text style={styles.bodyText}>
              {role === 'teacher'
                ? 'Create and schedule events from your dedicated Create Event tab.'
                : 'Event management is available to teacher and administrator accounts.'}
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
                {role === 'student' ? (
                  <View style={styles.statsCard}>
                    <Ionicons name="calendar" size={20} color={COLORS.deepPurple} />
                    <Text style={styles.statsText}>{events.length} available events</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Refresh events"
                      onPress={loadEvents}
                      style={styles.refresh}
                    >
                      <Ionicons name="refresh-outline" size={19} color={COLORS.deepPurple} />
                    </Pressable>
                  </View>
                ) : null}
                {role === 'student' && message ? (
                  <Text style={[styles.message, messageIsError && styles.error]}>
                    {message}
                  </Text>
                ) : null}

                {role === 'admin' ? (
                  <View style={styles.formCard}>
                    <View style={styles.formHeading}>
                      <View>
                        <Text style={styles.sectionTitle}>Create an event</Text>
                        <Text style={styles.formSectionSubtitle}>Generate a QR code for check-in</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={23} color={COLORS.deepPurple} />
                    </View>
                    <Text style={styles.formDescription}>
                      Fill in the event details, then scan the generated QR with the Scan tab.
                    </Text>
                    <Text style={styles.label}>Event Title</Text>
                    <TextInput
                      style={styles.input}
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Founders Day Assembly"
                      placeholderTextColor={COLORS.textSecondary}
                      editable={!saving}
                    />
                    <Text style={styles.label}>Event Code</Text>
                    <TextInput
                      style={styles.input}
                      value={eventCode}
                      onChangeText={(value) => setEventCode(value.toUpperCase())}
                      placeholder="e.g. EVT-2026-0002"
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
                    <Text style={styles.label}>Starts</Text>
                    {renderDateTimeField('start')}
                    <Text style={styles.label}>Ends</Text>
                    {renderDateTimeField('end')}
                    <View style={styles.quickEndRow}>
                      {[
                        { label: '+30 min', ms: 30 * 60 * 1000 },
                        { label: '+1 hour', ms: 60 * 60 * 1000 },
                        { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
                      ].map((option) => (
                        <Pressable
                          key={option.label}
                          style={styles.quickEndChip}
                          onPress={() => handleQuickEnd(option.ms)}
                          disabled={saving}
                          accessibilityRole="button"
                        >
                          <Text style={styles.quickEndText}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.quickEndHint}>
                      Tap a chip to set the end time from start.
                    </Text>
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
                    {dateTarget && Platform.OS !== 'web' ? (
                      <View style={styles.pickerContainer}>
                        <DateTimePicker
                          value={dateTarget.field === 'start' ? startDate : endDate}
                          mode={Platform.OS === 'android' ? dateTarget.mode : 'datetime'}
                          display={Platform.OS === 'android' ? 'default' : 'spinner'}
                          onChange={handleDateChange}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {role === 'admin' && qrPayload ? (
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
                  </View>
                ) : null}

                {role === 'admin' ? (
                  <View style={styles.adminEventsSection}>
                    <View style={styles.adminEventsHeading}>
                      <View style={styles.adminEventsTitleCopy}>
                        <Text style={styles.adminEventsTitle}>Events</Text>
                        <Text style={styles.adminEventsSubtitle}>
                          {adminEvents.length} events · latest 100
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Refresh event list"
                        onPress={loadEvents}
                        style={styles.refresh}
                        disabled={loading}
                      >
                        <Ionicons name="refresh-outline" size={20} color={COLORS.deepPurple} />
                      </Pressable>
                    </View>
                    {adminEvents.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <Ionicons name="calendar-clear-outline" size={25} color={COLORS.primary} />
                        <Text style={styles.bodyText}>
                          No events have been created yet.
                        </Text>
                      </View>
                    ) : (
                      adminEvents.map((event) => (
                        <View key={event.id} style={styles.eventCard}>
                          <View style={styles.eventHeader}>
                            <View style={styles.eventCopy}>
                              <Text style={styles.eventTitle}>{event.title}</Text>
                              <Text style={styles.eventMeta}>Code: {event.event_code}</Text>
                            </View>
                            <Text
                              style={[
                                styles.status,
                                event.status === 'open' ? styles.open : styles.closed,
                              ]}
                            >
                              {event.status.toUpperCase()}
                            </Text>
                          </View>
                          {event.start_time ? (
                            <Text style={styles.eventMeta}>
                              Starts {formatDateTime(new Date(event.start_time))}
                            </Text>
                          ) : null}
                          {event.end_time ? (
                            <Text style={styles.eventMeta}>
                              Ends {formatDateTime(new Date(event.end_time))}
                            </Text>
                          ) : null}
                          {event.venue ? (
                            <Text style={styles.eventMeta}>Venue: {event.venue}</Text>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                ) : null}

                {role === 'student' ? (
                  <Text style={styles.sectionTitle}>Available events</Text>
                ) : null}
                {role === 'student' ? (
                  events.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons name="calendar-clear-outline" size={25} color={COLORS.primary} />
                      <Text style={styles.bodyText}>
                        There are no available events right now.
                      </Text>
                    </View>
                  ) : (
                    events.map((event) => (
                      <View key={event.id} style={styles.eventCard}>
                        <View style={styles.eventHeader}>
                          <View style={styles.eventCopy}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            {event.start_time ? (
                              <Text style={styles.bodyText}>
                                Starts {new Date(event.start_time).toLocaleString()}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.status, styles.open]}>OPEN</Text>
                        </View>
                        {event.venue ? <Text style={styles.bodyText}>Venue: {event.venue}</Text> : null}
                        {event.description ? (
                          <Text style={styles.bodyText}>{event.description}</Text>
                        ) : null}
                      </View>
                    ))
                  )
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
  content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 120 },
  adminHeaderWrapper: { marginHorizontal: -20, marginBottom: 18 },
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
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 14,
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  formHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  formSectionSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  formDescription: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 12, marginBottom: 15 },
  adminEventsSection: { marginTop: 2, marginBottom: 18 },
  adminEventsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  adminEventsTitleCopy: { flex: 1 },
  adminEventsTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  adminEventsSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  bodyText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 1, marginBottom: 12 },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  description: { minHeight: 88, paddingTop: 14 },
  dateField: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dateIcon: {
    flexShrink: 0,
  },
  dateValue: {
    minWidth: 0,
    flex: 1,
    flexShrink: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginHorizontal: 10,
  },
  dateChevron: {
    flexShrink: 0,
  },
  pickerContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  quickEndRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  quickEndChip: {
    marginRight: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.lavender,
  },
  quickEndText: { color: COLORS.deepPurple, fontSize: 13, fontWeight: '600' },
  quickEndHint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3, marginBottom: 8 },
  message: { color: COLORS.success, fontSize: 13, marginTop: 14, marginBottom: 2 },
  error: { color: COLORS.danger },
  eventCard: {
    padding: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  eventCopy: { flex: 1 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  eventMeta: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
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

const webDateInputStyle = {
  flex: 1,
  minWidth: 0,
  marginLeft: 10,
  marginRight: 10,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: COLORS.textPrimary,
  fontSize: 15,
  fontWeight: 500,
  fontFamily: 'inherit',
} as const;
