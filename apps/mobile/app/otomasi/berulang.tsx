/**
 * Tugas berulang (mockup 05 › 22-7, 22-12): jadwal + tanggal berikutnya +
 * jumlah tugas dibuat. Baca saja; membuat/mengubah di desktop.
 * GET /otomasi/berulang.
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ambilBerulang, type BarisBerulang } from '@/api/workspace';
import { GerbangOtomasi } from '@/features/otomasi/bagian';
import { GalatMuat, PitaOffline } from '@/features/workspace/bagian';
import { hariSingkat, LABEL_PRIORITAS } from '@/features/workspace/util';
import { useResource } from '@/features/workspace/useResource';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { Badge, Card, Chip, ChipScroller, DesktopOnlyBanner, EmptyState, Loading, Screen, SubAppBar, Text } from '@/ui';

function Isi(): React.JSX.Element {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  const awal = typeof workspace === 'string' && workspace !== '' ? workspace.toUpperCase() : null;
  const { kirim, mengirim } = useKirimTautan();
  const daftar = useResource('otomasi:berulang:', () => ambilBerulang());
  const [saring, setSaring] = useState<string | null>(awal);
  const data = daftar.data;
  const kunci = useMemo(() => {
    const peta = new Map<string, number>();
    for (const b of data?.berulang ?? []) {
      const k = b.workspace?.key ?? '—';
      peta.set(k, (peta.get(k) ?? 0) + 1);
    }
    return [...peta.entries()];
  }, [data]);
  const tampil = (data?.berulang ?? []).filter((b) => saring === null || (b.workspace?.key ?? '—') === saring);

  return (
    <Screen header={<SubAppBar title="Tugas berulang" />} refreshing={daftar.menyegarkan} onRefresh={() => void daftar.muat()}>
      {daftar.memuat && !data ? (
        <Loading rows={4} />
      ) : daftar.galat && !data ? (
        <GalatMuat galat={daftar.galat} judul="Jadwal belum bisa dimuat" onCoba={() => void daftar.muat()} />
      ) : data ? (
        <>
          {daftar.offline ? <PitaOffline diperbarui={daftar.diperbarui} objek="jadwal" /> : null}
          <DesktopOnlyBanner message="Tersedia di desktop. Membuat dan mengubah tugas berulang dilakukan di RuangKerja web." onSendLink={mengirim ? undefined : () => void kirim('/otomasi')} />
          <Text variant="meta">{`${data.berulang.length} jadwal`}</Text>
          {kunci.length > 1 || saring !== null ? (
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              <Chip label="Semua" count={data.berulang.length} selected={saring === null} onPress={() => setSaring(null)} />
              {kunci.map(([k, n]) => (
                <Chip key={k} label={k} count={n} selected={saring === k} onPress={() => setSaring(k)} />
              ))}
            </ChipScroller>
          ) : null}
          {tampil.length === 0 ? (
            <EmptyState icon="repeat" title="Belum ada tugas berulang" description="Tugas yang dibuat otomatis tiap hari, pekan, atau bulan akan terdaftar di sini." />
          ) : (
            tampil.map((b) => <KartuBerulang key={b.id} b={b} />)
          )}
          <Text variant="meta">Tugas dibuat otomatis tiap pukul 07.00 WIB, bertenggat pada tanggal jadwalnya.</Text>
        </>
      ) : null}
    </Screen>
  );
}

function KartuBerulang({ b }: { b: BarisBerulang }): React.JSX.Element {
  const dijeda = !b.is_active;
  return (
    <Card accessibilityLabel={`${b.title}. ${b.pattern_label}. ${dijeda ? 'Dijeda' : b.next_dates[0] ? `Berikutnya ${hariSingkat(b.next_dates[0])}` : ''}`}>
      <View style={s.baris}>
        <Text variant="title" weight={700} style={{ flex: 1 }}>
          {b.title}
        </Text>
        {dijeda ? (
          <Badge tone="neutral" dot={false}>
            Dijeda
          </Badge>
        ) : null}
      </View>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {[b.workspace?.name, b.assignee_name, `prioritas ${LABEL_PRIORITAS[b.priority]?.toLowerCase() ?? ''}`].filter(Boolean).join(' · ')}
      </Text>
      <Text variant="body" style={{ fontSize: 16 }}>
        {b.pattern_label}
      </Text>
      {!dijeda && b.next_dates.length > 0 ? (
        <View style={s.baris}>
          <Text variant="meta">Berikutnya</Text>
          {b.next_dates.slice(0, 3).map((t) => (
            <Badge key={t} tone="info" dot={false}>
              {hariSingkat(t)}
            </Badge>
          ))}
        </View>
      ) : null}
      <Text variant="meta">{`${dijeda ? 'Dijeda · ' : ''}${b.created_count} tugas dibuat${b.ends_on ? ` · sampai ${hariSingkat(b.ends_on)}` : ''}`}</Text>
    </Card>
  );
}

export default function LayarBerulang(): React.JSX.Element {
  return (
    <GerbangOtomasi judul="Tugas berulang">
      <Isi />
    </GerbangOtomasi>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
