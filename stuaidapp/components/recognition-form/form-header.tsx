import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
};

export function FormHeader({ title, right, onBack }: Props) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.backRow}
        accessibilityLabel="返回"
        hitSlop={8}
        onPress={onBack ?? (() => router.back())}>
        <Ionicons name="chevron-back" size={20} color={Brand.primary} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>{right}</View>
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
  right: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
