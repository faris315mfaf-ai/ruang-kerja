/**
 * Tab Tugas workspace: Board · List · Kalender + filter + "Pindahkan" +
 * FAB "Tugas baru" (mockup 05 › 16–18, 20). Papan dimuat di sini agar
 * kolom/label dipakai bersama ketiga tampilan dan sheet Pindahkan.
 */
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import {
  ambilAnggotaWorkspace,
  ambilPapan,
  FILTER_KOSONG,
  pindahKartu,
  type DetailWorkspace,
  type FilterTugas,
  type KartuWorkspace,
  type PapanData,
} from '@/api/workspace';
import { Fab, IconButton, SegmentedTabs, useSnackbar } from '@/ui';

import { FilterSheet } from './FilterSheet';
import { KalenderView } from './KalenderView';
import { ListView } from './ListView';
import { PapanView } from './PapanView';
import { PindahkanSheet } from './PindahkanSheet';
import { useResource, useSegarkanSaatFokus } from './useResource';
import { jumlahFilterAktif, lolosFilter } from './util';

type Mode = 'board' | 'list' | 'kalender';

export function TugasTab({ detail, meId }: { detail: DetailWorkspace; meId: string | null }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const ws = detail.workspace.id;
  const [mode, setMode] = useState<Mode>('board');
  const [filter, setFilter] = useState<FilterTugas>(FILTER_KOSONG);
  const [sheetFilter, setSheetFilter] = useState(false);
  const [pindahTugas, setPindahTugas] = useState<KartuWorkspace | null>(null);
  const [versi, setVersi] = useState(0);
  const [anggotaDibuka, setAnggotaDibuka] = useState(false);

  const papan = useResource<PapanData>(`papan:${ws}`, () => ambilPapan(ws));
  const anggota = useResource(anggotaDibuka ? `anggota:${ws}` : null, () => ambilAnggotaWorkspace(ws));

  useSegarkanSaatFokus(papan.muat);

  const boleh = detail.can.edit_tasks && !detail.read_only.read_only;
  const bolehPindah = papan.data ? papan.data.can.move && !papan.data.read_only.read_only : boleh;
  const nFilter = jumlahFilterAktif(filter);

  const jumlahCocok = useMemo(() => {
    if (!papan.data) {
      return null;
    }
    const kolom = papan.data.columns;
    return (draf: FilterTugas): number => kolom.reduce((n, k) => n + k.tasks.filter((t) => lolosFilter(t, draf, meId)).length, 0);
  }, [papan.data, meId]);

  const hapusFilter = useCallback((): void => setFilter((f) => ({ ...FILTER_KOSONG, urut: f.urut, selesai: f.selesai })), []);

  async function pindah(tugas: KartuWorkspace, kolomId: string): Promise<void> {
    setPindahTugas(null);
    const tujuan = papan.data?.columns.find((c) => c.id === kolomId);
    if (!tujuan) {
      return;
    }
    papan.ubah((lama) => ({
      ...lama,
      columns: lama.columns.map((c) => {
        const tanpa = c.tasks.filter((t) => t.id !== tugas.id);
        return c.id === kolomId ? { ...c, tasks: [{ ...tugas, status_id: kolomId, status_category: c.kategori }, ...tanpa] } : { ...c, tasks: tanpa };
      }),
    }));
    try {
      const hasil = await pindahKartu(ws, tugas.id, { status_id: kolomId });
      papan.ubah((lama) => ({ ...lama, columns: lama.columns.map((c) => (c.id === hasil.column.id ? { ...c, tasks: hasil.column.tasks } : c)) }));
      setVersi((v) => v + 1);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      void papan.muat();
      snackbar.show({
        message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Tugas gagal dipindah.',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
    }
  }

  const tugasBaru = (): void => router.push({ pathname: '/tugas/baru', params: { workspace: ws } });

  return (
    <View style={{ flex: 1 }}>
      <View style={s.atas}>
        <View style={{ flex: 1 }}>
          <SegmentedTabs
            value={mode}
            onChange={setMode}
            options={[
              { value: 'board', label: 'Board' },
              { value: 'list', label: 'List' },
              { value: 'kalender', label: 'Kalender' },
            ]}
          />
        </View>
        <IconButton
          icon="sliders-horizontal"
          label={nFilter > 0 ? `Filter, ${nFilter} aktif` : 'Filter'}
          badge={nFilter > 0 ? nFilter : undefined}
          onPress={() => {
            setAnggotaDibuka(true);
            setSheetFilter(true);
          }}
        />
      </View>

      <View style={{ flex: 1 }}>
        {mode === 'board' ? (
          <PapanView papan={papan} filter={filter} meId={meId} boleh={bolehPindah} onHapusFilter={hapusFilter} onPindah={setPindahTugas} onTugasBaru={tugasBaru} />
        ) : mode === 'list' ? (
          <ListView ws={ws} filter={filter} onFilter={setFilter} versi={versi} boleh={bolehPindah} onPindah={setPindahTugas} onTugasBaru={tugasBaru} />
        ) : (
          <KalenderView
            ws={ws}
            namaWs={detail.workspace.name}
            filter={filter}
            meId={meId}
            versi={versi}
            boleh={bolehPindah}
            onPindah={setPindahTugas}
            onLihatTerlambat={() => {
              setFilter({ ...FILTER_KOSONG, tenggat: 'overdue' });
              setMode('list');
            }}
          />
        )}
      </View>

      {boleh ? (
        <View style={[s.fab, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Fab icon="plus" label="Tugas baru" extended onPress={tugasBaru} />
        </View>
      ) : null}

      <FilterSheet
        visible={sheetFilter}
        kunci={detail.workspace.key}
        filter={filter}
        labels={papan.data?.labels ?? []}
        anggota={(anggota.data?.anggota ?? []).map((a) => ({ id: a.id, name: a.name }))}
        modeList={mode === 'list'}
        jumlahCocok={mode === 'list' ? null : jumlahCocok}
        onTerapkan={(f) => {
          setFilter(f);
          setSheetFilter(false);
        }}
        onClose={() => setSheetFilter(false)}
      />
      <PindahkanSheet tugas={pindahTugas} kolom={papan.data?.columns ?? []} tipe={detail.workspace.type} onPilih={(id) => pindahTugas && void pindah(pindahTugas, id)} onClose={() => setPindahTugas(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  atas: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  fab: { position: 'absolute', right: 16 },
});
