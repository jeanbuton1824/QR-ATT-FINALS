import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import CampusPhotoBackground from '@/components/CampusPhotoBackground';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [role, setRole] =
    useState<'student' | 'teacher'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (
      !fullName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError(
        'Password must be at least 6 characters.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await signUp(
        email.trim(),
        password,
        {
          full_name: fullName.trim(),
          role,
        }
      );

      if (authError) {
        setError(authError.message);
      } else if (!data.session) {
        setSuccess(true);
      }
    } catch (err) {
      setError(
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <CampusPhotoBackground style={styles.container}>
      <LinearGradient
        colors={['rgba(255, 240, 248, 0.28)', 'rgba(255, 230, 244, 0.48)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.card}>
            <Text style={styles.title}>
              Create Account
            </Text>

            <Text style={styles.subtitle}>
              Register to start recording attendance
            </Text>

            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>
                  Check your email!
                </Text>

                <Text style={styles.successText}>
                  We sent a confirmation link to {email}.
                  Click the link to verify your account,
                  then come back and sign in.
                </Text>

                <Link href="/login" style={styles.link}>
                  Back to Sign In
                </Link>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>
                  Full Name
                </Text>

                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  editable={!loading}
                />

                

                <Text style={styles.label}>
                  Email
                </Text>

                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />

                <Text style={styles.label}>
                  Password
                </Text>

                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>
                  Confirm Password
                </Text>

                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }

                  
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>
                  I am a...
                </Text>

                <View style={styles.roleRow}>
                  <Pressable
                    style={[
                      styles.roleChip,
                      role === 'student' &&
                        styles.roleChipActive,
                    ]}
                    onPress={() => setRole('student')}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'student' &&
                          styles.roleChipTextActive,
                      ]}
                    >
                      Student
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleChip,
                      role === 'teacher' &&
                        styles.roleChipActive,
                    ]}
                    onPress={() => setRole('teacher')}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'teacher' &&
                          styles.roleChipTextActive,
                      ]}
                    >
                      Teacher
                    </Text>
                  </Pressable>
                </View>

                {error && (
                  <Text style={styles.error}>
                    {error}
                  </Text>
                )}

                {loading ? (
                  <ActivityIndicator
                    size="large"
                    color={COLORS.primary}
                    style={styles.loader}
                  />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Sign Up"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>
            )}

            {!success && (
              <Link href="/login" style={styles.link}>
                Already have an account? Sign In
              </Link>
            )}
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </CampusPhotoBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF0F8',
  },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 24,
    backgroundColor: '#FFFEFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EED9EE',
    shadowColor: '#B989CC',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.deepPurple,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  form: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 5,
  },
  input: {
    backgroundColor: '#FFF8FC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEDFED',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  roleRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  roleChip: {
    flex: 1,
    backgroundColor: '#FFF8FC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 11,
    alignItems: 'center',
    marginRight: 8,
  },
  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  roleChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  roleChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'left',
    marginTop: 2,
  },
  loader: {
    marginVertical: 12,
  },
  link: {
    fontSize: 14,
    color: COLORS.deepPurple,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 8,
  },
  successContainer: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
});