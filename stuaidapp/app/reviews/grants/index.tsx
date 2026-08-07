import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/recognition-form/form-header';
import { GrantReviewListItem } from '@/components/reviews/grant-review-list-item';
import {
  ReviewFilterBar,
  type ReviewFilterValue,
} from '@/components/reviews/review-filter-bar';
import { Brand } from '@/constants/brand';
import {
  grantRecordsTodoStatusOptionsForRole,
  grantTodoStatusOptionsForRole,
} from '@/constants/grant-options';
import { ApiError, grantReviewApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { GrantListItem } from '@/types/grant';

type Tab = 'mine' | 'pipeline' | 'done';

const EMPTY_FILTER: ReviewFilterValue = {
  keyword: '',
  deptId: 0,
  classId: 0,
  status: '',
};

export default function GrantReviewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const [tab, setTab] = useState<Tab>('mine');
  const [filter, setFilter] = useState<ReviewFilterValue>(EMPTY_FILTER);
  const [items, setItems] = useState<GrantListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = useMemo(
    () =>
      tab === 'pipeline'
        ? grantRecordsTodoStatusOptionsForRole(role)
        : tab === 'mine'
          ? grantTodoStatusOptionsForRole(role)
          : grantRecordsTodoStatusOptionsForRole(role),
    [tab, role],
  );

  const load = useCallback(
    async (activeTab: Tab, activeFilter: ReviewFilterValue, silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const common = {
          keyword: activeFilter.keyword || undefined,
          status: activeFilter.status || undefined,
          deptId: activeFilter.deptId || undefined,
          classId: activeFilter.classId || undefined,
        };
        const res =
          activeTab === 'mine'
            ? await grantReviewApi.todo(common)
            : activeTab === 'pipeline'
              ? await grantReviewApi.records({ ...common, tab: 'todo' })
              : await grantReviewApi.records({ ...common, tab: 'done' });
        setItems(res.items);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(tab, filter);
  }, [tab, filter, load]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="助学金审核" />

      <View style={styles.tabs}>
        <TabButton label="本级待办" active={tab === 'mine'} onPress={() => setTab('mine')} />
        <TabButton label="在途" active={tab === 'pipeline'} onPress={() => setTab('pipeline')} />
        <TabButton label="已审核" active={tab === 'done'} onPress={() => setTab('done')} />
      </View>

      <ReviewFilterBar
        value={filter}
        statusOptions={statusOptions}
        onApply={(next) => setFilter(next)}
      />

      {tab === 'pipeline' ? (
        <Text style={styles.hint}>
          含本级待审及下级尚未完成的助学金申请，可按院系 / 班级 / 姓名筛选督办。
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(tab, filter)}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(tab, filter, true);
              }}
              tintColor={Brand.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={<Text style={styles.countText}>共 {total} 条</Text>}
          renderItem={({ item }) => (
            <GrantReviewListItem
              item={item}
              onPress={(row) => router.push(`/reviews/grants/${row.id}` as Href)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {tab === 'mine'
                  ? '暂无本级待办'
                  : tab === 'pipeline'
                    ? '暂无在途申请'
                    : '暂无已审核记录'}
              </Text>
            </View>
          }
        />
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
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
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
    paddingBottom: 4,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.inputBackground,
  },
  tabBtnActive: {
    backgroundColor: Brand.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.mutedForeground,
  },
  tabTextActive: {
    color: Brand.primaryForeground,
  },
  hint: {
    marginHorizontal: 20,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: Brand.mutedForeground,
  },
  countText: {
    marginBottom: 8,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  list: {
    padding: 20,
  },
  separator: {
    height: 12,
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
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
  },
});
