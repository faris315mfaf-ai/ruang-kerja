/**
 * Kartu "Laporan hari ini" (spec 02, `10-laporan-harian-kartu`): 4 keadaan.
 * DISIAPKAN TETAPI TIDAK DITAMPILKAN di Beranda — web mencabutnya dari Beranda
 * pada 9 Okt 2026 (digantikan Tugas hari ini); keputusan pemilik soal
 * pertanyaan #1 spec 02 menunggu. Tombolnya membuka formulir `/laporan/hari-ini`.
 * Untuk menampilkan: render di BerandaSaya saat `data.laporan_hari_ini` ada.
 */
import { View } from 'react-native';

import type { LaporanHariIni } from '@/api/beranda';
import { jam } from '@/lib/format';
import { Badge, Button, Card, Text } from '@/ui';

import { bukaLaporanHariIni } from './nav';

export function KartuLaporanHariIni({ laporan, sekarang }: { laporan: LaporanHariIni; sekarang: number }): React.JSX.Element {
  const terkunci = laporan.status !== 'submitted' && new Date(laporan.locks_at).getTime() < sekarang;
  const tone = laporan.status === 'submitted' ? 'success' : laporan.status === 'draft' ? 'info' : 'warning';
  const label = terkunci ? 'Terkunci' : laporan.status === 'submitted' ? 'Terkirim' : laporan.status === 'draft' ? 'Draf' : 'Belum lapor';
  const isi =
    laporan.status === 'submitted'
      ? `Terkirim pukul ${jam(laporan.submitted_at)} · ${laporan.items_count} tugas dilaporkan.`
      : terkunci
        ? 'Laporan hari ini sudah terkunci (lewat pukul 23.59).'
        : laporan.status === 'draft'
          ? `Draf tersimpan (${laporan.items_count} tugas). Kirim sebelum pukul 23.59.`
          : 'Tulis tugas yang dikerjakan, hambatan, dan catatan hari ini sebelum pukul 23.59.';

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="h3">Laporan hari ini</Text>
        <Badge tone={terkunci ? 'neutral' : tone}>{label}</Badge>
      </View>
      <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
        {isi}
      </Text>
      {terkunci ? null : <Button title={laporan.status === 'submitted' ? 'Lihat laporan' : 'Tulis laporan'} variant={laporan.status === 'submitted' ? 'outline' : 'primary'} onPress={bukaLaporanHariIni} />}
    </Card>
  );
}
