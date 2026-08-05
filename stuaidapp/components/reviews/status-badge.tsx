import { StyleSheet, Text, View } from 'react-native';

import { grantStatusMeta } from '@/constants/grant-options';
import { statusMeta } from '@/constants/review-options';
import type { ApplicationStatus } from '@/types/recognition';
import type { GrantStatus } from '@/types/grant';

type Props =
  | { status: ApplicationStatus; kind?: 'recognition' }
  | { status: GrantStatus; kind: 'grant' };

export function StatusBadge({ status, kind = 'recognition' }: Props) {
  const meta = kind === 'grant' ? grantStatusMeta(status as GrantStatus) : statusMeta(status as ApplicationStatus);
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
