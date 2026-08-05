import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PickerField } from '@/components/recognition-form/picker-field';
import { TextField } from '@/components/recognition-form/text-field';
import { Brand } from '@/constants/brand';
import { RELATION_OPTIONS } from '@/constants/recognition-options';
import type { GrantFamilyMemberInput } from '@/types/grant';

type Props = {
  index: number;
  member: GrantFamilyMemberInput;
  onChange: (patch: Partial<GrantFamilyMemberInput>) => void;
  onRemove: () => void;
};

export function GrantFamilyMemberCard({ index, member, onChange, onRemove }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>家庭成员 {index + 1}</Text>
        <Pressable
          style={styles.removeBtn}
          accessibilityLabel="删除该成员"
          hitSlop={8}
          onPress={onRemove}>
          <Ionicons name="trash-outline" size={16} color={Brand.error} />
        </Pressable>
      </View>

      <View style={styles.row}>
        <TextField
          style={styles.flex2}
          label="姓名"
          required
          value={member.name}
          onChangeText={(v) => onChange({ name: v })}
          placeholder="姓名"
        />
        <TextField
          style={styles.flex1}
          label="年龄"
          value={member.age ? String(member.age) : ''}
          onChangeText={(v) => onChange({ age: Number(v.replace(/\D/g, '')) || 0 })}
          placeholder="0"
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.row}>
        <PickerField
          style={styles.flex1}
          label="与学生关系"
          value={member.relation}
          options={RELATION_OPTIONS}
          onChange={(v) => onChange({ relation: v })}
        />
        <TextField
          style={styles.flex1}
          label="工作 / 学习单位"
          value={member.work_unit}
          onChangeText={(v) => onChange({ work_unit: v })}
          placeholder="工作 / 学习单位"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.foreground,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.errorSurface,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
});
