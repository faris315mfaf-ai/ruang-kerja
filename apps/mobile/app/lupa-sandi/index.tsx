/**
 * Lupa kata sandi — minta reset ke HR (mockup 05-lupa-sandi-minta).
 * Tidak ada tautan email: HR menyetujui dari Admin › Karyawan.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { lupaSandiMinta } from '@/api/endpoints';
import { FormScreen } from '@/features/auth/AuthLayout';
import { bacaPermintaanReset, simpanPermintaanReset, type PermintaanReset } from '@/features/auth/resetRequest';
import { REGEX_EMAIL, detikTunggu, formatMenitDetik, useHitungMundur } from '@/features/auth/util';
import { Banner, Button, Field, Input } from '@/ui';

export default function LayarLupaSandiMinta(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [galatEmail, setGalatEmail] = useState<string | null>(null);
  const [galat, setGalat] = useState<{ tone: 'warn' | 'bad'; icon?: 'wifi-off'; message: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [berjalan, setBerjalan] = useState<PermintaanReset | null>(null);
  const tunggu = useHitungMundur();

  useFocusEffect(
    useCallback(() => {
      let batal = false;
      void bacaPermintaanReset().then((p) => {
        if (!batal) {
          setBerjalan(p);
        }
      });
      return () => {
        batal = true;
      };
    }, []),
  );

  function kembali(): void {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/masuk');
    }
  }

  async function kirim(): Promise<void> {
    if (sibuk || tunggu.berjalan) {
      return;
    }
    const alamat = email.trim().toLowerCase();
    const e = alamat === '' ? 'Email wajib diisi.' : !REGEX_EMAIL.test(alamat) ? 'Format email tidak valid.' : null;
    setGalatEmail(e);
    setGalat(null);
    if (e) {
      return;
    }
    setSibuk(true);
    try {
      const hasil = await lupaSandiMinta(alamat);
      const sekarang = Date.now();
      const kedaluwarsa = Date.parse(hasil.expires_at);
      await simpanPermintaanReset({
        token: hasil.request_token,
        email: alamat,
        kedaluwarsaPada: Number.isFinite(kedaluwarsa) ? kedaluwarsa : sekarang + 24 * 3600_000,
        diajukanPada: sekarang,
      });
      router.replace('/lupa-sandi/tunggu');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        tunggu.mulai(detikTunggu(err));
        setGalat({ tone: 'warn', message: 'Terlalu banyak permintaan.' });
      } else if (err instanceof ApiError && err.status === 422) {
        setGalatEmail(err.errors.email?.[0] ?? err.firstValidationError ?? 'Format email tidak valid.');
      } else if (err instanceof ApiError && err.status === 0) {
        setGalat({ tone: 'warn', icon: 'wifi-off', message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.' });
      } else if (err instanceof ApiError && err.status >= 500) {
        setGalat({ tone: 'bad', message: `Terjadi gangguan di server. Coba lagi sebentar lagi. Kode: ${err.status}` });
      } else if (err instanceof ApiError && err.status !== 503 && err.status !== 426) {
        setGalat({ tone: 'bad', message: err.message });
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <FormScreen
      title="Lupa kata sandi"
      onBack={kembali}
      footer={
        <>
          <Button
            title="Minta reset ke HR"
            onPress={() => void kirim()}
            loading={sibuk}
            loadingTitle="Mengirim…"
            disabled={tunggu.berjalan || email.trim() === ''}
          />
          <Button title="Kembali ke halaman masuk" variant="quiet" onPress={() => router.replace('/masuk')} />
        </>
      }
    >
      <Banner
        tone="info"
        icon="shield-check"
        message="Permintaan Anda ditinjau HR. Biarkan layar berikutnya tetap terbuka: setelah disetujui, Anda langsung diarahkan membuat kata sandi baru."
      />

      {berjalan ? (
        <Banner
          tone="neutral"
          icon="hourglass"
          title="Permintaan sebelumnya masih berjalan"
          message={`Untuk ${berjalan.email}. Lihat statusnya, atau ajukan permintaan baru di bawah.`}
          actionLabel="Lihat status"
          onAction={() => router.replace('/lupa-sandi/tunggu')}
        />
      ) : null}

      <Field label="Email kantor" error={galatEmail}>
        <Input
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setGalatEmail(null);
          }}
          placeholder="nama@spkd.store"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={() => void kirim()}
          leftIcon="mail"
          invalid={galatEmail !== null}
          accessibilityLabel="Email kantor"
        />
      </Field>

      {galat ? (
        <View>
          <Banner
            tone={galat.tone}
            icon={tunggu.berjalan ? 'timer' : galat.icon}
            message={tunggu.berjalan ? `${galat.message} Coba lagi dalam ${formatMenitDetik(tunggu.sisa)}.` : galat.message}
          />
        </View>
      ) : null}
    </FormScreen>
  );
}
