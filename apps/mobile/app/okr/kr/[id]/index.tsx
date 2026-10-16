/**
 * Detail key result (mockup 06 › 24-1; O3, O9, O10, O13): progres vs
 * diharapkan, grafik rencana vs aktual, riwayat check-in, tugas tertaut
 * (buka/lepas), Check-in (optimistis), Ubah, Hapus. Deep link
 * `ruangkerja://okr/kr/{id}/check-in` membuka sheet check-in.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { detailKr, hapusKr, lepasTugas, type HasilKr, type KeyResult, type Kuartal, type Objective } from '@/api/okr';
import { CheckinSheet } from '@/features/okr/CheckinSheet';
import { labelKuartal, nadaOkr, nilaiKr, pecahanPersen } from '@/features/okr/format';
import { bukaObjective, GrafikKr } from '@/features/okr/komponen';
import { hariTanggal, LABEL_KATEGORI } from '@/features/proyek/format';
import { bukaTugas } from '@/features/proyek/komponen';
import { pesanGalat } from '@/features/proyek/tunda';
import { useTarik } from '@/features/proyek/useTarik';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource, useSegarkanSaatFokus } from '@/features/workspace/useResource';
import { Badge, Banner, Button, Card, EmptyState, ErrorState, IconButton, ListRow, Loading, Panel, Progress, Screen, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

type DataKr = { objective: Objective; key_result: KeyResult };

/** Rentang kuartal kalender dari "2026-Q4" (hanya untuk sumbu grafik). */
function kuartalDari(k: string): Kuartal {
  const c = /^(\d{4})-Q([1-4])$/.exec(k);
  const y = Number(c?.[1] ?? 2026);
  const q = Number(c?.[2] ?? 1);
  const mAwal = (q - 1) * 3 + 1;
  const akhir = new Date(Date.UTC(y, mAwal + 2, 0));
  const pad = (n: number): string => String(n).padStart(2, '0');
  return { key: k, label: labelKuartal(k), start: `${y}-${pad(mAwal)}-01`, end: `${y}-${pad(mAwal + 2)}-${pad(akhir.getUTCDate())}`, days: 0, day: 0, elapsed: 0, week: 0, weeks: 0 };
}

export default function LayarKeyResult(): React.JSX.Element {
  const { id: pid, checkin: pc } = useLocalSearchParams<{ id: string; checkin?: string }>();
  const id = typeof pid === 'string' ? pid : '';
  const r = useResource<DataKr>(id ? `okr-kr:${id}` : null, useCallback(() => detailKr(id), [id]));
  useSegarkanSaatFokus(r.muat);
  const { menarik, tarik } = useTarik(r.muat);
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [sheet, setSheet] = useState(false);
  const cadangan = useRef<DataKr | null>(null);
  const sudahBuka = useRef(false);
  const d = r.data;

  const bolehCheckin = (d?.key_result.can?.checkin ?? false) && d?.objective.status !== 'closed' && !r.offline;
  useEffect(() => {
    if (pc === '1' && bolehCheckin && !sudahBuka.current) {
      sudahBuka.current = true;
      setSheet(true);
    }
  }, [pc, bolehCheckin]);

  if (!d) {
    return (
      <Screen header={<SubAppBar title="Key result" />}>
        {r.galat ? (
          <ErrorState kind={errorKindFromStatus(r.galat.status)} title={r.galat.status === 404 ? 'Key result tidak ditemukan' : undefined} message={r.galat.status === 404 ? 'Key result ini tidak ada atau Anda tidak punya akses.' : r.galat.message} onRetry={r.galat.status === 404 ? undefined : () => void r.muat()} />
        ) : (
          <Loading rows={5} label="Memuat key result…" />
        )}
      </Screen>
    );
  }

  const kr = d.key_result;
  const o = d.objective;
  const can = kr.can ?? { update: false, checkin: false, link_task: false, delete: false };
  const ditutup = o.status === 'closed';
  const riwayat = [...(kr.checkins ?? [])].reverse();

  const hapus = async (): Promise<void> => {
    const ok = await dialog.confirm({ title: 'Hapus key result?', message: `"${kr.title}" beserta riwayat check-in dan tautan tugasnya dihapus.`, confirmLabel: 'Hapus', destructive: true });
    if (!ok) return;
    try {
      await hapusKr(kr.id);
      snackbar.show({ message: 'Key result dihapus.', variant: 'ok' });
      router.back();
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Key result gagal dihapus.'), variant: 'bad' });
    }
  };

  const lepas = async (taskId: string, judul: string): Promise<void> => {
    const ok = await dialog.confirm({ title: 'Lepas tautan?', message: `"${judul}" tidak lagi tertaut ke key result ini. Tugasnya tidak berubah.`, confirmLabel: 'Lepas', destructive: true });
    if (!ok) return;
    try {
      await lepasTugas(kr.id, taskId);
      r.ubah((l) => ({ ...l, key_result: { ...l.key_result, tasks: (l.key_result.tasks ?? []).filter((t) => t.id !== taskId) } }));
      snackbar.show({ message: 'Tautan dilepas.', variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Tautan gagal dilepas.'), variant: 'bad' });
    }
  };

  const terapkan = (h: HasilKr): void => {
    r.ubah((l) => ({ objective: { ...l.objective, ...h.objective }, key_result: { ...l.key_result, ...h.key_result } }));
    cadangan.current = null;
  };

  return (
    <Screen
      header={<SubAppBar title="Key result" />}
      refreshing={menarik}
      onRefresh={tarik}
      footer={
        !ditutup && (can.checkin || can.update) ? (
          <>
            {can.update ? <Button title="Ubah" variant="outline" icon="pencil" disabled={r.offline} style={{ flex: 1 }} onPress={() => router.push(`/okr/kr-form?objective=${o.id}&id=${kr.id}` as never)} /> : null}
            {can.checkin ? <Button title="Check-in" icon="circle-plus" disabled={!bolehCheckin} disabledReason={r.offline ? 'Butuh koneksi' : undefined} style={{ flex: 1.4 }} onPress={() => setSheet(true)} /> : null}
          </>
        ) : undefined
      }
    >
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="key result" /> : null}
      {ditutup ? <Banner tone="neutral" icon="lock" message="Objective sudah ditutup; key result hanya bisa dibaca." /> : null}
      <Card variant="tight" onPress={() => bukaObjective(o.id)} accessibilityLabel={`Objective ${o.title}`} style={{ gap: 2 }}>
        <Text variant="meta">{`${o.division.name} · ${labelKuartal(o.quarter)}`}</Text>
        <Text variant="label" numberOfLines={2}>
          {o.title}
        </Text>
      </Card>
      <View style={{ gap: 6 }}>
        <Text variant="h2" accessibilityRole="header">
          {kr.title}
        </Text>
        <Text variant="meta" style={{ fontSize: 15 }}>{`${kr.owner.name} · bobot ${kr.weight} · target ${nilaiKr(kr, kr.target_value)}`}</Text>
        <Badge tone={nadaOkr(kr.progress.status)} dot>
          {kr.progress.status_label}
        </Badge>
      </View>
      <Card style={{ gap: 10 }}>
        <Text variant="title">{`${nilaiKr(kr, kr.current_value)} dari ${nilaiKr(kr, kr.target_value)} · ${pecahanPersen(kr.progress.value)}`}</Text>
        <Progress value={Math.max(0, Math.min(1, kr.progress.value)) * 100} marker={kr.progress.expected * 100} label={`Progres ${pecahanPersen(kr.progress.value)}, diharapkan ${pecahanPersen(kr.progress.expected)}`} />
        <Text variant="meta">{`Awal ${nilaiKr(kr, kr.start_value)} · diharapkan ${pecahanPersen(kr.progress.expected)}${kr.target_value < kr.start_value ? ' · makin kecil makin baik' : ''}`}</Text>
        <GrafikKr kr={kr} kuartal={kuartalDari(o.quarter)} />
      </Card>
      <Panel title={`Riwayat check-in · ${riwayat.length}`}>
        {riwayat.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Belum ada check-in.
          </Text>
        ) : (
          riwayat.map((c, i) => (
            <ListRow
              key={c.id}
              title={`${nilaiKr(kr, c.value)} · ${hariTanggal(c.date)}`}
              subtitle={[c.confidence !== null ? `Keyakinan ${c.confidence}/10` : null, c.author?.name, c.note].filter(Boolean).join(' · ')}
              divider={i > 0}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>
      <Panel title={`Tugas tertaut · ${kr.tasks?.length ?? 0}`} actionLabel={can.link_task && !ditutup && !r.offline ? 'Tautkan' : undefined} onAction={() => router.push(`/okr/kr/${kr.id}/tugas` as never)}>
        {(kr.tasks ?? []).length === 0 ? (
          <EmptyState variant="plain" icon="link" title="Belum ada tugas tertaut" description="Tautan tugas memberi konteks; nilai key result tetap lewat check-in." />
        ) : (
          (kr.tasks ?? []).map((t, i) => (
            <ListRow
              key={t.id}
              title={t.title}
              subtitle={`${t.key} · ${LABEL_KATEGORI[t.status_category] ?? t.status_category}${t.assignee ? ` · ${t.assignee.name}` : ''}`}
              onPress={() => bukaTugas(t.id)}
              trailing={can.link_task && !ditutup && !r.offline ? <IconButton icon="unlink" label={`Lepas tautan ${t.title}`} variant="ghost" size={44} onPress={() => void lepas(t.id, t.title)} /> : undefined}
              divider={i > 0}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>
      {can.delete && !ditutup ? <Button title="Hapus key result" variant="danger" icon="trash-2" disabled={r.offline} onPress={() => void hapus()} /> : null}
      <CheckinSheet
        kr={sheet ? kr : null}
        visible={sheet}
        onClose={() => setSheet(false)}
        onOptimis={(v) => {
          cadangan.current = d;
          r.ubah((l) => ({ ...l, key_result: { ...l.key_result, current_value: v } }));
        }}
        onSelesai={terapkan}
        onBatal={() => {
          const c = cadangan.current;
          if (c) r.ubah(() => c);
        }}
      />
    </Screen>
  );
}
