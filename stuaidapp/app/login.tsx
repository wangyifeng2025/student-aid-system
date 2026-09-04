import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, login } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AppCopy, Brand } from '@/constants/brand';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const passwordFieldRef = useRef<View>(null);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates.height;
      keyboardHeightRef.current = height;
      setKeyboardHeight(height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function ensurePasswordVisible() {
    const field = passwordFieldRef.current;
    const scroll = scrollRef.current;
    if (!field || !scroll) return;
    field.measureInWindow((_x, y, _w, h) => {
      const kb = keyboardHeightRef.current;
      const visibleBottom = Dimensions.get('window').height - kb - 16;
      const overflow = y + h - visibleBottom;
      if (overflow > 0) {
        scroll.scrollTo({ y: scrollYRef.current + overflow, animated: true });
      }
    });
  }

  useEffect(() => {
    if (!error && keyboardHeight === 0) return;
    const timer = setTimeout(ensurePasswordVisible, Platform.OS === 'ios' ? 50 : 80);
    return () => clearTimeout(timer);
  }, [error, keyboardHeight]);

  async function handleSubmit() {
    const u = username.trim();
    if (!u) {
      setError('请输入学号或工号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await login({ username: u, password });
      await setSession(tokens);
      router.replace('/(tabs)' as Href);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  const keyboardOpen = keyboardHeight > 0;
  // Android edge-to-edge 时窗口经常不随键盘缩小，需自行留出键盘高度；iOS 由 KeyboardAvoidingView 处理。
  const bottomPad =
    Platform.OS === 'android' && keyboardOpen ? keyboardHeight + 16 : insets.bottom + 24;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: keyboardOpen ? insets.top + 16 : insets.top + 48,
            paddingBottom: bottomPad,
            justifyContent: keyboardOpen ? 'flex-start' : 'space-between',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}>
        <View style={[styles.brandArea, keyboardOpen && styles.brandAreaCompact]}>
          <View style={[styles.logo, keyboardOpen && styles.logoCompact]}>
            <Image
              source={require('@/assets/images/splash-icon.png')}
              style={[styles.logoImage, keyboardOpen && styles.logoImageCompact]}
              resizeMode="contain"
              accessibilityLabel="黔西南民族职业技术学院校徽"
            />
          </View>
          <Text style={styles.appName}>{AppCopy.schoolName}</Text>
          {keyboardOpen ? null : <Text style={styles.appSubtitle}>请使用学号或工号登录</Text>}
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={15} color={Brand.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>学号 / 工号</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={Brand.mutedForeground} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="请输入学号或工号"
                placeholderTextColor={Brand.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />
            </View>
          </View>

          <View ref={passwordFieldRef} collapsable={false} style={styles.field}>
            <Text style={styles.label}>密码</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Brand.mutedForeground} />
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="请输入密码"
                placeholderTextColor={Brand.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                onFocus={() => setTimeout(ensurePasswordVisible, 80)}
              />
              <Pressable
                hitSlop={8}
                accessibilityLabel={showPassword ? '隐藏密码' : '显示密码'}
                onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Brand.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            disabled={submitting}
            onPress={handleSubmit}>
            {submitting ? (
              <ActivityIndicator color={Brand.primaryForeground} />
            ) : (
              <Text style={styles.submitBtnText}>登录</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.forgotBtn}
            onPress={() =>
              Alert.alert('忘记密码', '请联系辅导员或管理员在系统内重置密码。')
            }>
            <Text style={styles.forgotText}>忘记密码？</Text>
          </Pressable>
        </View>

        {keyboardOpen ? null : <Text style={styles.footer}>如需帮助，请联系管理员</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  brandArea: {
    alignItems: 'center',
  },
  brandAreaCompact: {
    marginBottom: 20,
  },
  logo: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoCompact: {
    width: 56,
    height: 56,
    marginBottom: 8,
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  logoImageCompact: {
    width: 56,
    height: 56,
  },
  appName: {
    fontSize: 19,
    fontWeight: '700',
    color: Brand.foreground,
    textAlign: 'center',
  },
  appSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  form: {
    gap: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.errorSurface,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Brand.error,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.foreground,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Brand.foreground,
    padding: 0,
  },
  submitBtn: {
    height: 48,
    borderRadius: 999,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.primaryForeground,
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    color: Brand.primary,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: Brand.mutedForeground,
  },
});
