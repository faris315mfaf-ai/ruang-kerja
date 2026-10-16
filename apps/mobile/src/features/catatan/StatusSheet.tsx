/** Sheet status simpan (mockup 13): menyimpan, tersimpan, belum tersimpan, konflik, gagal. */
import { View } from 'react-native';

import { jam } from '@/lib/format';
import { BottomSheet, Button, Text } from '@/ui';

import type { SesiState } from './sesiSimpan';

export function StatusSheet({
  visible,
  onClose,
  state,
  updatedAt,
  onSiram,
  onMuatUlang,
  onBagikanTeks,
}: {
  visible: boolean;
  onClose: () => void;
  state: SesiState;
  updatedAt: string | null;
  onSiram: () => void;
  onMuatUlang: () => void;
  onBagikanTeks: () => void;
}): React.JSX.Element {
  const { status, galat, tersimpanPada } = state;
  const luring = status === 'gagal' && galat?.status === 0;

  let judul = 'Tersimpan';
  let isi = 'Disimpan otomatis 1,5 detik setelah Anda berhenti mengetik.';
  if (status === 'menyimpan') {
    judul = 'Menyimpan…';
    isi = 'Perubahan terakhir sedang dikirim ke server.';
  } else if (status === 'konflik') {
    judul = 'Catatan diubah orang lain';
    isi = 'Versi di server lebih baru daripada versi di aplikasi. Muat ulang untuk melihat perubahan terbaru — suntingan Anda yang belum tersimpan akan diganti.';
  } else if (luring) {
    judul = 'Belum tersimpan — tidak ada koneksi';
    isi = 'Suntingan Anda aman di aplikasi ini dan dikirim ulang otomatis saat koneksi kembali. Jangan tutup aplikasi sebelum “Tersimpan”.';
  } else if (status === 'gagal') {
    judul = 'Gagal menyimpan';
    isi = `Server menolak simpanan (galat ${galat?.status ?? 500}). Ubah sedikit teks agar percobaan simpan diulang, atau bagikan teks Anda lalu muat ulang.`;
  } else if (state.kotor) {
    judul = 'Belum tersimpan';
    isi = 'Perubahan akan disimpan otomatis sebentar lagi.';
  } else if (state.diHp) {
    judul = 'Tersimpan di HP · menunggu sinkron';
    isi = 'Suntingan Anda aman di HP dan dikirim otomatis begitu ada internet. Status pengiriman ada di Lainnya › Antrean sinkron.';
  } else {
    const waktu = tersimpanPada ?? (updatedAt ? new Date(updatedAt) : null);
    judul = waktu ? `Tersimpan ${jam(waktu)}` : 'Tersimpan';
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Status catatan">
      <View style={{ gap: 6 }}>
        <Text variant="title" weight={700} accessibilityRole="header">
          {judul}
        </Text>
        <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
          {isi}
        </Text>
      </View>
      {status === 'konflik' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Nanti" variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Muat ulang" onPress={() => { onClose(); onMuatUlang(); }} style={{ flex: 1.4 }} />
        </View>
      ) : luring || state.kotor ? (
        <Button title="Simpan sekarang" onPress={() => { onClose(); onSiram(); }} />
      ) : status === 'gagal' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Bagikan teks" variant="outline" onPress={onBagikanTeks} style={{ flex: 1 }} />
          <Button title="Coba lagi" onPress={() => { onClose(); onSiram(); }} style={{ flex: 1.4 }} />
        </View>
      ) : null}
    </BottomSheet>
  );
}
