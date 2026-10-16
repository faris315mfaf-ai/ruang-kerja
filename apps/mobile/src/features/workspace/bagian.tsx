/**
 * Potongan UI bersama layar workspace & otomasi: ubin workspace, wadah gulir
 * tab, banner baca-saja, galat dari ApiError, pita offline.
 */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ApiError } from '@/api/client';
import type { BacaSaja } from '@/api/workspace';
import { jam } from '@/lib/format';
import { radius, useTheme, type GradientName } from '@/theme';
import { Banner, ErrorState, Gradient, Text, errorKindFromStatus } from '@/ui';

/** Gradien ubin dari nama palet workspace; cadangan per jenis. */
export function gradienUbin(warna: string | null | undefined, tipe?: string): GradientName {
  switch (warna) {
    case 'teal':
      return 'merek';
    case 'blue':
      return 'aksi';
    case 'violet':
    case 'indigo':
      return 'indigo';
    case 'orange':
    case 'red':
    case 'pink':
    case 'amber':
      return 'hangat';
    case 'gray':
    case 'slate':
      return 'slate';
    default:
      return tipe === 'personal' ? 'slate' : tipe === 'project' ? 'indigo' : 'merek';
  }
}

export function UbinWorkspace({ nama, warna, tipe, ukuran = 44 }: { nama: string; warna?: string | null; tipe?: string; ukuran?: number }): React.JSX.Element {
  return (
    <Gradient
      name={gradienUbin(warna, tipe)}
      style={{ width: ukuran, height: ukuran, borderRadius: ukuran >= 44 ? radius.lg : 12, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text variant="label" weight={800} style={{ color: '#FFFFFF', fontSize: ukuran >= 44 ? 17 : 15 }}>
        {nama.slice(0, 1).toUpperCase()}
      </Text>
    </Gradient>
  );
}

/** Wadah gulir isi tab: tarik-untuk-muat-ulang, jarak, ruang bawah untuk FAB. */
export function TabScroll({
  children,
  onRefresh,
  refreshing = false,
  ruangFab = false,
  contentStyle,
}: {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
  ruangFab?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [manual, setManual] = useState(false);
  const segarkan = useCallback(async () => {
    setManual(true);
    try {
      await onRefresh?.();
    } finally {
      setManual(false);
    }
  }, [onRefresh]);
  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + (ruangFab ? 108 : 32), gap: 14 }, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={manual || refreshing} onRefresh={() => void segarkan()} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

/** Banner baca-saja sesuai kode server (lihat_saja · arsip · peran_viewer). */
export function BannerBacaSaja({ info }: { info: BacaSaja | null | undefined }): React.JSX.Element | null {
  if (!info || !info.read_only) {
    return null;
  }
  if (info.code === 'lihat_saja') {
    return <Banner tone="neutral" icon="eye" title="Mode lihat saja." message="Anda bukan anggota workspace ini, jadi tugas, komentar, file, dan pengaturan tidak dapat diubah." />;
  }
  if (info.code === 'arsip') {
    return <Banner tone="neutral" icon="archive" message="Workspace ini diarsipkan dan hanya bisa dibaca." />;
  }
  return <Banner tone="neutral" icon="eye" message={info.reason ?? 'Peran Anda di workspace ini hanya bisa melihat.'} />;
}

export function PitaOffline({ diperbarui, objek }: { diperbarui: Date | null; objek: string }): React.JSX.Element {
  return <Banner tone="warn" icon="wifi-off" message={`Offline · ${objek} terakhir ${diperbarui ? `diperbarui ${jam(diperbarui)}` : 'tersimpan'}.`} />;
}

/** Galat pemuatan: ikon + pesan + "Coba lagi" (offline/403/404 dibedakan). */
export function GalatMuat({ galat, judul, onCoba }: { galat: ApiError; judul?: string; onCoba?: () => void }): React.JSX.Element {
  const kind = errorKindFromStatus(galat.status);
  const pesan = galat.status === 0 ? 'Periksa sambungan internet Anda, lalu coba lagi.' : galat.message;
  const pakaiJudul = judul !== undefined && (kind === 'offline' || kind === 'umum');
  return <ErrorState kind={kind} title={pakaiJudul ? judul : undefined} message={pesan} onRetry={onCoba} />;
}
