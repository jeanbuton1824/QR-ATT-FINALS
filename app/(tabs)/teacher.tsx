import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AppButton from '@/components/AppButton';
import CampusBackground from '@/components/CampusBackground';
import ScreenHeader from '@/components/ScreenHeader';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  closeEvent,
  createEvent,
  getEventsByTeacher,
  type CloudEvent,
  updateEvent,
} from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

// FIX: previously this returned a naive "YYYY-MM-DDTHH:mm:ss" string with NO
// timezone offset. The backend (Postgres timestamptz / Supabase) interpreted
// it as UTC, so 9:15 AM Manila was stored as 09:15 UTC = 5:15 PM PHT, and
// every morning scan failed with "This event has not started yet."
// date.toISOString() returns a proper offset-aware instant (e.g.
// "2026-10-19T01:15:00.000Z" for 9:15 AM UTC+8), which stores and compares
// correctly regardless of timezone.
function toLocalISO(date: Date) {
  return date.toISOString();
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

// NOTE: this must stay offset-free — it is only used as the value of a web
// <input type="datetime-local">, which requires a naive local datetime.
function toInputDateTimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [teacherEvents, setTeacherEvents] = useState<CloudEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isAndroid = Platform.OS === 'android';

  const loadTeacherEvents = useCallback(async (teacherId: string) => {
    setEventsLoading(true);
    try {
      setTeacherEvents(await getEventsByTeacher(teacherId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load your events.');
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user) {
        setRoleLoading(false);
        return () => {
          active = false;
        };
      }
      const loadRoleAndEvents = async () => {
        try {
          const profile = await getProfile(user.id);
          if (!active) return;
          const currentRole = profile?.role ?? 'student';
          setRole(currentRole);
          if (currentRole === 'teacher') {
            setEventsLoading(true);
            try {
              const loadedEvents = await getEventsByTeacher(user.id);
              if (active) setTeacherEvents(loadedEvents);
            } catch (error) {
              if (active) {
                setMessage(error instanceof Error ? error.message : 'Unable to load your events.');
              }
            } finally {
              if (active) setEventsLoading(false);
            }
          }
        } catch (error) {
          if (active) {
            setMessage(error instanceof Error ? error.message : 'Unable to load teacher access.');
          }
        } finally {
          if (active) setRoleLoading(false);
        }
      };
      void loadRoleAndEvents();
      return () => {
        active = false;
      };
    }, [loadTeacherEvents, user])
  );

  if (roleLoading) {
    return (
      <CampusBackground>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.checkingText}>
            Checking your account...
          </Text>
        </View>
      </CampusBackground>
    );
  }

  if (role !== 'teacher') {
    return (
      <CampusBackground>
        <View style={styles.centerContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={40}
            color={COLORS.textSecondary}
          />
          <Text style={styles.lockTitle}>Teachers and Admins Only </Text>
          <Text style={styles.lockSubtitle}>
            Only teachers and administrators can manage events. Administrators can use the Events tab.
          </Text>
        </View>
      </CampusBackground>
    );
  }

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const renderDateTimeField = (target: EditTarget) => {
    const value = target === 'start' ? startDate : endDate;
    const icon =
      target === 'start' ? 'sunny-outline' : 'moon-outline';
    const handleChange = (next: Date) => {
      setMessage(null);
      if (target === 'start') {
        setStartDate(next);
      } else {
        setEndDate(next);
      }
    };
    if (Platform.OS === 'web') {
      return (
        <WebDateTimeField
          value={value}
          icon={icon}
          onChange={handleChange}
        />
      );
    }
    return (
      <PickerField
        value={formatDateTime(value)}
        icon={icon}
        onPress={() => openPicker(target)}
      />
    );
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }
    const current =
      editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );
    next.setHours(
      selected.getHours(),
      selected.getMinutes(),
      0,
      0
    );
    if (editTarget === 'start') {
      setStartDate(next);
    } else {
      setEndDate(next);
    }
    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(
      new Date(startDate.getTime() + ms)
    );
  };

  const handleCreateEvent = async () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
      venue: venue.trim(),
      description: description.trim(),
    };
    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }
    setSaving(true);
    try {
      const result = editingEventId
        ? await updateEvent(editingEventId, event)
        : await createEvent(event);
      const { error } = result;
      if (error) {
        setMessage(`Could not ${editingEventId ? 'update' : 'save'} the event: ${error}`);
        return;
      }
      setMessage(editingEventId ? 'Event updated successfully.' : 'Event created. Its QR code is ready below.');
      setPayload(buildQRPayload({
        event: event.eventId,
        title: event.title,
        start: event.start,
        end: event.end,
      }));
      setTitle('');
      setEventId('');
      setVenue('');
      setDescription('');
      setEditingEventId(null);
      if (user) await loadTeacherEvents(user.id);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not save the event.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (event: CloudEvent) => {
    setEditingEventId(event.id);
    setTitle(event.title);
    setEventId(event.event_code);
    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');
    setStartDate(event.start_time ? new Date(event.start_time) : new Date());
    setEndDate(event.end_time ? new Date(event.end_time) : new Date(Date.now() + 60 * 60 * 1000));
    setPayload(null);
    setMessage(`Editing ${event.title}.`);
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
    setMessage('Event editing cancelled.');
  };

  const handleCloseEvent = (event: CloudEvent) => {
    Alert.alert(
      'Close event?',
      `Close "${event.title}"? Students will no longer be able to check in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close event',
          style: 'destructive',
          onPress: () => {
            closeEvent(event.id)
              .then(async () => {
                setMessage(`${event.title} is now closed.`);
                if (user) await loadTeacherEvents(user.id);
              })
              .catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : 'Unable to close the event.');
              });
          },
        },
      ]
    );
  };

  return (
    <CampusBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.headerWrapper}>
        <ScreenHeader
          title=" Events"
          subtitle="Set event details, date, and time"
          icon="calendar-outline"
        />
      </View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Create an event</Text>
          <Text style={styles.sectionSubtitle}>Generate a QR code for check-in</Text>
        </View>
        <Ionicons name="add-circle-outline" size={21} color={COLORS.deepPurple} />
      </View>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan tab.
      </Text>
      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />
      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />
      <Text style={styles.label}>Venue</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="e.g. Main auditorium"
        placeholderTextColor={COLORS.textSecondary}
      />
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.descriptionInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Event details"
        placeholderTextColor={COLORS.textSecondary}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.label}>Starts</Text>
      {renderDateTimeField('start')}
      <Text style={styles.label}>Ends</Text>
      {renderDateTimeField('end')}
      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={styles.chip}
            onPress={() => handleQuickEnd(option.ms)}
          >
            <Text style={styles.chipText}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        Tap a chip to set the end time from start.
      </Text>
      {message && (
        <Text style={styles.message}>
          {message}
        </Text>
      )}
      <AppButton
        theme="primary"
        title={editingEventId ? 'Save Changes' : 'Create Event'}
        icon="add-circle-outline"
        onPress={handleCreateEvent}
        loading={saving}
        disabled={saving}
      />
      {editingEventId ? (
        <Pressable
          style={styles.cancelEditButton}
          onPress={cancelEdit}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.cancelEditText}>Cancel editing</Text>
        </Pressable>
      ) : null}
      {editTarget && Platform.OS !== 'web' && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={
              editTarget === 'start'
                ? startDate
                : endDate
            }
            mode={
              isAndroid
                ? editingPart
                : 'datetime'
            }
            display={
              isAndroid
                ? 'default'
                : 'spinner'
            }
            onChange={onPickerChange}
          />
        </View>
      )}
      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>
          <View style={styles.qrBox}>
            <QRCode
              value={payload}
              size={200}
            />
          </View>
          <Text style={styles.payloadText}>
            {payload}
          </Text>
        </View>
      )}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Manage events</Text>
          <Text style={styles.sectionSubtitle}>
            {teacherEvents.length} events created by you
          </Text>
        </View>
        <Pressable
          style={styles.refreshEvents}
          accessibilityRole="button"
          accessibilityLabel="Refresh your events"
          disabled={eventsLoading}
          onPress={() => user && loadTeacherEvents(user.id)}
        >
          {eventsLoading ? (
            <ActivityIndicator size="small" color={COLORS.deepPurple} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={COLORS.deepPurple} />
          )}
        </Pressable>
      </View>
      {eventsLoading && teacherEvents.length === 0 ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : teacherEvents.length === 0 ? (
        <View style={styles.eventsEmpty}>
          <Ionicons name="calendar-clear-outline" size={25} color={COLORS.primary} />
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptyCopy}>Events you create will appear here for management.</Text>
        </View>
      ) : (
        teacherEvents.map((event) => {
          const now = Date.now();
          const eventStatus = event.status === 'closed' ||
            (event.end_time !== null && new Date(event.end_time).getTime() < now)
            ? 'Closed'
            : event.start_time !== null && new Date(event.start_time).getTime() > now
              ? 'Upcoming'
              : 'Open';
          const badgeStyle = eventStatus === 'Open'
            ? styles.statusOpen
            : eventStatus === 'Upcoming'
              ? styles.statusUpcoming
              : styles.statusClosed;
          const badgeTextStyle = eventStatus === 'Open'
            ? styles.statusOpenText
            : eventStatus === 'Upcoming'
              ? styles.statusUpcomingText
              : styles.statusClosedText;

          return (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventCardTop}>
                <View style={styles.eventGlyph}>
                  <Ionicons name="calendar-outline" size={19} color={COLORS.deepPurple} />
                </View>
                <View style={styles.eventCardCopy}>
                  <Text style={styles.eventCardTitle}>{event.title}</Text>
                  <Text style={styles.eventCardMeta}>Code: {event.event_code}</Text>
                </View>
                <View style={[styles.statusBadge, badgeStyle]}>
                  <Text style={[styles.statusText, badgeTextStyle]}>{eventStatus}</Text>
                </View>
              </View>
              {event.start_time ? (
                <View style={styles.eventDetails}>
                  <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.eventCardMeta}>
                    {formatDateTime(new Date(event.start_time))}
                  </Text>
                </View>
              ) : null}
              {event.venue ? (
                <View style={styles.eventDetails}>
                  <Ionicons name="location-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.eventCardMeta}>{event.venue}</Text>
                </View>
              ) : null}
              <View style={styles.eventActions}>
                <Pressable
                  style={styles.eventAction}
                  onPress={() => handleEditEvent(event)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${event.title}`}
                >
                  <Ionicons name="create-outline" size={16} color={COLORS.deepPurple} />
                  <Text style={styles.eventActionText}>Edit</Text>
                </Pressable>
                {event.status !== 'closed' ? (
                  <Pressable
                    style={styles.eventAction}
                    onPress={() => handleCloseEvent(event)}
                    accessibilityRole="button"
                    accessibilityLabel={`Close ${event.title}`}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
                    <Text style={[styles.eventActionText, styles.closeActionText]}>Close event</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}
      </ScrollView>
    </CampusBackground>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({
  value,
  icon,
  onPress,
}: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pickerField,
        pressed && styles.pickerFieldPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={COLORS.primary}
      />
      <Text style={styles.pickerValue}>
        {value}
      </Text>
      <Ionicons
        name="calendar-outline"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

type WebDateTimeFieldProps = {
  value: Date;
  icon: keyof typeof Ionicons.glyphMap;
  onChange: (date: Date) => void;
};

function WebDateTimeField({
  value,
  icon,
  onChange,
}: WebDateTimeFieldProps) {
  return (
    <View style={styles.pickerField}>
      <Ionicons
        name={icon}
        size={20}
        color={COLORS.primary}
      />
      <input
        type="datetime-local"
        value={toInputDateTimeValue(value)}
        onChange={(event) => {
          const next = new Date(event.target.value);
          if (!Number.isNaN(next.getTime())) {
            onChange(next);
          }
        }}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            // Fall back to the browser's native datetime-local input behavior.
          }
        }}
        style={webInputStyle}
      />
    </View>
  );
}

const webInputStyle = {
  flex: 1,
  marginLeft: 10,
  marginRight: 10,
  fontSize: 15,
  fontWeight: 500,
  color: COLORS.textPrimary,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: 0,
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  checkingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 40,
  },
  headerWrapper: { marginHorizontal: -24, marginBottom: 18 },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  descriptionInput: {
    minHeight: 88,
  },
  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.softPink,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.lavender,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.deepPurple,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
  },
  cancelEditButton: { paddingVertical: 12, alignItems: 'center' },
  cancelEditText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEAF2',
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  dashboardStats: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 19,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  dashboardStat: { flex: 1, alignItems: 'center' },
  dashboardStatValue: { color: COLORS.deepPurple, fontSize: 20, fontWeight: '800' },
  dashboardStatLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 3 },
  statDivider: { height: 32, width: 1, backgroundColor: COLORS.border },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 3,
  },
  refreshEvents: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  searchBox: {
    minHeight: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 13, paddingVertical: 10, marginLeft: 8 },
  eventCard: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 11,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  eventCardTop: { flexDirection: 'row', alignItems: 'center' },
  eventGlyph: { width: 39, height: 39, borderRadius: 13, backgroundColor: COLORS.softPink, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  eventCardCopy: { flex: 1 },
  eventCardTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  eventCardMeta: { color: COLORS.textSecondary, fontSize: 11, marginLeft: 6, flexShrink: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusOpen: { backgroundColor: '#E8F7ED' },
  statusUpcoming: { backgroundColor: '#F2EAFE' },
  statusClosed: { backgroundColor: '#F1EFF3' },
  statusText: { fontSize: 9, fontWeight: '800' },
  statusOpenText: { color: COLORS.success },
  statusUpcomingText: { color: COLORS.deepPurple },
  statusClosedText: { color: COLORS.textSecondary },
  eventDetails: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  attendanceCount: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  attendanceCountText: { color: COLORS.deepPurple, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  eventActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 13, paddingTop: 12 },
  eventAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 30 },
  eventActionText: { color: COLORS.deepPurple, fontSize: 11, fontWeight: '700', marginLeft: 5 },
  closeActionText: { color: COLORS.danger },
  eventsEmpty: { backgroundColor: '#FFFFFF', borderRadius: 19, borderWidth: 1, borderColor: COLORS.border, padding: 20, alignItems: 'center', marginBottom: 20 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 8 },
  emptyCopy: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
});
