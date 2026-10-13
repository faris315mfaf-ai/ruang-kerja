/**
 * Tampilan List (mockup 05 › 17): tugas dikelompokkan per status atau
 * prioritas dari GET /workspace/{ws}/tugas (filter & urutan di server,
 * paginasi "Muat lagi"), pencarian di atas daftar, tombol "Pindahkan".
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ambilListTugas, type FilterTugas, type KartuWorkspace, type ListTugasData } from '@/api/workspace';
import { useTheme } from '@/theme';
import { Avatar, Banner, Button, Card, EmptyState, Icon, Loading, Pressable, SearchInput, SegmentedTabs, Text } from '@/ui';

import { BannerBacaSaja, GalatMuat, PitaOffline, TabScroll } from './bagian';
import { IkonPrioritas, IkonStatus } from './ikon';
import { jumlahFilterAktif, labelTenggat, LABEL_PRIORITAS, tugasTerbuka } from './util';

interface Keadaan {
  tugas: KartuWorkspace[];
  meta: ListTugasData['meta'] | null;
  statuses: ListTugasData['statuses'];
  bacaSaja: ListTugasData['read_only'] | null;
  boleh: boolean;
  memuat: boolean;
  memuatLagi: boolean;
  galat: ApiError | null;
  offline: boolean;
  diperbarui: Date | null;
}

const AWAL: Keadaan = { tugas: [], meta: null, statuses: [], bacaSaja: null, boleh: false, memuat: true, memuatLagi: false, galat: null, offline: false, diperbarui: null };

export function BarisTugas({ tugas, onPindah, tampilkanStatus = false, statusNama }: { tugas: KartuWorkspace; onPindah?: () => void; tampilkanStatus?: boolean; statusNama?: string }): React.JSX.Element {
  const { colors } = useTheme();
  const tenggat = labelTenggat(tugas.due_date, !tugasTerbuka(tugas));
  const warna = tenggat?.nada === 'danger' ? colors.danger : tenggat?.nada === 'warning' ? colors.warning : colors.muted;
  const nama = tugas.assignees?.[0]?.nama ?? null;
  const meta = [tugas.key, tenggat?.teks, tugas.comments && tugas.comments.count > 0 ? `${tugas.comments.count} komentar` : null, tugas.parent_key ? `sub-tugas ${tugas.parent_key}` : null].filter(Boolean);
  return (
    <View style={s.baris}>
      <Pressable
        onPress={() => router.push(`/tugas/${tugas.id}`)}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel={`${tugas.key}, ${tugas.title}. ${LABEL_PRIORITAS[tugas.priority] ?? ''}${tenggat ? `. ${tenggat.teks}` : ''}`}
        style={s.isi}
      >
        <IkonStatus kategori={tugas.status_category} warna={tugas.status?.color} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={2} style={{ fontSize: 16, lineHeight: 22 }}>
            {tugas.title}
          </Text>
          <Text variant="meta" numberOfLines={1} style={{ color: tenggat?.terlambat ? warna : undefined }}>
            {meta.join(' · ')}
            {tampilkanStatus && statusNama ? ` · ${statusNama}` : ''}
          </Text>
        </View>
        <IkonPrioritas nilai={tugas.priority} />
        {nama ? <Avatar name={nama} size="sm" /> : null}
      </Pressable>
      {onPindah ? (
        <Pressable onPress={onPindah} scaleTo={0.92} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Pindahkan ${tugas.key}`} style={s.pindah}>
          <Icon name="arrow-right-left" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListView({
  ws,
  filter,
  onFilter,
  versi,
  boleh,
  onPindah,
  onTugasBaru,
}: {
  ws: string;
  filter: FilterTugas;
  onFilter: (f: FilterTugas) => void;
  /** Naik setiap ada perubahan dari luar (pindah kartu) → muat ulang. */
  versi: number;
  boleh: boolean;
  onPindah: (t: KartuWorkspace) => void;
  onTugasBaru: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [k, setK] = useState<Keadaan>(AWAL);
  const [kelompok, setKelompok] = useState<'status' | 'prioritas'>('status');
  const [cari, setCari] = useState(filter.q);
  const kunciFilter = JSON.stringify(filter);
  const filterRef = useRef(filter);
  const serial = useRef(0);

  useEffect(() => {
    filterRef.current = filter;
  });

  const muat = useCallback(
    async (halaman: number): Promise<void> => {
      const id = ++serial.current;
      setK((lama) => ({ ...lama, memuat: halaman === 1 && lama.tugas.length === 0, memuatLagi: halaman > 1 }));
      try {
        const hasil = await ambilListTugas(ws, filterRef.current, halaman);
        if (id !== serial.current) {
          return;
        }
        setK((lama) => ({
          tugas: halaman === 1 ? hasil.tasks : [...lama.tugas, ...hasil.tasks.filter((t) => !lama.tugas.some((x) => x.id === t.id))],
          meta: hasil.meta,
          statuses: hasil.statuses,
          bacaSaja: hasil.read_only,
          boleh: hasil.can.move && !hasil.read_only.read_only,
          memuat: false,
          memuatLagi: false,
          galat: null,
          offline: false,
          diperbarui: new Date(),
        }));
      } catch (err) {
        if (id !== serial.current) {
          return;
        }
        const e = err instanceof ApiError ? err : new ApiError({ status: 0, message: 'Tidak dapat memuat tugas.' });
        setK((lama) => (lama.tugas.length > 0 && e.status === 0 ? { ...lama, offline: true, memuat: false, memuatLagi: false } : { ...lama, galat: e, memuat: false, memuatLagi: false }));
      }
    },
    [ws],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat filter/versi berubah
    void muat(1);
  }, [muat, kunciFilter, versi]);

  // Pencarian inline → filter.q (debounce 350 ms).
  useEffect(() => {
    if (cari === filterRef.current.q) {
      return undefined;
    }
    const t = setTimeout(() => onFilter({ ...filterRef.current, q: cari }), 350);
    return () => clearTimeout(t);
  }, [cari, onFilter]);

  const nFilter = jumlahFilterAktif(filter);
  const terlambat = useMemo(() => k.tugas.filter((t) => labelTenggat(t.due_date, !tugasTerbuka(t))?.terlambat).length, [k.tugas]);

  const grup = useMemo(() => {
    if (kelompok === 'status') {
      return k.statuses
        .map((st) => ({ kunci: st.id, judul: st.name, kategori: st.kategori, warna: st.color, tugas: k.tugas.filter((t) => t.status_id === st.id) }))
        .filter((g) => g.tugas.length > 0);
    }
    return [1, 2, 3, 4, 0]
      .map((p) => ({ kunci: `p${p}`, judul: p === 1 ? 'Urgent' : LABEL_PRIORITAS[p] ?? '', prioritas: p, tugas: k.tugas.filter((t) => t.priority === p) }))
      .filter((g) => g.tugas.length > 0);
  }, [k.statuses, k.tugas, kelompok]);

  const namaStatus = (id: string): string | undefined => k.statuses.find((x) => x.id === id)?.name;

  if (k.memuat && k.tugas.length === 0) {
    return (
      <TabScroll>
        <Loading label="Memuat tugas…" rows={5} />
      </TabScroll>
    );
  }
  if (k.galat && k.tugas.length === 0) {
    return <GalatMuat galat={k.galat} judul="Tugas belum bisa dimuat" onCoba={() => void muat(1)} />;
  }

  return (
    <TabScroll onRefresh={() => muat(1)} ruangFab={boleh}>
      <BannerBacaSaja info={k.bacaSaja} />
      {k.offline ? <PitaOffline diperbarui={k.diperbarui} objek="daftar" /> : null}
      <SearchInput value={cari} onChangeText={setCari} placeholder="Cari judul, ID, atau deskripsi" />
      <SegmentedTabs
        value={kelompok}
        onChange={setKelompok}
        options={[
          { value: 'status', label: 'Per status' },
          { value: 'prioritas', label: 'Per prioritas' },
        ]}
      />
      <View style={s.ringkas}>
        <Text variant="meta" style={{ flex: 1 }}>
          {`${k.meta?.total ?? k.tugas.length} tugas${terlambat > 0 ? ` · ${terlambat} terlambat` : ''}${nFilter > 0 ? ' · difilter' : ''}`}
        </Text>
        {nFilter > 0 ? <Button title="Hapus filter" variant="quiet" size="sm" onPress={() => { setCari(''); onFilter({ ...filter, q: '', assignee: '', prioritas: [], label: [], tenggat: '' }); }} /> : null}
      </View>

      {grup.length === 0 ? (
        nFilter > 0 ? (
          <EmptyState icon="search-x" title="Tidak ada yang cocok" description="Tidak ada tugas yang cocok dengan filter ini." />
        ) : (
          <EmptyState icon="square-dashed" title="Belum ada tugas" description="Buat tugas pertama atau pakai template tugas." actionLabel={boleh ? 'Tugas baru' : undefined} onAction={boleh ? onTugasBaru : undefined} />
        )
      ) : (
        grup.map((g) => (
          <View key={g.kunci} style={{ gap: 8 }}>
            <View style={s.kepala}>
              {'kategori' in g ? <IkonStatus kategori={g.kategori} warna={g.warna} ukuran={20} /> : null}
              <Text variant="title" weight={800} style={{ flex: 1 }}>
                {g.judul}
              </Text>
              <Text variant="label" tone="muted">
                {g.tugas.length}
              </Text>
            </View>
            <Card variant="flat">
              {g.tugas.map((t, i) => (
                <View key={t.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : undefined}>
                  <BarisTugas tugas={t} tampilkanStatus={kelompok === 'prioritas'} statusNama={namaStatus(t.status_id)} onPindah={boleh && t.can?.move !== false ? () => onPindah(t) : undefined} />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}

      {k.meta?.has_more ? <Button title="Muat lagi" variant="outline" loading={k.memuatLagi} onPress={() => void muat((k.meta?.current_page ?? 1) + 1)} /> : null}
      {k.meta && !k.meta.has_more && k.tugas.length > 0 && !filter.selesai ? (
        <Banner tone="neutral" icon="info" message="Tugas terbuka dan yang ditutup 30 hari terakhir. Nyalakan “Tampilkan semua tugas selesai” di filter untuk riwayat penuh." />
      ) : null}
    </TabScroll>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: 14 },
  isi: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pindah: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  ringkas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
