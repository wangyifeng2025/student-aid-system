import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/reviews/status-badge';
import { Brand } from '@/constants/brand';
import { grantApi, recognitionApi } from '@/lib/api';
import type { RecognitionListItem } from '@/types/recognition';
import type { GrantListItem } from '@/types/grant';

/** 学年当前进度小结：分别汇总本人的困难认定 / 助学金申请记录（可能有多条），
 * 展示最新一条状态与总数，点击进入完整记录列表。移动端受限于屏幕高度，
 * 首页只做摘要，详情留给 /aid/records 承载。 */
export function AidApplicationsCard() {
  const router = useRouter();
  const [recs, setRecs] = useState<RecognitionListItem[] | null>(null);
  const [grants, setGrants] = useState<GrantListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, grantRes] = await Promise.all([
        recognitionApi.list({ pageSize: 50 }).catch(() => null),
        grantApi.list({ pageSize: 50 }).catch(() => null),
      ]);
      setRecs(recRes?.items ?? []);
      setGrants(grantRes?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latestRec = recs?.[0];
  const latestGrant = grants?.[0];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push('/aid/records')}>
      <View style={styles.header}>
        <Text style={styles.heading}>我的申请</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerLink}>查看全部</Text>
          <Ionicons name="chevron-forward" size={14} color={Brand.mutedForeground} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={Brand.primary} />
        </View>
      ) : (
        <View style={styles.rows}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="document-text-outline" size={16} color={Brand.primary} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>困难认定</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {recs && recs.length > 0 ? `共 ${recs.length} 条记录` : '暂无申请记录'}
              </Text>
            </View>
            {latestRec ? <StatusBadge status={latestRec.status} /> : null}
          </View>

          <View style={[styles.row, styles.rowSpacing]}>
            <View style={[styles.rowIcon, styles.rowIconGrant]}>
              <Ionicons name="cash-outline" size={16} color={Brand.success} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>助学金</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {grants && grants.length > 0 ? `共 ${grants.length} 条记录` : '暂无申请记录'}
              </Text>
            </View>
            {latestGrant ? <StatusBadge status={latestGrant.status} kind="grant" /> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.foreground,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerLink: {
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  rows: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowSpacing: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: Brand.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.brand50,
  },
  rowIconGrant: {
    backgroundColor: Brand.successSurface,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.foreground,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
});
