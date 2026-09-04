import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/recognition-form/form-header';
import { AttachmentsPanel } from '@/components/recognition-form/attachments-panel';
import {
  ReviewFilterBar,
  type ReviewFilterValue,
} from '@/components/reviews/review-filter-bar';
import { ReviewListItem } from '@/components/reviews/review-list-item';
import { Brand } from '@/constants/brand';
import { SPECIAL_GROUP_OPTIONS } from '@/constants/recognition-options';
import {
  canExportRecognitionSummary,
  recordsTodoStatusOptionsForRole,
  todoStatusOptionsForRole,
} from '@/constants/review-options';
import { ApiError, recognitionApi, reviewApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { RecognitionListItem } from '@/types/recognition';

type Tab = 'mine' | 'pipeline' | 'done';

const EMPTY_FILTER: ReviewFilterValue = {
  keyword: '',
  deptId: 0,
  classId: 0,
  status: '',
  specialType: '',
};

/**
 * 困难认定审核列表：
 * - 本级待办：当前角色可操作
 * - 在途：本级 + 下级未审（教学系可看班级未审；资助中心可看班/系未审）
 * - 已审核：本人已审记录
 */
export default function RecognitionReviewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const [tab, setTab] = useState<Tab>('mine');
  const [filter, setFilter] = useState<ReviewFilterValue>(EMPTY_FILTER);
  const [items, setItems] = useState<RecognitionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previewItem, setPreviewItem] = useState<RecognitionListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const canExport = canExportRecognitionSummary(role);

  const statusOptions = useMemo(
    () =>
      tab === 'pipeline'
        ? recordsTodoStatusOptionsForRole(role)
        : tab === 'mine'
          ? todoStatusOptionsForRole(role)
          : recordsTodoStatusOptionsForRole(role),
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
          specialType: activeFilter.specialType || undefined,
        };
        const res =
          activeTab === 'mine'
            ? await reviewApi.todo(common)
            : activeTab === 'pipeline'
              ? await reviewApi.records({ ...common, tab: 'todo' })
              : await reviewApi.records({ ...common, tab: 'done' });
        setItems(res.items);
        setTotal(res.total);
        if (!silent) setSelectedIds(new Set());
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

  async function handleExportSummary() {
    if (exporting) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0 && tab === 'mine' && total === 0) {
      Alert.alert('暂无数据', '当前没有本级待审记录');
      return;
    }
    setExporting(true);
    try {
      await recognitionApi.exportSummary({
        keyword: filter.keyword || undefined,
        deptId: filter.deptId || undefined,
        classId: filter.classId || undefined,
        specialType: filter.specialType || undefined,
        status: filter.status || undefined,
        ids: ids.length ? ids : undefined,
        scope: ids.length ? undefined : tab === 'mine' ? 'todo' : 'approved',
      });
    } catch (e) {
      Alert.alert('导出失败', e instanceof ApiError ? e.message : '请稍后重试');
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader
        title="困难认定审核"
        right={
          canExport ? (
            <Pressable
              style={styles.exportBtn}
              disabled={exporting}
              onPress={() => void handleExportSummary()}
              accessibilityLabel="导出认定结果汇总表">
              {exporting ? (
                <ActivityIndicator size="small" color={Brand.primary} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color={Brand.primary} />
                  <Text style={styles.exportText}>
                    {selectedIds.size > 0 ? `导出${selectedIds.size}` : '导出'}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null
        }
      />

      <View style={styles.tabs}>
        <TabButton
          label="本级待办"
          active={tab === 'mine'}
          onPress={() => {
            setTab('mine');
            setSelectedIds(new Set());
          }}
        />
        <TabButton
          label="在途"
          active={tab === 'pipeline'}
          onPress={() => {
            setTab('pipeline');
            setSelectedIds(new Set());
          }}
        />
        <TabButton
          label="已审核"
          active={tab === 'done'}
          onPress={() => {
            setTab('done');
            setSelectedIds(new Set());
          }}
        />
      </View>

      <ReviewFilterBar
        value={filter}
        statusOptions={statusOptions}
        specialTypeOptions={SPECIAL_GROUP_OPTIONS}
        onApply={(next) => setFilter(next)}
      />

      {tab === 'pipeline' ? (
        <Text style={styles.hint}>
          含本级待审及下级尚未完成的申请（如班级未审、教学系未审），便于督办。
        </Text>
      ) : null}
      {canExport ? (
        <Text style={styles.hint}>
          {tab === 'mine'
            ? '未勾选时导出本级待审名单；勾选后仅导出选中记录。'
            : '未勾选时导出已认定通过名单；勾选后仅导出选中记录。'}
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
          ListHeaderComponent={
            <Text style={styles.countText}>共 {total} 条</Text>
          }
          renderItem={({ item }) => (
            <ReviewListItem
              item={item}
              selectable={canExport}
              selected={selectedIds.has(item.id)}
              onToggleSelect={(row) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.id)) next.delete(row.id);
                  else next.add(row.id);
                  return next;
                });
              }}
              onPress={(row) => router.push(`/reviews/${row.id}` as Href)}
              onPreviewProof={setPreviewItem}
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

      <Modal
        visible={previewItem !== null}
        animationType="slide"
        onRequestClose={() => setPreviewItem(null)}>
        <View style={[styles.previewScreen, { paddingTop: insets.top }]}>
          <FormHeader
            title={previewItem ? `${previewItem.student_name} · 证明材料` : '证明材料'}
            onBack={() => setPreviewItem(null)}
          />
          <View style={styles.previewBody}>
            {previewItem ? (
              <AttachmentsPanel recognitionId={previewItem.id} editable={false} />
            ) : null}
          </View>
        </View>
      </Modal>
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 8,
  },
  exportText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
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
  previewScreen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  previewBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
