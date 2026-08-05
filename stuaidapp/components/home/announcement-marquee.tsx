import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppCopy, Brand } from '@/constants/brand';

const MARQUEE_DURATION = 18000;

export function AnnouncementMarquee() {
  const translateX = useSharedValue(0);
  const text = AppCopy.announcement;

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(-200, { duration: MARQUEE_DURATION / 2, easing: Easing.linear }),
      -1,
      false,
    );
  }, [translateX]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.card} accessibilityRole="text" accessibilityLabel="通知公告">
      <View style={styles.badge}>
        <Text style={styles.badgeText}>通知</Text>
      </View>
      <View style={styles.marqueeWrap}>
        <Animated.View style={[styles.track, trackStyle]}>
          <Text style={styles.text}>{text}</Text>
          <Text style={[styles.text, styles.gapText]}>{text}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Brand.radius,
    backgroundColor: Brand.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  badge: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
  marqueeWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  text: {
    fontSize: 14,
    color: Brand.foreground,
  },
  gapText: {
    marginLeft: 24,
  },
});
