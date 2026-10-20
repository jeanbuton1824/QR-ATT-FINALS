import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export default function AppButton({
  title,
  icon,
  theme,
  onPress,
  disabled = false,
  loading = false,
}: Props) {
  if (theme === 'primary') {
    return (
      <View style={styles.buttonOuter}>
        <Pressable
          style={({ pressed }) => [
            styles.buttonInner,
            styles.primaryFill,
            (disabled || loading) && styles.disabled,
            pressed && !disabled && !loading && styles.pressed,
          ]}
          onPress={onPress}
          disabled={disabled || loading}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || loading, busy: loading }}
        >
          <LinearGradient
            colors={['#D982C5', '#9966FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientFill}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name={icon}
                  size={20}
                  color={COLORS.textOnPrimary}
                  style={styles.icon}
                />
                <Text style={[styles.label, styles.primaryLabel]}>
                  {title}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.buttonOuter}>
      <Pressable
        style={({ pressed }) => [
          styles.buttonInner,
          styles.secondaryFill,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <Ionicons
          name={icon}
          size={22}
          color={COLORS.textSecondary}
          style={styles.icon}
        />
        <Text style={styles.label}>{title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    marginBottom: 12,
  },
  buttonInner: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryFill: {
    backgroundColor: COLORS.primary,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  gradientFill: {
    minHeight: 54,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryFill: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 20,
  },
  icon: { marginRight: 10 },
  label: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  primaryLabel: { color: COLORS.textOnPrimary, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});
