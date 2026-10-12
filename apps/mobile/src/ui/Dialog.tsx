/**
 * Dialog gaya Material (radius 28, permukaan solid, aksi di kanan bawah) —
 * pengganti `Alert.alert`. Dipakai langsung (`<Dialog visible …/>`) atau
 * lewat `useDialog()` (confirm/alert/askReason mengembalikan Promise).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion, radius, useTheme } from '@/theme';

import { Button, type ButtonVariant } from './Button';
import { Field, Input } from './Input';
import { Text } from './Text';

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  children?: React.ReactNode;
  /** Urutan kiri → kanan; aksi utama terakhir. */
  actions: DialogAction[];
  /** Ketuk scrim / tombol kembali. Abaikan = dialog tidak tertutup sendiri. */
  onClose?: () => void;
}

export function Dialog({ visible, title, message, children, actions, onClose }: DialogProps): React.JSX.Element | null {
  const { colors, shadows } = useTheme();
  const kurangiGerak = useReducedMotion();
  const [terpasang, setTerpasang] = useState(visible);
  const p = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- memasang Modal sebelum animasi masuk
      setTerpasang(true);
      p.value = kurangiGerak ? 1 : withTiming(1, { duration: motion.base, easing: motion.ease });
      return undefined;
    }
    p.value = kurangiGerak ? 0 : withTiming(0, { duration: motion.fast, easing: motion.ease });
    const t = setTimeout(() => setTerpasang(false), kurangiGerak ? 0 : motion.fast);
    return () => clearTimeout(t);
  }, [visible, kurangiGerak, p]);

  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const kartu = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.96 + 0.04 * p.value }] }));

  if (!terpasang) {
    return null;
  }

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={s.akar}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
          <RNPressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Tutup dialog" accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[s.kartu, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.float }, kartu]}
        >
          <Text variant="h3" accessibilityRole="header">
            {title}
          </Text>
          {message ? (
            <Text variant="body" tone="muted" style={{ fontSize: 16, lineHeight: 24 }}>
              {message}
            </Text>
          ) : null}
          {children}
          <View style={s.aksi}>
            {actions.map((a) => (
              <Button
                key={a.label}
                title={a.label}
                onPress={a.onPress}
                variant={a.variant ?? 'quiet'}
                size="sm"
                disabled={a.disabled}
                loading={a.loading}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── API imperatif (Promise) ──────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Aksi merusak: tombol konfirmasi solid bahaya. */
  destructive?: boolean;
}

export interface AlertOptions {
  title: string;
  message?: string;
  okLabel?: string;
}

export interface ReasonOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  /** Panjang minimum alasan (bawaan 10, seperti aturan web). */
  minLength?: number;
  confirmLabel?: string;
  destructive?: boolean;
}

interface DialogApi {
  /** `true` bila dikonfirmasi, `false` bila dibatalkan. */
  confirm: (opsi: ConfirmOptions) => Promise<boolean>;
  alert: (opsi: AlertOptions) => Promise<void>;
  /** Teks alasan, atau `null` bila dibatalkan. */
  askReason: (opsi: ReasonOptions) => Promise<string | null>;
}

type Antrean =
  | { jenis: 'confirm'; opsi: ConfirmOptions; selesai: (v: boolean) => void }
  | { jenis: 'alert'; opsi: AlertOptions; selesai: () => void }
  | { jenis: 'alasan'; opsi: ReasonOptions; selesai: (v: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [aktif, setAktif] = useState<Antrean | null>(null);
  const [tampil, setTampil] = useState(false);
  const [alasan, setAlasan] = useState('');

  const buka = useCallback((item: Antrean): void => {
    setAlasan('');
    setAktif(item);
    setTampil(true);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opsi) => new Promise<boolean>((selesai) => buka({ jenis: 'confirm', opsi, selesai })),
      alert: (opsi) => new Promise<void>((selesai) => buka({ jenis: 'alert', opsi, selesai })),
      askReason: (opsi) => new Promise<string | null>((selesai) => buka({ jenis: 'alasan', opsi, selesai })),
    }),
    [buka],
  );

  const tutup = (hasil: boolean | string | null): void => {
    const item = aktif;
    setTampil(false);
    if (!item) {
      return;
    }
    if (item.jenis === 'confirm') {
      item.selesai(hasil === true);
    } else if (item.jenis === 'alert') {
      item.selesai();
    } else {
      item.selesai(typeof hasil === 'string' ? hasil : null);
    }
  };

  // `aktif` tidak dikosongkan saat ditutup: isinya tetap dirender selama animasi keluar.
  const item = aktif;
  let props: DialogProps = { visible: false, title: '', actions: [] };
  let isiTambahan: React.ReactNode = null;

  if (item?.jenis === 'confirm') {
    const o = item.opsi;
    props = {
      visible: tampil,
      title: o.title,
      message: o.message,
      onClose: () => tutup(false),
      actions: [
        { label: o.cancelLabel ?? 'Batal', onPress: () => tutup(false), variant: 'quiet' },
        { label: o.confirmLabel ?? 'Ya', onPress: () => tutup(true), variant: o.destructive ? 'danger' : 'primary' },
      ],
    };
  } else if (item?.jenis === 'alert') {
    const o = item.opsi;
    props = {
      visible: tampil,
      title: o.title,
      message: o.message,
      onClose: () => tutup(true),
      actions: [{ label: o.okLabel ?? 'Oke', onPress: () => tutup(true), variant: 'primary' }],
    };
  } else if (item?.jenis === 'alasan') {
    const o = item.opsi;
    const min = o.minLength ?? 10;
    const cukup = alasan.trim().length >= min;
    props = {
      visible: tampil,
      title: o.title,
      message: o.message,
      onClose: () => tutup(null),
      actions: [
        { label: 'Batal', onPress: () => tutup(null), variant: 'quiet' },
        { label: o.confirmLabel ?? 'Kirim', onPress: () => tutup(alasan.trim()), variant: o.destructive ? 'danger' : 'primary', disabled: !cukup },
      ],
    };
    isiTambahan = (
      <Field label={o.label ?? 'Alasan'} hint={`Minimal ${min} karakter`} counter={`${alasan.trim().length} / ${min}`} required>
        <Input value={alasan} onChangeText={setAlasan} multiline placeholder={o.placeholder ?? 'Tulis alasan…'} maxLength={500} />
      </Field>
    );
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Dialog {...props}>{isiTambahan}</Dialog>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const nilai = useContext(DialogContext);
  if (!nilai) {
    throw new Error('useDialog harus di dalam UIProvider');
  }
  return nilai;
}

const s = StyleSheet.create({
  akar: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  kartu: { borderRadius: radius['3xl'], borderWidth: 1, padding: 24, gap: 14 },
  aksi: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
});
