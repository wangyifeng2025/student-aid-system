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
 * 只读展示已提交的手写承诺 / 签字图片（学生查看进度、教师审核详情页复用）。
 * 附件缺失（如仍是草稿）时静默显示「暂无」，不视为错误。
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

  if (!commitment && !signature) {
    return <Text style={styles.emptyText}>暂无手写签字信息（可能仍为草稿，尚未提交）。</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Text style={styles.label}>承诺内容（手写）</Text>
        <Text style={styles.hint}>「{COMMITMENT_HANDWRITE_TEXT}」</Text>
        {commitment ? (
          <Image source={{ uri: commitment }} style={styles.image} contentFit="contain" />
        ) : (
          <Text style={styles.emptyText}>未提供</Text>
        )}
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
