import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  title: string;
  onPressNotifications?: () => void;
};

export function AidHeader({ title, onPressNotifications }: Props) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.backRow}
        accessibilityLabel="返回"
        hitSlop={8}
        onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={Brand.primary} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        style={styles.touch}
        accessibilityLabel="通知"
        hitSlop={8}
        onPress={onPressNotifications}>
        <Ionicons name="notifications-outline" size={20} color={Brand.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
    backgroundColor: Brand.background,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
    gap: 2,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
    color: Brand.primary,
  },
  title: {
    position: 'absolute',
    left: 72,
    right: 72,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: Brand.foreground,
  },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
