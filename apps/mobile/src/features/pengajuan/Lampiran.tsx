/**
 * Lampiran pengajuan (mockup 06, 07): daftar berkas (lokal belum terunggah
 * atau milik server), tombol "Ambil foto" / "Pilih file", sheet tiga jalur
 * (kamera · galeri · berkas), izin kamera dengan penjelasan + "Buka
 * pengaturan", pratinjau "Pakai foto / Ulangi", kompres foto (≤ ±800 KB),
 * batas ukuran/format/jumlah dari `limits` server. Pemilih sistem dibungkus
 * `tahanKunci` agar kunci aplikasi tidak menyala saat aplikasi ke latar.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { unduhLampiran, type BatasLampiran, type BerkasLokal, type LampiranServer } from '@/api/pengajuan';
import { useAppLock } from '@/features/auth/appLock';
import { radius, useTheme } from '@/theme';
import { BottomSheet, Button, Icon, IconButton, Pressable, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import { ukuranBerkas } from './format';

export type ItemLampiran = { jenis: 'lokal'; kunci: string; berkas: BerkasLokal } | { jenis: 'server'; kunci: string; data: LampiranServer };

const TARGET_FOTO = 800 * 1024;
const MAKS_SISI = 2000;

const MIME: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

/** Nama berkas unik untuk foto (di luar render). */
function namaUnik(awalan: string): string {
  return `${awalan}-${Date.now()}.jpg`;
}

function ekstensi(nama: string): string {
  return (nama.split('.').pop() ?? '').toLowerCase();
}

function namaFormat(batas: BatasLampiran): string {
  const daftar = [...new Set(batas.mimes.map((m) => (m === 'jpeg' ? 'jpg' : m)))].map((m) => m.toUpperCase());
  return daftar.length > 1 ? `${daftar.slice(0, -1).join(', ')}, atau ${daftar[daftar.length - 1]}` : (daftar[0] ?? '');
}

function ukuranFile(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

/** Kompres foto bertahap sampai ≤ ±800 KB (sisi terpanjang ≤ 2000 px). */
async function kompres(uri: string, lebar: number | undefined, tinggi: number | undefined): Promise<string> {
  const resize = (lebar ?? 0) >= (tinggi ?? 0) ? { width: Math.min(lebar ?? MAKS_SISI, MAKS_SISI) } : { height: Math.min(tinggi ?? MAKS_SISI, MAKS_SISI) };
  let hasil = (await ImageManipulator.manipulateAsync(uri, [{ resize }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG })).uri;
  for (const kualitas of [0.6, 0.45, 0.32]) {
    if (ukuranFile(hasil) <= TARGET_FOTO) {
      break;
    }
    hasil = (await ImageManipulator.manipulateAsync(hasil, [], { compress: kualitas, format: ImageManipulator.SaveFormat.JPEG })).uri;
  }
  return hasil;
}

/** Periksa berkas terhadap batas server; `null` = lolos. */
export function periksaBerkas(berkas: BerkasLokal, batas: BatasLampiran): string | null {
  const ext = ekstensi(berkas.name);
  if (!batas.mimes.includes(ext)) {
    return `${berkas.name}: lampiran harus ${namaFormat(batas)}.`;
  }
  if (berkas.size > batas.max_kilobytes * 1024) {
    return `${berkas.name} melebihi ${Math.round(batas.max_kilobytes / 1024)} MB. Kompres atau foto ulang dokumennya.`;
  }
  return null;
}

export function useBukaLampiran(requestId: string | null): (item: ItemLampiran) => Promise<void> {
  const snackbar = useSnackbar();
  return async (item) => {
    try {
      const uri =
        item.jenis === 'lokal'
          ? item.berkas.uri.startsWith('file:')
            ? new File(item.berkas.uri).contentUri
            : item.berkas.uri
          : requestId
            ? (await unduhLampiran(requestId, item.data)).contentUri
            : null;
      if (!uri) {
        return;
      }
      await Linking.openURL(uri);
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError ? err.message : 'Tidak ada aplikasi untuk membuka berkas ini.',
        variant: 'bad',
      });
    }
  };
}

export function KolomLampiran({
  daftar,
  batas,
  wajib,
  wajibInfo,
  error,
  hint,
  disabled = false,
  sibuk = false,
  requestId,
  onTambah,
  onHapus,
}: {
  daftar: ItemLampiran[];
  batas: BatasLampiran;
  /** Lampiran wajib (dari pratinjau). */
  wajib: boolean;
  /** Teks peringatan aturan, mis. "Wajib surat bila lebih dari 1 hari." */
  wajibInfo?: string | null;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  /** Sedang mengunggah/menghapus di server. */
  sibuk?: boolean;
  requestId: string | null;
  onTambah: (berkas: BerkasLokal[]) => void;
  onHapus: (item: ItemLampiran) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const { tahanKunci } = useAppLock();
  const buka = useBukaLampiran(requestId);
  const [sheet, setSheet] = useState(false);
  const [pratinjau, setPratinjau] = useState<BerkasLokal | null>(null);
  const [galatLokal, setGalatLokal] = useState<string | null>(null);

  const sisa = batas.max_files - daftar.length;
  const penuh = sisa <= 0;

  const terima = (berkas: BerkasLokal[]): void => {
    const lolos: BerkasLokal[] = [];
    let galat: string | null = null;
    for (const b of berkas) {
      const pesan = periksaBerkas(b, batas);
      if (pesan) {
        galat = pesan;
      } else if (lolos.length < sisa) {
        lolos.push(b);
      } else {
        galat = `Maksimal ${batas.max_files} lampiran.`;
      }
    }
    setGalatLokal(galat);
    if (lolos.length > 0) {
      onTambah(lolos);
    }
  };

  const izinKamera = async (): Promise<boolean> => {
    const saatIni = await ImagePicker.getCameraPermissionsAsync();
    if (saatIni.granted) {
      return true;
    }
    if (!saatIni.canAskAgain) {
      const keSetelan = await dialog.confirm({
        title: 'Akses kamera ditolak',
        message: 'Izinkan kamera untuk RuangKerja di Pengaturan Android agar bisa memotret surat atau dokumen. Anda tetap bisa memilih dari galeri atau berkas.',
        confirmLabel: 'Buka pengaturan',
        cancelLabel: 'Nanti',
      });
      if (keSetelan) {
        void Linking.openSettings();
      }
      return false;
    }
    const lanjut = await dialog.confirm({
      title: 'Izinkan kamera?',
      message: 'RuangKerja memakai kamera untuk memotret surat dokter atau dokumen. Foto hanya dikirim sebagai lampiran pengajuan ini.',
      confirmLabel: 'Lanjutkan',
      cancelLabel: 'Batal',
    });
    if (!lanjut) {
      return false;
    }
    const hasil = await tahanKunci(() => ImagePicker.requestCameraPermissionsAsync());
    if (!hasil.granted) {
      setGalatLokal(hasil.canAskAgain ? 'Izin kamera tidak diberikan.' : 'Izin kamera ditolak. Buka Pengaturan Android untuk mengizinkannya.');
    }
    return hasil.granted;
  };

  const kamera = async (): Promise<void> => {
    setSheet(false);
    if (!(await izinKamera())) {
      return;
    }
    const hasil = await tahanKunci(() => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, cameraType: ImagePicker.CameraType.back }));
    const aset = hasil.canceled ? null : hasil.assets[0];
    if (!aset) {
      return;
    }
    const uri = await kompres(aset.uri, aset.width, aset.height);
    setPratinjau({ uri, name: namaUnik('foto-dokumen'), mime: 'image/jpeg', size: ukuranFile(uri) });
  };

  const galeri = async (): Promise<void> => {
    setSheet(false);
    const hasil = await tahanKunci(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: sisa > 1, selectionLimit: Math.max(1, sisa) }),
    );
    if (hasil.canceled) {
      return;
    }
    const berkas: BerkasLokal[] = [];
    for (const aset of hasil.assets) {
      const asli = aset.fileName ?? namaUnik('gambar');
      const png = ekstensi(asli) === 'png' && (aset.fileSize ?? 0) <= TARGET_FOTO;
      if (png) {
        berkas.push({ uri: aset.uri, name: asli, mime: 'image/png', size: aset.fileSize ?? ukuranFile(aset.uri) });
      } else {
        const uri = await kompres(aset.uri, aset.width, aset.height);
        berkas.push({ uri, name: asli.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', size: ukuranFile(uri) });
      }
    }
    terima(berkas);
  };

  const dokumen = async (): Promise<void> => {
    setSheet(false);
    const hasil = await tahanKunci(() =>
      DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: sisa > 1 }),
    );
    if (hasil.canceled) {
      return;
    }
    terima(
      hasil.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mime: a.mimeType ?? MIME[ekstensi(a.name)] ?? 'application/octet-stream',
        size: a.size ?? ukuranFile(a.uri),
      })),
    );
  };

  const galat = error ?? galatLokal;
  const tombol = (ikon: 'camera' | 'paperclip', label: string, aksi: () => void): React.JSX.Element => (
    <Pressable
      onPress={aksi}
      disabled={disabled || penuh || sibuk}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.tombol, { borderColor: galat ? colors.danger : colors.borderStrong, opacity: disabled || penuh ? 0.5 : 1 }]}
    >
      <Icon name={ikon} size={20} color={colors.text} />
      <Text variant="label">{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">
        Lampiran{' '}
        <Text variant="label" weight={500} style={{ color: wajib ? colors.danger : colors.muted }}>
          {wajib ? '(wajib)' : '(opsional)'}
        </Text>
      </Text>
      {wajibInfo ? (
        <View style={s.baris}>
          <Icon name="circle-alert" size={14} color={colors.warning} />
          <Text variant="meta" tone="warning" style={{ flex: 1 }}>
            {wajibInfo}
          </Text>
        </View>
      ) : null}
      {daftar.map((item) => {
        const nama = item.jenis === 'lokal' ? item.berkas.name : item.data.filename;
        const ukuran = item.jenis === 'lokal' ? item.berkas.size : item.data.size_bytes;
        const gambar = (item.jenis === 'lokal' ? item.berkas.mime : item.data.mime_type).startsWith('image/');
        return (
          <View key={item.kunci} style={[s.berkas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => void buka(item)} style={s.berkasIsi} accessibilityRole="button" accessibilityLabel={`Buka ${nama}`}>
              {gambar && item.jenis === 'lokal' ? (
                <Image source={{ uri: item.berkas.uri }} style={[s.mini, { backgroundColor: colors.surface2 }]} />
              ) : (
                <View style={[s.mini, { backgroundColor: colors.surface2 }]}>
                  <Icon name={gambar ? 'file-image' : 'file-text'} size={22} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1}>
                  {nama}
                </Text>
                <Text variant="meta">{[ukuranBerkas(ukuran), item.jenis === 'lokal' ? 'belum terunggah' : null].filter(Boolean).join(' · ')}</Text>
              </View>
            </Pressable>
            {!disabled ? <IconButton icon="x" label={`Hapus ${nama}`} variant="ghost" size={44} disabled={sibuk} onPress={() => onHapus(item)} /> : null}
          </View>
        );
      })}
      {!disabled ? (
        <View style={s.duaTombol}>
          {tombol('camera', 'Ambil foto', () => void kamera())}
          {tombol('paperclip', 'Pilih file', () => setSheet(true))}
        </View>
      ) : null}
      {galat ? (
        <View style={s.baris} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Icon name="circle-alert" size={14} color={colors.danger} />
          <Text variant="meta" tone="danger" style={{ flex: 1 }}>
            {galat}
          </Text>
        </View>
      ) : (
        <Text variant="meta">
          {hint ?? `${daftar.length} dari ${batas.max_files} berkas · ${namaFormat(batas)} · maks. ${Math.round(batas.max_kilobytes / 1024)} MB`}
        </Text>
      )}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Tambah lampiran">
        <SheetAction icon="camera" label="Ambil foto" description="Foto dokumen dengan kamera" onPress={() => void kamera()} />
        <SheetAction icon="image" label="Pilih dari galeri" description="JPG atau PNG" onPress={() => void galeri()} />
        <SheetAction icon="file-text" label="Pilih file" description={`${namaFormat(batas)} dari penyimpanan`} onPress={() => void dokumen()} />
      </BottomSheet>

      <BottomSheet visible={pratinjau !== null} onClose={() => setPratinjau(null)} title="Pratinjau foto">
        {pratinjau ? (
          <View style={{ gap: 12 }}>
            <Image source={{ uri: pratinjau.uri }} resizeMode="contain" style={[s.pratinjau, { backgroundColor: colors.surface2 }]} accessibilityLabel="Foto dokumen" />
            <Text variant="meta" align="center">
              {ukuranBerkas(pratinjau.size)} · dikompres untuk dikirim
            </Text>
            <View style={s.duaTombol}>
              <Button title="Ulangi" variant="outline" icon="rotate-ccw" style={{ flex: 1 }} onPress={() => void (async () => {
                setPratinjau(null);
                await kamera();
              })()} />
              <Button
                title="Pakai foto"
                icon="check"
                style={{ flex: 1 }}
                onPress={() => {
                  const b = pratinjau;
                  setPratinjau(null);
                  terima([b]);
                }}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  duaTombol: { flexDirection: 'row', gap: 10 },
  tombol: { flex: 1, minHeight: 52, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  berkas: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, paddingLeft: 10, paddingRight: 4, minHeight: 64 },
  berkasIsi: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  mini: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pratinjau: { width: '100%', height: 360, borderRadius: radius.lg },
});
