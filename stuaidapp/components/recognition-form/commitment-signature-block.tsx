import { StyleSheet, Text, View } from 'react-native';

import { SignaturePad } from '@/components/recognition-form/signature-pad';
import { Brand } from '@/constants/brand';
import { COMMITMENT_HANDWRITE_TEXT } from '@/constants/signature';

type Props = {
  signatureDataUrl: string;
  onSignatureChange: (dataUrl: string) => void;
  disabled?: boolean;
};

/**
 * 印刷承诺正文 + 仅手写签字（勾选同意在外层表单完成）。
 */
export function CommitmentSignatureBlock({
  signatureDataUrl,
  onSignatureChange,
  disabled,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>个人承诺与签字</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>承诺内容：</Text>
        <View style={styles.printedBox}>
          <Text style={styles.printedText}>{COMMITMENT_HANDWRITE_TEXT}</Text>
        </View>
        <Text style={styles.hintMuted}>请仔细阅读上述承诺，在下方手写签字并勾选同意。</Text>
      </View>

      <View style={[styles.section, styles.sectionBorder]}>
        <Text style={styles.label}>学生本人（或监护人）签字</Text>
        <Text style={styles.hintMuted}>（此处手写签字）</Text>
        <SignaturePad
          value={signatureDataUrl}
          onChange={onSignatureChange}
          layout="pad"
          height={140}
          title="学生本人（或监护人）签字"
          placeholder="请手写签字"
          disabled={disabled}
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
  printedBox: {
    borderRadius: Brand.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  printedText: {
    fontSize: 14,
    lineHeight: 22,
    color: Brand.foreground,
    fontWeight: '500',
  },
  hintMuted: {
    fontSize: 11,
    lineHeight: 16,
    color: Brand.mutedForeground,
    marginBottom: 8,
  },
});
