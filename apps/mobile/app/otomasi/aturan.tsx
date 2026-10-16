/**
 * Aturan otomasi (mockup 05 › 22-2, 22-5, 22-6, 22-11): KPI, chip workspace,
 * kartu Jika/Maka dengan sakelar jeda (owner/admin saja). Membuat/mengubah di
 * desktop. GET /otomasi/aturan · PATCH /otomasi/aturan/{id}/jeda.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ambilAturan, jedaAturan, type BarisAturan, type DaftarAturan } from '@/api/workspace';
import { GerbangOtomasi, KartuAturan } from '@/features/otomasi/bagian';
import { GalatMuat, PitaOffline } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { Banner, Chip, ChipScroller, DesktopOnlyBanner, EmptyState, KpiCard, Loading, Screen, SubAppBar, useDialog, useSnackbar } from '@/ui';

function Isi(): React.JSX.Element {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  const awal = typeof workspace === 'string' && workspace !== '' ? workspace.toUpperCase() : null;
  const snackbar = useSnackbar();
  const dialog = useDialog();
  const { kirim, mengirim } = useKirimTautan();
  const daftar = useResource<DaftarAturan>('otomasi:aturan:', () => ambilAturan());
  const [saring, setSaring] = useState<string | null>(awal);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const data = daftar.data;

  const kunciWs = useMemo(() => {
    const peta = new Map<string, number>();
    for (const a of data?.aturan ?? []) {
      peta.set(a.workspace.key, (peta.get(a.workspace.key) ?? 0) + 1);
    }
    return [...peta.entries()];
  }, [data]);
  const tampil = (data?.aturan ?? []).filter((a) => saring === null || a.workspace.key === saring);
  const adaKelola = (data?.aturan ?? []).some((a) => a.can_manage);

  async function jeda(a: BarisAturan, paused: boolean): Promise<void> {
    if (paused) {
      const ya = await dialog.confirm({
        title: `Jeda aturan “${a.name}”?`,
        message: 'Aturan tidak berjalan sampai diaktifkan lagi. Riwayat eksekusi tetap tersimpan.',
        confirmLabel: 'Jeda',
      });
      if (!ya) {
        return;
      }
    }
    setSibuk(a.id);
    try {
      const h = await jedaAturan(a.id, paused);
      daftar.ubah((lama) => ({ ...lama, aturan: lama.aturan.map((x) => (x.id === a.id ? { ...x, ...h.aturan } : x)) }));
      snackbar.show({ message: h.message, variant: 'ok' });
      void daftar.muat();
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Aturan gagal diubah.', variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
    } finally {
      setSibuk(null);
    }
  }

  return (
    <Screen header={<SubAppBar title="Aturan otomasi" />} refreshing={daftar.menyegarkan} onRefresh={() => void daftar.muat()}>
      {daftar.memuat && !data ? (
        <Loading rows={4} />
      ) : daftar.galat && !data ? (
        <GalatMuat galat={daftar.galat} judul="Aturan belum bisa dimuat" onCoba={() => void daftar.muat()} />
      ) : data ? (
        <>
          {daftar.offline ? <PitaOffline diperbarui={daftar.diperbarui} objek="daftar" /> : null}
          {!adaKelola && data.aturan.length > 0 ? <Banner tone="neutral" icon="eye" message="Hanya Owner atau Admin workspace yang bisa mengubah aturan. Anda melihat daftar saja." /> : null}
          <DesktopOnlyBanner
            message="Tersedia di desktop. Pembuat aturan lengkap (beberapa kondisi dan aksi) ada di RuangKerja web."
            onSendLink={mengirim ? undefined : () => void kirim('/otomasi')}
          />
          <View style={s.kpi}>
            <KpiCard label="Aturan aktif" value={String(data.stats.active)} style={s.kpiItem} />
            <KpiCard label="Eksekusi 7 hari" value={String(data.stats.runs_7d)} style={s.kpiItem} />
            <KpiCard label="Gagal 7 hari" value={String(data.stats.failed_7d)} delta={data.stats.failed_7d > 0 ? 'Cek riwayat' : undefined} deltaTone="danger" style={s.kpiItem} />
          </View>
          {kunciWs.length > 1 || saring !== null ? (
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              <Chip label="Semua" count={data.aturan.length} selected={saring === null} onPress={() => setSaring(null)} />
              {kunciWs.map(([k, n]) => (
                <Chip key={k} label={k} count={n} selected={saring === k} onPress={() => setSaring(k)} />
              ))}
            </ChipScroller>
          ) : null}
          {tampil.length === 0 ? (
            <EmptyState icon="workflow" title="Belum ada aturan" description="Contoh: saat tugas pindah ke Selesai, beri tahu Kepala Divisi dan tambah label Ditinjau." />
          ) : (
            tampil.map((a) => (
              <KartuAturan key={a.id} aturan={a} sibuk={sibuk === a.id} onPress={() => router.push(`/otomasi/aturan/${a.id}`)} onJeda={a.can_manage ? (p) => void jeda(a, p) : undefined} />
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

export default function LayarAturanOtomasi(): React.JSX.Element {
  return (
    <GerbangOtomasi judul="Aturan otomasi">
      <Isi />
    </GerbangOtomasi>
  );
}

const s = StyleSheet.create({
  kpi: { flexDirection: 'row', gap: 10 },
  kpiItem: { flex: 1, minWidth: 0 },
});
