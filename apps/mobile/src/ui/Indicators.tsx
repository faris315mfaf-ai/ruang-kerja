import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { font, radius, useTheme, type Colors } from '@/theme';

import { Gradient } from './Gradient';
import { Text } from './Text';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export function tonePair(colors: Colors, tone: Tone): { soft: string; fg: string } {
  switch (tone) {
    case 'success':
      return { soft: colors.successSoft, fg: colors.success };
    case 'warning':
      return { soft: colors.warningSoft, fg: colors.warning };
    case 'danger':
      return { soft: colors.dangerSoft, fg: colors.danger };
    case 'info':
      return { soft: colors.infoSoft, fg: colors.info };
    case 'primary':
      return { soft: colors.linkSoft, fg: colors.link };
    default:
      return { soft: colors.surface2, fg: colors.muted };
  }
}

// ── Badge (pil status 28 px, titik + teks) ───────────────────────────────────

export function Badge({
  children,
  tone = 'neutral',
  dot = true,
  style,
}: {
  children: React.ReactNode;
  tone?: Tone;
  /** Titik status (status tidak pernah hanya warna). */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const pair = tonePair(colors, tone);
  return (
    <View style={[s.badge, { backgroundColor: pair.soft }, style]}>
      {dot ? <View style={[s.titik, { backgroundColor: pair.fg }]} /> : null}
      <Text variant="meta" weight={700} style={{ color: pair.fg }} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** Tag/label kecil 26 px radius 8 (kode proyek, label tugas). */
export function Tag({ children, tone = 'primary', style }: { children: React.ReactNode; tone?: Tone; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { colors } = useTheme();
  const pair = tonePair(colors, tone);
  return (
    <View style={[s.tag, { backgroundColor: pair.soft }, style]}>
      <Text variant="meta" weight={700} style={{ color: pair.fg, fontSize: 12 }} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** Lencana angka merah (AA: #C42137 + putih ≈ 5,8:1). */
export function CountBadge({ count, dotOnly = false, style }: { count?: number; dotOnly?: boolean; style?: StyleProp<ViewStyle> }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (dotOnly) {
    return <View style={[s.titikMerah, { backgroundColor: colors.badge, borderColor: colors.surface }, style]} />;
  }
  if (!count || count <= 0) {
    return null;
  }
  return (
    <View style={[s.count, { backgroundColor: colors.badge, borderColor: colors.surface }, style]}>
      <Text variant="meta" weight={700} style={{ color: colors.onBadge, fontSize: 11, lineHeight: 14 }} maxFontSizeMultiplier={1.2}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export type AvatarTone = 'blue' | 'teal' | 'amber' | 'neutral';
export type AvatarSize = 'sm' | 'md' | 'lg';

const UKURAN_AVATAR: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 32, font: 12 },
  md: { box: 44, font: 15 },
  lg: { box: 64, font: 22 },
};

const NADA: AvatarTone[] = ['blue', 'teal', 'amber', 'neutral'];

/** Inisial maksimal dua huruf: "Sari Wulandari" → "SW". */
export function initials(name: string | null | undefined): string {
  const bagian = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) {
    return '?';
  }
  const awal = bagian[0]?.[0] ?? '';
  const akhir = bagian.length > 1 ? (bagian[bagian.length - 1]?.[0] ?? '') : '';
  return (awal + akhir).toUpperCase();
}

/** Nada tetap per nama (hash sederhana) — satu orang selalu satu warna. */
export function avatarTone(name: string | null | undefined): AvatarTone {
  let h = 0;
  for (const ch of name ?? '') {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return NADA[h % NADA.length] ?? 'blue';
}

export function Avatar({
  name,
  size = 'md',
  tone,
  ring = false,
  style,
}: {
  name: string | null | undefined;
  size?: AvatarSize;
  tone?: AvatarTone;
  /** Cincin gradien merek (pengguna sendiri). */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const u = UKURAN_AVATAR[size];
  const warna = colors.avatar[tone ?? avatarTone(name)];
  const isi = (
    <View
      style={{
        width: ring ? u.box - 4 : u.box,
        height: ring ? u.box - 4 : u.box,
        borderRadius: 999,
        backgroundColor: warna.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: warna.fg, fontFamily: font(700), fontSize: u.font, lineHeight: u.font + 4 }} maxFontSizeMultiplier={1.3}>
        {initials(name)}
      </Text>
    </View>
  );
  if (ring) {
    return (
      <Gradient name="merek" style={[{ width: u.box, height: u.box, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }, style]}>
        {isi}
      </Gradient>
    );
  }
  return <View style={style}>{isi}</View>;
}

/** Tumpukan avatar tumpang tindih; sisanya jadi "+N". */
export function AvatarStack({ names, max = 4, size = 'sm' }: { names: string[]; max?: number; size?: AvatarSize }): React.JSX.Element {
  const { colors } = useTheme();
  const tampil = names.slice(0, max);
  const sisa = names.length - tampil.length;
  const box = UKURAN_AVATAR[size].box;
  return (
    <View style={{ flexDirection: 'row' }} accessibilityLabel={`${names.length} orang`}>
      {tampil.map((n, i) => (
        <View key={`${n}-${i}`} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: 999, borderWidth: 2, borderColor: colors.surface }}>
          <Avatar name={n} size={size} />
        </View>
      ))}
      {sisa > 0 ? (
        <View
          style={{
            marginLeft: -8,
            width: box + 4,
            height: box + 4,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: colors.surface,
            backgroundColor: colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="meta" weight={700}>{`+${sisa}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Progress ─────────────────────────────────────────────────────────────────

export function Progress({
  value,
  marker,
  label,
  style,
}: {
  /** 0–100. */
  value: number;
  /** Penanda rencana 0–100 (garis tipis). */
  marker?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const v = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}
      style={[{ height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' }, style]}
    >
      <Gradient name="merek" horizontal style={{ width: `${v}%`, height: 8, borderRadius: 4 }} />
      {marker !== undefined ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.max(0, Math.min(100, marker))}%`, width: 2, backgroundColor: colors.marker }} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { height: 28, paddingHorizontal: 10, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  titik: { width: 7, height: 7, borderRadius: 4 },
  tag: { height: 26, paddingHorizontal: 9, borderRadius: radius.sm, justifyContent: 'center', alignSelf: 'flex-start' },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  titikMerah: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
