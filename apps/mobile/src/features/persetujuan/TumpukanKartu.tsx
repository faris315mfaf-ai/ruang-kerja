/**
 * Tumpukan kartu Persetujuan (mockup 17, spec 04 D9 + §5): satu kartu besar
 * + dua bayangan. Geser kanan melewati 40% lebar = setujui (kartu terbang
 * keluar, induk menjadwalkan kirim setelah 6 detik); geser kiri melewati 40%
 * = buka sheet Tolak (kartu kembali, alasan wajib). Stempel SETUJUI/TOLAK
 * muncul linear antara 15–40% lebar. Reduced motion: tanpa rotasi/pegas.
 * TalkBack: aksi Setujui/Tolak/Minta revisi/Buka detail di kartu.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { DetailPersetujuan, ItemAntrean } from '@/api/persetujuan';
import { motion, radius, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { IsiKartuTumpukan } from './BagianKartu';
import { periode } from './format';

const AMBANG = 0.4;
const PEGAS = { damping: 22, stiffness: 260 };

function Stempel({ jenis }: { jenis: 'setujui' | 'tolak' }): React.JSX.Element {
  const { colors } = useTheme();
  const warna = jenis === 'setujui' ? colors.success : colors.danger;
  return (
    <View style={[s.stempel, { borderColor: warna, backgroundColor: colors.surface, transform: [{ rotate: jenis === 'setujui' ? '-6deg' : '6deg' }] }]}>
      <Icon name={jenis === 'setujui' ? 'check' : 'x'} size={26} color={warna} strokeWidth={2.6} />
      <Text variant="h2" weight={800} style={{ color: warna, letterSpacing: 3 }}>
        {jenis === 'setujui' ? 'SETUJUI' : 'TOLAK'}
      </Text>
    </View>
  );
}

function KartuAtas({
  item,
  detail,
  memuatDetail,
  nonaktif,
  onSetujui,
  onTolak,
  onRevisi,
  onDetail,
}: {
  item: ItemAntrean;
  detail: DetailPersetujuan | null;
  memuatDetail: boolean;
  nonaktif: boolean;
  onSetujui: () => void;
  onTolak: () => void;
  onRevisi: () => void;
  onDetail: () => void;
}): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const kurangiGerak = useReducedMotion();
  const [lebar, setLebar] = useState(0);
  const x = useSharedValue(0);

  const selesai = useCallback(
    (hasil: 'setujui' | 'tolak'): void => {
      if (hasil === 'setujui') {
        onSetujui();
      } else {
        onTolak();
      }
    },
    [onSetujui, onTolak],
  );

  const geser = Gesture.Pan()
    .enabled(!nonaktif && lebar > 0)
    .activeOffsetX([-14, 14])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      x.set(e.translationX);
    })
    .onEnd((e) => {
      const posisi = x.get();
      const lempar = Math.abs(e.velocityX) > 1200 && Math.sign(e.velocityX) === Math.sign(posisi) && Math.abs(posisi) > lebar * 0.2;
      if (posisi > lebar * AMBANG || (lempar && posisi > 0)) {
        if (kurangiGerak) {
          x.set(lebar * 1.4);
        } else {
          x.set(withTiming(lebar * 1.4, { duration: motion.base }));
        }
        scheduleOnRN(selesai, 'setujui');
      } else if (posisi < -lebar * AMBANG || (lempar && posisi < 0)) {
        x.set(kurangiGerak ? 0 : withSpring(0, PEGAS));
        scheduleOnRN(selesai, 'tolak');
      } else {
        x.set(kurangiGerak ? 0 : withSpring(0, PEGAS));
      }
    });

  const gayaKartu = useAnimatedStyle(() => {
    const putar = kurangiGerak || lebar === 0 ? 0 : (x.get() / lebar) * 8;
    return { transform: [{ translateX: x.get() }, { rotate: `${putar}deg` }] };
  });
  const gayaSetuju = useAnimatedStyle(() => ({
    opacity: lebar === 0 ? 0 : interpolate(x.get(), [lebar * 0.15, lebar * AMBANG], [0, 1], Extrapolation.CLAMP),
  }));
  const gayaTolak = useAnimatedStyle(() => ({
    opacity: lebar === 0 ? 0 : interpolate(x.get(), [-lebar * AMBANG, -lebar * 0.15], [1, 0], Extrapolation.CLAMP),
  }));

  const p = periode(item);
  const label = `${item.user.name}, ${item.type.name}, ${[p.utama, p.jam, p.keterangan].filter(Boolean).join(', ')}`;
  const aksi = nonaktif
    ? [{ name: 'activate', label: 'Buka detail' }]
    : [
        { name: 'activate', label: 'Buka detail' },
        { name: 'setujui', label: 'Setujui' },
        { name: 'tolak', label: 'Tolak' },
        { name: 'revisi', label: 'Minta revisi' },
      ];

  return (
    <GestureDetector gesture={geser}>
      <Animated.View
        onLayout={(e) => setLebar(e.nativeEvent.layout.width)}
        style={[s.kartu, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.float }, gayaKartu]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={nonaktif ? 'Offline: keputusan dimatikan' : 'Geser kanan untuk menyetujui, geser kiri untuk menolak'}
        accessibilityActions={aksi}
        onAccessibilityAction={(e) => {
          switch (e.nativeEvent.actionName) {
            case 'activate':
              onDetail();
              break;
            case 'setujui':
              onSetujui();
              break;
            case 'tolak':
              onTolak();
              break;
            case 'revisi':
              onRevisi();
              break;
          }
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 22 }} showsVerticalScrollIndicator={false}>
          <IsiKartuTumpukan item={item} detail={detail} memuatDetail={memuatDetail} onDetail={onDetail} />
        </ScrollView>
        <Animated.View pointerEvents="none" style={[s.stempelKiri, gayaSetuju]}>
          <Stempel jenis="setujui" />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[s.stempelKanan, gayaTolak]}>
          <Stempel jenis="tolak" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function TumpukanKartu({
  items,
  detail,
  memuatDetail,
  nonaktif,
  onSetujui,
  onTolak,
  onRevisi,
  onDetail,
}: {
  /** Urutan antrean; [0] = kartu teratas. */
  items: ItemAntrean[];
  detail: DetailPersetujuan | null;
  memuatDetail: boolean;
  nonaktif: boolean;
  onSetujui: (item: ItemAntrean) => void;
  onTolak: (item: ItemAntrean) => void;
  onRevisi: (item: ItemAntrean) => void;
  onDetail: (item: ItemAntrean) => void;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  const atas = items[0];
  if (!atas) {
    return null;
  }
  const bayangan = Math.min(items.length - 1, 2);
  return (
    <View style={{ flex: 1, paddingBottom: bayangan * 8 }}>
      {bayangan >= 2 ? <View style={[s.bayangan, { left: 22, right: 22, bottom: 0, backgroundColor: colors.surface, borderColor: colors.border }]} /> : null}
      {bayangan >= 1 ? <View style={[s.bayangan, { left: 11, right: 11, bottom: bayangan * 8 - 8, backgroundColor: colors.surface, borderColor: colors.border }]} /> : null}
      <KartuAtas
        key={atas.id}
        item={atas}
        detail={detail?.request.id === atas.id ? detail : null}
        memuatDetail={memuatDetail}
        nonaktif={nonaktif}
        onSetujui={() => onSetujui(atas)}
        onTolak={() => onTolak(atas)}
        onRevisi={() => onRevisi(atas)}
        onDetail={() => onDetail(atas)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  kartu: { flex: 1, borderRadius: radius.hero + 6, borderWidth: 1, overflow: 'hidden' },
  bayangan: { position: 'absolute', top: 24, borderRadius: radius.hero + 6, borderWidth: 1 },
  stempel: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  stempelKiri: { position: 'absolute', top: 150, left: 18 },
  stempelKanan: { position: 'absolute', top: 150, right: 18 },
});
