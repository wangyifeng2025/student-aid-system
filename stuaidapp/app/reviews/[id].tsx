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
import { StudentIdentity } from '@/components/recognition-form/student-identity';
import { DetailRow } from '@/components/reviews/detail-row';
import { FamilyMemberView } from '@/components/reviews/family-member-view';
import { ReviewActionModal, type ReviewActionMode } from '@/components/reviews/review-action-modal';
import { ReviewTimeline } from '@/components/reviews/review-timeline';
import { SignaturePreview } from '@/components/reviews/signature-preview';
import { StatusBadge } from '@/components/reviews/status-badge';
import { Brand } from '@/constants/brand';
import {
  householdLabel,
  incomeSourceLabel,
  nationLabel,
  specialGroupLabel,
} from '@/constants/recognition-options';
import { actingLevel, canReview, canWithdrawReview } from '@/constants/review-options';
import { ApiError, reviewApi } from '@/lib/api';
import { formatCurrency } from '@/lib/validators';
import { useAuthStore } from '@/store/auth';
import type { RecognitionDetail } from '@/types/recognition';

export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);

  const [detail, setDetail] = useState<RecognitionDetail | null>(null);
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
      const res = await reviewApi.get(numericId);
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
          ? await reviewApi.pass(detail.id, {
              opinion: payload.opinion,
              difficulty_level: payload.difficulty_level,
            })
          : await reviewApi.reject(detail.id, {
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
      '确定撤回您最近一次审核意见吗？撤回后申请将回到待班级评审状态，可重新通过或退回。教学系已审核后不可撤回。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认撤回',
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            setError(null);
            try {
              const res = await reviewApi.withdraw(detail.id);
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

  const canAct = detail ? canReview(role, detail.status) : false;
  const withdrawable = detail ? canWithdrawReview(role, userId, detail.reviews) : false;
  const currentLevel = detail ? actingLevel(detail.status) : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="认定审核详情" />
      {detail ? (
        <StudentIdentity
          name={detail.student_name}
          studentNo={detail.student_no}
          deptName={detail.dept_name}
          className={detail.class_name}
          extra={
            <>
              <Text style={styles.identityYear}>{detail.year} 年度</Text>
              <StatusBadge status={detail.status} />
            </>
          }
        />
      ) : null}

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
            <SectionCard title="基本信息">
              <DetailRow label="姓名" value={detail.student_name} />
              <DetailRow label="学号" value={detail.student_no} />
              <DetailRow label="教学系" value={detail.dept_name} />
              <DetailRow label="班级" value={detail.class_name} />
              <DetailRow label="认定年度" value={String(detail.year)} />
              <DetailRow label="民族" value={nationLabel(detail.nation)} />
              <DetailRow label="籍贯" value={detail.native_place} />
              <DetailRow label="身份证号" value={detail.id_card} />
              <DetailRow label="手机号" value={detail.phone} />
              <DetailRow label="家长手机号" value={detail.guardian_phone} />
              <DetailRow label="家庭人口" value={`${detail.family_population} 人`} />
              <DetailRow label="户口类型" value={householdLabel(detail.household_type)} />
              <DetailRow label="主要收入来源" value={incomeSourceLabel(detail.income_source)} />
              <DetailRow label="详细通讯地址" value={detail.address} full />
            </SectionCard>

            <SectionCard title="家庭经济状况">
              <View style={styles.perCapitaBar}>
                <Text style={styles.perCapitaLabel}>家庭人均年收入</Text>
                <Text style={styles.perCapitaValue}>
                  ¥{formatCurrency(detail.per_capita_annual_income)}
                </Text>
              </View>
              <DetailRow label="自然灾害影响" value={detail.natural_disaster || '无'} full />
              <DetailRow label="突发意外事件" value={detail.sudden_accident || '无'} full />
              <DetailRow label="家庭劳动力情况" value={detail.weak_labor || '无'} full />
              <DetailRow label="失业 / 待业情况" value={detail.unemployment || '无'} full />
              <DetailRow label="家庭负债情况" value={detail.debt || '无'} full />
            </SectionCard>

            <SectionCard title={`家庭成员（${detail.family_members.length} 人）`}>
              {detail.family_members.length === 0 ? (
                <Text style={styles.emptyText}>暂无家庭成员信息</Text>
              ) : (
                detail.family_members.map((m, i) => (
                  <FamilyMemberView key={m.id} index={i} member={m} />
                ))
              )}
            </SectionCard>

            <SectionCard title="特殊群体 / 说明">
              <View style={styles.chipRow}>
                {detail.special_types.length === 0 ? (
                  <Text style={styles.emptyText}>未勾选特殊群体</Text>
                ) : (
                  detail.special_types.map((t) => (
                    <View key={t} style={styles.chip}>
                      <Text style={styles.chipText}>{specialGroupLabel(t)}</Text>
                    </View>
                  ))
                )}
              </View>
              {detail.other_info ? (
                <Text style={styles.otherInfo}>{detail.other_info}</Text>
              ) : null}
              {detail.reject_reason ? (
                <View style={styles.rejectBox}>
                  <Text style={styles.rejectLabel}>最近一次退回原因</Text>
                  <Text style={styles.rejectText}>{detail.reject_reason}</Text>
                </View>
              ) : null}
            </SectionCard>

            <SectionCard title="个人承诺与签字">
              <SignaturePreview recognitionId={numericId} />
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
  identityYear: {
    fontSize: 13,
    color: Brand.mutedForeground,
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
  perCapitaBar: {
    padding: 14,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    marginBottom: 8,
  },
  perCapitaLabel: {
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  perCapitaValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '700',
    color: Brand.primary,
  },
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
    textAlign: 'center',
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.brand50,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.primary,
  },
  otherInfo: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
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
