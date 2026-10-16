/**
 * Pesan seputar lokasi di layar Absen: penjelasan izin sebelum dialog sistem
 * (rationale), izin ditolak/permanen, lokasi perkiraan, layanan mati, galat baca,
 * dan peringatan dini (akurasi, lokasi palsu, jam perangkat, luar radius).
 */
import { Linking, View } from 'react-native';

import { jarakMeter } from '@/lib/format';
import { useTheme } from '@/theme';
import { Banner, Button, Card, Icon, Text } from '@/ui';

import { AKURASI_PERINGATAN_M, AKURASI_TANDAI_M, type StatusGps } from './useLokasiAbsen';

function bukaPengaturan(): void {
  void Linking.openSettings().catch(() => undefined);
}

function Langkah({ n, teks }: { n: number; teks: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.linkSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="meta" weight={700} tone="link">
          {n}
        </Text>
      </View>
      <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>
        {teks}
      </Text>
    </View>
  );
}

/** Kartu/banner untuk keadaan galat lokasi; null bila tidak ada yang perlu ditampilkan. */
export function GalatLokasi({
  status,
  qr,
  onMinta,
  onCoba,
  onAktifkan,
  onNanti,
  ditunda = false,
}: {
  status: StatusGps;
  /** Mode QR: lokasi opsional, tidak menekan pengguna. */
  qr: boolean;
  onMinta: () => void;
  onCoba: () => void;
  onAktifkan: () => void;
  onNanti: () => void;
  /** Pengguna memilih "Nanti saja": tampilkan banner ringkas alih-alih kartu penjelasan. */
  ditunda?: boolean;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  if (status.keadaan !== 'galat') {
    return null;
  }
  switch (status.jenis) {
    case 'izin_belum':
      if (qr) {
        return null;
      }
      if (ditunda) {
        return <Banner tone="warn" title="Lokasi diperlukan" message="Izinkan lokasi untuk check-in GPS. Tanpa izin ini Anda masih bisa memindai QR kiosk." actionLabel="Izinkan lokasi" onAction={onMinta} />;
      }
      return (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="map-pin" size={22} color={colors.link} />
            <Text variant="title" weight={700} style={{ flex: 1 }}>
              Izinkan lokasi saat absen
            </Text>
          </View>
          <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
            RuangKerja membaca lokasi hanya saat Anda check-in atau check-out, untuk memastikan Anda berada di area kantor. Lokasi tidak dilacak di latar belakang.
          </Text>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="check" size={18} color={colors.success} />
              <Text variant="meta" style={{ fontSize: 14, flex: 1 }}>Pilih Tepat agar akurasi di bawah 50 m</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="check" size={18} color={colors.success} />
              <Text variant="meta" style={{ fontSize: 14, flex: 1 }}>Pilih Saat aplikasi sedang digunakan</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Nanti saja" variant="quiet" onPress={onNanti} style={{ flex: 1 }} />
            <Button title="Lanjut" onPress={onMinta} style={{ flex: 1.4 }} />
          </View>
        </Card>
      );
    case 'izin_ditolak':
      return qr ? null : (
        <Banner tone="bad" title="Izin lokasi diperlukan" message="Izinkan lokasi untuk check-in GPS. Tanpa izin ini Anda masih bisa memindai QR kiosk." actionLabel="Izinkan lagi" onAction={onMinta} />
      );
    case 'izin_permanen':
      return qr ? null : (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="map-pin-off" size={22} color={colors.danger} />
            <Text variant="title" weight={700} style={{ flex: 1 }}>
              Izin lokasi ditolak
            </Text>
          </View>
          <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
            Izinkan dari pengaturan ponsel lalu coba lagi. Android tidak menampilkan dialog izin lagi setelah ditolak dua kali.
          </Text>
          <Langkah n={1} teks="Buka pengaturan RuangKerja" />
          <Langkah n={2} teks="Izin → Lokasi" />
          <Langkah n={3} teks="Pilih Izinkan hanya saat aplikasi digunakan + Gunakan lokasi tepat" />
          <Button title="Buka pengaturan" icon="settings" onPress={bukaPengaturan} />
          <Button title="Coba baca lokasi" variant="outline" icon="refresh-cw" onPress={onCoba} />
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
            Tanpa izin lokasi Anda masih bisa memindai QR kiosk.
          </Text>
        </Card>
      );
    case 'perkiraan':
      return qr ? null : (
        <Banner
          tone="warn"
          title="Lokasi perkiraan"
          message={`Akurasi${status.titik?.accuracy ? ` ±${jarakMeter(status.titik.accuracy)}` : ''} terlalu kasar untuk absen. Ubah izin ke Lokasi tepat.`}
          actionLabel="Buka pengaturan"
          onAction={bukaPengaturan}
        />
      );
    case 'layanan_mati':
      if (!qr && ditunda) {
        return <Banner tone="warn" title="Layanan lokasi mati" message="Aktifkan lokasi perangkat untuk check-in GPS." actionLabel="Aktifkan" onAction={onAktifkan} />;
      }
      return qr ? null : (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="locate-off" size={22} color={colors.warning} />
            <Text variant="title" weight={700} style={{ flex: 1 }}>
              Untuk melanjutkan, aktifkan lokasi perangkat
            </Text>
          </View>
          <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
            Layanan lokasi mati. RuangKerja memerlukannya untuk memeriksa Anda berada di area kantor.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Tidak, terima kasih" variant="quiet" onPress={onNanti} style={{ flex: 1 }} />
            <Button title="Aktifkan" onPress={onAktifkan} style={{ flex: 1 }} />
          </View>
        </Card>
      );
    default:
      return qr ? null : <Banner tone="bad" title="Lokasi tidak terbaca" message={status.pesan} actionLabel="Coba baca lokasi" onAction={onCoba} />;
  }
}

/** Peringatan dini (bukan pemblokiran): server tetap yang memutuskan. */
export function PeringatanDini({
  akurasi,
  mocked,
  skewMenit,
  luarRadius,
}: {
  akurasi: number | null;
  mocked: boolean;
  skewMenit: number | null;
  luarRadius: { jarakM: number; radiusM: number; nama: string } | null;
}): React.JSX.Element | null {
  const butir: React.JSX.Element[] = [];
  if (luarRadius) {
    butir.push(
      <Banner
        key="radius"
        tone="bad"
        title="Anda di luar radius kantor"
        message={`${jarakMeter(luarRadius.jarakM)} dari ${luarRadius.nama} (batas ${jarakMeter(luarRadius.radiusM)}). Check-in GPS akan ditolak. Pilih WFH bila hari ini remote, atau ajukan dinas luar.`}
      />,
    );
  }
  if (mocked) {
    butir.push(
      <Banner
        key="mock"
        tone="warn"
        title="Lokasi palsu terdeteksi"
        message='Android melaporkan lokasi dari aplikasi simulasi. Matikan "Aplikasi lokasi tiruan" di Opsi pengembang. Absensi tetap bisa dikirim, tetapi ditandai untuk ditinjau HR; bila lokasi Anda benar, ajukan koreksi.'
      />,
    );
  }
  if (akurasi !== null && akurasi > AKURASI_TANDAI_M) {
    butir.push(<Banner key="akurasi" tone="warn" message={`Akurasi GPS ±${Math.round(akurasi)} m. Di atas ${AKURASI_TANDAI_M} m: absensi tetap tercatat dan ditandai untuk ditinjau HR.`} />);
  } else if (akurasi !== null && akurasi > AKURASI_PERINGATAN_M) {
    butir.push(<Banner key="akurasi" tone="warn" message={`Akurasi GPS ±${Math.round(akurasi)} m. Nyalakan mode akurasi tinggi dan coba di dekat jendela.`} />);
  }
  if (skewMenit !== null) {
    butir.push(
      <Banner
        key="jam"
        tone="warn"
        title="Jam perangkat tidak sesuai"
        message={`Jam perangkat berbeda ${skewMenit} menit dari server. Aktifkan "Tanggal & waktu otomatis". Waktu absen tetap memakai jam server, kejadian ditandai.`}
      />,
    );
  }
  return butir.length === 0 ? null : <View style={{ gap: 10 }}>{butir}</View>;
}
