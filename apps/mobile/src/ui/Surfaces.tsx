import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';

import { Gradient } from './Gradient';
import { Icon, type AnyIconName } from './Icon';
import { Badge, type Tone } from './Indicators';
import { Pressable } from './Pressable';
import { Text, type TextTone } from './Text';

// ── Kartu ────────────────────────────────────────────────────────────────────

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** `default`: radius 24, padding 20 · `tight`: radius 20, padding 14/16 · `flat`: tanpa padding (daftar). */
  variant?: 'default' | 'tight' | 'flat';
}

export function Card({ children, style, onPress, accessibilityLabel, variant = 'default' }: CardProps): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const dasar: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    boxShadow: shadows.card,
    ...(variant === 'tight'
      ? { borderRadius: radius.cardTight, paddingVertical: 14, paddingHorizontal: 16, gap: 8 }
      : variant === 'flat'
        ? { borderRadius: radius.card, overflow: 'hidden' }
        : { borderRadius: radius.card, padding: 20, gap: 8 }),
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[dasar, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[dasar, style]}>{children}</View>;
}

/** Kartu berjudul + tautan aksi ("Lihat semua") di kanan atas. */
export function Panel({
  title,
  actionLabel,
  onAction,
  children,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <Card style={[{ gap: 12 }, style]}>
      <SectionHeader title={title} actionLabel={actionLabel} onAction={onAction} />
      {children}
    </Card>
  );
}

/** Kepala seksi: judul 20 + tautan teal di kanan (target ≥ 44). */
export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }): React.JSX.Element {
  return (
    <View style={s.kepalaSeksi}>
      <Text variant="h3" style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} scaleTo={1} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} accessibilityRole="link" accessibilityLabel={actionLabel}>
          <Text variant="label" tone="link">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Hero gradien (aksi atau hangat) dengan cahaya sudut; teks di dalamnya putih. Maks. satu per layar. */
export function Hero({
  children,
  warm = false,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  warm?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { shadows } = useTheme();
  const isi = (
    <>
      <Gradient name={warm ? 'hangat' : 'aksi'} style={[StyleSheet.absoluteFill, { borderRadius: radius.hero }]} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius.hero,
            experimental_backgroundImage: [
              {
                type: 'radial-gradient',
                shape: 'ellipse',
                size: { x: 240, y: 180 },
                position: { top: 0, right: 0 },
                colorStops: [
                  { color: 'rgba(255,255,255,0.24)', positions: ['0%'] },
                  { color: 'rgba(255,255,255,0)', positions: ['70%'] },
                ],
              },
            ],
          },
        ]}
      />
      {children}
    </>
  );
  const gaya: StyleProp<ViewStyle> = [{ borderRadius: radius.hero, padding: 22, gap: 8, boxShadow: warm ? shadows.warm : shadows.glow }, style];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={gaya}>
      {isi}
    </Pressable>
  ) : (
    <View style={gaya}>{isi}</View>
  );
}

/** Kartu KPI: label 13 + nilai 28; `highlight` = gradien aksi (maks. satu per layar). */
export function KpiCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  highlight = false,
  style,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: Tone;
  highlight?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const isi = (
    <>
      {highlight ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.cardTight }]} /> : null}
      <Text variant="meta" style={{ color: highlight ? 'rgba(255,255,255,0.85)' : colors.muted }}>
        {label}
      </Text>
      <Text variant="kpi" style={{ color: highlight ? '#FFFFFF' : colors.text }}>
        {value}
      </Text>
      {delta ? (
        <Badge tone={deltaTone} dot={false}>
          {delta}
        </Badge>
      ) : null}
    </>
  );
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${delta ? `, ${delta}` : ''}`}
      style={[
        s.kpi,
        highlight ? { boxShadow: shadows.glow } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, boxShadow: shadows.card },
        style,
      ]}
    >
      {isi}
    </View>
  );
}

// ── Baris daftar ─────────────────────────────────────────────────────────────

export type IconTileTone = 'neutral' | 'teal' | 'blue' | 'warn' | 'bad' | 'ok';

function tileWarna(colors: ReturnType<typeof useTheme>['colors'], tone: IconTileTone): { bg: string; fg: string } {
  switch (tone) {
    case 'teal':
      return { bg: colors.linkSoft, fg: colors.link };
    case 'blue':
      return { bg: colors.infoSoft, fg: colors.info };
    case 'warn':
      return { bg: colors.warningSoft, fg: colors.warning };
    case 'bad':
      return { bg: colors.dangerSoft, fg: colors.danger };
    case 'ok':
      return { bg: colors.successSoft, fg: colors.success };
    default:
      return { bg: colors.surface2, fg: colors.muted };
  }
}

/** Ubin ikon 44 (radius 14) untuk baris daftar. */
export function IconTile({ icon, tone = 'neutral', size = 44 }: { icon: AnyIconName; tone?: IconTileTone; size?: number }): React.JSX.Element {
  const { colors } = useTheme();
  const w = tileWarna(colors, tone);
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: w.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={22} color={w.fg} />
    </View>
  );
}

export interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ubin ikon/avatar/node bebas di kiri. */
  leading?: React.ReactNode;
  /** Shortcut: ubin ikon bernada. */
  icon?: AnyIconName;
  iconTone?: IconTileTone;
  /** Node di kanan; bila kosong dan `onPress` ada, tampil chevron. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Garis pemisah di atas baris (di dalam Card flat). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Baris daftar ≥ 64: judul 17/600, subjudul 14 muted, ikon ubin, chevron. */
export function ListRow({ title, subtitle, leading, icon, iconTone, trailing, onPress, accessibilityLabel, divider = false, style }: ListRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const kiri = leading ?? (icon ? <IconTile icon={icon} tone={iconTone} /> : null);
  const isi = (
    <>
      {kiri}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={2}>
          {title}
        </Text>
        {subtitle !== undefined && subtitle !== null ? (
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-right" size={20} color={colors.muted} /> : null)}
    </>
  );
  const gaya: StyleProp<ViewStyle> = [s.baris, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null, style];
  return onPress ? (
    <Pressable onPress={onPress} scaleTo={1} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={gaya}>
      {isi}
    </Pressable>
  ) : (
    <View style={gaya}>{isi}</View>
  );
}

// ── Kompatibilitas ui.tsx lama ───────────────────────────────────────────────

/** Baris sederhana lama (judul/subjudul/right/children). Kode baru: `ListRow`. */
export function Row({
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  const isi = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        {title !== undefined ? (
          <Text variant="label" numberOfLines={2} style={{ fontSize: 16, lineHeight: 22 }}>
            {title}
          </Text>
        ) : null}
        {subtitle !== undefined ? (
          <Text variant="meta" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      {right ? <View style={{ alignItems: 'flex-end' }}>{right}</View> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} scaleTo={1} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={s.barisLama}>
      {isi}
    </Pressable>
  ) : (
    <View style={s.barisLama}>{isi}</View>
  );
}

export function Divider(): React.JSX.Element {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }} />;
}

export function Chevron(): React.JSX.Element {
  const { colors } = useTheme();
  return <Icon name="chevron-right" size={20} color={colors.muted} />;
}

export function CardTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text variant="title">{children}</Text>;
}

export function Body({ children, muted = false, style }: { children: React.ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }): React.JSX.Element {
  return (
    <Text variant="body" tone={muted ? 'muted' : 'text'} style={style}>
      {children}
    </Text>
  );
}

export function Meta({ children, style, numberOfLines, tone }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; tone?: TextTone }): React.JSX.Element {
  return (
    <Text variant="meta" tone={tone} style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text variant="label" tone="muted">
      {children}
    </Text>
  );
}

const s = StyleSheet.create({
  kepalaSeksi: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  kpi: { borderRadius: radius.cardTight, paddingVertical: 14, paddingHorizontal: 16, gap: 2, alignItems: 'flex-start' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16 },
  barisLama: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 48 },
});
