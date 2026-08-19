import { Image, StyleSheet, View } from 'react-native';

/** 启动页校徽：主色蓝校徽，白底圆徽在蓝色启动页上更清晰 */
export function SchoolBadgeIcon() {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('@/assets/images/splash-icon.png')}
        style={styles.badge}
        resizeMode="contain"
        accessibilityLabel="黔西南民族职业技术学院校徽"
      />
    </View>
  );
}

const BADGE_SIZE = 168;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  },
});
