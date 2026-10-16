/**
 * Kunci aplikasi — sakelar, "Kunci setelah" (segera/1/5/15 menit), dan cara
 * membuka (sidik jari atau kunci layar). Layar kunci & FLAG_SECURE dikerjakan
 * di akar aplikasi (`useAppLock`).
 * Mockup: docs/mockups/android/screens/01-akses-akun/10-kunci-aplikasi.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { bukaSetelanKeamanan, LOCK_AFTER_OPTIONS, lockAfterLabel, useAppLock, type LockAfter } from '@/features/auth/appLock';
import { GroupLabel } from '@/features/settings/parts';
import { Banner, Card, EmptyState, ListRow, Radio, Screen, SubAppBar, Switch, useDialog, useSnackbar } from '@/ui';

const KETERANGAN: Record<LockAfter, string | undefined> = {
  0: 'Setiap kali aplikasi dibuka kembali',
  1: 'Bawaan',
  5: undefined,
  15: undefined,
};

export default function LayarKunciAplikasi(): React.JSX.Element {
  const kunci = useAppLock();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [sibuk, setSibuk] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void kunci.segarkanDukungan();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- segarkanDukungan stabil
    }, []),
  );

  const ubah = async (nilai: boolean): Promise<void> => {
    if (sibuk) {
      return;
    }
    setSibuk(true);
    try {
      if (nilai) {
        const hasil = await kunci.setEnabled(true);
        if (hasil.ok) {
          snackbar.show({ message: 'Kunci aplikasi aktif di perangkat ini', variant: 'ok' });
        } else if (hasil.reason === 'failed' || hasil.reason === 'lockout' || hasil.reason === 'lockout_permanent') {
          snackbar.show({ message: 'Verifikasi gagal. Coba lagi.', variant: 'bad' });
        }
      } else {
        const ya = await dialog.confirm({
          title: 'Matikan kunci aplikasi?',
          message: 'Aplikasi tidak lagi meminta sidik jari saat dibuka di perangkat ini. Sesi Anda tetap aktif.',
          confirmLabel: 'Matikan',
          cancelLabel: 'Batal',
          destructive: true,
        });
        if (ya) {
          await kunci.setEnabled(false);
        }
      }
    } finally {
      setSibuk(false);
    }
  };

  if (kunci.ready && !kunci.supported && !kunci.enabled) {
    return (
      <Screen header={<SubAppBar title="Kunci aplikasi" />}>
        <EmptyState
          icon="lock"
          title="Setel kunci layar dulu"
          description="RuangKerja memakai kunci layar atau biometrik perangkat. Atur PIN, pola, atau sandi di Setelan Android lalu coba lagi."
          actionLabel="Buka Setelan"
          onAction={() => void bukaSetelanKeamanan()}
          variant="plain"
        />
      </Screen>
    );
  }

  return (
    <Screen header={<SubAppBar title="Kunci aplikasi" />}>
      <Card variant="flat">
        <ListRow
          icon="lock"
          iconTone={kunci.enabled ? 'teal' : 'neutral'}
          title="Kunci aplikasi"
          subtitle="Minta sidik jari atau kunci layar saat aplikasi dibuka kembali"
          trailing={<Switch value={kunci.enabled} onValueChange={(v) => void ubah(v)} label="Kunci aplikasi" disabled={sibuk || !kunci.ready} />}
        />
      </Card>

      <View style={{ gap: 8 }}>
        <GroupLabel>Kunci setelah</GroupLabel>
        <Card variant="tight" style={{ gap: 0, paddingVertical: 6 }}>
          {LOCK_AFTER_OPTIONS.map((menit) => (
            <Radio
              key={menit}
              selected={kunci.lockAfter === menit}
              onSelect={() => void kunci.setLockAfter(menit)}
              label={lockAfterLabel(menit)}
              description={KETERANGAN[menit]}
              disabled={!kunci.enabled}
            />
          ))}
        </Card>
      </View>

      <View style={{ gap: 8 }}>
        <GroupLabel>Buka dengan</GroupLabel>
        <Card variant="flat">
          <ListRow icon="fingerprint" title="Sidik jari atau kunci layar" subtitle="Kunci layar menjadi cadangan bila sidik jari gagal" />
        </Card>
      </View>

      <Banner tone="info" message="Kunci aplikasi hanya melindungi RuangKerja di perangkat ini. Kata sandi Anda tidak disimpan di ponsel." />
    </Screen>
  );
}
