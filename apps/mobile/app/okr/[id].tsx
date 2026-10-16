/**
 * Detail objective (mockup 06 › 23, 26-7…26-8, 27; O2, O5, O6, O10):
 * kepala (divisi, kuartal, status, PIC), cincin besar + diharapkan, KPI,
 * kartu KR (Check-in · Detail), Tambah KR; menu ⋯: Ubah, Tutup objective
 * (dialog), Buka kembali (ditutup), Hapus objective (desktop). Varian peran
 * mengikuti `can` server; ditutup = baca saja.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { detailObjective, tutupObjective, ubahObjective, type DetailObjective, type HasilKr, type KeyResult } from '@/api/okr';
import { CheckinSheet } from '@/features/okr/CheckinSheet';
import { labelKuartal, pecahanPersen } from '@/features/okr/format';
import { KartuKr, LencanaStatusObjective, nadaCincinOkr } from '@/features/okr/komponen';
import { hariTanggal } from '@/features/proyek/format';
import { CincinProgres, PetakAngka } from '@/features/proyek/komponen';
import { pesanGalat } from '@/features/proyek/tunda';
import { useTarik } from '@/features/proyek/useTarik';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource, useSegarkanSaatFokus } from '@/features/workspace/useResource';
import { Avatar, Banner, BottomSheet, Button, Card, EmptyState, ErrorState, Loading, Panel, Screen, SheetAction, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

export default function LayarObjective(): React.JSX.Element {
  const { id: pid } = useLocalSearchParams<{ id: string }>();
  const id = typeof pid === 'string' ? pid : '';
  const r = useResource<DetailObjective>(id ? `okr-obj:${id}` : null, useCallback(() => detailObjective(id), [id]));
  useSegarkanSaatFokus(r.muat);
  const { menarik, tarik } = useTarik(r.muat);
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { kirim, mengirim } = useKirimTautan();
  const [menu, setMenu] = useState(false);
  const [checkin, setCheckin] = useState<KeyResult | null>(null);
  const cadangan = useRef<DetailObjective | null>(null);
  const d = r.data;

  if (!d) {
    return (
      <Screen header={<SubAppBar title="Objective" />}>
        {r.galat ? (
          <ErrorState
            kind={errorKindFromStatus(r.galat.status)}
            title={r.galat.status === 404 ? 'Objective tidak ditemukan' : 'Objective gagal dimuat'}
            message={r.galat.status === 404 ? 'Objective ini tidak ada, fitur OKR mati, atau Anda tidak punya akses.' : r.galat.message}
            onRetry={r.galat.status === 404 ? undefined : () => void r.muat()}
          />
        ) : (
          <Loading rows={5} label="Memuat objective…" />
        )}
      </Screen>
    );
  }

  const o = d.objective;
  const can = o.can ?? { update: false, close: false, add_key_result: false };
  const krs = o.key_results ?? [];
  const ditutup = o.status === 'closed';
  const semuaCheckin = krs.flatMap((k) => k.checkins ?? []);
  const terakhir = semuaCheckin.map((c) => c.date).sort().pop() ?? null;
  const jumlahTugas = krs.reduce((a, k) => a + (k.tasks?.length ?? 0), 0);
  const selisih = Math.round((o.progress.value - o.progress.expected) * 100);
  const offline = r.offline;

  const tutup = async (): Promise<void> => {
    setMenu(false);
    const ok = await dialog.confirm({
      title: 'Tutup objective?',
      message: 'Objective dan key result-nya menjadi baca saja. Kepala Divisi atau Direksi bisa membukanya kembali.',
      confirmLabel: 'Tutup objective',
      destructive: true,
    });
    if (!ok) return;
    try {
      const hasil = await tutupObjective(o.id);
      r.ubah(() => hasil);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Objective gagal ditutup.'), variant: 'bad' });
    }
  };

  const bukaKembali = async (): Promise<void> => {
    setMenu(false);
    try {
      const hasil = await ubahObjective(o.id, { quarter: o.quarter, title: o.title, description: o.description, owner_id: o.owner.id, status: 'active' });
      r.ubah(() => hasil);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Objective gagal dibuka kembali.'), variant: 'bad' });
    }
  };

  const optimis = (kr: KeyResult, nilai: number): void => {
    cadangan.current = d;
    r.ubah((lama) => ({ ...lama, objective: { ...lama.objective, key_results: (lama.objective.key_results ?? []).map((k) => (k.id === kr.id ? { ...k, current_value: nilai } : k)) } }));
  };
  const terapkan = (hasil: HasilKr): void => {
    r.ubah((lama) => ({
      ...lama,
      objective: { ...lama.objective, ...hasil.objective, can: hasil.objective.can ?? lama.objective.can, key_results: (lama.objective.key_results ?? []).map((k) => (k.id === hasil.key_result.id ? { ...k, ...hasil.key_result } : k)) },
    }));
    cadangan.current = null;
  };

  const adaMenu = (can.update || can.close) && !offline;

  return (
    <Screen header={<SubAppBar title="Objective" actions={adaMenu ? [{ icon: 'ellipsis-vertical', label: 'Menu objective', onPress: () => setMenu(true) }] : []} />} refreshing={menarik} onRefresh={tarik}>
      {offline ? <PitaOffline diperbarui={r.diperbarui} objek="objective" /> : null}
      {ditutup ? (
        <Banner tone="neutral" icon="lock" message="Objective ini sudah ditutup dan hanya bisa dibaca." actionLabel={can.update && !offline ? 'Buka kembali' : undefined} onAction={() => void bukaKembali()} />
      ) : null}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Text variant="meta" style={{ fontSize: 15 }}>{`${o.division.name} · ${labelKuartal(o.quarter)}`}</Text>
          <LencanaStatusObjective o={o} />
        </View>
        <Text variant="h2" accessibilityRole="header">
          {o.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar name={o.owner.name} size="sm" />
          <Text variant="label">{`PIC ${o.owner.name}`}</Text>
        </View>
        {o.description ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            {o.description}
          </Text>
        ) : null}
      </View>
      <Card style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <CincinProgres nilai={o.progress.value * 100} rencana={o.progress.expected * 100} ukuran={96} tebal={10} nada={nadaCincinOkr(o)} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title">{o.progress.status_label}</Text>
          <Text variant="label">{`Diharapkan ${pecahanPersen(o.progress.expected)}`}</Text>
          <Text variant="meta">{`${selisih >= 0 ? '+' : '−'}${Math.abs(selisih)} poin dari bagian kuartal yang berlalu (${d.quarter.day} dari ${d.quarter.days} hari)`}</Text>
          {o.progress.regressed > 0 ? <Text variant="meta" tone="danger">{`${o.progress.regressed} key result mundur`}</Text> : null}
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <PetakAngka label="Key result" nilai={String(krs.length)} />
        <PetakAngka label="Check-in terakhir" nilai={terakhir ? hariTanggal(terakhir) : '—'} />
        <PetakAngka label="Tugas tertaut" nilai={String(jumlahTugas)} />
      </View>
      <Panel title="Key result" actionLabel={can.add_key_result && !offline ? 'Tambah' : undefined} onAction={() => router.push(`/okr/kr-form?objective=${o.id}` as never)}>
        {krs.length === 0 ? (
          <EmptyState
            variant="plain"
            icon="target"
            title="Belum ada key result"
            description={can.add_key_result ? 'Tambahkan 2–5 hasil terukur untuk objective ini.' : 'Pemilik objective belum menambahkan key result.'}
            actionLabel={can.add_key_result && !offline ? 'Tambah key result' : undefined}
            onAction={() => router.push(`/okr/kr-form?objective=${o.id}` as never)}
          />
        ) : (
          krs.map((k) => <KartuKr key={k.id} kr={k} bolehCheckin={(k.can?.checkin ?? false) && !offline} onCheckin={() => setCheckin(k)} />)
        )}
      </Panel>
      {can.update ? <Button title="Hapus objective (desktop)" variant="quiet" size="sm" icon="monitor" disabled={mengirim} onPress={() => void kirim('/okr')} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}

      <CheckinSheet
        kr={checkin}
        visible={checkin !== null}
        onClose={() => setCheckin(null)}
        onOptimis={(v) => checkin && optimis(checkin, v)}
        onSelesai={terapkan}
        onBatal={() => {
          const c = cadangan.current;
          if (c) r.ubah(() => c);
        }}
      />
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={o.title}>
        {can.update && !ditutup ? <SheetAction icon="pencil" label="Ubah objective" onPress={() => { setMenu(false); router.push(`/okr/form?id=${o.id}` as never); }} /> : null}
        {can.close && !ditutup ? <SheetAction icon="lock" label="Tutup objective" description="Jadikan baca saja" onPress={() => void tutup()} /> : null}
        {can.update && ditutup ? <SheetAction icon="lock-open" label="Buka kembali" onPress={() => void bukaKembali()} /> : null}
        {can.update ? <SheetAction icon="monitor" label="Hapus objective" description="Tersedia di desktop · kirim tautan ke email saya" onPress={() => { setMenu(false); void kirim('/okr'); }} /> : null}
      </BottomSheet>
    </Screen>
  );
}
