/**
 * Bottom sheet Arus (radius 28, kaca kuat, pegangan 36×4) di atas
 * @gorhom/bottom-sheet. Butuh `UIProvider` di akar. Tutup: seret ke bawah,
 * ketuk scrim, atau tombol kembali sistem.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  type BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useTheme } from '@/theme';

import { Icon, type AnyIconName } from './Icon';
import { IconButton } from './Button';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Tombol × di kepala (selain seret & kembali). */
  showClose?: boolean;
  /** Isi bergulir (daftar panjang); tinggi dibatasi 90% layar. */
  scrollable?: boolean;
  /** Snap tetap, mis. ['50%', '90%']; bila kosong tinggi mengikuti isi. */
  snapPoints?: (string | number)[];
  children: React.ReactNode;
}

function Latar({ style }: BottomSheetBackgroundProps): React.JSX.Element {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={[
        style,
        {
          backgroundColor: colors.glassStrong,
          borderTopLeftRadius: radius['3xl'],
          borderTopRightRadius: radius['3xl'],
          borderWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: 0,
          borderColor: colors.glassBorder,
          boxShadow: shadows.float,
        },
      ]}
    />
  );
}

function Pegangan(_: BottomSheetHandleProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.pegangan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.batang, { backgroundColor: colors.borderStrong }]} />
    </View>
  );
}

export function BottomSheet({ visible, onClose, title, showClose = false, scrollable = false, snapPoints, children }: BottomSheetProps): React.JSX.Element {
  const ref = useRef<BottomSheetModal>(null);
  const tampil = useRef(visible);
  // Sudah di-present dan belum ditutup. `dismiss()` pada modal yang belum
  // pernah terbuka membuat status gorhom macet di DISMISSING, lalu setiap
  // `present()` berikutnya diabaikan (lembar tidak pernah tampil).
  const terbuka = useRef(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { dark } = useTheme();

  useEffect(() => {
    tampil.current = visible;
    if (visible) {
      terbuka.current = true;
      ref.current?.present();
    } else if (terbuka.current) {
      terbuka.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => langganan.remove();
  }, [visible, onClose]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={dark ? 0.6 : 0.45} pressBehavior="close" />
    ),
    [dark],
  );

  const kepala = title ? (
    <View style={s.kepala}>
      <Text variant="h3" style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
      {showClose ? <IconButton icon="x" label="Tutup" variant="ghost" onPress={onClose} size={40} /> : null}
    </View>
  ) : null;

  const isi = (
    <>
      {kepala}
      {children}
    </>
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      maxDynamicContentSize={Math.round(height * 0.9)}
      enablePanDownToClose
      backdropComponent={backdrop}
      handleComponent={Pegangan}
      backgroundComponent={Latar}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // Edge-to-edge (targetSdk 36): jendela tidak mengecil saat keyboard muncul,
      // jadi lembar yang harus naik sendiri — adjustResize membuat isi tertutup keyboard.
      android_keyboardInputMode="adjustPan"
      onDismiss={() => {
        terbuka.current = false;
        // Dismiss programatik (visible → false) sudah diketahui induk.
        if (tampil.current) {
          onClose();
        }
      }}
    >
      {scrollable ? (
        <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>{isi}</BottomSheetScrollView>
      ) : (
        <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>{isi}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

/** Baris aksi di sheet (≥ 56 px): ikon ubin + label. `tone="danger"` untuk aksi merusak. */
export function SheetAction({
  icon,
  label,
  description,
  tone = 'default',
  onPress,
}: {
  icon: AnyIconName;
  label: string;
  description?: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const bahaya = tone === 'danger';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.aksi}>
      <View style={[s.ubin, { backgroundColor: bahaya ? colors.dangerSoft : colors.surface2 }]}>
        <Icon name={icon} size={22} color={bahaya ? colors.danger : colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="title" tone={bahaya ? 'danger' : 'text'}>
          {label}
        </Text>
        {description ? <Text variant="meta">{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pegangan: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  batang: { width: 36, height: 4, borderRadius: 2 },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, marginBottom: 4 },
  aksi: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  ubin: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
