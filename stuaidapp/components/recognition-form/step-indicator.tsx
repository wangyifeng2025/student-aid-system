import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  steps: string[];
  current: number;
  onSelect?: (index: number) => void;
};

export function StepIndicator({ steps, current, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.item}>
            {i > 0 && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: i <= current ? Brand.primary : Brand.border },
                ]}
              />
            )}
            <Pressable
              style={styles.step}
              hitSlop={4}
              disabled={!onSelect}
              onPress={() => onSelect?.(i)}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                  !done && !active && styles.dotPending,
                ]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color={Brand.primaryForeground} />
                ) : (
                  <Text style={[styles.dotText, active && styles.dotTextActive]}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  (done || active) && styles.labelActive,
                ]}
                numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const DOT_SIZE = 28;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  line: {
    height: 2,
    flex: 1,
    marginTop: DOT_SIZE / 2 - 1,
    marginHorizontal: -8,
  },
  step: {
    alignItems: 'center',
    minWidth: 64,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotPending: {
    backgroundColor: Brand.background,
    borderWidth: 2,
    borderColor: Brand.border,
  },
  dotActive: {
    backgroundColor: Brand.primary,
  },
  dotDone: {
    backgroundColor: Brand.success,
  },
  dotText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.mutedForeground,
  },
  dotTextActive: {
    color: Brand.primaryForeground,
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    color: Brand.mutedForeground,
    textAlign: 'center',
  },
  labelActive: {
    color: Brand.primary,
  },
});
