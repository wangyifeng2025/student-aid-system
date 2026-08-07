import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/recognition-form/form-header';
import { SectionCard } from '@/components/recognition-form/section-card';
import { DetailRow } from '@/components/reviews/detail-row';
import { ReviewActionModal, type ReviewActionMode } from '@/components/reviews/review-action-modal';
import { ReviewTimeline } from '@/components/reviews/review-timeline';
import { StatusBadge } from '@/components/reviews/status-badge';
import { Brand } from '@/constants/brand';
import { canReviewGrant, grantTypeLabel } from '@/constants/grant-options';
import {
  householdLabel,
  incomeSourceLabel,
  nationLabel,
  relationLabel,
} from '@/constants/recognition-options';
import { actingLevel, canWithdrawReview } from '@/constants/review-options';
import { ApiError, grantReviewApi } from '@/lib/api';
import { formatCurrency } from '@/lib/validators';
import { useAuthStore } from '@/store/auth';
import type { Grant } from '@/types/grant';
import type { ApplicationStatus } from '@/types/recognition';

export default function GrantReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);

  const [detail, setDetail] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ReviewActionMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const numericId = Number(id);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await grantReviewApi.get(numericId);
      setDetail(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [numericId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConfirmAction(payload: {
    opinion: string;
    difficulty_level?: string;
    reject_to_level?: number;
  }) {
    if (!detail || !actionMode) return;
    setSubmitting(true);
    try {
      const res =
        actionMode === 'pass'
          ? await grantReviewApi.pass(detail.id, { opinion: payload.opinion })
          : await grantReviewApi.reject(detail.id, {
              opinion: payload.opinion,
              reject_to_level: payload.reject_to_level,
            });
      setDetail(res);
      setActionMode(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  function handleWithdraw() {
    if (!detail) return;
    Alert.alert(
      '撤回审核意见',
      '确定撤回您最近一次助学金审核意见吗？撤回后可重新通过或退回。教学系已审核后不可撤回。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认撤回',
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            setError(null);
            try {
              const res = await grantReviewApi.withdraw(detail.id);
              setDetail(res);
            } catch (e) {
              setError(e instanceof ApiError ? e.message : '撤回失败，请稍后重试');
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ],
    );
  }

  const canAct = detail ? canReviewGrant(role, detail.status) : false;
  const withdrawable = detail ? canWithdrawReview(role, userId, detail.reviews) : false;
  const currentLevel = detail ? actingLevel(detail.status as ApplicationStatus) : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="助学金审核详情" />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : error && !detail ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : detail ? (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {error ? <Text style={styles.inlineError}>{error}</Text> : null}

            <SectionCard
              title={`${detail.student_name} · ${detail.student_no}`}
              right={<StatusBadge status={detail.status} kind="grant" />}>
              <DetailRow label="认定年度" value={String(detail.year)} />
              <DetailRow label="助学金类型" value={grantTypeLabel(detail.grant_type)} />
              <DetailRow label="民族" value={nationLabel(detail.nation)} />
              <DetailRow label="年级" value={detail.grade_name} />
              <DetailRow label="院系专业班级" value={detail.school_unit} full />
              <DetailRow label="手机号" value={detail.phone} />
              <DetailRow label="身份证号" value={detail.id_card} />
            </SectionCard>

            <SectionCard title="家庭经济">
              <DetailRow label="户口类型" value={householdLabel(detail.household_type)} />
              <DetailRow label="家庭人口" value={`${detail.family_population} 人`} />
              <DetailRow label="月总收入" value={`¥${formatCurrency(detail.monthly_income)}`} />
              <DetailRow
                label="人均月收入"
                value={`¥${formatCurrency(detail.per_capita_monthly_income)}`}
              />
              <DetailRow label="收入来源" value={incomeSourceLabel(detail.income_source)} />
              <DetailRow label="通讯地址" value={detail.address} full />
              <DetailRow label="邮政编码" value={detail.postal_code} />
            </SectionCard>

            <SectionCard title={`家庭成员（${detail.family_members.length} 人）`}>
              {detail.family_members.length === 0 ? (
                <Text style={styles.emptyText}>暂无家庭成员信息</Text>
              ) : (
                detail.family_members.map((m, i) => (
                  <View key={m.id || i} style={styles.memberRow}>
                    <Text style={styles.memberName}>
                      {i + 1}. {m.name || '—'}
                    </Text>
                    <Text style={styles.memberMeta}>
                      {[`${m.age || '—'}岁`, relationLabel(m.relation), m.work_unit || '—']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                ))
              )}
            </SectionCard>

            <SectionCard title="申请理由">
              <Text style={styles.reason}>{detail.reason || '—'}</Text>
              {detail.reject_reason ? (
                <View style={styles.rejectBox}>
                  <Text style={styles.rejectLabel}>最近一次退回原因</Text>
                  <Text style={styles.rejectText}>{detail.reject_reason}</Text>
                </View>
              ) : null}
            </SectionCard>

            <SectionCard title="评审记录">
              <ReviewTimeline reviews={detail.reviews} />
            </SectionCard>
          </ScrollView>

          {canAct ? (
            <View style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}>
              <View style={styles.actionRow}>
                <Pressable style={styles.rejectBtn} onPress={() => setActionMode('reject')}>
                  <Text style={styles.rejectBtnText}>退回</Text>
                </Pressable>
                <Pressable style={styles.passBtn} onPress={() => setActionMode('pass')}>
                  <Text style={styles.passBtnText}>通过</Text>
                </Pressable>
              </View>
            </View>
          ) : withdrawable ? (
            <View style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}>
              <View style={styles.withdrawHint}>
                <Text style={styles.withdrawHintText}>
                  您已提交审核意见。教学系尚未审核前可撤回并重新操作。
                </Text>
              </View>
              <Pressable
                style={[styles.withdrawBtn, withdrawing && styles.btnDisabled]}
                disabled={withdrawing}
                onPress={handleWithdraw}>
                <Text style={styles.withdrawBtnText}>
                  {withdrawing ? '撤回中…' : '撤回审核意见'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <ReviewActionModal
            visible={actionMode !== null}
            mode={actionMode ?? 'pass'}
            currentLevel={currentLevel}
            requireDifficulty={false}
            submitting={submitting}
            onClose={() => setActionMode(null)}
            onConfirm={handleConfirmAction}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
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
  inlineError: {
    fontSize: 13,
    color: Brand.error,
    textAlign: 'center',
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
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
    textAlign: 'center',
    paddingVertical: 8,
  },
  memberRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.foreground,
  },
  memberMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  reason: {
    fontSize: 13,
    lineHeight: 20,
    color: Brand.foreground,
  },
  rejectBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.errorSurface,
  },
  rejectLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.error,
  },
  rejectText: {
    marginTop: 4,
    fontSize: 12,
    color: Brand.error,
  },
  actionBar: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
    backgroundColor: Brand.background,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.errorSurface,
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.error,
  },
  passBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
  },
  passBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
  withdrawHint: {
    paddingHorizontal: 4,
  },
  withdrawHintText: {
    fontSize: 12,
    lineHeight: 18,
    color: Brand.mutedForeground,
  },
  withdrawBtn: {
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  withdrawBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.foreground,
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
