/**
 * Komponen bersama modul Rapat: lencana platform, baris agenda, strip hari,
 * dan baris peserta (mockup 01, 03, 04, 07).
 */
import { StyleSheet, View } from 'react-native';

import type { MeetingItem, RsvpValue } from '@/api/types';
import { jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Avatar, Badge, Gradient, Icon, Pressable, Text, tonePair, type Tone } from '@/ui';

import { PUTIH, faseRapat, infoPlatform, lencanaSeri, namaHariSingkat, urai, warnaPlatform } from './util';

export function LencanaPlatform({ platform, label }: { platform: string; label?: string }): React.JSX.Element {
  const { colors } = useTheme();
  const info = infoPlatform(platform);
  const pair = tonePair(colors, info.tone);
  return (
    <View style={[s.pil, { backgroundColor: pair.soft }]}>
      <Icon name={info.ikon} size={16} color={pair.fg} />
      <Text variant="meta" weight={700} style={{ color: pair.fg }} numberOfLines={1}>
        {label ?? info.label}
      </Text>
    </View>
  );
}

export const LABEL_RSVP_AGENDA: Record<RsvpValue, { label: string; tone: Tone }> = {
  yes: { label: 'Hadir', tone: 'success' },
  maybe: { label: 'Mungkin', tone: 'warning' },
  no: { label: 'Tidak hadir', tone: 'danger' },
  pending: { label: 'Belum dijawab', tone: 'info' },
};

/** Baris rapat di agenda: kolom jam, garis platform, judul, lencana. */
export function BarisRapat({
  item,
  viewerId,
  sekarang,
  onPress,
  divider = false,
}: {
  item: MeetingItem;
  viewerId: string | null;
  sekarang: number;
  onPress: () => void;
  divider?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const fase = faseRapat(item.starts_at, item.ends_at, sekarang);
  const saya = viewerId !== null && item.organizer.id === viewerId;
  const meta: string[] = [];
  if (item.platform === 'room' || item.platform === 'client') {
    if (item.location) {
      meta.push(item.location);
    }
  } else if (item.workspace) {
    meta.push(item.workspace.key);
  }
  if (!saya && item.organizer.name && meta.length === 0) {
    meta.push(item.organizer.name.split(' ')[0] ?? item.organizer.name);
  }
  if (item.peserta_count > 0 && item.platform !== 'room' && item.platform !== 'client') {
    meta.push(`${item.peserta_count} peserta`);
  }
  const seri = lencanaSeri(item.recurrence);
  const rsvp = item.rsvp_saya && !saya ? LABEL_RSVP_AGENDA[item.rsvp_saya] : null;

  return (
    <Pressable
      onPress={onPress}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${jam(item.starts_at)} sampai ${jam(item.ends_at)}${item.canceled ? ', dibatalkan' : ''}`}
      style={[s.baris, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
    >
      <View style={s.kolomJam}>
        <Text variant="title" weight={700}>
          {jam(item.starts_at)}
        </Text>
        <Text variant="meta">{jam(item.ends_at)}</Text>
      </View>
      <View style={[s.garis, { backgroundColor: item.canceled ? colors.fill.warning : warnaPlatform(colors, item.platform) }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="title" numberOfLines={2} style={item.canceled ? { textDecorationLine: 'line-through', color: colors.muted } : null}>
          {item.title}
        </Text>
        <View style={s.bungkus}>
          <LencanaPlatform platform={item.platform} />
          {saya ? <Text variant="meta">Anda penyelenggara</Text> : null}
          {meta.length > 0 ? (
            <Text variant="meta" numberOfLines={1} style={{ flexShrink: 1 }}>
              {meta.join(' · ')}
            </Text>
          ) : null}
        </View>
        <View style={s.bungkus}>
          {item.canceled ? <Badge tone="danger">Dibatalkan</Badge> : null}
          {!item.canceled && rsvp ? <Badge tone={rsvp.tone}>{rsvp.label}</Badge> : null}
          {!item.canceled && item.minutes_status === 'none' && fase !== 'akan' ? <Badge tone="warning">Notulen belum ada</Badge> : null}
          {item.minutes_status === 'draft' ? <Badge tone="warning">Notulen draf</Badge> : null}
          {item.minutes_status === 'final' ? <Badge tone="success">Notulen final</Badge> : null}
          {seri ? (
            <Badge tone="neutral" dot={false}>
              {seri}
            </Badge>
          ) : null}
        </View>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}

/** Strip hari (Sen–Jum, + Sab/Min bila perlu) dengan titik "ada rapat". */
export function StripHari({
  hari,
  terpilih,
  hariIni,
  titik,
  onPilih,
}: {
  hari: string[];
  terpilih: string;
  hariIni: string;
  titik: Set<string>;
  onPilih: (ymd: string) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.strip} accessibilityRole="tablist">
      {hari.map((ymd) => {
        const aktif = ymd === terpilih;
        const fg = aktif ? PUTIH : colors.text;
        return (
          <Pressable
            key={ymd}
            onPress={() => onPilih(ymd)}
            accessibilityRole="tab"
            accessibilityState={{ selected: aktif }}
            accessibilityLabel={`${namaHariSingkat(ymd)} ${urai(ymd).d}${ymd === hariIni ? ', hari ini' : ''}${titik.has(ymd) ? ', ada agenda' : ''}`}
            style={[
              s.ubinHari,
              aktif
                ? { borderColor: 'transparent', overflow: 'hidden' }
                : { backgroundColor: colors.surface, borderColor: ymd === hariIni ? colors.primary : colors.border },
            ]}
          >
            {aktif ? <Gradient name="aksi" style={StyleSheet.absoluteFill} /> : null}
            <Text variant="meta" weight={600} style={{ color: aktif ? PUTIH : colors.muted }}>
              {namaHariSingkat(ymd)}
            </Text>
            <Text variant="h3" weight={700} style={{ color: fg }}>
              {String(urai(ymd).d)}
            </Text>
            <View style={[s.titikHari, { backgroundColor: titik.has(ymd) ? (aktif ? PUTIH : colors.fill.teal) : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Baris orang + lencana kanan (peserta, kehadiran). */
export function BarisOrang({
  nama,
  sub,
  kanan,
  divider = false,
  onPress,
}: {
  nama: string;
  sub?: string | null;
  kanan?: React.ReactNode;
  divider?: boolean;
  onPress?: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const isi = (
    <>
      <Avatar name={nama} size="md" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={2} style={{ fontSize: 16, lineHeight: 22 }}>
          {nama}
        </Text>
        {sub ? (
          <Text variant="meta" numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {kanan}
    </>
  );
  const gaya = [s.orang, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null];
  return onPress ? (
    <Pressable onPress={onPress} scaleTo={1} accessibilityRole="button" accessibilityLabel={nama} style={gaya}>
      {isi}
    </Pressable>
  ) : (
    <View style={gaya}>{isi}</View>
  );
}

/** Nomor agenda bergradien kecil (1, 2, 3…). */
export function NomorAgenda({ n }: { n: number }): React.JSX.Element {
  return (
    <View style={[s.nomor, { overflow: 'hidden' }]}>
      <Gradient name="merek" style={StyleSheet.absoluteFill} />
      <Text variant="meta" weight={700} style={{ color: PUTIH }}>
        {String(n)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pil: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 28, borderRadius: radius.sm, alignSelf: 'flex-start' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  kolomJam: { width: 56, alignSelf: 'flex-start', gap: 2 },
  garis: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  strip: { flexDirection: 'row', gap: 8 },
  ubinHari: { flex: 1, minHeight: 72, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8 },
  titikHari: { width: 6, height: 6, borderRadius: 3 },
  orang: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  nomor: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
