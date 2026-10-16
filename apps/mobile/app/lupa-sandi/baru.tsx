/**
 * Buat kata sandi baru setelah HR menyetujui (mockup 07-lupa-sandi-baru).
 * Setup token sekali pakai, 30 menit; sukses → semua sesi lama dicabut dan
 * sesi baru dibuka (atau tantangan TOTP untuk akun ber-2FA).
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { lupaSandiSelesai } from '@/api/endpoints';
import { adalahTantangan, type SesiDibuka } from '@/api/types';
import { FormScreen, IkonStatus } from '@/features/auth/AuthLayout';
import { bacaSetup, hapusPermintaanReset, simpanSetup } from '@/features/auth/resetRequest';
import { formatMenitDetik, useHitungMundur } from '@/features/auth/util';
import { deviceInfo } from '@/lib/device';
import { useSession } from '@/session/SessionProvider';
import { Banner, Button, Field, Input, Text } from '@/ui';

export default function LayarLupaSandiBaru(): React.JSX.Element | null {
  const { bukaSesi, mulaiTantangan } = useSession();
  const setup = useMemo(() => bacaSetup(), []);
  const [sandi, setSandi] = useState('');
  const [ulang, setUlang] = useState('');
  const [galatSandi, setGalatSandi] = useState<string | null>(null);
  const [galatUlang, setGalatUlang] = useState<string | null>(null);
  const [galat, setGalat] = useState<{ tone: 'bad' | 'warn'; message: string } | null>(null);
  const [kedaluwarsaServer, setKedaluwarsa] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [berhasil, setBerhasil] = useState<SesiDibuka | null>(null);
  const [tanpaSesi, setTanpaSesi] = useState<string | null>(null);
  const sisa = useHitungMundur();
  const kedaluwarsa = kedaluwarsaServer || sisa.habis;

  useEffect(() => {
    if (!setup) {
      router.replace('/lupa-sandi/tunggu');
      return;
    }
    sisa.mulai(Math.max(1, Math.round((setup.kedaluwarsaPada - Date.now()) / 1000)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat dibuka
  }, []);

  if (!setup) {
    return null;
  }

  const hampirHabis = sisa.berjalan && sisa.sisa < 120;
  const batas = new Date(setup.kedaluwarsaPada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');

  async function simpan(): Promise<void> {
    if (sibuk || !setup) {
      return;
    }
    const eSandi = sandi === '' ? 'Kata sandi baru wajib diisi.' : null;
    const eUlang = ulang !== sandi ? 'Konfirmasi kata sandi tidak cocok.' : null;
    setGalatSandi(eSandi);
    setGalatUlang(eUlang);
    setGalat(null);
    if (eSandi || eUlang) {
      return;
    }
    setSibuk(true);
    try {
      const hasil = await lupaSandiSelesai({
        setupToken: setup.setupToken,
        password: sandi,
        passwordConfirmation: ulang,
        device: await deviceInfo(),
      });
      await hapusPermintaanReset();
      simpanSetup(null);
      if (adalahTantangan(hasil)) {
        mulaiTantangan(hasil.challenge_token, hasil.expires_in);
        router.replace('/dua-faktor');
      } else {
        setBerhasil(hasil);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'setup_token_invalid') {
        setKedaluwarsa(true);
      } else if (err instanceof ApiError && err.status === 403 && err.code === 'two_factor_setup_required') {
        await hapusPermintaanReset();
        simpanSetup(null);
        setTanpaSesi(`Kata sandi baru tersimpan. ${err.message} Aktifkan verifikasi dua langkah di RuangKerja web, lalu masuk lagi.`);
      } else if (err instanceof ApiError && err.status === 422) {
        const pesanSandi = err.errors.password?.[0];
        if (pesanSandi) {
          setGalatSandi(pesanSandi);
        } else {
          setGalat({ tone: 'bad', message: err.firstValidationError ?? err.message });
        }
      } else if (err instanceof ApiError && err.status === 429) {
        setGalat({ tone: 'warn', message: 'Terlalu banyak percobaan. Coba lagi dalam satu menit.' });
      } else if (err instanceof ApiError && err.status === 0) {
        setGalat({ tone: 'warn', message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.' });
      } else {
        setGalat({ tone: 'bad', message: err instanceof ApiError ? err.message : 'Gagal menyimpan kata sandi. Coba lagi.' });
      }
    } finally {
      setSibuk(false);
    }
  }

  if (berhasil) {
    return (
      <FormScreen title="Kata sandi baru" hideBack footer={<Button title="Lanjut ke Beranda" onPress={() => void bukaSesi(berhasil)} />}>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 72 }}>
          <IkonStatus icon="circle-check" />
          <Text variant="h2" weight={800} accessibilityRole="header">
            Kata sandi diperbarui
          </Text>
          <Text variant="body" tone="muted" align="center">
            Perangkat lain sudah dikeluarkan. Anda masuk di perangkat ini.
          </Text>
        </View>
      </FormScreen>
    );
  }

  if (tanpaSesi) {
    return (
      <FormScreen title="Kata sandi baru" hideBack footer={<Button title="Kembali ke halaman masuk" onPress={() => router.replace('/masuk')} />}>
        <Banner tone="warn" icon="shield-alert" message={tanpaSesi} />
      </FormScreen>
    );
  }

  if (kedaluwarsa) {
    return (
      <FormScreen
        title="Buat kata sandi baru"
        onBack={() => router.replace('/masuk')}
        footer={
          <>
            <Button
              title="Ajukan lagi"
              onPress={() => {
                void hapusPermintaanReset();
                simpanSetup(null);
                router.replace('/lupa-sandi');
              }}
            />
            <Button title="Kembali ke halaman masuk" variant="quiet" onPress={() => router.replace('/masuk')} />
          </>
        }
      >
        <Banner tone="warn" icon="timer" title="Waktu membuat kata sandi habis" message="Persetujuan HR berlaku 30 menit dan hanya bisa dipakai sekali. Ajukan permintaan baru." />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Buat kata sandi baru"
      onBack={() => router.replace('/masuk')}
      footer={<Button title="Simpan dan masuk" onPress={() => void simpan()} loading={sibuk} loadingTitle="Menyimpan…" disabled={sandi === '' || ulang === ''} />}
    >
      <Banner
        tone={hampirHabis ? 'warn' : 'ok'}
        icon={hampirHabis ? 'timer' : 'circle-check'}
        message={`Disetujui HR. Buat kata sandi baru untuk ${setup.email} sebelum pukul ${batas} · sisa ${formatMenitDetik(sisa.sisa)}.`}
      />

      <Field label="Kata sandi baru" error={galatSandi} hint={galatSandi ? undefined : `${setup.hint ?? 'Bebas, asal bukan kata sandi bawaan perusahaan.'} Semua perangkat lain akan dikeluarkan.`}>
        <Input
          value={sandi}
          onChangeText={(t) => {
            setSandi(t);
            setGalatSandi(null);
          }}
          placeholder="Kata sandi baru"
          secureToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
          invalid={galatSandi !== null}
          accessibilityLabel="Kata sandi baru"
        />
      </Field>

      <Field label="Ulangi kata sandi baru" error={galatUlang}>
        <Input
          value={ulang}
          onChangeText={(t) => {
            setUlang(t);
            setGalatUlang(null);
          }}
          placeholder="Ulangi kata sandi baru"
          secureToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void simpan()}
          invalid={galatUlang !== null}
          accessibilityLabel="Ulangi kata sandi baru"
        />
      </Field>

      {galat ? <Banner tone={galat.tone} message={galat.message} /> : null}
    </FormScreen>
  );
}
