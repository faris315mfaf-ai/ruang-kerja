/**
 * Template (mockup 05 › 22-9): template Tugas ("Pakai" → buat tugas) dan
 * Workspace ("Pakai" → workspace baru). Dibuat/diubah di desktop.
 * GET /otomasi/templat/tugas · GET /workspace/templat.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ambilTemplatTugas, ambilTemplatWorkspace } from '@/api/workspace';
import { GerbangOtomasi } from '@/features/otomasi/bagian';
import { GalatMuat, PitaOffline } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { Button, Card, DesktopOnlyBanner, EmptyState, Loading, Screen, SegmentedTabs, SubAppBar, Text } from '@/ui';

function Isi(): React.JSX.Element {
  const { kirim, mengirim } = useKirimTautan();
  const tugas = useResource('otomasi:templat-tugas', ambilTemplatTugas);
  const wsTemplat = useResource('workspace:templat', ambilTemplatWorkspace);
  const [tab, setTab] = useState<'tugas' | 'workspace'>('tugas');
  const aktif = tab === 'tugas' ? tugas : wsTemplat;

  return (
    <Screen
      header={<SubAppBar title="Template" />}
      refreshing={aktif.menyegarkan}
      onRefresh={() => {
        void tugas.muat();
        void wsTemplat.muat();
      }}
    >
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tugas', label: 'Tugas', badge: tugas.data?.length ?? null },
          { value: 'workspace', label: 'Workspace', badge: wsTemplat.data?.length ?? null },
        ]}
      />
      <Text variant="meta">Simpan langkah yang sering diulang (checklist, label, estimasi) supaya tugas baru tinggal dipakai.</Text>
      {aktif.offline ? <PitaOffline diperbarui={aktif.diperbarui} objek="daftar" /> : null}

      {aktif.memuat && !aktif.data ? (
        <Loading rows={3} />
      ) : aktif.galat && !aktif.data ? (
        <GalatMuat galat={aktif.galat} judul="Template belum bisa dimuat" onCoba={() => void aktif.muat()} />
      ) : tab === 'tugas' ? (
        (tugas.data ?? []).length === 0 ? (
          <EmptyState icon="layout-template" title="Belum ada template tugas" description="Template tugas dibuat di RuangKerja desktop." />
        ) : (
          (tugas.data ?? []).map((t) => (
            <Card key={t.id}>
              <Text variant="title" weight={700}>
                {t.name}
              </Text>
              <Text variant="meta" style={{ fontSize: 14 }}>
                {[t.workspace ? t.workspace.name : 'Semua workspace', t.checklist.length > 0 ? `checklist ${t.checklist.length}` : null, t.estimate_hours ? `estimasi ${t.estimate_hours} jam` : null, t.labels.length > 0 ? `label ${t.labels.map((l) => l.name).join(', ')}` : null, t.priority > 0 ? t.priority_label : null].filter(Boolean).join(' · ')}
              </Text>
              <View style={s.baris}>
                <Text variant="meta" style={{ flex: 1 }}>{`Dipakai ${t.used_count} kali`}</Text>
                <Button title="Pakai" variant="tonal" size="sm" icon="plus" onPress={() => router.push(`/otomasi/pakai/${t.id}`)} />
              </View>
            </Card>
          ))
        )
      ) : (wsTemplat.data ?? []).length === 0 ? (
        <EmptyState icon="layout-template" title="Belum ada template workspace" description="Simpan workspace sebagai template dari Pengaturan workspace di desktop." />
      ) : (
        (wsTemplat.data ?? []).map((t) => (
          <Card key={t.id}>
            <Text variant="title" weight={700}>
              {t.name}
            </Text>
            <Text variant="meta" style={{ fontSize: 14 }}>
              {[t.type_label, `${t.statuses.length} kolom`, t.labels.length > 0 ? `${t.labels.length} label` : null].filter(Boolean).join(' · ')}
            </Text>
            {t.description ? <Text variant="meta">{t.description}</Text> : null}
            <View style={s.baris}>
              <Text variant="meta" style={{ flex: 1 }}>{`Dipakai ${t.used_count} kali`}</Text>
              <Button title="Pakai" variant="tonal" size="sm" icon="plus" disabled={!t.can_use} disabledReason="Anda tidak berwenang membuat workspace jenis ini." onPress={() => router.push({ pathname: '/workspace/baru', params: { template: t.id } })} />
            </View>
          </Card>
        ))
      )}
      <DesktopOnlyBanner message="Membuat dan mengubah template dilakukan di RuangKerja desktop." onSendLink={mengirim ? undefined : () => void kirim('/otomasi')} />
    </Screen>
  );
}

export default function LayarTemplat(): React.JSX.Element {
  return (
    <GerbangOtomasi judul="Template">
      <Isi />
    </GerbangOtomasi>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
