import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AID_NOTICES } from '@/constants/aid';
import { Brand } from '@/constants/brand';

export function AidNoticeList() {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>资助公告</Text>
      <View style={styles.list}>
        {AID_NOTICES.map((notice, index) => (
          <View
            key={notice.key}
            style={[styles.row, index === AID_NOTICES.length - 1 && styles.rowLast]}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={Brand.primary}
              style={styles.rowIcon}
            />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {notice.title}
              </Text>
              <Text style={styles.rowDate}>{notice.date}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: Brand.radius,
    backgroundColor: Brand.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.foreground,
  },
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  rowIcon: {
    marginTop: 2,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    color: Brand.foreground,
  },
  rowDate: {
    marginTop: 2,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
});
