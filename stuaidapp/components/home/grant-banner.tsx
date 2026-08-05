import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  onPressApply?: () => void;
};

export function GrantBanner({ onPressApply }: Props) {
  return (
    <View style={styles.banner}>
      <View style={styles.copy}>
        <Text style={styles.kicker}>助学金</Text>
        <Text style={styles.title}>助学金申请</Text>
        <Text style={styles.desc}>在线提交，实时查看进度</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityLabel="立即申请"
        onPress={onPressApply}>
        <Text style={styles.buttonText}>立即申请</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: Brand.radius,
    backgroundColor: Brand.brand50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  copy: {
    flex: 1,
    paddingRight: 12,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.primary,
  },
  title: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.foreground,
  },
  desc: {
    marginTop: 2,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  button: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
});
