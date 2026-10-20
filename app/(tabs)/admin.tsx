import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
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
  changeProfileRole,
  getAdminDashboardData,
  removeAttendanceRecord,
  type AdminDashboardData,
  type AdminProfile,
} from '@/lib/admin';
import { closeEvent, createEvent, updateEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';
import { supabase } from '@/lib/supabase';

type UserFilter = 'all' | 'student' | 'teacher' | 'admin';
type EventDateField = 'start' | 'end';

export default function AdminScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUpdateError, setLiveUpdateError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [eventTitle, setEventTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventStart, setEventStart] = useState(() => new Date());
  const [eventEnd, setEventEnd] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [dateTarget, setDateTarget] = useState<{
    field: EventDateField;
    mode: 'date' | 'time';
  } | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [eventMessageError, setEventMessageError] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrEventCode, setQrEventCode] = useState<string | null>(null);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const profile = await getProfile(user.id);
      setRole(profile?.role ?? null);
      if (profile?.role !== 'admin') {
        setData(null);
        return;
      }
      setData(await getAdminDashboardData());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load administrator data.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!user || role !== 'admin') return;

    const channel = supabase
      .channel(`admin-attendance:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance' },
        () => {
          void load(true);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLiveUpdateError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setLiveUpdateError(
            'Live attendance updates are unavailable. Use refresh to reload records.'
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, role, user]);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.users ?? []).filter((profile) => {
      const matchesRole = userFilter === 'all' || profile.role === userFilter;
      const matchesQuery =
        !normalizedQuery ||
        `${profile.full_name ?? ''} ${profile.email} ${profile.id}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesRole && matchesQuery;
    });
  }, [data?.users, query, userFilter]);

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.events ?? []).filter((event) =>
      `${event.title} ${event.event_code}`.toLowerCase().includes(normalizedQuery)
    );
  }, [data?.events, query]);

  const setEventDate = (field: EventDateField, date: Date) => {
    if (field === 'start') setEventStart(date);
    else setEventEnd(date);
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!dateTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setDateTarget(null);
      return;
    }

    const current = dateTarget.field === 'start' ? eventStart : eventEnd;
    const next = new Date(current);
    if (Platform.OS === 'android' && dateTarget.mode === 'date') {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setEventDate(dateTarget.field, next);
      setDateTarget({ field: dateTarget.field, mode: 'time' });
      return;
    }

    if (Platform.OS === 'android') {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      next.setTime(selected.getTime());
    }
    setEventDate(dateTarget.field, next);
    setDateTarget(null);
  };

  const handleCreateEvent = async () => {
    const title = eventTitle.trim();
    const code = eventCode.trim();
    if (!title || !code) {
      setEventMessageError(true);
      setEventMessage('Enter both an event title and a unique event code.');
      return;
    }
    if (eventEnd.getTime() <= eventStart.getTime()) {
      setEventMessageError(true);
      setEventMessage('The event end time must be after the start time.');
      return;
    }

    setCreatingEvent(true);
    setEventMessage(null);
    setEventMessageError(false);
    try {
      const start = toLocalISO(eventStart);
      const end = toLocalISO(eventEnd);
      const eventInput = {
        eventId: code,
        title,
        start,
        end,
        venue: eventVenue.trim(),
        description: eventDescription.trim(),
      };
      const result = editingEventId
        ? await updateEvent(editingEventId, eventInput)
        : await createEvent(eventInput);
      if (result.error) {
        setEventMessageError(true);
        setEventMessage(
          result.error.toLowerCase().includes('duplicate') ||
            result.error.includes('23505')
            ? 'That event code already exists. Choose a different code.'
            : `Could not create event: ${result.error}`
        );
        return;
      }

      setQrPayload(buildQRPayload({ event: code, title, start, end }));
      setQrEventCode(code);
      setEventMessageError(false);
      setEventMessage(editingEventId
        ? 'Event updated successfully.'
        : 'Event created successfully. Its QR code is ready below.');
      setEventTitle('');
      setEventCode('');
      setEventVenue('');
      setEventDescription('');
      setEditingEventId(null);
      await load(true);
    } catch (createError) {
      setEventMessageError(true);
      setEventMessage(
        createError instanceof Error
          ? `Could not create event: ${createError.message}`
          : 'Could not create event. Please try again.'
      );
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleEditEvent = (eventId: string) => {
    const event = data?.events.find((item) => item.id === eventId);
    if (!event) return;
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventCode(event.event_code);
    setEventVenue(event.venue ?? '');
    setEventDescription(event.description ?? '');
    setEventStart(event.start_time ? new Date(event.start_time) : new Date());
    setEventEnd(event.end_time ? new Date(event.end_time) : new Date(Date.now() + 60 * 60 * 1000));
    setQrPayload(null);
    setEventMessageError(false);
    setEventMessage(`Editing ${event.title}. Save your changes below.`);
  };

  const cancelEventEdit = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventCode('');
    setEventVenue('');
    setEventDescription('');
    setEventMessage(null);
    setEventMessageError(false);
  };

  const handleCloseEvent = (eventId: string, title: string) => {
    Alert.alert(
      'Close event?',
      `Students will no longer be able to check in to ${title}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close event',
          style: 'destructive',
          onPress: () => {
            closeEvent(eventId)
              .then(() => load(true))
              .catch((closeError: unknown) => {
                setError(closeError instanceof Error ? closeError.message : 'Could not close event.');
              });
          },
        },
      ]
    );
  };

  const handleAttendanceCorrection = async () => {
    if (!correctionId || correctionReason.trim().length < 5) {
      setCorrectionMessage('Enter a reason of at least 5 characters.');
      return;
    }

    setSavingCorrection(true);
    setCorrectionMessage(null);
    try {
      const result = await removeAttendanceRecord(correctionId, correctionReason);
      if (result === 'not_found') {
        setCorrectionMessage('This attendance record no longer exists. Refresh the page.');
        return;
      }
      setCorrectionId(null);
      setCorrectionReason('');
      setCorrectionMessage(null);
      await load(true);
    } catch (correctionError) {
      setCorrectionMessage(
        correctionError instanceof Error
          ? correctionError.message
          : 'Could not correct this attendance record.'
      );
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleRoleChange = (profile: AdminProfile) => {
    if (profile.role === 'admin' || updatingUserId) return;
    const nextRole = profile.role === 'student' ? 'teacher' : 'student';
    Alert.alert(
      'Change user role?',
      `Change ${profile.full_name || profile.email} from ${profile.role} to ${nextRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Make ${nextRole}`,
          onPress: () => {
            setUpdatingUserId(profile.id);
            changeProfileRole(profile.id, nextRole)
              .then(() => load(true))
              .catch((roleError: unknown) => {
                setError(roleError instanceof Error ? roleError.message : 'Could not change user role.');
              })
              .finally(() => setUpdatingUserId(null));
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <CampusBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Loading administrator dashboard...</Text>
        </View>
      </CampusBackground>
    );
  }

  if (role !== 'admin') {
    return (
      <CampusBackground>
        <View style={styles.page}>
        <ScreenHeader
          title="Administrator"
          subtitle="Restricted system management"
          icon="shield-checkmark-outline"
        />
        <View style={styles.restrictedCard}>
          <Ionicons name="lock-closed-outline" size={28} color={COLORS.deepPurple} />
          <Text style={styles.restrictedTitle}>Administrator access required</Text>
          <Text style={styles.muted}>
            An existing administrator must provision your account securely in Supabase.
          </Text>
        </View>
        </View>
      </CampusBackground>
    );
  }

  return (
    <CampusBackground>
      <View style={styles.page}>
        <ScreenHeader
          title="Administrator"
        
          icon="shield-checkmark"
        />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="analytics-outline" size={21} color={COLORS.deepPurple} />
            </View>
            <View style={styles.welcomeCopy}>
              <Text style={styles.sectionTitle}>System overview</Text>
              <Text style={styles.sectionSubtitle}>Live totals from your attendance database</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh administrator data"
              style={styles.refreshButton}
              onPress={() => load(true)}
            >
              <Ionicons name="refresh-outline" size={19} color={COLORS.deepPurple} />
            </Pressable>
          </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Could not load all system data</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint}>Check the administrator RLS setup and try refreshing.</Text>
            </View>
          </View>
        ) : null}

        {liveUpdateError ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.deepPurple} />
            <Text style={styles.noticeText}>{liveUpdateError}</Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Total users" value={data.totals.users} icon="people-outline" tint="pink" />
              <StatCard label="Events" value={data.totals.events} icon="calendar-outline" tint="purple" />
              <StatCard label="Attendance" value={data.totals.attendance} icon="checkmark-done-outline" tint="green" />
              <StatCard label="Teachers" value={data.totals.teachers} icon="school-outline" tint="purple" />
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>User breakdown</Text>
              <View style={styles.breakdownRow}>
                <RoleCount label="Students" count={data.totals.students} color={COLORS.deepPink} />
                <RoleCount label="Teachers" count={data.totals.teachers} color={COLORS.deepPurple} />
                <RoleCount label="Admins" count={data.totals.admins} color={COLORS.darkPurple} />
              </View>
            </View>

            <SectionTitle
              title="User management"
              subtitle={`${data.totals.users} accounts · showing up to 200`}
              icon="people-outline"
            />
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search people or events"
                placeholderTextColor={COLORS.textSecondary}
                accessibilityLabel="Search people or events"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {(['all', 'student', 'teacher', 'admin'] as const).map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setUserFilter(filter)}
                  style={[styles.filterChip, userFilter === filter && styles.filterActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userFilter === filter }}
                >
                  <Text style={[styles.filterText, userFilter === filter && styles.filterTextActive]}>
                    {filter === 'all' ? 'Everyone' : capitalize(filter)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {visibleUsers.length === 0 ? (
              <EmptyPanel text="No users match this search." />
            ) : (
              visibleUsers.slice(0, 30).map((profile) => (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  onChangeRole={() => handleRoleChange(profile)}
                  changing={updatingUserId === profile.id}
                />
              ))
            )}
            {visibleUsers.length > 30 ? (
              <Text style={styles.listNote}>
                Showing 30 matches. Refine your search to find another account.
              </Text>
            ) : null}

            <SectionTitle
              title="Event management"
              subtitle={`${data.totals.events} events · latest 100`}
              icon="calendar-outline"
            />
            <View style={styles.createEventCard}>
              <Text style={styles.createEventTitle}>
                {editingEventId ? 'Edit event' : 'Create an event'}
              </Text>
              <Text style={styles.createEventSubtitle}>
                Add an event and generate its attendance QR code.
              </Text>
              <Text style={styles.fieldLabel}>Event title</Text>
              <TextInput
                style={styles.eventInput}
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="e.g. Campus orientation"
                placeholderTextColor={COLORS.textSecondary}
                editable={!creatingEvent}
              />
              <Text style={styles.fieldLabel}>Unique event code</Text>
              <TextInput
                style={styles.eventInput}
                value={eventCode}
                onChangeText={(value) => setEventCode(value.trim().toUpperCase())}
                placeholder="e.g. EVT-2026-001"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="characters"
                editable={!creatingEvent}
              />
              <Text style={styles.fieldLabel}>Venue</Text>
              <TextInput
                style={styles.eventInput}
                value={eventVenue}
                onChangeText={setEventVenue}
                placeholder="e.g. Main auditorium"
                placeholderTextColor={COLORS.textSecondary}
                editable={!creatingEvent}
              />
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.eventInput, styles.descriptionInput]}
                value={eventDescription}
                onChangeText={setEventDescription}
                placeholder="Event details"
                placeholderTextColor={COLORS.textSecondary}
                editable={!creatingEvent}
                multiline
                textAlignVertical="top"
              />
              {Platform.OS === 'web' ? (
                <>
                  <Text style={styles.fieldLabel}>Starts</Text>
                  <DateInput value={eventStart} onChange={setEventStart} />
                  <Text style={styles.fieldLabel}>Ends</Text>
                  <DateInput value={eventEnd} onChange={setEventEnd} />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Starts</Text>
                  <DateField
                    value={eventStart}
                    onPress={() => setDateTarget({ field: 'start', mode: 'date' })}
                  />
                  <Text style={styles.fieldLabel}>Ends</Text>
                  <DateField
                    value={eventEnd}
                    onPress={() => setDateTarget({ field: 'end', mode: 'date' })}
                  />
                </>
              )}
              {eventMessage ? (
                <Text style={[styles.eventMessage, eventMessageError && styles.eventError]}>
                  {eventMessage}
                </Text>
              ) : null}
              <AppButton
                theme="primary"
                title={editingEventId ? 'Save Changes' : 'Create Event'}
                icon={editingEventId ? 'checkmark-circle-outline' : 'add-circle-outline'}
                onPress={handleCreateEvent}
                loading={creatingEvent}
                disabled={creatingEvent}
              />
              {editingEventId ? (
                <Pressable style={styles.cancelEventEdit} onPress={cancelEventEdit}>
                  <Text style={styles.cancelEventEditText}>Cancel editing</Text>
                </Pressable>
              ) : null}
              {dateTarget && Platform.OS !== 'web' ? (
                <DateTimePicker
                  value={dateTarget.field === 'start' ? eventStart : eventEnd}
                  mode={Platform.OS === 'android' ? dateTarget.mode : 'datetime'}
                  display={Platform.OS === 'android' ? 'default' : 'spinner'}
                  onChange={handleDateChange}
                />
              ) : null}
              {qrPayload ? (
                <View style={styles.qrCard}>
                  <Text style={styles.qrTitle}>Event QR code</Text>
                  <Text style={styles.qrSubtitle}>
                    Keep the QR on a white background for reliable scanning.
                  </Text>
                  <View style={styles.qrBox}>
                    <QRCode value={qrPayload} size={190} />
                  </View>
                  <Text style={styles.qrCodeText}>{qrEventCode}</Text>
                </View>
              ) : null}
            </View>
            {visibleEvents.length === 0 ? (
              <EmptyPanel text="No events match this search." />
            ) : (
              visibleEvents.slice(0, 30).map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventIcon}>
                    <Ionicons name="calendar" size={18} color={COLORS.deepPink} />
                  </View>
                  <View style={styles.eventCopy}>
                    <Text style={styles.cardTitle}>{event.title}</Text>
                    <Text style={styles.cardMeta}>{event.event_code}</Text>
                    <Text style={styles.cardMeta}>
                      {event.start_time ? formatDate(event.start_time) : 'Date not set'}
                    </Text>
                    {event.venue ? <Text style={styles.cardMeta}>Venue: {event.venue}</Text> : null}
                  </View>
                  <StatusBadge
                    start={event.start_time}
                    end={event.end_time}
                    status={event.status}
                  />
                  <Pressable
                    style={styles.closeEventButton}
                    onPress={() => handleEditEvent(event.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${event.title}`}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.deepPurple} />
                  </Pressable>
                  {event.status !== 'closed' ? (
                    <Pressable
                      style={styles.closeEventButton}
                      onPress={() => handleCloseEvent(event.id, event.title)}
                      accessibilityRole="button"
                      accessibilityLabel={`Close ${event.title}`}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}

            <SectionTitle
              title="Attendance monitoring"
              subtitle={`${data.totals.attendance} check-ins · latest 100`}
              icon="pulse-outline"
            />
            {data.attendance.length === 0 ? (
              <EmptyPanel text="No attendance records have been recorded yet." />
            ) : (
              data.attendance.slice(0, 30).map((record) => {
                const event = data.events.find((item) => item.id === record.event_id);
                const student = data.users.find((item) => item.id === record.student_id);
                return (
                  <View key={record.id} style={styles.attendanceCard}>
                    <View style={styles.attendanceIcon}>
                      <Ionicons name="checkmark" size={17} color={COLORS.success} />
                    </View>
                    <View style={styles.eventCopy}>
                      <Text style={styles.cardTitle}>
                        {student?.full_name || student?.email || 'Student account'}
                      </Text>
                      <Text style={styles.cardMeta}>{event?.title || 'Event record'}</Text>
                      <Text style={styles.cardMeta}>
                        Status: {record.attendance_status.toUpperCase()}
                      </Text>
                      <Text style={styles.cardMeta}>{formatDate(record.scanned_at)}</Text>
                    </View>
                    <Pressable
                      style={styles.correctionToggle}
                      onPress={() => {
                        setCorrectionId(correctionId === record.id ? null : record.id);
                        setCorrectionReason('');
                        setCorrectionMessage(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Correct attendance record"
                    >
                      <Ionicons name="create-outline" size={18} color={COLORS.deepPurple} />
                    </Pressable>
                    {correctionId === record.id ? (
                      <View style={styles.correctionForm}>
                        <Text style={styles.fieldLabel}>Reason for removing this record</Text>
                        <TextInput
                          style={styles.eventInput}
                          value={correctionReason}
                          onChangeText={setCorrectionReason}
                          placeholder="Explain the correction"
                          placeholderTextColor={COLORS.textSecondary}
                          editable={!savingCorrection}
                        />
                        {correctionMessage ? (
                          <Text style={[styles.eventMessage, styles.eventError]}>
                            {correctionMessage}
                          </Text>
                        ) : null}
                        <AppButton
                          theme="primary"
                          title="Remove record with audit"
                          icon="create-outline"
                          onPress={handleAttendanceCorrection}
                          loading={savingCorrection}
                          disabled={savingCorrection}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.deepPurple} />
              <Text style={styles.noticeText}>
                Attendance corrections require a reason and are saved to the audit log.
              </Text>
            </View>
            <SectionTitle
              title="Attendance audit log"
              subtitle="Recent administrator corrections"
              icon="document-text-outline"
            />
            {data.attendanceAudit.length === 0 ? (
              <EmptyPanel text="No attendance corrections have been made." />
            ) : (
              data.attendanceAudit.slice(0, 10).map((entry) => {
                const event = data.events.find((item) => item.id === entry.event_id);
                const student = data.users.find((item) => item.id === entry.student_id);
                return (
                  <View key={entry.id} style={styles.attendanceCard}>
                    <View style={styles.attendanceIcon}>
                      <Ionicons name="document-text-outline" size={16} color={COLORS.deepPurple} />
                    </View>
                    <View style={styles.eventCopy}>
                      <Text style={styles.cardTitle}>Attendance removed</Text>
                      <Text style={styles.cardMeta}>
                        {student?.full_name || student?.email || 'Student account'} · {event?.title || 'Event'}
                      </Text>
                      <Text style={styles.cardMeta}>{entry.reason}</Text>
                      <Text style={styles.cardMeta}>{formatDate(entry.performed_at)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : null}
        </ScrollView>
      </View>
    </CampusBackground>
  );
}

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tint: 'pink' | 'purple' | 'green';
}) {
  const tintColor =
    tint === 'pink' ? COLORS.deepPink : tint === 'green' ? COLORS.success : COLORS.deepPurple;
  const tintBackground =
    tint === 'pink' ? COLORS.softPink : tint === 'green' ? '#E8F7ED' : COLORS.lavender;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tintBackground }]}>
        <Ionicons name={icon} size={18} color={tintColor} />
      </View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RoleCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.roleCount}>
      <View style={[styles.roleDot, { backgroundColor: color }]} />
      <Text style={styles.roleCountValue}>{count.toLocaleString()}</Text>
      <Text style={styles.roleCountLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionSymbol}>
        <Ionicons name={icon} size={17} color={COLORS.deepPurple} />
      </View>
      <View style={styles.welcomeCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function UserCard({
  profile,
  onChangeRole,
  changing,
}: {
  profile: AdminProfile;
  onChangeRole: () => void;
  changing: boolean;
}) {
  const roleColor =
    profile.role === 'teacher'
      ? COLORS.deepPurple
      : profile.role === 'admin'
        ? COLORS.darkPurple
        : COLORS.deepPink;
  const studentDetails = [
    profile.sex && `Sex: ${profile.sex}`,
    profile.department && `Department: ${profile.department}`,
    profile.course_year && `Course Year: ${profile.course_year}`,
    profile.block && `Block: ${profile.block}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.userCard}>
      <View style={styles.userCardHeader}>
        <View style={styles.userAvatar}>
          <Text style={[styles.userInitial, { color: roleColor }]}>
            {(profile.full_name || profile.email || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.eventCopy}>
          <Text style={styles.cardTitle}>{profile.full_name || 'Name not provided'}</Text>
          <Text style={styles.cardMeta}>{profile.email}</Text>
        </View>
        {profile.role === 'admin' ? (
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}18` }]}>
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>Admin</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.roleBadge, { backgroundColor: `${roleColor}18` }]}
            onPress={onChangeRole}
            disabled={changing}
            accessibilityRole="button"
            accessibilityLabel={`Change ${profile.full_name || profile.email}'s role`}
          >
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>
              {changing ? 'Saving…' : `${capitalize(profile.role)} · Change`}
            </Text>
          </Pressable>
        )}
      </View>
      {profile.role === 'student' ? (
        <Text style={styles.studentProfileDetails}>
          {studentDetails || 'Student details not provided'}
        </Text>
      ) : null}
    </View>
  );
}

function StatusBadge({
  start,
  end,
  status: storedStatus,
}: {
  start: string | null;
  end: string | null;
  status: 'draft' | 'open' | 'closed';
}) {
  const now = Date.now();
  const startTime = start ? new Date(start).getTime() : null;
  const endTime = end ? new Date(end).getTime() : null;
  const status = storedStatus === 'closed'
    ? 'Closed'
    : storedStatus === 'draft'
      ? 'Draft'
      : endTime !== null && endTime < now
    ? 'Closed'
    : startTime !== null && startTime > now
      ? 'Upcoming'
      : 'Open';
  const badgeStyle = status === 'Open'
    ? styles.openBadge
    : status === 'Upcoming'
      ? styles.upcomingBadge
      : styles.closedBadge;
  const textStyle = status === 'Open'
    ? styles.openBadgeText
    : status === 'Upcoming'
      ? styles.upcomingBadgeText
      : styles.closedBadgeText;
  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Text style={[styles.statusText, textStyle]}>{status}</Text>
    </View>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <View style={styles.emptyPanel}>
      <Ionicons name="file-tray-outline" size={22} color={COLORS.primary} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toLocalISO(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function toInputDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DateField({ value, onPress }: { value: Date; onPress: () => void }) {
  return (
    <Pressable style={styles.dateField} onPress={onPress} accessibilityRole="button">
      <Ionicons name="calendar-outline" size={17} color={COLORS.deepPurple} />
      <Text style={styles.dateFieldText}>{formatDate(value.toISOString())}</Text>
      <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
    </Pressable>
  );
}

function DateInput({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  return (
    <View style={styles.dateField}>
      <Ionicons name="calendar-outline" size={17} color={COLORS.deepPurple} />
      <input
        type="datetime-local"
        value={toInputDateTimeValue(value)}
        onChange={(event) => {
          const date = new Date(event.currentTarget.value);
          if (!Number.isNaN(date.getTime())) onChange(date);
        }}
        style={webDateInputStyle}
      />
    </View>
  );
}

const webDateInputStyle = {
  flex: 1,
  marginLeft: 9,
  fontSize: 13,
  color: COLORS.textPrimary,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: 0,
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 35 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  muted: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8 },
  restrictedCard: { margin: 20, marginTop: 30, padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 22 },
  restrictedTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 12 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  welcomeIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.lavender, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  welcomeCopy: { flex: 1 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionSubtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  refreshButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF1F2', padding: 13, borderRadius: 15, marginBottom: 14 },
  errorCopy: { flex: 1, marginLeft: 8 },
  errorTitle: { color: COLORS.danger, fontSize: 13, fontWeight: '800' },
  errorText: { color: COLORS.textPrimary, fontSize: 11, marginTop: 4 },
  errorHint: { color: COLORS.textSecondary, fontSize: 10, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  statCard: { width: '47%', flexGrow: 1, margin: 5, minHeight: 116, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF', padding: 14, shadowColor: COLORS.shadow, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  statIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: COLORS.textPrimary, fontSize: 23, fontWeight: '800', marginTop: 8 },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 1 },
  breakdownCard: { padding: 16, marginTop: 8, marginBottom: 20, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  breakdownTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  roleCount: { alignItems: 'center', flex: 1 },
  roleDot: { width: 8, height: 8, borderRadius: 4 },
  roleCountValue: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 5 },
  roleCountLabel: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 13, marginBottom: 11 },
  sectionSymbol: { width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.softPink, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchBox: { height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14 },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 13, marginLeft: 8, paddingVertical: 9 },
  filters: { paddingVertical: 11 },
  filterChip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, marginRight: 7 },
  filterActive: { backgroundColor: COLORS.deepPurple, borderColor: COLORS.deepPurple },
  filterText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  userCard: { padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  userCardHeader: { flexDirection: 'row', alignItems: 'center' },
  studentProfileDetails: { color: COLORS.textSecondary, fontSize: 10, lineHeight: 16, marginTop: 8, marginLeft: 48 },
  userAvatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.softPink, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  userInitial: { fontSize: 16, fontWeight: '800' },
  eventCopy: { flex: 1 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800' },
  cardMeta: { color: COLORS.textSecondary, fontSize: 10, marginTop: 3 },
  roleBadge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 99 },
  roleBadgeText: { fontSize: 9, fontWeight: '800' },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  closeEventButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 3 },
  cancelEventEdit: { paddingVertical: 11, alignItems: 'center' },
  cancelEventEditText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  eventIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: COLORS.softPink, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  statusBadge: { borderRadius: 99, paddingVertical: 5, paddingHorizontal: 8, marginLeft: 6 },
  statusText: { fontSize: 9, fontWeight: '800' },
  openBadge: { backgroundColor: '#E8F7ED' },
  openBadgeText: { color: COLORS.success },
  upcomingBadge: { backgroundColor: COLORS.lavender },
  upcomingBadgeText: { color: COLORS.deepPurple },
  closedBadge: { backgroundColor: '#F1EFF3' },
  closedBadgeText: { color: COLORS.textSecondary },
  attendanceCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  correctionToggle: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  correctionForm: { flexBasis: '100%', paddingLeft: 44, paddingTop: 6 },
  attendanceIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E8F7ED', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  emptyPanel: { minHeight: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 17, padding: 16, marginBottom: 9 },
  emptyText: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 7 },
  listNote: { color: COLORS.textSecondary, fontSize: 10, textAlign: 'center', marginBottom: 8 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, borderRadius: 15, padding: 12, marginTop: 10 },
  noticeText: { flex: 1, color: COLORS.textSecondary, fontSize: 10, lineHeight: 15, marginLeft: 8 },
  createEventCard: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  createEventTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
  createEventSubtitle: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 8 },
  fieldLabel: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 5 },
  eventInput: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFBFE', color: COLORS.textPrimary, fontSize: 13 },
  descriptionInput: { minHeight: 76, paddingTop: 11 },
  dateField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFBFE' },
  dateFieldText: { flex: 1, color: COLORS.textPrimary, fontSize: 12, marginHorizontal: 9 },
  eventMessage: { color: COLORS.success, fontSize: 11, lineHeight: 16, marginTop: 10, marginBottom: 4 },
  eventError: { color: COLORS.danger },
  qrCard: { alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8, paddingTop: 16 },
  qrTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  qrSubtitle: { color: COLORS.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  qrBox: { backgroundColor: '#FFFFFF', padding: 17, borderRadius: 15, borderWidth: 1, borderColor: '#EEEAF2' },
  qrCodeText: { color: COLORS.deepPurple, fontSize: 11, fontWeight: '800', marginTop: 10 },
});
