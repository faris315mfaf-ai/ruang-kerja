/**
 * Editor catatan — mode teks polos tanpa kolaborasi realtime (paritas
 * fallback web): isi diedit sebagai teks multi-baris (`body_text` dari
 * server), autosave debounce 1,5 detik mengirim konversi baris→`<p>`
 * (diescape) + `updated_at` dasar lewat PATCH /catatan/{note}. Konflik
 * versi (409) menawarkan "Muat ulang" dari server. Tombol kembali
 * menyiram simpanan tertunda dulu (flush), termasuk tombol fisik Android.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { detailCatatan, simpanCatatan } from '@/api/endpoints';
import type { NoteDetailData } from '@/api/types';
import { Badge, Body, Button, Card, ErrorState, Field, Input, Label, Loading, Meta, Screen } from '@/components/ui';
import { jam } from '@/lib/format';
import { useTheme } from '@/lib/theme';

type StatusSimpan = 'idle' | 'menyimpan' | 'tersimpan' | 'gagal' | 'konflik';

/** Escape teks polos agar aman di dalam HTML. */
function escapeHtml(teks: string): string {
  return teks.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Baris teks polos → paragraf HTML sederhana (node whitelist Tiptap). */
function teksKeHtml(teks: string): string {
  if (teks.trim() === '') {
    return '';
  }
  return teks
    .split('\n')
    .map((baris) => `<p>${escapeHtml(baris)}</p>`)
    .join('');
}

export default function LayarCatatan(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [catatan, setCatatan] = useState<NoteDetailData | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);

  const [judul, setJudul] = useState('');
  const [teks, setTeks] = useState('');
  const [status, setStatus] = useState<StatusSimpan>('idle');
  const [tersimpanPada, setTersimpanPada] = useState<Date | null>(null);
  const [galatJudul, setGalatJudul] = useState<string | null>(null);

  const siap = catatan !== null;
  const boleh = catatan?.can_edit === true;

  // Ref: isi/dasar versi terakhir yang diketahui tersimpan di server.
  const teksRef = useRef('');
  const teksTersimpanRef = useRef('');
  const dasarRef = useRef<string | null>(null);
  const kotorRef = useRef(false);
  const konflikRef = useRef(false);
  const sedangRef = useRef<Promise<boolean> | null>(null);
  const inginRef = useRef(false);
  const judulTersimpanRef = useRef('');
  const bolehRef = useRef(false);
  const muatRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    // Ref izin sunting untuk antrean simpan (di luar render).
    bolehRef.current = boleh;
  }, [boleh]);

  const muat = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string') {
      setGalatMuat('Catatan tidak ditemukan.');
      setMemuat(false);
      return;
    }
    setMemuat(true);
    setGalatMuat(null);
    try {
      const hasil = await detailCatatan(id);
      setCatatan(hasil);
      setJudul(hasil.title);
      setTeks(hasil.body_text ?? '');
      teksRef.current = hasil.body_text ?? '';
      teksTersimpanRef.current = hasil.body_text ?? '';
      judulTersimpanRef.current = hasil.title;
      dasarRef.current = hasil.updated_at;
      kotorRef.current = false;
      konflikRef.current = false;
      setStatus('idle');
      setGalatJudul(null);
    } catch (err) {
      setGalatMuat(err instanceof ApiError ? err.message : 'Tidak dapat memuat catatan.');
    } finally {
      setMemuat(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  useEffect(() => {
    muatRef.current = () => {
      void muat();
    };
  }, [muat]);

  function tanyaMuatUlang(): void {
    Alert.alert(
      'Catatan berubah',
      'Versi di server lebih baru daripada versi di aplikasi. Muat ulang untuk melihat perubahan terbaru — suntingan Anda yang belum tersimpan akan diganti.',
      [
        { text: 'Nanti', style: 'cancel' },
        { text: 'Muat ulang', style: 'default', onPress: () => muatRef.current() },
      ],
    );
  }

  /** Satu antrean simpan isi — mencegah PATCH tumpang tindih. */
  const simpanIsi = useCallback((): Promise<boolean> => {
    if (typeof id !== 'string' || !bolehRef.current) {
      return Promise.resolve(true);
    }
    if (sedangRef.current) {
      inginRef.current = true;
      return sedangRef.current;
    }
    const janji = (async (): Promise<boolean> => {
      try {
        let ulang = true;
        while (ulang) {
          inginRef.current = false;
          setStatus('menyimpan');
          try {
            const hasil = await simpanCatatan(id, {
              body_html: teksKeHtml(teksRef.current),
              updated_at: dasarRef.current ?? '',
            });
            dasarRef.current = hasil.updated_at;
            teksTersimpanRef.current = teksRef.current;
            judulTersimpanRef.current = hasil.title;
            setCatatan((lama) => (lama === null ? hasil : { ...lama, ...hasil, body_text: teksRef.current }));
            kotorRef.current = inginRef.current;
            ulang = inginRef.current;
          } catch (err) {
            kotorRef.current = true;
            if (err instanceof ApiError && err.status === 409) {
              konflikRef.current = true;
              setStatus('konflik');
              tanyaMuatUlang();
              return false;
            }
            setStatus('gagal');
            return false;
          }
        }
        konflikRef.current = false;
        setStatus('tersimpan');
        setTersimpanPada(new Date());
        return true;
      } finally {
        sedangRef.current = null;
      }
    })();
    sedangRef.current = janji;
    return janji;
  }, [id]);

  /** Autosave debounce 1,5 detik setelah isi berubah. */
  useEffect(() => {
    if (!siap || !boleh || konflikRef.current) {
      return undefined;
    }
    if (teks === teksTersimpanRef.current) {
      return undefined;
    }
    kotorRef.current = true;
    const timer = setTimeout(() => {
      void simpanIsi();
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [teks, siap, boleh, simpanIsi]);

  /** Simpan judul (PATCH {title} — maksud terpisah dari isi). */
  const simpanJudul = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string' || catatan === null || !boleh) {
      return;
    }
    const baru = judul.trim();
    if (baru === judulTersimpanRef.current || baru === '') {
      setJudul(judulTersimpanRef.current);
      return;
    }
    try {
      const hasil = await simpanCatatan(id, { title: baru });
      judulTersimpanRef.current = hasil.title;
      dasarRef.current = hasil.updated_at;
      setCatatan((lama) => (lama === null ? hasil : { ...lama, ...hasil }));
      setGalatJudul(null);
    } catch (err) {
      setGalatJudul(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal menyimpan judul.');
    }
  }, [id, catatan, judul, boleh]);

  const kembali = useCallback((): void => {
    void (async () => {
      // Flush: judul lalu isi — keduanya tersimpan sebelum layar ditutup.
      await simpanJudul();
      if (kotorRef.current && bolehRef.current && !konflikRef.current) {
        await simpanIsi();
      }
      router.back();
    })();
  }, [simpanJudul, simpanIsi]);

  /** Tombol kembali fisik Android ikut menyiram simpanan. */
  useEffect(() => {
    const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
      kembali();
      return true;
    });
    return () => {
      langganan.remove();
    };
  }, [kembali]);

  function ubahTeks(nilai: string): void {
    teksRef.current = nilai;
    setTeks(nilai);
  }

  const labelStatus: Record<StatusSimpan, string | null> = {
    idle: null,
    menyimpan: 'Menyimpan…',
    tersimpan: tersimpanPada ? `Tersimpan ${jam(tersimpanPada)}` : 'Tersimpan',
    gagal: 'Gagal menyimpan — coba ubah sedikit lalu biarkan tersimpan lagi',
    konflik: 'Konflik — versi server lebih baru',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={kembali}
        accessibilityRole="button"
        accessibilityLabel="Kembali dan simpan"
        style={[gaya.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[gaya.judulAtas, { color: colors.text }]}>Catatan</Text>
        {labelStatus[status] !== null ? (
          <View style={gaya.statusWrap}>
            {status === 'menyimpan' ? (
              <Ionicons name="cloud-upload-outline" size={14} color={colors.subtle} />
            ) : status === 'tersimpan' ? (
              <Ionicons name="checkmark" size={14} color={colors.success} />
            ) : status === 'konflik' ? (
              <Ionicons name="warning-outline" size={14} color={colors.warning} />
            ) : (
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
            )}
            <Text
              style={[
                gaya.status,
                {
                  color:
                    status === 'tersimpan'
                      ? colors.success
                      : status === 'konflik'
                        ? colors.warning
                        : status === 'gagal'
                          ? colors.danger
                          : colors.subtle,
                },
              ]}
              numberOfLines={1}
            >
              {labelStatus[status]}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {memuat ? (
        <Loading label="Memuat catatan…" />
      ) : galatMuat && !catatan ? (
        <ErrorState message={galatMuat} onRetry={() => void muat()} />
      ) : catatan ? (
        <Screen contentStyle={{ paddingBottom: 48 }}>
          <Card style={gaya.kepalaKartu}>
            <Field label="Judul" error={galatJudul}>
              <Input
                value={judul}
                onChangeText={setJudul}
                onEndEditing={() => void simpanJudul()}
                maxLength={200}
                accessibilityLabel="Judul catatan"
                editable={boleh}
              />
            </Field>
            <View style={gaya.metaBaris}>
              {boleh ? null : <Badge tone="neutral">Hanya baca</Badge>}
              <Meta style={{ flex: 1 }}>
                {catatan.workspace_key ? `${catatan.workspace_key} · ` : ''}
                diperbarui {jam(catatan.updated_at)}
                {catatan.penyunting ? ` · ${catatan.penyunting}` : ''}
              </Meta>
            </View>
          </Card>

          {boleh ? (
            <Card style={gaya.editorKartu}>
              <Label>Isi catatan</Label>
              <Input
                value={teks}
                onChangeText={ubahTeks}
                placeholder="Tulis catatan di sini…"
                multiline
                textAlignVertical="top"
                accessibilityLabel="Isi catatan"
                style={gaya.editor}
              />
              <Meta>
                Teks polos, tersimpan otomatis. Format kaya (judul, daftar) dari web
                tampil sebagai teks biasa dan akan tersimpan sebagai paragraf.
              </Meta>
            </Card>
          ) : (
            <Card>
              <Label>Isi catatan</Label>
              <Body muted>{teks === '' ? 'Catatan masih kosong.' : teks}</Body>
            </Card>
          )}

          {status === 'konflik' ? (
            <Card style={{ gap: 10 }}>
              <Body>Catatan ini diubah orang lain setelah terakhir dimuat.</Body>
              <Button title="Muat ulang" variant="secondary" icon="refresh" onPress={() => muatRef.current()} />
            </Card>
          ) : null}
        </Screen>
      ) : null}
    </View>
  );
}

const gaya = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  status: { fontSize: 12, fontWeight: '600' },
  kepalaKartu: { gap: 4 },
  metaBaris: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  editorKartu: { gap: 8 },
  editor: { minHeight: 260, paddingVertical: 12, lineHeight: 22 },
});
