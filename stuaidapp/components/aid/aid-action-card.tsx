import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AidActionItem } from '@/constants/aid';
import { Brand } from '@/constants/brand';

type Props = {
  item: AidActionItem;
  onPress?: (item: AidActionItem) => void;
};

export function AidActionCard({ item, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityLabel={item.title}
      onPress={() => onPress?.(item)}>
      <View style={styles.icon}>
        <Ionicons name={item.icon} size={24} color={Brand.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.desc}>{item.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Brand.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: Brand.radius,
    backgroundColor: Brand.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.brand50,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.foreground,
  },
  desc: {
    marginTop: 2,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
});
