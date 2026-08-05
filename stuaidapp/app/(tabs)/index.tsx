import { type Href, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementMarquee } from '@/components/home/announcement-marquee';
import { GrantBanner } from '@/components/home/grant-banner';
import { HomeHeader } from '@/components/home/home-header';
import { ServiceGrid } from '@/components/home/service-grid';
import { Brand, type HomeServiceItem } from '@/constants/brand';
import { useAuthStore } from '@/store/auth';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function getGreeting(hour: number, name: string) {
  if (hour < 12) return `早上好，${name}`;
  if (hour < 18) return `下午好，${name}`;
  return `晚上好，${name}`;
}

function formatDateLine(date: Date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}月${day}日 ${weekday} · 晴 22°C`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  // 资助入口按角色分流：学生进资助申请，班主任/辅导员进审核管理。
  function goToAid() {
    if (role === 'student') {
      router.push('/aid' as Href);
    } else if (role === 'classadvisor') {
      router.push('/reviews' as Href);
    } else {
      Alert.alert('暂不支持', '当前角色暂无对应的移动端资助功能，请使用管理后台。');
    }
  }

  function handlePressService(item: HomeServiceItem) {
    if (item.key === 'aid') {
      goToAid();
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <HomeHeader
        onPressNotifications={() => router.push('/messages' as Href)}
        onPressProfile={() => router.push('/profile' as Href)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.section, styles.greetingSection]}>
          <Text style={styles.greeting}>{getGreeting(now.getHours(), user?.real_name || '同学')}</Text>
          <Text style={styles.dateLine}>{formatDateLine(now)}</Text>
        </View>

        <View style={styles.section}>
          <AnnouncementMarquee />
        </View>

        <View style={styles.section}>
          <ServiceGrid onPressService={handlePressService} />
        </View>

        <View style={styles.section}>
          <GrantBanner onPressApply={goToAid} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  greetingSection: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: Brand.foreground,
  },
  dateLine: {
    marginTop: 6,
    fontSize: 14,
    color: Brand.mutedForeground,
  },
});
