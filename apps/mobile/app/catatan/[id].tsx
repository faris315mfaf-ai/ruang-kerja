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

  const [kaya, setKaya] = useState(false);

  const siap = catatan !== null;
  const boleh = catatan?.can_edit === true;
  // Catatan berformat lengkap: isi hanya-baca di ponsel (judul tetap boleh diubah).
  const bolehIsi = boleh && !kaya;

  // Ref: isi/dasar versi terakhir yang diketahui tersimpan di server.
  const teksRef = useRef('');
  const teksTersimpanRef = useRef('');
  const dasarRef = useRef<string | null>(null);
  const konflikRef = useRef(false);
  const sedangRef = useRef<Promise<boolean> | null>(null);
  const judulInginRef = useRef<string | null>(null);
  const keluarRef = useRef(false);
  const kayaRef = useRef(false);
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
      judulInginRef.current = null;
      konflikRef.current = false;
      kayaRef.current = hasil.mobile_editable === false;
      setKaya(kayaRef.current);
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

  /**
   * Satu antrean simpan untuk judul DAN isi — mencegah PATCH tumpang tindih.
   * RenameNote ikut menaikkan `updated_at`, jadi judul harus lewat antrean
   * yang sama dan dasar versi diperbarui dari setiap respons; kalau tidak,
   * PATCH isi berikutnya memakai dasar lama dan mendapat 409 palsu.
   * Isi dikirim sebagai snapshot: teks yang diketik selama permintaan
   * berjalan tetap dianggap belum tersimpan dan dikirim pada putaran berikutnya.
   */
  const simpan = useCallback((): Promise<boolean> => {
    if (typeof id !== 'string' || !bolehRef.current) {
      return Promise.resolve(true);
    }
    if (sedangRef.current) {
      return sedangRef.current;
    }
    const janji = (async (): Promise<boolean> => {
      let berhasil = true;
      try {
        for (;;) {
          const judulIngin = judulInginRef.current;
          if (judulIngin !== null) {
            judulInginRef.current = null;
            setStatus('menyimpan');
            try {
              const hasil = await simpanCatatan(id, { title: judulIngin });
              judulTersimpanRef.current = hasil.title;
              dasarRef.current = hasil.updated_at;
              setCatatan((lama) => (lama === null ? hasil : { ...lama, ...hasil, body_text: lama.body_text }));
              setGalatJudul(null);
            } catch (err) {
              berhasil = false;
              setGalatJudul(
                err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal menyimpan judul.',
              );
            }
            continue;
          }

          if (konflikRef.current || kayaRef.current || teksRef.current === teksTersimpanRef.current) {
            break;
          }

          const snapshot = teksRef.current;
          setStatus('menyimpan');
          try {
            const hasil = await simpanCatatan(id, {
              body_html: teksKeHtml(snapshot),
              updated_at: dasarRef.current ?? '',
            });
            dasarRef.current = hasil.updated_at;
            teksTersimpanRef.current = snapshot;
            judulTersimpanRef.current = hasil.title;
            setCatatan((lama) => (lama === null ? hasil : { ...lama, ...hasil, body_text: snapshot }));
          } catch (err) {
            if (err instanceof ApiError && err.status === 409 && err.code === 'rich_note') {
              // Server menolak menyunting isi berformat lengkap — bukan konflik versi.
              kayaRef.current = true;
              setKaya(true);
              teksRef.current = teksTersimpanRef.current;
              setTeks(teksTersimpanRef.current);
              continue;
            }
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
        if (konflikRef.current) {
          setStatus('konflik');
          return false;
        }
        if (!berhasil) {
          setStatus('gagal');
          return false;
        }
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
    if (!siap || !bolehIsi || konflikRef.current) {
      return undefined;
    }
    if (teks === teksTersimpanRef.current) {
      return undefined;
    }
    const timer = setTimeout(() => {
      void simpan();
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [teks, siap, bolehIsi, simpan]);

  /** Antrekan judul baru (PATCH {title} — maksud terpisah dari isi). */
  const antreJudul = useCallback((): boolean => {
    if (catatan === null || !boleh) {
      return false;
    }
    const baru = judul.trim();
    if (baru === judulTersimpanRef.current || baru === '') {
      setJudul(judulTersimpanRef.current);
      return false;
    }
    judulInginRef.current = baru;
    return true;
  }, [catatan, judul, boleh]);

  const simpanJudul = useCallback((): void => {
    if (antreJudul()) {
      void simpan();
    }
  }, [antreJudul, simpan]);

  const kembali = useCallback((): void => {
    if (keluarRef.current) {
      return;
    }
    keluarRef.current = true;
    void (async () => {
      // Flush: judul lalu isi — keduanya tersimpan sebelum layar ditutup.
      antreJudul();
      const aman = bolehRef.current ? await simpan() : true;
      if (aman) {
        router.back();
        return;
      }
      Alert.alert(
        'Perubahan belum tersimpan',
        konflikRef.current
          ? 'Catatan ini diubah orang lain. Bila keluar sekarang, suntingan Anda yang belum tersimpan akan hilang.'
          : 'Sebagian perubahan gagal disimpan. Bila keluar sekarang, perubahan itu akan hilang.',
        [
          { text: 'Tetap di sini', style: 'cancel', onPress: () => { keluarRef.current = false; } },
          { text: 'Buang & keluar', style: 'destructive', onPress: () => router.back() },
        ],
        { cancelable: true, onDismiss: () => { keluarRef.current = false; } },
      );
    })();
  }, [antreJudul, simpan]);

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
                onEndEditing={simpanJudul}
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

          {boleh && kaya ? (
            <Card style={[gaya.editorKartu, { backgroundColor: colors.infoSoft, borderColor: colors.infoSoft }]}>
              <View style={gaya.metaBaris}>
                <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                <Text style={{ color: colors.info, fontSize: 14, fontWeight: '600', flex: 1 }}>
                  Catatan ini berformat lengkap. Sunting di web.
                </Text>
              </View>
            </Card>
          ) : null}

          {bolehIsi ? (
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
