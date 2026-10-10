/**
 * Komponen UI dasar RuangKerja — token Arus saja, teks Indonesia,
 * target sentuh ≥ 44, label aksesibilitas.
 */
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useTheme, type ArusColors } from '@/lib/theme';

export { SafeAreaProvider, SafeAreaView, useSafeAreaInsets };

// ── Layar ────────────────────────────────────────────────────────────────────

/** Halaman bergulir dengan area aman + pull-to-refresh. */
export function Screen({
  children,
  refreshing = false,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.scrollView, contentStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.titleWrap}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Kartu ────────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

// ── Teks ─────────────────────────────────────────────────────────────────────

export function CardTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  return <Text style={[styles.cardTitle, { color: colors.text }]}>{children}</Text>;
}

export function Body({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  return <Text style={[styles.body, { color: muted ? colors.muted : colors.text }, style]}>{children}</Text>;
}

export function Meta({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Text style={[styles.meta, { color: colors.subtle }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.muted }]}>{children}</Text>;
}

// ── Lencana ──────────────────────────────────────────────────────────────────

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: Tone;
}): React.JSX.Element {
  const { colors } = useTheme();
  const pair = tonePair(colors, tone);
  return (
    <View style={[styles.badge, { backgroundColor: pair.soft }]}>
      <Text style={[styles.badgeText, { color: pair.fg }]}>{children}</Text>
    </View>
  );
}

function tonePair(
  colors: ArusColors,
  tone: Tone,
): { soft: string; fg: string } {
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

// ── Tombol ───────────────────────────────────────────────────────────────────

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';
  const bg = isPrimary ? colors.primary : isDanger ? colors.dangerSoft : colors.surface;
  const fg = isPrimary ? colors.primaryFg : isDanger ? colors.danger : colors.text;
  const border = isPrimary || isGhost ? 'transparent' : colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border },
        (variant === 'primary' && !disabled) && { backgroundColor: pressed ? colors.primaryHover : bg },
        (disabled || loading) && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string | null;
  error?: string | null;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <Text style={[styles.fieldError, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.fieldHint, { color: colors.subtle }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps): React.JSX.Element {
  const { colors } = useTheme();
  const { style, placeholderTextColor, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? colors.subtle}
      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, style]}
      {...rest}
    />
  );
}

// ── Keadaan UI: loading / kosong / galat ──────────────────────────────────────

export function Loading({ label = 'Memuat…' }: { label?: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.stateWrap} accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Meta>{label}</Meta>
    </View>
  );
}

export function EmptyState({
  icon = 'checkmark-circle-outline',
  title,
  description,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.linkSoft }]}>
        <Ionicons name={icon} size={28} color={colors.link} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {description ? <Meta>{description}</Meta> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Terjadi galat</Text>
      <Text style={[styles.errorText, { color: colors.muted }]}>{message}</Text>
      {onRetry ? (
        <Button title="Coba lagi" onPress={onRetry} variant="secondary" icon="refresh" style={{ minWidth: 160 }} />
      ) : null}
    </View>
  );
}

// ── Segmen (toggle) ──────────────────────────────────────────────────────────

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; badge?: number | null }[];
  onChange: (value: T) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segmentWrap, { backgroundColor: colors.surface2 }]}
    >
      {options.map((option) => {
        const aktif = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: aktif }}
            style={[
              styles.segment,
              { backgroundColor: aktif ? colors.surface : 'transparent', borderColor: aktif ? colors.border : 'transparent' },
            ]}
          >
            <Text style={[styles.segmentText, { color: aktif ? colors.text : colors.muted }]}>{option.label}</Text>
            {option.badge !== null && option.badge !== undefined ? (
              <View style={[styles.segmentBadge, { backgroundColor: aktif ? colors.primary : colors.borderStrong }]}>
                <Text style={[styles.segmentBadgeText, { color: aktif ? colors.primaryFg : colors.surface }]}>{option.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Baris daftar ─────────────────────────────────────────────────────────────

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
  const { colors } = useTheme();
  const inner = (
    <>
      {title !== undefined ? (
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {subtitle !== undefined ? (
        <Text style={[styles.rowSubtitle, { color: colors.muted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      >
        <View style={styles.rowMain}>{inner}</View>
        {right ? <View style={styles.rowRight}>{right}</View> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>{inner}</View>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
    </View>
  );
}

export function Divider(): React.JSX.Element {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function Chevron(): React.JSX.Element {
  const { colors } = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={colors.subtle} />;
}

// ── Gaya bersama ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: { padding: 16, paddingBottom: 48, gap: 12 },
  titleWrap: { marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  button: {
    minHeight: 48,
    borderRadius: radius.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  field: { gap: 4 },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  fieldHint: { fontSize: 12 },
  fieldError: { fontSize: 12, fontWeight: '600' },
  stateWrap: { padding: 32, gap: 10, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorText: { fontSize: 14, textAlign: 'center' },
  segmentWrap: { flexDirection: 'row', borderRadius: radius.sm + 2, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  segmentText: { fontSize: 14, fontWeight: '600' },
  segmentBadge: { borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  segmentBadgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, lineHeight: 18 },
  rowRight: { alignItems: 'flex-end' },
});
