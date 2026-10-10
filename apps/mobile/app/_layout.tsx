/**
 * Tata letak akar: tema Arus (terang/gelap mengikuti sistem), sesi, dan
 * Stack utama. Saat sesi masih divalidasi, splash tetap tampil.
 */
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/lib/theme';
import { SessionProvider, useSession } from '@/session/SessionProvider';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Sudah tersembunyi — abaikan.
});

function Splash(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="auto" />
    </View>
  );
}

function RootNavigator(): React.JSX.Element {
  const { status } = useSession();
  const { colors, dark } = useTheme();

  useEffect(() => {
    if (status !== 'memuat') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status]);

  if (status === 'memuat') {
    return <Splash />;
  }

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="masuk" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tugas/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tugas/baru" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="workspace/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="workspace/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="catatan/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="pengajuan/baru" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      {status === 'keluar' ? <Redirect href="/masuk" /> : null}
    </>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
