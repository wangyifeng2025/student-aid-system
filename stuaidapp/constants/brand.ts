/** 黔西南民族职业技术学院 App 品牌与设计 token */
export const Brand = {
  primary: '#1e40af',
  primaryForeground: '#ffffff',
  primaryRing: 'rgba(255, 255, 255, 0.36)',
  brand50: '#eef4ff',
  background: '#ffffff',
  foreground: '#1d1d1f',
  mutedForeground: '#8e8e93',
  border: '#e5e5ea',
  card: '#ffffff',
  secondary: '#f2f2f7',
  secondaryForeground: '#1d1d1f',
  success: '#34c759',
  successSurface: '#e9f9ee',
  warning: '#ff9500',
  warningSurface: '#fff6e9',
  error: '#ff3b30',
  errorSurface: '#fdecea',
  info: '#5856d6',
  infoSurface: '#eeeefb',
  inputBackground: '#f7f7f9',
  radius: 19,
  radiusSm: 10,
  subtitleOpacity: 0.72,
  footerOpacity: 0.56,
  loaderDotOpacity: 0.4,
  splashDurationMs: 2500,
  fadeStartMs: 2000,
  fadeDurationMs: 500,
} as const;

export const AppCopy = {
  schoolName: '黔西南民族职业技术学院',
  schoolNameEn: 'Qianxinan Vocational College',
  copyright: '© 2026 黔西南民族职业技术学院',
  announcement: '关于2026秋季学期资助申请的通知',
} as const;

export type HomeServiceItem = {
  key: string;
  label: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  comingSoon?: boolean;
};

export const HOME_SERVICES: HomeServiceItem[] = [
  { key: 'aid', label: '资助', icon: 'heart-outline' },
  { key: 'academic', label: '教务', icon: 'calendar-outline', comingSoon: true },
  { key: 'grades', label: '成绩', icon: 'trending-up-outline', comingSoon: true },
  { key: 'schedule', label: '课表', icon: 'calendar-number-outline', comingSoon: true },
  { key: 'attendance', label: '考勤', icon: 'checkmark-circle-outline', comingSoon: true },
  { key: 'payment', label: '缴费', icon: 'card-outline', comingSoon: true },
  { key: 'library', label: '图书馆', icon: 'book-outline', comingSoon: true },
  { key: 'campus-card', label: '校园卡', icon: 'card-outline', comingSoon: true },
  { key: 'notice', label: '通知', icon: 'mail-outline', comingSoon: true },
  { key: 'hall', label: '办事大厅', icon: 'folder-open-outline', comingSoon: true },
  { key: 'dorm', label: '宿舍', icon: 'home-outline', comingSoon: true },
  { key: 'more', label: '更多', icon: 'grid-outline', comingSoon: true },
];
