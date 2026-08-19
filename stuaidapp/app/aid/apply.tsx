import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChipMultiSelect } from '@/components/recognition-form/chip-multi-select';
import { CheckboxRow } from '@/components/recognition-form/checkbox-row';
import { CommitmentSignatureBlock } from '@/components/recognition-form/commitment-signature-block';
import { FamilyMemberCard } from '@/components/recognition-form/family-member-card';
import { FormHeader } from '@/components/recognition-form/form-header';
import { PickerField } from '@/components/recognition-form/picker-field';
import { SectionCard } from '@/components/recognition-form/section-card';
import { StepIndicator } from '@/components/recognition-form/step-indicator';
import { StudentIdentity } from '@/components/recognition-form/student-identity';
import { TextField } from '@/components/recognition-form/text-field';
import { Brand } from '@/constants/brand';
import {
  HOUSEHOLD_OPTIONS,
  INCOME_SOURCE_OPTIONS,
  NATION_OPTIONS,
  SPECIAL_GROUP_OPTIONS,
} from '@/constants/recognition-options';
import { canEditRecognition } from '@/constants/review-options';
import { ApiError, recognitionApi, regionCodeApi, studentApi } from '@/lib/api';
import { joinRegionDetail, splitRegionDetail } from '@/lib/id-card-region';
import { loadSignatureDataUrls, syncSignatureAttachments } from '@/lib/signature-upload';
import { formatCurrency, isIdCard, isPhone } from '@/lib/validators';
import { useAuthStore } from '@/store/auth';
import {
  emptyFamilyMember,
  emptyRecognitionForm,
  type FamilyMemberInput,
  type RecognitionFormState,
} from '@/types/recognition';

const STEPS = ['基本信息', '家庭情况', '经济影响', '提交确认'];

export default function RecognitionApplyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const [form, setForm] = useState<RecognitionFormState>(emptyRecognitionForm());
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(editingId);
  const [profileLoading, setProfileLoading] = useState(role === 'student');
  const [recordLoading, setRecordLoading] = useState(!!editingId);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [signatureDirty, setSignatureDirty] = useState(false);
  const [regionLabel, setRegionLabel] = useState('');
  const [regionLooking, setRegionLooking] = useState(false);
  const [regionLookupFailed, setRegionLookupFailed] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    student_no: '',
    dept_name: '',
    class_name: '',
  });

  // 续填已有的草稿 / 被退回申请：从后端加载完整记录。
  const loadExisting = useCallback(async () => {
    if (!editingId) return;
    setRecordLoading(true);
    try {
      const detail = await recognitionApi.get(editingId);
      if (!canEditRecognition(detail.status)) {
        Alert.alert('无法编辑', '当前申请状态不可修改（仅草稿或被退回的申请可编辑）。', [
          { text: '好的', onPress: () => router.back() },
        ]);
        return;
      }
      setForm({
        year: detail.year,
        nation: detail.nation,
        native_place: detail.native_place,
        id_card: detail.id_card,
        family_population: detail.family_population,
        phone: detail.phone,
        address: detail.address,
        postal_code: detail.postal_code,
        guardian_phone: detail.guardian_phone,
        household_type: detail.household_type,
        income_source: detail.income_source,
        special_types: detail.special_types,
        natural_disaster: detail.natural_disaster,
        sudden_accident: detail.sudden_accident,
        weak_labor: detail.weak_labor,
        unemployment: detail.unemployment,
        debt: detail.debt,
        other_info: detail.other_info,
        commitment_agreed: detail.commitment_agreed,
        family_members: detail.family_members.map(
          ({ name, age, relation, work_unit, occupation, annual_income, health }) => ({
            name,
            age,
            relation,
            work_unit,
            occupation,
            annual_income,
            health,
          }),
        ),
      });
      setProfile({
        name: detail.student_name,
        student_no: detail.student_no,
        dept_name: detail.dept_name || '',
        class_name: detail.class_name || '',
      });
      try {
        const imgs = await loadSignatureDataUrls(editingId);
        setSignatureDataUrl(imgs.signature);
        setSignatureDirty(false);
      } catch {
        // 签字附件缺失时不阻断。
      }
    } catch (e) {
      Alert.alert('加载失败', e instanceof ApiError ? e.message : '请稍后重试', [
        { text: '好的', onPress: () => router.back() },
      ]);
    } finally {
      setRecordLoading(false);
    }
  }, [editingId, router]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  // 姓名 / 教学系 / 班级 / 身份证号从学籍档案读取（与 Web 端认定表单一致）。
  useEffect(() => {
    if (role !== 'student') return;
    let cancelled = false;
    (async () => {
      try {
        const stu = await studentApi.me();
        if (cancelled) return;
        setProfile({
          name: stu.name,
          student_no: stu.student_no,
          dept_name: stu.dept_name || '',
          class_name: stu.class_name || '',
        });
        setForm((prev) => ({
          ...prev,
          id_card: stu.id_card || prev.id_card,
          nation: prev.nation || stu.nation || prev.nation,
          phone: prev.phone || stu.phone || prev.phone,
        }));
      } catch (e) {
        if (!cancelled && e instanceof ApiError) {
          // 学籍信息缺失时不阻断填报，允许手动补充。
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    const id = form.id_card.trim().toUpperCase();
    if (!isIdCard(id)) {
      setRegionLabel('');
      setRegionLooking(false);
      setRegionLookupFailed(false);
      return;
    }
    let cancelled = false;
    setRegionLooking(true);
    (async () => {
      try {
        const look = await regionCodeApi.lookup(id);
        if (cancelled) return;
        const region = (look.full_name || '').trim();
        setRegionLabel(region);
        setRegionLookupFailed(!region);
        setForm((prev) => {
          const detail = splitRegionDetail(prev.address, prev.native_place || region);
          return {
            ...prev,
            native_place: region,
            address: joinRegionDetail(region, detail),
          };
        });
      } catch {
        if (!cancelled) {
          setRegionLabel('');
          setRegionLookupFailed(true);
        }
      } finally {
        if (!cancelled) setRegionLooking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.id_card]);

  const addressDetail = splitRegionDetail(form.address, regionLabel || form.native_place);

  const set = <K extends keyof RecognitionFormState>(key: K, value: RecognitionFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const expectedMembers = Math.max(0, form.family_population - 1);
  const memberCountOk = form.family_members.length === expectedMembers;

  const perCapita = useMemo(() => {
    if (form.family_population <= 0) return 0;
    const total = form.family_members.reduce((sum, m) => sum + (m.annual_income || 0), 0);
    return Math.round((total / form.family_population) * 100) / 100;
  }, [form.family_members, form.family_population]);

  const warnings = useMemo(() => {
    const out: string[] = [];
    let parents = 0;
    let parentsWithIncome = 0;
    for (const m of form.family_members) {
      if (m.relation === 'father' || m.relation === 'mother') {
        parents++;
        if (m.annual_income > 0) parentsWithIncome++;
      }
    }
    if (parents === 1) out.push('检测到单亲家庭（父母仅一方在家庭成员中），请确认是否属实。');
    else if (parents >= 2 && parentsWithIncome <= 1)
      out.push('检测到单薪家庭（父母中仅一方有收入），请确认是否属实。');
    return out;
  }, [form.family_members]);

  function updateMember(index: number, patch: Partial<FamilyMemberInput>) {
    setForm((prev) => ({
      ...prev,
      family_members: prev.family_members.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  }

  function addMember() {
    setForm((prev) => ({ ...prev, family_members: [...prev.family_members, emptyFamilyMember()] }));
  }

  function removeMember(index: number) {
    setForm((prev) => ({
      ...prev,
      family_members: prev.family_members.filter((_, i) => i !== index),
    }));
  }

  function toggleSpecialType(value: string) {
    setForm((prev) => {
      const has = prev.special_types.includes(value);
      return {
        ...prev,
        special_types: has
          ? prev.special_types.filter((v) => v !== value)
          : [...prev.special_types, value],
      };
    });
  }

  /** 保存草稿时的格式校验（允许部分字段为空，但已填内容须合法）。 */
  function checkFormat(): string | null {
    if (!form.year || form.year < 2000) return '请填写有效的认定年度';
    if (form.id_card && !isIdCard(form.id_card)) return '身份证号格式不正确（需 18 位有效号码）';
    if (form.phone && !isPhone(form.phone)) return '手机号格式不正确';
    if (form.guardian_phone && !isPhone(form.guardian_phone)) return '家长手机号格式不正确';
    return null;
  }

  /** 第 0 步「基本信息」全部必填，未填完不可进入下一步。 */
  function checkStep0(): string | null {
    if (!form.year || form.year < 2000) return '请填写有效的认定年度';
    if (!form.nation.trim()) return '请选择民族';
    if (!form.id_card || !isIdCard(form.id_card)) return '请填写有效的 18 位身份证号';
    if (regionLooking) return '正在根据身份证解析省市区县，请稍候';
    if (regionLabel) {
      if (!form.native_place.trim()) return '请填写籍贯';
    } else if (!form.native_place.trim()) {
      return '请填写籍贯（未能根据身份证解析行政区划，请手动填写）';
    }
    if (!form.phone || !isPhone(form.phone)) return '请填写有效的手机号';
    if (!form.guardian_phone.trim()) return '请填写家长手机号';
    if (!isPhone(form.guardian_phone)) return '家长手机号格式不正确';
    if (form.family_population < 1) return '请填写家庭人口（至少为 1）';
    if (form.household_type !== 'urban' && form.household_type !== 'rural')
      return '请选择户口类型（城镇/农村）';
    if (!form.income_source.trim()) return '请选择主要收入来源';
    if (!form.postal_code.trim()) return '请填写邮政编码';
    if (!/^\d{6}$/.test(form.postal_code.trim())) return '邮政编码须为 6 位数字';
    if (regionLabel) {
      if (!addressDetail.trim()) return '请填写街道、门牌等详细通讯地址';
    } else if (!form.address.trim()) {
      return '请填写详细通讯地址';
    }
    return null;
  }

  /** 第 1 步「家庭成员」人数与姓名必填。 */
  function checkStep1(): string | null {
    if (form.family_members.length !== expectedMembers)
      return `家庭成员人数应为 ${expectedMembers} 人（家庭人口 ${form.family_population} 减去本人），当前 ${form.family_members.length} 人`;
    for (const m of form.family_members) {
      if (!m.name.trim()) return '请填写每位家庭成员的姓名';
      if (!m.relation.trim()) return '请选择每位家庭成员与学生的关系';
    }
    return null;
  }

  function checkForSubmit(): string | null {
    const step0Err = checkStep0();
    if (step0Err) return step0Err;
    const step1Err = checkStep1();
    if (step1Err) return step1Err;
    const hasDisabled = form.family_members.some((m) => m.health === 'disabled');
    if (hasDisabled && !form.other_info.trim())
      return '家庭成员存在残疾，请在「其他情况说明」中补充说明';
    if (form.special_types.length === 0 && !form.other_info.trim())
      return '未勾选特殊群体类型时，请在「其他情况说明」中说明家庭经济困难原因';
    if (!form.commitment_agreed) return '请先勾选个人承诺';
    if (!signatureDataUrl) return '请完成学生本人（或监护人）签字';
    return null;
  }

  function goStep(next: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  /** 步骤指示器仅允许回退到已完成步骤，禁止跳过未校验步骤。 */
  function handleSelectStep(next: number) {
    if (next <= step) goStep(next);
  }

  function handleNext() {
    if (step === 0) {
      const err = checkStep0();
      if (err) {
        Alert.alert('请完善基本信息', err);
        return;
      }
    } else if (step === 1) {
      const err = checkStep1();
      if (err) {
        Alert.alert('请完善家庭成员信息', err);
        return;
      }
    }
    goStep(step + 1);
  }

  async function handleSaveDraft() {
    const err = checkFormat();
    if (err) {
      Alert.alert('请检查信息', err);
      return;
    }
    setSavingDraft(true);
    try {
      let currentId = savedId;
      if (currentId) {
        const res = await recognitionApi.update(currentId, form);
        setForm((prev) => ({ ...prev, id_card: res.id_card }));
      } else {
        const res = await recognitionApi.create(form);
        currentId = res.id;
        setSavedId(res.id);
        setForm((prev) => ({ ...prev, id_card: res.id_card }));
      }
      if (signatureDirty && currentId) {
        await syncSignatureAttachments(currentId, signatureDataUrl);
        setSignatureDirty(false);
      }
      Alert.alert('已保存草稿', '可随时返回继续填写。');
    } catch (e) {
      Alert.alert('保存失败', e instanceof ApiError ? e.message : '请稍后重试');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit() {
    const err = checkForSubmit();
    if (err) {
      Alert.alert('无法提交', err);
      return;
    }
    setSubmitting(true);
    try {
      let currentId = savedId;
      if (currentId) {
        await recognitionApi.update(currentId, form);
      } else {
        const created = await recognitionApi.create(form);
        currentId = created.id;
        setSavedId(created.id);
      }
      await syncSignatureAttachments(currentId, signatureDataUrl);
      setSignatureDirty(false);
      const result = await recognitionApi.submit(currentId);
      const message = ['申请已提交，进入班级评审。', ...(result.warnings ?? [])].join('\n');
      Alert.alert('提交成功', message, [{ text: '好的', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('提交失败', e instanceof ApiError ? e.message : '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (recordLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <FormHeader title="困难认定申请" />
        <View style={styles.recordLoadingBox}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FormHeader title="困难认定申请" />
      <StudentIdentity
        name={profile.name}
        studentNo={profile.student_no}
        deptName={profile.dept_name}
        className={profile.class_name}
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.stepperWrap}>
          <StepIndicator steps={STEPS} current={step} onSelect={handleSelectStep} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <SectionCard title="基本信息">
              <TextField
                label="姓名"
                value={profile.name}
                onChangeText={() => undefined}
                editable={false}
                placeholder={profileLoading ? '正在从学籍档案读取…' : '学籍姓名'}
              />
              <TextField
                label="教学系"
                value={profile.dept_name}
                onChangeText={() => undefined}
                editable={false}
                placeholder={profileLoading ? '正在从学籍档案读取…' : '学籍教学系'}
              />
              <TextField
                label="班级"
                value={profile.class_name}
                onChangeText={() => undefined}
                editable={false}
                placeholder={profileLoading ? '正在从学籍档案读取…' : '学籍班级'}
              />
              <TextField
                label="认定年度"
                required
                value={form.year ? String(form.year) : ''}
                onChangeText={(v) => set('year', Number(v.replace(/\D/g, '')) || 0)}
                keyboardType="number-pad"
                placeholder="如：2026"
              />
              <PickerField
                label="民族"
                required
                value={form.nation}
                options={NATION_OPTIONS}
                onChange={(v) => set('nation', v)}
              />
              <TextField
                label="籍贯"
                required
                value={form.native_place}
                onChangeText={(v) => set('native_place', v)}
                editable={!regionLabel && !regionLooking}
                placeholder={
                  regionLooking
                    ? '正在根据身份证解析…'
                    : regionLookupFailed
                      ? '未能解析，请手动填写省市区县'
                      : '由身份证自动解析省市区县'
                }
                hint={
                  regionLabel
                    ? '籍贯省市区县由身份证自动解析，不可修改。'
                    : regionLookupFailed
                      ? '未匹配到行政区划，请手动填写。'
                      : '填写或加载身份证后将自动解析省市区县。'
                }
              />
              <TextField
                label="身份证号"
                required
                value={form.id_card}
                onChangeText={(v) => set('id_card', v)}
                editable={!form.id_card}
                placeholder={profileLoading ? '正在从学籍档案读取…' : '18 位居民身份证号'}
                hint={
                  form.id_card
                    ? '已从学籍档案自动读取，不可修改；如有误请联系辅导员在学生管理中更正。'
                    : '未能读取到学籍档案身份证号，请手动填写。'
                }
              />
              <TextField
                label="手机号"
                required
                value={form.phone}
                onChangeText={(v) => set('phone', v)}
                placeholder="本人手机号"
                keyboardType="phone-pad"
              />
              <TextField
                label="家长手机号"
                required
                value={form.guardian_phone}
                onChangeText={(v) => set('guardian_phone', v)}
                placeholder="家长 / 监护人手机号"
                keyboardType="phone-pad"
              />
              <View style={styles.row}>
                <TextField
                  style={styles.flex1}
                  label="家庭人口"
                  required
                  value={form.family_population ? String(form.family_population) : ''}
                  onChangeText={(v) => set('family_population', Number(v.replace(/\D/g, '')) || 0)}
                  keyboardType="number-pad"
                  placeholder="含本人"
                />
                <TextField
                  style={styles.flex1}
                  label="邮政编码"
                  required
                  value={form.postal_code}
                  onChangeText={(v) => set('postal_code', v)}
                  keyboardType="number-pad"
                  placeholder="如：550001"
                />
              </View>
              <View style={styles.row}>
                <PickerField
                  style={styles.flex1}
                  label="户口类型"
                  required
                  value={form.household_type}
                  options={HOUSEHOLD_OPTIONS}
                  onChange={(v) => set('household_type', v)}
                />
                <PickerField
                  style={styles.flex1}
                  label="主要收入来源"
                  required
                  value={form.income_source}
                  options={INCOME_SOURCE_OPTIONS}
                  onChange={(v) => set('income_source', v)}
                />
              </View>
              <View style={styles.addressField}>
                <Text style={styles.addressLabel}>
                  详细通讯地址<Text style={styles.addressRequired}> *</Text>
                </Text>
                {regionLabel ? (
                  <View style={styles.addressSplit}>
                    <View style={[styles.addressControl, styles.addressControlReadonly]}>
                      <Text style={styles.addressPrefixText}>{regionLabel}</Text>
                    </View>
                    <View style={[styles.addressControl, styles.addressControlMultiline]}>
                      <TextInput
                        style={[styles.addressInput, styles.addressInputMultiline]}
                        value={addressDetail}
                        onChangeText={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            address: joinRegionDetail(regionLabel, v),
                          }))
                        }
                        placeholder="街道、门牌、村组等"
                        placeholderTextColor={Brand.mutedForeground}
                        multiline
                        numberOfLines={2}
                        textAlignVertical="top"
                      />
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.addressControl,
                      styles.addressControlMultiline,
                      regionLooking && styles.addressControlReadonly,
                    ]}>
                    <TextInput
                      style={[styles.addressInput, styles.addressInputMultiline]}
                      value={form.address}
                      onChangeText={(v) => set('address', v)}
                      editable={!regionLooking}
                      placeholder={
                        regionLooking
                          ? '正在根据身份证解析省市区县…'
                          : '省 / 市 / 区县 / 街道门牌'
                      }
                      placeholderTextColor={Brand.mutedForeground}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>
                )}
                <Text style={styles.addressHint}>
                  {regionLabel
                    ? '省市区县由身份证自动解析，请补充街道、门牌等详细信息。'
                    : regionLookupFailed
                      ? '未能解析省市区县，请完整填写通讯地址。'
                      : '省市区县将根据身份证自动填入。'}
                </Text>
              </View>
            </SectionCard>
          )}

          {step === 1 && (
            <>
              <SectionCard
                title="家庭成员信息"
                subtitle="请填写家庭成员信息（不含本人，均为必填）"
                right={
                  memberCountOk ? (
                    <View style={styles.okBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={Brand.success} />
                      <Text style={styles.okBadgeText}>人数一致</Text>
                    </View>
                  ) : (
                    <View style={styles.warnBadge}>
                      <Ionicons name="alert-circle" size={12} color={Brand.warning} />
                      <Text style={styles.warnBadgeText}>人数不一致</Text>
                    </View>
                  )
                }>
                <View style={styles.hintBar}>
                  <Ionicons name="people-outline" size={14} color={Brand.primary} />
                  <Text style={styles.hintBarText}>
                    家庭人口 {form.family_population} 人，应填 {expectedMembers} 人，已填{' '}
                    {form.family_members.length} 人
                  </Text>
                </View>

                {form.family_members.length === 0 && (
                  <Text style={styles.emptyText}>暂无家庭成员，点击下方「添加成员」录入（不含本人）。</Text>
                )}

                {form.family_members.map((m, i) => (
                  <FamilyMemberCard
                    key={i}
                    index={i}
                    member={m}
                    onChange={(patch) => updateMember(i, patch)}
                    onRemove={() => removeMember(i)}
                  />
                ))}

                <Pressable style={styles.addBtn} onPress={addMember}>
                  <Ionicons name="add" size={18} color={Brand.primary} />
                  <Text style={styles.addBtnText}>添加成员</Text>
                </Pressable>
              </SectionCard>

              <SectionCard
                title="特殊群体勾选"
                right={<Text style={styles.selectedCount}>已选 {form.special_types.length} 项</Text>}>
                <ChipMultiSelect
                  options={SPECIAL_GROUP_OPTIONS}
                  selected={form.special_types}
                  onToggle={toggleSpecialType}
                />
                <TextField
                  style={styles.otherInfoField}
                  label="其他情况说明"
                  value={form.other_info}
                  onChangeText={(v) => set('other_info', v)}
                  placeholder="如未勾选特殊群体，或家庭成员有残疾/重病等，请在此说明家庭经济困难原因"
                  multiline
                  numberOfLines={3}
                />
              </SectionCard>
            </>
          )}

          {step === 2 && (
            <SectionCard title="影响家庭经济状况">
              <View style={styles.perCapitaBar}>
                <Text style={styles.perCapitaLabel}>家庭人均年收入（自动计算）</Text>
                <Text style={styles.perCapitaValue}>¥{formatCurrency(perCapita)}</Text>
                <Text style={styles.perCapitaHint}>
                  = 家庭成员年收入合计 ÷ 家庭人口（{form.family_population}）
                </Text>
              </View>

              {warnings.length > 0 && (
                <View style={styles.warningBox}>
                  {warnings.map((w) => (
                    <View key={w} style={styles.warningRow}>
                      <Ionicons name="alert-circle" size={13} color={Brand.warning} style={styles.warningIcon} />
                      <Text style={styles.warningText}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TextField
                label="自然灾害影响"
                value={form.natural_disaster}
                onChangeText={(v) => set('natural_disaster', v)}
                multiline
                numberOfLines={2}
                placeholder="无则可留空或填「无」"
              />
              <TextField
                label="突发意外事件"
                value={form.sudden_accident}
                onChangeText={(v) => set('sudden_accident', v)}
                multiline
                numberOfLines={2}
                placeholder="无则可留空或填「无」"
              />
              <TextField
                label="家庭劳动力情况"
                value={form.weak_labor}
                onChangeText={(v) => set('weak_labor', v)}
                multiline
                numberOfLines={2}
                placeholder="无则可留空或填「无」"
              />
              <TextField
                label="失业 / 待业情况"
                value={form.unemployment}
                onChangeText={(v) => set('unemployment', v)}
                multiline
                numberOfLines={2}
                placeholder="无则可留空或填「无」"
              />
              <TextField
                label="家庭负债情况"
                value={form.debt}
                onChangeText={(v) => set('debt', v)}
                multiline
                numberOfLines={2}
                placeholder="无则可留空或填「无」"
              />
            </SectionCard>
          )}

          {step === 3 && (
            <>
              <SectionCard title="提交确认">
                <View style={styles.summaryList}>
                  <SummaryItem label="认定年度" value={String(form.year || '—')} />
                  <SummaryItem
                    label="家庭人口 / 已填成员"
                    value={`${form.family_population} 人 / ${form.family_members.length} 人`}
                  />
                  <SummaryItem label="人均年收入" value={`¥${formatCurrency(perCapita)}`} />
                  <SummaryItem
                    label="特殊群体"
                    value={form.special_types.length ? `${form.special_types.length} 项` : '未勾选'}
                  />
                </View>
              </SectionCard>

              <CommitmentSignatureBlock
                signatureDataUrl={signatureDataUrl}
                onSignatureChange={(v) => {
                  setSignatureDataUrl(v);
                  setSignatureDirty(true);
                }}
                disabled={submitting || savingDraft}
              />

              <SectionCard title="确认同意">
                <CheckboxRow
                  checked={form.commitment_agreed}
                  onToggle={() => set('commitment_agreed', !form.commitment_agreed)}>
                  <Text style={styles.commitmentText}>
                    我已阅读并同意上述个人承诺内容。
                  </Text>
                </CheckboxRow>
              </SectionCard>
            </>
          )}
        </ScrollView>

        <View style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}>
          <Pressable
            style={[styles.draftBtn, savingDraft && styles.btnDisabled]}
            disabled={savingDraft}
            onPress={handleSaveDraft}>
            <Ionicons name="save-outline" size={16} color={Brand.primary} />
            <Text style={styles.draftBtnText}>{savingDraft ? '保存中…' : '保存草稿'}</Text>
          </Pressable>
          <View style={styles.actionRight}>
            <Pressable
              style={[styles.ghostBtn, step === 0 && styles.btnDisabled]}
              disabled={step === 0}
              onPress={() => goStep(step - 1)}>
              <Ionicons
                name="chevron-back"
                size={16}
                color={step === 0 ? Brand.mutedForeground : Brand.foreground}
              />
              <Text style={[styles.ghostBtnText, step === 0 && styles.btnDisabledText]}>上一步</Text>
            </Pressable>
            {step < STEPS.length - 1 ? (
              <Pressable style={styles.primaryBtn} onPress={handleNext}>
                <Text style={styles.primaryBtnText}>下一步</Text>
                <Ionicons name="chevron-forward" size={16} color={Brand.primaryForeground} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                disabled={submitting}
                onPress={handleSubmit}>
                <Text style={styles.primaryBtnText}>{submitting ? '提交中…' : '提交评审'}</Text>
                <Ionicons name="send" size={14} color={Brand.primaryForeground} />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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
  recordLoadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  addressField: {
    marginBottom: 16,
  },
  addressLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '500',
    color: Brand.foreground,
  },
  addressRequired: {
    color: Brand.error,
  },
  addressSplit: {
    gap: 8,
  },
  addressControl: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  addressControlReadonly: {
    opacity: 0.72,
  },
  addressControlMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  addressPrefixText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.foreground,
  },
  addressInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.foreground,
    padding: 0,
  },
  addressInputMultiline: {
    minHeight: 64,
    width: '100%',
  },
  addressHint: {
    marginTop: 6,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  okBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 999,
    backgroundColor: Brand.successSurface,
  },
  okBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.success,
  },
  warnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 999,
    backgroundColor: Brand.warningSurface,
  },
  warnBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.warning,
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.brand50,
    marginBottom: 14,
  },
  hintBarText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.primary,
  },
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
    textAlign: 'center',
    paddingVertical: 20,
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
  selectedCount: {
    fontSize: 12,
    color: Brand.info,
  },
  otherInfoField: {
    marginTop: 14,
    marginBottom: 0,
  },
  perCapitaBar: {
    padding: 14,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    marginBottom: 16,
  },
  perCapitaLabel: {
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  perCapitaValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '700',
    color: Brand.primary,
  },
  perCapitaHint: {
    marginTop: 4,
    fontSize: 11,
    color: Brand.mutedForeground,
  },
  warningBox: {
    padding: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.warningSurface,
    marginBottom: 16,
    gap: 6,
  },
  warningRow: {
    flexDirection: 'row',
    gap: 6,
  },
  warningIcon: {
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Brand.warning,
  },
  summaryList: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
  },
  summaryLabel: {
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.foreground,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.border,
    marginVertical: 16,
  },
  commitmentText: {
    fontSize: 13,
    lineHeight: 19,
    color: Brand.foreground,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.foreground,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnDisabledText: {
    color: Brand.mutedForeground,
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
