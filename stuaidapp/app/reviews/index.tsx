import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { ReviewListItem } from '@/components/reviews/review-list-item';
import { Brand } from '@/constants/brand';
import { ApiError, reviewApi } from '@/lib/api';
import type { RecognitionListItem } from '@/types/recognition';

type Tab = 'todo' | 'done';

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('todo');
  const [items, setItems] = useState<RecognitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeTab: Tab, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res =
        activeTab === 'todo' ? await reviewApi.todo() : await reviewApi.records({ tab: 'done' });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  function handleRefresh() {
    setRefreshing(true);
    load(tab, true);
  }

  function handlePressItem(item: RecognitionListItem) {
    router.push(`/reviews/${item.id}` as Href);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="审核管理" />

      <View style={styles.tabs}>
        <TabButton label="待办审核" active={tab === 'todo'} onPress={() => setTab('todo')} />
        <TabButton label="已审核" active={tab === 'done'} onPress={() => setTab('done')} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(tab)}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Brand.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <ReviewListItem item={item} onPress={handlePressItem} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{tab === 'todo' ? '暂无待办审核' : '暂无已审核记录'}</Text>
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
    paddingBottom: 6,
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
