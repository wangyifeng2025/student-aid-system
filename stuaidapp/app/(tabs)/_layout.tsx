import { Ionicons } from '@expo/vector-icons';
import { type Href, Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Brand } from '@/constants/brand';
import { useAuthStore } from '@/store/auth';

export default function TabLayout() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 兜底保护：若未登录直接进入本组（如开发期热重载），转回登录页。
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login' as Href);
    }
  }, [hydrated, isAuthenticated, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: Brand.mutedForeground,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: '服务',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '消息',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.select({ ios: 84, default: 64 }),
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    ...Platform.select({
      ios: {
        position: 'absolute',
      },
      default: {},
    }),
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
