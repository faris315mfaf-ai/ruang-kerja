/**
 * Buat cepat — sheet yang dibuka dengan TEKAN LAMA tombol tengah tab bar
 * (keputusan spec 10 §10 butir 1) dan layar `/buat-cepat` dari menu Lainnya.
 * Grid 6 aksi + "Mulai notulensi cepat". Mockup: 16-quick-add. Formulir mini
 * belum ada: aksi membuka layar penuhnya (atau "Segera hadir" untuk modul
 * yang belum dibangun).
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { ParamSegera } from '@/features/settings/ComingSoon';
import { radius, useTheme, type GradientName } from '@/theme';

import { useAttendanceStatus } from './attendance-status';
import { BottomSheet } from './BottomSheet';
import { Gradient } from './Gradient';
import { Icon, type AnyIconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** Buka layar "Segera hadir" (padanan `bukaSegera`; ditulis lokal agar `@/ui` tidak bergantung pada fitur → tanpa impor melingkar). */
function bukaSegera(param: ParamSegera): void {
  const params: Record<string, string> = { judul: param.judul };
  if (param.ikon) params.ikon = param.ikon;
  if (param.catatan) params.catatan = param.catatan;
  if (param.aksiJudul) params.aksiJudul = param.aksiJudul;
  if (param.aksiRute) params.aksiRute = param.aksiRute;
  router.push({ pathname: '/segera', params });
}

interface Aksi {
  kunci: string;
  label: string;
  icon: AnyIconName;
  gradien: GradientName;
  nonaktif?: boolean;
  alasan?: string;
  onPress: () => void;
}

function useAksiBuatCepat(): { aksi: Aksi[]; notulensi: () => void } {
  const { action } = useAttendanceStatus();
  const absen: Aksi =
    action === 'unavailable'
      ? { kunci: 'absen', label: 'Check-in', icon: 'log-in', gradien: 'merek', nonaktif: true, alasan: 'Tidak ada jadwal hari ini', onPress: () => undefined }
      : action === 'done'
        ? { kunci: 'absen', label: 'Absensi', icon: 'clipboard-check', gradien: 'merek', onPress: () => router.push('/absen' as never) }
        : { kunci: 'absen', label: action === 'check_out' ? 'Check-out' : 'Check-in', icon: action === 'check_out' ? 'log-out' : 'log-in', gradien: 'merek', onPress: () => router.push('/absen' as never) };

  const aksi: Aksi[] = [
    { kunci: 'tugas', label: 'Tugas baru', icon: 'plus', gradien: 'merek', onPress: () => router.push('/tugas/baru' as never) },
    absen,
    {
      kunci: 'ajukan',
      label: 'Ajukan',
      icon: 'calendar-plus',
      gradien: 'indigo',
      onPress: () => router.push('/pengajuan/baru' as never),
    },
    { kunci: 'laporan', label: 'Laporan hari ini', icon: 'clipboard-pen', gradien: 'hangat', onPress: () => router.push('/laporan/hari-ini' as never) },
    { kunci: 'catatan', label: 'Catatan cepat', icon: 'notebook-pen', gradien: 'indigo', onPress: () => bukaSegera({ judul: 'Catatan cepat', ikon: 'notebook-pen' }) },
    {
      kunci: 'rapat',
      label: 'Rapat',
      icon: 'video',
      gradien: 'merek',
      onPress: () => router.push('/rapat/baru' as never),
    },
  ];
  return { aksi, notulensi: () => bukaSegera({ judul: 'Notulensi cepat', ikon: 'notebook-text', catatan: 'Catatan baru di workspace pribadi dengan templat rapat.' }) };
}

/** Isi grid (dipakai sheet dan layar penuh). `onPilih` dipanggil sebelum aksi, mis. untuk menutup sheet. */
export function BuatCepatIsi({ onPilih }: { onPilih?: () => void }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const { aksi, notulensi } = useAksiBuatCepat();
  const jalankan = (fn: () => void): void => {
    onPilih?.();
    fn();
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={s.grid}>
        {aksi.map((a) => (
          <Pressable
            key={a.kunci}
            disabled={a.nonaktif}
            onPress={() => jalankan(a.onPress)}
            accessibilityRole="button"
            accessibilityLabel={a.nonaktif && a.alasan ? `${a.label}, nonaktif. ${a.alasan}` : a.label}
            accessibilityState={{ disabled: a.nonaktif }}
            style={[s.ubin, { backgroundColor: colors.surface, borderColor: colors.border, opacity: a.nonaktif ? 0.55 : 1 }]}
          >
            <View style={s.ikon}>
              <Gradient name={a.gradien} style={[StyleSheet.absoluteFill, { borderRadius: radius.control }]} />
              <Icon name={a.icon} size={22} color="#FFFFFF" />
            </View>
            <Text variant="label" weight={700} align="center" numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {a.label}
            </Text>
            {a.nonaktif && a.alasan ? (
              <Text variant="meta" align="center" style={{ fontSize: 11, lineHeight: 14 }} numberOfLines={2}>
                {a.alasan}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => jalankan(notulensi)}
        accessibilityRole="button"
        accessibilityLabel="Mulai notulensi cepat. Catatan baru di workspace pribadi dengan templat rapat."
        style={[s.baris, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.card }]}
      >
        <View style={s.ikon}>
          <Gradient name="indigo" style={[StyleSheet.absoluteFill, { borderRadius: radius.control }]} />
          <Icon name="file-text" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title" weight={700}>
            Mulai notulensi cepat
          </Text>
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
            Catatan baru di workspace pribadi dengan templat rapat
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={colors.subtle} />
      </Pressable>
    </View>
  );
}

export function BuatCepatSheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Buat cepat">
      <BuatCepatIsi onPilih={onClose} />
      <Text variant="meta" align="center" style={{ fontSize: 13 }}>
        Tekan lama tombol tengah di tab bar untuk membuka ini.
      </Text>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ubin: {
    width: '31.4%',
    minHeight: 112,
    borderRadius: radius.cardTight,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  ikon: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.cardTight, borderWidth: StyleSheet.hairlineWidth, padding: 12, minHeight: 72 },
});
