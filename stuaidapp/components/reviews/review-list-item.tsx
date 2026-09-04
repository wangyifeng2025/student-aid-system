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
  onPreviewProof?: (item: RecognitionListItem) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (item: RecognitionListItem) => void;
};

export function ReviewListItem({
  item,
  onPress,
  onPreviewProof,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const proofCount = item.proof_count ?? 0;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, selected && styles.cardSelected]}
      onPress={() => onPress(item)}>
      <View style={styles.top}>
        {selectable ? (
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSelect?.(item);
            }}
            style={styles.checkHit}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}>
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={20}
              color={selected ? Brand.primary : Brand.mutedForeground}
            />
          </Pressable>
        ) : null}
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
        {proofCount > 0 && onPreviewProof ? (
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation?.();
              onPreviewProof(item);
            }}
            style={styles.proofBtn}>
            <Ionicons name="eye-outline" size={14} color={Brand.primary} />
            <Text style={styles.proofText}>材料 {proofCount}</Text>
          </Pressable>
        ) : (
          <Text style={styles.noProof}>{proofCount > 0 ? `材料 ${proofCount}` : '无材料'}</Text>
        )}
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
  checkHit: {
    paddingRight: 2,
  },
  cardSelected: {
    borderColor: Brand.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flex: 1,
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
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  proofText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.primary,
  },
  noProof: {
    marginRight: 8,
    fontSize: 11,
    color: Brand.mutedForeground,
  },
});
