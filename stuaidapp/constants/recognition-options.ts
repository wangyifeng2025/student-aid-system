// 困难认定填报选项，与 frontend/src/lib/recognition-options.ts 保持一致。

export interface Option {
  value: string;
  label: string;
}

export const NATION_OPTIONS: Option[] = [
  { value: 'han', label: '汉族' },
  { value: 'zhuang', label: '壮族' },
  { value: 'hui', label: '回族' },
  { value: 'man', label: '满族' },
  { value: 'uygur', label: '维吾尔族' },
  { value: 'miao', label: '苗族' },
  { value: 'yi', label: '彝族' },
  { value: 'tujia', label: '土家族' },
  { value: 'zang', label: '藏族' },
  { value: 'mongol', label: '蒙古族' },
  { value: 'buyi', label: '布依族' },
  { value: 'dong', label: '侗族' },
  { value: 'other', label: '其他' },
];

export const RELATION_OPTIONS: Option[] = [
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'elder_brother', label: '哥哥' },
  { value: 'younger_brother', label: '弟弟' },
  { value: 'elder_sister', label: '姐姐' },
  { value: 'younger_sister', label: '妹妹' },
  { value: 'grandfather', label: '祖父' },
  { value: 'grandmother', label: '祖母' },
  { value: 'other', label: '其他' },
];

export const OCCUPATION_OPTIONS: Option[] = [
  { value: 'worker', label: '务工' },
  { value: 'farmer', label: '务农' },
  { value: 'none', label: '无' },
  { value: 'student', label: '读书' },
  { value: 'other', label: '其他' },
];

export const HEALTH_OPTIONS: Option[] = [
  { value: 'good', label: '良好' },
  { value: 'poor', label: '较差' },
  { value: 'disabled', label: '残疾' },
];

export const INCOME_SOURCE_OPTIONS: Option[] = [
  { value: 'wage', label: '工资性收入' },
  { value: 'farming', label: '务农收入' },
  { value: 'business', label: '经营性收入' },
  { value: 'subsidy', label: '补助/低保' },
  { value: 'other', label: '其他' },
];

export const HOUSEHOLD_OPTIONS: Option[] = [
  { value: 'urban', label: '城镇' },
  { value: 'rural', label: '农村' },
];

export const SPECIAL_GROUP_OPTIONS: Option[] = [
  { value: 'poverty', label: '脱贫家庭学生' },
  { value: 'poverty_unstable', label: '脱贫不稳定家庭学生' },
  { value: 'marginal', label: '边缘易致贫家庭学生' },
  { value: 'sudden_difficulty', label: '突发严重困难家庭学生' },
  { value: 'low_income', label: '低保家庭学生' },
  { value: 'low_income_margin', label: '低保边缘家庭学生' },
  { value: 'extreme_poverty', label: '特困救助供养学生' },
  { value: 'rigid_expenditure', label: '刚性支出困难家庭学生' },
  { value: 'other_low_income', label: '其他低收入学生' },
  { value: 'orphan', label: '孤儿' },
  { value: 'no_guardian', label: '事实无人抚养儿童' },
  { value: 'disabled_student', label: '残疾学生' },
  { value: 'disabled_parent', label: '残疾人子女' },
  { value: 'martyr_child', label: '烈士子女' },
  { value: 'poverty_relocation', label: '是否异地扶贫搬迁' },
];

function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const nationLabel = (v: string) => (v ? labelOf(NATION_OPTIONS, v) : '—');
export const relationLabel = (v: string) => (v ? labelOf(RELATION_OPTIONS, v) : '—');
export const occupationLabel = (v: string) => (v ? labelOf(OCCUPATION_OPTIONS, v) : '—');
export const healthLabel = (v: string) => (v ? labelOf(HEALTH_OPTIONS, v) : '—');
export const incomeSourceLabel = (v: string) => (v ? labelOf(INCOME_SOURCE_OPTIONS, v) : '—');
export const householdLabel = (v: string) => (v ? labelOf(HOUSEHOLD_OPTIONS, v) : '—');
export const specialGroupLabel = (v: string) => (v ? labelOf(SPECIAL_GROUP_OPTIONS, v) : v);

export function specialTypesText(types?: string[]): string {
  if (!types?.length) return '';
  return types.map(specialGroupLabel).join('、');
}

/** 勾选后提交须上传低收入证明材料的特殊群体类型。 */
export const LOW_INCOME_PROOF_TYPES = [
  'low_income',
  'low_income_margin',
  'other_low_income',
  'extreme_poverty',
] as const;

export function needsLowIncomeProof(types?: string[]): boolean {
  if (!types?.length) return false;
  return types.some((t) => (LOW_INCOME_PROOF_TYPES as readonly string[]).includes(t));
}
