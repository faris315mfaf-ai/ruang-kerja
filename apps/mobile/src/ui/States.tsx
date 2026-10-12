import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { radius, useTheme } from '@/theme';

import { Button } from './Button';
import { Icon, type AnyIconName } from './Icon';
import { Gradient } from './Gradient';
import { Text } from './Text';

// ── Banner ───────────────────────────────────────────────────────────────────

export type BannerTone = 'info' | 'warn' | 'bad' | 'ok' | 'neutral';

const IKON_BANNER: Record<BannerTone, AnyIconName> = {
  info: 'info',
  warn: 'triangle-alert',
  bad: 'circle-alert',
  ok: 'circle-check',
  neutral: 'info',
};

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  message: string;
  icon?: AnyIconName;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Banner semantik (radius 18): info · warn · bad · ok · neutral. Ikon + teks, tidak pernah warna saja. */
export function Banner({ tone = 'info', title, message, icon, actionLabel, onAction, style }: BannerProps): React.JSX.Element {
  const { colors } = useTheme();
  const pair =
    tone === 'warn'
      ? { bg: colors.warningSoft, fg: colors.warning }
      : tone === 'bad'
        ? { bg: colors.dangerSoft, fg: colors.danger }
        : tone === 'ok'
          ? { bg: colors.successSoft, fg: colors.success }
          : tone === 'neutral'
            ? { bg: colors.surface2, fg: colors.muted }
            : { bg: colors.infoSoft, fg: colors.info };
  return (
    <View
      accessibilityRole={tone === 'bad' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'bad' ? 'assertive' : undefined}
      style={[s.banner, { backgroundColor: pair.bg }, style]}
    >
      <View style={{ marginTop: 1 }}>
        <Icon name={icon ?? IKON_BANNER[tone]} size={20} color={pair.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <Text variant="label" style={{ color: pair.fg }}>
            {title}
          </Text>
        ) : null}
        <Text variant="label" weight={500} style={{ color: pair.fg, lineHeight: 21 }}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Button title={actionLabel} onPress={onAction} variant="quiet" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 36 }} />
        ) : null}
      </View>
    </View>
  );
}

/** Banner khusus produk: mode lihat saja. */
export function ReadOnlyBanner({ message = 'Mode lihat saja — Anda tidak dapat mengubah data ini.' }: { message?: string }): React.JSX.Element {
  return <Banner tone="neutral" icon="eye" message={message} />;
}

/** Banner khusus produk: fitur hanya di desktop. */
export function DesktopOnlyBanner({ message = 'Fitur ini tersedia di desktop.', onSendLink }: { message?: string; onSendLink?: () => void }): React.JSX.Element {
  return <Banner tone="info" icon="monitor" message={message} actionLabel={onSendLink ? 'Kirim tautan ke email saya' : undefined} onAction={onSendLink} />;
}

/** Banner khusus produk: terkunci dengan alasan. */
export function LockedBanner({ reason }: { reason: string }): React.JSX.Element {
  return <Banner tone="warn" icon="lock" message={reason} />;
}

/** Banner offline tipis: data tersimpan ditampilkan; aksi butuh koneksi dinonaktifkan. */
export function OfflineBanner({ pending = 0 }: { pending?: number }): React.JSX.Element {
  return (
    <Banner
      tone="warn"
      icon="wifi-off"
      message={pending > 0 ? `Tidak ada koneksi · ${pending} perubahan menunggu sinyal` : 'Tidak ada koneksi. Data terakhir yang tersimpan ditampilkan.'}
    />
  );
}

// ── Kosong / galat / terkunci ───────────────────────────────────────────────

export function EmptyState({
  icon = 'circle-check',
  title,
  description,
  actionLabel,
  onAction,
  variant = 'card',
}: {
  icon?: AnyIconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `card`: garis putus-putus · `plain`: tanpa bingkai. */
  variant?: 'card' | 'plain';
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      style={[
        s.pusat,
        variant === 'card' ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: radius.card, paddingVertical: 28, paddingHorizontal: 20 } : { padding: 32 },
      ]}
    >
      <Gradient name="soft" style={s.ubin}>
        <Icon name={icon} size={28} color={colors.link} />
      </Gradient>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="tonal" size="sm" /> : null}
    </View>
  );
}

export type ErrorKind = 'umum' | 'offline' | 'forbidden' | 'notfound' | 'ratelimit';

const KONTEN_GALAT: Record<ErrorKind, { icon: AnyIconName; title: string }> = {
  umum: { icon: 'circle-alert', title: 'Terjadi galat' },
  offline: { icon: 'cloud-off', title: 'Tidak ada koneksi' },
  forbidden: { icon: 'lock', title: 'Tidak ada akses' },
  notfound: { icon: 'circle-help', title: 'Tidak ditemukan' },
  ratelimit: { icon: 'timer', title: 'Terlalu banyak percobaan' },
};

/** Jenis galat dari kode HTTP (`ApiError.status`); 0/undefined = tanpa koneksi. */
export function errorKindFromStatus(status: number | null | undefined): ErrorKind {
  if (status === 0) {
    return 'offline';
  }
  if (status === 403) {
    return 'forbidden';
  }
  if (status === 404) {
    return 'notfound';
  }
  if (status === 429) {
    return 'ratelimit';
  }
  return 'umum';
}

export function ErrorState({
  message,
  onRetry,
  kind = 'umum',
  title,
}: {
  message: string;
  onRetry?: () => void;
  kind?: ErrorKind;
  title?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const k = KONTEN_GALAT[kind];
  return (
    <View style={[s.pusat, { padding: 32 }]}>
      <View style={[s.ubin, { backgroundColor: colors.dangerSoft }]}>
        <Icon name={k.icon} size={28} color={colors.danger} />
      </View>
      <Text variant="h3" align="center">
        {title ?? k.title}
      </Text>
      <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }} accessibilityRole="alert">
        {message}
      </Text>
      {onRetry ? <Button title="Coba lagi" onPress={onRetry} variant="outline" size="sm" icon="refresh-cw" /> : null}
    </View>
  );
}

/** Status terkunci (jenis dikunci, fitur belum aktif): ikon gembok + alasan. */
export function LockedState({ title = 'Terkunci', reason, actionLabel, onAction }: { title?: string; reason: string; actionLabel?: string; onAction?: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.pusat, { padding: 32 }]}>
      <View style={[s.ubin, { backgroundColor: colors.warningSoft }]}>
        <Icon name="lock" size={28} color={colors.warning} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
        {reason}
      </Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="outline" size="sm" /> : null}
    </View>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ width = '100%', height = 16, radiusPx = 12, style }: { width?: DimensionValue; height?: number; radiusPx?: number; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { colors, dark } = useTheme();
  const kurangiGerak = useReducedMotion();
  const [lebar, setLebar] = useState(0);
  const p = useSharedValue(0);

  useEffect(() => {
    if (kurangiGerak) {
      cancelAnimation(p);
      p.value = 0;
      return undefined;
    }
    p.value = withRepeat(withTiming(1, { duration: 1300 }), -1, false);
    return () => cancelAnimation(p);
  }, [kurangiGerak, p]);

  const gaya = useAnimatedStyle(() => ({ transform: [{ translateX: -lebar + p.value * lebar * 2 }] }));

  return (
    <View
      onLayout={(e) => setLebar(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radiusPx, backgroundColor: colors.surface2, overflow: 'hidden' }, style]}
    >
      {kurangiGerak || lebar === 0 ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, gaya]}>
          <LinearGradient
            colors={['transparent', dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** Baris daftar skeleton: avatar 44 + dua garis. */
export function SkeletonRow(): React.JSX.Element {
  return (
    <View style={s.skelBaris}>
      <Skeleton width={44} height={44} radiusPx={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="45%" height={12} />
      </View>
    </View>
  );
}

/** Pemuatan layar: beberapa baris skeleton (menggantikan spinner penuh). */
export function Loading({ label = 'Memuat…', rows = 4 }: { label?: string; rows?: number }): React.JSX.Element {
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" accessibilityLiveRegion="polite" style={{ gap: 4, paddingVertical: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 },
  pusat: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  ubin: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  skelBaris: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
