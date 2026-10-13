/**
 * Milestone proyek (mockup 06 › 11): daftar berstatus (selesai, selesai
 * terlambat, terlewat disorot, berjalan, akan datang) + baris target proyek,
 * FAB "Milestone baru" dan ⋯ (Ubah · Tandai selesai · Hapus + Urungkan) untuk
 * PIC/admin; baca saja untuk lainnya; kosong.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MilestoneDetail } from '@/api/proyek';
import { hariTanggal, LABEL_MILESTONE, nadaMilestone } from '@/features/proyek/format';
import { useAksiMilestone } from '@/features/proyek/useAksiMilestone';
import { useProyek } from '@/features/proyek/useProyek';
import { useTarik } from '@/features/proyek/useTarik';
import { PitaOffline } from '@/features/workspace/bagian';
import { useTheme } from '@/theme';
import { Badge, Banner, BottomSheet, Card, EmptyState, ErrorState, Fab, Icon, IconButton, Loading, Pressable, Screen, SheetAction, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function LayarMilestone(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { key: param } = useLocalSearchParams<{ key: string }>();
  const key = typeof param === 'string' ? param : '';
  const r = useProyek(key);
  const { menarik, tarik } = useTarik(r.muat);
  const aksi = useAksiMilestone(key, () => void r.muat());
  const [menu, setMenu] = useState<MilestoneDetail | null>(null);
  const d = r.data;
  const boleh = (d?.can.manage_milestones ?? false) && !r.offline;
  const base = `/proyek/${encodeURIComponent(d?.project.key ?? key)}/milestone`;
  const daftar = (d?.milestones ?? []).filter((m) => !aksi.tersembunyi.has(m.id));

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<SubAppBar title={`Milestone${d ? ` · ${d.project.key}` : ''}`} />} refreshing={menarik} onRefresh={tarik} contentStyle={{ paddingBottom: 120 }}>
        {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="milestone" /> : null}
        {!d ? (
          r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Loading rows={5} label="Memuat milestone…" />
        ) : (
          <>
            {!d.can.manage_milestones ? <Banner tone="neutral" icon="eye" message="Hanya PIC dan admin workspace yang menambah atau mengubah milestone." /> : null}
            {daftar.length === 0 ? (
              <EmptyState icon="flag" title="Belum ada milestone" description="Milestone menandai titik penting proyek dan dipakai sebagai penanda di burn-up." actionLabel={boleh ? 'Milestone baru' : undefined} onAction={() => router.push(`${base}/form` as never)} />
            ) : (
              <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
                {daftar.map((m, i) => {
                  const terlewat = m.status === 'missed';
                  return (
                    <View
                      key={m.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingLeft: 16,
                        minHeight: 72,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: colors.divider,
                        backgroundColor: terlewat ? colors.dangerSoft : undefined,
                      }}
                    >
                      <Icon name={m.status === 'completed' || m.status === 'completed_late' ? 'circle-check' : terlewat ? 'circle-alert' : 'flag'} size={20} color={terlewat ? colors.danger : m.completed_at ? colors.success : colors.muted} />
                      <Pressable
                        scaleTo={1}
                        style={{ flex: 1, paddingVertical: 12 }}
                        onPress={() => router.push(`${base}/${m.id}` as never)}
                        accessibilityRole="button"
                        accessibilityLabel={`${m.name}, ${LABEL_MILESTONE[m.status]}, target ${hariTanggal(m.target_date)}`}
                      >
                        <Text variant="title" numberOfLines={2}>
                          {m.name}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
                          <Badge tone={nadaMilestone(m.status)} dot>
                            {LABEL_MILESTONE[m.status]}
                          </Badge>
                          <Text variant="meta">{`${hariTanggal(m.target_date)}${m.tasks.length ? ` · ${m.tasks.length} tugas` : ''}`}</Text>
                        </View>
                      </Pressable>
                      {boleh ? <IconButton icon="ellipsis-vertical" label={`Aksi ${m.name}`} variant="ghost" onPress={() => setMenu(m)} /> : <IconButton icon="chevron-right" label={`Buka ${m.name}`} variant="ghost" onPress={() => router.push(`${base}/${m.id}` as never)} />}
                    </View>
                  );
                })}
              </Card>
            )}
            {d.project.target_date ? (
              <Card variant="tight" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Icon name="target" size={20} color={colors.primary} />
                <Text variant="body" style={{ flex: 1, fontSize: 15 }}>
                  Target proyek
                </Text>
                <Text variant="label">{hariTanggal(d.project.target_date)}</Text>
              </Card>
            ) : null}
          </>
        )}
      </Screen>
      {boleh ? <Fab label="Milestone baru" extended onPress={() => router.push(`${base}/form` as never)} style={{ position: 'absolute', right: 16, bottom: insets.bottom + 16 }} /> : null}
      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.name}>
        {menu ? (
          <>
            <SheetAction icon="eye" label="Lihat detail" onPress={() => { const m = menu; setMenu(null); router.push(`${base}/${m.id}` as never); }} />
            <SheetAction icon="pencil" label="Ubah" onPress={() => { const m = menu; setMenu(null); router.push(`${base}/form?id=${m.id}` as never); }} />
            <SheetAction icon={menu.completed_at ? 'rotate-ccw' : 'circle-check'} label={menu.completed_at ? 'Buka kembali' : 'Tandai selesai'} onPress={() => { const m = menu; setMenu(null); void aksi.tandai(m); }} />
            <SheetAction icon="trash-2" label="Hapus" tone="danger" onPress={() => { const m = menu; setMenu(null); void aksi.hapus(m); }} />
          </>
        ) : null}
      </BottomSheet>
    </View>
  );
}
