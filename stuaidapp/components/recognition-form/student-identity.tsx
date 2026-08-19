import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  name?: string;
  studentNo?: string;
  deptName?: string;
  className?: string;
  extra?: ReactNode;
};

export function StudentIdentity({ name, studentNo, deptName, className, extra }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(name || '学').charAt(0)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name || '—'}
          </Text>
          {studentNo ? (
            <Text style={styles.studentNo} numberOfLines={1}>
              {studentNo}
            </Text>
          ) : null}
        </View>
        {(deptName || className) ? (
          <View style={styles.chips}>
            {deptName ? (
              <View style={[styles.chip, styles.chipDept]}>
                <Ionicons name="business-outline" size={12} color={Brand.primary} />
                <Text style={styles.chipDeptText}>{deptName}</Text>
              </View>
            ) : null}
            {className ? (
              <View style={[styles.chip, styles.chipClass]}>
                <Ionicons name="people-outline" size={12} color={Brand.mutedForeground} />
                <Text style={styles.chipClassText}>{className}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {extra ? <View style={styles.extra}>{extra}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
    backgroundColor: Brand.card,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Brand.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.brand50,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.primary,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.foreground,
  },
  studentNo: {
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipDept: {
    backgroundColor: Brand.brand50,
  },
  chipDeptText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.primary,
  },
  chipClass: {
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  chipClassText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.mutedForeground,
  },
  extra: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
});
