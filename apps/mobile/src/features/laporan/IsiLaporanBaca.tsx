/**
 * Isi laporan baca saja (mockup 31-5, 34-2, 34-3): hambatan, daftar pekerjaan
 * (kode + judul bila boleh dilihat, selain itu "Judul tidak ditampilkan"),
 * persen, jam, "dipindah ke …", ringkasan, catatan/notulensi.
 */
import { StyleSheet, View } from 'react-native';

import type { ItemLaporan, ItemMonitor, KategoriStatus } from '@/api/laporan';
import { fontFamily, useTheme } from '@/theme';
import { Banner, Card, Tag, Text } from '@/ui';

import { angkaJam, namaKategori, ringkasPekerjaan } from './format';

export interface ItemBaca {
  id: string;
  isTask: boolean;
  key: string | null;
  title: string | null;
  note: string;
  percent: number | null;
  hours: number | null;
  after: KategoriStatus | null;
}

export function dariItemLaporan(i: ItemLaporan): ItemBaca {
  return { id: i.id, isTask: i.is_task, key: i.task_key, title: i.task_title, note: i.progress_note, percent: i.percent, hours: i.hours, after: i.status_category_after };
}

export function dariItemMonitor(i: ItemMonitor): ItemBaca {
  return { id: i.id, isTask: i.key !== null || i.task_id !== null, key: i.key, title: i.title, note: i.progress_note, percent: i.percent, hours: i.hours, after: i.status_category_after };
}

function BarisItem({ item, garis }: { item: ItemBaca; garis: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const meta = [item.hours !== null ? `${angkaJam(item.hours)} jam` : null, item.isTask && item.after ? `dipindah ke ${namaKategori(item.after)}` : null].filter(Boolean).join(' · ');
  return (
    <View style={[s.item, garis ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
      <View style={s.kepala}>
        {item.isTask ? (
          <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
            <Text variant="mono" style={{ fontFamily: fontFamily.mono600, fontSize: 15 }}>{`${item.key ?? '—'}  `}</Text>
            {item.title ?? <Text variant="title" tone="muted">Judul tidak ditampilkan</Text>}
          </Text>
        ) : (
          <View style={{ flex: 1 }}>
            <Tag tone="primary">Pekerjaan lain</Tag>
          </View>
        )}
        {item.percent !== null ? (
          <View style={[s.persen, { backgroundColor: colors.surface2 }]}>
            <Text variant="label" tone="muted" style={{ fontSize: 14 }}>{`${item.percent}%`}</Text>
          </View>
        ) : null}
      </View>
      <Text variant="body" style={{ fontSize: 16, lineHeight: 24 }} selectable>
        {item.note}
      </Text>
      {meta !== '' ? (
        <Text variant="meta" style={{ fontSize: 14 }}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

export function IsiLaporanBaca({
  items,
  hours,
  summary,
  blockers,
  notes,
}: {
  items: ItemBaca[];
  hours: number | null;
  summary: string | null;
  blockers: string | null;
  notes: string | null;
}): React.JSX.Element {
  const adaTersembunyi = items.some((i) => i.isTask && i.title === null);
  return (
    <View style={{ gap: 16 }}>
      {blockers ? <Banner tone="warn" icon="triangle-alert" title="Hambatan:" message={blockers} /> : null}
      <View style={s.judul}>
        <Text variant="h3" accessibilityRole="header">{`Pekerjaan · ${items.length}`}</Text>
        {hours ? (
          <Text variant="meta" style={{ fontSize: 14 }}>
            {`${angkaJam(hours)} jam`}
          </Text>
        ) : null}
      </View>
      {items.length === 0 ? (
        <Text variant="meta">Tidak ada pekerjaan tercatat.</Text>
      ) : (
        <Card variant="flat" style={{ paddingVertical: 4 }}>
          {items.map((i, n) => (
            <BarisItem key={i.id} item={i} garis={n > 0} />
          ))}
        </Card>
      )}
      {summary ? (
        <View style={{ gap: 4 }}>
          <Text variant="label" tone="muted">
            Ringkasan
          </Text>
          <Text variant="body" selectable>
            {summary}
          </Text>
        </View>
      ) : null}
      {notes ? (
        <View style={{ gap: 4 }}>
          <Text variant="label" tone="muted">
            Catatan / notulensi
          </Text>
          <Text variant="body" selectable>
            {notes}
          </Text>
        </View>
      ) : null}
      {adaTersembunyi ? (
        <Text variant="meta" style={{ fontSize: 14 }}>
          Judul tugas yang Anda tidak berhak melihat hanya tampil sebagai kode.
        </Text>
      ) : null}
    </View>
  );
}

/** "3 pekerjaan · 7 jam · 16.52 · hambatan" */
export function metaLaporan(jumlah: number, jamTotal: number | null, waktu: string | null, hambatan: boolean): string {
  return [ringkasPekerjaan(jumlah, jamTotal), waktu, hambatan ? 'hambatan' : null].filter(Boolean).join(' · ');
}

const s = StyleSheet.create({
  item: { gap: 6, paddingVertical: 14 },
  kepala: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  persen: { borderRadius: 999, paddingHorizontal: 12, minHeight: 30, justifyContent: 'center' },
  judul: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
