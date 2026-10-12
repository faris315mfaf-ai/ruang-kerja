/**
 * Layar kunci aplikasi (mockup 09-biometrik-buka, 10-kunci-aplikasi) dan
 * tawaran "Buka dengan sidik jari" sesudah masuk pertama (08-biometrik-aktifkan).
 * Cadangan bila biometrik gagal = kunci layar Android, lalu KATA SANDI
 * (keluar dari sesi → Masuk) — bukan Google.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useSession } from '@/session/SessionProvider';
import { DarkScope, radius, useTheme } from '@/theme';
import { BottomSheet, Button, Gradient, Icon, Text, useDialog, useSnackbar, type AnyIconName } from '@/ui';

import { Aurora } from './Aurora';
import { LogoRuangKerja } from './AuthLayout';
import { bukaSetelanKeamanan, useAppLock, type AlasanGagal } from './appLock';
import { formatMenitDetik, useHitungMundur } from './util';

type Keadaan = 'siap' | 'memverifikasi' | 'gagal' | 'lockout' | 'lockout_permanen' | 'tanpa_kunci';

export function LayarKunci(): React.JSX.Element {
  return (
    <DarkScope>
      <IsiKunci />
    </DarkScope>
  );
}

function IsiKunci(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, keluar } = useSession();
  const { unlock } = useAppLock();
  const dialog = useDialog();
  const [keadaan, setKeadaan] = useState<Keadaan>('siap');
  const tunggu = useHitungMundur();
  const otomatis = useRef(false);
  const sibuk = useRef(false);

  const coba = useCallback(async (): Promise<void> => {
    if (sibuk.current) {
      return;
    }
    sibuk.current = true;
    setKeadaan('memverifikasi');
    const hasil = await unlock();
    sibuk.current = false;
    if (hasil.ok) {
      return; // overlay hilang sendiri
    }
    const alasan: AlasanGagal = hasil.reason;
    if (alasan === 'cancel') {
      setKeadaan('siap');
    } else if (alasan === 'lockout') {
      tunggu.mulai(30);
      setKeadaan('lockout');
    } else if (alasan === 'lockout_permanent') {
      setKeadaan('lockout_permanen');
    } else if (alasan === 'not_enrolled' || alasan === 'unavailable') {
      setKeadaan('tanpa_kunci');
    } else {
      setKeadaan('gagal');
    }
  }, [unlock, tunggu]);

  useEffect(() => {
    if (otomatis.current) {
      return undefined;
    }
    otomatis.current = true;
    const t = setTimeout(() => void coba(), 350);
    return () => clearTimeout(t);
  }, [coba]);

  // Layar terkunci tidak bisa ditutup dengan tombol kembali.
  useEffect(() => {
    const langganan = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => langganan.remove();
  }, []);

  async function kataSandi(): Promise<void> {
    const ya = await dialog.confirm({
      title: 'Masuk dengan kata sandi?',
      message: 'Anda akan keluar dari sesi ini lalu masuk lagi dengan email dan kata sandi. Pengaturan kunci aplikasi perlu diaktifkan ulang.',
      confirmLabel: 'Lanjut',
    });
    if (ya) {
      await keluar();
    }
  }

  const namaDepan = user?.name.split(' ')[0] ?? '';
  const konfigurasi: Record<Keadaan, { icon: AnyIconName; judul: string; isi: string; merah?: boolean; redup?: boolean }> = {
    siap: { icon: 'fingerprint', judul: 'RuangKerja terkunci', isi: 'Buka dengan sidik jari atau kunci layar untuk melanjutkan.' },
    memverifikasi: { icon: 'fingerprint', judul: 'Memverifikasi…', isi: 'Ikuti petunjuk di dialog sistem.' },
    gagal: { icon: 'x', judul: 'Tidak cocok · coba lagi', isi: 'Sidik jari atau kunci layar tidak dikenali. Coba lagi atau masuk dengan kata sandi.', merah: true },
    lockout: { icon: 'lock', judul: 'Biometrik dikunci sementara', isi: 'Terlalu banyak percobaan tidak cocok. Coba lagi dalam 30 detik atau masuk dengan kata sandi.', redup: true },
    lockout_permanen: {
      icon: 'lock',
      judul: 'Biometrik dikunci',
      isi: 'Android mengunci biometrik. Buka dengan kunci layar (PIN, pola, atau sandi) lalu coba lagi, atau masuk dengan kata sandi.',
      redup: true,
    },
    tanpa_kunci: {
      icon: 'shield-alert',
      judul: 'Kunci layar tidak ditemukan',
      isi: 'Perangkat ini tidak lagi punya kunci layar atau sidik jari terdaftar. Masuk dengan kata sandi untuk melanjutkan.',
      redup: true,
    },
  };
  const k = konfigurasi[keadaan];
  const bisaCoba = keadaan === 'siap' || keadaan === 'gagal' || keadaan === 'lockout_permanen';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, zIndex: 100 }]} accessibilityViewIsModal importantForAccessibility="yes">
      <StatusBar style="light" />
      <Aurora />
      <View style={[s.kolom, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
        <View style={{ gap: 12 }}>
          <LogoRuangKerja ukuran={52} />
          <Text variant="body" tone="muted" weight={600}>
            RuangKerja · SPKD
          </Text>
          <Text variant="h1" weight={800} accessibilityRole="header" style={{ fontSize: 32, lineHeight: 38 }}>
            {namaDepan ? `Selamat datang kembali, ${namaDepan}` : 'Selamat datang kembali'}
          </Text>
          <Text variant="body" tone="muted">
            Buka dengan sidik jari untuk melanjutkan.
          </Text>
        </View>

        <View style={{ alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
          {k.redup ? (
            <View style={[s.tile, { backgroundColor: colors.surface2 }]}>
              <Icon name={k.icon} size={44} color={colors.muted} />
            </View>
          ) : k.merah ? (
            <View style={[s.tile, { backgroundColor: colors.danger }]}>
              <Icon name={k.icon} size={44} color={colors.onDanger} />
            </View>
          ) : (
            <Gradient name="merek" style={s.tile}>
              <Icon name={k.icon} size={44} color="#FFFFFF" strokeWidth={1.7} />
            </Gradient>
          )}
          <Text variant="title" weight={700} align="center">
            {k.judul}
          </Text>
          <Text variant="meta" align="center" style={{ maxWidth: 300 }}>
            {k.isi}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          {keadaan === 'lockout' ? (
            <>
              <Button title="Masuk dengan kata sandi" icon="key-round" onPress={() => void kataSandi()} />
              <Button
                title={tunggu.berjalan ? `Coba lagi dalam ${formatMenitDetik(tunggu.sisa)}` : 'Coba lagi'}
                variant="quiet"
                disabled={tunggu.berjalan}
                onPress={() => void coba()}
              />
            </>
          ) : keadaan === 'tanpa_kunci' ? (
            <>
              <Button title="Masuk dengan kata sandi" icon="key-round" onPress={() => void kataSandi()} />
              <Button title="Buka Setelan" variant="quiet" onPress={() => void bukaSetelanKeamanan()} />
            </>
          ) : (
            <>
              <Button
                title={keadaan === 'gagal' ? 'Coba lagi' : keadaan === 'memverifikasi' ? 'Memverifikasi…' : 'Buka kunci'}
                icon="fingerprint"
                onPress={() => void coba()}
                loading={keadaan === 'memverifikasi'}
                loadingTitle="Memverifikasi…"
                disabled={!bisaCoba && keadaan !== 'memverifikasi'}
              />
              <Button title="Masuk dengan kata sandi" variant="quiet" onPress={() => void kataSandi()} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

/** Tawaran sekali setelah masuk pertama; "Nanti saja" tidak muncul lagi otomatis (tetap ada di Keamanan). */
export function TawaranBiometrik(): React.JSX.Element {
  const { status, blokir } = useSession();
  const { offerPending, locked, setEnabled, markOffered } = useAppLock();
  const snackbar = useSnackbar();
  const [sibuk, setSibuk] = useState(false);
  const [tutupLokal, setTutupLokal] = useState(false);

  const tampil = offerPending && status === 'masuk' && blokir === null && !locked && !tutupLokal;

  async function aktifkan(): Promise<void> {
    if (sibuk) {
      return;
    }
    setSibuk(true);
    const hasil = await setEnabled(true);
    setSibuk(false);
    if (hasil.ok) {
      setTutupLokal(true);
      snackbar.show({ variant: 'ok', message: 'Buka dengan sidik jari aktif di perangkat ini' });
    } else if (hasil.reason === 'failed' || hasil.reason === 'lockout' || hasil.reason === 'lockout_permanent') {
      snackbar.show({ variant: 'bad', message: 'Sidik jari tidak dikenali. Coba lagi.' });
    } else if (hasil.reason === 'not_enrolled' || hasil.reason === 'unavailable') {
      setTutupLokal(true);
      snackbar.show({ variant: 'info', message: 'Atur sidik jari atau kunci layar di Setelan Android dulu.' });
    }
  }

  function nanti(): void {
    setTutupLokal(true);
    void markOffered();
  }

  return (
    <BottomSheet visible={tampil} onClose={nanti}>
      <View style={{ alignItems: 'center', gap: 14, paddingBottom: 8 }}>
        <Gradient name="merek" style={s.tileSheet}>
          <Icon name="fingerprint" size={44} color="#FFFFFF" strokeWidth={1.7} />
        </Gradient>
        <Text variant="h3" weight={800} align="center" accessibilityRole="header">
          Buka RuangKerja dengan sidik jari
        </Text>
        <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
          Tidak perlu mengetik kata sandi tiap aplikasi dibuka di perangkat ini. Kata sandi Anda tidak disimpan di ponsel.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 6 }}>
          <Button title="Aktifkan" icon="fingerprint" onPress={() => void aktifkan()} loading={sibuk} />
          <Button title="Nanti saja" variant="quiet" onPress={nanti} />
        </View>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kolom: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  tile: { width: 100, height: 100, borderRadius: radius['2xl'] + 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileSheet: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
