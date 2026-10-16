/**
 * Sheet detail laporan orang lain dari daftar laporan tim (spec 06 › 38 / 34-2):
 * data awal dari daftar (sudah disaring server: judul tugas hanya bila boleh
 * dilihat), lalu dilengkapi `GET /monitoring/laporan/{id}` (catatan/notulensi).
 * Bila panggilan itu gagal, isi daftar tetap tampil (kode tugas saja untuk
 * tugas yang tidak terlihat).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { laporanMonitor, type LaporanMonitor, type LaporanTimItem } from '@/api/laporan';
import { jam } from '@/lib/format';
import { BottomSheet, Button, Text } from '@/ui';

import { IsiLaporanBaca, dariItemMonitor } from './IsiLaporanBaca';
import { KepalaPemilik } from './KepalaPemilik';
import { tanggalLaporan } from './format';

export function DetailLaporanSheet({ laporan, onClose }: { laporan: LaporanTimItem | null; onClose: () => void }): React.JSX.Element {
  const [lengkap, setLengkap] = useState<LaporanMonitor | null>(null);
  const [catatan, setCatatan] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset saat laporan lain dibuka
    setLengkap(null);
    setCatatan(null);
    if (!laporan) return undefined;
    let batal = false;
    laporanMonitor(laporan.id)
      .then((r) => {
        if (!batal) setLengkap(r);
      })
      .catch((err: unknown) => {
        if (batal) return;
        setCatatan(err instanceof ApiError && err.status === 404 ? 'Laporan ini tidak lagi bisa dibuka.' : err instanceof ApiError && err.status === 0 ? 'Offline — menampilkan isi dari daftar.' : null);
      });
    return () => {
      batal = true;
    };
  }, [laporan]);

  const r = lengkap ?? laporan;
  return (
    <BottomSheet visible={laporan !== null} onClose={onClose} scrollable snapPoints={['85%']}>
      {r ? (
        <View style={{ gap: 16 }}>
          <KepalaPemilik nama={r.user.name} baris2={r.user.division} baris3={`${tanggalLaporan(r.date)}${r.submitted_at ? ` · terkirim ${jam(r.submitted_at)}` : ''}`} />
          {catatan ? (
            <Text variant="meta" tone="warning">
              {catatan}
            </Text>
          ) : null}
          <IsiLaporanBaca items={r.items.map(dariItemMonitor)} hours={r.hours} summary={r.summary} blockers={r.blockers} notes={lengkap?.notes ?? null} />
          <Button
            title="Buka laporan penuh"
            variant="outline"
            icon="file-text"
            onPress={() => {
              onClose();
              router.push(`/laporan/${r.id}` as never);
            }}
          />
          <Button
            title={`Riwayat ${r.user.name}`}
            variant="quiet"
            icon="history"
            onPress={() => {
              onClose();
              router.push(`/laporan/orang/${r.user.id}` as never);
            }}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}
