/**
 * Ganti kata sandi wajib (mockup 04-blokir-akun layar 2–3). Menggantikan
 * navigator selama server menjawab 403 `password_change_required`; tanpa
 * tombol kembali — hanya simpan atau keluar. POST /auth/sandi.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { gantiSandi } from '@/api/endpoints';
import { useSession } from '@/session/SessionProvider';
import { Banner, Button, Field, Input, Text } from '@/ui';

import { FormScreen, IkonStatus } from './AuthLayout';

export function GantiSandiWajib(): React.JSX.Element {
  const { user, keluar, sandiDiganti } = useSession();
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [eLama, setELama] = useState<string | null>(null);
  const [eBaru, setEBaru] = useState<string | null>(null);
  const [eUlang, setEUlang] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan(): Promise<void> {
    if (sibuk) {
      return;
    }
    const a = lama === '' ? 'Kata sandi saat ini wajib diisi.' : null;
    const b = baru === '' ? 'Kata sandi baru wajib diisi.' : null;
    const c = !b && ulang !== baru ? 'Konfirmasi kata sandi tidak cocok.' : null;
    setELama(a);
    setEBaru(b);
    setEUlang(c);
    setGalat(null);
    if (a || b || c) {
      return;
    }
    setSibuk(true);
    try {
      const hasil = await gantiSandi({ currentPassword: lama, password: baru, passwordConfirmation: ulang });
      sandiDiganti(hasil.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setELama(err.errors.current_password?.[0] ?? null);
        setEBaru(err.errors.password?.[0] ?? null);
        if (!err.errors.current_password && !err.errors.password) {
          setGalat(err.firstValidationError ?? err.message);
        }
      } else if (err instanceof ApiError && err.status === 0) {
        setGalat('Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.');
      } else if (err instanceof ApiError && err.status === 429) {
        setGalat('Terlalu banyak percobaan. Coba lagi dalam satu menit.');
      } else {
        setGalat(err instanceof ApiError ? err.message : 'Gagal menyimpan kata sandi. Coba lagi.');
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <FormScreen
      title="Ganti kata sandi"
      hideBack
      footer={
        <>
          <Button title="Simpan & lanjutkan" onPress={() => void simpan()} loading={sibuk} loadingTitle="Menyimpan…" disabled={lama === '' || baru === '' || ulang === ''} />
          <Button title="Keluar" icon="log-out" variant="quiet" onPress={() => void keluar()} />
        </>
      }
    >
      <View style={{ gap: 14 }}>
        <IkonStatus icon="key-round" tone="warning" />
        <Text variant="h1" weight={800} accessibilityRole="header">
          Buat kata sandi Anda sendiri
        </Text>
      </View>

      <Banner
        tone="warn"
        message="Akun Anda masih memakai kata sandi bawaan atau kata sandi dari HR. Buat kata sandi sendiri untuk melanjutkan ke aplikasi."
      />

      <Field label="Kata sandi saat ini (dari HR)" error={eLama}>
        <Input
          value={lama}
          onChangeText={(t) => {
            setLama(t);
            setELama(null);
          }}
          placeholder="Kata sandi saat ini"
          secureToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          leftIcon="lock"
          invalid={eLama !== null}
          accessibilityLabel="Kata sandi saat ini"
        />
      </Field>

      <Field
        label="Kata sandi baru"
        error={eBaru}
        hint={eBaru ? undefined : `${user?.password_hint ?? 'Bebas, asal bukan kata sandi bawaan perusahaan.'} Setelah disimpan, perangkat lain otomatis keluar.`}
      >
        <Input
          value={baru}
          onChangeText={(t) => {
            setBaru(t);
            setEBaru(null);
          }}
          placeholder="Kata sandi baru"
          secureToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          leftIcon="lock"
          invalid={eBaru !== null}
          accessibilityLabel="Kata sandi baru"
        />
      </Field>

      <Field label="Konfirmasi kata sandi" error={eUlang}>
        <Input
          value={ulang}
          onChangeText={(t) => {
            setUlang(t);
            setEUlang(null);
          }}
          placeholder="Ulangi kata sandi baru"
          secureToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void simpan()}
          leftIcon="lock"
          invalid={eUlang !== null}
          accessibilityLabel="Konfirmasi kata sandi"
        />
      </Field>

      {galat ? <Banner tone="bad" message={galat} /> : null}
    </FormScreen>
  );
}
