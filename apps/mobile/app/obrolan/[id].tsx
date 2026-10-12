/**
 * Layar kanal obrolan — pesan urut lama→baru (halaman 30, "Muat sebelumnya"
 * memakai ?sebelum= dengan id pesan utama tertua), gelembung kiri/kanan
 * (pesan sendiri, dari id pengguna sesi — kontrak tidak membawa nama
 * penulis), kotak kirim dengan penanganan limiter 429, dan polling ringan
 * 15 detik HANYA saat layar aktif (dihentikan saat blur) + tarik-untuk-
 * menyegarkan. Kanal yang tak terlihat / fitur mati → 404 ramah.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { kirimPesan, pesanKanal, tandaiKanalDibaca } from '@/api/endpoints';
import type { ChatMessage } from '@/api/types';
import { Badge, Button, EmptyState, ErrorState, Input, Loading, Meta } from '@/components/ui';
import { jam, tanggalDariYMD, ymdJakarta } from '@/lib/format';
import { radius, useTheme } from '@/lib/theme';
import { useSession } from '@/session/SessionProvider';

const LABEL_JENIS: Record<string, string> = {
  workspace: 'Kanal workspace',
  public: 'Kanal publik',
  private: 'Kanal privat',
  dm: 'Pesan langsung',
  group: 'Grup',
};

/** Id of the top-level message a message belongs to. */
function akarDari(m: ChatMessage): string {
  return m.parent_id ?? m.id;
}

/**
 * Display order for a channel: the server sends a page as roots (old→new)
 * followed by all their thread replies, so a flat list would show replies
 * at the bottom. Dedupe by id (later entries win), sort roots by id (ULID =
 * time) and put each root's replies right under it. A reply whose root is
 * not loaded is placed by its own id.
 */
function urutkanTimeline(daftar: ChatMessage[]): ChatMessage[] {
  const perId = new Map<string, ChatMessage>();
  for (const m of daftar) {
    perId.set(m.id, m);
  }
  const balasan = new Map<string, ChatMessage[]>();
  const akar: ChatMessage[] = [];
  for (const m of perId.values()) {
    if (m.parent_id !== null && perId.has(m.parent_id)) {
      const grup = balasan.get(m.parent_id) ?? [];
      grup.push(m);
      balasan.set(m.parent_id, grup);
    } else {
      akar.push(m);
    }
  }
  const banding = (a: ChatMessage, b: ChatMessage): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  akar.sort(banding);
  const hasil: ChatMessage[] = [];
  for (const m of akar) {
    hasil.push(m);
    const grup = balasan.get(m.id);
    if (grup) {
      hasil.push(...grup.sort(banding));
    }
  }
  return hasil;
}

/**
 * Gabungkan halaman terbaru (tanpa `sebelum`) ke daftar yang sudah dimuat:
 * thread yang akarnya lebih tua dari akar tertua halaman baru dipertahankan
 * (termasuk balasannya), sisanya diganti halaman baru (pesan diedit/dihapus
 * ikut segar).
 */
function gabungTimeline(lama: ChatMessage[], halaman: ChatMessage[]): ChatMessage[] {
  if (halaman.length === 0) {
    return lama;
  }
  const akarHalaman = halaman.filter((m) => m.parent_id === null).map((m) => m.id).sort();
  const akarTerlama = akarHalaman[0] ?? halaman[0]?.id ?? '';
  const lebihTua = lama.filter((m) => akarDari(m) < akarTerlama);
  return urutkanTimeline([...lebihTua, ...halaman]);
}

/** Pixels from the bottom within which new messages still auto-scroll. */
const AMBANG_BAWAH = 160;

function GelembungPesan({ pesan, milikSaya }: { pesan: ChatMessage; milikSaya: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const terhapus = pesan.deleted_at !== null || pesan.body_text === '';
  const balasan = pesan.parent_id !== null;

  return (
    <View style={[pesanGaya.baris, milikSaya && { justifyContent: 'flex-end' }]}>
      <View
        style={[
          pesanGaya.gelembung,
          balasan && pesanGaya.balasan,
          milikSaya
            ? { backgroundColor: colors.primary, borderTopRightRadius: radius.sm - 4 }
            : { backgroundColor: colors.surface, borderTopLeftRadius: radius.sm - 4 },
        ]}
      >
        {!milikSaya && pesan.penulis?.nama ? (
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>
            {pesan.penulis.nama}
          </Text>
        ) : null}
        {terhapus ? (
          <Text style={[pesanGaya.teks, { color: milikSaya ? colors.primaryFg : colors.subtle, fontStyle: 'italic' }]}>
            Pesan dihapus
          </Text>
        ) : (
          <Text style={[pesanGaya.teks, { color: milikSaya ? colors.primaryFg : colors.text }]}>
            {pesan.body_text}
          </Text>
        )}
        <View style={pesanGaya.meta}>
          {balasan ? (
            <Ionicons name="return-down-forward-outline" size={11} color={milikSaya ? colors.primaryFg : colors.subtle} />
          ) : null}
          {pesan.reactions.length > 0 ? (
            <View style={pesanGaya.reaksi}>
              {pesan.reactions.map((reaksi) => (
                <View
                  key={reaksi.emoji}
                  style={[pesanGaya.chipReaksi, { backgroundColor: milikSaya ? colors.primaryHover : colors.surface2 }]}
                >
                  <Text style={{ fontSize: 11 }}>{reaksi.emoji}</Text>
                  <Text style={[pesanGaya.chipTeks, { color: milikSaya ? colors.primaryFg : colors.muted }]}>
                    {reaksi.user_ids.length}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={[pesanGaya.jam, { color: milikSaya ? colors.primaryFg : colors.subtle }]}>
            {jam(pesan.created_at)}
            {pesan.edited_at ? ' · disunting' : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function LayarKanal(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, nama, jenis, bolehKirim } = useLocalSearchParams<{
    id: string;
    nama?: string;
    jenis?: string;
    bolehKirim?: string;
  }>();
  const { user } = useSession();

  const [pesan, setPesan] = useState<ChatMessage[]>([]);
  const [adaLagi, setAdaLagi] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatKirim, setGalatKirim] = useState<string | null>(null);
  const [teks, setTeks] = useState('');
  const [mengirim, setMengirim] = useState(false);

  const gulirRef = useRef<ScrollView | null>(null);
  const lompatBawah = useRef(false);
  const jagaGulir = useRef(false);
  const posisiGulir = useRef(0);
  const tinggiIsi = useRef(0);
  const tinggiLayar = useRef(0);
  const hidup = useRef(true);

  /** Only follow new messages when the reader is already near the bottom. */
  const dekatBawah = (): boolean =>
    tinggiIsi.current - (posisiGulir.current + tinggiLayar.current) < AMBANG_BAWAH;

  const bolehPost = bolehKirim !== '0';

  /** Muat halaman terbaru (tanpa sebelum) — awal, polling, dan segarkan. */
  const muatTerbaru = useCallback(
    async (diam: boolean): Promise<void> => {
      if (typeof id !== 'string') {
        return;
      }
      if (!diam) {
        setMemuat(true);
      }
      setGalat(null);
      try {
        const hasil = await pesanKanal(id, null);
        if (!hidup.current) {
          return;
        }
        setAdaLagi(hasil.has_more);
        setPesan((lama) => {
          if (lama.length === 0) {
            lompatBawah.current = true;
            return urutkanTimeline(hasil.messages);
          }
          const adaBaru = hasil.messages.some((m) => !lama.some((n) => n.id === m.id));
          if (adaBaru && dekatBawah()) {
            lompatBawah.current = true;
          }
          return gabungTimeline(lama, hasil.messages);
        });
      } catch (err) {
        if (!hidup.current) {
          return;
        }
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat pesan.');
      } finally {
        if (hidup.current) {
          setMemuat(false);
          setMenyegarkan(false);
        }
      }
    },
    [id],
  );

  /** Muat pesan lebih tua: ?sebelum= id pesan utama tertua yang tampil. */
  const muatSebelumnya = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string' || memuatLagi) {
      return;
    }
    const akarTerlama = pesan.find((m) => m.parent_id === null) ?? pesan[0];
    if (!akarTerlama) {
      return;
    }
    setMemuatLagi(true);
    setGalat(null);
    try {
      const hasil = await pesanKanal(id, akarTerlama.id);
      if (!hidup.current) {
        return;
      }
      setAdaLagi(hasil.has_more);
      jagaGulir.current = true; // pertahankan posisi baca saat konten bertambah di atas.
      setPesan((lama) => urutkanTimeline([...hasil.messages, ...lama]));
    } catch (err) {
      if (hidup.current) {
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat pesan lebih lama.');
      }
    } finally {
      if (hidup.current) {
        setMemuatLagi(false);
      }
    }
  }, [id, memuatLagi, pesan]);

  /** Polling ringan hanya selama layar aktif (15 detik) + muat saat fokus. */
  useFocusEffect(
    useCallback(() => {
      hidup.current = true;
      void muatTerbaru(false);
      if (typeof id === 'string') {
        void tandaiKanalDibaca(id).catch(() => undefined);
      }
      const pewaktu = setInterval(() => {
        void muatTerbaru(true);
      }, 15_000);
      return () => {
        hidup.current = false;
        clearInterval(pewaktu);
      };
    }, [id, muatTerbaru]),
  );

  useEffect(() => {
    if (lompatBawah.current) {
      lompatBawah.current = false;
      gulirRef.current?.scrollToEnd({ animated: false });
    }
  }, [pesan.length]);

  async function kirim(): Promise<void> {
    if (mengirim || typeof id !== 'string') {
      return;
    }
    const isi = teks.trim();
    if (isi === '') {
      return;
    }
    setMengirim(true);
    setGalatKirim(null);
    try {
      const hasil = await kirimPesan(id, isi);
      lompatBawah.current = true;
      setPesan((lama) => urutkanTimeline([...lama, hasil.message]));
      setTeks('');
    } catch (err) {
      if (err instanceof ApiError) {
        setGalatKirim(
          err.status === 429
            ? 'Terlalu banyak pesan terkirim. Tunggu sebentar lalu coba lagi.'
            : (err.firstValidationError ?? err.message),
        );
      } else {
        setGalatKirim('Gagal mengirim pesan.');
      }
    } finally {
      setMengirim(false);
    }
  }

  const namaTampil = typeof nama === 'string' && nama !== '' ? nama : 'Kanal';
  const jenisTampil = typeof jenis === 'string' ? (LABEL_JENIS[jenis] ?? 'Kanal') : 'Kanal';
  const milikSaya = (pesanSatu: ChatMessage): boolean => pesanSatu.user_id === (user?.id ?? '');

  // Pengelompokan hari: kunci Y-M-D Jakarta, pemisah saat hari berganti.
  // Hanya pesan utama yang memicu pemisah (balasan tetap di bawah akarnya
  // walau beda hari); kunci memakai id pesan agar selalu unik.
  const baris: { jenis: 'hari' | 'pesan'; kunci: string; hari?: string; pesan?: ChatMessage }[] = [];
  let hariSebelumnya = '';
  for (const satu of pesan) {
    const hari = satu.parent_id === null ? ymdJakarta(satu.created_at) : '';
    if (hari !== '' && hari !== hariSebelumnya) {
      baris.push({ jenis: 'hari', kunci: `hari-${satu.id}`, hari });
      hariSebelumnya = hari;
    }
    baris.push({ jenis: 'pesan', kunci: satu.id, pesan: satu });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[kanal.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[kanal.judulAtas, { color: colors.text }]} numberOfLines={1}>
            {namaTampil}
          </Text>
          <Meta>{jenisTampil}</Meta>
        </View>
      </Pressable>

      {memuat && pesan.length === 0 ? (
        <Loading label="Memuat pesan…" />
      ) : galat && pesan.length === 0 ? (
        <ErrorState
          message={galat}
          onRetry={() => {
            void muatTerbaru(false);
          }}
        />
      ) : (
        <ScrollView
          ref={gulirRef}
          contentContainerStyle={kanal.isi}
          scrollEventThrottle={64}
          onLayout={(e) => {
            tinggiLayar.current = e.nativeEvent.layout.height;
          }}
          onScroll={(e) => {
            posisiGulir.current = e.nativeEvent.contentOffset.y;
          }}
          onContentSizeChange={(_, tinggi) => {
            if (jagaGulir.current && tinggiIsi.current > 0) {
              gulirRef.current?.scrollTo({
                y: posisiGulir.current + (tinggi - tinggiIsi.current),
                animated: false,
              });
              jagaGulir.current = false;
            }
            tinggiIsi.current = tinggi;
          }}
          refreshControl={
            <RefreshControl
              refreshing={menyegarkan}
              onRefresh={() => {
                setMenyegarkan(true);
                void muatTerbaru(true);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {galat ? <Meta>{galat}</Meta> : null}

          {adaLagi && pesan.length > 0 ? (
            <Button
              title={memuatLagi ? 'Memuat…' : 'Muat sebelumnya'}
              variant="ghost"
              icon="chevron-up"
              disabled={memuatLagi}
              loading={memuatLagi}
              onPress={() => {
                void muatSebelumnya();
              }}
              style={{ alignSelf: 'center' }}
            />
          ) : null}

          {pesan.length === 0 && galat === null ? (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="Belum ada pesan"
              description="Mulai percakapan dengan mengirim pesan pertama."
            />
          ) : (
            <View style={{ gap: 6 }}>
              {baris.map((barisSatu) =>
                barisSatu.jenis === 'hari' ? (
                  <View key={barisSatu.kunci} style={kanal.pembatasHari}>
                    <Badge tone="neutral">{tanggalDariYMD(barisSatu.hari)}</Badge>
                  </View>
                ) : (
                  <GelembungPesan key={barisSatu.kunci} pesan={barisSatu.pesan as ChatMessage} milikSaya={milikSaya(barisSatu.pesan as ChatMessage)} />
                ),
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Kotak kirim */}
      <View
        style={[
          kanal.kirimBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        {galatKirim ? (
          <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityRole="alert">
            {galatKirim}
          </Text>
        ) : null}
        {bolehPost ? (
          <View style={kanal.kirimBaris}>
            <View style={{ flex: 1 }}>
              <Input
                value={teks}
                onChangeText={setTeks}
                placeholder="Tulis pesan…"
                multiline
                maxLength={20000}
                accessibilityLabel="Pesan baru"
                style={kanal.input}
              />
            </View>
            <Pressable
              onPress={() => {
                void kirim();
              }}
              disabled={mengirim || teks.trim() === ''}
              accessibilityRole="button"
              accessibilityLabel="Kirim pesan"
              accessibilityState={{ disabled: mengirim || teks.trim() === '' }}
              style={({ pressed }) => [
                kanal.tombolKirim,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                (mengirim || teks.trim() === '') && { opacity: 0.45 },
              ]}
            >
              {mengirim ? (
                <Ionicons name="hourglass-outline" size={20} color={colors.primaryFg} />
              ) : (
                <Ionicons name="send" size={20} color={colors.primaryFg} />
              )}
            </Pressable>
          </View>
        ) : (
          <Meta>Anda tidak dapat mengirim pesan di kanal ini (hanya anggota).</Meta>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const pesanGaya = StyleSheet.create({
  baris: { flexDirection: 'row', paddingHorizontal: 4 },
  gelembung: {
    maxWidth: '82%',
    borderRadius: radius.sm + 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  balasan: { borderLeftWidth: 2, paddingLeft: 10 },
  teks: { fontSize: 15, lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  reaksi: { flexDirection: 'row', gap: 4 },
  chipReaksi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipTeks: { fontSize: 11, fontWeight: '700' },
  jam: { fontSize: 11 },
});

const kanal = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  isi: { padding: 16, paddingBottom: 24, gap: 6 },
  pembatasHari: { alignItems: 'center', paddingVertical: 6 },
  kirimBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  kirimBaris: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: { minHeight: 48, maxHeight: 120, paddingVertical: 12 },
  tombolKirim: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
