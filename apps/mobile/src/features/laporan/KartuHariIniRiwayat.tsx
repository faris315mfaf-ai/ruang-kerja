/**
 * Kartu "Hari ini" di atas riwayat laporan (teks & CTA sama dengan kartu Beranda,
 * mockup 32-1/32-2/33): Belum lapor · Draf · Terkirim.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import type { RiwayatBulan } from '@/api/laporan';
import { jam } from '@/lib/format';
import { Badge, Button, Card, Text } from '@/ui';

import { tanggalSingkat } from './format';

export function KartuHariIniRiwayat({ hariIni }: { hariIni: RiwayatBulan['hari_ini'] }): React.JSX.Element {
  const batas = jam(hariIni.locks_at);
  const status = hariIni.status;
  const lencana =
    status === 'submitted' ? <Badge tone="success">{`Terkirim ${jam(hariIni.submitted_at)}`}</Badge> : status === 'draft' ? <Badge tone="warning">Draf</Badge> : <Badge tone="danger">Belum lapor</Badge>;
  const teks =
    status === 'submitted'
      ? `Atasan Anda bisa membacanya. Masih bisa diubah sampai ${batas}.`
      : status === 'draft'
        ? 'Draf tersimpan, belum dikirim ke atasan.'
        : `Tulis tugas yang dikerjakan, hambatan, dan catatan hari ini sebelum pukul ${batas}.`;
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="overline">{`Hari ini · ${tanggalSingkat(hariIni.date)}`}</Text>
        {lencana}
      </View>
      <Text variant="body" tone="muted" style={{ fontSize: 16, lineHeight: 24 }}>
        {teks}
      </Text>
      <Button
        title={status === 'submitted' ? 'Ubah laporan' : status === 'draft' ? 'Lanjutkan & kirim' : 'Tulis laporan'}
        variant={status === 'submitted' ? 'outline' : 'primary'}
        onPress={() => router.push('/laporan/hari-ini' as never)}
      />
    </Card>
  );
}
