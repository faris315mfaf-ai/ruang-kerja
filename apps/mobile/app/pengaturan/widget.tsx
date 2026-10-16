/**
 * Widget layar utama — penjelasan singkat + tombol "Tambahkan" (permintaan pin ke peluncur;
 * bila peluncur tidak mendukung, petunjuk manual). Widget: Check-in 2×1, Tugas hari ini 4×2,
 * Rapat berikutnya 4×1 (docs/sesi/ponsel-b9-widget.md, mockup 12-android-native/01 & 02).
 */
import { View } from 'react-native';

import type { NamaWidget } from '@/widget/keadaan';
import { radius, useTheme } from '@/theme';
import { Banner, Button, IconTile, Screen, SubAppBar, Text, useSnackbar, type AnyIconName } from '@/ui';

const WIDGET: { nama: NamaWidget; judul: string; deskripsi: string; ikon: AnyIconName }[] = [
  { nama: 'CheckIn', judul: 'Check-in', deskripsi: 'Status absen hari ini. Ketuk untuk membuka layar Absen.', ikon: 'log-in' },
  { nama: 'TugasHariIni', judul: 'Tugas hari ini', deskripsi: 'Daftar tugas; pilih segmen Pribadi, Tim, atau Semua.', ikon: 'list-checks' },
  { nama: 'RapatBerikutnya', judul: 'Rapat berikutnya', deskripsi: 'Rapat terdekat dengan tombol Gabung.', ikon: 'video' },
];

export default function LayarWidget(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();

  const tambahkan = async (nama: NamaWidget): Promise<void> => {
    try {
      const { requestPinWidget } = await import('react-native-android-widget');
      if (await requestPinWidget({ widgetName: nama })) {
        return;
      }
    } catch {
      // Modul native tidak ada pada build ini / peluncur menolak: jatuh ke petunjuk manual.
    }
    snackbar.show({ message: 'Peluncur Anda tidak mendukung penambahan otomatis. Tekan lama layar utama › Widget › RuangKerja.', variant: 'info', duration: 6000 });
  };

  return (
    <Screen header={<SubAppBar title="Widget layar utama" />}>
      <Text variant="body" tone="muted">
        Lihat absen, tugas, dan rapat tanpa membuka aplikasi. Tekan lama layar utama, pilih Widget, lalu cari RuangKerja — atau ketuk Tambahkan di bawah.
      </Text>
      <View style={{ gap: 12 }}>
        {WIDGET.map((w) => (
          <View key={w.nama} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <IconTile icon={w.ikon} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{w.judul}</Text>
              <Text variant="meta">{w.deskripsi}</Text>
            </View>
            <Button title="Tambahkan" size="sm" variant="tonal" onPress={() => void tambahkan(w.nama)} accessibilityHint={`Menambahkan widget ${w.judul} ke layar utama`} />
          </View>
        ))}
      </View>
      <Banner tone="warn" message="Widget menampilkan judul tugas dan rapat di layar utama, yang bisa terlihat orang di sekitar Anda. Check-in tetap lewat layar Absen (selfie + lokasi); widget hanya membukanya." />
      <Banner tone="info" message="Widget dimuat ulang tiap 30 menit, saat Anda mengubah tugas atau absen di aplikasi, dan saat aplikasi ditutup. Hemat daya Android dapat menundanya; ketuk catatan 'Data lama' untuk menyegarkan." />
    </Screen>
  );
}
