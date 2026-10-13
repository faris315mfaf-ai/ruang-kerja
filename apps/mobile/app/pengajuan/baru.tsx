/**
 * Pilih jenis pengajuan (mockup 04-pengajuan-persetujuan/02): ubin kategori
 * terbuka, blok "Dikunci" (cuti & lembur bergembok + alasan, sheet
 * penjelasan), ubin belum berhak, memuat & galat. Param `jenis` (kode/slug)
 * dan `tanggal` langsung meneruskan ke form (pintu koreksi dari Absensi).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarJenis, type DaftarJenis, type KategoriJenis, type KategoriPengajuan } from '@/api/pengajuan';
import { META_KATEGORI, URUTAN_KATEGORI } from '@/features/pengajuan/format';
import { radius, useTheme } from '@/theme';
import { BottomSheet, Button, ErrorState, Icon, IconTile, Pressable, Screen, Skeleton, SubAppBar, Text, errorKindFromStatus } from '@/ui';

function Ubin({ kategori, onPress }: { kategori: KategoriJenis; onPress: () => void }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const meta = META_KATEGORI[kategori.value];
  const terbuka = kategori.types.filter((t) => !t.locked);
  const berhak = terbuka.some((t) => t.eligible);
  const kunci = kategori.locked || terbuka.length === 0;
  const pertama = terbuka[0];
  const alasan = kunci
    ? (kategori.types.find((t) => t.locked_reason)?.locked_reason ?? 'Dikunci HR.')
    : !berhak
      ? (pertama?.ineligible_reason ?? 'Anda belum berhak.')
      : kategori.value === 'correction' && pertama && pertama.max_backdate_days !== null
        ? `Lupa check-in atau check-out, maks. ${pertama.max_backdate_days} hari lalu`
        : kategori.value === 'sick' && pertama && pertama.requires_attachment_after_days !== null && pertama.requires_attachment_after_days > 0
          ? `Surat dokter wajib bila lebih dari ${pertama.requires_attachment_after_days} hari`
          : meta.ubin;
  const redup = kunci || !berhak;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}${kunci ? ', dikunci' : !berhak ? ', belum berhak' : ''}. ${alasan}`}
      style={[
        s.ubin,
        redup
          ? { backgroundColor: 'transparent', borderColor: colors.borderStrong, borderStyle: 'dashed' }
          : { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.card },
      ]}
    >
      <View style={s.ubinAtas}>
        {redup ? (
          <View style={[s.ikonRedup, { backgroundColor: colors.surface }]}>
            <Icon name={meta.icon} size={24} color={colors.muted} />
          </View>
        ) : (
          <IconTile icon={meta.icon} tone={meta.tile} size={48} />
        )}
        {redup ? <Icon name="lock" size={18} color={colors.muted} /> : null}
      </View>
      <Text variant="title" weight={700} tone={redup ? 'muted' : 'text'}>
        {meta.label}
      </Text>
      <Text variant="meta" tone="muted">
        {alasan}
      </Text>
    </Pressable>
  );
}

function KotakKunci({ teks }: { teks: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.kotakKunci, { borderColor: colors.borderStrong }]}>
      <Icon name="lock" size={20} color={colors.muted} />
      <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 16, lineHeight: 23 }}>
        {teks}
      </Text>
    </View>
  );
}

export default function LayarPilihJenis(): React.JSX.Element {
  const param = useLocalSearchParams<{ jenis?: string; tanggal?: string; kategori?: string }>();
  const [data, setData] = useState<DaftarJenis | null>(null);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [kunci, setKunci] = useState<KategoriJenis | null>(null);

  const jenisLangsung = param.jenis || param.kategori;

  useEffect(() => {
    if (jenisLangsung) {
      router.replace({ pathname: '/pengajuan/form', params: { jenis: jenisLangsung, ...(param.tanggal ? { tanggal: param.tanggal, asal: 'absensi' } : {}) } });
    }
  }, [jenisLangsung, param.tanggal]);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);
    try {
      setData(await daftarJenis());
    } catch (err) {
      setGalat(err instanceof ApiError ? err : new ApiError({ status: 500, message: 'Jenis pengajuan tidak dapat dimuat.' }));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    if (!jenisLangsung) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
      void muat();
    }
  }, [jenisLangsung, muat]);

  const urut = (a: KategoriPengajuan): number => URUTAN_KATEGORI.indexOf(a);
  const kategori = [...(data?.categories ?? [])].sort((a, b) => urut(a.value) - urut(b.value));
  const terbuka = kategori.filter((k) => !k.locked && k.types.some((t) => !t.locked));
  const dikunci = kategori.filter((k) => k.locked || !k.types.some((t) => !t.locked));

  const buka = (k: KategoriJenis): void => {
    const tipe = k.types.find((t) => !t.locked && t.eligible) ?? k.types.find((t) => !t.locked);
    if (!tipe) {
      setKunci(k);
      return;
    }
    router.push({ pathname: '/pengajuan/form', params: { tipe: tipe.id } });
  };

  const alasanKunci = kunci?.types.find((t) => t.locked_reason)?.locked_reason ?? 'Jenis ini dikunci HR.';

  return (
    <Screen header={<SubAppBar title="Pengajuan baru" />} onRefresh={jenisLangsung ? undefined : () => void muat()}>
      <View style={{ gap: 4 }}>
        <Text variant="h2" weight={800}>
          Apa yang ingin Anda ajukan?
        </Text>
        <Text variant="meta">Pilih jenis. Penyetuju diberi tahu setelah dikirim.</Text>
      </View>
      {galat && !data ? (
        <ErrorState
          kind={errorKindFromStatus(galat.status)}
          title="Jenis pengajuan tidak termuat"
          message={galat.status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi.' : galat.message}
          onRetry={() => void muat()}
        />
      ) : memuat || !data ? (
        <View style={s.kisi}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={s.sel}>
              <Skeleton height={150} radiusPx={radius.card} />
            </View>
          ))}
        </View>
      ) : (
        <>
          <View style={s.kisi}>
            {terbuka.map((k) => (
              <View key={k.value} style={s.sel}>
                <Ubin kategori={k} onPress={() => buka(k)} />
              </View>
            ))}
          </View>
          {dikunci.length > 0 ? (
            <>
              <Text variant="overline">DIKUNCI</Text>
              <View style={s.kisi}>
                {dikunci.map((k) => (
                  <View key={k.value} style={s.sel}>
                    <Ubin kategori={k} onPress={() => setKunci(k)} />
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}

      <BottomSheet visible={kunci !== null} onClose={() => setKunci(null)} title={kunci ? `${META_KATEGORI[kunci.value].label} dikunci` : ''}>
        <View style={{ gap: 14 }}>
          <KotakKunci teks={`${alasanKunci} HR akan membukanya setelah aturan resmi terbit. Pengajuan yang sudah dikirim tidak berubah.`} />
          <Button title="Mengerti" variant="tonal" onPress={() => setKunci(null)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  kisi: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  sel: { width: '50%', padding: 6 },
  ubin: { borderRadius: radius.card, borderWidth: 1, padding: 16, gap: 6, minHeight: 150 },
  ubinAtas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  ikonRedup: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kotakKunci: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
});
