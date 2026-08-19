import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { ROLE_LABELS } from '@/constants/roles';
import { useAuthStore } from '@/store/auth';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login' as Href);
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={Brand.primary} />
        </View>
        <Text style={styles.name}>{user?.real_name || '未登录'}</Text>
        <Text style={styles.sub}>
          {user?.username ? `${user.username} · ${ROLE_LABELS[user.role] ?? user.role}` : ''}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>手机号</Text>
          <Text style={styles.rowValue}>{user?.phone || '—'}</Text>
        </View>
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={Brand.error} />
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Brand.brand50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.foreground,
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  card: {
    padding: 4,
    borderRadius: Brand.radius,
    backgroundColor: Brand.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: Brand.mutedForeground,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.foreground,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.errorSurface,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.error,
  },
});
