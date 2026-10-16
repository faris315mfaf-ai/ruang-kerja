/**
 * Baris yang bisa digeser ke kiri (spec 10 §7): menampilkan dua aksi
 * (mis. Dibaca + Arsipkan); melepas lewat 50% lebar menjalankan aksi
 * terakhir langsung. TalkBack tidak bisa menggeser → aksi yang sama ada di
 * `accessibilityActions`, tekan lama (mode pilih), dan menu ⋮.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, useTheme } from '@/theme';
import { Icon, Pressable, Text, type AnyIconName } from '@/ui';

export interface AksiGeser {
  kunci: string;
  label: string;
  icon: AnyIconName;
  /** `blue` = Dibaca / Belum dibaca; `teal` = Arsipkan / Kembalikan. */
  warna: 'blue' | 'teal';
  onPress: () => void;
}

const LEBAR_AKSI = 104;
const AMBANG_LEPAS = 0.5;

export function SwipeableRow({
  aksi,
  disabled = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  children,
}: {
  /** Urutan kiri → kanan; aksi TERAKHIR dijalankan oleh geser penuh. */
  aksi: AksiGeser[];
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { colors } = useTheme();
  const kurangiGerak = useReducedMotion();
  const [lebar, setLebar] = useState(0);
  const [terbuka, setTerbuka] = useState(false);
  const x = useSharedValue(0);
  const mulai = useSharedValue(0);
  const total = LEBAR_AKSI * aksi.length;
  const terakhir = aksi[aksi.length - 1];

  const atur = useCallback(
    (nilai: number): void => {
      x.set(kurangiGerak ? nilai : withSpring(nilai, { damping: 20, stiffness: 240 }));
    },
    [kurangiGerak, x],
  );

  const tutup = useCallback((): void => {
    setTerbuka(false);
    atur(0);
  }, [atur]);

  const selesaiGeser = useCallback(
    (hasil: 'buka' | 'tutup' | 'penuh'): void => {
      if (hasil === 'penuh') {
        terakhir?.onPress();
        return;
      }
      setTerbuka(hasil === 'buka');
    },
    [terakhir],
  );

  const geser = Gesture.Pan()
    .enabled(!disabled && aksi.length > 0 && lebar > 0)
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onStart(() => {
      mulai.set(x.get());
    })
    .onUpdate((e) => {
      const hasil = mulai.get() + e.translationX;
      x.set(Math.max(-lebar, Math.min(0, hasil)));
    })
    .onEnd(() => {
      const posisi = x.get();
      if (posisi < -lebar * AMBANG_LEPAS) {
        x.set(withTiming(-lebar, { duration: motion.base }));
        scheduleOnRN(selesaiGeser, 'penuh');
      } else if (posisi < -LEBAR_AKSI * 0.6) {
        x.set(withSpring(-total, { damping: 20, stiffness: 240 }));
        scheduleOnRN(selesaiGeser, 'buka');
      } else {
        x.set(withSpring(0, { damping: 20, stiffness: 240 }));
        scheduleOnRN(selesaiGeser, 'tutup');
      }
    });

  const gayaIsi = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const tekan = (): void => {
    if (terbuka) {
      tutup();
    } else {
      onPress();
    }
  };

  return (
    <View onLayout={(e) => setLebar(e.nativeEvent.layout.width)} style={s.akar}>
      {aksi.length > 0 ? (
        <View style={[s.aksiBox, { width: total }]} pointerEvents={terbuka ? 'auto' : 'none'}>
          {aksi.map((a) => (
            <Pressable
              key={a.kunci}
              scaleTo={1}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                tutup();
                a.onPress();
              }}
              style={[s.aksi, { backgroundColor: a.warna === 'blue' ? colors.accentBlueStrong : colors.primary }]}
            >
              <Icon name={a.icon} size={22} color="#FFFFFF" />
              <Text variant="label" weight={700} tone="onPrimary" style={{ fontSize: 14 }} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <GestureDetector gesture={geser}>
        <Animated.View style={[{ backgroundColor: colors.surface }, gayaIsi]}>
          <Pressable
            scaleTo={1}
            onPress={tekan}
            onLongPress={onLongPress}
            delayLongPress={380}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityActions={aksi.map((a) => ({ name: a.kunci, label: a.label }))}
            onAccessibilityAction={(e) => aksi.find((a) => a.kunci === e.nativeEvent.actionName)?.onPress()}
          >
            {children}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  akar: { overflow: 'hidden' },
  aksiBox: { position: 'absolute', top: 0, right: 0, bottom: 0, flexDirection: 'row' },
  aksi: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
