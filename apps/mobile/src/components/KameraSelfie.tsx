/**
 * Kamera selfie layar penuh (expo-camera, kamera depan): penjelasan izin →
 * bidikan dengan bingkai oval → tinjau foto (catatan terang/gelap) → pakai.
 * Hasil dikompres ke JPEG ±200 KB (expo-image-manipulator). Dialog izin sistem
 * dibungkus `tahanKunci` agar kunci aplikasi tidak menutup aplikasi.
 * Mockup: docs/mockups/android/screens/03-absensi/08-kamera-selfie.html.
 */
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
// Legacy API: the root `getInfoAsync` is a throwing stub since SDK 54.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppLock } from '@/features/auth/appLock';
import { radius, useTheme } from '@/theme';
import { Button, Icon, IconButton, Pressable, Text } from '@/ui';

const TARGET_BYTES = 200 * 1024;
const MAX_DIMEN = 1080;
/** Di bawah ini foto dianggap gelap (APEX BrightnessValue dari EXIF; server memeriksa sendiri). */
const AMBANG_GELAP_BV = -1.5;

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

export interface HasilSelfie {
  uri: string;
  /** Penanda gelap (heuristik EXIF); server tetap menandai `dark_selfie` sendiri. */
  gelap: boolean;
  ukuranKb: number;
}

export function KameraSelfie({
  judul = 'Selfie check-in',
  jadwal,
  lokasi,
  jamTampil,
  onSelesai,
  onBatal,
  onPindaiQr,
}: {
  judul?: string;
  jadwal?: string;
  lokasi?: string;
  jamTampil?: string;
  onSelesai: (hasil: HasilSelfie) => void;
  onBatal: () => void;
  onPindaiQr?: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { tahanKunci } = useAppLock();
  const [izin, mintaIzin] = useCameraPermissions();
  const [proses, setProses] = useState(false);
  const [galatAmbil, setGalatAmbil] = useState<string | null>(null);
  const [hadap, setHadap] = useState<CameraType>('front');
  const [foto, setFoto] = useState<HasilSelfie | null>(null);
  const [siap, setSiap] = useState(false);
  const kamera = useRef<CameraView>(null);

  // Tombol kembali sistem: dari tinjau → bidikan; dari bidikan → batal.
  useEffect(() => {
    const l = BackHandler.addEventListener('hardwareBackPress', () => {
      if (foto) {
        setFoto(null);
      } else {
        onBatal();
      }
      return true;
    });
    return () => l.remove();
  }, [foto, onBatal]);

  const izinPermanen = izin !== null && !izin.granted && izin.canAskAgain === false;

  if (!izin) {
    return (
      <View style={[s.penuh, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!izin.granted) {
    return (
      <View style={[s.penuh, { backgroundColor: colors.bg, padding: 28, gap: 14, justifyContent: 'center' }]}>
        <StatusBar style="auto" />
        <View style={[s.ubin, { backgroundColor: colors.linkSoft }]}>
          <Icon name={izinPermanen ? 'camera-off' : 'camera'} size={30} color={colors.link} />
        </View>
        <Text variant="h2" align="center">
          {izinPermanen ? 'Izin kamera ditolak' : 'Izinkan kamera'}
        </Text>
        <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
          Selfie diperlukan sebagai bukti kehadiran saat absen. Kamera hanya terbuka saat Anda mengetuk, dan foto tidak disimpan di galeri.
        </Text>
        {izinPermanen ? (
          <Text variant="body" tone="danger" align="center" style={{ fontSize: 14 }} accessibilityRole="alert">
            Akses kamera ditolak. Izinkan dari pengaturan ponsel lalu coba lagi.
          </Text>
        ) : null}
        {izinPermanen ? (
          <Button title="Buka pengaturan" icon="settings" onPress={() => void Linking.openSettings()} />
        ) : (
          <Button title="Izinkan kamera" icon="camera" onPress={() => void tahanKunci(() => mintaIzin())} />
        )}
        <Button title="Batal" variant="quiet" onPress={onBatal} />
      </View>
    );
  }

  async function jepret(): Promise<void> {
    if (proses || !siap) {
      return;
    }
    setProses(true);
    setGalatAmbil(null);
    try {
      const mentah = await kamera.current?.takePictureAsync({ quality: 0.8, exif: true });
      if (!mentah) {
        throw new Error('kosong');
      }
      const bv = Number((mentah.exif as Record<string, unknown> | undefined)?.BrightnessValue);
      const gelap = Number.isFinite(bv) && bv < AMBANG_GELAP_BV;
      const uri = await ambilDanKompresi(mentah.uri);
      setFoto({ uri, gelap, ukuranKb: Math.round((await ukuranFile(uri)) / 1024) });
    } catch {
      setGalatAmbil('Gagal mengambil foto. Coba lagi.');
    } finally {
      setProses(false);
    }
  }

  const kepala = (
    <View style={[s.kepala, { paddingTop: insets.top + 8 }]}>
      <IconButton icon="x" label="Batal ambil selfie" variant="ghost" onPress={onBatal} />
      <View style={{ flex: 1 }}>
        <Text variant="title" weight={700} style={{ color: '#FFFFFF' }} numberOfLines={1}>
          {judul}
        </Text>
        {jadwal ? (
          <Text variant="meta" style={{ color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
            {jadwal}
          </Text>
        ) : null}
      </View>
      {jamTampil ? (
        <Text variant="mono" style={{ color: '#FFFFFF', fontSize: 18 }}>
          {jamTampil}
        </Text>
      ) : null}
    </View>
  );

  // ── Tinjau ──────────────────────────────────────────────────────────────────
  if (foto) {
    return (
      <View style={[s.penuh, { backgroundColor: '#000' }]}>
        <StatusBar style="light" />
        <Image source={{ uri: foto.uri }} style={[StyleSheet.absoluteFill, hadap === 'front' ? { transform: [{ scaleX: -1 }] } : null]} resizeMode="cover" accessibilityLabel="Pratinjau selfie" />
        {kepala}
        <View style={[s.bawahTinjau, { paddingBottom: Math.max(insets.bottom, 18) + 8 }]}>
          <View style={[s.catatan, { backgroundColor: foto.gelap ? colors.warningSoft : 'rgba(0,0,0,0.6)' }]}>
            <Icon name={foto.gelap ? 'triangle-alert' : 'circle-check'} size={20} color={foto.gelap ? colors.warning : '#FFFFFF'} />
            <Text variant="label" weight={500} style={{ flex: 1, color: foto.gelap ? colors.warning : '#FFFFFF', lineHeight: 21 }}>
              {foto.gelap
                ? 'Foto tampak gelap. Ulangi di tempat lebih terang. Foto yang terlalu gelap ditandai untuk ditinjau HR.'
                : `Wajah terlihat jelas. Foto dikompres otomatis ±${foto.ukuranKb} KB sebelum dikirim.`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Ulangi" variant="outline" icon="rotate-ccw" onPress={() => setFoto(null)} style={{ flex: 1 }} />
            <Button title={foto.gelap ? 'Tetap gunakan' : 'Gunakan foto'} icon="check" onPress={() => onSelesai(foto)} style={{ flex: 1.3 }} />
          </View>
        </View>
      </View>
    );
  }

  // ── Bidik ───────────────────────────────────────────────────────────────────
  return (
    <View style={[s.penuh, { backgroundColor: '#000' }]}>
      <StatusBar style="light" />
      <CameraView ref={kamera} style={StyleSheet.absoluteFill} facing={hadap} onCameraReady={() => setSiap(true)} />
      <View pointerEvents="none" style={[s.bingkai, { borderColor: galatAmbil ? colors.danger : 'rgba(255,255,255,0.85)' }]} />
      {kepala}

      <View style={[s.bawah, { paddingBottom: Math.max(insets.bottom, 18) + 8 }]}>
        {lokasi ? (
          <View style={s.chip}>
            <Icon name="map-pin" size={16} color="#FFFFFF" />
            <Text variant="meta" weight={600} style={{ color: '#FFFFFF' }} numberOfLines={1}>
              {lokasi}
            </Text>
          </View>
        ) : null}
        <View style={[s.pesan, galatAmbil ? { backgroundColor: colors.dangerSoft } : null]} accessibilityLiveRegion="polite">
          <Text variant="label" weight={500} style={{ color: galatAmbil ? colors.danger : '#FFFFFF' }} align="center">
            {galatAmbil ?? 'Pastikan wajah terlihat jelas dan tidak memakai masker.'}
          </Text>
        </View>
        <View style={s.baris}>
          {onPindaiQr ? (
            <Pressable onPress={onPindaiQr} accessibilityRole="button" accessibilityLabel="Pindai QR" style={s.sisi}>
              <Icon name="qr-code" size={24} color="#FFFFFF" />
              <Text variant="meta" weight={700} style={{ color: '#FFFFFF' }}>
                Pindai QR
              </Text>
            </Pressable>
          ) : (
            <View style={s.sisi} />
          )}
          <Pressable
            onPress={() => void jepret()}
            disabled={proses || !siap}
            accessibilityRole="button"
            accessibilityLabel="Ambil selfie"
            accessibilityState={{ busy: proses, disabled: proses || !siap }}
            style={s.jepret}
          >
            {proses ? <ActivityIndicator color="#FFFFFF" /> : <View style={s.jepretInti} />}
          </Pressable>
          <Pressable
            onPress={() => setHadap((h) => (h === 'front' ? 'back' : 'front'))}
            accessibilityRole="button"
            accessibilityLabel="Ganti kamera"
            style={s.sisi}
          >
            <Icon name="switch-camera" size={24} color="#FFFFFF" />
            <Text variant="meta" weight={700} style={{ color: '#FFFFFF' }}>
              Ganti kamera
            </Text>
          </Pressable>
        </View>
        {proses ? (
          <Text variant="meta" align="center" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Memproses foto… mengompres ke ±200 KB.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  penuh: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ubin: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  kepala: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  bingkai: { position: 'absolute', top: '24%', alignSelf: 'center', width: 240, height: 310, borderRadius: 140, borderWidth: 3 },
  bawah: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, gap: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  bawahTinjau: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 16, gap: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  catatan: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.xl, alignItems: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 32, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.18)' },
  pesan: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg, backgroundColor: 'rgba(0,0,0,0.5)' },
  baris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', alignSelf: 'stretch' },
  sisi: { width: 96, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  jepret: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  jepretInti: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
});
