import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, HOME_SERVICES, type HomeServiceItem } from '@/constants/brand';

type Props = {
  onPressService?: (item: HomeServiceItem) => void;
};

export function ServiceGrid({ onPressService }: Props) {
  return (
    <View style={styles.grid}>
      {HOME_SERVICES.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
          accessibilityLabel={item.label}
          onPress={() => onPressService?.(item)}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={24} color={Brand.primary} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cell: {
    width: '23%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
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
  cellPressed: {
    transform: [{ scale: 0.97 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: Brand.foreground,
  },
});
