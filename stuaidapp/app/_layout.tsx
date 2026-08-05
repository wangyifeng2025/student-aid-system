import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="aid/index" options={{ headerShown: false }} />
          <Stack.Screen name="aid/apply" options={{ headerShown: false }} />
          <Stack.Screen name="aid/records" options={{ headerShown: false }} />
          <Stack.Screen name="aid/recognition/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="aid/grant-apply" options={{ headerShown: false }} />
          <Stack.Screen name="aid/grant/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="reviews/index" options={{ headerShown: false }} />
          <Stack.Screen name="reviews/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
