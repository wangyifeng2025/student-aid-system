import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.brandArea}>
          <View style={styles.logo}>
            <Image
              source={require('@/assets/images/splash-icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="黔西南民族职业技术学院校徽"
            />
          </View>
          <Text style={styles.appName}>{AppCopy.schoolName}</Text>
          <Text style={styles.appSubtitle}>请使用学号或工号登录</Text>
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
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>密码</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Brand.mutedForeground} />
              <TextInput
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

        <Text style={styles.footer}>如需帮助，请联系管理员</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  brandArea: {
    alignItems: 'center',
  },
  logo: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 88,
    height: 88,
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
