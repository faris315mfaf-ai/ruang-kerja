/**
 * Tab Ringkasan (proyek, baca saja — dashboard proyek penuh = Bagian 5) dan
 * tab Catatan (jalan masuk ke modul Catatan: daftar + "Catatan baru").
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { buatCatatan, catatanWorkspace } from '@/api/endpoints';
import type { WorkspaceNotes } from '@/api/types';
import type { DetailWorkspace } from '@/api/workspace';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { tanggalDariYMD, waktuRelatif, ymdHariIni } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, Banner, Card, Dialog, EmptyState, Fab, Field, Icon, IconTile, Input, KpiCard, Loading, Pressable, Text, useSnackbar, type Tone } from '@/ui';

import { GalatMuat, PitaOffline, TabScroll } from './bagian';
import { selisihHari } from './util';
import { useResource } from './useResource';

const NADA_KESEHATAN: Record<string, Tone> = { on_track: 'success', at_risk: 'warning', off_track: 'danger' };

export function RingkasanTab({ detail }: { detail: DetailWorkspace }): React.JSX.Element {
  const { colors } = useTheme();
  const { kirim, mengirim } = useKirimTautan();
  const p = detail.project;
  if (!p) {
    return (
      <TabScroll>
        <EmptyState icon="briefcase" title="Bukan workspace proyek" description="Ringkasan tersedia untuk workspace jenis proyek." />
      </TabScroll>
    );
  }
  const sisa = p.target_date ? selisihHari(ymdHariIni(), p.target_date) : null;
  return (
    <TabScroll>
      <Card>
        <View style={s.baris}>
          {p.status_label ? <Badge tone="info">{p.status_label}</Badge> : null}
          {p.health_label ? <Badge tone={NADA_KESEHATAN[p.health ?? ''] ?? 'neutral'}>{p.health_label}</Badge> : <Badge tone="neutral">Belum ada penilaian</Badge>}
        </View>
        <Text variant="meta">{p.last_update_at ? `Update PIC ${waktuRelatif(p.last_update_at)}` : 'Belum ada update dari PIC.'}</Text>
      </Card>
      <View style={s.baris}>
        <View style={{ flex: 1 }}>
          <KpiCard label="Tugas terbuka" value={String(detail.counts.open_tasks)} />
        </View>
        <View style={{ flex: 1 }}>
          <KpiCard label="Terlambat" value={String(detail.counts.overdue_tasks)} delta={detail.counts.overdue_tasks > 0 ? 'Perlu perhatian' : undefined} deltaTone="danger" />
        </View>
      </View>
      <Card variant="tight">
        <View style={s.baris}>
          <IconTile icon="calendar-days" tone="blue" />
          <View style={{ flex: 1 }}>
            <Text variant="title">Jadwal</Text>
            <Text variant="meta">{`${p.start_date ? tanggalDariYMD(p.start_date) : '—'} → ${p.target_date ? tanggalDariYMD(p.target_date) : '—'}`}</Text>
          </View>
          {sisa !== null ? (
            <Badge tone={sisa < 0 ? 'danger' : sisa <= 7 ? 'warning' : 'neutral'} dot={false}>
              {sisa < 0 ? `Lewat ${-sisa} hari` : `${sisa} hari lagi`}
            </Badge>
          ) : null}
        </View>
        <View style={s.baris}>
          <IconTile icon="users" tone="teal" />
          <View style={{ flex: 1 }}>
            <Text variant="title">Tim</Text>
            <Text variant="meta">{`${detail.counts.members} anggota`}</Text>
          </View>
        </View>
      </Card>
      <Banner
        tone="info"
        icon="monitor"
        message="Milestone, risiko, burn-up, dan arahan Direksi tersedia di dashboard proyek (desktop)."
        actionLabel={mengirim ? 'Mengirim…' : 'Kirim tautan ke email saya'}
        onAction={() => void kirim(`/w/${detail.workspace.key}/ringkasan`)}
      />
      <Text variant="meta" style={{ color: colors.muted }}>
        Status kesehatan ditetapkan PIC, bukan dihitung otomatis.
      </Text>
    </TabScroll>
  );
}

export function CatatanTab({ detail }: { detail: DetailWorkspace }): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const ws = detail.workspace.id;
  const cat = useResource<WorkspaceNotes>(`catatan:${ws}`, () => catatanWorkspace(ws));
  const [dialog, setDialog] = useState(false);
  const [judul, setJudul] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [membuat, setMembuat] = useState(false);
  const data = cat.data;

  async function buat(): Promise<void> {
    if (membuat) {
      return;
    }
    const j = judul.trim();
    if (j === '') {
      setGalat('Judul catatan wajib diisi.');
      return;
    }
    setMembuat(true);
    setGalat(null);
    try {
      const baru = await buatCatatan(ws, j);
      setDialog(false);
      setJudul('');
      router.push(`/catatan/${baru.id}` as never);
    } catch (err) {
      setGalat(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal membuat catatan.');
      if (err instanceof ApiError && err.status === 0) {
        snackbar.show({ message: 'Tidak ada koneksi.', variant: 'offline' });
      }
    } finally {
      setMembuat(false);
    }
  }

  if (cat.memuat && !data) {
    return (
      <TabScroll>
        <Loading label="Memuat catatan…" rows={4} />
      </TabScroll>
    );
  }
  if (cat.galat && !data) {
    return <GalatMuat galat={cat.galat} judul="Catatan belum bisa dimuat" onCoba={() => void cat.muat()} />;
  }
  if (!data) {
    return <View />;
  }

  return (
    <View style={{ flex: 1 }}>
      <TabScroll onRefresh={cat.muat} ruangFab={data.can_create}>
        {cat.offline ? <PitaOffline diperbarui={cat.diperbarui} objek="daftar" /> : null}
        {data.notes.length === 0 ? (
          <EmptyState icon="notebook-pen" title="Belum ada catatan" description={data.can_create ? 'Ketuk “Catatan baru” untuk memulai.' : 'Anda hanya dapat membaca catatan workspace ini.'} />
        ) : (
          <Card variant="flat">
            {data.notes.map((n, i) => (
              <Pressable
                key={n.id}
                onPress={n.kind === 'folder' ? undefined : () => router.push(`/catatan/${n.id}` as never)}
                disabled={n.kind === 'folder'}
                scaleTo={1}
                accessibilityRole="button"
                accessibilityLabel={n.kind === 'folder' ? `Folder ${n.title}` : `Buka catatan ${n.title}`}
                style={[s.catatan, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
              >
                <IconTile icon={n.kind === 'folder' ? 'folder' : 'file-text'} tone={n.kind === 'folder' ? 'neutral' : 'blue'} />
                <View style={{ flex: 1 }}>
                  <Text variant="title" numberOfLines={2}>
                    {n.title}
                  </Text>
                  <Text variant="meta">{n.kind === 'folder' ? 'Folder' : `Diperbarui ${waktuRelatif(n.updated_at)}${n.penyunting ? ` · ${n.penyunting}` : ''}`}</Text>
                </View>
                {n.kind === 'folder' ? null : <Icon name="chevron-right" size={20} />}
              </Pressable>
            ))}
          </Card>
        )}
        <Text variant="meta" align="center">
          Editor dan notulensi dirinci di modul Catatan.
        </Text>
      </TabScroll>
      {data.can_create ? (
        <View style={[s.fab, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Fab icon="plus" label="Catatan baru" extended onPress={() => { setJudul(''); setGalat(null); setDialog(true); }} />
        </View>
      ) : null}
      <Dialog
        visible={dialog}
        title="Catatan baru"
        onClose={() => (membuat ? undefined : setDialog(false))}
        actions={[
          { label: 'Batal', onPress: () => setDialog(false), disabled: membuat },
          { label: 'Buat', onPress: () => void buat(), variant: 'primary', loading: membuat },
        ]}
      >
        <Field label="Judul" error={galat} hint={galat ? undefined : `Di workspace ${detail.workspace.name}`}>
          <Input value={judul} onChangeText={setJudul} placeholder="Judul catatan" maxLength={200} autoFocus accessibilityLabel="Judul catatan" onSubmitEditing={() => void buat()} />
        </Field>
      </Dialog>
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  catatan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 68 },
  fab: { position: 'absolute', right: 16 },
});
