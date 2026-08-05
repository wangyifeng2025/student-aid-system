import { type Href, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingDots } from '@/components/splash/loading-dots';
import { SchoolBadgeIcon } from '@/components/splash/school-badge-icon';
import { AppCopy, Brand } from '@/constants/brand';
import { useAuthStore } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

export default function SplashRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(1);

  useEffect(() => {
    void SplashScreen.hideAsync();
    void useAuthStore.getState().hydrate();

    opacity.value = withDelay(
      Brand.fadeStartMs,
      withTiming(
        0,
        { duration: Brand.fadeDurationMs, easing: Easing.inOut(Easing.ease) },
        (finished) => {
          if (finished) {
            runOnJS(navigateNext)();
          }
        },
      ),
    );

    function navigateNext() {
      const state = useAuthStore.getState();
      if (state.hydrated) {
        router.replace((state.isAuthenticated ? '/(tabs)' : '/login') as Href);
        return;
      }
      // 会话恢复（AsyncStorage 读取）尚未完成，等待一次即可。
      const unsubscribe = useAuthStore.subscribe((s) => {
        if (s.hydrated) {
          unsubscribe();
          router.replace((s.isAuthenticated ? '/(tabs)' : '/login') as Href);
        }
      });
    }
  }, [opacity, router]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
        fadeStyle,
      ]}>
      <View style={styles.middle}>
        <SchoolBadgeIcon />
        <Text style={styles.title}>{AppCopy.schoolName}</Text>
        <Text style={styles.subtitle}>{AppCopy.schoolNameEn}</Text>
      </View>

      <View style={styles.bottom}>
        <LoadingDots />
        <Text style={styles.footer}>{AppCopy.copyright}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.primary,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  middle: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 8,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 35,
    letterSpacing: 0.56,
    textAlign: 'center',
    color: Brand.primaryForeground,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'center',
    color: Brand.primaryForeground,
    opacity: Brand.subtitleOpacity,
  },
  bottom: {
    alignItems: 'center',
    gap: 20,
  },
  footer: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: Brand.primaryForeground,
    opacity: Brand.footerOpacity,
  },
});
