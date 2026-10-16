/**
 * Pil/strip status offline global (mockup 12-android-native › 13/14):
 * satu strip tipis di bawah status bar, DI DALAM alur tata letak (bukan
 * overlay) sehingga tidak menutupi bilah aplikasi, FAB, atau tab bar.
 * Saat strip tampil, konteks area aman untuk layar di bawahnya diubah
 * (`top = 0`) karena strip sudah menutup area status bar.
 *
 * Mode: offline (kuning) · menyinkronkan/menunggu (biru) · perlu diperiksa
 * (merah, menetap) · dijeda karena sesi berakhir (merah) · "Semua tersinkron"
 * (hijau, hilang sesudah 3 dtk). Offline baru tampil setelah 1,5 dtk agar
 * kedipan sinyal tidak menggeser tata letak.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Icon, Pressable, Text, type AnyIconName } from '@/ui';

import { onAntrean, useAntrean, useRingkasanAntrean } from './antrean';
import { useOnline } from './jaringan';

type Nada = 'warn' | 'info' | 'bad' | 'ok';

interface ModeStrip {
  nada: Nada;
  ikon: AnyIconName;
  teks: string;
}

export const TINGGI_STRIP = 44;

function useModeStrip(): ModeStrip | null {
  const online = useOnline();
  const { total, menunggu, perluPeriksa, sinkron } = useRingkasanAntrean();
  const jeda = useAntrean((s) => s.jeda);
  const [offlineLama, setOfflineLama] = useState(false);
  const [selesaiAktif, setSelesaiAktif] = useState(false);

  useEffect(() => {
    if (online) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- penanda offline mengikuti jaringan (debounce)
      setOfflineLama(false);
      return undefined;
    }
    const t = setTimeout(() => setOfflineLama(true), 1500);
    return () => clearTimeout(t);
  }, [online]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lepas = onAntrean((p) => {
      if (p.tipe === 'selesai' && p.sukses > 0) {
        setSelesaiAktif(true);
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => setSelesaiAktif(false), 3000);
      }
    });
    return () => {
      lepas();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return useMemo<ModeStrip | null>(() => {
    const periksa = perluPeriksa > 0 ? ` · ${perluPeriksa} perlu diperiksa` : '';
    if (!online && offlineLama) {
      return { nada: 'warn', ikon: 'wifi-off', teks: menunggu > 0 ? `Offline · ${menunggu} menunggu${periksa}` : `Offline · data tersimpan ditampilkan${periksa}` };
    }
    if (jeda && total > 0) {
      return { nada: 'bad', ikon: 'lock', teks: `Sinkron dijeda · masuk lagi untuk mengirim ${total} perubahan` };
    }
    if (perluPeriksa > 0) {
      return { nada: 'bad', ikon: 'triangle-alert', teks: `${perluPeriksa} perubahan perlu diperiksa` };
    }
    if (sinkron) {
      return { nada: 'info', ikon: 'refresh-cw', teks: `Menyinkronkan ${total}…` };
    }
    if (menunggu > 0) {
      return { nada: 'info', ikon: 'cloud-upload', teks: `${menunggu} menunggu dikirim` };
    }
    if (selesaiAktif) {
      return { nada: 'ok', ikon: 'circle-check', teks: 'Semua tersinkron' };
    }
    return null;
  }, [online, offlineLama, jeda, total, menunggu, perluPeriksa, sinkron, selesaiAktif]);
}

function Strip({ mode, atas }: { mode: ModeStrip; atas: number }): React.JSX.Element {
  const { colors } = useTheme();
  const pasangan =
    mode.nada === 'warn'
      ? { bg: colors.warningSoft, fg: colors.warning }
      : mode.nada === 'bad'
        ? { bg: colors.dangerSoft, fg: colors.danger }
        : mode.nada === 'ok'
          ? { bg: colors.successSoft, fg: colors.success }
          : { bg: colors.infoSoft, fg: colors.info };
  return (
    <Pressable
      onPress={() => router.push('/sinkron' as never)}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={`${mode.teks}. Buka antrean sinkron`}
      accessibilityLiveRegion="polite"
      style={[s.strip, { backgroundColor: pasangan.bg, paddingTop: atas, borderBottomColor: colors.border }]}
    >
      <View style={s.baris}>
        <Icon name={mode.ikon} size={18} color={pasangan.fg} />
        <Text variant="label" weight={600} numberOfLines={1} style={{ flex: 1, color: pasangan.fg }}>
          {mode.teks}
        </Text>
        <Icon name="chevron-right" size={18} color={pasangan.fg} />
      </View>
    </Pressable>
  );
}

/**
 * Bungkus isi aplikasi ber-sesi: strip di atas, isi di bawahnya dengan konteks
 * area aman `top = 0` selama strip tampil. Pohon anak tidak dipasang ulang saat
 * strip muncul/hilang.
 */
export function KerangkaOffline({ aktif, children }: { aktif: boolean; children: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const mode = useModeStrip();
  const tampil = aktif && mode !== null;
  const nilai = useMemo(() => (tampil ? { ...insets, top: 0 } : insets), [tampil, insets]);
  return (
    <View style={s.akar}>
      {tampil && mode ? <Strip mode={mode} atas={insets.top} /> : null}
      <SafeAreaInsetsContext.Provider value={nilai}>
        <View style={s.akar}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const s = StyleSheet.create({
  akar: { flex: 1 },
  strip: { borderBottomWidth: StyleSheet.hairlineWidth },
  baris: { minHeight: TINGGI_STRIP, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
});
