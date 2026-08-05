import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { relationLabel } from '@/constants/recognition-options';
import type { GrantFamilyMember } from '@/types/grant';

export function GrantFamilyMemberView({
  index,
  member,
}: {
  index: number;
  member: GrantFamilyMember;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {index + 1}. {member.name || '未填写'}
        </Text>
        <Text style={styles.relation}>{relationLabel(member.relation)}</Text>
      </View>
      <Text style={styles.line}>
        年龄 {member.age || '—'}
        {member.work_unit ? ` · ${member.work_unit}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.foreground,
  },
  relation: {
    fontSize: 12,
    color: Brand.primary,
  },
  line: {
    fontSize: 12,
    color: Brand.mutedForeground,
    marginTop: 2,
  },
});
