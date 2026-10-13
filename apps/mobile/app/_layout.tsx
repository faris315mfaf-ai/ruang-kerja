/**
 * Tata letak akar: tema Arus (terang/gelap mengikuti sistem), sesi, dan
 * Stack utama. Saat sesi masih divalidasi, splash tetap tampil.
 */
import { registerGlobals } from '@livekit/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GantiSandiWajib } from '@/features/auth/GantiSandiWajib';
import { LayarBlokirAplikasi, DialogSesiBerakhir, KartuUpdateTersedia } from '@/features/auth/LayarAplikasi';
import { LayarKunci, TawaranBiometrik } from '@/features/auth/KunciAplikasi';
import { SetupDuaFaktorWeb } from '@/features/auth/SetupDuaFaktorWeb';
import { ModeCatatPill } from '@/features/catatan/ModeCatatPill';
import { AppLockProvider, useAppLock } from '@/features/auth/appLock';
import { ThemeProvider, useAppFonts, useTheme } from '@/theme';
import { UIProvider } from '@/ui';
import { AppStatusProvider, useAppStatus } from '@/session/AppStatusProvider';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { UnreadProvider } from '@/session/UnreadProvider';

// WebRTC + polyfill LiveKit (ruang rapat video native) — sekali saat aplikasi mulai.
registerGlobals();

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
  const { status, user, blokir } = useSession();
  const { blokir: blokirApp } = useAppStatus();
  const { locked, ready: kunciSiap } = useAppLock();
  const { colors, dark, ready } = useTheme();
  const fontSiap = useAppFonts();
  const siap = status !== 'memuat' && ready && fontSiap && kunciSiap;

  useEffect(() => {
    if (siap) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [siap]);

  if (!siap) {
    return <Splash />;
  }

  let isi: React.JSX.Element;
  if (blokirApp !== null) {
    // Versi tak didukung (426) / pemeliharaan (503): menutup seluruh aplikasi.
    isi = <LayarBlokirAplikasi status={blokirApp} />;
  } else if (status === 'masuk' && blokir?.code === 'password_change_required') {
    // Server menolak sesi sampai kata sandi diganti: form native, tanpa navigator.
    isi = <GantiSandiWajib />;
  } else if (status === 'masuk' && blokir?.code === 'two_factor_setup_required') {
    isi = <SetupDuaFaktorWeb />;
  } else {
    isi = (
      <>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {/*
          Rute ber-sesi dijaga Stack.Protected: saat keluar/401 semua layar
          ber-sesi dikeluarkan dari stack (tombol kembali tidak bisa membukanya
          lagi). Navigator di-key per pengguna supaya layar tab yang tetap
          terpasang tidak menampilkan data pengguna sebelumnya. Layar alur
          masuk (Masuk, TOTP, lupa sandi) hanya ada selama belum bersesi.
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
            <Stack.Screen name="dua-faktor" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="lupa-sandi/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="lupa-sandi/tunggu" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="lupa-sandi/baru" options={{ animation: 'slide_from_right' }} />
          </Stack.Protected>
          <Stack.Protected guard={status === 'masuk'}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="tugas/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="tugas/baru" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="workspace/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="workspace/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="workspace/baru" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="workspace/[id]/pengaturan" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="otomasi/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="otomasi/aturan" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="otomasi/aturan/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="otomasi/berulang" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="otomasi/templat" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="otomasi/pakai/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="tugas/aktivitas" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="catatan/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="catatan/cari" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="catatan/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pengajuan/baru" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="pengajuan/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pengajuan/form" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pengajuan/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pengajuan/terkirim" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="inbox" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="inbox/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="inbox/tidak-tersedia" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pengumuman" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="persetujuan" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="laporan" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cari" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="buat-cepat" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="obrolan/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="obrolan/baru" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="obrolan/kanal-baru" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="obrolan/jelajah" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="obrolan/[id]/detail" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="obrolan/[id]/cari" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="obrolan/[id]/thread/[messageId]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="rapat/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="rapat/[id]/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="rapat/[id]/notulen" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="rapat/baru" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="rapat/[id]/ubah" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="rapat/[id]/transkrip" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="manajemen/jadwal" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="rapat/[id]/video/pra-gabung" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="rapat/[id]/video/ruang" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="kalender" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="kinerja" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="absensi" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="profil" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pengaturan" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="segera" options={{ animation: 'slide_from_right' }} />
          </Stack.Protected>
          {/* Privasi: Data Saya butuh sesi (API menolak tanpa token); Kebijakan privasi publik. */}
          <Stack.Screen name="privasi" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </>
    );
  }

  const bersesi = status === 'masuk' && blokirApp === null && blokir === null;

  // UnreadProvider SELALU membungkus navigator: rute (tabs) sempat dirender
  // saat status masih memuat/keluar (sebelum guard Stack.Protected berlaku), dan
  // TabBarKita memanggil useUnread() — di luar provider itu fatal di rilis
  // (force close saat dibuka). Provider sendiri diam saat belum ada sesi.
  return (
    <UnreadProvider>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={locked}>
          {isi}
        </View>
        {bersesi ? <KartuUpdateTersedia /> : null}
        {bersesi ? <TawaranBiometrik /> : null}
        {bersesi ? <ModeCatatPill /> : null}
        <DialogSesiBerakhir />
        {locked ? <LayarKunci /> : null}
      </View>
    </UnreadProvider>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <UIProvider>
          <AppStatusProvider>
            <SessionProvider>
              <AppLockProvider>
                <RootNavigator />
              </AppLockProvider>
            </SessionProvider>
          </AppStatusProvider>
        </UIProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
