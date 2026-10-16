/**
 * Layar Masuk — latar aurora gelap di kedua tema (mockup 02-masuk, 03-masuk-galat).
 * Email + kata sandi; galat: validasi per kolom, 422 generik, batas perangkat,
 * 429 dengan hitung mundur, jaringan, 5xx. Kartu "Lanjutkan permintaan" bila
 * ada permintaan lupa-sandi yang masih berjalan.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, TextInput, View } from 'react-native';

import { ApiError, APP_VERSION, webBase } from '@/api/client';
import { AuroraScreen, GalatKolom, LogoRuangKerja, useKeyboardTerbuka } from '@/features/auth/AuthLayout';
import { bacaPermintaanReset, type PermintaanReset } from '@/features/auth/resetRequest';
import { REGEX_EMAIL, detikTunggu, formatMenitDetik, useHitungMundur } from '@/features/auth/util';
import { useSession } from '@/session/SessionProvider';
import { radius, useTheme } from '@/theme';
import { Banner, Button, Field, Icon, Input, Pressable, Text, type BannerProps } from '@/ui';

interface Galat {
  tone: BannerProps['tone'];
  icon?: BannerProps['icon'];
  message: string;
  /** Tampilkan tautan "Lupa kata sandi" di banner. */
  lupa?: boolean;
}

export default function LayarMasuk(): React.JSX.Element {
  const { colors } = useTheme();
  const { masuk, alasanKeluar, hapusAlasanKeluar } = useSession();
  const kibor = useKeyboardTerbuka();
  const sandiRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galatEmail, setGalatEmail] = useState<string | null>(null);
  const [galatSandi, setGalatSandi] = useState<string | null>(null);
  const [galat, setGalat] = useState<Galat | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [permintaan, setPermintaan] = useState<PermintaanReset | null>(null);
  const tunggu = useHitungMundur();

  useFocusEffect(
    useCallback(() => {
      let batal = false;
      void bacaPermintaanReset().then((p) => {
        if (!batal) {
          setPermintaan(p);
        }
      });
      return () => {
        batal = true;
      };
    }, []),
  );

  async function kirim(): Promise<void> {
    if (sibuk || tunggu.berjalan) {
      return;
    }
    const alamat = email.trim();
    const eEmail = alamat === '' ? 'Email wajib diisi.' : !REGEX_EMAIL.test(alamat) ? 'Format email tidak valid.' : null;
    const eSandi = sandi === '' ? 'Kata sandi wajib diisi.' : null;
    setGalatEmail(eEmail);
    setGalatSandi(eSandi);
    setGalat(null);
    if (eEmail || eSandi) {
      return;
    }

    hapusAlasanKeluar();
    setSibuk(true);
    try {
      // Stack.Protected di _layout membawa ke beranda begitu sesi aktif.
      const hasil = await masuk(alamat.toLowerCase(), sandi);
      if (hasil.kind === 'dua_faktor') {
        router.push('/dua-faktor');
      }
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setGalat({ tone: 'warn', icon: 'wifi-off', message: 'Tidak dapat masuk. Periksa koneksi Anda lalu coba lagi.' });
      } else if (err.status === 0) {
        setGalat({ tone: 'warn', icon: 'wifi-off', message: 'Tidak dapat masuk. Periksa koneksi Anda lalu coba lagi.' });
      } else if (err.status === 429) {
        const detik = detikTunggu(err);
        tunggu.mulai(detik);
        setGalat({ tone: 'warn', icon: 'timer', message: 'Terlalu banyak percobaan masuk.' });
      } else if (err.status === 422 && err.errors.device) {
        setGalat({ tone: 'warn', icon: 'smartphone', message: err.errors.device[0] ?? err.message });
      } else if (err.status === 422) {
        setGalatEmail(null);
        setSandi('');
        setGalat({ tone: 'bad', message: err.firstValidationError ?? err.message, lupa: true });
        setTimeout(() => sandiRef.current?.focus(), 50);
      } else if (err.status === 403) {
        const setup = err.code === 'two_factor_setup_required';
        setGalat({
          tone: 'warn',
          icon: 'shield-alert',
          message: setup ? `${err.message} Aktifkan verifikasi dua langkah di RuangKerja web, lalu masuk lagi.` : err.message,
        });
      } else if (err.status >= 500 && err.code !== 'maintenance') {
        setGalat({ tone: 'bad', message: `Terjadi gangguan di server. Coba lagi sebentar lagi. Kode: ${err.status}` });
      } else if (err.status !== 503 && err.status !== 426) {
        setGalat({ tone: 'bad', message: err.message });
      }
    } finally {
      setSibuk(false);
    }
  }

  const adaGalatKolom = galatEmail !== null || galatSandi !== null;
  const judulTombol = tunggu.berjalan ? `Coba lagi dalam ${formatMenitDetik(tunggu.sisa)}` : 'Masuk';

  return (
    <AuroraScreen>
      {kibor ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <LogoRuangKerja ukuran={44} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" style={{ color: colors.muted }}>
              RuangKerja · SPKD
            </Text>
            <Text variant="h2" weight={800} accessibilityRole="header">
              Selamat datang kembali
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <LogoRuangKerja ukuran={56} />
          <Text variant="body" tone="muted" weight={600}>
            RuangKerja · SPKD
          </Text>
          <Text variant="h1" weight={800} accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40 }}>
            Selamat datang kembali
          </Text>
          <Text variant="body" tone="muted">
            Absen, kerja, dan pantau proyek dalam satu tempat. Masuk dengan email kantor dan kata sandi Anda.
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }} />

      <View style={{ gap: 14 }}>
        {alasanKeluar ? (
          <Banner
            tone={alasanKeluar.jenis === 'akun_nonaktif' ? 'bad' : 'info'}
            icon={alasanKeluar.jenis === 'akun_nonaktif' ? 'user-x' : 'info'}
            message={alasanKeluar.jenis === 'akun_nonaktif' ? `${alasanKeluar.message} Hubungi HR bila ini keliru.` : alasanKeluar.message}
          />
        ) : null}

        {permintaan && !kibor ? <KartuLanjutkan permintaan={permintaan} /> : null}

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
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => sandiRef.current?.focus()}
            leftIcon="mail"
            invalid={galatEmail !== null || galat?.tone === 'bad'}
            accessibilityLabel="Email kantor"
          />
        </Field>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="label">Kata sandi</Text>
            <Pressable onPress={() => router.push('/lupa-sandi')} accessibilityRole="link" accessibilityLabel="Lupa kata sandi" hitSlop={10}>
              <Text variant="label" tone="link" weight={600}>
                Lupa kata sandi?
              </Text>
            </Pressable>
          </View>
          <Input
            ref={sandiRef}
            value={sandi}
            onChangeText={(t) => {
              setSandi(t);
              setGalatSandi(null);
            }}
            placeholder="Kata sandi"
            secureToggle
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void kirim()}
            leftIcon="lock"
            invalid={galatSandi !== null || galat?.tone === 'bad'}
            accessibilityLabel="Kata sandi"
          />
          {galatSandi ? <GalatKolom message={galatSandi} /> : null}
        </View>

        {galat ? (
          <Banner
            tone={galat.tone}
            icon={galat.icon}
            message={
              galat.icon === 'timer' && tunggu.berjalan
                ? `${galat.message} Coba lagi dalam ${formatMenitDetik(tunggu.sisa)}.`
                : galat.lupa
                  ? `${galat.message} Belum punya kata sandi? Hubungi HR atau pakai Lupa kata sandi.`
                  : galat.message
            }
            actionLabel={galat.lupa ? 'Lupa kata sandi' : undefined}
            onAction={galat.lupa ? () => router.push('/lupa-sandi') : undefined}
          />
        ) : null}

        <Button
          title={judulTombol}
          icon={tunggu.berjalan ? 'timer' : 'log-in'}
          onPress={() => void kirim()}
          loading={sibuk}
          loadingTitle="Memeriksa…"
          disabled={tunggu.berjalan}
          variant={tunggu.berjalan ? 'secondary' : 'primary'}
          accessibilityHint={adaGalatKolom ? 'Periksa kolom yang bertanda galat' : undefined}
        />

        <View style={{ alignItems: 'center', gap: 2, marginTop: 4 }}>
          <Pressable onPress={() => void Linking.openURL(`${webBase()}/kebijakan-privasi`)} accessibilityRole="link" hitSlop={10} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text variant="label" tone="link" weight={600}>
              Kebijakan privasi
            </Text>
          </Pressable>
          <Text variant="meta" tone="muted">
            RuangKerja v{APP_VERSION}
          </Text>
        </View>
      </View>
    </AuroraScreen>
  );
}

function KartuLanjutkan({ permintaan }: { permintaan: PermintaanReset }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/lupa-sandi/tunggu')}
      accessibilityRole="button"
      accessibilityLabel="Lanjutkan permintaan reset kata sandi, lihat status"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <Icon name="hourglass" size={22} color={colors.info} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" weight={700}>
          Permintaan reset menunggu HR
        </Text>
        <Text variant="meta">
          Diajukan {new Date(permintaan.diajukanPada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.')} · berlaku sampai{' '}
          {new Date(permintaan.kedaluwarsaPada).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.')}
        </Text>
      </View>
      <Text variant="label" tone="link" weight={700}>
        Lihat status
      </Text>
    </Pressable>
  );
}
