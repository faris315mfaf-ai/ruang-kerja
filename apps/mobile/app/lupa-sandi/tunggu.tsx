/**
 * Menunggu persetujuan HR (mockup 06-lupa-sandi-tunggu). Polling status tiap
 * 5 detik hanya saat aplikasi aktif dan layar terfokus; berhenti di
 * approved/rejected/expired. Permintaan disimpan di SecureStore sehingga
 * aplikasi yang ditutup bisa melanjutkan dari layar Masuk.
 */
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { ApiError } from '@/api/client';
import { lupaSandiStatus } from '@/api/endpoints';
import { FormScreen, IkonStatus } from '@/features/auth/AuthLayout';
import { bacaPermintaanReset, hapusPermintaanReset, simpanSetup, type PermintaanReset } from '@/features/auth/resetRequest';
import { useTheme } from '@/theme';
import { Banner, Button, Icon, Text } from '@/ui';

type Tahap = 'memuat' | 'pending' | 'approved' | 'rejected' | 'expired' | 'tidak_ada';

const INTERVAL_MS = 5_000;

function jam(ms: number): string {
  return new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
}

function tanggalJam(ms: number): string {
  return new Date(ms)
    .toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(/(\d{2}):(\d{2})$/, '$1.$2');
}

export default function LayarLupaSandiTunggu(): React.JSX.Element {
  const { colors } = useTheme();
  const fokus = useIsFocused();
  const [aktifApp, setAktifApp] = useState(AppState.currentState === 'active');
  const [permintaan, setPermintaan] = useState<PermintaanReset | null>(null);
  const [tahap, setTahap] = useState<Tahap>('memuat');
  const [alasanTolak, setAlasanTolak] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [terakhir, setTerakhir] = useState<number | null>(null);
  const memeriksa = useRef(false);

  useEffect(() => {
    const langganan = AppState.addEventListener('change', (s) => setAktifApp(s === 'active'));
    return () => langganan.remove();
  }, []);

  useEffect(() => {
    let batal = false;
    void bacaPermintaanReset().then((p) => {
      if (batal) {
        return;
      }
      setPermintaan(p);
      setTahap(p ? 'pending' : 'tidak_ada');
    });
    return () => {
      batal = true;
    };
  }, []);

  const periksa = useCallback(async (p: PermintaanReset): Promise<void> => {
    if (memeriksa.current) {
      return;
    }
    if (Date.now() >= p.kedaluwarsaPada) {
      await hapusPermintaanReset();
      setTahap('expired');
      return;
    }
    memeriksa.current = true;
    try {
      const hasil = await lupaSandiStatus(p.token);
      setOffline(false);
      setTerakhir(Date.now());
      if (hasil.status === 'approved') {
        simpanSetup({
          setupToken: hasil.setup_token,
          kedaluwarsaPada: Date.parse(hasil.setup_expires_at) || Date.now() + 30 * 60_000,
          email: p.email,
          hint: hasil.password_hint,
        });
        setTahap('approved');
        setTimeout(() => router.replace('/lupa-sandi/baru'), 900);
      } else if (hasil.status === 'rejected') {
        setAlasanTolak(hasil.reject_reason);
        await hapusPermintaanReset();
        setTahap('rejected');
      } else if (hasil.status === 'expired') {
        await hapusPermintaanReset();
        setTahap('expired');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setOffline(true);
      }
      // 429 / 5xx: coba lagi pada tik berikutnya.
    } finally {
      memeriksa.current = false;
    }
  }, []);

  useEffect(() => {
    if (tahap !== 'pending' || !permintaan || !fokus || !aktifApp) {
      return undefined;
    }
    const awal = setTimeout(() => void periksa(permintaan), 0);
    const id = setInterval(() => void periksa(permintaan), INTERVAL_MS);
    return () => {
      clearTimeout(awal);
      clearInterval(id);
    };
  }, [tahap, permintaan, fokus, aktifApp, periksa]);

  const dijeda = tahap === 'pending' && (!aktifApp || offline);

  function ajukanLagi(): void {
    void hapusPermintaanReset();
    router.replace('/lupa-sandi');
  }

  const keMasuk = (): void => router.replace('/masuk');

  const kaki =
    tahap === 'rejected' || tahap === 'expired' || tahap === 'tidak_ada' ? (
      <>
        <Button title="Ajukan lagi" onPress={ajukanLagi} />
        <Button title="Kembali ke halaman masuk" variant="quiet" onPress={keMasuk} />
      </>
    ) : (
      <Button title="Kembali ke halaman masuk" variant="quiet" onPress={keMasuk} />
    );

  const judul =
    tahap === 'approved' ? 'Disetujui' : tahap === 'rejected' ? 'Permintaan ditolak' : tahap === 'expired' || tahap === 'tidak_ada' ? 'Permintaan kedaluwarsa' : 'Menunggu persetujuan HR';

  return (
    <FormScreen title={judul} onBack={keMasuk} footer={tahap === 'approved' ? undefined : kaki}>
      {tahap === 'memuat' ? (
        <View style={{ alignItems: 'center', paddingTop: 48 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {tahap === 'approved' ? (
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 56 }}>
          <IkonStatus icon="circle-check" />
          <Text variant="h2" weight={800} accessibilityRole="header">
            Disetujui HR
          </Text>
          <Text variant="body" tone="muted" align="center">
            Membuka pembuatan kata sandi baru…
          </Text>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {tahap === 'pending' && permintaan ? (
        <>
          {dijeda ? (
            <Banner
              tone="warn"
              icon="wifi-off"
              message={offline ? 'Tidak ada jaringan. Pemeriksaan dijeda dan dilanjutkan otomatis saat tersambung.' : 'Pemeriksaan dijeda selagi aplikasi di latar dan dilanjutkan saat Anda kembali.'}
            />
          ) : null}
          <Banner
            tone="info"
            icon="hourglass"
            title="Menunggu persetujuan HR"
            message={`Permintaan untuk ${permintaan.email} sudah kami terima bila email tersebut terdaftar sebagai karyawan aktif.`}
          />
          <View style={{ gap: 10, paddingHorizontal: 4 }}>
            <Langkah no={1} teks="Hubungi HR agar permintaan Anda segera ditinjau." />
            <Langkah no={2} teks="Biarkan layar ini terbuka. Setelah disetujui, Anda otomatis diarahkan membuat kata sandi baru." />
            <Langkah no={3} teks={`Permintaan berlaku sampai ${tanggalJam(permintaan.kedaluwarsaPada)}.`} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }} accessibilityLiveRegion="polite">
            {dijeda ? <Icon name="pause" size={16} color={colors.muted} /> : <ActivityIndicator size="small" color={colors.muted} />}
            <Text variant="meta">
              {dijeda
                ? `Dijeda${terakhir ? ` · terakhir diperiksa ${jam(terakhir)}` : ''}`
                : `Diperiksa otomatis tiap 5 detik · diajukan ${jam(permintaan.diajukanPada)}`}
            </Text>
          </View>
        </>
      ) : null}

      {tahap === 'rejected' ? (
        <>
          <Banner tone="bad" title="Permintaan ditolak HR" message={alasanTolak ? `Alasan: “${alasanTolak}”` : 'HR menolak permintaan ini.'} />
          <Text variant="meta" style={{ paddingHorizontal: 4 }}>
            Anda bisa mengajukan permintaan baru setelah menghubungi HR.
          </Text>
        </>
      ) : null}

      {tahap === 'expired' || tahap === 'tidak_ada' ? (
        <Banner
          tone="warn"
          icon="timer"
          title="Permintaan kedaluwarsa"
          message="Permintaan tidak diputus dalam 24 jam, atau kata sandi baru tidak dibuat dalam 30 menit setelah disetujui. Ajukan permintaan baru."
        />
      ) : null}
    </FormScreen>
  );
}

function Langkah({ no, teks }: { no: number; teks: string }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text variant="label" tone="muted" style={{ width: 18 }}>
        {no}.
      </Text>
      <Text variant="label" weight={400} style={{ flex: 1, lineHeight: 22 }}>
        {teks}
      </Text>
    </View>
  );
}
