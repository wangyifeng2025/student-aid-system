import { StyleSheet, Text, View } from 'react-native';

import { SignaturePad } from '@/components/recognition-form/signature-pad';
import { Brand } from '@/constants/brand';
import { COMMITMENT_HANDWRITE_TEXT } from '@/constants/signature';

type Props = {
  commitmentDataUrl: string;
  signatureDataUrl: string;
  onCommitmentChange: (dataUrl: string) => void;
  onSignatureChange: (dataUrl: string) => void;
  disabled?: boolean;
  /** 手写期间临时禁用外层 ScrollView 滚动，避免书写时页面跟着滑动。 */
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
};

/**
 * 对照纸质「个人承诺」表格：上栏手写承诺正文，下栏学生本人（或监护人）签字。
 * 手机竖屏上下堆叠，避免并排挤压。
 */
export function CommitmentSignatureBlock({
  commitmentDataUrl,
  signatureDataUrl,
  onCommitmentChange,
  onSignatureChange,
  disabled,
  onDrawStart,
  onDrawEnd,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>个人承诺（须手写）</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>承诺内容：</Text>
        <Text style={styles.hintRed}>（此处手写：「{COMMITMENT_HANDWRITE_TEXT}」）</Text>
        <SignaturePad
          value={commitmentDataUrl}
          onChange={onCommitmentChange}
          height={140}
          placeholder="请在此手写完整承诺内容"
          disabled={disabled}
          onDrawStart={onDrawStart}
          onDrawEnd={onDrawEnd}
        />
      </View>

      <View style={[styles.section, styles.sectionBorder]}>
        <Text style={styles.label}>学生本人（或监护人）签字</Text>
        <Text style={styles.hintMuted}>（此处手写签字）</Text>
        <SignaturePad
          value={signatureDataUrl}
          onChange={onSignatureChange}
          height={120}
          placeholder="请在此签字"
          disabled={disabled}
          onDrawStart={onDrawStart}
          onDrawEnd={onDrawEnd}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Brand.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Brand.inputBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.foreground,
  },
  section: {
    padding: 14,
  },
  sectionBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.foreground,
    marginBottom: 6,
  },
  hintRed: {
    fontSize: 11,
    lineHeight: 16,
    color: Brand.error,
    marginBottom: 8,
  },
  hintMuted: {
    fontSize: 11,
    lineHeight: 16,
    color: Brand.mutedForeground,
    marginBottom: 8,
  },
});
