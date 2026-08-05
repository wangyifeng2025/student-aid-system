import type { Ionicons } from '@expo/vector-icons';

export type AidActionItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

export const AID_ACTIONS: AidActionItem[] = [
  {
    key: 'recognition-apply',
    icon: 'document-text-outline',
    title: '困难认定申请',
    description: '填报家庭经济困难认定材料',
  },
  {
    key: 'grant-apply',
    icon: 'cash-outline',
    title: '助学金申请',
    description: '认定通过后可申请国家助学金',
  },
  {
    key: 'progress',
    icon: 'time-outline',
    title: '申请进度查询',
    description: '查看认定与助学金审核进度',
  },
];

export type AidNoticeItem = {
  key: string;
  title: string;
  date: string;
};

export const AID_NOTICES: AidNoticeItem[] = [
  {
    key: 'notice-1',
    title: '关于开展 2026-2027 学年家庭经济困难学生认定工作的通知',
    date: '2026-08-01',
  },
  {
    key: 'notice-2',
    title: '国家助学金发放进度说明',
    date: '2026-07-25',
  },
  {
    key: 'notice-3',
    title: '2025 秋季国家助学金已发放到位，请注意查收',
    date: '2026-07-20',
  },
];
