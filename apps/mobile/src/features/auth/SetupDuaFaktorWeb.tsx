/**
 * Akun Super Admin tanpa TOTP terkonfirmasi: server menolak sesi (403
 * `two_factor_setup_required`) sampai 2FA diaktifkan di web. Pesan jujur —
 * aplikasi tidak bisa mengaktifkannya — dengan tautan ke email dan keluar.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { kirimTautanDesktop } from '@/api/endpoints';
import { useSession } from '@/session/SessionProvider';
import { Banner, Button, Card, Text } from '@/ui';

import { FormScreen, IkonStatus } from './AuthLayout';

export function SetupDuaFaktorWeb(): React.JSX.Element {
  const { blokir, keluar } = useSession();
  const [sibuk, setSibuk] = useState(false);
  const [info, setInfo] = useState<{ tone: 'ok' | 'bad' | 'warn'; message: string } | null>(null);

  async function kirimTautan(): Promise<void> {
    if (sibuk) {
      return;
    }
    setSibuk(true);
    setInfo(null);
    try {
      const hasil = await kirimTautanDesktop('/pengaturan/keamanan');
      setInfo({ tone: 'ok', message: hasil.message });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setInfo({ tone: 'warn', message: 'Terlalu banyak permintaan. Coba lagi dalam satu menit.' });
      } else if (err instanceof ApiError && err.status === 0) {
        setInfo({ tone: 'warn', message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.' });
      } else {
        setInfo({ tone: 'bad', message: err instanceof ApiError ? err.message : 'Tautan belum terkirim. Coba lagi.' });
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <FormScreen
      title="Verifikasi dua langkah"
      hideBack
      footer={
        <>
          <Button title="Kirim tautan ke email saya" icon="mail" onPress={() => void kirimTautan()} loading={sibuk} loadingTitle="Mengirim…" />
          <Button title="Keluar" icon="log-out" variant="quiet" onPress={() => void keluar()} />
        </>
      }
    >
      <View style={{ gap: 14, alignItems: 'center', paddingTop: 16 }}>
        <IkonStatus icon="shield-alert" tone="info" />
        <Text variant="h2" weight={800} align="center" accessibilityRole="header">
          Aktifkan verifikasi dua langkah di web
        </Text>
        <Text variant="body" tone="muted" align="center" accessibilityRole="alert">
          {blokir?.message ?? 'Akun ini wajib memakai verifikasi dua langkah.'}
        </Text>
      </View>

      <Card>
        <View style={{ gap: 6 }}>
          <Text variant="label" weight={700}>
            Kenapa?
          </Text>
          <Text variant="label" weight={400} tone="muted" style={{ lineHeight: 22 }}>
            Akun Super Admin wajib kode autentikator (TOTP) setiap masuk. Pengaturannya hanya tersedia di RuangKerja web: buka Pengaturan › Keamanan, aktifkan verifikasi dua langkah, lalu masuk lagi di aplikasi ini.
          </Text>
        </View>
      </Card>

      {info ? <Banner tone={info.tone} message={info.message} /> : null}
    </FormScreen>
  );
}
