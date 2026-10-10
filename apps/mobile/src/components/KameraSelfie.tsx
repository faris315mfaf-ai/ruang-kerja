/**
 * Kamera selfie — expo-camera (kamera depan), kompresi hasil ke JPEG
 * ±200 KB lewat expo-image-manipulator + cek ukuran expo-file-system.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useTheme } from '@/lib/theme';

const TARGET_BYTES = 200 * 1024;
const MAX_DIMEN = 1080;

async function ukuranFile(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? (info.size ?? 0) : 0;
}

/** Ambil & kompres selfie: maks 1080 px, JPEG turun bertahap sampai ±200 KB. */
export async function ambilDanKompresi(uri: string): Promise<string> {
  const pertama = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_DIMEN } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  let hasil = pertama.uri;
  for (const kualitas of [0.7, 0.55, 0.4, 0.28]) {
    const ukuran = await ukuranFile(hasil);
    if (ukuran <= TARGET_BYTES) {
      break;
    }
    const ulang = await ImageManipulator.manipulateAsync(hasil, [{ resize: { width: MAX_DIMEN } }], {
      compress: kualitas,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    hasil = ulang.uri;
  }

  return hasil;
}

export function KameraSelfie({
  onSelesai,
  onBatal,
}: {
  onSelesai: (uri: string) => void;
  onBatal: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [izin, mintaIzin] = useCameraPermissions();
  const [proses, setProses] = useState(false);
  const [galatAmbil, setGalatAmbil] = useState<string | null>(null);
  const kamera = useRef<CameraView>(null);

  // Izin ditolak permanen — diturunkan dari status izin, bukan state.
  const izinDitolak = izin !== null && !izin.granted && izin.canAskAgain === false;
  const galat = izinDitolak
    ? 'Akses kamera ditolak. Izinkan dari pengaturan ponsel lalu coba lagi.'
    : galatAmbil;

  if (!izin) {
    return (
      <View style={[tampilan.penuh, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!izin.granted) {
    return (
      <View style={[tampilan.penuh, { backgroundColor: colors.bg, padding: 28, gap: 14 }]}>
        <Text style={[tampilan.judul, { color: colors.text }]}>Izinkan kamera</Text>
        <Text style={[tampilan.teks, { color: colors.muted }]}>
          Selfie diperlukan sebagai bukti kehadiran saat absen.
        </Text>
        {galat ? (
          <Text style={[tampilan.galat, { color: colors.danger }]} accessibilityRole="alert">
            {galat}
          </Text>
        ) : null}
        <Button title="Izinkan kamera" onPress={() => void mintaIzin()} />
        <Button title="Batal" variant="ghost" onPress={onBatal} />
      </View>
    );
  }

  async function jepret(): Promise<void> {
    if (proses) {
      return;
    }
    setProses(true);
    setGalatAmbil(null);
    try {
      const foto = await kamera.current?.takePictureAsync({ quality: 0.8, exif: false });
      if (!foto) {
        throw new Error('kosong');
      }
      const uri = await ambilDanKompresi(foto.uri);
      onSelesai(uri);
    } catch {
      setGalatAmbil('Gagal mengambil foto. Coba lagi.');
    } finally {
      setProses(false);
    }
  }

  return (
    <View style={[tampilan.penuh, { backgroundColor: '#000' }]}>
      <CameraView ref={kamera} style={StyleSheet.absoluteFill} facing="front" />

      {/* Bingkai wajah */}
      <View pointerEvents="none" style={[tampilan.bingkai, { borderColor: galat ? colors.danger : 'rgba(255,255,255,0.85)' }]} />

      {galat ? (
        <View style={[tampilan.pesan, { top: insets.top + 12 }]}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{galat}</Text>
        </View>
      ) : (
        <View style={[tampilan.pesan, { top: insets.top + 12 }]}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Posisikan wajah di dalam bingkai</Text>
        </View>
      )}

      <View style={[tampilan.bawah, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Pressable onPress={onBatal} accessibilityRole="button" accessibilityLabel="Batal ambil selfie" style={tampilan.tombolSisi}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Batal</Text>
        </Pressable>

        <Pressable
          onPress={() => void jepret()}
          disabled={proses}
          accessibilityRole="button"
          accessibilityLabel="Ambil selfie"
          accessibilityState={{ busy: proses, disabled: proses }}
          style={[tampilan.jepret, { borderColor: '#fff' }]}
        >
          {proses ? <ActivityIndicator color="#fff" /> : <View style={tampilan.jepretInti} />}
        </Pressable>

        <View style={tampilan.tombolSisi} />
      </View>
    </View>
  );
}

const tampilan = StyleSheet.create({
  penuh: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  judul: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  teks: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  galat: { fontSize: 13, textAlign: 'center' },
  bingkai: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    width: 230,
    height: 300,
    borderRadius: 130,
    borderWidth: 3,
  },
  pesan: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bawah: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
  },
  jepret: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jepretInti: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  tombolSisi: { width: 74, height: 48, alignItems: 'center', justifyContent: 'center' },
});
