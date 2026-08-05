import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import type { Option } from '@/constants/recognition-options';

type Props = {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
};

export function ChipMultiSelect({ options, selected, onToggle }: Props) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(o.value)}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  chipActive: {
    backgroundColor: Brand.brand50,
    borderColor: Brand.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.mutedForeground,
  },
  chipTextActive: {
    color: Brand.primary,
  },
});
