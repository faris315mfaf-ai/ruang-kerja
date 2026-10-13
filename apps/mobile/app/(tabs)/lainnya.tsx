/**
 * Lainnya — pintu ke semua modul, disusun per peran (staf · Kepala Divisi ·
 * HR · Direksi/Super Admin): kartu identitas → Workspace → Pekerjaan →
 * Organisasi (bukan staf) → Akun & pengaturan.
 * Mockup: docs/mockups/android/screens/13-fondasi-desain/14-lainnya-per-peran,
 * screens/01-akses-akun/12-lainnya (memuat, offline).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarWorkspace } from '@/api/endpoints';
import type { WorkspaceItem } from '@/api/types';
import { useAksesHiring } from '@/features/hiring/akses';
import { menuOrganisasi, menuPekerjaan } from '@/features/settings/menuLainnya';
import { DaftarMenu, GroupLabel, KartuIdentitas, type ItemMenu } from '@/features/settings/parts';
import { barisJabatan } from '@/features/settings/profile';
import { useKeluar } from '@/features/settings/useKeluar';
import { useProfilLengkap } from '@/features/settings/useProfilLengkap';
import { useUnread } from '@/session/UnreadProvider';
import { useTheme, type ThemeMode } from '@/theme';
import { AppBar, BottomSheet, Card, Gradient, OfflineBanner, Pressable, Radio, Screen, Skeleton, Text } from '@/ui';

interface RuangKartu extends WorkspaceItem {
  pribadi: boolean;
}

const GRADIEN_KARTU = ['merek', 'indigo', 'aksi', 'hangat'] as const;

const PILIHAN_TEMA: { nilai: ThemeMode; label: string }[] = [
  { nilai: 'light', label: 'Terang' },
  { nilai: 'dark', label: 'Gelap' },
  { nilai: 'system', label: 'Ikuti sistem' },
];

function labelTema(mode: string): string {
  return mode === 'light' ? 'Terang' : mode === 'dark' ? 'Gelap' : 'Ikuti sistem';
}

function KartuWorkspace({ ruang, indeks }: { ruang: RuangKartu; indeks: number }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const nama = ruang.pribadi ? 'Ruang saya' : ruang.name;
  return (
    <Pressable
      onPress={() => router.push(`/workspace/${ruang.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Buka workspace ${nama}`}
      style={[s.kartuWs, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.card }]}
    >
      <Gradient name={ruang.pribadi ? 'slate' : (GRADIEN_KARTU[indeks % GRADIEN_KARTU.length] ?? 'merek')} style={s.ubinWs}>
        <Text variant="title" weight={800} tone="onPrimary">
          {nama.slice(0, 1).toUpperCase()}
        </Text>
      </Gradient>
      <View style={{ gap: 2 }}>
        <Text variant="title" numberOfLines={2}>
          {nama}
        </Text>
        <Text variant="meta" numberOfLines={1}>
          {ruang.pribadi ? 'Pribadi' : ruang.key}
        </Text>
      </View>
    </Pressable>
  );
}

export default function LayarLainnya(): React.JSX.Element {
  const { colors, mode, setMode, dark } = useTheme();
  const [sheetTema, setSheetTema] = useState(false);
  const { jumlah: belumBaca } = useUnread();
  const { profil, peran, memuat, offline, muatUlang } = useProfilLengkap();
  const { keluarDenganKonfirmasi } = useKeluar();

  const [ruang, setRuang] = useState<RuangKartu[] | null>(null);
  const [galatRuang, setGalatRuang] = useState(false);
  const [offlineRuang, setOfflineRuang] = useState(false);

  const muatRuang = useCallback(async (): Promise<void> => {
    try {
      const hasil = await daftarWorkspace();
      const semua: RuangKartu[] = hasil.groups.flatMap((g) =>
        g.items.filter((i) => !i.arsip).map((i) => ({ ...i, pribadi: g.jenis === 'personal' || g.jenis === 'pribadi' })),
      );
      setRuang(semua);
      setGalatRuang(false);
      setOfflineRuang(false);
    } catch (err) {
      setGalatRuang(true);
      setOfflineRuang(err instanceof ApiError && err.status === 0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void muatRuang();
    }, [muatRuang]),
  );

  const muatSemua = useCallback(async (): Promise<void> => {
    await Promise.all([muatUlang(), muatRuang()]);
  }, [muatUlang, muatRuang]);

  const hiring = useAksesHiring();
  const konteks = useMemo(() => ({ profil, peran, belumBaca, warnaChevron: colors.muted, hiring }), [profil, peran, belumBaca, colors.muted, hiring]);
  const pekerjaan = useMemo(() => menuPekerjaan(konteks), [konteks]);
  const organisasi = useMemo(() => menuOrganisasi(konteks), [konteks]);

  const akun: ItemMenu[] = [
    { kunci: 'notifikasi', judul: 'Notifikasi', ikon: 'bell', onPress: () => router.push('/pengaturan/notifikasi' as never) },
    { kunci: 'tampilan', judul: 'Tampilan', subjudul: labelTema(mode), ikon: 'moon', onPress: () => setSheetTema(true) },
    { kunci: 'keamanan', judul: 'Keamanan & perangkat saya', ikon: 'shield-check', onPress: () => router.push('/pengaturan/keamanan' as never) },
    { kunci: 'privasi', judul: 'Privasi & Data Saya', ikon: 'lock', onPress: () => router.push('/privasi' as never) },
    { kunci: 'keluar', judul: 'Keluar', ikon: 'log-out', nada: 'bad', onPress: () => void keluarDenganKonfirmasi() },
  ];

  const tampilRuang = (ruang ?? []).slice(0, 4);
  const adaWorkspaceLain = (ruang ?? []).length > 4;

  return (
    <Screen refreshing={memuat && ruang !== null} onRefresh={() => void muatSemua()}>
      <AppBar
        title="Lainnya"
        actions={[
          { icon: 'search', label: 'Cari', onPress: () => router.push('/cari') },
          { icon: 'bell', label: 'Inbox', onPress: () => router.push('/inbox'), badge: belumBaca > 0 ? belumBaca : undefined },
          { icon: 'settings', label: 'Pengaturan', onPress: () => router.push('/pengaturan' as never) },
        ]}
      />

      {offline || offlineRuang ? <OfflineBanner /> : null}

      <KartuIdentitas nama={profil.name} baris={barisJabatan(profil)} onPress={() => router.push('/profil' as never)} />

      <View style={s.kelompok}>
        <GroupLabel action={adaWorkspaceLain || peran.manajemen ? 'Semua' : undefined} onAction={() => router.push('/workspace')}>
          Workspace
        </GroupLabel>
        {ruang === null && !galatRuang ? (
          <View style={s.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={132} width="48%" />
            ))}
          </View>
        ) : galatRuang && ruang === null ? (
          <Card variant="tight">
            <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
              {offlineRuang ? 'Tidak ada koneksi, daftar workspace belum termuat.' : 'Daftar workspace belum termuat.'}
            </Text>
            <Pressable onPress={() => void muatRuang()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text variant="label" tone="link">
                Coba lagi
              </Text>
            </Pressable>
          </Card>
        ) : (
          <View style={s.grid}>
            {tampilRuang.map((r, i) => (
              <KartuWorkspace key={r.id} ruang={r} indeks={i} />
            ))}
          </View>
        )}
      </View>

      <View style={s.kelompok}>
        <GroupLabel>Pekerjaan</GroupLabel>
        <DaftarMenu items={pekerjaan} />
      </View>

      {organisasi.length > 0 ? (
        <View style={s.kelompok}>
          <GroupLabel>Organisasi</GroupLabel>
          <DaftarMenu items={organisasi} />
        </View>
      ) : null}

      <View style={s.kelompok}>
        <GroupLabel>Akun & pengaturan</GroupLabel>
        <DaftarMenu items={akun} />
      </View>

      <BottomSheet visible={sheetTema} onClose={() => setSheetTema(false)} title="Tampilan">
        <View style={{ gap: 2, paddingBottom: 8 }}>
          {PILIHAN_TEMA.map((p) => (
            <Radio
              key={p.nilai}
              selected={mode === p.nilai}
              label={p.label}
              onSelect={() => {
                setMode(p.nilai);
                setSheetTema(false);
              }}
            />
          ))}
          <Text variant="meta" style={{ paddingTop: 8 }}>
            {`Sekarang: ${dark ? 'gelap' : 'terang'}`}
          </Text>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  kelompok: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  kartuWs: { width: '48%', borderRadius: 24, borderWidth: 1, padding: 16, gap: 14, minHeight: 132 },
  ubinWs: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
