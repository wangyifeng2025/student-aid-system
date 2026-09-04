import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, HOME_SERVICES, type HomeServiceItem } from '@/constants/brand';

type Props = {
  onPressService?: (item: HomeServiceItem) => void;
};

export function ServiceGrid({ onPressService }: Props) {
  return (
    <View style={styles.grid}>
      {HOME_SERVICES.map((item) => {
        const soon = !!item.comingSoon;
        return (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.cell,
              soon && styles.cellSoon,
              pressed && styles.cellPressed,
            ]}
            accessibilityLabel={soon ? `${item.label}，建设中` : item.label}
            onPress={() => onPressService?.(item)}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={item.icon}
                size={24}
                color={soon ? Brand.mutedForeground : Brand.primary}
              />
            </View>
            <Text style={[styles.label, soon && styles.labelSoon]}>{item.label}</Text>
            {soon ? <Text style={styles.soonText}>建设中</Text> : null}
          </Pressable>
        );
      })}
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
    gap: 4,
    paddingVertical: 10,
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
    minHeight: 96,
  },
  cellPressed: {
    transform: [{ scale: 0.97 }],
  },
  cellSoon: {
    backgroundColor: Brand.secondary,
    elevation: 0,
    shadowOpacity: 0,
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
  labelSoon: {
    color: Brand.mutedForeground,
  },
  soonText: {
    fontSize: 10,
    fontWeight: '600',
    color: Brand.warning,
  },
});
