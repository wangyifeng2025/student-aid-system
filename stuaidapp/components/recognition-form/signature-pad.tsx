import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';

import { Brand } from '@/constants/brand';

type Props = {
  value?: string;
  onChange: (dataUrl: string) => void;
  /** 列表预览区高度 */
  height?: number;
  placeholder?: string;
  disabled?: boolean;
  /** 弹层标题，如「手写承诺内容」「签字」 */
  title?: string;
  /**
   * line：横条单行书写（承诺内容）；pad：较高签名区（签字）。
   * line 模式预览更扁，导出时裁切空白，便于在窄框里一行展示。
   */
  layout?: 'line' | 'pad';
};

/** 隐藏库内置页脚按钮，由弹层底部「重写 / 确认」控制。 */
const WEB_STYLE = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; }
  body, html { margin: 0; padding: 0; width: 100%; height: 100%; }
`;

function normalizeDataUrl(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  return `data:image/png;base64,${raw}`;
}

/**
 * 列表页仅展示预览；点击后进入全屏弹层书写，确认后再回填，
 * 避免嵌在 ScrollView 里抢手势。
 */
export function SignaturePad({
  value = '',
  onChange,
  height,
  placeholder = '请在此手写',
  disabled,
  title = '手写',
  layout = 'pad',
}: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<SignatureViewRef>(null);
  const [open, setOpen] = useState(false);
  const [draftEmpty, setDraftEmpty] = useState(true);
  /** 强制重建 WebView，避免二次打开残留笔迹。 */
  const [padKey, setPadKey] = useState(0);

  const isLine = layout === 'line';
  const previewHeight = height ?? (isLine ? 72 : 150);
  const editorPadHeight = isLine ? 128 : undefined;

  useEffect(() => {
    if (!open) return;
    setDraftEmpty(!value);
    setPadKey((k) => k + 1);
  }, [open, value]);

  function openEditor() {
    if (disabled) return;
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
  }

  function handleOK(signature: string) {
    const dataUrl = normalizeDataUrl(signature);
    if (!dataUrl) return;
    onChange(dataUrl);
    setOpen(false);
  }

  function handleEmpty() {
    // 确认时画板为空：保持弹层打开，提示用户继续书写。
    setDraftEmpty(true);
  }

  function confirm() {
    if (draftEmpty) return;
    ref.current?.readSignature();
  }

  function clearDraft() {
    ref.current?.clearSignature();
    setDraftEmpty(true);
  }

  function clearSaved() {
    if (disabled) return;
    onChange('');
  }

  return (
    <View>
      <Pressable
        style={[styles.preview, { height: previewHeight }, disabled && styles.disabled]}
        disabled={disabled}
        onPress={openEditor}>
        {value ? (
          <Image
            source={{ uri: value }}
            style={styles.previewImage}
            contentFit="contain"
            contentPosition={isLine ? 'left center' : 'center'}
          />
        ) : (
          <Text style={styles.placeholder}>{placeholder}</Text>
        )}
        {!disabled ? (
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>{value ? '点击重写' : '点击手写'}</Text>
          </View>
        ) : null}
      </Pressable>

      {value && !disabled ? (
        <View style={styles.actions}>
          <Pressable style={styles.clearBtn} onPress={clearSaved}>
            <Text style={styles.clearText}>清除</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeEditor}>
        <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeEditor} hitSlop={12}>
              <Text style={styles.modalCancel}>取消</Text>
            </Pressable>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={confirm}
              hitSlop={12}
              disabled={draftEmpty}
              style={draftEmpty ? styles.confirmDisabled : undefined}>
              <Text style={[styles.modalConfirm, draftEmpty && styles.modalConfirmDisabled]}>
                确认
              </Text>
            </Pressable>
          </View>

          <Text style={styles.modalHint}>
            {isLine ? `${placeholder}（请尽量写成一行）` : placeholder}
          </Text>

          <View
            style={[
              styles.padWrap,
              isLine ? styles.padWrapLine : styles.padWrapPad,
              isLine && editorPadHeight ? { height: editorPadHeight } : null,
            ]}>
            {open ? (
              <SignatureCanvas
                key={padKey}
                ref={ref}
                onOK={handleOK}
                onEmpty={handleEmpty}
                onBegin={() => setDraftEmpty(false)}
                dataURL={value ? normalizeDataUrl(value) : undefined}
                descriptionText=""
                clearText="清除"
                confirmText="确认"
                penColor="#1d1d1f"
                backgroundColor="#fafafa"
                webStyle={WEB_STYLE}
                autoClear={false}
                imageType="image/png"
                trimWhitespace
                minWidth={0.35}
                maxWidth={1.1}
                dotSize={1.0}
                style={styles.canvas}
                androidHardwareAccelerationDisabled={false}
                webviewProps={{
                  scrollEnabled: false,
                  nestedScrollEnabled: false,
                  bounces: false,
                }}
              />
            ) : null}
          </View>

          {isLine ? (
            <Text style={styles.lineGuide}>横条区域内从左到右书写，确认后会按一行预览</Text>
          ) : (
            <View style={styles.padSpacer} />
          )}

          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.footerBtn, styles.footerGhost, draftEmpty && styles.clearDisabled]}
              disabled={draftEmpty}
              onPress={clearDraft}>
              <Text style={styles.footerGhostText}>重写</Text>
            </Pressable>
            <Pressable
              style={[styles.footerBtn, styles.footerPrimary, draftEmpty && styles.clearDisabled]}
              disabled={draftEmpty}
              onPress={confirm}>
              <Text style={styles.footerPrimaryText}>确认使用</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderRadius: Brand.radiusSm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.inputBackground,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    fontSize: 13,
    color: Brand.mutedForeground,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  previewBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(29,29,31,0.72)',
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  disabled: {
    opacity: 0.6,
  },
  actions: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },
  clearDisabled: {
    opacity: 0.4,
  },
  modal: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  modalCancel: {
    fontSize: 16,
    color: Brand.mutedForeground,
    minWidth: 48,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: Brand.foreground,
    paddingHorizontal: 8,
  },
  modalConfirm: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.primary,
    minWidth: 48,
    textAlign: 'right',
  },
  modalConfirmDisabled: {
    color: Brand.mutedForeground,
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  modalHint: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    fontSize: 12,
    lineHeight: 18,
    color: Brand.mutedForeground,
  },
  padWrap: {
    marginHorizontal: 12,
    borderRadius: Brand.radius,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: '#fafafa',
  },
  padWrapLine: {
    marginTop: 24,
  },
  padWrapPad: {
    flex: 1,
    marginBottom: 12,
  },
  padSpacer: {
    height: 0,
  },
  lineGuide: {
    marginTop: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
    fontSize: 12,
    color: Brand.mutedForeground,
    textAlign: 'center',
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginTop: 'auto',
  },
  footerBtn: {
    flex: 1,
    height: 44,
    borderRadius: Brand.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  footerGhostText: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.foreground,
  },
  footerPrimary: {
    backgroundColor: Brand.primary,
  },
  footerPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
