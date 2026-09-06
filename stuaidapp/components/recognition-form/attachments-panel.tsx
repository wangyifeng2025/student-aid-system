import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FilePreviewModal } from '@/components/file-preview-modal';
import { Brand } from '@/constants/brand';
import { isSignatureAttachment } from '@/constants/signature';
import { ApiError, attachmentApi, recognitionApi, type Attachment } from '@/lib/api';
import { prepareImageUpload, preparePdfUpload } from '@/lib/local-file';

const MAX_PROOF_FILES = 8;

type Props = {
  recognitionId: number | null;
  editable: boolean;
  required?: boolean;
  onCountChange?: (count: number) => void;
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string, name: string): boolean {
  return mime.startsWith('image/') || /\.(png|jpe?g)$/i.test(name);
}

function isPdf(mime: string, name: string): boolean {
  return mime === 'application/pdf' || /\.pdf$/i.test(name);
}

export function AttachmentsPanel({ recognitionId, editable, required, onCountChange }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(!!recognitionId);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const load = useCallback(async () => {
    if (!recognitionId) return;
    setLoading(true);
    try {
      const res = await recognitionApi.listAttachments(recognitionId);
      const proofs = res.filter((a) => !isSignatureAttachment(a.file_name));
      setItems(proofs);
      onCountChangeRef.current?.(proofs.length);
    } catch (e) {
      Alert.alert('加载附件失败', e instanceof ApiError ? e.message : '请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [recognitionId]);

  useEffect(() => {
    if (!recognitionId) {
      onCountChangeRef.current?.(0);
      return;
    }
    // 等当前渲染结束再拉列表，避免在 effect 里同步 setState。
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load, recognitionId]);

  async function uploadLocal(uri: string, fileName: string, mime: string) {
    if (!recognitionId) return;
    if (items.length >= MAX_PROOF_FILES) {
      Alert.alert('无法上传', `最多上传 ${MAX_PROOF_FILES} 份证明材料`);
      return;
    }
    const asPdf = isPdf(mime, fileName);
    const asImage =
      !asPdf &&
      (isImage(mime, fileName) ||
        mime.startsWith('image/') ||
        /\.(heic|heif|png|jpe?g)$/i.test(fileName));
    if (!asPdf && !asImage) {
      Alert.alert('无法上传', '仅支持 JPG、PNG 图片或 PDF');
      return;
    }
    setUploading(true);
    try {
      const prepared = asPdf
        ? await preparePdfUpload(uri, fileName)
        : await prepareImageUpload(uri);
      await recognitionApi.uploadAttachment(
        recognitionId,
        prepared.uri,
        prepared.name,
        prepared.mime,
      );
      await load();
    } catch (e) {
      Alert.alert('上传失败', e instanceof ApiError ? e.message : '请稍后重试');
    } finally {
      setUploading(false);
    }
  }

  async function pickCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相机权限', '请在系统设置中允许访问相机，以便拍摄证明材料。');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const name = asset.fileName || `proof_${Date.now()}.jpg`;
    await uploadLocal(asset.uri, name, asset.mimeType || 'image/jpeg');
  }

  async function pickAlbum() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相册权限', '请在系统设置中允许访问相册，以便选择证明材料照片。');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const name = asset.fileName || `proof_${Date.now()}.jpg`;
    await uploadLocal(asset.uri, name, asset.mimeType || 'image/jpeg');
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    await uploadLocal(asset.uri, asset.name, asset.mimeType || '');
  }

  function handlePick() {
    if (!recognitionId) return;
    Alert.alert('上传证明材料', '请选择来源', [
      { text: '拍照', onPress: () => void pickCamera() },
      { text: '相册', onPress: () => void pickAlbum() },
      { text: '文件（PDF / 图片）', onPress: () => void pickDocument() },
      { text: '取消', style: 'cancel' },
    ]);
  }

  function handleDelete(item: Attachment) {
    Alert.alert('删除附件', `确定删除「${item.file_name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await attachmentApi.remove(item.id);
              await load();
            } catch (e) {
              Alert.alert('删除失败', e instanceof ApiError ? e.message : '请稍后重试');
            }
          })();
        },
      },
    ]);
  }

  async function handleOpen(item: Attachment) {
    try {
      await attachmentApi.download(item.id, item.file_name);
    } catch (e) {
      Alert.alert('打开失败', e instanceof ApiError ? e.message : '请稍后重试');
    }
  }

  if (!recognitionId) {
    return (
      <Text style={styles.hint}>请先「保存草稿」，保存后即可上传低收入家庭证明材料。</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {editable ? (
        <View style={styles.uploadBlock}>
          <Pressable
            style={[styles.uploadBtn, uploading && styles.btnDisabled]}
            disabled={uploading}
            onPress={handlePick}>
            {uploading ? (
              <ActivityIndicator color={Brand.primary} size="small" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={16} color={Brand.primary} />
            )}
            <Text style={styles.uploadBtnText}>{uploading ? '上传中…' : '上传附件'}</Text>
          </Pressable>
          <Text style={styles.hint}>
            {required
              ? '低收入家庭须上传至少一份证明（低保证、特困证等），仅支持 JPG / PNG / PDF。'
              : '可上传低保证、特困证等支撑材料，仅支持 JPG / PNG / PDF。'}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Brand.primary} size="small" />
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>
          {required
            ? '尚未上传证明材料，勾选低收入相关类型后提交前须至少上传一份。'
            : '暂无证明材料。'}
        </Text>
      ) : (
        items.map((a) => (
          <View key={a.id} style={styles.row}>
            <Ionicons
              name={isImage(a.mime, a.file_name) ? 'image-outline' : 'document-text-outline'}
              size={18}
              color={isImage(a.mime, a.file_name) ? Brand.warning : Brand.primary}
            />
            <Pressable style={styles.rowBody} onPress={() => setPreview(a)}>
              <Text style={styles.fileName} numberOfLines={1}>
                {a.file_name}
              </Text>
              <Text style={styles.size}>{humanSize(a.size)}</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setPreview(a)}>
              <Ionicons name="eye-outline" size={18} color={Brand.primary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => void handleOpen(a)}>
              <Ionicons name="download-outline" size={18} color={Brand.primary} />
            </Pressable>
            {editable ? (
              <Pressable hitSlop={8} onPress={() => handleDelete(a)}>
                <Ionicons name="trash-outline" size={18} color={Brand.error} />
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <FilePreviewModal attachment={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  uploadBlock: {
    gap: 8,
  },
  uploadBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: Brand.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.background,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: Brand.mutedForeground,
  },
  loadingBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  empty: {
    fontSize: 13,
    color: Brand.mutedForeground,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    color: Brand.foreground,
  },
  size: {
    marginTop: 2,
    fontSize: 11,
    color: Brand.mutedForeground,
  },
});
