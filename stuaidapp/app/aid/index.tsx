import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AidActionCard } from '@/components/aid/aid-action-card';
import { AidApplicationsCard } from '@/components/aid/aid-applications-card';
import { AidHeader } from '@/components/aid/aid-header';
import { AidNoticeList } from '@/components/aid/aid-notice-list';
import { AID_ACTIONS, type AidActionItem } from '@/constants/aid';
import { Brand } from '@/constants/brand';

export default function AidHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function handlePressAction(item: AidActionItem) {
    if (item.key === 'recognition-apply') {
      router.push('/aid/apply');
      return;
    }
    if (item.key === 'grant-apply') {
      router.push('/aid/grant-apply');
      return;
    }
    if (item.key === 'progress') {
      router.push('/aid/records');
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <AidHeader title="资助申请" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.section, styles.sectionTop]}>
          <AidApplicationsCard />
        </View>

        <View style={styles.section}>
          <View style={styles.actions}>
            {AID_ACTIONS.map((item) => (
              <AidActionCard key={item.key} item={item} onPress={handlePressAction} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <AidNoticeList />
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
  sectionTop: {
    paddingTop: 20,
  },
  actions: {
    gap: 12,
  },
});
