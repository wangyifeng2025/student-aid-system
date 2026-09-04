import { Ionicons } from '@expo/vector-icons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementMarquee } from '@/components/home/announcement-marquee';
import { GrantBanner } from '@/components/home/grant-banner';
import { HomeHeader } from '@/components/home/home-header';
import { ServiceGrid } from '@/components/home/service-grid';
import { Brand, type HomeServiceItem } from '@/constants/brand';
import { welcomeIdentityLabel } from '@/constants/roles';
import { dashboardApi, grantReviewApi, reviewApi } from '@/lib/api';
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
  return `${month}月${day}日 ${weekday}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const [pendingTotal, setPendingTotal] = useState(0);
  const [recognitionTodo, setRecognitionTodo] = useState(0);
  const [grantTodo, setGrantTodo] = useState(0);
  const [deptName, setDeptName] = useState('');
  const [className, setClassName] = useState('');

  const loadHomeMeta = useCallback(async () => {
    try {
      const overview = await dashboardApi.overview(new Date().getFullYear());
      setDeptName(overview.dept_name || '');
      setClassName(overview.class_name || '');
    } catch {
      // 院系信息失败不阻断首页。
    }

    if (role !== 'classadvisor' && role !== 'department' && role !== 'aidcenter' && role !== 'admin') {
      return;
    }
    try {
      // 本级待办角标；教学系/资助中心额外统计在途（含下级未审）
      const [recTodo, grantTodoRes, recPipe, grantPipe] = await Promise.all([
        reviewApi.todo({ page: 1, pageSize: 1 }),
        grantReviewApi.todo({ page: 1, pageSize: 1 }),
        reviewApi.records({ tab: 'todo', page: 1, pageSize: 1 }),
        grantReviewApi.records({ tab: 'todo', page: 1, pageSize: 1 }),
      ]);
      setRecognitionTodo(recTodo.total);
      setGrantTodo(grantTodoRes.total);
      const mine = recTodo.total + grantTodoRes.total;
      const pipeline = recPipe.total + grantPipe.total;
      setPendingTotal(role === 'classadvisor' ? mine : Math.max(mine, pipeline));
    } catch {
      // 首页角标失败不阻断主流程。
    }
  }, [role]);

  useFocusEffect(
    useCallback(() => {
      loadHomeMeta();
    }, [loadHomeMeta]),
  );

  // 资助入口按角色分流：学生进资助申请，评审角色进审核管理。
  function goToAid() {
    if (role === 'student') {
      router.push('/aid' as Href);
    } else if (
      role === 'classadvisor' ||
      role === 'department' ||
      role === 'aidcenter' ||
      role === 'admin'
    ) {
      router.push('/reviews' as Href);
    } else {
      Alert.alert('暂不支持', '当前角色暂无对应的移动端资助功能，请使用管理后台。');
    }
  }

  function handlePressService(item: HomeServiceItem) {
    if (item.key === 'aid') {
      goToAid();
      return;
    }
    Alert.alert('建设中', `「${item.label}」功能正在建设，敬请期待。`);
  }

  const isReviewer =
    role === 'classadvisor' || role === 'department' || role === 'aidcenter' || role === 'admin';
  const identityLabel = welcomeIdentityLabel(role);

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
          <Text style={styles.greeting}>
            {getGreeting(now.getHours(), user?.real_name || (isReviewer ? '老师' : '同学'))}
          </Text>
          <View style={styles.identityRow}>
            {identityLabel ? (
              <View style={[styles.chip, styles.chipRole]}>
                <Ionicons
                  name={role === 'student' ? 'school-outline' : 'briefcase-outline'}
                  size={12}
                  color={Brand.primary}
                />
                <Text style={styles.chipRoleText}>{identityLabel}</Text>
              </View>
            ) : null}
            {deptName ? (
              <View style={[styles.chip, styles.chipDept]}>
                <Ionicons name="business-outline" size={12} color={Brand.primary} />
                <Text style={styles.chipDeptText}>{deptName}</Text>
              </View>
            ) : null}
            {className ? (
              <View style={[styles.chip, styles.chipClass]}>
                <Ionicons name="people-outline" size={12} color={Brand.mutedForeground} />
                <Text style={styles.chipClassText}>{className}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.dateLine}>{formatDateLine(now)}</Text>
        </View>

        {isReviewer && pendingTotal > 0 ? (
          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [styles.pendingCard, pressed && styles.pendingPressed]}
              onPress={() => router.push('/reviews' as Href)}>
              <View style={styles.pendingIcon}>
                <Ionicons name="alert-circle" size={22} color={Brand.warning} />
              </View>
              <View style={styles.pendingBody}>
                <Text style={styles.pendingTitle}>有 {pendingTotal} 条待审核</Text>
                <Text style={styles.pendingDesc}>
                  困难认定 {recognitionTodo} · 助学金 {grantTodo}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Brand.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <AnnouncementMarquee />
        </View>

        <View style={styles.section}>
          <ServiceGrid onPressService={handlePressService} />
        </View>

        <View style={styles.section}>
          {isReviewer ? (
            <Pressable
              style={({ pressed }) => [styles.reviewBanner, pressed && styles.pendingPressed]}
              onPress={() => router.push('/reviews' as Href)}>
              <Text style={styles.reviewBannerTitle}>进入审核工作台</Text>
              <Text style={styles.reviewBannerDesc}>评审困难认定与助学金申请，查看已审记录</Text>
            </Pressable>
          ) : (
            <GrantBanner onPressApply={goToAid} />
          )}
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
  identityRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipRole: {
    backgroundColor: Brand.brand50,
  },
  chipRoleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.primary,
  },
  chipDept: {
    backgroundColor: Brand.brand50,
  },
  chipDeptText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.primary,
  },
  chipClass: {
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  chipClassText: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.mutedForeground,
  },
  dateLine: {
    marginTop: 8,
    fontSize: 14,
    color: Brand.mutedForeground,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Brand.radius,
    backgroundColor: Brand.warningSurface,
  },
  pendingPressed: {
    opacity: 0.9,
  },
  pendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.card,
  },
  pendingBody: {
    flex: 1,
    gap: 2,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.foreground,
  },
  pendingDesc: {
    fontSize: 12,
    color: Brand.mutedForeground,
  },
  reviewBanner: {
    padding: 18,
    borderRadius: Brand.radius,
    backgroundColor: Brand.brand50,
    gap: 6,
  },
  reviewBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.primary,
  },
  reviewBannerDesc: {
    fontSize: 13,
    color: Brand.mutedForeground,
    lineHeight: 19,
  },
});
