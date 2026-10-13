/**
 * Cari — layar penuh dengan kolom cari di BAWAH (zona jempol, di atas papan
 * ketik): riwayat lokal + aksi cepat, hasil bergrup dengan kata kunci
 * disorot, chip saring tipe. Mockup: 13-cari-awal, 14-cari-hasil,
 * 15-cari-keadaan.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { cari, MIN_HURUF_CARI, type BalasanCari, type GrupCari, type HasilCari, type TipeCari } from '@/api/cari';
import { Sorot } from '@/features/cari/Sorot';
import { bacaRiwayat, hapusRiwayat, tambahRiwayat } from '@/features/cari/riwayat';
import { bukaTujuan, resolveTarget } from '@/features/inbox/target';
import { bukaSegera } from '@/features/settings/ComingSoon';
import { fontFamily, layout, useTheme } from '@/theme';
import {
  Banner,
  Card,
  Chip,
  ChipScroller,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  IconTile,
  Input,
  ListRow,
  PageGlow,
  Pressable,
  SkeletonRow,
  SubAppBar,
  Text,
  type AnyIconName,
  type IconTileTone,
} from '@/ui';

const TIPE: { nilai: TipeCari; label: string; grup: string }[] = [
  { nilai: 'tugas', label: 'Tugas', grup: 'tasks' },
  { nilai: 'orang', label: 'Orang', grup: 'people' },
  { nilai: 'workspace', label: 'Workspace', grup: 'workspaces' },
  { nilai: 'dokumen', label: 'Dokumen', grup: 'documents' },
  { nilai: 'catatan', label: 'Catatan', grup: 'notes' },
  { nilai: 'pengajuan', label: 'Pengajuan', grup: 'requests' },
  { nilai: 'rapat', label: 'Rapat', grup: 'meetings' },
];

const IKON_GRUP: Record<string, { icon: AnyIconName; tone: IconTileTone }> = {
  tasks: { icon: 'circle-dot', tone: 'warn' },
  people: { icon: 'user', tone: 'blue' },
  workspaces: { icon: 'folder-kanban', tone: 'teal' },
  documents: { icon: 'file-text', tone: 'blue' },
  notes: { icon: 'notebook-text', tone: 'blue' },
  requests: { icon: 'receipt-text', tone: 'warn' },
  meetings: { icon: 'calendar-clock', tone: 'warn' },
};

type Status = 'diam' | 'memuat' | 'ok' | 'galat';

export default function LayarCari(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [q, setQ] = useState('');
  const [tipe, setTipe] = useState<TipeCari | null>(null);
  const [status, setStatus] = useState<Status>('diam');
  const [balasan, setBalasan] = useState<BalasanCari | null>(null);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [riwayat, setRiwayat] = useState<string[]>([]);
  const [hitung, setHitung] = useState<Record<string, number>>({});
  const permintaan = useRef(0);

  const bersih = q.trim();
  const cukup = [...bersih].length >= MIN_HURUF_CARI;

  useEffect(() => {
    void bacaRiwayat().then(setRiwayat);
  }, []);

  const jalankan = useCallback(async (kata: string, jenis: TipeCari | null): Promise<void> => {
    const id = ++permintaan.current;
    setStatus('memuat');
    setGalat(null);
    try {
      const hasil = await cari(kata, jenis);
      if (id !== permintaan.current) {
        return;
      }
      setBalasan(hasil);
      if (jenis === null) {
        setHitung(Object.fromEntries(hasil.groups.map((g) => [g.key, g.items.length])));
      }
      setStatus('ok');
    } catch (err) {
      if (id !== permintaan.current) {
        return;
      }
      setGalat({ pesan: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Pencarian gagal.', status: err instanceof ApiError ? err.status : 0 });
      setStatus('galat');
    }
  }, []);

  // Debounce 200 ms; terlalu pendek → kembali ke tampilan awal.
  useEffect(() => {
    if (!cukup) {
      permintaan.current++;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset hasil saat kata kunci terlalu pendek
      setStatus('diam');
      setBalasan(null);
      setHitung({});
      return undefined;
    }
    const timer = setTimeout(() => void jalankan(bersih, tipe), 200);
    return () => clearTimeout(timer);
  }, [bersih, cukup, tipe, jalankan]);

  const simpan = (kata: string): void => {
    void tambahRiwayat(kata, riwayat).then(setRiwayat);
  };

  const pilihHasil = (grup: GrupCari, item: HasilCari): void => {
    simpan(bersih);
    const tujuan = resolveTarget(item.target, { urlLuar: item.external ? item.url : null });
    if (tujuan.aksi === 'detail' || tujuan.aksi === 'tidak-tersedia') {
      bukaSegera({ judul: item.title, ikon: IKON_GRUP[grup.key]?.icon ?? 'search' });
      return;
    }
    bukaTujuan(tujuan);
  };

  const aksiCepat = (
    <View style={{ gap: 8 }}>
      <Text variant="overline" tone="muted">
        Aksi cepat
      </Text>
      <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow icon="log-in" iconTone="teal" title="Check-in" subtitle="Buka halaman absensi" onPress={() => router.push('/absen' as never)} />
        <ListRow divider icon="plus" iconTone="teal" title="Buat tugas baru" subtitle="Buka formulir tugas baru" onPress={() => router.push('/tugas/baru' as never)} />
        <ListRow
          divider
          icon="clipboard-pen"
          iconTone="warn"
          title="Tulis laporan hari ini"
          subtitle="Laporan progres harian"
          onPress={() => bukaSegera({ judul: 'Laporan hari ini', ikon: 'clipboard-pen' })}
        />
      </Card>
    </View>
  );

  const offline = status === 'galat' && galat?.status === 0;

  let isi: React.JSX.Element;
  if (!cukup || offline) {
    isi = (
      <>
        {offline ? <Banner tone="warn" icon="wifi-off" message="Anda sedang offline. Pencarian butuh koneksi; riwayat dan aksi cepat tetap tersedia." /> : null}
        {bersih.length === 1 ? (
          <Text variant="meta" style={{ fontSize: 14 }} accessibilityLiveRegion="polite">
            Ketik minimal {MIN_HURUF_CARI} huruf untuk mencari.
          </Text>
        ) : null}
        {riwayat.length > 0 ? (
          <View style={{ gap: 8 }}>
            <View style={s.judulBaris}>
              <Text variant="overline" tone="muted">
                Pencarian terakhir
              </Text>
              <Text
                variant="label"
                tone="link"
                onPress={() => {
                  void hapusRiwayat();
                  setRiwayat([]);
                }}
                accessibilityRole="button"
                style={{ paddingVertical: 8 }}
              >
                Hapus
              </Text>
            </View>
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              {riwayat.map((kata, i) => (
                <View key={kata} style={[s.riwayat, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
                  <Pressable
                    scaleTo={1}
                    onPress={() => {
                      setQ(kata);
                      setTipe(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Cari lagi: ${kata}`}
                    style={s.riwayatIsi}
                  >
                    <Icon name="history" size={22} color={colors.muted} />
                    <Text variant="body" numberOfLines={1} style={{ flex: 1, fontFamily: /^[A-Z]{2,}-\d+/.test(kata) ? fontFamily.mono600 : undefined }}>
                      {kata}
                    </Text>
                  </Pressable>
                  <IconButton
                    icon="arrow-up-left"
                    label={`Isi kolom cari dengan ${kata}`}
                    variant="ghost"
                    size={44}
                    onPress={() => {
                      setQ(kata);
                      input.current?.focus();
                    }}
                  />
                </View>
              ))}
            </Card>
          </View>
        ) : null}
        {aksiCepat}
      </>
    );
  } else if (status === 'memuat' && !balasan) {
    isi = (
      <View style={{ gap: 8 }} accessibilityLabel="Mencari…" accessibilityLiveRegion="polite">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  } else if (status === 'galat') {
    isi = <ErrorState title="Pencarian gagal" message={galat?.pesan ?? 'Pencarian gagal.'} onRetry={() => void jalankan(bersih, tipe)} />;
  } else if (balasan && balasan.groups.length === 0) {
    isi = (
      <>
        <EmptyState icon="search" title={`Tidak ada hasil untuk “${bersih}”`} description="Periksa ejaan atau coba kata kunci lain. Hanya data yang boleh Anda lihat yang dicari." />
        {aksiCepat}
      </>
    );
  } else if (balasan) {
    isi = (
      <>
        {status === 'memuat' ? (
          <Text variant="meta" accessibilityLiveRegion="polite">
            Memperbarui hasil…
          </Text>
        ) : null}
        {tipe === null ? (
          <View style={{ gap: 8 }}>
            <Text variant="overline" tone="muted">
              Aksi cepat
            </Text>
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow icon="plus" iconTone="teal" title="Buat tugas baru" subtitle="Buka formulir tugas baru" onPress={() => router.push('/tugas/baru' as never)} />
            </Card>
          </View>
        ) : null}
        {balasan.groups.map((g) => {
          const gaya = IKON_GRUP[g.key] ?? { icon: 'search' as AnyIconName, tone: 'neutral' as IconTileTone };
          const tombolSemua = TIPE.find((t) => t.grup === g.key);
          return (
            <View key={g.key} style={{ gap: 8 }}>
              <Text variant="overline" tone="muted" accessibilityRole="header">
                {g.label}
              </Text>
              <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
                {g.items.map((item, i) => (
                  <Pressable
                    key={item.id}
                    scaleTo={1}
                    onPress={() => pilihHasil(g, item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${g.label}: ${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`}
                    style={[s.hasil, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
                  >
                    <IconTile icon={gaya.icon} tone={gaya.tone} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Sorot variant="title" teks={item.title} terms={balasan.terms} numberOfLines={2} />
                      {item.snippet ? <Sorot variant="meta" teks={item.snippet} terms={balasan.terms} numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }} /> : null}
                      {item.code || item.subtitle || item.meta ? (
                        <Text variant="meta" numberOfLines={1} style={{ fontSize: 14, lineHeight: 20 }}>
                          {item.code ? (
                            <Text variant="meta" style={{ fontFamily: fontFamily.mono600, fontSize: 14, color: colors.muted }}>
                              {item.code}
                            </Text>
                          ) : null}
                          {item.code && (item.subtitle || item.meta) ? ' · ' : ''}
                          {[item.subtitle, item.meta].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name={item.external ? 'arrow-up-right' : 'chevron-right'} size={20} color={colors.subtle} />
                  </Pressable>
                ))}
                {g.has_more && tombolSemua ? (
                  <Pressable scaleTo={1} onPress={() => setTipe(tombolSemua.nilai)} accessibilityRole="button" style={[s.lihatSemua, { borderTopColor: colors.divider }]}>
                    <Text variant="label" tone="link">
                      Lihat semua {g.label.toLowerCase()}
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
            </View>
          );
        })}
        <Text variant="meta" align="center" style={{ fontSize: 13 }}>
          Hasil disaring sesuai hak akses Anda.
        </Text>
      </>
    );
  } else {
    isi = <View />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <PageGlow />
      <SubAppBar title="Cari" />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 20, gap: 16 }}
      >
        {isi}
      </ScrollView>
      <View style={[s.dok, { backgroundColor: colors.glassStrong, borderTopColor: colors.glassBorder, paddingBottom: insets.bottom + 10 }]}>
        {cukup ? (
          <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
            <Chip label="Semua" selected={tipe === null} onPress={() => setTipe(null)} />
            {TIPE.map((t) => (
              <Chip key={t.nilai} label={t.label} selected={tipe === t.nilai} count={tipe === null ? hitung[t.grup] : undefined} onPress={() => setTipe(tipe === t.nilai ? null : t.nilai)} />
            ))}
          </ChipScroller>
        ) : null}
        <Input
          ref={input}
          value={q}
          onChangeText={setQ}
          placeholder="Cari tugas, orang, dokumen…"
          leftIcon="search"
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (cukup) {
              simpan(bersih);
              void jalankan(bersih, tipe);
            }
          }}
          accessibilityLabel="Kolom pencarian"
          right={q !== '' ? <IconButton icon="x" label="Hapus kata kunci" variant="ghost" size={40} onPress={() => setQ('')} /> : undefined}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  judulBaris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riwayat: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  riwayatIsi: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  hasil: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  lihatSemua: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth },
  dok: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: layout.gutter, gap: 10 },
});
