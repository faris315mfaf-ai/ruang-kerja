/**
 * Tantangan TOTP (Super Admin / akun ber-2FA) — mockup 04-blokir-akun layar 5.
 * Kode 6 digit dari aplikasi autentikator atau kode pemulihan; tantangan
 * berlaku 5 menit dan mati setelah 5 kode salah.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { FormScreen, IkonStatus } from '@/features/auth/AuthLayout';
import { OtpInput } from '@/features/auth/OtpInput';
import { formatMenitDetik, useHitungMundur } from '@/features/auth/util';
import { useSession } from '@/session/SessionProvider';
import { Banner, Button, Field, Input, Pressable, Text } from '@/ui';

export default function LayarDuaFaktor(): React.JSX.Element | null {
  const { status, tantangan, batalkanTantangan, verifikasiDuaFaktor } = useSession();
  const [pemulihan, setPemulihan] = useState(false);
  const [kode, setKode] = useState('');
  const [kodePemulihan, setKodePemulihan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [kedaluwarsaServer, setKedaluwarsa] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const tahan = useHitungMundur();
  const sisaTantangan = useHitungMundur();
  const kedaluwarsa = kedaluwarsaServer || sisaTantangan.habis;

  useEffect(() => {
    if (tantangan) {
      sisaTantangan.mulai(Math.max(1, Math.round((tantangan.kedaluwarsaPada - Date.now()) / 1000)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat tantangan berganti
  }, [tantangan?.token]);

  useEffect(() => {
    if (!tantangan && status !== 'masuk') {
      router.replace('/masuk');
    }
  }, [tantangan, status]);

  function kembaliKeMasuk(): void {
    batalkanTantangan();
    router.replace('/masuk');
  }

  async function kirim(nilai?: string): Promise<void> {
    if (sibuk || tahan.berjalan || kedaluwarsa) {
      return;
    }
    const input = pemulihan ? { recoveryCode: kodePemulihan.trim() } : { code: nilai ?? kode };
    if ((pemulihan && input.recoveryCode === '') || (!pemulihan && (input.code ?? '').length < 6)) {
      setGalat(pemulihan ? 'Masukkan kode pemulihan.' : 'Masukkan 6 digit kode autentikator.');
      return;
    }
    setGalat(null);
    setSibuk(true);
    try {
      await verifikasiDuaFaktor(input);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'challenge_expired') {
        setKedaluwarsa(true);
      } else if (err instanceof ApiError && err.status === 429) {
        tahan.mulai(err.retryAfter ?? 60);
        setGalat('Terlalu banyak percobaan kode. Tunggu satu menit lalu coba lagi.');
      } else if (err instanceof ApiError && err.status === 0) {
        setGalat('Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.');
      } else if (err instanceof ApiError) {
        setGalat(err.firstValidationError ?? err.message);
        setKode('');
      } else {
        setGalat('Verifikasi gagal. Coba lagi.');
      }
    } finally {
      setSibuk(false);
    }
  }

  if (!tantangan) {
    return null;
  }

  const penuh = pemulihan ? kodePemulihan.trim().length > 0 : kode.length === 6;

  return (
    <FormScreen
      title="Verifikasi dua langkah"
      onBack={kembaliKeMasuk}
      footer={
        kedaluwarsa ? (
          <Button title="Kembali ke halaman masuk" icon="log-in" onPress={kembaliKeMasuk} />
        ) : (
          <Button
            title={tahan.berjalan ? `Coba lagi dalam ${formatMenitDetik(tahan.sisa)}` : 'Verifikasi'}
            onPress={() => void kirim()}
            loading={sibuk}
            loadingTitle="Memeriksa…"
            disabled={!penuh || tahan.berjalan}
          />
        )
      }
    >
      <View style={{ gap: 16, alignItems: 'center', paddingTop: 8 }}>
        <IkonStatus icon="shield-check" tone="info" />
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Text variant="h1" weight={800} align="center" accessibilityRole="header">
            {pemulihan ? 'Kode pemulihan' : 'Kode autentikasi'}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {pemulihan
              ? 'Masukkan salah satu kode pemulihan yang Anda simpan saat mengaktifkan verifikasi dua langkah. Kode hanya berlaku sekali.'
              : 'Masukkan 6 digit kode dari aplikasi autentikator Anda.'}
          </Text>
        </View>
      </View>

      {kedaluwarsa ? (
        <Banner tone="warn" icon="timer" title="Waktu verifikasi habis" message="Tantangan berlaku 5 menit dan hanya bisa dicoba 5 kali. Masuk ulang dari awal untuk melanjutkan." />
      ) : (
        <View style={{ gap: 14 }}>
          {pemulihan ? (
            <Field label="Kode pemulihan" error={galat}>
              <Input
                value={kodePemulihan}
                onChangeText={(t) => {
                  setKodePemulihan(t);
                  setGalat(null);
                }}
                placeholder="xxxx-xxxx"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                invalid={galat !== null}
                editable={!tahan.berjalan}
                returnKeyType="go"
                onSubmitEditing={() => void kirim()}
                accessibilityLabel="Kode pemulihan"
              />
            </Field>
          ) : (
            <View style={{ gap: 10 }}>
              <OtpInput
                value={kode}
                onChange={(t) => {
                  setKode(t);
                  setGalat(null);
                }}
                onComplete={(k) => void kirim(k)}
                invalid={galat !== null}
                disabled={sibuk || tahan.berjalan}
              />
              {galat ? (
                <Text variant="meta" tone="danger" align="center" accessibilityRole="alert">
                  {galat}
                </Text>
              ) : null}
            </View>
          )}

          <Pressable
            onPress={() => {
              setPemulihan((v) => !v);
              setGalat(null);
              setKode('');
              setKodePemulihan('');
            }}
            accessibilityRole="button"
            style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="label" tone="link" weight={600}>
              {pemulihan ? 'Pakai kode autentikator' : 'Pakai kode pemulihan'}
            </Text>
          </Pressable>

          {sisaTantangan.berjalan ? (
            <Text variant="meta" align="center">
              Berlaku {formatMenitDetik(sisaTantangan.sisa)} lagi
            </Text>
          ) : null}
        </View>
      )}
    </FormScreen>
  );
}
