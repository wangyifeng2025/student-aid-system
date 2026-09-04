import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AidRecordItem } from '@/components/aid/aid-record-item';
import { FormHeader } from '@/components/recognition-form/form-header';
import { Brand } from '@/constants/brand';
import { grantTypeLabel } from '@/constants/grant-options';
import { ApiError, grantApi, recognitionApi } from '@/lib/api';
import { formatCurrency } from '@/lib/validators';
import type { RecognitionListItem } from '@/types/recognition';
import type { GrantListItem } from '@/types/grant';

type Tab = 'recognition' | 'grant';

export default function AidRecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('recognition');
  const [recs, setRecs] = useState<RecognitionListItem[]>([]);
  const [grants, setGrants] = useState<GrantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [recRes, grantRes] = await Promise.all([
        recognitionApi.list({ pageSize: 50 }),
        grantApi.list({ pageSize: 50 }),
      ]);
      setRecs(recRes.items);
      setGrants(grantRes.items);
      hasLoadedRef.current = true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  // 每次进入/返回本页都重新拉取，删除后列表才能同步消失。
  useFocusEffect(
    useCallback(() => {
      void load(hasLoadedRef.current);
    }, [load]),
  );
  function openRecognition(item: RecognitionListItem) {
    // 统一进详情：退回/草稿可在此删除或继续填写，避免直接进编辑页找不到删除入口。
    router.push(`/aid/recognition/${item.id}`);
  }

  function openGrant(item: GrantListItem) {
    router.push(`/aid/grant/${item.id}`);
  }

  const list = tab === 'recognition' ? recs : grants;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="申请记录" />

      <View style={styles.tabs}>
        <TabButton label="困难认定" active={tab === 'recognition'} onPress={() => setTab('recognition')} />
        <TabButton label="助学金" active={tab === 'grant'} onPress={() => setTab('grant')} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Brand.primary} />
          }>
          {list.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="folder-open-outline" size={36} color={Brand.mutedForeground} />
              <Text style={styles.emptyText}>
                {tab === 'recognition' ? '暂无困难认定申请记录' : '暂无助学金申请记录'}
              </Text>
            </View>
          ) : tab === 'recognition' ? (
            recs.map((item) => (
              <AidRecordItem
                key={item.id}
                kind="recognition"
                status={item.status}
                title={`${item.year} 年度困难认定`}
                subtitle={`人均年收入 ¥${formatCurrency(item.per_capita_annual_income)}${(item.proof_count ?? 0) > 0 ? ` · 证明材料 ${item.proof_count} 份` : ''}`}
                onPress={() => openRecognition(item)}
              />
            ))
          ) : (
            grants.map((item) => (
              <AidRecordItem
                key={item.id}
                kind="grant"
                status={item.status}
                title={`${item.year} 年度 · ${grantTypeLabel(item.grant_type)}`}
                subtitle={[item.dept_name, item.class_name].filter(Boolean).join(' · ') || '—'}
                onPress={() => openGrant(item)}
              />
            ))
          )}

          <Pressable
            style={styles.newBtn}
            onPress={() =>
              tab === 'recognition' ? router.push('/aid/apply') : router.push('/aid/grant-apply')
            }>
            <Ionicons name="add-circle-outline" size={18} color={Brand.primary} />
            <Text style={styles.newBtnText}>
              {tab === 'recognition' ? '新增困难认定申请' : '申请助学金'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Brand.inputBackground,
  },
  tabBtnActive: {
    backgroundColor: Brand.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.mutedForeground,
  },
  tabBtnTextActive: {
    color: Brand.primaryForeground,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 12,
    gap: 12,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.brand50,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: Brand.radiusSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Brand.border,
  },
  newBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primary,
  },
});
