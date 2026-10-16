/**
 * Kata sandi & keamanan — hub: Ubah kata sandi, Buka dengan sidik jari
 * (sakelar kunci aplikasi), Kunci aplikasi (batas waktu), 2FA (info; kelola
 * di desktop), dan Perangkat saya.
 * Mockup: docs/mockups/android/screens/01-akses-akun/16-keamanan, 08-biometrik-aktifkan.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { BATAS_PERANGKAT, daftarPerangkat } from '@/api/perangkat';
import { bukaSetelanKeamanan, lockAfterLabel, useAppLock, type AlasanGagal } from '@/features/auth/appLock';
import { DaftarMenu, GroupLabel, type ItemMenu } from '@/features/settings/parts';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { useProfilLengkap } from '@/features/settings/useProfilLengkap';
import { Badge, Banner, Button, Card, DesktopOnlyBanner, ListRow, Screen, SubAppBar, Switch, useDialog, useSnackbar } from '@/ui';

export default function LayarKeamanan(): React.JSX.Element {
  const { peran, profil } = useProfilLengkap();
  const kunci = useAppLock();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { kirim } = useKirimTautan();
  const [jumlahPerangkat, setJumlahPerangkat] = useState<number | null>(null);
  const [sibukKunci, setSibukKunci] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void kunci.segarkanDukungan();
      daftarPerangkat()
        .then((r) => setJumlahPerangkat(r.devices.length))
        .catch((err: unknown) => {
          if (!(err instanceof ApiError)) {
            setJumlahPerangkat(null);
          }
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- segarkanDukungan stabil
    }, []),
  );

  const tanganiGagal = async (alasan: AlasanGagal): Promise<void> => {
    switch (alasan) {
      case 'cancel':
        return;
      case 'not_enrolled': {
        const buka = await dialog.confirm({
          title: 'Belum ada sidik jari di perangkat ini',
          message: 'Tambahkan sidik jari atau kunci layar di Setelan Android, lalu coba aktifkan lagi.',
          confirmLabel: 'Buka Setelan',
          cancelLabel: 'Nanti',
        });
        if (buka) {
          await bukaSetelanKeamanan();
        }
        return;
      }
      case 'unavailable':
        await dialog.alert({
          title: 'Belum bisa diaktifkan',
          message: 'Perangkat ini tidak punya sensor biometrik atau kunci layar. Setel kunci layar (PIN, pola, atau sandi) di Setelan Android agar bisa mengunci RuangKerja.',
        });
        return;
      case 'lockout':
      case 'lockout_permanent':
        snackbar.show({ message: 'Sensor sidik jari dikunci sementara. Coba lagi beberapa saat lagi.', variant: 'warn' });
        return;
      default:
        snackbar.show({ message: 'Sidik jari tidak cocok. Coba lagi.', variant: 'bad' });
    }
  };

  const ubahSakelar = async (nilai: boolean): Promise<void> => {
    if (sibukKunci) {
      return;
    }
    setSibukKunci(true);
    try {
      if (nilai) {
        const hasil = await kunci.setEnabled(true);
        if (hasil.ok) {
          snackbar.show({ message: 'Buka dengan sidik jari aktif di perangkat ini', variant: 'ok' });
        } else {
          await tanganiGagal(hasil.reason);
        }
      } else {
        const matikan = await dialog.confirm({
          title: 'Matikan buka dengan sidik jari?',
          message: 'Aplikasi tidak lagi meminta sidik jari saat dibuka di perangkat ini. Sesi Anda tetap aktif.',
          confirmLabel: 'Matikan',
          cancelLabel: 'Batal',
          destructive: true,
        });
        if (matikan) {
          await kunci.setEnabled(false);
        }
      }
    } finally {
      setSibukKunci(false);
    }
  };

  const tidakDidukung = kunci.ready && !kunci.supported && !kunci.enabled;
  const subjudulSidikJari = tidakDidukung
    ? kunci.support === 'not_enrolled'
      ? 'Belum ada sidik jari atau kunci layar di perangkat ini'
      : 'Perangkat ini tidak punya sensor biometrik atau kunci layar'
    : kunci.enabled
      ? 'Aktif di perangkat ini'
      : 'Tidak perlu mengetik kata sandi tiap aplikasi dibuka';

  const tampilDuaFaktor = peran.admin || profil.dua2fa;

  const masuk: ItemMenu[] = [
    {
      kunci: 'sandi',
      judul: 'Ubah kata sandi',
      subjudul: 'Perangkat lain otomatis keluar',
      ikon: 'key-round',
      onPress: () => router.push('/pengaturan/sandi' as never),
    },
  ];

  const perangkat: ItemMenu[] = [
    {
      kunci: 'perangkat',
      judul: 'Perangkat saya',
      subjudul: jumlahPerangkat === null ? 'Perangkat yang masuk ke akun Anda' : `${jumlahPerangkat} dari ${BATAS_PERANGKAT} perangkat masuk`,
      ikon: 'smartphone',
      onPress: () => router.push('/pengaturan/perangkat' as never),
    },
  ];

  return (
    <Screen header={<SubAppBar title="Kata sandi & keamanan" />}>
      <Banner tone="ok" icon="shield-check" title="Akun Anda aman." message="Hanya Anda yang tahu kata sandi ini. HR tidak bisa melihatnya." />

      <View style={{ gap: 8 }}>
        <GroupLabel>Masuk</GroupLabel>
        <Card variant="flat">
          <DaftarMenuBaris items={masuk} />
          <ListRow
            divider
            icon="fingerprint"
            title="Buka dengan sidik jari"
            subtitle={subjudulSidikJari}
            trailing={
              <Switch
                value={kunci.enabled}
                onValueChange={(v) => void ubahSakelar(v)}
                label="Buka dengan sidik jari"
                disabled={sibukKunci || !kunci.ready || tidakDidukung}
              />
            }
          />
          <ListRow
            divider
            icon="lock"
            title="Kunci aplikasi"
            subtitle={kunci.enabled ? `Setelah ${kunci.lockAfter === 0 ? 'segera' : lockAfterLabel(kunci.lockAfter)}` : 'Aktifkan buka dengan sidik jari lebih dulu'}
            onPress={kunci.enabled ? () => router.push('/pengaturan/kunci' as never) : undefined}
            trailing={kunci.enabled ? undefined : <Badge tone="neutral" dot={false}>Nonaktif</Badge>}
          />
        </Card>
        {tidakDidukung ? (
          <Button
            title="Buka Setelan Keamanan"
            variant="outline"
            icon="settings"
            onPress={() => void bukaSetelanKeamanan()}
          />
        ) : null}
      </View>

      {tampilDuaFaktor ? (
        <View style={{ gap: 8 }}>
          <GroupLabel>Autentikasi dua faktor</GroupLabel>
          <Card variant="flat">
            <ListRow
              icon="shield-check"
              iconTone={profil.dua2fa ? 'ok' : 'warn'}
              title={profil.dua2fa ? 'TOTP aktif' : 'TOTP belum aktif'}
              subtitle="Wajib untuk Super Admin"
              trailing={<Badge tone={profil.dua2fa ? 'success' : 'warning'}>{profil.dua2fa ? 'Aktif' : 'Belum'}</Badge>}
            />
          </Card>
          <DesktopOnlyBanner
            message="Kelola 2FA (kode pemulihan, ganti perangkat autentikator) tersedia di desktop."
            onSendLink={() => void kirim('/pengaturan/keamanan')}
          />
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <GroupLabel>Perangkat</GroupLabel>
        <DaftarMenu items={perangkat} />
      </View>
    </Screen>
  );
}

/** Baris menu tanpa kartu pembungkus (dipakai di dalam kartu bersama sakelar). */
function DaftarMenuBaris({ items }: { items: ItemMenu[] }): React.JSX.Element {
  return (
    <>
      {items.map((item) => (
        <ListRow key={item.kunci} icon={item.ikon} iconTone={item.nada} title={item.judul} subtitle={item.subjudul} trailing={item.kanan} onPress={item.onPress} />
      ))}
    </>
  );
}
