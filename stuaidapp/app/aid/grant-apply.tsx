import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/recognition-form/form-header';
import { StatusBadge } from '@/components/reviews/status-badge';
import { Brand } from '@/constants/brand';
import { difficultyLabel } from '@/constants/review-options';
import { ApiError, grantApi, recognitionApi } from '@/lib/api';
import type { RecognitionListItem } from '@/types/recognition';
import type { GrantListItem } from '@/types/grant';

export default function GrantApplyEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [approvedRecs, setApprovedRecs] = useState<RecognitionListItem[]>([]);
  const [grants, setGrants] = useState<GrantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingYear, setCreatingYear] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, grantRes] = await Promise.all([
        recognitionApi.list({ status: 'approved', pageSize: 50 }),
        grantApi.list({ pageSize: 50 }),
      ]);
      setApprovedRecs(recRes.items);
      setGrants(grantRes.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePress(rec: RecognitionListItem) {
    const existing = grants.find((g) => g.year === rec.year);
    if (existing) {
      router.push(`/aid/grant/${existing.id}`);
      return;
    }
    setCreatingYear(rec.year);
    try {
      const created = await grantApi.create({ recognition_id: rec.id, grant_type: 'national_aid' });
      router.push(`/aid/grant/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '创建助学金申请失败，请稍后重试');
    } finally {
      setCreatingYear(null);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="助学金申请" />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            助学金申请需基于已通过的困难认定发起，请选择下方一条已通过的认定记录继续。
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={load}>
                <Text style={styles.retryText}>重试</Text>
              </Pressable>
            </View>
          ) : null}

          {approvedRecs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="alert-circle-outline" size={36} color={Brand.mutedForeground} />
              <Text style={styles.emptyText}>暂无已通过的困难认定，请先完成困难认定申请。</Text>
              <Pressable style={styles.primaryBtn} onPress={() => router.push('/aid/apply')}>
                <Text style={styles.primaryBtnText}>前往困难认定申请</Text>
              </Pressable>
            </View>
          ) : (
            approvedRecs.map((rec) => {
              const existing = grants.find((g) => g.year === rec.year);
              const busy = creatingYear === rec.year;
              return (
                <Pressable
                  key={rec.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  disabled={busy}
                  onPress={() => handlePress(rec)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{rec.year} 年度困难认定</Text>
                    {existing ? (
                      <StatusBadge status={existing.status} kind="grant" />
                    ) : (
                      <View style={styles.availableBadge}>
                        <Text style={styles.availableBadgeText}>可申请</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSub}>
                    困难等级：{difficultyLabel(rec.difficulty_level)}
                  </Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardAction}>
                      {busy ? '正在创建申请…' : existing ? '继续查看 / 填写' : '发起国家助学金申请'}
                    </Text>
                    {busy ? (
                      <ActivityIndicator size="small" color={Brand.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={Brand.mutedForeground} />
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: Brand.mutedForeground,
    marginBottom: 4,
  },
  errorBox: {
    padding: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.errorSurface,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: Brand.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.card,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.primary,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  primaryBtn: {
    marginTop: 4,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: Brand.primary,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
  card: {
    padding: 16,
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.foreground,
  },
  availableBadge: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.successSurface,
  },
  availableBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.success,
  },
  cardSub: {
    marginTop: 6,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  cardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAction: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.primary,
  },
});
