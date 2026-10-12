/**
 * Kebijakan privasi — pembaca (`GET /kebijakan-privasi`, publik: bisa dibuka
 * dari layar Masuk tanpa sesi). Daftar isi (sheet), memuat, dan salinan luring
 * terakhir bila server tak terjangkau.
 * Mockup: docs/mockups/android/screens/01-akses-akun/22-kebijakan-privasi.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { ambilKebijakanPrivasi, bacaSalinanKebijakan, simpanSalinanKebijakan, type KebijakanPrivasi } from '@/api/privasi';
import { tglPendekYMD } from '@/features/settings/konstanta';
import { Markdown } from '@/features/settings/Markdown';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';
import { Banner, BottomSheet, Button, ErrorState, ListRow, PageGlow, Skeleton, SubAppBar, Text } from '@/ui';

function polosJudul(judul: string): string {
  return judul.replace(/^\d+[.)]\s*/, '');
}

export default function LayarKebijakanPrivasi(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { status } = useSession();
  const [salinan] = useState<KebijakanPrivasi | null>(() => bacaSalinanKebijakan());
  const [kebijakan, setKebijakan] = useState<KebijakanPrivasi | null>(salinan);
  const [dariSalinan, setDariSalinan] = useState(salinan !== null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [daftarIsi, setDaftarIsi] = useState(false);
  const gulir = useRef<ScrollView>(null);
  const posisi = useRef<Record<number, number>>({});

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    try {
      const baru = await ambilKebijakanPrivasi();
      setKebijakan(baru);
      setDariSalinan(false);
      setGalat(null);
      setOffline(false);
      simpanSalinanKebijakan(baru);
    } catch (err) {
      setOffline(err instanceof ApiError && err.status === 0);
      setGalat(err instanceof ApiError && err.status !== 0 ? err.message : 'Tidak ada jaringan. Kebijakan privasi belum termuat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  const keBagian = (indeks: number): void => {
    setDaftarIsi(false);
    gulir.current?.scrollTo({ y: Math.max(0, (posisi.current[indeks] ?? 0) - 8), animated: true });
  };

  const kembali = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/masuk' as never);
    }
  };

  const adaIsi = kebijakan !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageGlow />
      <SubAppBar
        title="Kebijakan privasi"
        onBack={kembali}
        actions={adaIsi ? [{ icon: 'list', label: 'Daftar isi', onPress: () => setDaftarIsi(true) }] : []}
      />
      <ScrollView ref={gulir} contentContainerStyle={[s.isi, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {(offline || galat) && adaIsi && dariSalinan && !memuat ? (
          <Banner tone="warn" icon="wifi-off" message={`Tidak ada jaringan. Menampilkan salinan tersimpan (v${kebijakan?.version ?? ''}).`} />
        ) : null}

        {!adaIsi && memuat ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={32} width="60%" />
            <Skeleton height={16} width="40%" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={16} width={i % 3 === 2 ? '70%' : '100%'} />
            ))}
          </View>
        ) : !adaIsi ? (
          <ErrorState message={galat ?? 'Kebijakan privasi belum termuat.'} kind={offline ? 'offline' : 'umum'} onRetry={() => void muat()} />
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <Text variant="h1" accessibilityRole="header">
                {kebijakan.title}
              </Text>
              <Text variant="meta">{`Versi ${kebijakan.version} · berlaku sejak ${tglPendekYMD(kebijakan.effective_date)}`}</Text>
            </View>

            {kebijakan.sections.map((bagian, i) => (
              <View
                key={`${i}-${bagian.title}`}
                style={{ gap: 10 }}
                onLayout={(e) => {
                  posisi.current[i] = e.nativeEvent.layout.y;
                }}
              >
                <Text variant="h3" accessibilityRole="header">
                  {bagian.title}
                </Text>
                <Markdown sumber={bagian.body_markdown} />
              </View>
            ))}
          </>
        )}

        {status !== 'masuk' ? <Button title="Kembali ke halaman masuk" variant="outline" onPress={kembali} /> : null}
      </ScrollView>

      <BottomSheet visible={daftarIsi} onClose={() => setDaftarIsi(false)} title="Daftar isi" scrollable>
        {(kebijakan?.sections ?? []).map((bagian, i) => (
          <ListRow
            key={`${i}-${bagian.title}`}
            leading={
              <View style={[s.nomor, { backgroundColor: colors.linkSoft }]}>
                <Text variant="label" tone="link" weight={700}>
                  {String(i + 1)}
                </Text>
              </View>
            }
            title={polosJudul(bagian.title)}
            onPress={() => keBagian(i)}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  isi: { paddingHorizontal: 16, paddingTop: 16, gap: 20 },
  nomor: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
