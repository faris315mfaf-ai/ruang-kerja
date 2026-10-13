/**
 * Cari di percakapan (mockup 16): kata dicocokkan sebagai awalan di server
 * (min. 2 huruf), terbaru dulu, 20 per halaman, kata disorot. Mengetuk hasil
 * membuka thread-nya (konteks + balasan). Pencarian lintas kanal belum ada.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { cariPesan, type Pesan } from '@/api/obrolan';
import { Gelembung } from '@/features/obrolan/Gelembung';
import { akarDari, labelHariLinimasa, pesanGalat } from '@/features/obrolan/util';
import { ymdJakarta } from '@/lib/format';
import { useSession } from '@/session/SessionProvider';
import { layout, useTheme } from '@/theme';
import { Button, EmptyState, ErrorState, errorKindFromStatus, Glass, IconButton, Loading, PageGlow, SearchInput, Text } from '@/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Hasil {
  q: string;
  pesan: Pesan[];
  adaLagi: boolean;
  kursor: string | null;
  galat: { status: number; pesan: string } | null;
}

export default function LayarCariPercakapan(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const saya = user?.id ?? null;
  const { id, nama } = useLocalSearchParams<{ id: string; nama?: string }>();
  const kanalId = typeof id === 'string' ? id : '';
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [memuatLagi, setMemuatLagi] = useState(false);

  const qBersih = q.trim();
  const bisaCari = qBersih.length >= 2;

  useEffect(() => {
    if (!bisaCari) {
      return undefined;
    }
    let batal = false;
    const pewaktu = setTimeout(() => {
      cariPesan(kanalId, qBersih, null)
        .then((r) => {
          if (!batal) {
            setHasil({ q: qBersih, pesan: r.messages, adaLagi: r.has_more, kursor: r.next_cursor, galat: null });
          }
        })
        .catch((err: unknown) => {
          if (!batal) {
            setHasil({ q: qBersih, pesan: [], adaLagi: false, kursor: null, galat: { status: err instanceof ApiError ? err.status : -1, pesan: pesanGalat(err, 'Pencarian gagal.') } });
          }
        });
    }, 400);
    return () => {
      batal = true;
      clearTimeout(pewaktu);
    };
  }, [kanalId, qBersih, bisaCari, percobaan]);

  const memuat = bisaCari && (hasil === null || hasil.q !== qBersih);
  const data = bisaCari && hasil?.q === qBersih ? hasil : null;

  const lagi = async (): Promise<void> => {
    if (data === null || !data.adaLagi || data.kursor === null || memuatLagi) {
      return;
    }
    setMemuatLagi(true);
    try {
      const r = await cariPesan(kanalId, qBersih, data.kursor);
      setHasil({ ...data, pesan: [...data.pesan, ...r.messages], adaLagi: r.has_more, kursor: r.next_cursor });
    } catch (err) {
      setHasil({ ...data, galat: { status: err instanceof ApiError ? err.status : -1, pesan: pesanGalat(err, 'Pencarian gagal.') } });
    } finally {
      setMemuatLagi(false);
    }
  };

  const baris = useMemo(() => {
    const keluar: ({ jenis: 'hari'; kunci: string; hari: string } | { jenis: 'pesan'; kunci: string; pesan: Pesan })[] = [];
    let hariLalu = '';
    for (const p of data?.pesan ?? []) {
      const hari = ymdJakarta(p.created_at);
      if (hari !== hariLalu) {
        keluar.push({ jenis: 'hari', kunci: `hari-${p.id}`, hari });
        hariLalu = hari;
      }
      keluar.push({ jenis: 'pesan', kunci: p.id, pesan: p });
    }
    return keluar;
  }, [data]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <Stack.Screen options={{ animation: 'slide_from_right' }} />
      <PageGlow />
      <Glass style={{ paddingTop: insets.top, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        <View style={[s.bar, { minHeight: layout.appBar + 8 }]}>
          <IconButton icon="arrow-left" label="Kembali" variant="ghost" onPress={() => router.back()} />
          <SearchInput value={q} onChangeText={setQ} placeholder={`Cari di ${typeof nama === 'string' && nama !== '' ? nama : 'percakapan'}`} autoFocus style={{ flex: 1 }} />
        </View>
      </Glass>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.isi}>
        {!bisaCari ? (
          <EmptyState icon="search" title="Cari pesan" description="Ketik minimal 2 huruf untuk mencari pesan di percakapan ini." variant="plain" />
        ) : memuat ? (
          <Loading rows={3} />
        ) : data?.galat ? (
          <ErrorState message={data.galat.pesan} kind={errorKindFromStatus(data.galat.status === -1 ? undefined : data.galat.status)} onRetry={() => setPercobaan((n) => n + 1)} />
        ) : baris.length === 0 ? (
          <EmptyState icon="search" title="Tidak ada hasil" description={`Tidak ada pesan yang cocok dengan “${qBersih}”.`} variant="plain" />
        ) : (
          <>
            <Text variant="meta" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 4 }}>
              {data?.pesan.length}
              {data?.adaLagi ? '+' : ''} hasil · ketuk untuk membuka thread
            </Text>
            {baris.map((b) =>
              b.jenis === 'hari' ? (
                <View key={b.kunci} style={s.pemisahHari}>
                  <View style={[s.pilHari, { backgroundColor: colors.surface2 }]}>
                    <Text variant="meta" weight={700} tone="muted">
                      {labelHariLinimasa(b.hari)}
                    </Text>
                  </View>
                </View>
              ) : (
                <Gelembung
                  key={b.kunci}
                  pesan={b.pesan}
                  saya={saya}
                  tampilIdentitas
                  awalKelompok
                  akhirKelompok
                  sorot={qBersih}
                  onTekan={() => router.push({ pathname: '/obrolan/[id]/thread/[messageId]', params: { id: kanalId, messageId: akarDari(b.pesan), nama: typeof nama === 'string' ? nama : '' } })}
                />
              ),
            )}
            {data?.adaLagi ? <Button title="Cari di pesan lebih lama" variant="outline" loading={memuatLagi} onPress={() => void lagi()} /> : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingRight: 12 },
  isi: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32, gap: 4 },
  pemisahHari: { alignItems: 'center', paddingVertical: 10 },
  pilHari: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
});
