
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';

import { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { signOut, useAuth } from '@/lib/auth';
import {
  getProfile,
  updateProfile,
  type Profile,
  type StudentCourseYear,
  type StudentDepartment,
  type StudentSex,
} from '@/lib/profiles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StudentChoiceField = 'sex' | 'department' | 'course_year';

const STUDENT_CHOICES = {
  sex: ['Female', 'Male'],
  department: ['BSED', 'BSIT', 'BSHM', 'BSENTREP'],
  course_year: ['First Year', 'Second Year', 'Third Year', 'Fourth Year'],
} as const;

const STUDENT_CHOICE_LABELS: Record<StudentChoiceField, string> = {
  sex: 'Sex',
  department: 'Department',
  course_year: 'Course Year',
};

const STUDENT_CHOICE_PLACEHOLDERS: Record<StudentChoiceField, string> = {
  sex: 'Select sex',
  department: 'Select department',
  course_year: 'Select course year',
};

const PROFILE_NAME_BY_INITIAL: Record<string, string> = {
  F: 'Ferlita Ationg',
  P: 'Procoro Gonzaga',
  J: 'Jean Maica',
};

function getProfileAvatarName(profile: Profile) {
  const fullName = profile.full_name?.trim();
  if (fullName && fullName.length === 1) {
    return PROFILE_NAME_BY_INITIAL[fullName.toUpperCase()] || fullName;
  }
  return fullName || profile.email?.charAt(0).toUpperCase() || '?';
}

export default function ProfileScreen() {
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [studentDraft, setStudentDraft] = useState({
    full_name: '',
    sex: '' as StudentSex | '',
    department: '' as StudentDepartment | '',
    course_year: '' as StudentCourseYear | '',
    block: '',
  });
  const [selectedPicker, setSelectedPicker] =
    useState<StudentChoiceField | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!session) {
      router.replace('/login');
    }
  }, [session, router]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadProfile = async () => {
        if (!user) {
          setProfileLoading(false);
          return;
        }

        setProfileLoading(true);
        setProfileLoadError(null);
        try {
          const nextProfile = await getProfile(user.id);
          if (!isActive) return;

          setProfile(nextProfile);
          setDraftName(nextProfile?.full_name ?? '');
          setStudentDraft({
            full_name: nextProfile?.full_name ?? '',
            sex: nextProfile?.sex ?? '',
            department: nextProfile?.department ?? '',
            course_year: nextProfile?.course_year ?? '',
            block: nextProfile?.block ?? '',
          });
        } catch (error) {
          if (isActive) {
            setProfileLoadError(
              error instanceof Error
                ? error.message
                : 'Unable to load your profile.'
            );
          }
        } finally {
          if (isActive) setProfileLoading(false);
        }
      };

      void loadProfile();
      return () => {
        isActive = false;
      };
    }, [user])
  );

  const handleSaveName = async () => {
    if (!user) return;

    const fullName = draftName.trim();
    if (!fullName) {
      Alert.alert('Missing name', 'Enter your full name before saving.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await updateProfile(user.id, {
        full_name: fullName,
      });
      if (error) {
        Alert.alert('Error', error);
        return;
      }

      setProfile(
        (prev: Profile | null) =>
          prev
            ? {
                ...prev,
                full_name: fullName,
              }
            : prev
      );
      setEditing(false);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Unable to save your name.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStudentDetails = async () => {
    if (!user) return;

    const fullName = studentDraft.full_name.trim();
    const block = studentDraft.block.trim();
    const sex = studentDraft.sex;
    const department = studentDraft.department;
    const courseYear = studentDraft.course_year;
    if (
      !fullName ||
      !sex ||
      !department ||
      !courseYear ||
      !block
    ) {
      Alert.alert('Missing details', 'Complete all student details before saving.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await updateProfile(user.id, {
        full_name: fullName,
        sex,
        department,
        course_year: courseYear,
        block,
      });

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: fullName,
              sex,
              department,
              course_year: courseYear,
              block,
            }
          : prev
      );
      Alert.alert('Saved', 'Your student details have been updated.');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to save your student details.'
      );
    } finally {
      setSaving(false);
    }
  };

  const chooseStudentOption = (option: string) => {
    if (selectedPicker === 'sex') {
      setStudentDraft((prev) => ({ ...prev, sex: option as StudentSex }));
    } else if (selectedPicker === 'department') {
      setStudentDraft((prev) => ({
        ...prev,
        department: option as StudentDepartment,
      }));
    } else if (selectedPicker === 'course_year') {
      setStudentDraft((prev) => ({
        ...prev,
        course_year: option as StudentCourseYear,
      }));
    }
    setSelectedPicker(null);
  };

  const handleSignOut = async () => {
    setLoading(true);

    try {
      await signOut();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to sign out.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <CampusBackground><View style={styles.container}>
      <ScreenHeader title="My profile" icon={null} large />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >

      {profileLoadError ? (
        <View style={styles.infoCard}>
          <Text style={styles.subtitle}>Could not load profile: {profileLoadError}</Text>
        </View>
      ) : profileLoading ? (
        <View style={styles.infoCard}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.subtitle}>Loading profile...</Text>
        </View>
      ) : !profile ? (
        <View style={styles.infoCard}>
          <Text style={styles.subtitle}>
            No profile was found for this account. Check the Supabase profile setup.
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.infoCard,
            profile.role !== 'student' && styles.accountInfoCard,
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getProfileAvatarName(profile)}
            </Text>
          </View>
          <View style={[styles.badgeRow, styles.badgeRowCentered]}>
            {profile.role === 'teacher' ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  Teacher
                </Text>
              </View>
            ) : profile.role === 'admin' ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>Administrator</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.roleBadge,
                  styles.roleBadgeStudent,
                ]}
              >
                <Text style={[styles.roleBadgeText, styles.roleBadgeTextStudent]}>
                  Student
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.label, styles.centeredProfileText]}
          >
            Email
          </Text>
          <Text
            style={[styles.value, styles.centeredProfileText]}
          >
            {profile.email}
          </Text>

          <Text
            style={[styles.label, styles.centeredProfileText]}
          >
            User ID
          </Text>
          <Text
            style={[styles.valueSmall, styles.centeredProfileText]}
          >
            {profile.id}
          </Text>
          {profile.role === 'student' ? (
            <View style={styles.studentDetails}>
              <Text style={[styles.sectionTitle, styles.centeredProfileText]}>
                Personal Info
              </Text>

              <Text style={[styles.label, styles.centeredProfileText]}>Full Name</Text>
              <TextInput
                style={styles.studentInput}
                value={studentDraft.full_name}
                onChangeText={(full_name) =>
                  setStudentDraft((prev) => ({ ...prev, full_name }))
                }
                placeholder="Type your name"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
              />

              {(['sex', 'department', 'course_year'] as const).map((field) => (
                <View key={field}>
                  <Text style={[styles.label, styles.centeredProfileText]}>
                    {STUDENT_CHOICE_LABELS[field]}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${STUDENT_CHOICE_LABELS[field]}`}
                    style={styles.choiceButton}
                    onPress={() => setSelectedPicker(field)}
                  >
                    <Text
                      style={[
                        styles.choiceValue,
                        !studentDraft[field] && styles.placeholderValue,
                      ]}
                    >
                      {studentDraft[field] || STUDENT_CHOICE_PLACEHOLDERS[field]}
                    </Text>
                    <View style={styles.choiceChevronWrap}>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={COLORS.deepPurple}
                      />
                    </View>
                  </Pressable>
                </View>
              ))}

              <Text style={[styles.label, styles.centeredProfileText]}>Block</Text>
              <TextInput
                style={styles.studentInput}
                value={studentDraft.block}
                onChangeText={(block) =>
                  setStudentDraft((prev) => ({ ...prev, block }))
                }
                placeholder="Enter"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="characters"
              />

              <Pressable
                accessibilityRole="button"
                style={[styles.detailsSaveButton, saving && styles.disabledButton]}
                onPress={handleSaveStudentDetails}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.detailsSaveText}>Save Student Info</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <>
              {(profile.role === 'admin' || profile.role === 'teacher') && (
                <View style={styles.accountDetails}>
                  <Text style={styles.sectionTitle}>
                    {profile.role === 'admin' ? 'Administrator Info' : 'Teacher Info'}
                  </Text>
                  <Text style={styles.accountDescription}>
                    {profile.role === 'admin'
                      ? 'Manage user profiles, attendance records, and campus events from the Admin tab.'
                      : 'Create and manage campus events, and monitor attendance from the Teacher tab.'}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>Full Name</Text>

              {editing ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={styles.input}
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.textSecondary}
                    autoFocus
                  />

                  <Pressable
                    style={styles.saveButton}
                    onPress={handleSaveName}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setEditing(true)}
                  style={styles.nameRow}
                >
                  <Text style={styles.value}>
                    {profile.full_name || 'Tap to add your name'}
                  </Text>
                  <Text style={styles.editHint}>Edit</Text>
                </Pressable>
              )}
            </>
          )}

    
        </View>
      )}

      <View style={styles.signOutButton}>
        <AppButton
          title="Sign Out"
          icon="log-out-outline"
          onPress={handleSignOut}
          disabled={loading}
        />
      </View>
      </ScrollView>
      <Modal
        transparent
        visible={selectedPicker !== null}
        animationType="fade"
        onRequestClose={() => setSelectedPicker(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedPicker(null)}
        >
          <View style={styles.choiceModal}>
            <Text style={styles.choiceModalTitle}>
              {selectedPicker ? STUDENT_CHOICE_LABELS[selectedPicker] : ''}
            </Text>
            {selectedPicker &&
              STUDENT_CHOICES[selectedPicker].map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  style={styles.choiceOption}
                  onPress={() => chooseStudentOption(option)}
                >
                  <Text style={styles.choiceOptionText}>{option}</Text>
                </Pressable>
              ))}
          </View>
        </Pressable>
      </Modal>
    </View></CampusBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  signOutButton: {
    width: '78%',
    maxWidth: 360,
    alignSelf: 'center',
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
  },

  infoCard: {
    backgroundColor: 'transparent',
    borderRadius: 22,
    borderWidth: 0,
    padding: 20,
    marginBottom: 24,
  },
  accountInfoCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  avatar: {
    minWidth: 180,
    maxWidth: '100%',
    minHeight: 70,
    borderRadius: 24,
    backgroundColor: COLORS.softPink,
    borderWidth: 2,
    borderColor: COLORS.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 16,
  },
  avatarText: {
    color: COLORS.deepPurple,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  badgeRow: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  badgeRowCentered: {
    alignItems: 'center',
  },

  roleBadge: {
    backgroundColor: COLORS.deepPurple,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  roleBadgeStudent: {
    backgroundColor: COLORS.softPink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  roleBadgeTextStudent: {
    color: COLORS.deepPink,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },

  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  centeredProfileText: {
    textAlign: 'center',
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  editHint: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  saveButton: {
    marginLeft: 8,
    backgroundColor: COLORS.deepPurple,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },

  studentDetails: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },

  accountDetails: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  accountDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  studentInput: {
    minHeight: 46,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 38,
    paddingVertical: 10,
  },

  choiceValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  placeholderValue: {
    fontWeight: '500',
    color: COLORS.textSecondary,
  },

  choiceChevronWrap: {
    position: 'absolute',
    right: 10,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: COLORS.softPink,
  },

  detailsSaveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 20,
    alignSelf: 'center',
    width: '72%',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.deepPurple,
  },

  disabledButton: {
    opacity: 0.7,
  },

  detailsSaveText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },

  choiceModal: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.card,
  },

  choiceModalTitle: {
    marginBottom: 8,
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },

  choiceOption: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  choiceOptionText: {
    color: COLORS.textPrimary,
    fontSize: 15,
  },
});
