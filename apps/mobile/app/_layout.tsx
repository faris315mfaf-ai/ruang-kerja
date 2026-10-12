/**
 * Tata letak akar: tema Arus (terang/gelap mengikuti sistem), sesi, dan
 * Stack utama. Saat sesi masih divalidasi, splash tetap tampil.
 */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { UnreadProvider } from '@/session/UnreadProvider';

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

/**
 * Server menolak sesi ini sampai pengguna bertindak di web (ganti kata sandi
 * / atur 2FA). Navigator tidak dirender supaya layar tidak terus memanggil
 * API; keluar tetap bisa.
 */
function LayarBlokir(): React.JSX.Element {
  const { colors, dark } = useTheme();
  const { blokir, periksaUlang, keluar } = useSession();
  const [sibuk, setSibuk] = useState(false);

  const judul =
    blokir?.code === 'two_factor_required' ? 'Atur verifikasi dua langkah' : 'Ganti kata sandi dulu';
  const langkah =
    blokir?.code === 'two_factor_required'
      ? 'Buka RuangKerja di peramban, masuk, lalu aktifkan verifikasi dua langkah. Setelah itu kembali ke sini dan ketuk Periksa lagi.'
      : 'Buka RuangKerja di peramban, masuk, lalu ganti kata sandi Anda. Setelah itu kembali ke sini dan ketuk Periksa lagi.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 28, gap: 14 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{judul}</Text>
      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' }} accessibilityRole="alert">
        {blokir?.message}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{langkah}</Text>
      <Button
        title="Periksa lagi"
        icon="refresh"
        loading={sibuk}
        disabled={sibuk}
        onPress={() => {
          setSibuk(true);
          void periksaUlang().finally(() => setSibuk(false));
        }}
      />
      <Button title="Keluar" variant="ghost" icon="log-out-outline" onPress={() => void keluar()} />
    </View>
  );
}

function RootNavigator(): React.JSX.Element {
  const { status, user, blokir } = useSession();
  const { colors, dark } = useTheme();

  useEffect(() => {
    if (status !== 'memuat') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status]);

  if (status === 'memuat') {
    return <Splash />;
  }

  const isi = status === 'masuk' && blokir !== null ? (
    <LayarBlokir />
  ) : (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/*
        Rute ber-sesi dijaga Stack.Protected: saat keluar/401 semua layar
        ber-sesi dikeluarkan dari stack (tombol kembali tidak bisa membukanya
        lagi). Navigator di-key per pengguna supaya layar tab yang tetap
        terpasang tidak menampilkan data pengguna sebelumnya.
      */}
      <Stack
        key={user?.id ?? 'tamu'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Protected guard={status !== 'masuk'}>
          <Stack.Screen name="masuk" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'masuk'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="tugas/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tugas/baru" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="workspace/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="workspace/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="catatan/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pengajuan/baru" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="inbox" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="obrolan/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rapat/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rapat/[id]/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rapat/[id]/notulen" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="kalender" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
      </Stack>
    </>
  );

  // UnreadProvider SELALU membungkus navigator: rute (tabs) sempat dirender
  // saat status masih memuat/keluar (sebelum guard Stack.Protected berlaku), dan
  // TabBarKita memanggil useUnread() — di luar provider itu fatal di rilis
  // (force close saat dibuka). Provider sendiri diam saat belum ada sesi.
  return <UnreadProvider>{isi}</UnreadProvider>;
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
