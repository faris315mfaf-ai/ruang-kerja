/**
 * Hub "Otomasi & berulang" (mockup 05 › 22-1): aturan otomasi, tugas berulang,
 * template. Dibaca saja + jeda aturan + pakai template; membuat/mengubah di
 * desktop. Di balik `features.automation`.
 */
import { router, useLocalSearchParams } from 'expo-router';

import { ambilAturan, ambilBerulang, ambilTemplatTugas, ambilTemplatWorkspace, type DaftarAturan } from '@/api/workspace';
import { GerbangOtomasi } from '@/features/otomasi/bagian';
import { bukaSegera } from '@/features/settings/ComingSoon';
import { hariSingkat } from '@/features/workspace/util';
import { useResource } from '@/features/workspace/useResource';
import { Card, ListRow, Screen, SubAppBar, Text } from '@/ui';

function Isi(): React.JSX.Element {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  const ws = typeof workspace === 'string' && workspace !== '' ? workspace : undefined;
  const aturan = useResource<DaftarAturan>(`otomasi:aturan:${ws ?? ''}`, () => ambilAturan(ws));
  const berulang = useResource(`otomasi:berulang:${ws ?? ''}`, () => ambilBerulang(ws));
  const templatTugas = useResource('otomasi:templat-tugas', ambilTemplatTugas);
  const templatWs = useResource('workspace:templat', ambilTemplatWorkspace);

  const kueri = ws ? { workspace: ws } : {};
  const berikutnya = (berulang.data?.berulang ?? []).filter((b) => b.is_active && b.next_dates.length > 0).map((b) => b.next_dates[0] ?? '').sort()[0];
  const jumlahWs = new Set((templatTugas.data ?? []).filter((t) => t.workspace).map((t) => t.workspace?.id)).size;

  return (
    <Screen
        header={<SubAppBar title="Otomasi & berulang" />}
        refreshing={aturan.menyegarkan}
        onRefresh={() => {
          void aturan.muat();
          void berulang.muat();
          void templatTugas.muat();
          void templatWs.muat();
        }}
      >
        <Card variant="flat">
          <ListRow
            icon="workflow"
            iconTone="teal"
            title="Aturan otomasi"
            subtitle={aturan.data ? `${aturan.data.stats.active} aktif · ${aturan.data.stats.runs_7d} eksekusi 7 hari` : 'Jika … maka …'}
            onPress={() => router.push({ pathname: '/otomasi/aturan', params: kueri })}
          />
          <ListRow
            divider
            icon="repeat"
            iconTone="blue"
            title="Tugas berulang"
            subtitle={berulang.data ? `${berulang.data.berulang.length} jadwal${berikutnya ? ` · berikutnya ${hariSingkat(berikutnya)}` : ''}` : 'Jadwal tugas otomatis'}
            onPress={() => router.push({ pathname: '/otomasi/berulang', params: kueri })}
          />
          <ListRow
            divider
            icon="layout-template"
            iconTone="warn"
            title="Template"
            subtitle={templatTugas.data ? `${templatTugas.data.length} tugas · ${templatWs.data?.length ?? jumlahWs} workspace` : 'Tugas dan workspace'}
            onPress={() => router.push('/otomasi/templat')}
          />
          <ListRow
            divider
            icon="gauge"
            iconTone="ok"
            title="Kinerja saya"
            subtitle="Tugas selesai dan tepat waktu"
            onPress={() => bukaSegera({ judul: 'Kinerja saya', ikon: 'gauge' })}
          />
        </Card>
        <Text variant="meta">Otomasi dan tugas berulang berjalan di server; hasilnya (tugas baru, notifikasi) muncul di Tugas dan Inbox.</Text>
    </Screen>
  );
}

export default function LayarOtomasi(): React.JSX.Element {
  return (
    <GerbangOtomasi judul="Otomasi & berulang">
      <Isi />
    </GerbangOtomasi>
  );
}
