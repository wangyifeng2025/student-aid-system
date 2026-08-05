import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/reviews/status-badge';
import { Brand } from '@/constants/brand';
import type { ApplicationStatus } from '@/types/recognition';
import type { GrantStatus } from '@/types/grant';

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
} & ({ kind: 'recognition'; status: ApplicationStatus } | { kind: 'grant'; status: GrantStatus });

export function AidRecordItem({ title, subtitle, onPress, kind, status }: Props) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.top}>
        <Text style={styles.title}>{title}</Text>
        {kind === 'grant' ? (
          <StatusBadge status={status} kind="grant" />
        ) : (
          <StatusBadge status={status} />
        )}
      </View>
      <View style={styles.bottom}>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Brand.mutedForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
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
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.foreground,
  },
  bottom: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subtitle: {
    flex: 1,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
});
