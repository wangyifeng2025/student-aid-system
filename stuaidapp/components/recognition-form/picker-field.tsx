import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import type { Option } from '@/constants/recognition-options';

type Props = {
  label: string;
  required?: boolean;
  value: string;
  options: Option[];
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
  style?: object;
};

export function PickerField({
  label,
  required,
  value,
  options,
  placeholder,
  hint,
  onChange,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value);

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable style={styles.control} onPress={() => setOpen(true)}>
        <Text style={[styles.controlText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : (placeholder ?? '请选择')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Brand.mutedForeground} />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>选择{label}</Text>
            <Pressable hitSlop={8} accessibilityLabel="关闭" onPress={() => setOpen(false)}>
              <Ionicons name="close" size={22} color={Brand.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  style={styles.option}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {o.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={Brand.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '500',
    color: Brand.foreground,
  },
  required: {
    color: Brand.error,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  controlText: {
    flex: 1,
    fontSize: 15,
    color: Brand.foreground,
  },
  placeholder: {
    color: Brand.mutedForeground,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  sheet: {
    maxHeight: '65%',
    backgroundColor: Brand.card,
    borderTopLeftRadius: Brand.radius,
    borderTopRightRadius: Brand.radius,
    paddingTop: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.foreground,
  },
  sheetList: {
    paddingHorizontal: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  optionText: {
    fontSize: 15,
    color: Brand.foreground,
  },
  optionTextActive: {
    color: Brand.primary,
    fontWeight: '600',
  },
});
