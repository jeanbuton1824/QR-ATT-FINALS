import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import CampusPhotoBackground from '@/components/CampusPhotoBackground';
import { useAuth } from '@/lib/auth';

export default function WelcomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [float]);

  useEffect(() => {
    if (session) router.replace('/(tabs)');
  }, [session, router]);

  const logoOffset = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <CampusPhotoBackground style={[styles.background, { width }]}>
      <LinearGradient
        colors={[
          'rgba(31, 35, 79, 0.14)',
          'rgba(31, 26, 70, 0.48)',
          'rgba(22, 17, 48, 0.82)',
        ]}
        locations={[0, 0.55, 1]}
        style={styles.backgroundOverlay}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animated.View
              style={[
                styles.logoFrame,
                { transform: [{ translateY: logoOffset }] },
              ]}
            >
              <Image
                source={require('../assets/images/cctc-logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="CCTC QR Attendance logo"
              />
            </Animated.View>

            <View style={styles.brandCopy}>
              <Text style={styles.eyebrow}>CCTC CAMPUS</Text>
              <Text style={styles.title}>CCTC QR</Text>
              <Text style={styles.titleAccent}>Attendance System</Text>
              <Text style={styles.subtitle}>Fast • Secure • Digital Attendance</Text>
            </View>

            {/* ✅ BUTTONS ARE CENTERED HERE */}
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push('/login')}
                accessibilityRole="button"
                accessibilityLabel="Log in"
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.pressed,
                ]}
              >
                <LinearGradient
                  colors={['#FF99CC', '#9966FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionGradient}
                >
                  <Text style={styles.actionText}>LOG IN</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => router.push('/register')}
                accessibilityRole="button"
                accessibilityLabel="Sign up"
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.pressed,
                ]}
              >
                <LinearGradient
                  colors={['#9966FF', '#CC66C9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionGradient}
                >
                  <Text style={styles.actionText}>SIGN UP</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footer}>© 2026 CCTC — All Rights Reserved</Text>
        </ScrollView>
      </SafeAreaView>
    </CampusPhotoBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundOverlay: { ...StyleSheet.absoluteFillObject },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center', // ✅ Centers vertically
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
  },
  content: {
    alignItems: 'center', // ✅ Centers horizontally
    justifyContent: 'center', // ✅ Centers all content including buttons
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 16,
    gap: 32, // ✅ Clean spacing between sections
  },
  logoFrame: {
    width: 206,
    height: 206,
    padding: 10,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9966FF',
    shadowOpacity: 0.23,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logo: { width: '100%', height: '100%', borderRadius: 38 },
  brandCopy: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(24, 15, 47, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 230, 242, 0.55)',
    shadowColor: '#100A24',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  eyebrow: {
    color: '#FFE6F2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 9,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  titleAccent: {
    color: '#FFE6F2',
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    color: '#FFF4FB',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actions: {
    width: '100%',
    gap: 16, // ✅ Space between SIGN UP and LOG IN
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 19,
    overflow: 'hidden',
    shadowColor: '#8F5EC8',
    shadowOpacity: 0.2,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  actionGradient: {
    minHeight: 60,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  footer: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    textAlign: 'center',
    paddingTop: 18,
  },
});