/**
 * Tampilan Board (mockup 05 › 16): satu kolom per layar — chip kolom
 * (ikon status + nama + jumlah), kartu kolom terpilih, "Pindahkan" (tanpa
 * seret), geser kiri/kanan untuk pindah kolom, filter klien.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { FilterTugas, KartuWorkspace, PapanData } from '@/api/workspace';
import { KartuPapan } from '@/components/KartuPapan';
import { warnaPalet } from '@/lib/palette';
import { useTheme } from '@/theme';
import { Banner, Button, EmptyState, Gradient, Loading, Pressable, Text } from '@/ui';

import { BannerBacaSaja, GalatMuat, PitaOffline, TabScroll } from './bagian';
import { IkonStatus } from './ikon';
import type { HasilResource } from './useResource';
import { jumlahFilterAktif, lolosFilter, urutPrioritas } from './util';

export function PapanView({
  papan,
  filter,
  meId,
  boleh,
  onHapusFilter,
  onPindah,
  onTugasBaru,
}: {
  papan: HasilResource<PapanData>;
  filter: FilterTugas;
  meId: string | null;
  /** Boleh memindah kartu (tidak baca-saja). */
  boleh: boolean;
  onHapusFilter: () => void;
  onPindah: (tugas: KartuWorkspace) => void;
  onTugasBaru: (statusId: string) => void;
}): React.JSX.Element {
  const { colors, dark } = useTheme();
  const [aktif, setAktif] = useState<string | null>(null);
  const data = papan.data;
  const kolom = useMemo(() => data?.columns ?? [], [data]);
  const idAktif = aktif !== null && kolom.some((k) => k.id === aktif) ? aktif : (kolom[0]?.id ?? null);
  const indeks = kolom.findIndex((k) => k.id === idAktif);
  const nFilter = jumlahFilterAktif(filter);

  const terlihat = useMemo(() => {
    const peta = new Map<string, KartuWorkspace[]>();
    for (const k of kolom) {
      peta.set(k.id, nFilter === 0 ? k.tasks : k.tasks.filter((t) => lolosFilter(t, filter, meId)));
    }
    return peta;
  }, [kolom, filter, meId, nFilter]);

  const geser = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-28, 28])
        .failOffsetY([-14, 14])
        .onEnd((e) => {
          const ke = e.translationX < -60 ? indeks + 1 : e.translationX > 60 ? indeks - 1 : indeks;
          const tujuan = kolom[ke];
          if (tujuan && ke !== indeks) {
            setAktif(tujuan.id);
          }
        }),
    [indeks, kolom],
  );

  if (papan.memuat && !data) {
    return (
      <TabScroll>
        <Loading label="Memuat papan…" rows={4} />
      </TabScroll>
    );
  }
  if (papan.galat && !data) {
    return <GalatMuat galat={papan.galat} judul="Papan belum bisa dimuat" onCoba={() => void papan.muat()} />;
  }
  if (!data) {
    return <View />;
  }

  const k = kolom.find((c) => c.id === idAktif) ?? null;
  const kartu = k ? (terlihat.get(k.id) ?? []).slice().sort(urutPrioritas) : [];
  const jumlahSemua = kolom.reduce((n, c) => n + c.tasks.length, 0);
  const jumlahCocok = [...terlihat.values()].reduce((n, l) => n + l.length, 0);

  return (
    <GestureDetector gesture={geser}>
      <View style={{ flex: 1 }}>
        <TabScroll onRefresh={papan.muat} ruangFab={boleh}>
          <BannerBacaSaja info={data.read_only} />
          {papan.offline ? <PitaOffline diperbarui={papan.diperbarui} objek="papan" /> : null}
          {papan.offline && boleh ? <Banner tone="info" icon="cloud-upload" message="Offline · pindah kartu dan perubahan lain disimpan di HP, lalu dikirim otomatis saat tersambung." /> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={s.kolomGulir} contentContainerStyle={s.kolomBaris}>
            {kolom.map((c) => {
              const dipilih = c.id === idAktif;
              const n = (terlihat.get(c.id) ?? []).length;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setAktif(c.id)}
                  scaleTo={0.98}
                  accessibilityRole="tab"
                  accessibilityLabel={`${c.name}, ${n} tugas`}
                  accessibilityState={{ selected: dipilih }}
                  style={[s.chip, { borderColor: dipilih ? 'transparent' : colors.border, backgroundColor: dipilih ? 'transparent' : colors.surface }]}
                >
                  {dipilih ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} /> : null}
                  <IkonStatus kategori={c.kategori} warna={c.color} hex={dipilih ? '#FFFFFF' : undefined} ukuran={20} />
                  <Text variant="label" style={{ color: dipilih ? '#FFFFFF' : colors.text }} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text variant="label" style={{ color: dipilih ? '#FFFFFF' : colors.muted, opacity: 0.9 }}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {k ? (
            <View style={s.judulKolom}>
              <View style={[s.titikKolom, { backgroundColor: warnaPalet(k.color, dark) }]} />
              <Text variant="title" weight={800} style={{ flex: 1 }}>
                {k.name}
                <Text variant="meta">{` · ${kartu.length} tugas${k.kategori === 'done' ? ' · ditutup ≤ 30 hari' : ' · urut prioritas'}`}</Text>
              </Text>
            </View>
          ) : null}

          {k && kartu.length === 0 ? (
            nFilter > 0 && k.tasks.length > 0 ? (
              <EmptyState icon="search-x" title="Tidak ada yang cocok" description="Tidak ada tugas di kolom ini yang cocok dengan filter." actionLabel="Hapus filter" onAction={onHapusFilter} />
            ) : (
              <EmptyState
                icon="square-dashed"
                title={jumlahSemua === 0 ? 'Belum ada tugas' : 'Kolom kosong'}
                description={jumlahSemua === 0 ? 'Buat tugas pertama atau pakai template tugas.' : `Belum ada tugas di kolom ${k.name}.`}
                actionLabel={boleh ? (jumlahSemua === 0 ? 'Tugas baru' : `Tugas baru di ${k.name}`) : undefined}
                onAction={boleh ? () => onTugasBaru(k.id) : undefined}
              />
            )
          ) : (
            <View style={{ gap: 10 }}>
              {kartu.map((t) => (
                <KartuPapan key={t.id} tugas={t} labels={data.labels} onPress={() => router.push(`/tugas/${t.id}`)} onPindah={boleh && t.can?.move !== false ? () => onPindah(t) : undefined} />
              ))}
            </View>
          )}

          {nFilter > 0 && k ? (
            <View style={s.baris}>
              <Text variant="meta" style={{ flex: 1 }}>{`${jumlahCocok} dari ${jumlahSemua} tugas cocok`}</Text>
              <Button title="Hapus filter" variant="quiet" size="sm" onPress={onHapusFilter} />
            </View>
          ) : null}

          {data.hidden_closed_count > 0 ? (
            <Text variant="meta" align="center">
              {`${data.hidden_closed_count} tugas ditutup lebih dari 30 hari tidak ditampilkan.`}
            </Text>
          ) : null}

          {kolom.length > 1 ? (
            <View style={s.titikHalaman} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {kolom.map((c) => (
                <View key={c.id} style={[s.titikH, { backgroundColor: c.id === idAktif ? colors.primary : colors.borderStrong }]} />
              ))}
            </View>
          ) : null}
          {kolom.length > 1 ? (
            <Text variant="meta" align="center">
              Geser untuk kolom lain
            </Text>
          ) : null}
        </TabScroll>
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  kolomGulir: { flexGrow: 0, marginHorizontal: -16 },
  kolomBaris: { gap: 8, paddingHorizontal: 16 },
  chip: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' },
  judulKolom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  titikKolom: { width: 10, height: 10, borderRadius: 5 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titikHalaman: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  titikH: { width: 6, height: 6, borderRadius: 3 },
});
