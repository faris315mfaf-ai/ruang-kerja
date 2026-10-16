/**
 * Layar penuh tingkat-aplikasi (mockup 11-sesi-versi-pemeliharaan): versi
 * wajib diperbarui (426), pemeliharaan (503), kartu "Update tersedia", dan
 * dialog "Sesi berakhir" (401 saat sesi berjalan).
 */
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_VERSION, type StatusAplikasi } from '@/api/client';
import { useAppStatus } from '@/session/AppStatusProvider';
import { useSession } from '@/session/SessionProvider';
import { layout, radius, useTheme } from '@/theme';
import { Button, Dialog, Icon, Pressable, Text, useSnackbar } from '@/ui';

import { FormScreen, IkonStatus } from './AuthLayout';

const PAKET = 'store.spkd.ruangkerja';

async function bukaToko(): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${PAKET}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PAKET}`).catch(() => undefined);
  }
}

export function LayarBlokirAplikasi({ status }: { status: StatusAplikasi }): React.JSX.Element {
  const { periksaUlang, config } = useAppStatus();
  const snackbar = useSnackbar();
  const [sibuk, setSibuk] = useState(false);

  async function cekLagi(): Promise<void> {
    setSibuk(true);
    const lolos = await periksaUlang();
    setSibuk(false);
    if (!lolos) {
      snackbar.show({
        variant: 'info',
        message: status.kind === 'maintenance' ? 'Masih dalam pemeliharaan. Coba lagi beberapa saat lagi.' : 'Versi terbaru belum terpasang.',
      });
    }
  }

  if (status.kind === 'update_required') {
    return (
      <FormScreen
        title="Perbarui aplikasi"
        hideBack
        footer={
          <>
            <Button title="Perbarui di Play Store" icon="store" onPress={() => void bukaToko()} />
            <Button title="Sudah diperbarui? Periksa lagi" variant="quiet" onPress={() => void cekLagi()} loading={sibuk} />
          </>
        }
      >
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 48 }}>
          <IkonStatus icon="download" tone="info" />
          <Text variant="h2" weight={800} align="center" accessibilityRole="header">
            Perbarui RuangKerja
          </Text>
          <Text variant="body" tone="muted" align="center" accessibilityRole="alert">
            {status.message}
          </Text>
          <Text variant="meta" align="center">
            Versi terpasang {APP_VERSION}
            {config ? ` · terbaru ${config.latest_app_version}` : ''}. Data Anda tetap aman; tidak perlu masuk ulang setelah memperbarui.
          </Text>
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Pemeliharaan"
      hideBack
      footer={<Button title="Coba lagi" icon="refresh-cw" onPress={() => void cekLagi()} loading={sibuk} loadingTitle="Memeriksa…" />}
    >
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 48 }}>
        <IkonStatus icon="wrench" tone="warning" />
        <Text variant="h2" weight={800} align="center" accessibilityRole="header">
          Sedang pemeliharaan
        </Text>
        <Text variant="body" tone="muted" align="center" accessibilityRole="alert">
          {status.message}
        </Text>
        <Text variant="meta" align="center">
          Butuh check-in saat pemeliharaan? Hubungi HR untuk koreksi absensi.
        </Text>
      </View>
    </FormScreen>
  );
}

/** Kartu "Versi X tersedia" di atas tab bar; "Nanti" menyembunyikannya sampai aplikasi dibuka lagi. */
export function KartuUpdateTersedia(): React.JSX.Element | null {
  const { updateTersedia, tundaUpdate } = useAppStatus();
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  if (!updateTersedia) {
    return null;
  }
  return (
    <View
      style={{
        position: 'absolute',
        left: layout.gutter,
        right: layout.gutter,
        bottom: insets.bottom + layout.tabBar + layout.tabLift + 28,
        padding: 14,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        boxShadow: shadows.float,
        gap: 10,
      }}
      accessibilityRole="alert"
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Icon name="download" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="label" weight={700}>
            Versi {updateTersedia} tersedia
          </Text>
          <Text variant="meta">Perbarui kapan saja; aplikasi tetap bisa dipakai.</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Pressable onPress={tundaUpdate} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}>
          <Text variant="label" tone="link" weight={700}>
            Nanti
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void bukaToko()}
          accessibilityRole="button"
          style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.control, backgroundColor: colors.linkSoft }}
        >
          <Text variant="label" tone="link" weight={700}>
            Perbarui
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Dialog saat server menolak token (401) di tengah sesi. */
export function DialogSesiBerakhir(): React.JSX.Element {
  const { sesiBerakhir, masukLagi, tundaSesiBerakhir } = useSession();
  return (
    <Dialog
      visible={sesiBerakhir}
      title="Sesi berakhir"
      message="Masuk lagi untuk melanjutkan. Pilih Nanti bila Anda masih mengisi sesuatu di layar ini."
      actions={[
        { label: 'Nanti', variant: 'quiet', onPress: tundaSesiBerakhir },
        { label: 'Masuk lagi', variant: 'tonal', onPress: () => void masukLagi() },
      ]}
    />
  );
}
