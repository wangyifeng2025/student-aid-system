import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrantFamilyMemberCard } from '@/components/grant/grant-family-member-card';
import { GrantFamilyMemberView } from '@/components/grant/grant-family-member-view';
import { FormHeader } from '@/components/recognition-form/form-header';
import { PickerField } from '@/components/recognition-form/picker-field';
import { SectionCard } from '@/components/recognition-form/section-card';
import { TextField } from '@/components/recognition-form/text-field';
import { DetailRow } from '@/components/reviews/detail-row';
import { ReviewTimeline } from '@/components/reviews/review-timeline';
import { StatusBadge } from '@/components/reviews/status-badge';
import { Brand } from '@/constants/brand';
import { canDeleteGrant, canEditGrant, grantTypeLabel } from '@/constants/grant-options';
import {
  HOUSEHOLD_OPTIONS,
  INCOME_SOURCE_OPTIONS,
  householdLabel,
  incomeSourceLabel,
  nationLabel,
} from '@/constants/recognition-options';
import { ApiError, grantApi } from '@/lib/api';
import { isPhone } from '@/lib/validators';
import {
  emptyGrantMember,
  grantInputFromGrant,
  type Grant,
  type GrantFamilyMemberInput,
  type GrantInput,
} from '@/types/grant';

function genderLabel(g: string): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return g || '—';
}

export default function GrantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const numericId = Number(id);

  const [detail, setDetail] = useState<Grant | null>(null);
  const [form, setForm] = useState<GrantInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await grantApi.get(numericId);
      setDetail(res);
      setForm(grantInputFromGrant(res));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [numericId]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = detail ? canEditGrant(detail.status) : false;
  const deletable = detail ? canDeleteGrant(detail.status, detail.reviews) : false;

  function handleDelete() {
    Alert.alert(
      '删除申请',
      '确定删除该助学金申请吗？草稿、被退回，或已提交但班级尚未审核的申请可删除，删除后不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await grantApi.remove(numericId);
              Alert.alert('已删除', '申请已删除。', [
                { text: '好的', onPress: () => router.back() },
              ]);
            } catch (e) {
              Alert.alert('删除失败', e instanceof ApiError ? e.message : '请稍后重试');
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  function patch(p: Partial<GrantInput>) {
    setForm((prev) => (prev ? { ...prev, ...p } : prev));
  }

  function updateMember(index: number, p: Partial<GrantFamilyMemberInput>) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            family_members: prev.family_members.map((m, i) => (i === index ? { ...m, ...p } : m)),
          }
        : prev,
    );
  }

  function addMember() {
    setForm((prev) =>
      prev ? { ...prev, family_members: [...prev.family_members, emptyGrantMember()] } : prev,
    );
  }

  function removeMember(index: number) {
    setForm((prev) =>
      prev ? { ...prev, family_members: prev.family_members.filter((_, i) => i !== index) } : prev,
    );
  }

  function checkForSubmit(f: GrantInput): string | null {
    if (!f.phone || !isPhone(f.phone)) return '请填写正确的联系电话';
    if (f.family_population <= 0) return '请填写家庭总人数';
    if (!f.address.trim()) return '请填写家庭住址';
    if (f.reason.trim().length < 10) return '申请理由不少于 10 个字（建议 150 字左右）';
    if (f.family_members.length === 0) return '请至少填写一名家庭成员';
    return null;
  }

  async function handleSaveDraft() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await grantApi.update(numericId, form);
      setDetail(res);
      setForm(grantInputFromGrant(res));
      Alert.alert('已保存草稿', '可随时返回继续填写。');
    } catch (e) {
      Alert.alert('保存失败', e instanceof ApiError ? e.message : '请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!form) return;
    const err = checkForSubmit(form);
    if (err) {
      Alert.alert('无法提交', err);
      return;
    }
    setSubmitting(true);
    try {
      await grantApi.update(numericId, form);
      const res = await grantApi.submit(numericId);
      setDetail(res);
      setForm(grantInputFromGrant(res));
      Alert.alert('提交成功', '申请已提交，进入班级评审。', [
        { text: '好的', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('提交失败', e instanceof ApiError ? e.message : '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="助学金申请" />

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
      ) : detail && form ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <SectionCard
              title={`${grantTypeLabel(detail.grant_type)} · ${detail.year} 年度`}
              right={<StatusBadge status={detail.status} kind="grant" />}>
              <DetailRow label="姓名" value={detail.student_name} />
              <DetailRow label="学号" value={detail.student_no} />
              <DetailRow label="性别" value={genderLabel(detail.gender)} />
              <DetailRow label="出生年月" value={detail.birth} />
              <DetailRow label="民族" value={nationLabel(detail.nation)} />
              <DetailRow label="政治面貌" value={detail.political_status} />
              <DetailRow label="入学时间" value={detail.enroll_time} />
              <DetailRow label="所在年级" value={detail.grade_name} />
              <DetailRow label="身份证号" value={detail.id_card} />
              <DetailRow label="院系专业班级" value={detail.school_unit} full />
            </SectionCard>

            <SectionCard title="联系与家庭经济情况">
              {editable ? (
                <>
                  <TextField
                    label="联系电话"
                    required
                    value={form.phone}
                    onChangeText={(v) => patch({ phone: v })}
                    keyboardType="phone-pad"
                    placeholder="本人手机号"
                  />
                  <PickerField
                    label="家庭户口"
                    value={form.household_type}
                    options={HOUSEHOLD_OPTIONS}
                    onChange={(v) => patch({ household_type: v })}
                  />
                  <View style={styles.row}>
                    <TextField
                      style={styles.flex1}
                      label="家庭总人数"
                      required
                      value={form.family_population ? String(form.family_population) : ''}
                      onChangeText={(v) =>
                        patch({ family_population: Number(v.replace(/\D/g, '')) || 0 })
                      }
                      keyboardType="number-pad"
                    />
                    <TextField
                      style={styles.flex1}
                      label="邮政编码"
                      value={form.postal_code}
                      onChangeText={(v) => patch({ postal_code: v })}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.row}>
                    <TextField
                      style={styles.flex1}
                      label="家庭月总收入"
                      value={form.monthly_income ? String(form.monthly_income) : ''}
                      onChangeText={(v) =>
                        patch({ monthly_income: Number(v.replace(/[^\d.]/g, '')) || 0 })
                      }
                      keyboardType="numeric"
                      suffix="元"
                    />
                    <TextField
                      style={styles.flex1}
                      label="人均月收入"
                      value={form.per_capita_monthly_income ? String(form.per_capita_monthly_income) : ''}
                      onChangeText={(v) =>
                        patch({ per_capita_monthly_income: Number(v.replace(/[^\d.]/g, '')) || 0 })
                      }
                      keyboardType="numeric"
                      suffix="元"
                    />
                  </View>
                  <PickerField
                    label="收入来源"
                    value={form.income_source}
                    options={INCOME_SOURCE_OPTIONS}
                    onChange={(v) => patch({ income_source: v })}
                  />
                  <TextField
                    label="家庭住址"
                    required
                    value={form.address}
                    onChangeText={(v) => patch({ address: v })}
                    multiline
                    numberOfLines={2}
                    placeholder="省 / 市 / 区县 / 街道门牌"
                  />
                </>
              ) : (
                <>
                  <DetailRow label="联系电话" value={form.phone} />
                  <DetailRow label="家庭户口" value={householdLabel(form.household_type)} />
                  <DetailRow label="家庭总人数" value={`${form.family_population} 人`} />
                  <DetailRow label="家庭月总收入" value={`¥${form.monthly_income}`} />
                  <DetailRow label="人均月收入" value={`¥${form.per_capita_monthly_income}`} />
                  <DetailRow label="收入来源" value={incomeSourceLabel(form.income_source)} />
                  <DetailRow label="邮政编码" value={form.postal_code} />
                  <DetailRow label="家庭住址" value={form.address} full />
                </>
              )}
            </SectionCard>

            <SectionCard title={`家庭成员（${form.family_members.length} 人）`}>
              {editable ? (
                <>
                  {form.family_members.length === 0 && (
                    <Text style={styles.emptyText}>暂无家庭成员，点击下方「添加成员」录入。</Text>
                  )}
                  {form.family_members.map((m, i) => (
                    <GrantFamilyMemberCard
                      key={i}
                      index={i}
                      member={m}
                      onChange={(p) => updateMember(i, p)}
                      onRemove={() => removeMember(i)}
                    />
                  ))}
                  <Pressable style={styles.addBtn} onPress={addMember}>
                    <Ionicons name="add" size={18} color={Brand.primary} />
                    <Text style={styles.addBtnText}>添加成员</Text>
                  </Pressable>
                </>
              ) : form.family_members.length === 0 ? (
                <Text style={styles.emptyText}>暂无家庭成员信息</Text>
              ) : (
                detail.family_members.map((m, i) => <GrantFamilyMemberView key={m.id} index={i} member={m} />)
              )}
            </SectionCard>

            <SectionCard title="申请理由" subtitle="建议 150 字左右，说明家庭经济困难情况">
              {editable ? (
                <>
                  <TextField
                    label=""
                    value={form.reason}
                    onChangeText={(v) => patch({ reason: v })}
                    multiline
                    numberOfLines={5}
                    placeholder="请简要说明家庭经济困难情况及申请助学金的理由…"
                  />
                  <Text style={styles.charCount}>{form.reason.length} 字</Text>
                </>
              ) : (
                <Text style={styles.reasonText}>{form.reason || '暂无'}</Text>
              )}
            </SectionCard>

            {detail.reject_reason ? (
              <SectionCard title="最近一次退回原因">
                <Text style={styles.rejectText}>{detail.reject_reason}</Text>
              </SectionCard>
            ) : null}

            <SectionCard title="评审记录">
              <ReviewTimeline
                reviews={detail.reviews.map((r) => ({ ...r, difficulty_level: '' }))}
              />
            </SectionCard>
          </ScrollView>

          {(editable || deletable) && (
            <View style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}>
              {deletable && (
                <Pressable
                  style={[styles.deleteBtn, deleting && styles.btnDisabled]}
                  disabled={deleting || saving || submitting}
                  onPress={handleDelete}>
                  <Text style={styles.deleteBtnText}>{deleting ? '删除中…' : '删除'}</Text>
                </Pressable>
              )}
              {editable && (
                <>
                  <Pressable
                    style={[styles.draftBtn, saving && styles.btnDisabled]}
                    disabled={saving || deleting}
                    onPress={handleSaveDraft}>
                    <Ionicons name="save-outline" size={16} color={Brand.primary} />
                    <Text style={styles.draftBtnText}>{saving ? '保存中…' : '保存草稿'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                    disabled={submitting || deleting}
                    onPress={handleSubmit}>
                    <Text style={styles.primaryBtnText}>{submitting ? '提交中…' : '提交申请'}</Text>
                    <Ionicons name="send" size={14} color={Brand.primaryForeground} />
                  </Pressable>
                </>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  flex: {
    flex: 1,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
    textAlign: 'center',
    paddingVertical: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Brand.radiusSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Brand.border,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primary,
  },
  charCount: {
    marginTop: -8,
    fontSize: 11,
    color: Brand.mutedForeground,
    textAlign: 'right',
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 20,
    color: Brand.foreground,
  },
  rejectText: {
    fontSize: 12,
    lineHeight: 18,
    color: Brand.error,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
    backgroundColor: Brand.background,
  },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  draftBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primary,
  },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Brand.errorSurface,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.error,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: Brand.primary,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
});
