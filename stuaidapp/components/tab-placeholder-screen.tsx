import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/** Tab 占位页，后续替换为实际功能模块 */
export default function TabPlaceholderScreen({ title, icon }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 48 }]}>
      <Ionicons name={icon} size={48} color={Brand.primary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>功能开发中</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.background,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Brand.foreground,
  },
  hint: {
    fontSize: 14,
    color: Brand.mutedForeground,
  },
});
