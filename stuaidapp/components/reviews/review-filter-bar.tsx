import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { orgApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Role } from '@/types/auth';
import type { Department, OrgClass } from '@/types/org';

export type ReviewFilterValue = {
  keyword: string;
  deptId: number;
  classId: number;
  status: string;
};

type StatusOption = { value: string; label: string };

type Props = {
  value: ReviewFilterValue;
  statusOptions: StatusOption[];
  onApply: (next: ReviewFilterValue) => void;
};

function canFilterDept(role: Role | undefined) {
  return role === 'aidcenter' || role === 'admin';
}

function canFilterClass(role: Role | undefined) {
  return role === 'department' || role === 'aidcenter' || role === 'admin';
}

export function ReviewFilterBar({ value, statusOptions, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role);
  const userDeptId = useAuthStore((s) => s.user?.dept_id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [depts, setDepts] = useState<Department[]>([]);
  const [classes, setClasses] = useState<OrgClass[]>([]);

  const showDept = canFilterDept(role);
  const showClass = canFilterClass(role);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open || !showDept) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await orgApi.listDepartments();
        if (!cancelled) setDepts(items);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showDept]);

  const classDeptId = showDept ? draft.deptId : userDeptId || 0;

  useEffect(() => {
    if (!open || !showClass) return;
    if (showDept && !classDeptId) {
      setClasses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const items = await orgApi.listClasses(classDeptId || undefined);
        if (!cancelled) setClasses(items);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showClass, showDept, classDeptId]);

  const activeCount = [
    value.keyword,
    value.deptId,
    value.classId,
    value.status,
  ].filter(Boolean).length;

  return (
    <>
      <View style={styles.bar}>
        <TextInput
          style={styles.search}
          value={value.keyword}
          placeholder="搜索姓名 / 学号"
          placeholderTextColor={Brand.mutedForeground}
          returnKeyType="search"
          onChangeText={(keyword) => onApply({ ...value, keyword })}
          onSubmitEditing={() => onApply({ ...value, keyword: value.keyword.trim() })}
        />
        <Pressable style={styles.filterBtn} onPress={() => setOpen(true)}>
          <Text style={styles.filterBtnText}>筛选{activeCount > 0 ? ` · ${activeCount}` : ''}</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
            <Text style={styles.sheetTitle}>筛选条件</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {showDept && (
                <View style={styles.field}>
                  <Text style={styles.label}>院系</Text>
                  <View style={styles.chipRow}>
                    <Chip
                      label="全部院系"
                      active={!draft.deptId}
                      onPress={() => setDraft((d) => ({ ...d, deptId: 0, classId: 0 }))}
                    />
                    {depts.map((d) => (
                      <Chip
                        key={d.id}
                        label={d.name}
                        active={draft.deptId === d.id}
                        onPress={() => setDraft((prev) => ({ ...prev, deptId: d.id, classId: 0 }))}
                      />
                    ))}
                  </View>
                </View>
              )}

              {showClass && (
                <View style={styles.field}>
                  <Text style={styles.label}>班级</Text>
                  <View style={styles.chipRow}>
                    <Chip
                      label="全部班级"
                      active={!draft.classId}
                      onPress={() => setDraft((d) => ({ ...d, classId: 0 }))}
                    />
                    {classes.map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        active={draft.classId === c.id}
                        onPress={() => setDraft((prev) => ({ ...prev, classId: c.id }))}
                      />
                    ))}
                    {showDept && !draft.deptId ? (
                      <Text style={styles.hint}>请先选择院系</Text>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>状态</Text>
                <View style={styles.chipRow}>
                  <Chip
                    label="全部状态"
                    active={!draft.status}
                    onPress={() => setDraft((d) => ({ ...d, status: '' }))}
                  />
                  {statusOptions.map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      active={draft.status === o.value}
                      onPress={() => setDraft((prev) => ({ ...prev, status: o.value }))}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                style={styles.resetBtn}
                onPress={() =>
                  setDraft({ keyword: draft.keyword, deptId: 0, classId: 0, status: '' })
                }>
                <Text style={styles.resetText}>重置</Text>
              </Pressable>
              <Pressable
                style={styles.applyBtn}
                onPress={() => {
                  onApply({ ...draft, keyword: draft.keyword.trim() });
                  setOpen(false);
                }}>
                <Text style={styles.applyText}>应用</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  search: {
    flex: 1,
    height: 40,
    borderRadius: Brand.radiusSm,
    paddingHorizontal: 12,
    backgroundColor: Brand.inputBackground,
    fontSize: 14,
    color: Brand.foreground,
  },
  filterBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: Brand.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.brand50,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: Brand.card,
    borderTopLeftRadius: Brand.radius,
    borderTopRightRadius: Brand.radius,
    padding: 20,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.foreground,
  },
  field: {
    marginBottom: 14,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.foreground,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  chipActive: {
    backgroundColor: Brand.brand50,
    borderColor: Brand.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.mutedForeground,
  },
  chipTextActive: {
    color: Brand.primary,
  },
  hint: {
    fontSize: 12,
    color: Brand.mutedForeground,
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  resetBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.inputBackground,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.foreground,
  },
  applyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
  },
  applyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
});
