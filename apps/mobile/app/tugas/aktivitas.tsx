/** Riwayat aktivitas tugas penuh (mockup 05-tugas-workspace/10-5): filter jenis + paginasi. Rute: /tugas/aktivitas?id=…&key=… */
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarAktivitas, type Aktivitas, type JenisAktivitas } from '@/api/tugas';
import { BarisAktivitas } from '@/features/tugas/LampiranAktivitas';
import { pesanGalat } from '@/features/tugas/util';
import { Button, Chip, ChipScroller, EmptyState, ErrorState, Loading, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

const JENIS: { nilai: JenisAktivitas | null; label: string }[] = [
  { nilai: null, label: 'Semua' },
  { nilai: 'status', label: 'Status' },
  { nilai: 'penugasan', label: 'Penugasan' },
  { nilai: 'tenggat', label: 'Tenggat' },
  { nilai: 'prioritas', label: 'Prioritas' },
  { nilai: 'isi', label: 'Isi' },
  { nilai: 'checklist', label: 'Checklist' },
  { nilai: 'lampiran', label: 'Lampiran' },
];

export default function LayarRiwayatTugas(): React.JSX.Element {
  const { id, key } = useLocalSearchParams<{ id: string; key?: string }>();
  const [jenis, setJenis] = useState<JenisAktivitas | null>(null);
  const [daftar, setDaftar] = useState<Aktivitas[]>([]);
  const [halaman, setHalaman] = useState(1);
  const [akhir, setAkhir] = useState(1);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);

  const muat = useCallback(
    async (h: number, tambah: boolean): Promise<void> => {
      if (typeof id !== 'string') {
        return;
      }
      if (tambah) {
        setMemuatLagi(true);
      } else {
        setMemuat(true);
      }
      setGalat(null);
      try {
        const hasil = await daftarAktivitas(id, jenis, h);
        setHalaman(hasil.meta.current_page);
        setAkhir(hasil.meta.last_page);
        setDaftar((lama) => (tambah ? [...lama, ...hasil.activities.filter((a) => !lama.some((l) => l.id === a.id))] : hasil.activities));
      } catch (err) {
        setGalat({ pesan: pesanGalat(err, 'Tidak dapat memuat riwayat.'), status: err instanceof ApiError ? err.status : -1 });
      } finally {
        setMemuat(false);
        setMemuatLagi(false);
      }
    },
    [id, jenis],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat filter berubah
    void muat(1, false);
  }, [muat]);

  return (
    <Screen header={<SubAppBar title={key ? `Riwayat ${key}` : 'Riwayat tugas'} />} contentStyle={{ gap: 14 }}>
      <View style={{ marginHorizontal: -16 }}>
        <ChipScroller>
          {JENIS.map((j) => (
            <Chip key={j.label} label={j.label} selected={jenis === j.nilai} onPress={() => setJenis(j.nilai)} />
          ))}
        </ChipScroller>
      </View>
      {memuat ? (
        <Loading rows={6} />
      ) : galat && daftar.length === 0 ? (
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat(1, false)} />
      ) : daftar.length === 0 ? (
        <EmptyState icon="history" title="Belum ada riwayat" description="Perubahan pada tugas ini akan tercatat di sini." />
      ) : (
        <View style={{ gap: 14 }}>
          {daftar.map((a) => (
            <BarisAktivitas key={a.id} a={a} />
          ))}
          {halaman < akhir ? (
            <Button title={memuatLagi ? 'Memuat…' : 'Muat lagi'} variant="secondary" icon="chevron-down" loading={memuatLagi} onPress={() => void muat(halaman + 1, true)} />
          ) : (
            <Text variant="meta" align="center">
              Komentar ada di bagian Aktivitas tugas. Riwayat disimpan tanpa batas.
            </Text>
          )}
        </View>
      )}
    </Screen>
  );
}
