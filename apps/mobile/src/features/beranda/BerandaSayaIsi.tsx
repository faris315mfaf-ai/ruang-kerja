/**
 * Isi Beranda saya (semua karyawan) dari satu `GET /beranda` (spec 02).
 * Tiap bagian toleran gagal (`bagian_gagal`): bagian yang gagal tidak
 * menjatuhkan layar. Kartu "Laporan hari ini" disiapkan
 * (`KartuLaporanHariIni`) tetapi TIDAK dirender: web mencabutnya dari Beranda
 * 9 Okt 2026 (spec 02 §7 #1, keputusan bawaan: ikuti web). Kartu
 * "Ringkasan" (`KartuRingkasan`) juga tidak dirender lagi (keputusan pemilik
 * 14 Okt 2026) dan komponennya dihapus.
 */
import { View } from 'react-native';

import type { BerandaSaya } from '@/api/beranda';
import { KartuBriefingBaca } from '@/features/briefing/KartuBriefingBaca';
import { KartuBriefingCatat } from '@/features/briefing/KartuBriefingCatat';
import { Banner, Button, Card, Loading, Skeleton, Text } from '@/ui';

import { HeroAbsensi } from './HeroAbsensi';
import { KartuRapatBerikutnya } from './KartuRapatBerikutnya';
import { KartuTugasHariIni, KerangkaTugasHariIni } from './KartuTugasHariIni';
import { SpandukPengumuman } from './SpandukPengumuman';
import { TombolNotulensi } from './TombolNotulensi';
import type { HasilMuat } from './useMuat';

const NAMA_BAGIAN: Record<string, string> = {
  attendance_status: 'Absensi',
  rapat_berikutnya: 'Rapat berikutnya',
  laporan_hari_ini: 'Laporan hari ini',
};

export function BerandaSayaIsi({
  h,
  catatanAktif,
  onUlang,
}: {
  h: HasilMuat<BerandaSaya>;
  catatanAktif: boolean;
  onUlang: () => void;
}): React.JSX.Element {
  const d = h.data;

  if (d === null) {
    // Memuat pertama kali: hero & kartu tugas berupa kerangka.
    return (
      <View style={{ gap: 16 }} accessibilityLabel="Memuat beranda…" accessibilityLiveRegion="polite">
        <Skeleton height={210} radiusPx={26} />
        <KerangkaTugasHariIni />
        <Loading rows={2} label="Memuat beranda…" />
      </View>
    );
  }

  const gagal = d.bagian_gagal.filter((k) => k in NAMA_BAGIAN).map((k) => NAMA_BAGIAN[k]);
  const delegasi = d.briefing_catat && !d.briefing_catat.is_recorder ? d.briefing_catat : null;

  return (
    <View style={{ gap: 16 }}>
      <SpandukPengumuman spanduk={d.pengumuman} />

      {d.attendance_status ? <HeroAbsensi status={d.attendance_status} offline={h.offline} /> : null}

      {gagal.length > 0 ? <Banner tone="info" message={`${gagal.join(', ')} gagal dimuat — tarik ke bawah untuk mencoba lagi.`} /> : null}

      {catatanAktif ? <TombolNotulensi /> : null}

      {d.rapat_berikutnya ? <KartuRapatBerikutnya item={d.rapat_berikutnya} sekarang={h.terakhir?.getTime() ?? 0} /> : null}

      {d.tugas_hari_ini ? (
        <KartuTugasHariIni data={d.tugas_hari_ini} />
      ) : (
        <Card style={{ gap: 8, alignItems: 'center' }}>
          <Text variant="h3">Tugas gagal dimuat</Text>
          <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
            Periksa koneksi Anda lalu coba lagi.
          </Text>
          <Button title="Coba lagi" variant="outline" size="sm" icon="refresh-cw" onPress={onUlang} />
        </Card>
      )}

      {d.briefing_terakhir ? <KartuBriefingBaca briefing={d.briefing_terakhir} /> : null}
      {delegasi ? <KartuBriefingCatat kartu={delegasi} onDiubah={onUlang} /> : null}

    </View>
  );
}
