/**
 * Riwayat update proyek (mockup 06 › 09; `GET /proyek/{key}/update`, 10 per
 * halaman): chip Semua · Butuh keputusan · Ada arahan, progres/rencana saat
 * itu, keputusan selesai, arahan Direksi sebagai balasan. Direksi dapat
 * menandai keputusan selesai dan memberi arahan yang mengutip update.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { riwayatUpdate, type FilterRiwayat, type UpdateProyek } from '@/api/proyek';
import { useAksiDireksi } from '@/features/proyek/AksiDireksi';
import { KartuUpdate } from '@/features/proyek/KartuUpdate';
import { pesanGalat } from '@/features/proyek/tunda';
import { useProyek } from '@/features/proyek/useProyek';
import { Button, Chip, ChipScroller, EmptyState, ErrorState, Loading, Screen, SubAppBar, Text } from '@/ui';
import { ApiError } from '@/api/client';

export default function LayarRiwayatUpdate(): React.JSX.Element {
  const { key: param } = useLocalSearchParams<{ key: string }>();
  const key = typeof param === 'string' ? param : '';
  const proyek = useProyek(key);
  const [filter, setFilter] = useState<FilterRiwayat>('semua');
  const [daftar, setDaftar] = useState<UpdateProyek[]>([]);
  const [kursor, setKursor] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menambah, setMenambah] = useState(false);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    try {
      const r = await riwayatUpdate(key, filter);
      setDaftar(r.updates);
      setKursor(r.next_cursor);
      setGalat(null);
    } catch (err) {
      setGalat({ pesan: pesanGalat(err, 'Riwayat gagal dimuat.'), status: err instanceof ApiError ? err.status : 0 });
    } finally {
      setMemuat(false);
    }
  }, [key, filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat filter berubah
    void muat();
  }, [muat]);

  const lagi = async (): Promise<void> => {
    if (!kursor) return;
    setMenambah(true);
    try {
      const r = await riwayatUpdate(key, filter, kursor);
      setDaftar((l) => [...l, ...r.updates.filter((u) => !l.some((x) => x.id === u.id))]);
      setKursor(r.next_cursor);
    } catch (err) {
      setGalat({ pesan: pesanGalat(err, 'Riwayat gagal dimuat.'), status: err instanceof ApiError ? err.status : 0 });
    } finally {
      setMenambah(false);
    }
  };

  const segar = (): void => {
    void muat();
    void proyek.muat();
  };
  const aksi = useAksiDireksi(segar);
  const can = proyek.data?.can;
  const p = proyek.data?.project;

  return (
    <Screen header={<SubAppBar title={`Riwayat update${p ? ` · ${p.key}` : ''}`} />} refreshing={false} onRefresh={segar}>
      <View style={{ marginHorizontal: -16 }}>
        <ChipScroller>
          <Chip label="Semua" selected={filter === 'semua'} onPress={() => setFilter('semua')} />
          <Chip label="Butuh keputusan" selected={filter === 'keputusan'} onPress={() => setFilter('keputusan')} />
          <Chip label="Ada arahan" selected={filter === 'arahan'} onPress={() => setFilter('arahan')} />
        </ChipScroller>
      </View>
      {memuat && daftar.length === 0 ? (
        <Loading rows={4} label="Memuat riwayat update…" />
      ) : galat && daftar.length === 0 ? (
        <ErrorState kind={galat.status === 0 ? 'offline' : galat.status === 404 ? 'notfound' : 'umum'} message={galat.pesan} onRetry={() => void muat()} />
      ) : daftar.length === 0 ? (
        <EmptyState
          icon="history"
          title={filter === 'semua' ? 'Belum ada update' : filter === 'keputusan' ? 'Tidak ada update yang meminta keputusan' : 'Belum ada arahan Direksi'}
          actionLabel={filter !== 'semua' ? 'Tampilkan semua' : can?.post_update ? 'Tulis update' : undefined}
          onAction={() => (filter !== 'semua' ? setFilter('semua') : router.push(`/proyek/${encodeURIComponent(key)}/update` as never))}
        />
      ) : (
        <>
          {daftar.map((u) => (
            <KartuUpdate
              key={u.id}
              u={u}
              bolehTandai={(can?.resolve_decision ?? false) && !proyek.offline}
              onTandai={u.decision_needed && p ? () => void aksi.tandaiSelesai({ key: p.key, updateId: u.id, keputusan: u.decision_needed ?? '' }) : undefined}
              onBalas={can?.give_direction && !can.archived && p ? () => aksi.beriArahan({ key: p.key, nama: p.name, pic: p.lead?.name ?? null, updateId: u.id, kutipan: u.blockers ?? u.summary }) : undefined}
            />
          ))}
          {kursor ? <Button title="Muat lebih banyak" variant="outline" loading={menambah} onPress={() => void lagi()} /> : <Text variant="meta" align="center">Semua update sudah ditampilkan.</Text>}
        </>
      )}
      {aksi.elemen}
    </Screen>
  );
}
