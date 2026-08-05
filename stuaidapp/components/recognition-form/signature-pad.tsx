import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';

import { Brand } from '@/constants/brand';

type Props = {
  value?: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
  /** 开始/结束手写时回调，供外层在书写期间临时禁用 ScrollView 滚动。 */
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
};

/** 隐藏库内置「清除 / 保存」按钮，由外层「重写」控制。 */
const WEB_STYLE = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; }
  body, html { margin: 0; padding: 0; }
`;

function normalizeDataUrl(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  return `data:image/png;base64,${raw}`;
}

export function SignaturePad({
  value = '',
  onChange,
  height = 150,
  placeholder = '请在此手写',
  disabled,
  onDrawStart,
  onDrawEnd,
}: Props) {
  const ref = useRef<SignatureViewRef>(null);
  const [empty, setEmpty] = useState(!value);
  const seedRef = useRef(value);

  useEffect(() => {
    if (value !== seedRef.current) {
      seedRef.current = value;
      setEmpty(!value);
      if (value) {
        ref.current?.setDataURL(normalizeDataUrl(value));
      } else {
        ref.current?.clearSignature();
      }
    }
  }, [value]);

  function handleOK(signature: string) {
    const dataUrl = normalizeDataUrl(signature);
    seedRef.current = dataUrl;
    setEmpty(!dataUrl);
    onChange(dataUrl);
  }

  function handleEmpty() {
    seedRef.current = '';
    setEmpty(true);
    onChange('');
  }

  function handleBegin() {
    if (disabled) return;
    onDrawStart?.();
  }

  function handleEnd() {
    onDrawEnd?.();
    if (disabled) return;
    ref.current?.readSignature();
  }

  function clear() {
    if (disabled) return;
    ref.current?.clearSignature();
    seedRef.current = '';
    setEmpty(true);
    onChange('');
  }

  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={disabled ? styles.disabled : undefined}>
      <View style={[styles.pad, { height }]}>
        <SignatureCanvas
          ref={ref}
          onBegin={handleBegin}
          onOK={handleOK}
          onEmpty={handleEmpty}
          onEnd={handleEnd}
          dataURL={value ? normalizeDataUrl(value) : undefined}
          descriptionText={placeholder}
          clearText="清除"
          confirmText="保存"
          penColor="#1d1d1f"
          backgroundColor="#fafafa"
          webStyle={WEB_STYLE}
          autoClear={false}
          imageType="image/png"
          style={styles.canvas}
          nestedScrollEnabled
          androidHardwareAccelerationDisabled={false}
          webviewProps={{
            scrollEnabled: false,
            nestedScrollEnabled: true,
            bounces: false,
          }}
        />
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.clearBtn, (disabled || empty) && styles.clearDisabled]}
          disabled={disabled || empty}
          onPress={clear}>
          <Text style={styles.clearText}>重写</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    borderRadius: Brand.radiusSm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.inputBackground,
  },
  canvas: {
    flex: 1,
    width: '100%',
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
  clearDisabled: {
    opacity: 0.4,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },
});
