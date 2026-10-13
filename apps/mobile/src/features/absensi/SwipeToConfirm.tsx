/**
 * Geser untuk mengirim (check-in/check-out): knob 56, ambang kirim ≥ 85% lebar,
 * kembali berpegas bila dilepas lebih awal, terkunci (gembok) sampai prasyarat
 * siap. Bukan sekali ketuk supaya tidak absen tanpa sengaja (PLATFORM §2.1 #4).
 * Pembaca layar (TalkBack) tidak bisa menggeser: tersedia aksi `activate` dan
 * tombol biasa sebagai pengganti.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, radius, useTheme } from '@/theme';
import { Button, Gradient, Icon, Text } from '@/ui';

const KNOB = 56;
const PAD = 4;
const AMBANG = 0.85;

function usePembacaLayar(): boolean {
  const [aktif, setAktif] = useState(false);
  useEffect(() => {
    let hidup = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((v) => {
      if (hidup) setAktif(v);
    });
    const l = AccessibilityInfo.addEventListener('screenReaderChanged', setAktif);
    return () => {
      hidup = false;
      l.remove();
    };
  }, []);
  return aktif;
}

export interface SwipeToConfirmProps {
  /** "Geser untuk check-in" · "Geser untuk check-out". */
  label: string;
  /** Teks tombol pengganti untuk pembaca layar, mis. "Kirim check-in". */
  labelAksi: string;
  /** Terkunci: tampilkan gembok dan `alasanKunci`. */
  terkunci: boolean;
  alasanKunci: string;
  mengirim: boolean;
  onKonfirmasi: () => void;
}

export function SwipeToConfirm({ label, labelAksi, terkunci, alasanKunci, mengirim, onKonfirmasi }: SwipeToConfirmProps): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const kurangiGerak = useReducedMotion();
  const pembacaLayar = usePembacaLayar();
  const [lebar, setLebar] = useState(0);
  const x = useSharedValue(0);
  const maks = Math.max(0, lebar - KNOB - PAD * 2);
  const mati = terkunci || mengirim;

  // Kembali ke kiri setelah selesai/gagal kirim atau saat terkunci lagi.
  useEffect(() => {
    if (!mengirim) {
      x.set(kurangiGerak ? 0 : withSpring(0, { damping: 18, stiffness: 220 }));
    }
  }, [mengirim, terkunci, kurangiGerak, x]);

  const geser = Gesture.Pan()
    .enabled(!mati)
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      x.set(clamp(e.translationX, 0, maks));
    })
    .onEnd(() => {
      if (maks > 0 && x.get() >= maks * AMBANG) {
        x.set(withTiming(maks, { duration: motion.base }));
        scheduleOnRN(onKonfirmasi);
      } else {
        x.set(withSpring(0, { damping: 18, stiffness: 220 }));
      }
    });

  const gayaKnob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const gayaIsi = useAnimatedStyle(() => ({ width: mengirim ? '100%' : x.get() + KNOB + PAD * 2 }));
  const gayaLabel = useAnimatedStyle(() => ({ opacity: maks > 0 ? 1 - Math.min(1, x.get() / (maks * 0.6)) : 1 }));

  if (pembacaLayar) {
    return (
      <Button
        title={mengirim ? 'Mengirim…' : labelAksi}
        onPress={onKonfirmasi}
        size="lg"
        loading={mengirim}
        disabled={terkunci}
        disabledReason={alasanKunci}
        icon={terkunci ? 'lock' : 'fingerprint'}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={mengirim ? 'Mengirim' : terkunci ? `${label}. Terkunci` : `${label}. Aktifkan dua kali untuk mengirim`}
      accessibilityHint={terkunci ? alasanKunci : undefined}
      accessibilityState={{ disabled: mati, busy: mengirim }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        if (!mati) onKonfirmasi();
      }}
      onLayout={(e) => setLebar(e.nativeEvent.layout.width)}
      style={[s.jalur, { backgroundColor: colors.surface2, borderColor: colors.borderStrong }]}
    >
      {mengirim ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.full }]} /> : null}
      {!mengirim && !terkunci ? (
        <Animated.View style={[s.isi, gayaIsi]}>
          <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.full, opacity: 0.18 }]} />
        </Animated.View>
      ) : null}

      <Animated.View style={[s.labelBox, gayaLabel]} pointerEvents="none">
        {mengirim ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
        <Text variant="title" weight={700} style={{ color: mengirim ? '#FFFFFF' : terkunci ? colors.subtle : colors.text }} numberOfLines={1}>
          {mengirim ? 'Mengirim…' : terkunci ? alasanKunci : label}
        </Text>
        {!mengirim && !terkunci ? <Icon name="chevrons-right" size={20} color={colors.muted} /> : null}
      </Animated.View>

      {mengirim ? null : (
        <GestureDetector gesture={geser}>
          <Animated.View
            style={[
              s.knob,
              gayaKnob,
              terkunci ? { backgroundColor: colors.borderStrong } : { boxShadow: shadows.knob },
            ]}
          >
            {terkunci ? null : <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.full }]} />}
            <Icon name={terkunci ? 'lock' : 'chevrons-right'} size={24} color={terkunci ? colors.surface : '#FFFFFF'} />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  jalur: { height: KNOB + PAD * 2, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center', overflow: 'hidden' },
  isi: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.full },
  labelBox: { position: 'absolute', left: KNOB + PAD * 2, right: 16, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  knob: { position: 'absolute', left: PAD, top: PAD, width: KNOB, height: KNOB, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
