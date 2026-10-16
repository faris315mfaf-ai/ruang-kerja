/**
 * Ubah kata sandi (`POST /auth/sandi`). Keadaan: kosong, fokus, galat validasi,
 * sandi lama salah, memuat, sukses (snackbar). Aturan karyawan bebas; Super
 * Admin minimal 8 karakter dan bukan alamat email. Perangkat lain dikeluarkan
 * server; perangkat ini tetap masuk.
 * Mockup: docs/mockups/android/screens/01-akses-akun/17-ganti-kata-sandi.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { ubahSandi } from '@/api/akun';
import { ApiError } from '@/api/client';
import { useProfilLengkap } from '@/features/settings/useProfilLengkap';
import { useSession } from '@/session/SessionProvider';
import { Button, Field, Input, Screen, SubAppBar, Text, useSnackbar } from '@/ui';

interface Galat {
  lama?: string;
  baru?: string;
  konfirmasi?: string;
  umum?: string;
}

export default function LayarUbahSandi(): React.JSX.Element {
  const { peran, profil } = useProfilLengkap();
  const { perbaruiProfil } = useSession();
  const snackbar = useSnackbar();

  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [galat, setGalat] = useState<Galat>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const refLama = useRef<TextInput>(null);
  const refBaru = useRef<TextInput>(null);
  const refKonfirmasi = useRef<TextInput>(null);

  const aturan = peran.admin
    ? 'Minimal 8 karakter dan tidak sama dengan alamat email.'
    : 'Bebas, asal bukan kata sandi bawaan perusahaan.';

  const simpan = async (): Promise<void> => {
    const g: Galat = {};
    if (lama === '') {
      g.lama = 'Kata sandi saat ini wajib diisi.';
    }
    if (baru === '') {
      g.baru = 'Kata sandi baru wajib diisi.';
    } else if (peran.admin && (baru.length < 8 || baru.toLowerCase() === profil.email.toLowerCase())) {
      g.baru = 'Kata sandi baru minimal 8 karakter dan tidak boleh sama dengan alamat email.';
    } else if (baru === lama) {
      g.baru = 'Kata sandi baru harus berbeda dari kata sandi saat ini.';
    }
    if (konfirmasi !== baru) {
      g.konfirmasi = 'Konfirmasi kata sandi tidak cocok.';
    }
    if (g.lama || g.baru || g.konfirmasi) {
      setGalat(g);
      (g.lama ? refLama : g.baru ? refBaru : refKonfirmasi).current?.focus();
      return;
    }

    setGalat({});
    setMenyimpan(true);
    try {
      const hasil = await ubahSandi({ current_password: lama, password: baru, password_confirmation: konfirmasi });
      perbaruiProfil(hasil.user);
      setLama('');
      setBaru('');
      setKonfirmasi('');
      snackbar.show({ message: 'Kata sandi diperbarui. Perangkat lain sudah dikeluarkan.', variant: 'ok', anchor: 'bottom' });
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const baruSalah = err.errors.password?.[0];
        const lamaSalah = err.errors.current_password?.[0];
        setGalat({
          lama: lamaSalah,
          baru: baruSalah,
          konfirmasi: err.errors.password_confirmation?.[0],
          umum: lamaSalah || baruSalah ? undefined : err.message,
        });
        (lamaSalah ? refLama : refBaru).current?.focus();
      } else if (err instanceof ApiError && err.status === 0) {
        setGalat({ umum: 'Tidak ada koneksi. Kata sandi belum diubah.' });
      } else {
        setGalat({ umum: err instanceof ApiError ? err.message : 'Kata sandi gagal diubah. Coba lagi.' });
      }
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Screen
      header={<SubAppBar title="Ubah kata sandi" />}
      footer={<Button title="Simpan kata sandi" loadingTitle="Menyimpan…" loading={menyimpan} onPress={() => void simpan()} style={{ flex: 1 }} />}
    >
      <Text variant="body" tone="muted">
        {aturan} Setelah disimpan, semua perangkat lain otomatis keluar.
      </Text>

      <View style={{ gap: 16 }}>
        <Field label="Kata sandi saat ini" error={galat.lama}>
          <Input
            ref={refLama}
            value={lama}
            onChangeText={(t) => {
              setLama(t);
              if (galat.lama) setGalat((x) => ({ ...x, lama: undefined }));
            }}
            placeholder="Kata sandi saat ini"
            secureTextEntry
            secureToggle
            invalid={!!galat.lama}
            disabled={menyimpan}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => refBaru.current?.focus()}
            accessibilityLabel="Kata sandi saat ini"
          />
        </Field>
        <Field label="Kata sandi baru" error={galat.baru}>
          <Input
            ref={refBaru}
            value={baru}
            onChangeText={(t) => {
              setBaru(t);
              if (galat.baru) setGalat((x) => ({ ...x, baru: undefined }));
            }}
            placeholder="Kata sandi baru"
            secureTextEntry
            secureToggle
            invalid={!!galat.baru}
            disabled={menyimpan}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => refKonfirmasi.current?.focus()}
            accessibilityLabel="Kata sandi baru"
          />
        </Field>
        <Field label="Konfirmasi kata sandi" error={galat.konfirmasi}>
          <Input
            ref={refKonfirmasi}
            value={konfirmasi}
            onChangeText={(t) => {
              setKonfirmasi(t);
              if (galat.konfirmasi) setGalat((x) => ({ ...x, konfirmasi: undefined }));
            }}
            placeholder="Ulangi kata sandi baru"
            secureTextEntry
            secureToggle
            invalid={!!galat.konfirmasi}
            disabled={menyimpan}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => void simpan()}
            accessibilityLabel="Konfirmasi kata sandi"
          />
        </Field>
        {galat.umum ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {galat.umum}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
