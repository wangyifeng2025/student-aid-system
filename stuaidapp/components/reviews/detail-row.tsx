import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  label: string;
  value: string;
  full?: boolean;
};

export function DetailRow({ label, value, full }: Props) {
  return (
    <View style={[styles.row, full && styles.rowFull]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, full && styles.valueFull]} numberOfLines={full ? undefined : 1}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowFull: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  label: {
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  value: {
    flex: 1,
    marginLeft: 16,
    fontSize: 13,
    fontWeight: '500',
    color: Brand.foreground,
    textAlign: 'right',
  },
  valueFull: {
    flex: 0,
    marginLeft: 0,
    textAlign: 'left',
    lineHeight: 19,
  },
});
