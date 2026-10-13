/**
 * Kartu tugas untuk "Tugas saya": cincin status, judul, key mono + workspace +
 * tenggat berwarna, prioritas di kanan. Terlambat berbingkai merah.
 */
import { StyleSheet, View } from 'react-native';

import type { BarisTugas } from '@/api/tugas';
import { ChipMenunggu, type StatusSinkronUi } from '@/offline/ChipMenunggu';
import { radius, useTheme } from '@/theme';
import { Icon, Pressable, Tag, Text } from '@/ui';

import { PriorityBars, StatusRing, UbinWorkspace } from './ikon';
import { LABEL_PRIORITAS, teksTenggat } from './util';

export function TugasKartu({
  baris,
  hariIni,
  onPress,
  onLongPress,
  tampilkanWorkspace = true,
  menunggu = false,
  sinkron,
  catatan,
  terpilih = false,
}: {
  baris: BarisTugas;
  hariIni: string;
  onPress: () => void;
  onLongPress?: () => void;
  tampilkanWorkspace?: boolean;
  menunggu?: boolean;
  /** Perubahan di HP belum diterima server (overlay offline): chip "Menunggu sinkron" / "Gagal sinkron". */
  sinkron?: StatusSinkronUi;
  /** Baris tambahan di bawah meta (mis. "Terbawa dari kemarin"). */
  catatan?: React.ReactNode;
  /** Sedang terbuka di panel detail (tablet dua panel). */
  terpilih?: boolean;
}): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const tenggat = teksTenggat(baris, hariIni);
  const warnaTenggat = tenggat?.tone === 'danger' ? colors.danger : tenggat?.tone === 'warning' ? colors.warning : colors.muted;
  const terlambat = tenggat?.tone === 'danger' && !baris.status.is_done;
  const selesai = baris.status.is_done || baris.status.category === 'canceled';
  const label = [
    baris.key,
    baris.title,
    baris.status.name,
    tenggat?.text,
    baris.priority.value > 0 ? `prioritas ${LABEL_PRIORITAS[baris.priority.value] ?? ''}` : null,
    sinkron === 'menunggu' ? 'menunggu sinkron' : sinkron === 'gagal' ? 'gagal sinkron' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={terpilih ? { selected: true } : undefined}
      style={[
        s.kartu,
        {
          backgroundColor: terpilih ? colors.linkSoft : colors.surface,
          borderColor: terpilih ? colors.primary : terlambat ? colors.danger : colors.border,
          borderWidth: terpilih ? 2 : terlambat ? 1.5 : 1,
          boxShadow: shadows.card,
          opacity: selesai ? 0.82 : 1,
        },
      ]}
    >
      <StatusRing kategori={baris.status.category} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="title" numberOfLines={2} style={selesai ? { textDecorationLine: 'line-through', color: colors.muted } : undefined}>
          {baris.title}
        </Text>
        <View style={s.meta}>
          <Text variant="mono" style={{ fontSize: 13, color: colors.muted }} maxFontSizeMultiplier={1.4}>
            {baris.key}
          </Text>
          {tampilkanWorkspace ? (
            <View style={s.ws}>
              <UbinWorkspace nama={baris.workspace.name} jenis={baris.workspace.type} size={20} />
              <Text variant="meta" numberOfLines={1} style={{ flexShrink: 1 }}>
                {baris.workspace.type === 'personal' ? 'Pribadi' : baris.workspace.name}
              </Text>
            </View>
          ) : null}
          {tenggat ? (
            <View style={s.ws}>
              <Icon name={tenggat.icon} size={15} color={warnaTenggat} />
              <Text variant="meta" weight={600} style={{ color: warnaTenggat }}>
                {tenggat.text}
              </Text>
            </View>
          ) : null}
          {baris.source === 'attendance' ? <Tag tone="primary">dari absen</Tag> : null}
        </View>
        {baris.labels.length > 0 ? (
          <View style={s.meta}>
            {baris.labels.slice(0, 3).map((l) => (
              <Tag key={l.id} tone="neutral">
                {l.name}
              </Tag>
            ))}
          </View>
        ) : null}
        {baris.checklist && baris.checklist.total > 0 ? (
          <View style={s.ws}>
            <Icon name="list-checks" size={15} color={colors.muted} />
            <Text variant="meta">
              {baris.checklist.done}/{baris.checklist.total}
            </Text>
          </View>
        ) : null}
        {sinkron ? <ChipMenunggu status={sinkron} /> : null}
        {menunggu && !sinkron ? (
          <View style={s.ws}>
            <Icon name="cloud-upload" size={15} color={colors.link} />
            <Text variant="meta" weight={600} tone="link">
              Menunggu kirim
            </Text>
          </View>
        ) : null}
        {catatan}
      </View>
      <PriorityBars nilai={baris.priority.value} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  kartu: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.cardTight, paddingVertical: 14, paddingHorizontal: 14, minHeight: 72 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, rowGap: 4 },
  ws: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
});
