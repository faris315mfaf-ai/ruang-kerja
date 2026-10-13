/**
 * Form milestone baru/ubah (mockup 06 › 12-2…12-6; P8/P9): nama (wajib ≤160),
 * target (wajib, pemilih tanggal), deskripsi, tugas terkait (pemilih multi dari
 * `task_options`). Galat 422 per field; "Buang perubahan?" saat kembali.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatMilestone, ubahMilestone, type DetailProyek, type MilestoneDetail } from '@/api/proyek';
import { LABEL_KATEGORI } from '@/features/proyek/format';
import { pesanGalat } from '@/features/proyek/tunda';
import { useJagaBuang } from '@/features/proyek/useJagaBuang';
import { useProyek } from '@/features/proyek/useProyek';
import { BottomSheet, Button, Checkbox, Chip, DateInput, EmptyState, ErrorState, Field, Input, LockedState, Screen, SearchInput, Skeleton, SubAppBar, Text, errorKindFromStatus, useSnackbar } from '@/ui';

export default function LayarFormMilestone(): React.JSX.Element {
  const { key: pk, id: pid } = useLocalSearchParams<{ key: string; id?: string }>();
  const key = typeof pk === 'string' ? pk : '';
  const id = typeof pid === 'string' && pid !== '' ? pid : null;
  const r = useProyek(key);
  const d = r.data;
  const lama = id ? (d?.milestones.find((m) => m.id === id) ?? null) : null;

  if (!d) {
    return (
      <Screen header={<SubAppBar title={id ? 'Ubah milestone' : 'Milestone baru'} />}>
        {r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Skeleton height={260} radiusPx={24} />}
      </Screen>
    );
  }
  if (!d.can.manage_milestones) {
    return (
      <Screen header={<SubAppBar title="Milestone" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState reason="Hanya PIC dan admin workspace yang mengubah milestone." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }
  if (id && !lama) {
    return (
      <Screen header={<SubAppBar title="Ubah milestone" />}>
        <EmptyState icon="flag" title="Milestone tidak ditemukan" actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }
  return <Isian d={d} lama={lama} muatUlang={() => void r.muat()} offline={r.offline} />;
}

function Isian({ d, lama, muatUlang, offline }: { d: DetailProyek; lama: MilestoneDetail | null; muatUlang: () => void; offline: boolean }): React.JSX.Element {
  const snackbar = useSnackbar();
  const [nama, setNama] = useState(lama?.name ?? '');
  const [target, setTarget] = useState(lama?.target_date ?? '');
  const [desk, setDesk] = useState(lama?.description ?? '');
  const [tugas, setTugas] = useState<string[]>(lama?.tasks.map((t) => t.id) ?? []);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [pilih, setPilih] = useState(false);
  const [cari, setCari] = useState('');
  const berubah = nama !== (lama?.name ?? '') || target !== (lama?.target_date ?? '') || desk !== (lama?.description ?? '') || tugas.join() !== (lama?.tasks.map((t) => t.id).join() ?? '');
  const jaga = useJagaBuang(berubah && !menyimpan, 'Buang perubahan?', 'Milestone yang Anda tulis belum disimpan.');

  const opsi = d.task_options;
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q === '' ? opsi : opsi.filter((t) => t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [opsi, cari]);
  const label = (tid: string): string => opsi.find((t) => t.id === tid)?.code ?? lama?.tasks.find((t) => t.id === tid)?.code ?? 'Tugas';

  const simpan = async (): Promise<void> => {
    const g: Record<string, string> = {};
    if (nama.trim() === '') g.name = 'Nama milestone wajib diisi.';
    if (target === '') g.target_date = 'Target tanggal wajib diisi.';
    setGalat(g);
    if (Object.keys(g).length > 0) return;
    setMenyimpan(true);
    const isian = { name: nama.trim(), target_date: target, description: desk.trim() === '' ? null : desk.trim(), task_ids: tugas };
    try {
      const hasil = lama ? await ubahMilestone(d.project.key, lama.id, isian) : await buatMilestone(d.project.key, isian);
      jaga.izinkanKeluar();
      snackbar.show({ message: hasil.message, variant: 'ok' });
      muatUlang();
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const b: Record<string, string> = {};
        for (const [f, p] of Object.entries(err.errors)) if (p[0]) b[f.startsWith('task_ids') ? 'task_ids' : f] = p[0];
        setGalat(b);
      } else {
        snackbar.show({ message: pesanGalat(err, 'Milestone gagal disimpan.'), variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
      }
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Screen
      header={<SubAppBar title={lama ? 'Ubah milestone' : 'Milestone baru'} />}
      footer={
        <>
          <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button title="Simpan" icon="check" loading={menyimpan} loadingTitle="Menyimpan…" disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} style={{ flex: 1.4 }} onPress={() => void simpan()} />
        </>
      }
    >
      <Text variant="meta" style={{ fontSize: 15 }}>{`${d.project.key} · ${d.project.name}`}</Text>
      <Field label="Nama milestone" required error={galat.name || null} counter={`${nama.length}/160`}>
        <Input value={nama} onChangeText={setNama} maxLength={160} invalid={!!galat.name} placeholder="Mis. Materi & landing page siap" returnKeyType="next" accessibilityLabel="Nama milestone" />
      </Field>
      <DateInput label="Target" required value={target} onChange={setTarget} error={galat.target_date || null} />
      <Field label="Deskripsi" hint="Opsional" error={galat.description || null}>
        <Input value={desk} onChangeText={setDesk} multiline maxLength={1000} placeholder="Apa yang harus siap pada tanggal ini?" accessibilityLabel="Deskripsi milestone" />
      </Field>
      <Field label="Tugas terkait" hint={opsi.length === 0 ? 'Belum ada tugas di proyek ini.' : `${tugas.length} dipilih`} error={galat.task_ids || null}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tugas.map((tid) => (
            <Chip key={tid} label={label(tid)} variant="tonal" selected onDismiss={() => setTugas((l) => l.filter((x) => x !== tid))} />
          ))}
          {opsi.length > 0 ? <Chip label="Pilih tugas" icon="plus" onPress={() => setPilih(true)} /> : null}
        </View>
      </Field>
      <BottomSheet visible={pilih} onClose={() => setPilih(false)} title="Tugas terkait" showClose scrollable snapPoints={['85%']}>
        <View style={{ gap: 12 }}>
          <SearchInput value={cari} onChangeText={setCari} placeholder="Cari judul atau kode tugas" />
          {tersaring.length === 0 ? (
            <Text variant="body" tone="muted">
              Tidak ada tugas yang cocok.
            </Text>
          ) : (
            tersaring.slice(0, 100).map((t) => (
              <Checkbox
                key={t.id}
                checked={tugas.includes(t.id)}
                onChange={(v) => setTugas((l) => (v ? [...l, t.id] : l.filter((x) => x !== t.id)))}
                label={`${t.code} · ${t.title} (${LABEL_KATEGORI[t.status_category] ?? t.status_category})`}
              />
            ))
          )}
          <Button title={`Selesai · ${tugas.length} dipilih`} onPress={() => setPilih(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
