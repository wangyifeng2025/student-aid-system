import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/reviews/status-badge';
import { Brand } from '@/constants/brand';
import { difficultyLabel } from '@/constants/review-options';
import { specialTypesText } from '@/constants/recognition-options';
import { formatCurrency } from '@/lib/validators';
import type { RecognitionListItem } from '@/types/recognition';

type Props = {
  item: RecognitionListItem;
  onPress: (item: RecognitionListItem) => void;
};

export function ReviewListItem({ item, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(item)}>
      <View style={styles.top}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.student_name}</Text>
          <Text style={styles.no}>{item.student_no}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <Text style={styles.meta} numberOfLines={1}>
        {[item.dept_name, item.class_name, `${item.year} 年度`].filter(Boolean).join(' · ')}
      </Text>
      {item.special_types?.length ? (
        <Text style={styles.special} numberOfLines={2}>
          {specialTypesText(item.special_types)}
        </Text>
      ) : null}

      <View style={styles.bottom}>
        <Text style={styles.income}>
          人均年收入 ¥{formatCurrency(item.per_capita_annual_income)}
        </Text>
        {item.difficulty_level ? (
          <Text style={styles.difficulty}>{difficultyLabel(item.difficulty_level)}</Text>
        ) : null}
        <View style={styles.spacer} />
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
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexShrink: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.foreground,
  },
  no: {
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  meta: {
    marginTop: 6,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  special: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: Brand.foreground,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  income: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.primary,
  },
  difficulty: {
    marginLeft: 10,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.warning,
  },
  spacer: {
    flex: 1,
  },
});
