/**
 * Layar Absen — status hari ini + alur lengkap:
 *  check_in : rencana kerja (poin bernomor, 1–8), selfie, GPS → kirim.
 *  check_out: konfirmasi, selfie, GPS → kirim.
 *  done     : ringkasan hari (jam, durasi, keterlambatan, rencana).
 * Penolakan server (422 {message}) ditampilkan ramah, data form dipertahankan.
 */
import { Ionicons } from '@/ui/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { absensiHariIni, checkIn, checkOut } from '@/api/endpoints';
import type { AttendanceResult, TodayAttendance } from '@/api/types';
import { Badge, Body, Button, Card, CardTitle, Divider, ErrorState, Field, Input, Label, Loading, Meta, Screen } from '@/components/ui';
import { KameraSelfie } from '@/components/KameraSelfie';
import { deviceIdHash } from '@/lib/device';
import { durasiMenit, jam, jarakMeter, sapaan } from '@/lib/format';
import { lokasiSegar, useLokasi, type TitikLokasi } from '@/lib/lokasi';
import { radius, useTheme } from '@/lib/theme';

// ── Bagian kecil ─────────────────────────────────────────────────────────────

function BarisIkon({ icon, teks, warna }: { icon: keyof typeof Ionicons.glyphMap; teks: string; warna?: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={tata.baris}>
      <Ionicons name={icon} size={18} color={warna ?? colors.subtle} />
      <Body muted style={{ flex: 1 }}>{teks}</Body>
    </View>
  );
}

/** Editor rencana kerja: poin bernomor + tambah/hapus, maks 8, wajib ≥1 terisi. */
function RencanaKerja({
  poin,
  ubah,
  tambah,
  hapus,
}: {
  poin: string[];
  ubah: (indeks: number, nilai: string) => void;
  tambah: () => void;
  hapus: (indeks: number) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Rencana kerja hari ini</Label>
        <Meta>1–8 poin</Meta>
      </View>

      {poin.map((poinTeks, indeks) => (
        <View key={indeks} style={tata.poinBaris}>
          <View style={[tata.poinNomor, { backgroundColor: colors.linkSoft }]}>
            <Text style={{ color: colors.link, fontWeight: '700', fontSize: 13 }}>{indeks + 1}</Text>
          </View>
          <Input
            value={poinTeks}
            onChangeText={(nilai) => ubah(indeks, nilai)}
            placeholder={`Poin ${indeks + 1}`}
            maxLength={300}
            multiline
            accessibilityLabel={`Poin rencana kerja ${indeks + 1}`}
            style={{ flex: 1, minHeight: 48, textAlignVertical: 'center' }}
          />
          {poin.length > 1 ? (
            <Pressable
              onPress={() => hapus(indeks)}
              accessibilityRole="button"
              accessibilityLabel={`Hapus poin ${indeks + 1}`}
              hitSlop={6}
              style={tata.poinHapus}
            >
              <Ionicons name="close-circle" size={22} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {poin.length < 8 ? (
        <Pressable
          onPress={tambah}
          accessibilityRole="button"
          accessibilityLabel="Tambah poin rencana kerja"
          style={({ pressed }) => [tata.tambahPoin, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Tambah poin</Text>
        </Pressable>
      ) : (
        <Meta>Maksimal 8 poin rencana kerja.</Meta>
      )}
    </View>
  );
}

function BagianSelfie({ uri, onAmbil, onUlang }: { uri: string | null; onAmbil: () => void; onUlang: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Label>Selfie kehadiran</Label>
      {uri ? (
        <View style={{ gap: 8 }}>
          <Image source={{ uri }} style={tata.selfiePratinjau} resizeMode="cover" accessibilityLabel="Pratinjau selfie" />
          <Button title="Ambil ulang selfie" variant="secondary" icon="camera-outline" onPress={onUlang} />
        </View>
      ) : (
        <Button title="Ambil selfie" icon="camera-outline" onPress={onAmbil} accessibilityHint="Membuka kamera depan" />
      )}
      {!uri ? <Meta>Wajib — dipakai sebagai bukti kehadiran.</Meta> : null}
      <View style={tata.baris}>
        <Ionicons name="information-circle-outline" size={16} color={colors.subtle} />
        <Meta>Foto dikompres otomatis sebelum dikirim.</Meta>
      </View>
    </View>
  );
}

function BagianLokasi({ status, ambil }: { status: ReturnType<typeof useLokasi>['status']; ambil: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Label>Lokasi GPS</Label>
      {status.keadaan === 'siap' ? (
        <View style={[tata.lokasiKotak, { borderColor: colors.success, backgroundColor: colors.successSoft }]}>
          <Ionicons name="location" size={18} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.success, fontWeight: '700', fontSize: 14 }}>Lokasi terkunci</Text>
            <Meta>
              Akurasi ±{jarakMeter(status.titik.accuracy)} · {jam(new Date(status.titik.waktu))}
            </Meta>
          </View>
          <Pressable onPress={ambil} accessibilityRole="button" accessibilityLabel="Perbarui lokasi" hitSlop={6}>
            <Ionicons name="refresh" size={20} color={colors.success} />
          </Pressable>
        </View>
      ) : status.keadaan === 'memuat' ? (
        <View style={[tata.lokasiKotak, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
          <Ionicons name="compass-outline" size={18} color={colors.muted} />
          <Meta>Membaca lokasi GPS…</Meta>
        </View>
      ) : status.keadaan === 'galat' ? (
        <View style={{ gap: 8 }}>
          <View style={[tata.lokasiKotak, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{status.pesan}</Text>
          </View>
          {status.bukaPengaturan ? (
            <Button title="Buka pengaturan" variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} />
          ) : null}
          <Button title="Coba baca lokasi" variant="secondary" icon="refresh" onPress={ambil} />
        </View>
      ) : (
        <Button title="Baca lokasi" icon="location-outline" onPress={ambil} />
      )}
    </View>
  );
}

// ── Layar hasil ──────────────────────────────────────────────────────────────

function LayarHasil({ hasil, selesai }: { hasil: AttendanceResult; selesai: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const masuk = hasil.type === 'check_in';

  return (
    <Screen contentStyle={{ paddingTop: 48 }}>
      <View style={[tahas.hasilLogo, { backgroundColor: colors.successSoft }]}>
        <Ionicons name="checkmark-circle" size={44} color={colors.success} />
      </View>
      <Text style={[tahas.judul, { color: colors.text }]}>
        {masuk ? 'Absen masuk berhasil' : 'Absen pulang berhasil'}
      </Text>
      <Meta>
        {sapaan()} — {jam(hasil.occurredAt)} WIB
      </Meta>

      <Card>
        <CardTitle>{hasil.statusLabel}</CardTitle>
        {hasil.location ? (
          <BarisIkon
            icon="location"
            teks={`${hasil.location.name}${hasil.location.distanceM !== null ? ` · ${jarakMeter(hasil.location.distanceM)} dari titik` : ''}${hasil.location.inside ? ' · di dalam area' : ' · di luar area'}`}
            warna={hasil.location.inside ? colors.success : colors.warning}
          />
        ) : (
          <BarisIkon icon="location-outline" teks={hasil.methodLabel} />
        )}
        {hasil.lateMinutes > 0 ? (
          <BarisIkon icon="time" teks={`Terlambat ${durasiMenit(hasil.lateMinutes)}`} warna={colors.warning} />
        ) : hasil.minutesBeforeStart !== null && hasil.minutesBeforeStart > 0 ? (
          <BarisIkon icon="time" teks={`${hasil.minutesBeforeStart} menit lebih awal dari jadwal`} warna={colors.success} />
        ) : null}
        {masuk && hasil.shift ? <BarisIkon icon="calendar-outline" teks={`Shift ${hasil.shift.name} · ${hasil.shift.hours}`} /> : null}
      </Card>

      <Button title="Selesai" onPress={selesai} />
    </Screen>
  );
}

// ── Ringkasan hari (done) ────────────────────────────────────────────────────

function RingkasanHari({ data }: { data: TodayAttendance }): React.JSX.Element {
  const { colors } = useTheme();
  const { day, schedule } = data.today;

  return (
    <Card>
      <View style={tata.barisAntara}>
        <CardTitle>Hari ini</CardTitle>
        <Badge tone="success">{day?.statusLabel ?? 'Selesai'}</Badge>
      </View>
      <BarisIkon icon="log-in-outline" teks={`Masuk ${jam(day?.checkInAt ?? null)}${day?.checkIn?.locationName ? ` · ${day.checkIn.locationName}` : ''}`} warna={colors.success} />
      <BarisIkon icon="log-out-outline" teks={`Pulang ${jam(day?.checkOutAt ?? null)}${day?.checkOutAt ? '' : ' — belum'}`} warna={day?.checkOutAt ? colors.danger : colors.subtle} />
      <BarisIkon icon="time-outline" teks={`Kerja ${durasiMenit(day?.workMinutes ?? null)}`} />
      {day && day.lateMinutes > 0 ? <BarisIkon icon="alert-circle-outline" teks={`Terlambat ${durasiMenit(day.lateMinutes)}`} warna={colors.warning} /> : null}
      {schedule.shiftName ? <BarisIkon icon="calendar-outline" teks={`Shift ${schedule.shiftName} · ${schedule.hours ?? ''}`} /> : null}

      {day?.workPlan && day.workPlan.length > 0 ? (
        <View style={{ gap: 6, marginTop: 4 }}>
          <Divider />
          <Label>Rencana kerja</Label>
          {day.workPlan.map((poin, indeks) => (
            <View key={indeks} style={tata.baris}>
              <View style={[tata.poinNomor, { backgroundColor: colors.linkSoft }]}>
                <Text style={{ color: colors.link, fontWeight: '700', fontSize: 12 }}>{indeks + 1}</Text>
              </View>
              <Body muted style={{ flex: 1 }}>{poin}</Body>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

// ── Layar utama ──────────────────────────────────────────────────────────────

export default function LayarAbsen(): React.JSX.Element {
  const { colors } = useTheme();
  const { status: statusLokasi, ambil: ambilLokasi, reset: resetLokasi } = useLokasi();

  const [data, setData] = useState<TodayAttendance | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Formulir
  const [poin, setPoin] = useState<string[]>(['']);
  const [catatan, setCatatan] = useState('');
  const [selfie, setSelfie] = useState<string | null>(null);
  const [kameraBuka, setKameraBuka] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [galatKirim, setGalatKirim] = useState<string | null>(null);
  const [hasil, setHasil] = useState<AttendanceResult | null>(null);
  // Synchronous lock: state updates are async, so a fast double tap could submit twice.
  const kunciKirim = useRef(false);

  const titik: TitikLokasi | null = statusLokasi.keadaan === 'siap' ? statusLokasi.titik : null;

  const muat = useCallback(async (diam = false): Promise<void> => {
    if (!diam) {
      setMemuat(true);
    }
    setGalat(null);
    try {
      const hasilMuat = await absensiHariIni();
      setData(hasilMuat);
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat status absensi.');
    } finally {
      setMemuat(false);
      setMenyegarkan(false);
    }
  }, []);

  // Muat ulang setiap kali tab dibuka (status bisa berubah dari Beranda/hasil).
  useFocusEffect(
    useCallback(() => {
      void muat();
      // Release the camera when the tab loses focus (the tab stays mounted).
      return () => setKameraBuka(false);
    }, [muat]),
  );

  // Hardware back while the camera is open closes the camera, not the tab.
  useEffect(() => {
    if (!kameraBuka) {
      return;
    }
    const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
      setKameraBuka(false);
      return true;
    });
    return () => langganan.remove();
  }, [kameraBuka]);

  const aksi = data?.today.action;

  const poinValid = poin.filter((p) => p.trim() !== '');
  const bisaKirim =
    !mengirim && selfie !== null && titik !== null && (aksi !== 'check_in' || poinValid.length >= 1);

  async function kirim(): Promise<void> {
    if (!bisaKirim || !titik || kunciKirim.current) {
      return;
    }
    kunciKirim.current = true;
    setMengirim(true);
    setGalatKirim(null);
    try {
      // The tab stays mounted, so a fix read long ago (e.g. at check-in) must not be reused.
      const lokasi = lokasiSegar(titik) ? titik : await ambilLokasi();
      if (!lokasi) {
        setGalatKirim('Lokasi perlu dibaca ulang sebelum dikirim. Coba baca lokasi lagi.');
        return;
      }
      const hasilKirim =
        aksi === 'check_in'
          ? await checkIn({
              latitude: lokasi.latitude,
              longitude: lokasi.longitude,
              accuracy: lokasi.accuracy,
              selfieUri: selfie ?? '',
              deviceIdHash: await deviceIdHash(),
              note: catatan,
              workPlan: poinValid,
            })
          : await checkOut({
              latitude: lokasi.latitude,
              longitude: lokasi.longitude,
              accuracy: lokasi.accuracy,
              selfieUri: selfie ?? '',
              deviceIdHash: await deviceIdHash(),
              note: catatan,
            });

      setHasil(hasilKirim);
      setSelfie(null);
      resetLokasi();
      setPoin(['']);
      setCatatan('');
    } catch (err) {
      if (err instanceof ApiError) {
        setGalatKirim(err.firstValidationError ?? err.message);
      } else {
        setGalatKirim('Gagal mengirim. Periksa koneksi Anda lalu coba lagi.');
      }
    } finally {
      kunciKirim.current = false;
      setMengirim(false);
    }
  }

  if (kameraBuka) {
    return (
      <KameraSelfie
        onSelesai={(uri) => {
          setSelfie(uri);
          setKameraBuka(false);
        }}
        onBatal={() => setKameraBuka(false)}
      />
    );
  }

  if (hasil) {
    return <LayarHasil hasil={hasil} selesai={() => { setHasil(null); void muat(); }} />;
  }

  return (
    <Screen
      refreshing={menyegarkan}
      onRefresh={() => {
        setMenyegarkan(true);
        void muat(true);
      }}
    >
      <Text style={[tata.judulLayar, { color: colors.text }]}>Absen</Text>

      {memuat && !data ? (
        <Loading label="Memuat status hari ini…" />
      ) : galat && !data ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : data ? (
        <>
          {aksi === 'unavailable' ? (
            <Card>
              <View style={tata.barisAntara}>
                <CardTitle>Absen tidak tersedia</CardTitle>
                <Ionicons name="ban-outline" size={22} color={colors.subtle} />
              </View>
              <Body muted>
                {data.today.schedule.isWorkday
                  ? 'Hari ini tidak bisa absen lewat aplikasi (mis. hari libur khusus atau penyesuaian absensi). Hubungi HR bila ini keliru.'
                  : `Hari ini bukan hari kerja${data.today.schedule.holidayName ? ` — ${data.today.schedule.holidayName}` : ''}.`}
              </Body>
            </Card>
          ) : null}

          {aksi === 'done' ? <RingkasanHari data={data} /> : null}

          {(aksi === 'check_in' || aksi === 'check_out') && (
            <Card style={{ gap: 14 }}>
              <View style={tata.barisAntara}>
                <CardTitle>{aksi === 'check_in' ? 'Absen masuk' : 'Absen pulang'}</CardTitle>
                <Badge tone="primary">{data.today.schedule.workModeLabel}</Badge>
              </View>

              {aksi === 'check_in' ? (
                <>
                  <Meta>
                    {data.today.schedule.isWorkday && data.today.schedule.start
                      ? `Jadwal ${jam(data.today.schedule.start)}–${jam(data.today.schedule.end)} · lokasi terdekat dicek server`
                      : 'Lokasi dicek server saat pengiriman.'}
                  </Meta>
                  {data.today.locations.length > 0 ? (
                    <View style={{ gap: 4 }}>
                      <Label>Lokasi diizinkan</Label>
                      {data.today.locations.map((lok) => (
                        <BarisIkon
                          key={lok.id}
                          icon="business-outline"
                          teks={`${lok.name} · radius ${jarakMeter(lok.radiusM)}${data.today.schedule.allowsRemote ? ' · atau WFH' : ''}`}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <BarisIkon
                  icon="log-in-outline"
                  teks={`Masuk tadi ${jam(data.today.day?.checkInAt ?? null)}${data.today.day?.checkIn?.locationName ? ` di ${data.today.day.checkIn.locationName}` : ''}`}
                  warna={colors.success}
                />
              )}

              <Divider />

              {aksi === 'check_in' ? (
                <RencanaKerja
                  poin={poin}
                  ubah={(indeks, nilai) =>
                    setPoin((lama) => lama.map((p, i) => (i === indeks ? nilai : p)))
                  }
                  tambah={() => setPoin((lama) => (lama.length < 8 ? [...lama, ''] : lama))}
                  hapus={(indeks) => setPoin((lama) => lama.filter((_, i) => i !== indeks))}
                />
              ) : null}

              <BagianSelfie
                uri={selfie}
                onAmbil={() => setKameraBuka(true)}
                onUlang={() => setKameraBuka(true)}
              />

              <BagianLokasi status={statusLokasi} ambil={() => void ambilLokasi()} />

              <Field label="Catatan (opsional)">
                <Input
                  value={catatan}
                  onChangeText={setCatatan}
                  placeholder="Catatan untuk HR, maks. 500 karakter"
                  multiline
                  maxLength={500}
                  accessibilityLabel="Catatan absen"
                />
              </Field>

              {galatKirim ? (
                <View style={[tata.galatKotak, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }]}>
                  <Ionicons name="alert-circle" size={20} color={colors.danger} />
                  <Text style={{ color: colors.danger, flex: 1, fontSize: 14, lineHeight: 20 }}>{galatKirim}</Text>
                </View>
              ) : null}

              <Button
                title={mengirim ? 'Mengirim…' : aksi === 'check_in' ? 'Kirim absen masuk' : 'Kirim absen pulang'}
                onPress={() => void kirim()}
                disabled={!bisaKirim}
                loading={mengirim}
                icon="finger-print"
              />
              {!bisaKirim && !mengirim ? (
                <Meta>
                  {selfie === null
                    ? 'Lengkapi selfie'
                    : titik === null
                      ? 'Tunggu lokasi terkunci'
                      : aksi === 'check_in' && poinValid.length === 0
                        ? 'Isi minimal satu poin rencana kerja'
                        : 'Siap dikirim'}
                  .
                </Meta>
              ) : null}
            </Card>
          )}

          {aksi !== 'done' && data.today.day ? <RingkasanHari data={data} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

// ── Gaya ─────────────────────────────────────────────────────────────────────

const tata = StyleSheet.create({
  judulLayar: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barisAntara: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  poinBaris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  poinNomor: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  poinHapus: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  tambahPoin: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selfiePratinjau: { width: '100%', height: 280, borderRadius: radius.md },
  lokasiKotak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  galatKotak: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: radius.md, padding: 12 },
});

const tahas = StyleSheet.create({
  hasilLogo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 24,
  },
  judul: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8 },
});
