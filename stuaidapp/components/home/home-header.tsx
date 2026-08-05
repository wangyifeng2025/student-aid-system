import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCopy, Brand } from '@/constants/brand';

type Props = {
  onPressNotifications?: () => void;
  onPressSearch?: () => void;
  onPressProfile?: () => void;
};

export function HomeHeader({ onPressNotifications, onPressSearch, onPressProfile }: Props) {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.touch}
        accessibilityLabel="通知"
        onPress={onPressNotifications}
        hitSlop={8}>
        <Ionicons name="notifications-outline" size={20} color={Brand.primary} />
      </Pressable>

      <Text style={styles.schoolName} numberOfLines={1}>
        {AppCopy.schoolName}
      </Text>

      <View style={styles.right}>
        <Pressable
          style={styles.touch}
          accessibilityLabel="搜索"
          onPress={onPressSearch}
          hitSlop={8}>
          <Ionicons name="search-outline" size={20} color={Brand.foreground} />
        </Pressable>
        <Pressable
          style={[styles.touch, styles.avatar]}
          accessibilityLabel="个人中心"
          onPress={onPressProfile}
          hitSlop={8}>
          <Ionicons name="person-outline" size={20} color={Brand.secondaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
    backgroundColor: Brand.background,
  },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolName: {
    position: 'absolute',
    left: 72,
    right: 72,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: Brand.foreground,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: Brand.secondary,
  },
});
