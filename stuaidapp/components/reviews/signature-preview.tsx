import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { COMMITMENT_HANDWRITE_TEXT } from '@/constants/signature';
import { loadSignatureDataUrls } from '@/lib/signature-upload';

type Props = {
  recognitionId: number;
};

/**
 * 只读展示印刷承诺 + 手写签字（历史手写承诺图若存在则一并展示）。
 */
export function SignaturePreview({ recognitionId }: Props) {
  const [commitment, setCommitment] = useState('');
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadSignatureDataUrls(recognitionId);
        if (!cancelled) {
          setCommitment(res.commitment);
          setSignature(res.signature);
        }
      } catch {
        // 签字附件缺失（如草稿阶段）时静默忽略。
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recognitionId]);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={Brand.primary} size="small" />
      </View>
    );
  }

  if (!signature && !commitment) {
    return <Text style={styles.emptyText}>暂无签字信息（可能仍为草稿，尚未提交）。</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Text style={styles.label}>承诺内容</Text>
        <View style={styles.printedBox}>
          <Text style={styles.printedText}>{COMMITMENT_HANDWRITE_TEXT}</Text>
        </View>
        {commitment ? (
          <>
            <Text style={styles.hint}>历史手写承诺（旧版申请）：</Text>
            <Image source={{ uri: commitment }} style={styles.image} contentFit="contain" />
          </>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>学生本人（或监护人）签字</Text>
        {signature ? (
          <Image source={{ uri: signature }} style={styles.image} contentFit="contain" />
        ) : (
          <Text style={styles.emptyText}>未提供</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  block: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.foreground,
  },
  printedBox: {
    borderRadius: Brand.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  printedText: {
    fontSize: 14,
    lineHeight: 22,
    color: Brand.foreground,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    color: Brand.mutedForeground,
  },
  image: {
    width: '100%',
    height: 130,
    borderRadius: Brand.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.inputBackground,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Brand.mutedForeground,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
