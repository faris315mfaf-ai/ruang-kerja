/**
 * Mode "Rencana saya": lajur Hari ini · Minggu ini · Nanti dari rencana
 * pribadi (`task_plans`), plus "Tugas baru" (ditugaskan orang lain, belum
 * diterima). Hanya terlihat oleh pemiliknya.
 */
import { StyleSheet, View } from 'react-native';

import type { BarisTugas, ItemRencana, LajurRencana, Perencana, TugasBaruMasuk } from '@/api/tugas';
import { radius, useTheme } from '@/theme';
import { EmptyState, Icon, Pressable, Tag, Text, type IconName } from '@/ui';
import { waktuRelatif } from '@/lib/format';

import { PriorityBars, UbinWorkspace } from './ikon';
import { SwipeRow, type AksiGeser } from './SwipeRow';
import { TugasKartu } from './TugasKartu';
import { LABEL_LAJUR, hariSingkat, akhirPekan } from './util';

/** Ubah item rencana jadi baris kartu (field yang tak ada diberi nilai netral). */
export function itemKeBaris(i: ItemRencana): BarisTugas {
  const kategori = i.status?.category ?? (i.done ? 'done' : 'todo');
  return {
    id: i.id,
    key: i.key,
    number: i.number,
    title: i.title,
    workspace: { id: '', key: i.workspace.key, name: i.workspace.name, type: i.workspace.type },
    status: { id: i.status?.id ?? '', name: i.status?.name ?? (i.done ? 'Selesai' : 'Todo'), category: kategori, is_done: i.done },
    priority: { value: i.priority, label: '' },
    due_date: i.due_date,
    start_date: null,
    completed_at: i.completed_at,
    assignees: [],
    assignee_people: [],
    labels: [],
    checklist: i.checklist ?? null,
    days_late: i.days_late,
    group: 'nanti',
    plan: { bucket: i.auto ? null : i.lane, lane: i.lane },
    source: 'manual',
  };
}

const IKON_LAJUR: Record<LajurRencana, IconName> = { today: 'sun', week: 'calendar', later: 'inbox' };

export function RencanaView({
  planner,
  onBuka,
  onRencanakan,
  onTerima,
  onSelesai,
  onMenu,
}: {
  planner: Perencana;
  onBuka: (id: string) => void;
  onRencanakan: (id: string, judul: string, key: string, lajur: LajurRencana | null) => void;
  onTerima: (t: TugasBaruMasuk) => void;
  onSelesai: (i: ItemRencana) => void;
  onMenu: (i: ItemRencana) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const total = planner.counts.today + planner.counts.week + planner.counts.later + planner.counts.incoming;
  if (total === 0) {
    return <EmptyState icon="sun" title="Rencana Anda masih kosong" description="Rencanakan tugas dari daftar: geser kartu atau tahan lama lalu pilih Rencanakan." />;
  }
  return (
    <View style={{ gap: 16 }}>
      {planner.incoming.length > 0 ? (
        <View style={{ gap: 8 }}>
          <View style={s.kepala}>
            <Icon name="sparkles" size={20} color={colors.link} />
            <Text variant="title" weight={700}>
              Tugas baru
            </Text>
            <Text variant="title" weight={700} tone="muted">
              {planner.incoming.length}
            </Text>
          </View>
          {planner.incoming.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onTerima(t)}
              scaleTo={0.99}
              accessibilityRole="button"
              accessibilityLabel={`Tugas baru ${t.key} ${t.title}${t.assigned_by ? ` dari ${t.assigned_by}` : ''}. Ketuk untuk merencanakan`}
              style={[s.baru, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="title" numberOfLines={2}>
                  {t.title}
                </Text>
                <View style={s.meta}>
                  <Text variant="mono" style={{ fontSize: 13, color: colors.muted }}>
                    {t.key}
                  </Text>
                  <UbinWorkspace nama={t.workspace.name} jenis={t.workspace.type} size={20} />
                  <Tag tone="primary">Tugas baru</Tag>
                  <Text variant="meta" numberOfLines={1}>
                    {t.assigned_by ? `dari ${t.assigned_by}` : ''}
                    {t.assigned_at ? ` · ${waktuRelatif(t.assigned_at)}` : ''}
                  </Text>
                </View>
              </View>
              <PriorityBars nilai={t.priority} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {(['today', 'week', 'later'] as LajurRencana[]).map((l) =>
        planner.lanes[l].length === 0 ? null : (
          <View key={l} style={{ gap: 8 }}>
            <View style={s.kepala}>
              <Icon name={IKON_LAJUR[l]} size={20} color={l === 'today' ? colors.warning : colors.text} />
              <Text variant="title" weight={700} style={l === 'today' ? { color: colors.warning } : undefined}>
                {LABEL_LAJUR[l]}
              </Text>
              <Text variant="title" weight={700} style={l === 'today' ? { color: colors.warning } : { color: colors.muted }}>
                {planner.counts[l]}
              </Text>
              <Text variant="meta">
                {l === 'today' ? `· ${hariSingkat(planner.today)}` : l === 'week' ? `· sampai ${hariSingkat(akhirPekan(planner.today))}` : ''}
              </Text>
            </View>
            {planner.lanes[l].map((i) => {
              const aksi: AksiGeser[] = [
                { label: 'Pindah', icon: 'calendar-clock', tone: 'soft', onPress: () => onRencanakan(i.id, i.title, i.key, i.auto ? null : i.lane) },
              ];
              if (!i.done && i.can_complete !== false) {
                aksi.push({ label: 'Selesai', icon: 'check', tone: 'primary', onPress: () => onSelesai(i) });
              }
              return (
                <SwipeRow key={i.id} aksi={i.done ? [aksi[0] as AksiGeser] : aksi}>
                  <TugasKartu
                    baris={itemKeBaris(i)}
                    hariIni={planner.today}
                    onPress={() => onBuka(i.id)}
                    onLongPress={() => onMenu(i)}
                    catatan={
                      i.carried ? (
                        <View style={s.meta}>
                          <Icon name="corner-down-right" size={15} color={colors.muted} />
                          <Text variant="meta" weight={600}>
                            Terbawa dari kemarin
                          </Text>
                        </View>
                      ) : undefined
                    }
                  />
                </SwipeRow>
              );
            })}
          </View>
        ),
      )}
      <Text variant="meta" align="center">
        Rencana ini pribadi: tidak mengubah tugas dan tidak terlihat orang lain.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, rowGap: 4 },
  baru: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.cardTight, borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 14 },
});
