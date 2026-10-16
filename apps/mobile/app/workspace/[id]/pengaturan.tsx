/**
 * Pengaturan workspace — baca saja (mockup 05 › 19-9): banner "Tersedia di
 * desktop" + "Kirim tautan ke email saya", lalu Umum, Kolom status, Label.
 * GET /workspace/{ws}/pengaturan. Mengubah = desktop (PLATFORM §3).
 */
import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { ambilPengaturan, type PengaturanData } from '@/api/workspace';
import { GalatMuat, PitaOffline } from '@/features/workspace/bagian';
import { IkonStatus } from '@/features/workspace/ikon';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { hapusCache, useResource } from '@/features/workspace/useResource';
import { warnaPalet } from '@/lib/palette';
import { useTheme } from '@/theme';
import { Badge, Button, Card, DesktopOnlyBanner, EmptyState, Loading, Screen, SubAppBar, Text, useSnackbar } from '@/ui';

const LABEL_VISIBILITAS: Record<string, string> = { private: 'Privat', internal: 'Internal' };

function Isian({ label, nilai, aksi }: { label: string; nilai: string; aksi?: React.ReactNode }): React.JSX.Element {
  return (
    <View style={s.isian}>
      <Text variant="meta" style={{ width: 110 }}>
        {label}
      </Text>
      <Text variant="body" weight={600} style={{ flex: 1, fontSize: 16 }}>
        {nilai}
      </Text>
      {aksi}
    </View>
  );
}

export default function LayarPengaturanWorkspace(): React.JSX.Element {
  const { dark, colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ws = typeof id === 'string' ? id : '';
  const snackbar = useSnackbar();
  const { kirim, mengirim } = useKirimTautan();
  const peng = useResource<PengaturanData>(ws !== '' ? `pengaturan:${ws}` : null, () => ambilPengaturan(ws));
  const d = peng.data;

  return (
    <Screen header={<SubAppBar title="Pengaturan workspace" />} refreshing={peng.menyegarkan} onRefresh={() => { hapusCache(`pengaturan:${ws}`); void peng.muat(); }}>
      {peng.memuat && !d ? (
        <Loading rows={5} />
      ) : peng.galat && !d ? (
        <GalatMuat galat={peng.galat} judul="Pengaturan belum bisa dimuat" onCoba={() => void peng.muat()} />
      ) : d ? (
        <>
          <Text variant="meta">{`${d.workspace.name} · ${d.workspace.key}`}</Text>
          {peng.offline ? <PitaOffline diperbarui={peng.diperbarui} objek="pengaturan" /> : null}
          <DesktopOnlyBanner
            message="Tersedia di desktop. Mengubah kolom status, label, anggota, template, dan arsip dilakukan di RuangKerja web. Ponsel menampilkan versi baca-saja."
            onSendLink={mengirim ? undefined : () => void kirim(`/w/${d.workspace.key}/pengaturan`)}
          />

          <Card>
            <Text variant="h3">Umum</Text>
            <Isian label="Nama" nilai={d.workspace.name} />
            <Isian label="Kode tugas" nilai={d.workspace.key} />
            <Isian label="Jenis" nilai={d.workspace.type_label} />
            <Isian label="Visibilitas" nilai={LABEL_VISIBILITAS[d.workspace.visibility] ?? d.workspace.visibility} />
            {d.workspace.arsip ? <Isian label="Status" nilai="Diarsipkan" /> : null}
            {d.workspace.description ? <Isian label="Deskripsi" nilai={d.workspace.description} /> : null}
            {d.workspace.previous_keys.length > 0 ? <Isian label="Kode lama" nilai={d.workspace.previous_keys.join(', ')} /> : null}
            <Isian
              label="Folder Drive"
              nilai={d.drive.enabled ? (d.drive.folder_name ?? 'Belum dibuat') : 'Drive belum aktif'}
              aksi={d.drive.folder_url ? <Button title="Buka" variant="quiet" size="sm" onPress={() => void Linking.openURL(d.drive.folder_url ?? '').catch(() => snackbar.show({ message: 'Tautan tidak bisa dibuka.', variant: 'warn' }))} /> : undefined}
            />
          </Card>

          <Card>
            <Text variant="h3">Kolom status</Text>
            {d.statuses.length === 0 ? <Text variant="meta">Belum ada kolom.</Text> : null}
            {d.statuses.map((st) => (
              <View key={st.id} style={s.kolom}>
                <IkonStatus kategori={st.kategori} warna={st.color} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{st.name}</Text>
                  <Text variant="meta">{st.kategori_label}</Text>
                </View>
                <Text variant="label" tone="muted">{`${st.tasks_count}`}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <Text variant="h3">Label</Text>
            {d.labels.length === 0 ? <Text variant="meta">Belum ada label.</Text> : null}
            <View style={s.label}>
              {d.labels.map((l) => (
                <View key={l.id} style={[s.pil, { borderColor: colors.border }]}>
                  <View style={[s.titik, { backgroundColor: warnaPalet(l.color, dark) }]} />
                  <Text variant="label" style={{ fontSize: 14 }}>{l.name}</Text>
                  <Badge tone="neutral" dot={false}>{String(l.tasks_count)}</Badge>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : (
        <EmptyState icon="settings" title="Pengaturan tidak tersedia" />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  isian: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  kolom: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  label: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, minHeight: 36 },
  titik: { width: 10, height: 10, borderRadius: 5 },
});
