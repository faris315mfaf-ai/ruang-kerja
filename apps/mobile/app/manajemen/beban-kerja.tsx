/**
 * Beban kerja (mockup 06 › 18; M4): per divisi (terpadat dulu), buka divisi →
 * bilah per orang (tugas terbuka, terlambat, estimasi jam bila ada). Tanpa
 * peringkat atau skor; kosong; memuat; offline.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { bebanKerja, type BebanKerja } from '@/api/manajemen';
import { angka } from '@/features/proyek/format';
import { useTarik } from '@/features/proyek/useTarik';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { useTheme } from '@/theme';
import { Avatar, Card, EmptyState, ErrorState, Icon, Loading, Pressable, Progress, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function LayarBebanKerja(): React.JSX.Element {
  const { colors } = useTheme();
  const r = useResource<BebanKerja>('manajemen:beban', useCallback(() => bebanKerja(), []));
  const { menarik, tarik } = useTarik(r.muat);
  const [buka, setBuka] = useState<string | null>(null);
  const d = r.data;
  const maksDivisi = Math.max(1, ...(d?.divisions.map((x) => x.open) ?? [1]));

  return (
    <Screen header={<SubAppBar title="Beban kerja" />} refreshing={menarik} onRefresh={tarik}>
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="beban kerja" /> : null}
      {!d ? (
        r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Loading rows={6} label="Memuat beban kerja…" />
      ) : d.divisions.length === 0 ? (
        <EmptyState icon="users" title="Tidak ada tugas terbuka" description="Belum ada tugas terbuka yang ditugaskan ke karyawan." />
      ) : (
        <>
          <Text variant="meta" style={{ fontSize: 15 }}>{`${angka(d.total.open)} tugas terbuka · ${angka(d.total.people)} orang · ${angka(d.total.overdue)} terlambat`}</Text>
          {d.divisions.map((v) => {
            const k = v.id ?? v.name;
            const terbuka = buka === k;
            const maksOrang = Math.max(1, ...v.people.map((p) => p.open));
            return (
              <Card key={k} variant="tight" style={{ gap: 12 }}>
                <Pressable
                  scaleTo={1}
                  onPress={() => setBuka(terbuka ? null : k)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: terbuka }}
                  accessibilityLabel={`${v.name}: ${v.open} tugas terbuka, ${v.overdue} terlambat, ${v.people.length} orang`}
                  style={{ gap: 8, minHeight: 48 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="title" style={{ flex: 1 }}>
                      {v.name}
                    </Text>
                    <Text variant="label">{`${v.open}`}</Text>
                    <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
                  </View>
                  <Progress value={(v.open / maksDivisi) * 100} />
                  <Text variant="meta">{`${v.people.length} orang · ${v.overdue} terlambat${v.estimate_hours !== null ? ` · ${angka(v.estimate_hours, 1)} jam estimasi` : ''}`}</Text>
                </Pressable>
                {terbuka
                  ? v.people.map((p) => (
                      <View key={p.user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }} accessible accessibilityLabel={`${p.user.name}: ${p.open} terbuka, ${p.overdue} terlambat`}>
                        <Avatar name={p.user.name} size="sm" />
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                              {p.user.name}
                            </Text>
                            <Text variant="meta">{`${p.open}${p.overdue > 0 ? ` · ${p.overdue} terlambat` : ''}`}</Text>
                          </View>
                          <Progress value={(p.open / maksOrang) * 100} />
                        </View>
                      </View>
                    ))
                  : null}
              </Card>
            );
          })}
          <Text variant="meta">Jumlah tugas terbuka hari ini. Bukan ukuran kinerja; tidak ada peringkat.</Text>
        </>
      )}
    </Screen>
  );
}
