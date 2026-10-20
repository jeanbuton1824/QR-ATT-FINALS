import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import CampusPhotoBackground from '@/components/CampusPhotoBackground';
import { signIn, useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace('/(tabs)');
  }, [session, router]);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await signIn(email.trim(), password);
      if (authError) setError(authError.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to record your attendance</Text>

            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={19} color={COLORS.primary} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@school.edu"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                keyboardType="email-address"
                editable={!loading}
                accessibilityLabel="Email address"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!showPassword}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                editable={!loading}
                accessibilityLabel="Password"
              />
              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={10}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !loading && styles.pressed,
                loading && styles.disabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              <LinearGradient
                colors={['#D982C5', '#9966FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitText}>Sign In</Text>
                    
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Text style={styles.footerText}>
              New to QR-ATT? <Link href="/register" style={styles.link}>Create an account</Link>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </CampusPhotoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF0F8' },
  keyboardView: { flex: 1 },
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
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
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
  title: { color: COLORS.deepPurple, fontSize: 27, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6, marginBottom: 20, textAlign: 'center' },
  label: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 10 },
  inputWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E8E2F1',
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 12, paddingHorizontal: 10 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F2', borderRadius: 12, padding: 10, marginTop: 12 },
  error: { color: COLORS.danger, fontSize: 12, flex: 1, marginLeft: 7, lineHeight: 17 },
  submitButton: { borderRadius: 16, overflow: 'hidden', marginTop: 22, elevation: 3 },
  submitGradient: { minHeight: 54, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginRight: 10 },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  footerText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 20 },
  link: { color: COLORS.deepPurple, fontWeight: '800' },
});
