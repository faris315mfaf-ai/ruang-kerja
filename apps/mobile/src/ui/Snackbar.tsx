/**
 * Snackbar/toast: kapsul inverse (radius 18), satu sekaligus (yang baru
 * menggantikan yang lama), 4 dtk (5 dtk bila ada aksi), masuk naik 12 + fade
 * 180 ms, keluar fade 120 ms. Tidak hilang otomatis bila TalkBack aktif dan
 * ada aksi. Butuh `UIProvider`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, motion, radius, useTheme } from '@/theme';

import { useChrome } from './chrome';
import { Icon, type AnyIconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type SnackbarVariant = 'ok' | 'info' | 'bad' | 'warn' | 'offline';

export interface SnackbarOptions {
  message: string;
  variant?: SnackbarVariant;
  /** Aksi bergaris bawah di kanan ("Urungkan", "Coba lagi"). */
  actionLabel?: string;
  onAction?: () => void;
  /** Milidetik; bawaan 4000 (5000 bila ada aksi). */
  duration?: number;
  /** `auto`: di atas tab bar bila tampil; `bottom`: di atas tepi layar. */
  anchor?: 'auto' | 'bottom';
}

interface SnackbarApi {
  show: (opsi: SnackbarOptions) => void;
  hide: () => void;
}

const SnackbarContext = createContext<SnackbarApi | null>(null);

const IKON: Record<SnackbarVariant, AnyIconName> = {
  ok: 'circle-check',
  info: 'info',
  bad: 'circle-x',
  warn: 'triangle-alert',
  offline: 'cloud-off',
};

export function SnackbarProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { tabBarVisible } = useChrome();
  const kurangiGerak = useReducedMotion();
  const [item, setItem] = useState<(SnackbarOptions & { kunci: number }) | null>(null);
  const [terlihat, setTerlihat] = useState(false);
  const p = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitung = useRef(0);

  const bersihkanTimer = (): void => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const hide = useCallback((): void => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    p.set(kurangiGerak ? 0 : withTiming(0, { duration: motion.fast, easing: motion.ease }));
    timer.current = setTimeout(() => setTerlihat(false), kurangiGerak ? 0 : motion.fast);
  }, [kurangiGerak, p]);

  const show = useCallback(
    (opsi: SnackbarOptions): void => {
      bersihkanTimer();
      hitung.current += 1;
      setItem({ ...opsi, kunci: hitung.current });
      setTerlihat(true);
      p.set(0);
      p.set(kurangiGerak ? 1 : withTiming(1, { duration: motion.base, easing: motion.ease }));
      const lama = opsi.duration ?? (opsi.actionLabel ? 5000 : 4000);
      void AccessibilityInfo.isScreenReaderEnabled().then((talkback) => {
        if (talkback && opsi.actionLabel) {
          return; // jangan hilang sendiri: pengguna TalkBack butuh waktu menjangkau aksi
        }
        bersihkanTimer();
        timer.current = setTimeout(hide, lama);
      });
    },
    [hide, kurangiGerak, p],
  );

  useEffect(() => bersihkanTimer, []);

  const api = useMemo<SnackbarApi>(() => ({ show, hide }), [show, hide]);

  const gaya = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 12 }] }));

  const varian = item?.variant ?? 'info';
  const naik = item?.anchor !== 'bottom' && tabBarVisible;
  const bawah = naik ? insets.bottom + layout.tabBar + layout.tabLift + 12 : insets.bottom + 16;

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      {terlihat && item ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', paddingBottom: bawah, paddingHorizontal: 16 }]}>
          <Animated.View
            accessibilityLiveRegion={varian === 'bad' ? 'assertive' : 'polite'}
            style={[s.kapsul, { backgroundColor: colors.inverse, boxShadow: shadows.inverse }, gaya]}
          >
            <Icon name={IKON[varian]} size={22} color={varian === 'ok' ? colors.inverseStatus.success : varian === 'bad' ? colors.inverseStatus.danger : varian === 'info' ? colors.inverseStatus.info : colors.inverseStatus.warning} />
            <Text variant="label" weight={600} style={{ flex: 1, color: colors.onInverse, fontSize: 15, lineHeight: 22 }} numberOfLines={2}>
              {item.message}
            </Text>
            {item.actionLabel ? (
              <Pressable
                onPress={() => {
                  item.onAction?.();
                  hide();
                }}
                scaleTo={1}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={item.actionLabel}
                style={{ minHeight: 40, justifyContent: 'center' }}
              >
                <Text variant="label" weight={700} style={{ color: colors.onInverse, textDecorationLine: 'underline' }}>
                  {item.actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarApi {
  const nilai = useContext(SnackbarContext);
  if (!nilai) {
    throw new Error('useSnackbar harus di dalam UIProvider');
  }
  return nilai;
}

const s = StyleSheet.create({
  kapsul: { minHeight: 52, borderRadius: radius.lg + 2, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
