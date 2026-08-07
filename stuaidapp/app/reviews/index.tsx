import { Ionicons } from '@expo/vector-icons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/recognition-form/form-header';
import { Brand } from '@/constants/brand';
import { ApiError, grantReviewApi, reviewApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

/**
 * 评审工作台：班主任 / 教学系 / 资助中心共用。
 * 展示本级待办 + 在途（下级未审）数量提醒，并进入认定 / 助学金列表。
 */
export default function ReviewsHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);

  const [recognitionMine, setRecognitionMine] = useState(0);
  const [recognitionPipeline, setRecognitionPipeline] = useState(0);
  const [recognitionDone, setRecognitionDone] = useState(0);
  const [grantMine, setGrantMine] = useState(0);
  const [grantPipeline, setGrantPipeline] = useState(0);
  const [grantDone, setGrantDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [rMine, rPipe, rDone, gMine, gPipe, gDone] = await Promise.all([
        reviewApi.todo({ page: 1, pageSize: 1 }),
        reviewApi.records({ tab: 'todo', page: 1, pageSize: 1 }),
        reviewApi.records({ tab: 'done', page: 1, pageSize: 1 }),
        grantReviewApi.todo({ page: 1, pageSize: 1 }),
        grantReviewApi.records({ tab: 'todo', page: 1, pageSize: 1 }),
        grantReviewApi.records({ tab: 'done', page: 1, pageSize: 1 }),
      ]);
      setRecognitionMine(rMine.total);
      setRecognitionPipeline(rPipe.total);
      setRecognitionDone(rDone.total);
      setGrantMine(gMine.total);
      setGrantPipeline(gPipe.total);
      setGrantDone(gDone.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const mineTotal = recognitionMine + grantMine;
  const pipelineTotal = recognitionPipeline + grantPipeline;
  const roleLabel =
    role === 'department' ? '教学系' : role === 'aidcenter' ? '资助中心' : role === 'admin' ? '管理员' : '班主任';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="审核管理" />

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
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={Brand.primary}
            />
          }
          showsVerticalScrollIndicator={false}>
          <Text style={styles.roleHint}>当前角色：{roleLabel}</Text>

          <View style={[styles.alert, mineTotal > 0 ? styles.alertWarn : styles.alertOk]}>
            <Ionicons
              name={mineTotal > 0 ? 'notifications' : 'checkmark-circle'}
              size={20}
              color={mineTotal > 0 ? Brand.warning : Brand.success}
            />
            <View style={styles.alertBody}>
              <Text style={styles.alertTitle}>
                {mineTotal > 0 ? `本级待办 ${mineTotal} 条` : '本级暂无待办'}
              </Text>
              <Text style={styles.alertDesc}>
                困难认定 {recognitionMine} · 助学金 {grantMine}
                {pipelineTotal > mineTotal
                  ? `；在途（含下级未审）共 ${pipelineTotal} 条`
                  : ''}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>业务入口</Text>

          <EntryCard
            icon="document-text-outline"
            title="困难认定审核"
            subtitle="本级待办 / 在途督办 / 已审记录"
            todoCount={recognitionMine}
            pipelineCount={recognitionPipeline}
            doneCount={recognitionDone}
            onPress={() => router.push('/reviews/recognition' as Href)}
          />

          <EntryCard
            icon="wallet-outline"
            title="助学金审核"
            subtitle="本级待办 / 在途督办 / 已审记录"
            todoCount={grantMine}
            pipelineCount={grantPipeline}
            doneCount={grantDone}
            onPress={() => router.push('/reviews/grants' as Href)}
          />
        </ScrollView>
      )}
    </View>
  );
}

function EntryCard({
  icon,
  title,
  subtitle,
  todoCount,
  pipelineCount,
  doneCount,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  todoCount: number;
  pipelineCount: number;
  doneCount: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={22} color={Brand.primary} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          {todoCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{todoCount > 99 ? '99+' : todoCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
        <Text style={styles.cardMeta}>
          本级 {todoCount} · 在途 {pipelineCount} · 已审 {doneCount}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Brand.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  content: {
    padding: 20,
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
  roleHint: {
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: Brand.radius,
    marginBottom: 4,
  },
  alertWarn: {
    backgroundColor: Brand.warningSurface,
  },
  alertOk: {
    backgroundColor: Brand.successSurface,
  },
  alertBody: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.foreground,
  },
  alertDesc: {
    fontSize: 12,
    color: Brand.mutedForeground,
    lineHeight: 18,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 2,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.mutedForeground,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Brand.radius,
    backgroundColor: Brand.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: Brand.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.brand50,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.foreground,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.error,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.primaryForeground,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: Brand.primary,
  },
});
