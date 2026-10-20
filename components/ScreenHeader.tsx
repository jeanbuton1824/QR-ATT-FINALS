import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap | null;
  large?: boolean;
};

export default function ScreenHeader({
  title,
  subtitle,
  icon = 'sparkles-outline',
  large = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#B86ACD', '#815BC7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        large && styles.largeContainer,
        { paddingTop: Math.max(insets.top, 18) },
      ]}
    >
      <View style={styles.heading}>
        {icon && (
          <View style={[styles.iconBubble, large && styles.largeIconBubble]}>
            <Ionicons
              name={icon}
              size={large ? 34 : 22}
              color={COLORS.textOnPrimary}
            />
          </View>
        )}
        <View style={styles.copy}>
          <Text style={styles.eyebrow}></Text>
          <Text style={[styles.title, large && styles.largeTitle]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  largeContainer: {
    paddingHorizontal: 36,
    paddingBottom: 30,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  largeIconBubble: {
    width: 82,
    height: 82,
    borderRadius: 24,
    marginRight: 24,
  },
  copy: { flex: 1 },
  eyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  largeTitle: { fontSize: 32 },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 4,
  },
});
