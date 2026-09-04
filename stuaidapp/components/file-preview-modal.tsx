import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image as RNImage,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { ApiError, attachmentApi } from '@/lib/api';
import { ensureFileUri } from '@/lib/local-file';

type Props = {
  attachment: { id: number; file_name: string; mime: string } | null;
  onClose: () => void;
};

function isPdf(mime: string, name: string): boolean {
  return mime === 'application/pdf' || /\.pdf$/i.test(name);
}

function isImage(mime: string, name: string): boolean {
  return mime.startsWith('image/') || /\.(png|jpe?g|heic|heif|webp)$/i.test(name);
}

async function openLocalFile(localUri: string, pdf: boolean, image: boolean) {
  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(ensureFileUri(localUri));
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: pdf ? 'application/pdf' : image ? 'image/*' : '*/*',
    });
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('当前环境不支持系统预览');
  }
  await Sharing.shareAsync(localUri, {
    mimeType: pdf ? 'application/pdf' : image ? 'image/jpeg' : 'application/octet-stream',
    dialogTitle: '打开证明材料',
    UTI: pdf ? 'com.adobe.pdf' : image ? 'public.image' : undefined,
  });
}

/**
 * 证明材料预览：
 * - 图片：expo-image（Expo Go / 自定义包都可用）
 * - PDF：iOS Expo Go 用系统 Quick Look（WebView + file:// 会黑屏）；
 *        Android 用系统阅读器。不要用 react-native-pdf（Expo Go 装不了原生模块）。
 */
export function FilePreviewModal({ attachment, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const mediaSize = useMemo(() => {
    const win = Dimensions.get('window');
    return {
      width: win.width,
      height: Math.max(200, win.height - insets.top - insets.bottom - 48),
    };
  }, [insets.bottom, insets.top]);

  useEffect(() => {
    if (!attachment) {
      setLocalUri(null);
      setError(null);
      setImageFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setImageFailed(false);
    setLocalUri(null);
    void attachmentApi
      .downloadToCache(attachment.id, attachment.file_name)
      .then((uri) => {
        if (!cancelled) setLocalUri(uri);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : '下载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment]);

  const pdf = attachment ? isPdf(attachment.mime, attachment.file_name) : false;
  const image = attachment ? isImage(attachment.mime, attachment.file_name) : false;

  async function openWithSystem() {
    if (!localUri) return;
    try {
      await openLocalFile(localUri, pdf, image);
    } catch (e) {
      Alert.alert('无法打开', e instanceof Error ? e.message : '请安装阅读器后重试');
    }
  }

  return (
    <Modal
      visible={attachment !== null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <Text style={styles.title} numberOfLines={1}>
            {attachment?.file_name ?? '预览'}
          </Text>
          {localUri ? (
            <Pressable hitSlop={8} onPress={() => void openWithSystem()} style={styles.barBtn}>
              <Ionicons name="open-outline" size={20} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable hitSlop={8} onPress={onClose} style={styles.barBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !localUri ? null : image && !imageFailed ? (
            <Image
              source={{ uri: localUri }}
              style={mediaSize}
              contentFit="contain"
              onError={() => setImageFailed(true)}
            />
          ) : image && imageFailed ? (
            <RNImage
              source={{ uri: localUri }}
              style={mediaSize}
              resizeMode="contain"
              onError={() => setError('图片无法显示，请点右上角用其他应用打开')}
            />
          ) : (
            <View style={styles.pdfFallback}>
              <Ionicons name="document-text-outline" size={48} color="#fff" />
              <Text style={styles.pdfHint}>
                {pdf
                  ? Platform.OS === 'ios'
                    ? 'Expo Go 无法在应用内渲染 PDF，请用系统预览（Quick Look）'
                    : '请用系统阅读器打开 PDF'
                  : '该文件类型请用其他应用打开'}
              </Text>
              <Pressable style={styles.openBtn} onPress={() => void openWithSystem()}>
                <Text style={styles.openBtnText}>打开预览</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  barBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#fecaca',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  pdfFallback: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  pdfHint: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  openBtn: {
    marginTop: 8,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
