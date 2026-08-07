import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { DIFFICULTY_OPTIONS, rejectTargetOptions } from '@/constants/review-options';

export type ReviewActionMode = 'pass' | 'reject';

type ConfirmPayload = {
  opinion: string;
  difficulty_level?: string;
  reject_to_level?: number;
};

type Props = {
  visible: boolean;
  mode: ReviewActionMode;
  currentLevel: number;
  /** 默认：班级级通过时强制选困难等级；助学金审核传 false。 */
  requireDifficulty?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: ConfirmPayload) => void;
};

export function ReviewActionModal({
  visible,
  mode,
  currentLevel,
  requireDifficulty: requireDifficultyProp,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const [opinion, setOpinion] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string>('0');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const requireDifficulty =
    requireDifficultyProp ?? (mode === 'pass' && currentLevel === 1);
  const showDifficulty = mode === 'pass' && requireDifficultyProp !== false;
  const targetOptions = rejectTargetOptions(currentLevel);

  useEffect(() => {
    if (visible) {
      setOpinion('');
      setDifficulty('');
      setRejectTarget(targetOptions[0]?.value ?? '0');
      setKeyboardHeight(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

  // Modal 内 KeyboardAvoidingView 在 iOS 上不稳定，直接监听键盘高度上移底部弹层。
  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  function handleConfirm() {
    if (mode === 'reject' && !opinion.trim()) return;
    if (requireDifficulty && !difficulty) return;
    Keyboard.dismiss();
    onConfirm({
      opinion: opinion.trim(),
      difficulty_level: mode === 'pass' ? difficulty || undefined : undefined,
      reject_to_level: mode === 'reject' ? Number(rejectTarget) : undefined,
    });
  }

  const confirmDisabled =
    submitting || (mode === 'reject' && !opinion.trim()) || (requireDifficulty && !difficulty);

  const sheetBottomPad = keyboardHeight > 0 ? 12 : 16 + insets.bottom;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: sheetBottomPad,
              marginBottom: keyboardHeight,
            },
          ]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}>
            <Text style={styles.title}>{mode === 'pass' ? '通过评审' : '退回评审'}</Text>

            {mode === 'pass' && showDifficulty && (
              <View style={styles.field}>
                <Text style={styles.label}>
                  困难等级
                  {requireDifficulty ? <Text style={styles.required}> *</Text> : '（可调整）'}
                </Text>
                <View style={styles.chipRow}>
                  {DIFFICULTY_OPTIONS.map((o) => {
                    const active = difficulty === o.value;
                    return (
                      <Pressable
                        key={o.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setDifficulty(o.value)}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {mode === 'reject' && targetOptions.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>退回至</Text>
                <View style={styles.chipRow}>
                  {targetOptions.map((o) => {
                    const active = rejectTarget === o.value;
                    return (
                      <Pressable
                        key={o.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setRejectTarget(o.value)}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>
                评审意见{mode === 'reject' ? <Text style={styles.required}> *</Text> : ''}
              </Text>
              <TextInput
                style={styles.textarea}
                value={opinion}
                onChangeText={setOpinion}
                placeholder={mode === 'reject' ? '请填写退回原因' : '可填写审核意见（选填）'}
                placeholderTextColor={Brand.mutedForeground}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  onClose();
                }}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  mode === 'reject' && styles.confirmBtnReject,
                  confirmDisabled && styles.confirmBtnDisabled,
                ]}
                disabled={confirmDisabled}
                onPress={handleConfirm}>
                {submitting ? (
                  <ActivityIndicator color={Brand.primaryForeground} />
                ) : (
                  <Text style={styles.confirmText}>
                    {mode === 'pass' ? '确认通过' : '确认退回'}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  sheet: {
    backgroundColor: Brand.card,
    borderTopLeftRadius: Brand.radius,
    borderTopRightRadius: Brand.radius,
    maxHeight: '85%',
  },
  sheetContent: {
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.foreground,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.foreground,
  },
  required: {
    color: Brand.error,
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
  textarea: {
    minHeight: 76,
    padding: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    fontSize: 14,
    color: Brand.foreground,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.inputBackground,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.foreground,
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
  },
  confirmBtnReject: {
    backgroundColor: Brand.error,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
});
