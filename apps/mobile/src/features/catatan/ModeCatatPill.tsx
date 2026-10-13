/**
 * Pil global Catatan, dipasang sekali di layout akar (di atas semua layar):
 *  - "Notulensi berjalan · Kembali" selama mode catat (mockup 17) — hilang
 *    saat editor dokumen sesi sedang terbuka;
 *  - "Catatan belum tersimpan" untuk catatan yang ditinggalkan dengan
 *    perubahan belum terkirim (mockup 16): Simpan / Coba lagi / Muat ulang,
 *    "Tersimpan ✓" 2 detik, "+N catatan lain".
 * Di layar tab pil naik di atas kapsul tab bar dan menyisakan ruang FAB.
 */
import { router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { detailCatatan } from '@/api/catatan';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';
import { Gradient, Icon, Pressable, TAB_BAR_SPACE, Text, useSnackbar } from '@/ui';

import { Spin } from './Ikon';
import { ikatPengguna, sesiStore } from './sesiCatat';
import { cariSesi, ringkasanStore, type RingkasanSesi } from './sesiSimpan';

function PilModeCatat({ judul, noteId }: { judul: string; noteId: string }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/catatan/${noteId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Notulensi berjalan, ${judul}. Kembali ke notulensi`}
      style={[s.pil, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.float }]}
    >
      <View>
        <Gradient name="aksi" style={s.ubin}>
          <Icon name="notebook-pen" size={22} color="#FFFFFF" />
        </Gradient>
        <View style={[s.titikMerah, { backgroundColor: colors.badge, borderColor: colors.surface }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="meta" style={{ fontSize: 13, lineHeight: 16 }}>
          Notulensi berjalan
        </Text>
        <Text variant="label" weight={700} numberOfLines={1}>
          {judul}
        </Text>
      </View>
      <View style={[s.kembali, { backgroundColor: colors.linkSoft }]}>
        <Text variant="label" weight={700} tone="link">
          Kembali
        </Text>
        <Icon name="chevron-right" size={16} color={colors.link} />
      </View>
    </Pressable>
  );
}

function PilBelumTersimpan({ daftar }: { daftar: RingkasanSesi[] }): React.JSX.Element | null {
  const { colors, shadows } = useTheme();
  const snackbar = useSnackbar();
  const utama = daftar.find((d) => d.status === 'konflik') ?? daftar.find((d) => d.kotor) ?? daftar[0];
  if (utama === undefined) {
    return null;
  }
  const lain = daftar.length - 1;
  const luring = utama.status === 'gagal' && utama.galat?.status === 0;

  let label = 'Catatan belum tersimpan';
  let aksi: string | null = 'Simpan';
  let ikon: React.ReactNode = <Icon name="cloud-off" size={22} color={colors.warning} />;
  let jalankan = (): void => {
    void cariSesi(utama.id)?.siram();
  };
  if (utama.status === 'menyimpan') {
    label = 'Menyimpan…';
    aksi = null;
    ikon = <Spin color={colors.muted} />;
  } else if (utama.status === 'konflik') {
    label = 'Catatan diubah orang lain';
    aksi = 'Muat ulang';
    ikon = <Icon name="triangle-alert" size={22} color={colors.warning} />;
    jalankan = () => {
      detailCatatan(utama.id)
        .then((d) => cariSesi(utama.id)?.terapkanServer(d))
        .catch(() => snackbar.show({ message: 'Catatan gagal dimuat ulang. Coba lagi.', variant: 'bad' }));
    };
  } else if (luring) {
    label = 'Catatan belum tersimpan. Periksa koneksi.';
    aksi = 'Coba lagi';
  } else if (utama.status === 'gagal') {
    label = 'Catatan gagal disimpan';
    aksi = 'Coba lagi';
  } else if (!utama.kotor) {
    label = 'Tersimpan ✓';
    aksi = null;
    ikon = <Icon name="check" size={22} color={colors.success} />;
  }

  return (
    <View style={[s.pil, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.float }]} accessibilityLiveRegion="polite">
      <Pressable onPress={() => router.push(`/catatan/${utama.id}`)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${label}. ${utama.judul}. Buka catatan`} style={s.isiPil}>
        <View style={s.ikon}>{ikon}</View>
        <View style={{ flex: 1 }}>
          <Text variant="label" weight={700} numberOfLines={1}>
            {label}
          </Text>
          <Text variant="meta" numberOfLines={1} style={{ fontSize: 13, lineHeight: 16 }}>
            {utama.judul}
            {lain > 0 ? ` · +${lain} catatan lain` : ''}
          </Text>
        </View>
      </Pressable>
      {aksi !== null ? (
        <Pressable onPress={jalankan} accessibilityRole="button" accessibilityLabel={aksi} style={[s.kembali, { backgroundColor: colors.linkSoft }]}>
          <Text variant="label" weight={700} tone="link">
            {aksi}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ModeCatatPill(): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const segmen = useSegments();
  const { user } = useSession();
  const sesi = sesiStore.use();
  const ringkasan = ringkasanStore.use();
  const [, paksa] = useState(0);

  const userId = user?.id ?? null;
  useEffect(() => {
    void ikatPengguna(userId);
  }, [userId]);

  // Tersimpan ✓ hilang sendiri: segarkan setelah ringkasan berubah.
  useEffect(() => {
    if (ringkasan.length === 0) {
      return undefined;
    }
    const t = setTimeout(() => paksa((n) => n + 1), 2200);
    return () => clearTimeout(t);
  }, [ringkasan]);

  const diTab = (segmen[0] as string | undefined) === '(tabs)';
  const tampilMode = sesi.sesi !== null && !sesi.diDokumen;
  const daftar = ringkasan.filter((d) => d.kotor || d.status === 'menyimpan' || d.status === 'tersimpan');
  if (!tampilMode && daftar.length === 0) {
    return null;
  }
  const bawah = insets.bottom + (diTab ? TAB_BAR_SPACE - insets.bottom : 0) + 12;

  return (
    <View pointerEvents="box-none" style={[s.wadah, { bottom: Math.max(bawah, 12), right: diTab ? 96 : 16 }]}>
      {daftar.length > 0 ? <PilBelumTersimpan daftar={daftar} /> : null}
      {tampilMode && sesi.sesi ? <PilModeCatat judul={sesi.sesi.title} noteId={sesi.sesi.noteId} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wadah: { position: 'absolute', left: 16, gap: 8 },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: 28, borderWidth: 1, paddingLeft: 8, paddingRight: 8 },
  isiPil: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  ikon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  ubin: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titikMerah: { position: 'absolute', right: -2, top: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  kembali: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 40, borderRadius: 20, paddingHorizontal: 14 },
});
