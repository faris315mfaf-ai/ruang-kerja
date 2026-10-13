/**
 * Pindai QR kiosk (check-in/out). Kode `ruangkerja://checkin?...` dikirim apa
 * adanya ke server (`POST /absensi/check-in/qr` | `/check-out/qr`); GPS ikut
 * dikirim bila izin sudah diberikan (tanpa meminta izin di sini). Keadaan:
 * mencari kode, bukan kode kiosk, mengirim.
 * Mockup: docs/mockups/android/screens/03-absensi/09-qr-scan.html.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { jalankanQr } from '@/features/absensi/kirim';
import { absenStore, type TitikKirim } from '@/features/absensi/store';
import { useTahanKunciSelama } from '@/features/absensi/useTahanKunciSelama';
import { useAppLock } from '@/features/auth/appLock';
import { radius, useTheme } from '@/theme';
import { Button, Icon, IconButton, Pressable, Text } from '@/ui';

const AWALAN_KIOSK = 'ruangkerja://checkin';
/** Jeda sebelum pemindai menerima kode lagi setelah kode asing. */
const JEDA_ASING_MS = 1800;
/** Paling lama menunggu GPS setelah kode terbaca. */
const TUNGGU_GPS_MS = 4000;

export default function LayarQr(): React.JSX.Element {
  useTahanKunciSelama();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { tahanKunci } = useAppLock();
  const params = useLocalSearchParams<{ arah?: string }>();
  const arah = params.arah === 'pulang' ? 'pulang' : 'masuk';
  const [izin, mintaIzin] = useCameraPermissions();
  const [senter, setSenter] = useState(false);
  const [asing, setAsing] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const kunci = useRef(false);
  const gps = useRef<Promise<TitikKirim | null> | null>(null);

  // GPS opsional (tanpa dialog izin): dimulai begitu layar dibuka agar siap saat kode terbaca.
  useEffect(() => {
    gps.current = (async (): Promise<TitikKirim | null> => {
      try {
        const izinLokasi = await Location.getForegroundPermissionsAsync();
        if (!izinLokasi.granted) {
          return null;
        }
        const posisi = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: posisi.coords.latitude, longitude: posisi.coords.longitude, accuracy: posisi.coords.accuracy ?? null, mocked: posisi.mocked === true };
      } catch {
        return null;
      }
    })();
  }, []);

  useEffect(() => {
    const l = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!mengirim) {
        router.back();
      }
      return true;
    });
    return () => l.remove();
  }, [mengirim]);

  useEffect(() => {
    if (!asing) {
      return undefined;
    }
    const t = setTimeout(() => {
      setAsing(false);
      kunci.current = false;
    }, JEDA_ASING_MS);
    return () => clearTimeout(t);
  }, [asing]);

  const terbaca = useCallback(
    async (kode: string): Promise<void> => {
      if (kunci.current) {
        return;
      }
      kunci.current = true;
      if (!kode.startsWith(AWALAN_KIOSK)) {
        setAsing(true);
        return;
      }
      setMengirim(true);
      const titik = await Promise.race([gps.current ?? Promise.resolve(null), new Promise<null>((r) => setTimeout(() => r(null), TUNGGU_GPS_MS))]);
      await jalankanQr(arah, kode, titik, absenStore.get().jadwal ?? { batasTerlambat: null, jadwalMulai: null, jamPulangTerjadwal: null, masukPada: null, masukLokasi: null });
      router.replace('/absensi/hasil');
    },
    [arah],
  );

  if (!izin) {
    return (
      <View style={[s.penuh, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!izin.granted) {
    const permanen = izin.canAskAgain === false;
    return (
      <View style={[s.penuh, { backgroundColor: colors.bg, padding: 28, gap: 14, justifyContent: 'center' }]}>
        <StatusBar style="auto" />
        <View style={[s.ubin, { backgroundColor: colors.linkSoft }]}>
          <Icon name={permanen ? 'camera-off' : 'qr-code'} size={30} color={colors.link} />
        </View>
        <Text variant="h2" align="center">
          {permanen ? 'Izin kamera ditolak' : 'Izinkan kamera'}
        </Text>
        <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
          Kamera dipakai untuk memindai kode QR di layar kiosk. Gambar tidak disimpan.
        </Text>
        {permanen ? <Button title="Buka pengaturan" icon="settings" onPress={() => void Linking.openSettings()} /> : <Button title="Izinkan kamera" icon="camera" onPress={() => void tahanKunci(() => mintaIzin())} />}
        <Button title="Batal" variant="quiet" onPress={() => router.back()} />
      </View>
    );
  }

  const pesan = mengirim ? 'Mengirim…' : asing ? 'Ini bukan kode kiosk RuangKerja. Arahkan kamera ke kode di layar kiosk.' : 'Arahkan kamera ke kode QR di layar kiosk. Kode berganti tiap 30 detik.';

  return (
    <View style={[s.penuh, { backgroundColor: '#000' }]}>
      <StatusBar style="light" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={senter}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={mengirim || asing ? undefined : (e) => void terbaca(e.data)}
      />

      <View style={[s.kepala, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="x" label="Tutup pemindai" variant="ghost" onPress={() => router.back()} disabled={mengirim} />
        <View style={{ flex: 1 }}>
          <Text variant="title" weight={700} style={{ color: '#FFFFFF' }}>
            {arah === 'masuk' ? 'Pindai QR check-in' : 'Pindai QR check-out'}
          </Text>
          <Text variant="meta" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Arahkan kamera ke layar kiosk
          </Text>
        </View>
      </View>

      <View pointerEvents="none" style={s.tengah}>
        <View style={[s.bingkai, { borderColor: asing ? colors.danger : mengirim ? colors.fill.teal : 'rgba(255,255,255,0.9)' }]} />
      </View>

      <View style={[s.bawah, { paddingBottom: Math.max(insets.bottom, 18) + 8 }]}>
        <View style={[s.pesan, asing ? { backgroundColor: colors.dangerSoft } : null]} accessibilityLiveRegion="polite" accessibilityRole={asing ? 'alert' : undefined}>
          {mengirim ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
          <Text variant="label" weight={500} align="center" style={{ color: asing ? colors.danger : '#FFFFFF', flexShrink: 1 }}>
            {pesan}
          </Text>
        </View>
        {mengirim ? (
          <Text variant="meta" align="center" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Kode dikenali. Lokasi GPS ikut dikirim bila diizinkan.
          </Text>
        ) : null}
        <View style={s.baris}>
          <Pressable onPress={() => setSenter((v) => !v)} disabled={mengirim} accessibilityRole="button" accessibilityLabel={senter ? 'Matikan senter' : 'Nyalakan senter'} accessibilityState={{ selected: senter }} style={s.sisi}>
            <Icon name="flashlight" size={24} color={senter ? colors.fill.warning : '#FFFFFF'} />
            <Text variant="meta" weight={700} style={{ color: '#FFFFFF' }}>
              Senter
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              absenStore.setMetode('gps');
              router.back();
            }}
            disabled={mengirim}
            accessibilityRole="button"
            accessibilityLabel="GPS + selfie"
            style={s.sisi}
          >
            <Icon name="camera" size={24} color="#FFFFFF" />
            <Text variant="meta" weight={700} style={{ color: '#FFFFFF' }}>
              GPS + selfie
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  penuh: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ubin: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  kepala: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  tengah: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bingkai: { width: 250, height: 250, borderRadius: radius['2xl'], borderWidth: 3 },
  bawah: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, gap: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  pesan: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: 'rgba(0,0,0,0.5)' },
  baris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', alignSelf: 'stretch' },
  sisi: { minWidth: 96, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
