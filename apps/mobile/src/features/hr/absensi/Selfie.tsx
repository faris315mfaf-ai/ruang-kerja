/**
 * Lihat selfie (mockup 11 › 20): dialog konfirmasi ("dicatat di audit log,
 * tautan 5 menit") → tautan bertanda tangan → gambar diambil dengan Bearer
 * sebagai data URI DI MEMORI (tanpa cache gambar/disk) → layar penuh dengan
 * hitung mundur; ditutup otomatis saat tautan kedaluwarsa, data dilepas saat
 * ditutup. Retensi → dialog "Selfie tidak tersedia".
 * Catatan: FLAG_SECURE belum dipasang (butuh paket native, lihat ringkasan).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { ambilGambarSelfie, tautanSelfie } from '@/api/hr';
import { jam, tanggalPendek } from '@/lib/format';
import { useTheme } from '@/theme';
import { Icon, Pressable, Text, useDialog, useSnackbar } from '@/ui';

export interface SubjekSelfie {
  logId: string;
  name: string;
  typeLabel: string;
  occurredAt: string | null;
}

interface Tampil {
  subjek: SubjekSelfie;
  gambar: string | null;
  kedaluwarsa: number;
}

function sisaTeks(ms: number): string {
  const detik = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, '0')}`;
}

export function useLihatSelfie(): { lihat: (s: SubjekSelfie) => void; elemen: React.JSX.Element } {
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [tampil, setTampil] = useState<Tampil | null>(null);
  const [sekarang, setSekarang] = useState(0);
  const urut = useRef(0);

  const tutup = useCallback(() => {
    urut.current++;
    setTampil(null);
  }, []);

  const lihat = useCallback(
    (subjek: SubjekSelfie) => {
      void (async () => {
        const ok = await dialog.confirm({
          title: `Lihat selfie ${subjek.name}?`,
          message: 'Selfie adalah data sensitif. Akses ini dicatat di audit log. Tautan hanya berlaku 5 menit.',
          confirmLabel: 'Lihat selfie',
          cancelLabel: 'Batal',
        });
        if (!ok) return;
        const nomor = ++urut.current;
        try {
          const t = await tautanSelfie(subjek.logId);
          if (nomor !== urut.current) return;
          const kedaluwarsa = new Date(t.expires_at).getTime();
          setSekarang(Date.now());
          setTampil({ subjek, gambar: null, kedaluwarsa });
          const gambar = await ambilGambarSelfie(t.url);
          if (nomor !== urut.current) return;
          setTampil({ subjek, gambar, kedaluwarsa });
        } catch (err) {
          if (nomor !== urut.current) return;
          setTampil(null);
          if (err instanceof ApiError && err.status === 404) {
            await dialog.alert({ title: 'Selfie tidak tersedia', message: err.message || 'Selfie sudah dihapus sesuai masa retensi.', okLabel: 'Mengerti' });
          } else if (err instanceof ApiError && err.status === 0) {
            snackbar.show({ message: 'Tidak ada koneksi. Selfie butuh koneksi.', variant: 'offline' });
          } else {
            snackbar.show({ message: err instanceof ApiError ? err.message : 'Selfie gagal dimuat.', variant: 'bad' });
          }
        }
      })();
    },
    [dialog, snackbar],
  );

  const aktif = tampil !== null;
  const kedaluwarsa = tampil?.kedaluwarsa ?? 0;
  useEffect(() => {
    if (!aktif) return undefined;
    const t = setInterval(() => {
      const kini = Date.now();
      setSekarang(kini);
      if (kini >= kedaluwarsa) tutup();
    }, 1000);
    return () => clearInterval(t);
  }, [aktif, kedaluwarsa, tutup]);

  return { lihat, elemen: <LayarSelfie tampil={tampil} sekarang={sekarang} onClose={tutup} /> };
}

function LayarSelfie({ tampil, sekarang, onClose }: { tampil: Tampil | null; sekarang: number; onClose: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={tampil !== null} onRequestClose={onClose} animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <View style={[s.latar, { backgroundColor: colors.inverse, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        {tampil ? (
          <>
            <View style={s.kepala}>
              <View style={{ flex: 1 }}>
                <Text variant="title" tone="onInverse" accessibilityRole="header">
                  {`Selfie · ${tampil.subjek.name}`}
                </Text>
                <Text variant="meta" tone="onInverse" style={{ fontSize: 14 }}>
                  {`${tampil.subjek.typeLabel} ${jam(tampil.subjek.occurredAt)} · ${tanggalPendek(tampil.subjek.occurredAt)}`}
                </Text>
              </View>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup selfie" hitSlop={4} style={s.tutup}>
                <Icon name="x" size={24} color={colors.onInverse} />
              </Pressable>
            </View>
            <View style={s.gambar}>
              {tampil.gambar ? (
                <Image source={{ uri: tampil.gambar }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel={`Selfie ${tampil.subjek.name}`} />
              ) : (
                <ActivityIndicator color={colors.onInverse} accessibilityLabel="Memuat selfie" />
              )}
            </View>
            <Text variant="meta" tone="onInverse" align="center" style={{ fontSize: 14 }} accessibilityLiveRegion="polite">
              {`Tautan berakhir dalam ${sisaTeks(tampil.kedaluwarsa - sekarang)} · akses dicatat di audit log`}
            </Text>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  latar: { flex: 1, paddingHorizontal: 16, gap: 12 },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tutup: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  gambar: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden' },
});
