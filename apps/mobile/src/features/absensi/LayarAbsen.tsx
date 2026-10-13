/**
 * Layar Absen (tab tengah). Satu layar memuat status hari, peta lokasi, metode
 * (GPS + selfie · QR · WFH), rencana kerja, selfie, catatan, prasyarat, dan
 * dock "geser untuk check-in/out" yang menempel di atas tab bar. Semua keadaan
 * hari datang dari `state.code` (docs/sesi/ponsel-b2a-absensi.md §2).
 * Mockup: docs/mockups/android/screens/03-absensi/{01..07,12,17,19}.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Keyboard, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { absensiHariIniLengkap, type HariIni, type KeadaanAbsen } from '@/api/absensi';
import { useSession } from '@/session/SessionProvider';
import { useUnread } from '@/session/UnreadProvider';
import { jam, tanggalPanjang } from '@/lib/format';
import { radius } from '@/theme';
import {
  AppBar,
  Banner,
  Button,
  Card,
  ErrorState,
  Field,
  Glass,
  IconTile,
  Input,
  ListRow,
  Pressable,
  Screen,
  SegmentedTabs,
  Skeleton,
  Text,
  errorKindFromStatus,
  useAttendanceStatus,
  useDialog,
  useSnackbar,
  useTabBarSpace,
} from '@/ui';

import { KartuJam } from './KartuJam';
import { KartuLokasi } from './KartuLokasi';
import { DaftarPrasyarat, KartuSelfie, SheetPesanWa, type StatusSyarat } from './KartuKecil';
import { KartuJendelaTutup, KartuSedangBekerja, KartuSelesai, KartuTidakTersedia, RencanaBacaSaja } from './KeadaanKartu';
import { GalatLokasi, PeringatanDini } from './PeringatanLokasi';
import { RencanaKerja } from './RencanaKerja';
import { SwipeToConfirm } from './SwipeToConfirm';
import { lokasiTerdekat } from './geo';
import { fasePulang, labelPulangTertutup } from './jendela';
import { jalankanPermintaan } from './kirim';
import { lokasiPesan, susunPesanWa } from './pesanWa';
import { absenStore, useAbsenStore, type InfoJadwal, type Metode } from './store';
import { titikSegar, useLokasiAbsen, type TitikGps } from './useLokasiAbsen';
import { SKEW_TANDAI_MS, hitungOffset, menitAntara, useJamServer } from './waktu';
import { bukaDinasLuar, bukaKoreksiHari } from './koreksi';

const OPSI_METODE: { value: Metode; label: string }[] = [
  { value: 'gps', label: 'GPS + selfie' },
  { value: 'qr', label: 'QR' },
  { value: 'wfh', label: 'WFH' },
];

/** Tinggi papan ketik (px layout, 0 = tersembunyi). */
function useKeyboardTinggi(): number {
  const [tinggi, setTinggi] = useState(0);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', (e) => setTinggi(Math.max(e.endCoordinates.height, Dimensions.get('screen').height - e.endCoordinates.screenY)));
    const b = Keyboard.addListener('keyboardDidHide', () => setTinggi(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return tinggi;
}

/** Dock di atas tab bar (atau papan ketik): aksi final + petunjuk satu baris. */
function Dock({ children, hint, keyboard }: { children: React.ReactNode; hint?: React.ReactNode; keyboard: number }): React.JSX.Element {
  const ruangTab = useTabBarSpace();
  return (
    <Glass
      strong
      style={[s.dock, keyboard > 0 ? { bottom: keyboard, left: 0, right: 0, borderRadius: 0 } : { bottom: ruangTab + 8, left: 12, right: 12, borderRadius: radius['2xl'] }]}
    >
      {children}
      {hint}
    </Glass>
  );
}

export function LayarAbsen(): React.JSX.Element {
  const { user } = useSession();
  const { jumlah } = useUnread();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { terapkan, center: pusat } = useAttendanceStatus();
  const ruangTab = useTabBarSpace();
  const tinggiKeyboard = useKeyboardTinggi();
  const keyboard = tinggiKeyboard > 0;
  const st = useAbsenStore();
  const lokasi = useLokasiAbsen();

  const [data, setData] = useState<HariIni | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<ApiError | string | null>(null);
  const [offline, setOffline] = useState(false);
  const [fase, setFase] = useState<'diam' | 'lokasi' | 'kirim'>('diam');
  const [sheetPesan, setSheetPesan] = useState(false);
  const [tundaIzin, setTundaIzin] = useState(false);
  const kunciKirim = useRef(false);
  const sudahPilihMetode = useRef(false);
  const dataAda = useRef(false);

  const offsetMs = useMemo(() => hitungOffset(data?.serverTime), [data?.serverTime]);
  const sekarang = useJamServer(offsetMs);
  const state = data?.state ?? null;
  // Jam pulang perusahaan tertutup: `sebelum` (belum dibuka) atau `sesudah` (sudah ditutup).
  const tutupPulang = state ? fasePulang(state, sekarang) : null;
  const windowsBerlaku = data?.today.windowsApply !== false;

  const muat = useCallback(
    async (diam: boolean): Promise<void> => {
      if (!diam) {
        setMemuat(true);
      }
      setGalat(null);
      try {
        const hasil = await absensiHariIniLengkap();
        setData(hasil);
        setOffline(false);
        dataAda.current = true;
        terapkan(hasil);
        if (hasil.state) {
          absenStore.setJadwal(infoJadwal(hasil.state));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          setOffline(true);
        }
        // Data lama tetap tampil; galat penuh hanya bila belum pernah berhasil.
        if (!dataAda.current) {
          setGalat(err instanceof ApiError ? err : 'Tidak dapat memuat status absensi.');
        }
      } finally {
        setMemuat(false);
        setMenyegarkan(false);
      }
    },
    [terapkan],
  );

  useFocusEffect(
    useCallback(() => {
      absenStore.ikatPengguna(user?.id ?? null);
      void muat(dataAda.current);
    }, [muat, user?.id]),
  );

  // Hari WFH/dinas: mulai dari segmen WFH sekali (pengguna tetap bebas memilih).
  useEffect(() => {
    if (state && state.isRemote && !sudahPilihMetode.current && st.metode === 'gps') {
      sudahPilihMetode.current = true;
      absenStore.setMetode('wfh');
    }
  }, [state, st.metode]);

  const arah = state?.code === 'checked_in' ? 'pulang' : 'masuk';
  const tampilForm = state !== null && (state.code === 'not_checked_in' || state.code === 'too_early' || state.code === 'no_office_location' || (state.code === 'checked_in' && tutupPulang !== 'sesudah' && (pusat === 'absen' || st.pulangAwal)));
  const metode = st.metode;
  const konsenOk = state?.consent.granted === true;

  // Baca lokasi saat form tampil dan fix sudah basi (tanpa dialog izin; dialog hanya lewat "Lanjut").
  const { ambil: ambilLokasi } = lokasi;
  const titikRef = useRef<TitikGps | null>(null);
  const titikSiapSekarang = lokasi.status.keadaan === 'siap' ? lokasi.status.titik : null;
  useEffect(() => {
    titikRef.current = titikSiapSekarang;
  }, [titikSiapSekarang]);
  useFocusEffect(
    useCallback(() => {
      if (!tampilForm) {
        return;
      }
      const paksa = absenStore.get().segarkanLokasi;
      absenStore.mintaSegarkanLokasi(false);
      if (paksa || !titikSegar(titikRef.current)) {
        void ambilLokasi();
      }
    }, [tampilForm, ambilLokasi]),
  );

  const titik: TitikGps | null = lokasi.status.keadaan === 'siap' ? lokasi.status.titik : null;
  const terdekat = useMemo(() => (titik && data ? lokasiTerdekat(titik.latitude, titik.longitude, data.today.locations) : null), [titik, data]);
  const jarakJauh = state?.isRemote === true;
  const luarRadius = metode === 'gps' && terdekat && !terdekat.dalam && !jarakJauh;
  const skewMs = data ? Math.abs(offsetMs) : 0;
  const skewMenit = skewMs > SKEW_TANDAI_MS ? Math.round(skewMs / 60_000) : null;

  const poinValid = st.poin.map((p) => p.teks.trim()).filter((t) => t !== '');
  const wajibCatatan = metode === 'wfh' || (jarakJauh && terdekat !== null && !terdekat.dalam);
  const catatanOk = !wajibCatatan || st.catatan.trim() !== '';
  const laporanValid = st.laporan.map((p) => p.teks.trim()).filter((t) => t !== '');
  const rencanaOk = arah === 'pulang' || poinValid.length >= 1;
  const laporanOk = arah === 'masuk' || metode === 'qr' || laporanValid.length >= 1;
  const isianOk = arah === 'masuk' ? rencanaOk : laporanOk;
  const selfieOk = st.selfie !== null;
  const titikOk = titik !== null && lokasi.status.keadaan === 'siap';

  const syarat: { status: StatusSyarat; teks: string }[] = [];
  if (state) {
    syarat.push({ status: konsenOk ? 'ok' : 'gagal', teks: konsenOk ? `Persetujuan lokasi & selfie (v${state.consent.version})` : 'Persetujuan lokasi & selfie belum diberikan' });
    syarat.push(
      titikOk && titik
        ? {
            status: 'ok',
            teks: `Lokasi terkunci${titik.accuracy !== null ? ` · ±${Math.round(titik.accuracy)} m` : ''}${terdekat ? (terdekat.dalam ? ' · dalam radius' : jarakJauh ? ' · di luar kantor' : ' · di luar radius') : ''}`,
          }
        : { status: lokasi.status.keadaan === 'memuat' ? 'belum' : 'gagal', teks: lokasi.status.keadaan === 'memuat' ? 'Lokasi: membaca GPS…' : 'Lokasi: belum terbaca' },
    );
    if (arah === 'masuk') {
      syarat.push({ status: rencanaOk ? 'ok' : 'gagal', teks: rencanaOk ? `Rencana kerja: ${poinValid.length} poin` : 'Rencana kerja: tulis minimal satu poin' });
    }
    if (arah === 'pulang') {
      syarat.push({ status: laporanOk ? 'ok' : 'gagal', teks: laporanOk ? `Laporan kerja: ${laporanValid.length} poin` : 'Laporan kerja: tulis minimal satu poin' });
    }
    if (wajibCatatan) {
      syarat.push({ status: catatanOk ? 'ok' : 'gagal', teks: catatanOk ? 'Catatan lokasi / aktivitas terisi' : 'Catatan lokasi / aktivitas: wajib untuk WFH' });
    }
    syarat.push({ status: selfieOk ? 'ok' : 'belum', teks: selfieOk ? 'Selfie siap dikirim' : 'Selfie: belum diambil' });
  }
  const kurang = syarat.filter((b) => b.status !== 'ok').length;

  // Alasan geser terkunci (urut prioritas) + petunjuk di bawahnya.
  let kunci: { label: string; hint: string } | null = null;
  if (offline) {
    kunci = { label: 'Butuh koneksi internet', hint: 'Versi 1 menolak check-in tanpa koneksi — sama seperti web/PWA. Isian Anda tetap tersimpan.' };
  } else if (state?.code === 'too_early') {
    kunci = { label: `Dibuka pukul ${jam(state.windowOpensAt)}`, hint: state.message || 'Check-in belum bisa dikirim.' };
  } else if (state && tutupPulang === 'sebelum') {
    kunci = { label: labelPulangTertutup(state, 'sebelum'), hint: state.checkOutBlockedReason ?? 'Check-out belum bisa dikirim.' };
  } else if (!konsenOk) {
    kunci = { label: 'Setujui kebijakan dulu', hint: 'Persetujuan dicabut atau belum diberikan.' };
  } else if (lokasi.status.keadaan === 'galat' && lokasi.status.jenis === 'perkiraan') {
    kunci = { label: 'Butuh lokasi tepat', hint: 'Check-in dikirim setelah lokasi tepat terbaca.' };
  } else if (lokasi.status.keadaan === 'galat') {
    kunci = { label: 'Butuh lokasi', hint: 'Izinkan dan baca lokasi untuk melanjutkan.' };
  } else if (kurang > 0) {
    kunci = {
      label: `Lengkapi dulu ${kurang} langkah`,
      hint: !selfieOk && !isianOk ? `Tombol aktif setelah ${arah === 'masuk' ? 'rencana' : 'laporan'} kerja & selfie siap.` : !selfieOk ? 'Tombol aktif setelah selfie siap.' : !isianOk ? `Tombol aktif setelah ${arah === 'masuk' ? 'rencana' : 'laporan'} kerja diisi.` : !catatanOk ? 'Tulis catatan lokasi / aktivitas untuk WFH.' : 'Tunggu lokasi terkunci.',
    };
  }

  const petunjukSiap = (() => {
    if (titik?.mocked) return 'Dikirim dengan penanda lokasi palsu.';
    if (titik?.accuracy !== null && titik !== null && (titik.accuracy ?? 0) > 100) return 'Dikirim dengan penanda "Akurasi GPS rendah".';
    if (skewMenit !== null) return 'Dikirim dengan penanda jam perangkat tidak sesuai.';
    if (st.selfie?.gelap) return 'Dikirim dengan penanda foto gelap.';
    return arah === 'pulang' && state?.scheduledEnd
      ? `Pulang ${jam(sekarang)} · ${Date.parse(state.scheduledEnd) <= sekarang.getTime() ? 'tepat jadwal' : 'sebelum jadwal'}`
      : 'Lokasi dan foto hanya direkam saat check-in dan check-out';
  })();

  const kirimSekarang = useCallback(async (): Promise<void> => {
    if (kunciKirim.current || !state || !data) {
      return;
    }
    kunciKirim.current = true;
    try {
      // Pulang lebih awal: konfirmasi dulu.
      if (arah === 'pulang' && state.scheduledEnd) {
        const selisih = Math.ceil((Date.parse(state.scheduledEnd) - sekarang.getTime()) / 60_000);
        if (selisih >= 1) {
          const ya = await dialog.confirm({
            title: 'Pulang lebih awal?',
            message: `Jadwal pulang Anda ${jam(state.scheduledEnd)}. Check-out sekarang (${jam(sekarang)}) tercatat pulang cepat ${selisih} menit dan terlihat oleh atasan serta HR.`,
            confirmLabel: 'Tetap check-out',
            cancelLabel: 'Batal',
          });
          if (!ya) {
            return;
          }
        }
      }

      // Fix lama (> 2 menit) dibaca ulang tepat sebelum dikirim.
      setFase('lokasi');
      const fix = titikSegar(titik) ? titik : await lokasi.ambil();
      if (!fix) {
        snackbar.show({ message: 'Lokasi perlu dibaca ulang sebelum dikirim. Coba lagi.', variant: 'warn' });
        return;
      }
      const selfie = absenStore.get().selfie;
      if (!selfie) {
        return;
      }
      setFase('kirim');
      const dekat = lokasiTerdekat(fix.latitude, fix.longitude, data.today.locations);
      const ok = await jalankanPermintaan(
        {
          arah,
          metode,
          titik: { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, mocked: fix.mocked },
          selfieUri: selfie.uri,
          catatan: st.catatan,
          workPlan: arah === 'masuk' ? poinValid : [],
          workReport: arah === 'pulang' ? laporanValid : [],
          jarakM: dekat?.jarakM ?? null,
        },
        infoJadwal(state),
      );
      const hasil = absenStore.get().hasil;
      if (!ok && hasil?.jenis === 'gagal' && hasil.gagal.status === 0) {
        setOffline(true);
      }
      lokasi.reset();
      router.push('/absensi/hasil');
    } finally {
      kunciKirim.current = false;
      setFase('diam');
    }
  }, [arah, data, dialog, laporanValid, lokasi, metode, poinValid, sekarang, snackbar, st.catatan, state, titik]);

  function bukaPemindai(a: 'masuk' | 'pulang'): void {
    router.push({ pathname: '/absensi/qr', params: { arah: a } });
  }
  function bukaSelfie(a: 'masuk' | 'pulang'): void {
    const k = terdekat?.lokasi;
    router.push({
      pathname: '/absensi/selfie',
      params: {
        judul: a === 'masuk' ? 'Selfie check-in' : 'Selfie check-out',
        jadwal: data?.today.schedule.shiftName && data.today.schedule.start ? `Shift ${data.today.schedule.shiftName} · ${a === 'masuk' ? 'masuk' : 'pulang'} ${jam(a === 'masuk' ? data.today.schedule.start : data.today.schedule.end)}` : '',
        jam: jam(sekarang),
        lokasi: terdekat && k ? `${k.name} · ${Math.round(terdekat.jarakM)} m · ${terdekat.dalam ? 'dalam radius' : 'luar radius'}` : '',
        qr: '1',
      },
    });
  }
  function bukaKoreksi(): void {
    bukaKoreksiHari();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const aksiAppBar = [
    { icon: 'history' as const, label: 'Riwayat absensi', onPress: () => router.push('/absensi/riwayat') },
    { icon: 'bell' as const, label: 'Notifikasi', onPress: () => router.push('/inbox'), badge: jumlah > 0 ? jumlah : undefined },
  ];
  const overline = tanggalPanjang(sekarang).replace(/\s\d{4}$/, '');

  const kepala = <AppBar overline={overline} title="Absen" actions={aksiAppBar} />;

  let isi: React.ReactNode;
  let dock: React.ReactNode = null;

  if (memuat && !data) {
    isi = (
      <>
        {kepala}
        <Card style={{ gap: 12 }}>
          <Skeleton width="40%" height={14} radiusPx={7} />
          <Skeleton width="55%" height={44} />
          <Skeleton width="85%" height={16} radiusPx={8} />
        </Card>
        <Skeleton height={190} radiusPx={24} />
        <Skeleton height={44} radiusPx={14} />
        <Skeleton height={160} radiusPx={24} />
      </>
    );
  } else if (galat && !data) {
    const status = galat instanceof ApiError ? galat.status : -1;
    isi = (
      <>
        {kepala}
        <ErrorState
          kind={errorKindFromStatus(status)}
          title="Tidak dapat memuat status absensi"
          message={status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi. Data absen Anda aman di server.' : typeof galat === 'string' ? galat : galat.message}
          onRetry={() => void muat(false)}
        />
      </>
    );
  } else if (data && !state) {
    // Server lama tanpa `state`: tidak ada keadaan terperinci — arahkan perbarui.
    isi = (
      <>
        {kepala}
        <ErrorState title="Status absensi belum lengkap" message="Server belum mengirim status hari ini. Tarik layar untuk memuat ulang atau perbarui aplikasi." onRetry={() => void muat(false)} />
      </>
    );
  } else if (data && state) {
    const jam0 = jamAbsenKembali(state);
    const bukanForm = !tampilForm;
    const lokasiKantor = terdekat?.lokasi ?? data.today.locations[0] ?? null;

    const pesanWa = susunPesanWa({
      arah,
      nama: user?.name ?? 'Anda',
      waktu: sekarang,
      lokasi: lokasiPesan({ dalam: terdekat?.dalam === true, namaKantor: lokasiKantor?.name ?? null, jarakJauh: jarakJauh || metode === 'wfh', catatan: st.catatan, jarakM: terdekat?.jarakM ?? null }),
      poin: metode === 'qr' ? [] : arah === 'masuk' ? poinValid : laporanValid,
      durasiKerjaMenit: state.checkedInAt ? Math.max(0, menitAntara(state.checkedInAt, sekarang)) : null,
    });

    isi = (
      <>
        {kepala}
        {offline ? <Banner tone="warn" icon="wifi-off" title="Tidak ada koneksi internet" message="Check-in butuh koneksi. Isi form tetap tersimpan, kirim setelah sinyal kembali." /> : null}
        {state.request && !state.request.blocksCheckIn ? (
          <Banner tone="info" icon="file-check" message={`Hari ini ada ${state.request.statusLabel}${state.request.portion === 'half_day' ? ' (setengah hari)' : ''} yang disetujui. Check-in tetap bisa dilakukan.`} />
        ) : null}

        {state.code === 'checked_out' ? <KartuSelesai data={data} state={state} /> : null}
        {state.code === 'day_has_request' || state.code === 'holiday' || state.code === 'non_working_day' ? <KartuTidakTersedia state={state} data={data} /> : null}
        {state.code === 'window_closed' ? (
          <>
            <KartuJam state={state} schedule={data.today.schedule} sekarang={sekarang} windowsApply={windowsBerlaku} />
            <KartuJendelaTutup state={state} />
          </>
        ) : null}
        {state.code === 'checked_in' && bukanForm ? (
          <KartuSedangBekerja
            state={state}
            data={data}
            sekarang={sekarang}
            jamAbsenKembali={pusat === 'workspace' ? jam0 : null}
            onPulangAwal={() => absenStore.setPulangAwal(true)}
            fasePulang={tutupPulang}
          />
        ) : null}

        {tampilForm ? (
          <>
            <KartuJam state={state} schedule={data.today.schedule} sekarang={sekarang} windowsApply={windowsBerlaku} />

            {tutupPulang === 'sebelum' ? <Banner tone="warn" icon="clock-alert" title={labelPulangTertutup(state, 'sebelum')} message={state.checkOutBlockedReason ?? ''} /> : null}

            {state.code === 'no_office_location' ? (
              <Banner tone="warn" icon="map-pin-off" title="Lokasi kantor belum diatur" message="Belum ada lokasi kantor aktif untuk check-in GPS. Hubungi HR untuk mengatur lokasi kantor." />
            ) : (
              <KartuLokasi status={lokasi.status} kantor={lokasiKantor} jarakM={terdekat?.jarakM ?? null} dalam={terdekat?.dalam === true} jarakJauh={jarakJauh} onRefresh={() => void lokasi.ambil({ minta: true })} />
            )}

            <SegmentedTabs value={metode} options={OPSI_METODE} onChange={(v) => { sudahPilihMetode.current = true; absenStore.setMetode(v); }} />

            {state.code === 'no_office_location' && metode !== 'qr' ? (
              <Card style={{ gap: 4 }} variant="flat">
                <Text variant="title" weight={700} style={{ padding: 16, paddingBottom: 4 }}>
                  Yang masih bisa dilakukan
                </Text>
                <ListRow icon="qr-code" iconTone="teal" title="Pindai QR di kiosk lobi" subtitle="Tanpa selfie · tetap tercatat" onPress={() => bukaPemindai(arah)} />
                <ListRow divider icon="clipboard-pen-line" iconTone="blue" title="Ajukan koreksi absensi ke HR" subtitle="HR memasukkan jam manual" onPress={bukaKoreksi} />
              </Card>
            ) : null}

            {metode === 'wfh' && !state.isRemote ? (
              <Card style={{ gap: 12 }}>
                <View style={s.baris}>
                  <IconTile icon="house" tone="warn" />
                  <Text variant="title" weight={700} style={{ flex: 1 }}>
                    WFH tidak tersedia hari ini
                  </Text>
                </View>
                <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
                  Jadwal Anda hari ini di kantor. Bila bertugas di luar, ajukan dinas luar atau minta HR mengubah jadwal.
                </Text>
                <ListRow icon="briefcase-business" iconTone="blue" title="Ajukan dinas luar" subtitle="Pengajuan ke atasan langsung" onPress={bukaDinasLuar} />
                <ListRow icon="clipboard-pen-line" iconTone="teal" title="Ajukan koreksi absensi" subtitle="Bila sudah telanjur masuk dari luar" onPress={bukaKoreksi} />
              </Card>
            ) : null}

            {!(metode === 'wfh' && !state.isRemote) && (metode === 'qr' || state.code !== 'no_office_location') ? (
              <>
                <GalatLokasi
                  status={lokasi.status}
                  qr={metode === 'qr'}
                  onMinta={() => void lokasi.ambil({ minta: true })}
                  onCoba={() => void lokasi.ambil({ minta: true })}
                  onAktifkan={() => void lokasi.aktifkanLayanan()}
                  ditunda={tundaIzin}
                  onNanti={() => setTundaIzin(true)}
                />
                {metode !== 'qr' && konsenOk ? (
                  <PeringatanDini
                    akurasi={titik?.accuracy ?? null}
                    mocked={titik?.mocked === true}
                    skewMenit={skewMenit}
                    luarRadius={luarRadius && terdekat ? { jarakM: terdekat.jarakM, radiusM: terdekat.lokasi.radiusM, nama: terdekat.lokasi.name } : null}
                  />
                ) : null}

                {metode === 'qr' ? (
                  <Card style={{ gap: 10 }}>
                    <View style={s.baris}>
                      <IconTile icon="qr-code" tone="teal" />
                      <Text variant="title" weight={700} style={{ flex: 1 }}>
                        Pindai QR di lobi
                      </Text>
                    </View>
                    <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
                      Arahkan kamera belakang ke layar kiosk. Kode berganti tiap 30 detik, jadi foto kode tidak berlaku.
                    </Text>
                    <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                      Tanpa selfie. Lokasi GPS ikut dikirim bila diizinkan; QR tanpa GPS ditandai untuk ditinjau HR.
                    </Text>
                  </Card>
                ) : !konsenOk ? (
                  <KonsenDibutuhkan perbarui={state.consent.needsRenewal} versi={state.consent.version} />
                ) : (
                  <>
                    {arah === 'masuk' ? (
                      <RencanaKerja
                        poin={st.poin}
                        ubah={absenStore.ubahPoin}
                        tambah={absenStore.tambahPoin}
                        hapus={absenStore.hapusPoin}
                        onLihatPesan={() => setSheetPesan(true)}
                        disabled={fase !== 'diam'}
                      />
                    ) : (
                      <>
                        {(data.today.day?.workPlan?.length ?? 0) > 0 ? (
                          <Card>
                            <RencanaBacaSaja poin={data.today.day?.workPlan ?? []} judul="Rencana kerja pagi tadi" />
                          </Card>
                        ) : null}
                        <RencanaKerja
                          jenis="laporan"
                          poin={st.laporan}
                          ubah={absenStore.ubahLaporan}
                          tambah={absenStore.tambahLaporan}
                          hapus={absenStore.hapusLaporan}
                          onLihatPesan={() => setSheetPesan(true)}
                          disabled={fase !== 'diam'}
                        />
                      </>
                    )}
                    <KartuSelfie selfie={st.selfie} judul={arah === 'masuk' ? 'Selfie check-in' : 'Selfie check-out'} onAmbil={() => bukaSelfie(arah)} disabled={fase !== 'diam'} />
                    <Field
                      label={wajibCatatan ? 'Catatan lokasi / aktivitas (wajib untuk WFH)' : 'Catatan (opsional)'}
                      required={wajibCatatan}
                      counter={`${st.catatan.length}/500`}
                    >
                      <Input
                        value={st.catatan}
                        onChangeText={absenStore.setCatatan}
                        placeholder={wajibCatatan ? 'Mis. rumah, menyusun laporan bulanan' : 'Catatan untuk HR, maks. 500 karakter'}
                        multiline
                        maxLength={500}
                        editable={fase === 'diam'}
                        accessibilityLabel="Catatan absen"
                      />
                    </Field>
                    <DaftarPrasyarat butir={syarat} judul={arah === 'masuk' ? 'Prasyarat check-in' : 'Prasyarat check-out'} />
                  </>
                )}
              </>
            ) : null}
          </>
        ) : null}

        <SheetPesanWa visible={sheetPesan} onClose={() => setSheetPesan(false)} pesan={pesanWa} />
      </>
    );

    // Dock aksi final.
    if (tampilForm && (metode === 'qr' || state.code !== 'no_office_location') && !(metode === 'wfh' && !state.isRemote)) {
      if (metode === 'qr') {
        const terkunciQr = offline || state.code === 'too_early' || tutupPulang === 'sebelum';
        dock = (
          <Dock keyboard={tinggiKeyboard} hint={<Text variant="meta" align="center" style={{ marginTop: 8, fontSize: 13 }}>{terkunciQr ? (offline ? 'Butuh koneksi internet.' : state.code === 'too_early' ? state.message || 'Check-in belum bisa dikirim.' : state.checkOutBlockedReason ?? 'Check-out belum bisa dikirim.') : 'Lokasi dan foto hanya direkam saat check-in dan check-out'}</Text>}>
            <Button
              title={state.code === 'too_early' ? `Dibuka pukul ${jam(state.windowOpensAt)}` : tutupPulang === 'sebelum' ? labelPulangTertutup(state, 'sebelum') : 'Buka pemindai QR'}
              icon="qr-code"
              size="lg"
              disabled={terkunciQr}
              onPress={() => bukaPemindai(arah)}
            />
          </Dock>
        );
      } else {
        dock = (
          <Dock
            keyboard={tinggiKeyboard}
            hint={
              <View style={s.hintBaris}>
                <Text variant="meta" align="center" style={{ fontSize: 13 }}>
                  {kunci ? kunci.hint : petunjukSiap}
                  {!kunci ? ' · ' : ''}
                </Text>
                {!kunci ? (
                  <Pressable onPress={() => router.push('/privasi')} accessibilityRole="link" accessibilityLabel="Privasi" hitSlop={8}>
                    <Text variant="meta" weight={700} tone="link" style={{ fontSize: 13 }}>
                      Privasi
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            }
          >
            <SwipeToConfirm
              label={arah === 'masuk' ? 'Geser untuk check-in' : 'Geser untuk check-out'}
              labelAksi={arah === 'masuk' ? 'Kirim check-in' : 'Kirim check-out'}
              terkunci={kunci !== null}
              alasanKunci={kunci?.label ?? ''}
              mengirim={fase !== 'diam'}
              labelMengirim={fase === 'lokasi' ? 'Memperbarui lokasi…' : 'Mengirim…'}
              onKonfirmasi={() => void kirimSekarang()}
            />
          </Dock>
        );
      }
    }
  }

  // Tepi-ke-tepi: windowSoftInputMode tidak mengecilkan jendela, jadi layar disempitkan sebesar papan ketik
  // agar isian rencana/laporan terlihat di atas papan ketik; dock naik setinggi yang sama.
  return (
    <View style={{ flex: 1, paddingBottom: tinggiKeyboard }}>
      <Screen
        header={undefined}
        refreshing={menyegarkan}
        onRefresh={() => {
          setMenyegarkan(true);
          void muat(true);
          if (tampilForm) void lokasi.ambil();
        }}
        contentStyle={dock ? { paddingBottom: keyboard ? 150 : ruangTab + 150 } : undefined}
      >
        {isi}
      </Screen>
      {dock}
    </View>
  );
}

function infoJadwal(state: KeadaanAbsen): InfoJadwal {
  return {
    batasTerlambat: state.lateThreshold,
    jadwalMulai: state.scheduledStart,
    jamPulangTerjadwal: state.scheduledEnd,
    masukPada: state.checkedInAt,
    masukLokasi: state.locationName,
  };
}

/** "16.00": jam tombol Absen kembali (jam pulang − 60 menit). */
function jamAbsenKembali(state: { center: { flipsAt: string | null }; scheduledEnd: string | null }): string | null {
  const iso = state.center.flipsAt ?? (state.scheduledEnd ? new Date(Date.parse(state.scheduledEnd) - 60 * 60_000).toISOString() : null);
  return iso ? jam(iso) : null;
}

function KonsenDibutuhkan({ perbarui, versi }: { perbarui: boolean; versi: string }): React.JSX.Element {
  return (
    <>
      <Banner
        tone="warn"
        icon="shield-alert"
        title={perbarui ? 'Kebijakan privasi diperbarui' : 'Persetujuan lokasi & selfie diperlukan'}
        message={
          perbarui
            ? `Kebijakan berubah ke versi ${versi}. Check-in GPS + selfie tidak bisa dilakukan sampai Anda menyetujui versi ini. Kiosk QR dan koreksi oleh HR tetap tersedia.`
            : 'Check-in GPS + selfie tidak bisa dilakukan. Kiosk QR dan koreksi oleh HR tetap tersedia.'
        }
        actionLabel="Baca & setujui"
        onAction={() => router.push('/absensi/persetujuan')}
      />
      <Card variant="flat">
        <ListRow icon="qr-code" iconTone="teal" title="Pindai QR di kiosk" subtitle="Tanpa selfie · tetap tercatat" onPress={() => absenStore.setMetode('qr')} />
        <ListRow
          divider
          icon="clipboard-pen-line"
          iconTone="blue"
          title="Ajukan koreksi absensi"
          subtitle="HR memasukkan jam manual"
          onPress={() => bukaKoreksiHari()}
        />
      </Card>
    </>
  );
}

const s = StyleSheet.create({
  dock: { position: 'absolute', paddingTop: 12, paddingBottom: 10, paddingHorizontal: 12 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hintBaris: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 },
});

