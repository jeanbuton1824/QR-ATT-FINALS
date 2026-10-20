import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import CampusBackground from '@/components/CampusBackground';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';
import { getProfile, useProfileRole } from '@/lib/profiles';

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const role = useProfileRole(user?.id);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [torch, setTorch] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;
    getProfile(user.id).catch((error: unknown) => {
      if (active) {
        setRoleError(
          error instanceof Error
            ? error.message
            : 'Unable to verify scan-screen access.'
        );
      }
    });

    return () => {
      active = false;
    };
  }, [user]);

  if (role === null && roleError) {
    return (
      <CampusBackground>
        <View style={styles.permissionScreen}>
          <Ionicons name="alert-circle-outline" size={38} color={COLORS.danger} />
          <Text style={styles.permissionTitle}>Could not verify your account</Text>
          <Text style={styles.permissionText}>{roleError}</Text>
        </View>
      </CampusBackground>
    );
  }

  if (role === null) {
    return (
      <CampusBackground>
        <View style={styles.permissionScreen}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.permissionText}>Checking your account...</Text>
        </View>
      </CampusBackground>
    );
  }

  if (role !== 'student') {
    return (
      <CampusBackground>
        <View style={styles.permissionScreen}>
          <LinearGradient
            colors={['#B86ACD', '#815BC7']}
            style={styles.permissionIcon}
          >
            <Ionicons name="qr-code-outline" size={32} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.permissionTitle}>Student access only</Text>
          <Text style={styles.permissionText}>
            QR attendance scanning is available only to student accounts.
          </Text>
        </View>
      </CampusBackground>
    );
  }

  if (!permission) {
    return (
      <CampusBackground>
        <View style={styles.permissionScreen}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.permissionText}>Preparing your camera...</Text>
        </View>
      </CampusBackground>
    );
  }

  if (!permission.granted) {
    return (
      <CampusBackground>
        <View style={styles.permissionScreen}>
          <LinearGradient
            colors={['#B86ACD', '#815BC7']}
            style={styles.permissionIcon}
          >
            <Ionicons name="camera-outline" size={32} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            Allow camera access to scan an event QR code and securely record your attendance.
          </Text>
          <View style={styles.permissionButton}>
            <AppButton
              theme="primary"
              title="Enable Camera"
              icon="camera-outline"
              onPress={requestPermission}
            />
          </View>
        </View>
      </CampusBackground>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    try {
      const result = await registerAttendance(data, user?.id ?? '');
      setMessage(result.message);
      setSuccess(result.success);
      setDuplicate(!result.success && result.message.toLowerCase().includes('already registered'));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to connect. Please try again.'
      );
      setSuccess(false);
      setDuplicate(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setMessage(null);
    setSuccess(false);
    setDuplicate(false);
    setProcessing(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <LinearGradient
        colors={['rgba(49,33,63,0.72)', 'rgba(49,33,63,0.08)']}
        style={[styles.topOverlay, { paddingTop: insets.top + 18 }]}
      >
        <Text style={styles.brand}>QR-ATT</Text>
        <Text style={styles.title}>Scan to check in</Text>
        <Text style={styles.instruction}>Align the event QR code inside the frame</Text>
      </LinearGradient>

      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      <Pressable
        style={styles.torchButton}
        onPress={() => setTorch((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
      >
        <Ionicons name={torch ? 'flash' : 'flash-outline'} size={21} color="#FFFFFF" />
        <Text style={styles.torchLabel}>{torch ? 'Flash on' : 'Flash'}</Text>
      </Pressable>

      {scanned ? (
        <View style={styles.resultCard}>
          <View style={[styles.resultIcon, success || duplicate ? styles.successIcon : styles.errorIcon]}>
            {processing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons
                name={success || duplicate ? 'checkmark-circle' : 'alert-circle'}
                size={26}
                color={success || duplicate ? COLORS.success : COLORS.danger}
              />
            )}
          </View>
          <Text style={styles.resultTitle}>
            {processing
              ? 'Checking attendance...'
              : getResultTitle(message, success, duplicate)}
          </Text>
          <Text style={[
            styles.resultMessage,
            success || duplicate ? styles.successText : styles.errorText,
          ]}>
            {processing ? 'Validating this event with QR-ATT.' : getResultMessage(message)}
          </Text>
          {!processing ? (
            <AppButton
              theme="primary"
              title="Scan Again"
              icon="refresh-outline"
              onPress={handleScanAgain}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.bottomTip}>
          <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
          <Text style={styles.tipText}>Hold steady while the code is detected</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#17121D', justifyContent: 'center' },
  camera: { ...StyleSheet.absoluteFillObject },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brand: { color: COLORS.softPink, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', marginTop: 7 },
  instruction: { color: '#FFFFFF', fontSize: 13, lineHeight: 19, marginTop: 5 },
  frameWrap: {
    position: 'absolute',
    top: 200,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 248,
    height: 248,
    borderRadius: 28,
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
  },
  corner: {
    width: 39,
    height: 39,
    position: 'absolute',
    borderColor: '#D982C5',
  },
  topLeft: { top: -2, left: -2, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 16 },
  topRight: { top: -2, right: -2, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 16 },
  bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: -2, right: -2, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 16 },
  torchButton: {
    position: 'absolute',
    right: 22,
    top: 148,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: 'rgba(49,33,63,0.65)',
    alignItems: 'center',
  },
  torchLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginTop: 4 },
  bottomTip: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(49,33,63,0.68)',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  tipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  resultCard: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 88,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  resultIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  successIcon: { backgroundColor: '#E8F7ED' },
  errorIcon: { backgroundColor: '#FFF1F2' },
  resultTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 9 },
  resultMessage: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 5, marginBottom: 10 },
  successText: { color: COLORS.success },
  errorText: { color: COLORS.danger },
  permissionScreen: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 30 },
  permissionIcon: { width: 70, height: 70, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  permissionTitle: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  permissionText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  permissionButton: { width: '100%', marginTop: 22 },
});

function getResultTitle(message: string | null, success: boolean, duplicate: boolean) {
  if (success) return 'Attendance recorded';
  if (duplicate) return 'Already recorded';
  if (!message) return 'Could not check in';
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid qr')) return 'Invalid QR code';
  if (normalized.includes('event not found')) return 'Event not found';
  if (normalized.includes('ended') || normalized.includes('closed')) return 'Event closed';
  if (normalized.includes('connect') || normalized.includes('network') || normalized.includes('fetch')) {
    return 'Connection problem';
  }
  return 'Could not check in';
}

function getResultMessage(message: string | null) {
  if (!message) return 'Please try scanning again.';
  const normalized = message.toLowerCase();
  if (normalized.includes('already registered')) return 'Attendance already recorded.';
  if (normalized.includes('invalid qr')) return 'Please scan a valid event QR code.';
  if (normalized.includes('event not found')) {
    return 'The event could not be found. Ask the organizer to verify it in Supabase.';
  }
  if (normalized.includes('ended') || normalized.includes('closed')) {
    return 'This event is no longer accepting attendance.';
  }
  if (normalized.includes('not started')) return 'This event has not started yet.';
  if (
    normalized.includes('connect') ||
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout')
  ) {
    return 'Unable to connect. Please try again.';
  }
  return message;
}
