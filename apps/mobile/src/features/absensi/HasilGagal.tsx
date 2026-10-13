/**
 * Layar "Check-in belum bisa": penolakan server per alasan (luar radius dengan
 * peta + "Pilih cara lain", sudah check-in, persetujuan diperlukan, hari dari
 * pengajuan, jaringan terputus, batas percobaan, QR kedaluwarsa, catatan WFH
 * diperlukan, ...). Data form dan foto tidak hilang.
 * Mockup: docs/mockups/android/screens/03-absensi/11-hasil-gagal.html.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import type { GagalAbsen } from '@/api/absensi';
import { jam, jarakMeter, tanggalPendek } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Banner, Button, Card, Field, Input, ListRow, Screen, SubAppBar, Text, type AnyIconName } from '@/ui';

import { jalankanPermintaan } from './kirim';
import { absenStore, type HasilAbsen } from './store';
import { bukaDinasLuar, bukaKoreksiHari, bukaPengajuanTerkait } from './koreksi';

type Gagal = Extract<HasilAbsen, { jenis: 'gagal' }>;

const TINGGI = 190;

/** Peta luar radius: kantor + lingkaran radius, posisi pengguna, garis putus-putus dan jarak. */
function PetaLuarRadius({ g }: { g: GagalAbsen }): React.JSX.Element {
  const { colors } = useTheme();
  const [lebar, setLebar] = useState(0);
  const ctx = g.context;
  const radiusM = ctx.radius_m ?? ctx.location?.radius_m ?? 100;
  const jarakM = ctx.distance_m ?? 0;
  const titik = absenStore.get().permintaan?.titik ?? null;
  const kantor = ctx.location;

  const rPx = 46;
  const skala = rPx / Math.max(radiusM, 1);
  const kx = lebar * 0.28;
  const ky = TINGGI * 0.52;
  // Arah ke pengguna dari koordinat bila ada, selain itu ke kanan atas.
  let sudut = -0.28;
  if (titik && kantor?.latitude !== undefined && kantor.longitude !== undefined) {
    const dx = (titik.longitude - kantor.longitude) * Math.cos((kantor.latitude * Math.PI) / 180);
    const dy = titik.latitude - kantor.latitude;
    sudut = Math.atan2(-dy, dx);
  }
  const maksPx = Math.max(rPx + 24, Math.min(lebar * 0.7, jarakM * skala));
  const ux = Math.min(lebar - 24, Math.max(24, kx + Math.cos(sudut) * maksPx));
  const uy = Math.min(TINGGI - 24, Math.max(24, ky + Math.sin(sudut) * maksPx));
  const mx = (kx + ux) / 2;
  const my = (ky + uy) / 2;
  const akurasi = ctx.accuracy_m ?? titik?.accuracy ?? 20;

  return (
    <View onLayout={(e) => setLebar(e.nativeEvent.layout.width)} style={{ height: TINGGI, backgroundColor: colors.infoSoft, overflow: 'hidden' }} accessible accessibilityLabel={`Peta: Anda ${jarakMeter(jarakM)} dari ${kantor?.name ?? 'kantor'}, batas ${jarakMeter(radiusM)}`}>
      {lebar > 0 ? (
        <Svg width={lebar} height={TINGGI}>
          {Array.from({ length: Math.ceil(lebar / 32) + 1 }, (_, i) => (
            <Line key={`v${i}`} x1={i * 32} y1={0} x2={i * 32} y2={TINGGI} stroke={colors.border} strokeWidth={1} opacity={0.7} />
          ))}
          {Array.from({ length: Math.ceil(TINGGI / 32) + 1 }, (_, i) => (
            <Line key={`h${i}`} x1={0} y1={i * 32} x2={lebar} y2={i * 32} stroke={colors.border} strokeWidth={1} opacity={0.7} />
          ))}
          <Circle cx={kx} cy={ky} r={rPx} fill={colors.fill.teal} fillOpacity={0.16} stroke={colors.primary} strokeWidth={1.8} strokeDasharray="5 4" />
          <Line x1={kx} y1={ky} x2={ux} y2={uy} stroke={colors.danger} strokeWidth={2} strokeDasharray="5 4" />
          <Circle cx={ux} cy={uy} r={Math.min(26, Math.max(12, akurasi * skala))} fill={colors.danger} fillOpacity={0.18} />
          <Circle cx={ux} cy={uy} r={8} fill={colors.accentBlueStrong} stroke={colors.surface} strokeWidth={2.5} />
          <Rect x={kx - 10} y={ky - 10} width={20} height={20} rx={7} fill={colors.primary} stroke={colors.surface} strokeWidth={2.5} />
        </Svg>
      ) : null}
      {lebar > 0 ? (
        <>
          <View style={[s.chipJarak, { left: mx - 32, top: my - 16, backgroundColor: colors.surface, borderColor: colors.danger }]}>
            <Text variant="mono" style={{ color: colors.danger, fontSize: 14 }}>
              {Math.round(jarakM)} m
            </Text>
          </View>
          <View style={[s.namaKantor, { left: Math.max(8, kx - 40), top: ky + rPx + 6, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="meta" weight={700} style={{ color: colors.text }} numberOfLines={1}>
              {kantor?.name ?? 'Kantor'}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

interface Konten {
  judul: string;
  ikon?: AnyIconName;
}

const KONTEN: Record<string, Konten> = {
  already_checked_in: { judul: 'Sudah check-in' },
  already_checked_out: { judul: 'Sudah check-out' },
  not_checked_in: { judul: 'Belum check-in' },
  consent_required: { judul: 'Persetujuan diperlukan' },
  day_has_request: { judul: 'Hari ini tercatat dari pengajuan' },
  too_early: { judul: 'Belum waktunya check-in' },
  no_office_location: { judul: 'Lokasi kantor belum diatur' },
  note_required: { judul: 'Catatan diperlukan' },
  jaringan: { judul: 'Koneksi terputus' },
  batas: { judul: 'Terlalu banyak percobaan' },
  qr_expired: { judul: 'Kode QR kedaluwarsa' },
  qr_invalid: { judul: 'Kode QR tidak dikenali' },
  qr_wrong_location: { judul: 'Kode QR dari lokasi lain' },
  qr_location_required: { judul: 'Lokasi GPS diperlukan' },
  outside_geofence: { judul: 'Di luar radius kantor' },
};

function useHitungMundur(detik: number | null): number {
  const [sisa, setSisa] = useState(detik ?? 0);
  useEffect(() => {
    if (!detik) {
      return undefined;
    }
    const akhir = Date.now() + detik * 1000;
    const t = setInterval(() => setSisa(Math.max(0, Math.ceil((akhir - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [detik]);
  return sisa;
}

export function HasilGagal({ h, onKembali }: { h: Gagal; onKembali: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const g = h.gagal;
  const masuk = h.arah === 'masuk';
  const [mengulang, setMengulang] = useState(false);
  const [catatan, setCatatan] = useState(absenStore.get().catatan);
  const sisa = useHitungMundur(g.reason === 'batas' ? (g.retryAfter && g.retryAfter > 0 ? g.retryAfter : 60) : null);
  const konten = KONTEN[g.reason] ?? { judul: masuk ? 'Check-in belum bisa' : 'Check-out belum bisa' };
  const judulBar = masuk ? 'Check-in belum bisa' : 'Check-out belum bisa';
  const permintaan = absenStore.get().permintaan;

  const kirimUlang = async (catatanBaru?: string): Promise<void> => {
    if (!permintaan || mengulang) {
      onKembali();
      return;
    }
    setMengulang(true);
    if (catatanBaru !== undefined) {
      absenStore.setCatatan(catatanBaru);
    }
    const jadwal = absenStore.get().jadwal ?? { batasTerlambat: null, jadwalMulai: null, jamPulangTerjadwal: null, masukPada: null, masukLokasi: null };
    await jalankanPermintaan({ ...permintaan, catatan: catatanBaru ?? permintaan.catatan }, jadwal);
    setMengulang(false);
  };

  const pilihCaraLain = (): React.JSX.Element => (
    <>
      <Text variant="overline" tone="muted" style={{ marginTop: 4 }}>
        Pilih cara lain
      </Text>
      <Card variant="flat">
        <ListRow
          icon="refresh-cw"
          iconTone="teal"
          title={<Text variant="title" tone="link">Perbarui lokasi</Text>}
          onPress={() => {
            absenStore.mintaSegarkanLokasi(true);
            onKembali();
          }}
        />
        <ListRow
          divider
          icon="qr-code"
          title="Pindai QR di kiosk"
          onPress={() => router.replace({ pathname: '/absensi/qr', params: { arah: h.arah } })}
        />
        <ListRow
          divider
          icon="house"
          title="Check-in WFH/lapangan"
          subtitle="Hanya bila jadwal mengizinkan"
          onPress={() => {
            absenStore.setMetode('wfh');
            onKembali();
          }}
        />
        <ListRow divider icon="building" title="Ajukan dinas luar" onPress={bukaDinasLuar} />
        <ListRow divider icon="clipboard-pen-line" title="Ajukan koreksi absensi" onPress={() => bukaKoreksiHari()} />
      </Card>
    </>
  );

  let badan: React.ReactNode;
  switch (g.reason) {
    case 'outside_geofence': {
      const akurasi = g.context.accuracy_m;
      badan = (
        <>
          <Card variant="flat">
            <PetaLuarRadius g={g} />
            <View style={s.legenda}>
              <Text variant="meta" style={{ fontSize: 14 }}>◌ Radius {jarakMeter(g.context.radius_m ?? 100)}</Text>
              <Text variant="meta" style={{ fontSize: 14, color: colors.accentBlueStrong }}>● Posisi Anda</Text>
              {akurasi ? <Text variant="meta" style={{ fontSize: 14 }}>Akurasi ±{Math.round(akurasi)} m</Text> : null}
            </View>
          </Card>
          <Banner tone="bad" title="Di luar radius kantor" message={g.message} />
          {pilihCaraLain()}
          {akurasi && akurasi > 50 ? <Banner tone="neutral" icon="map-pin" message={`Akurasi GPS ±${Math.round(akurasi)} m. Nyalakan mode akurasi tinggi dan coba di dekat jendela.`} /> : null}
        </>
      );
      break;
    }
    case 'note_required':
      badan = (
        <>
          <Banner tone="bad" title={konten.judul} message="Tulis catatan lokasi atau aktivitas untuk check-in di luar kantor (WFH/lapangan)." />
          <Field label="Catatan lokasi / aktivitas (wajib untuk WFH)" required counter={`${catatan.length}/500`}>
            <Input value={catatan} onChangeText={setCatatan} placeholder="Mis. rumah, menyusun laporan bulanan" multiline maxLength={500} accessibilityLabel="Catatan lokasi atau aktivitas" />
          </Field>
          <Button title="Kirim ulang" size="lg" disabled={catatan.trim() === ''} loading={mengulang} onPress={() => void kirimUlang(catatan)} />
        </>
      );
      break;
    default:
      badan = (
        <>
          <Banner tone="bad" title={konten.judul} message={g.message} />
          {g.reason === 'jaringan' ? (
            <Button title="Coba lagi" icon="refresh-cw" size="lg" loading={mengulang} onPress={() => void kirimUlang()} />
          ) : g.reason === 'batas' ? (
            <Button title={sisa > 0 ? `Coba lagi dalam ${sisa} dtk` : 'Coba lagi'} size="lg" disabled={sisa > 0} loading={mengulang} onPress={() => void kirimUlang()} />
          ) : g.reason === 'consent_required' ? (
            <Button title="Baca & setujui" icon="shield-check" size="lg" onPress={() => router.replace('/absensi/persetujuan')} />
          ) : g.reason === 'day_has_request' ? (
            <Button title="Lihat pengajuan" variant="tonal" icon="file-text" size="lg" onPress={() => bukaPengajuanTerkait()} />
          ) : h.retryQr || g.reason.startsWith('qr_') ? (
            <Button title="Pindai ulang" icon="qr-code" size="lg" onPress={() => router.replace({ pathname: '/absensi/qr', params: { arah: h.arah } })} />
          ) : null}
          {g.reason !== 'batas' ? <Button title="Kembali ke absensi" variant="outline" size="lg" onPress={onKembali} /> : null}
          {g.reason === 'batas' ? <Button title="Kembali ke absensi" variant="quiet" onPress={onKembali} /> : null}
        </>
      );
  }

  return (
    <Screen header={<SubAppBar title={judulBar} onBack={onKembali} />}>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {tanggalPendek(new Date(h.diterimaPada))} · {jam(new Date(h.diterimaPada))}
      </Text>
      {badan}
    </Screen>
  );
}

const s = StyleSheet.create({
  legenda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 8, flexWrap: 'wrap' },
  chipJarak: { position: 'absolute', width: 64, height: 30, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  namaKantor: { position: 'absolute', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
});
