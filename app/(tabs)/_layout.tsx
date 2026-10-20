import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, useProfileRole } from '@/lib/profiles';

const TAB_THEME = {
  active: '#D95798',
  inactive: '#63465F',
  selectedIcon: '#FCE4F0',
} as const;

export default function TabLayout() {
  const { user } = useAuth();
  const role = useProfileRole(user?.id);

  useEffect(() => {
    let active = true;

    if (!user) {
      return () => {
        active = false;
      };
    }

    getProfile(user.id).catch((error: unknown) => {
      if (active) {
        console.error('Unable to load the signed-in user role.', error);
      }
    });

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TAB_THEME.active,
        tabBarInactiveTintColor: TAB_THEME.inactive,
        headerShown: false,
        sceneStyle: { backgroundColor: '#FFF8FC' },
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: [
          styles.bar,
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="home"
              color={color}
              focused={focused}
              selectedBackground={TAB_THEME.selectedIcon}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: role === 'teacher' ? 'Records' : 'History',
          href: '/history',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="time"
              color={color}
              focused={focused}
              selectedBackground={TAB_THEME.selectedIcon}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarShowLabel: false,
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Scan QR code',
          href: role === 'student' ? '/scan' : null,
          tabBarIcon: () => <ScanTabIcon />,
        }}
      />

      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarLabelStyle: [
            styles.label,
            (role === 'admin' || role === 'teacher') && styles.adminEventsLabel,
          ],
          href: role === 'student' || role === 'admin'
            ? '/events'
            : null,
          tabBarIcon: ({ color, focused }) =>
            role === 'admin' ? (
              <AdminEventsTabIcon />
            ) : (
              <TabIcon
                name="calendar"
                color={color}
                focused={focused}
                selectedBackground={TAB_THEME.selectedIcon}
              />
            ),
        }}
      />

       <Tabs.Screen
        name="teacher"
        options={{
          title: 'Events',
          href:
            role === 'teacher'
              ? '/teacher'
              : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="briefcase"
              color={color}
              focused={focused}
              selectedBackground={TAB_THEME.selectedIcon}
            />
          ),
        }}
      />

      
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Records',
          href: role === 'admin' ? '/admin' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="shield-checkmark"
              color={color}
              focused={focused}
              selectedBackground={TAB_THEME.selectedIcon}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person"
              color={color}
              focused={focused}
              selectedBackground={TAB_THEME.selectedIcon}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function ScanTabIcon() {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [animation]);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });
  const haloOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.62],
  });
  const haloScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.28],
  });

  return (
    <View style={styles.scanIconArea}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scanHalo,
          {
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.scanButton,
          {
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <LinearGradient
          colors={['#FFB5D8', '#E66BAE', '#A978F2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scanGradient}
        >
          <Ionicons name="qr-code" color="#FFFFFF" size={34} />
          <View style={styles.scanSparkle}>
            <Ionicons name="sparkles" color="#FFF4FA" size={11} />
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function AnimatedCalendarTabIcon({
  focused,
}: {
  focused: boolean;
}) {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, [animation]);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const calendar = (
    <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
      <Ionicons
        name="calendar-outline"
        color={focused ? '#D95798' : '#B34F91'}
        size={36}
      />
    </Animated.View>
  );

  return <View style={styles.calendarIconArea}>{calendar}</View>;
}

function AdminEventsTabIcon() {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [animation]);

  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <LinearGradient
      colors={['#F28ABF', '#D95798', '#9B6BD1']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.adminEventsIcon}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <Ionicons name="calendar" color="#FFFFFF" size={26} />
      </Animated.View>
    </LinearGradient>
  );
}

function TabIcon({
  name,
  color,
  focused,
  selectedBackground,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  selectedBackground: string;
}) {
  return (
    <View
      style={[
        styles.iconWrap,
        focused && { backgroundColor: selectedBackground },
      ]}
    >
      <Ionicons name={name} color={color} size={26} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 7,
    height: 72,
    marginHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderWidth: 0,
    borderRadius: 23,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: {
    paddingTop: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  adminEventsLabel: {
    marginTop: 3,
  },
  iconWrap: {
    width: 44,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  calendarIconArea: {
    width: 48,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminEventsIcon: {
    width: 42,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    elevation: 5,
    shadowColor: '#D95798',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  scanIconArea: {
    width: 60,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanHalo: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: 'rgba(244, 162, 200, 0.32)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.82)',
  },
  scanButton: {
    width: 54,
    height: 54,
    overflow: 'hidden',
    borderRadius: 19,
    elevation: 10,
    shadowColor: COLORS.deepPink,
    shadowOpacity: 0.42,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
  },
  scanGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 19,
  },
  scanSparkle: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
});