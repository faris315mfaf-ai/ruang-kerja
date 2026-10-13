/**
 * Pakai template tugas (mockup 05 › 22-10): judul, workspace, tenggat →
 * POST /workspace/{ws}/tugas-dari-templat. Label template dicocokkan dengan
 * nama; yang belum ada dibuat bila Anda admin workspace, selain itu dilewati.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { ambilDaftarWorkspace, ambilTemplatTugas, pakaiTemplatTugas, type DaftarWorkspace, type TemplatTugas } from '@/api/workspace';
import { GerbangOtomasi } from '@/features/otomasi/bagian';
import { GalatMuat } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { BottomSheet, Button, DateInput, EmptyState, Field, Input, Loading, Radio, Screen, SelectField, SubAppBar, Text, useSnackbar } from '@/ui';

function Isi(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snackbar = useSnackbar();
  const templat = useResource<TemplatTugas[]>('otomasi:templat-tugas', ambilTemplatTugas);
  const daftar = useResource<DaftarWorkspace>('workspace:daftar', ambilDaftarWorkspace);
  const t = templat.data?.find((x) => x.id === id) ?? null;

  const [judul, setJudul] = useState<string | null>(null);
  const [wsId, setWsId] = useState<string | null>(null);
  const [tenggat, setTenggat] = useState('');
  const [sheet, setSheet] = useState(false);
  const [membuat, setMembuat] = useState(false);
  const [galat, setGalat] = useState<Record<string, string>>({});

  const boleh = useMemo(
    () =>
      (daftar.data?.groups ?? [])
        .flatMap((g) => g.items)
        .filter((w) => w.is_member && !w.arsip && !w.view_only && w.my_role !== 'viewer' && (t?.workspace ? w.id === t.workspace.id : true)),
    [daftar.data, t],
  );
  const pilih = boleh.find((w) => w.id === wsId) ?? (boleh.length === 1 ? boleh[0] : null) ?? null;
  const nilaiJudul = judul ?? t?.title ?? '';

  async function buat(): Promise<void> {
    const baru: Record<string, string> = {};
    if (nilaiJudul.trim() === '') {
      baru.title = 'Judul tugas wajib diisi.';
    }
    if (!pilih) {
      baru.workspace = 'Pilih workspace tujuan.';
    }
    setGalat(baru);
    if (!t || !pilih || Object.keys(baru).length > 0) {
      return;
    }
    setMembuat(true);
    try {
      const h = await pakaiTemplatTugas(pilih.id, { template_id: t.id, title: nilaiJudul.trim(), due_date: tenggat || undefined });
      snackbar.show({ message: h.message, variant: 'ok' });
      router.replace(`/tugas/${h.task.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const peta: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          peta[k] = v[0] ?? err.message;
        }
        setGalat(Object.keys(peta).length > 0 ? peta : { title: err.message });
      } else {
        snackbar.show({ message: err instanceof ApiError ? err.message : 'Tugas gagal dibuat.', variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
      }
    } finally {
      setMembuat(false);
    }
  }

  const footer = (
    <>
      <Button title="Batal" variant="outline" onPress={() => router.back()} disabled={membuat} style={{ flex: 1 }} />
      <Button title="Buat tugas" icon="plus" onPress={() => void buat()} loading={membuat} loadingTitle="Membuat…" disabled={!t} style={{ flex: 1.4 }} />
    </>
  );

  return (
    <Screen header={<SubAppBar title={t ? `Pakai “${t.name}”` : 'Pakai template'} />} footer={footer}>
      {templat.memuat && !t ? (
        <Loading rows={3} />
      ) : templat.galat && !t ? (
        <GalatMuat galat={templat.galat} judul="Template belum bisa dimuat" onCoba={() => void templat.muat()} />
      ) : !t ? (
        <EmptyState icon="circle-help" title="Template tidak ditemukan" description="Template ini sudah dihapus atau tidak terlihat oleh Anda." actionLabel="Kembali" onAction={() => router.back()} />
      ) : (
        <>
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            {t.checklist.length > 0 ? `Membuat tugas dengan checklist ${t.checklist.length} butir` : 'Membuat tugas dari template'}
            {t.estimate_hours ? ` dan estimasi ${t.estimate_hours} jam` : ''}.
          </Text>
          <Field label="Judul" required error={galat.title}>
            <Input value={nilaiJudul} onChangeText={setJudul} maxLength={255} invalid={galat.title !== undefined} accessibilityLabel="Judul tugas" />
          </Field>
          <Field label="Workspace" required error={galat.workspace ?? galat.workspace_id}>
            <SelectField
              value={pilih?.name ?? null}
              placeholder={daftar.memuat ? 'Memuat workspace…' : 'Pilih workspace'}
              disabled={t.workspace !== null && boleh.length <= 1}
              onPress={() => setSheet(true)}
              invalid={galat.workspace !== undefined}
              accessibilityLabel="Workspace tujuan"
            />
          </Field>
          <DateInput label="Tenggat (opsional)" value={tenggat} onChange={setTenggat} error={galat.due_date} />
          {t.labels.length > 0 ? (
            <Text variant="meta">{`Label “${t.labels.map((l) => l.name).join('”, “')}” dicocokkan dengan nama; yang belum ada dibuat bila Anda admin workspace, selain itu dilewati.`}</Text>
          ) : null}
        </>
      )}
      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Workspace tujuan" scrollable>
        {boleh.length === 0 ? <Text variant="meta">Tidak ada workspace yang bisa Anda ubah.</Text> : null}
        {boleh.map((w) => (
          <Radio key={w.id} selected={pilih?.id === w.id} label={w.name} description={`${w.key} · ${w.type_label}`} onSelect={() => { setWsId(w.id); setSheet(false); }} />
        ))}
      </BottomSheet>
    </Screen>
  );
}

export default function LayarPakaiTemplat(): React.JSX.Element {
  return (
    <GerbangOtomasi judul="Pakai template">
      <Isi />
    </GerbangOtomasi>
  );
}
