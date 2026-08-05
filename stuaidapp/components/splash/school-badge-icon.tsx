import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/brand';

/** 圆形校徽容器 + 书本图标（对应设计稿 splash-badge） */
export function SchoolBadgeIcon() {
  return (
    <View style={styles.badge}>
      <View style={styles.ring} pointerEvents="none" />
      <Ionicons name="book" size={64} color={Brand.primary} />
    </View>
  );
}

const BADGE_SIZE = 120;

const styles = StyleSheet.create({
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: Brand.primaryForeground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    margin: -3,
    borderRadius: (BADGE_SIZE + 6) / 2,
    borderWidth: 3,
    borderColor: Brand.primaryForeground,
    opacity: 0.36,
  },
});
