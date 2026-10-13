/**
 * Tautkan tugas ke key result (mockup 06 › 25; O11–O13): tugas tertaut (lepas
 * dengan dialog), cari tugas divisi objective yang terlihat & belum tertaut
 * (judul atau KEY-12), Tautkan; kosong, memuat, galat.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { detailKr, lepasTugas, tautkanTugas, tugasBisaDitautkan, type KeyResult, type Objective, type TugasTertaut } from '@/api/okr';
import { hariTanggal, LABEL_KATEGORI } from '@/features/proyek/format';
import { pesanGalat } from '@/features/proyek/tunda';
import { useResource } from '@/features/workspace/useResource';
import { Button, Card, EmptyState, ErrorState, IconButton, ListRow, Loading, LockedState, Screen, SearchInput, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

export default function LayarTautkanTugas(): React.JSX.Element {
  const { id: pid } = useLocalSearchParams<{ id: string }>();
  const id = typeof pid === 'string' ? pid : '';
  const r = useResource<{ objective: Objective; key_result: KeyResult }>(id ? `okr-kr:${id}` : null, useCallback(() => detailKr(id), [id]));
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<TugasTertaut[] | null>(null);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [menautkan, setMenautkan] = useState<string | null>(null);
  const boleh = r.data?.key_result.can?.link_task ?? false;

  const cari = useCallback(async (kata: string): Promise<void> => {
    try {
      setGalat(null);
      setHasil(await tugasBisaDitautkan(id, kata));
    } catch (err) {
      setGalat({ pesan: pesanGalat(err, 'Tugas gagal dimuat.'), status: err instanceof ApiError ? err.status : 0 });
    }
  }, [id]);

  useEffect(() => {
    if (!boleh) return undefined;
    const t = setTimeout(() => void cari(q), q === '' ? 0 : 300);
    return () => clearTimeout(t);
  }, [q, boleh, cari]);

  const d = r.data;
  if (!d) {
    return <Screen header={<SubAppBar title="Tautkan tugas" />}>{r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Loading rows={4} />}</Screen>;
  }
  if (!boleh) {
    return (
      <Screen header={<SubAppBar title="Tautkan tugas" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState reason="Hanya pemilik key result, pemilik objective, atau Kepala Divisi yang menautkan tugas." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }
  const tertaut = d.key_result.tasks ?? [];

  const tautkan = async (t: TugasTertaut): Promise<void> => {
    setMenautkan(t.id);
    try {
      const h = await tautkanTugas(id, t.id);
      r.ubah((l) => ({ ...l, key_result: { ...l.key_result, tasks: [...(l.key_result.tasks ?? []), h.task] } }));
      setHasil((l) => (l ? l.filter((x) => x.id !== t.id) : l));
      snackbar.show({ message: h.message, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Tugas gagal ditautkan.'), variant: 'bad' });
    } finally {
      setMenautkan(null);
    }
  };

  const lepas = async (t: TugasTertaut): Promise<void> => {
    const ok = await dialog.confirm({ title: 'Lepas tautan?', message: `"${t.title}" tidak lagi tertaut ke key result ini.`, confirmLabel: 'Lepas', destructive: true });
    if (!ok) return;
    try {
      await lepasTugas(id, t.id);
      r.ubah((l) => ({ ...l, key_result: { ...l.key_result, tasks: (l.key_result.tasks ?? []).filter((x) => x.id !== t.id) } }));
      snackbar.show({ message: 'Tautan dilepas.', variant: 'ok' });
      void cari(q);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Tautan gagal dilepas.'), variant: 'bad' });
    }
  };

  const sub = (t: TugasTertaut): string => [t.key, LABEL_KATEGORI[t.status_category] ?? t.status_category, t.assignee?.name, t.due_date ? `tenggat ${hariTanggal(t.due_date)}` : null].filter(Boolean).join(' · ');

  return (
    <Screen header={<SubAppBar title="Tautkan tugas" />}>
      <Text variant="meta" style={{ fontSize: 15 }}>
        {d.key_result.title}
      </Text>
      <Text variant="h3" accessibilityRole="header">{`Tertaut · ${tertaut.length}`}</Text>
      {tertaut.length === 0 ? (
        <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
          Belum ada tugas tertaut.
        </Text>
      ) : (
        <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
          {tertaut.map((t, i) => (
            <ListRow key={t.id} title={t.title} subtitle={sub(t)} trailing={<IconButton icon="unlink" label={`Lepas tautan ${t.title}`} variant="ghost" onPress={() => void lepas(t)} />} divider={i > 0} />
          ))}
        </Card>
      )}
      <Text variant="h3" accessibilityRole="header">
        Tugas divisi
      </Text>
      <SearchInput value={q} onChangeText={setQ} placeholder="Cari judul atau kode (mis. OPS-12)" />
      <View accessibilityLiveRegion="polite">
        {galat ? (
          <ErrorState kind={galat.status === 0 ? 'offline' : 'umum'} message={galat.pesan} onRetry={() => void cari(q)} />
        ) : hasil === null ? (
          <Loading rows={4} label="Memuat tugas…" />
        ) : hasil.length === 0 ? (
          <EmptyState variant="plain" icon="search-x" title={q ? 'Tidak ada tugas yang cocok' : 'Tidak ada tugas yang bisa ditautkan'} description="Hanya tugas di workspace divisi objective, tim divisi itu, atau proyek berdivisi utama itu." />
        ) : (
          <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
            {hasil.map((t, i) => (
              <ListRow key={t.id} title={t.title} subtitle={sub(t)} trailing={<Button title="Tautkan" size="sm" variant="tonal" loading={menautkan === t.id} onPress={() => void tautkan(t)} />} divider={i > 0} />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
