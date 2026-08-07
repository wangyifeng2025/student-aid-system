import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { difficultyLabel, levelName, reviewActionLabel } from '@/constants/review-options';

/** 认定 / 助学金评审记录共用的最小字段集。 */
export type TimelineReview = {
  id: number;
  level: number;
  reviewer_name: string;
  action: string;
  opinion: string;
  created_at: string;
  difficulty_level?: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReviewTimeline({ reviews }: { reviews: TimelineReview[] }) {
  if (reviews.length === 0) {
    return <Text style={styles.empty}>暂无评审记录</Text>;
  }

  return (
    <View style={styles.list}>
      {reviews.map((r, i) => {
        const passed = r.action === 'pass';
        return (
          <View key={r.id} style={styles.row}>
            <View style={styles.iconCol}>
              <View style={[styles.dot, { backgroundColor: passed ? Brand.success : Brand.error }]}>
                <Ionicons
                  name={passed ? 'checkmark' : 'close'}
                  size={12}
                  color={Brand.primaryForeground}
                />
              </View>
              {i < reviews.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.content}>
              <View style={styles.contentHeader}>
                <Text style={styles.title}>
                  {levelName(r.level)} · {r.reviewer_name || '—'}
                </Text>
                <Text style={[styles.action, { color: passed ? Brand.success : Brand.error }]}>
                  {reviewActionLabel(r.action)}
                </Text>
              </View>
              {r.difficulty_level ? (
                <Text style={styles.meta}>困难等级：{difficultyLabel(r.difficulty_level)}</Text>
              ) : null}
              {r.opinion ? <Text style={styles.opinion}>{r.opinion}</Text> : null}
              <Text style={styles.time}>{formatDateTime(r.created_at)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 13,
    color: Brand.mutedForeground,
    textAlign: 'center',
    paddingVertical: 16,
  },
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  iconCol: {
    width: 22,
    alignItems: 'center',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Brand.border,
    marginVertical: 2,
  },
  content: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 16,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.foreground,
  },
  action: {
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  opinion: {
    marginTop: 4,
    fontSize: 12,
    color: Brand.foreground,
    lineHeight: 18,
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    color: Brand.mutedForeground,
  },
});
