/**
 * Pra-gabung rapat video native (mockup 08 › 13–14): pratinjau kamera (track
 * lokal LiveKit), sakelar mikrofon/kamera, lembar perangkat (kamera depan/
 * belakang, keluaran suara, hemat data), izin runtime Android (+ Buka
 * Pengaturan bila ditolak permanen), status jendela gabung dari token
 * (belum dibuka + hitung mundur, ditutup, dikeluarkan, tidak diizinkan, 503
 * belum disiapkan), kartu notulen otomatis (persetujuan wajib terlihat),
 * info sumber notulen (pilihannya milik layar rapat), lalu "Masuk ruang rapat".
 */
import { AudioSession } from '@livekit/react-native';
import { RTCView } from '@livekit/react-native-webrtc';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { aturOptOutTranskrip, ruangVideo, tokenVideo, type KodeTolakVideo, type RuangVideoResponse } from '@/api/video';
import { useIzinVideo } from '@/features/video/izin';
import { KeadaanLayar } from '@/features/video/KeadaanLayar';
import { ambilPilihan, LABEL_KELUARAN, labelKeluaran, simpanPilihan, simpanToken, type PilihanPerangkat } from '@/features/video/sesi';
import { hitungMundur, kodeTolak, rentangRapat } from '@/features/video/teks';
import { jam, tanggalTanpaTahun } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import {
  Avatar,
  Banner,
  BottomSheet,
  Button,
  Card,
  Icon,
  IconButton,
  IconTile,
  Loading,
  Pressable,
  Radio,
  Screen,
  SubAppBar,
  Switch,
  Text,
  useSnackbar,
} from '@/ui';

type StatusGabung =
  | { kind: 'memuat' }
  | { kind: 'siap' }
  | { kind: 'tolak'; kode: KodeTolakVideo; pesan: string }
  | { kind: 'offline' }
  | { kind: 'tidakDitemukan' }
  | { kind: 'galat'; pesan: string };

const LABEL_SUMBER = { continue: 'Lanjutkan notulen rapat lalu', template: 'Templat', blank: 'Dokumen kosong' } as const;

/** MediaStream react-native-webrtc punya `toURL()` (tidak ada di tipe DOM). */
function urlStream(stream: MediaStream): string {
  return (stream as unknown as { toURL: () => string }).toURL();
}

function kembali(id: string): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace({ pathname: '/rapat/[id]', params: { id } } as never);
  }
}

export default function PraGabung(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string; tanggal?: string }>();
  const id = String(params.id ?? '');
  const tanggal = params.tanggal ? String(params.tanggal) : null;
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const izin = useIzinVideo();

  const [data, setData] = useState<RuangVideoResponse | null>(null);
  const [status, setStatus] = useState<StatusGabung>({ kind: 'memuat' });
  const [pilihan, setPilihan] = useState<PilihanPerangkat>(() => ambilPilihan());
  const [lembar, setLembar] = useState(false);
  const [keluaran, setKeluaran] = useState<string[]>(['speaker', 'earpiece']);
  const [pratinjau, setPratinjau] = useState<LocalVideoTrack | null>(null);
  const [kameraGagal, setKameraGagal] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [optOut, setOptOut] = useState<boolean | null>(null);
  const [fokus, setFokus] = useState(true);
  const sudahMinta = useRef(false);
  const hidup = useRef(true);

  const ubah = (baru: Partial<PilihanPerangkat>) => setPilihan(simpanPilihan(baru));

  // ── Muat data ruang + coba token (menentukan status jendela gabung) ─────
  const muat = useCallback(async () => {
    setStatus({ kind: 'memuat' });
    let r: RuangVideoResponse;
    try {
      r = await ruangVideo(id, tanggal);
    } catch (e) {
      if (!hidup.current) {
        return;
      }
      if (e instanceof ApiError && e.status === 404) {
        setStatus({ kind: 'tidakDitemukan' });
      } else if (e instanceof ApiError && e.status === 403) {
        setStatus({ kind: 'tolak', kode: 'tidak_diizinkan', pesan: e.message });
      } else if (e instanceof ApiError && e.status === 0) {
        setStatus({ kind: 'offline' });
      } else {
        setStatus({ kind: 'galat', pesan: e instanceof Error ? e.message : 'Gagal memuat ruang rapat.' });
      }
      return;
    }
    if (!hidup.current) {
      return;
    }
    setData(r);
    setOptOut(r.notulen?.consent.opted_out ?? null);
    if (!r.room.video.configured) {
      setStatus({ kind: 'tolak', kode: 'video_belum_siap', pesan: '' });
      return;
    }
    try {
      const t = await tokenVideo(id, tanggal);
      simpanToken(id, tanggal, t);
      if (hidup.current) {
        setStatus({ kind: 'siap' });
      }
    } catch (e) {
      if (!hidup.current) {
        return;
      }
      const kode = kodeTolak(e);
      if (kode !== null) {
        setStatus({ kind: 'tolak', kode, pesan: e instanceof Error ? e.message : '' });
      } else if (e instanceof ApiError && e.status === 0) {
        setStatus({ kind: 'offline' });
      } else {
        setStatus({ kind: 'galat', pesan: e instanceof Error ? e.message : 'Gagal meminta izin masuk ruang.' });
      }
    }
  }, [id, tanggal]);

  useEffect(() => {
    hidup.current = true;
// eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
    return () => {
      hidup.current = false;
    };
  }, [muat]);

  useFocusEffect(
    useCallback(() => {
      setFokus(true);
      return () => setFokus(false);
    }, []),
  );

  // ── Hitung mundur ruang belum dibuka → coba lagi saat waktunya ─────────
  const belumDibuka = status.kind === 'tolak' && status.kode === 'ruang_belum_dibuka';
  const bukaMs = data ? new Date(data.room.video.opens_at).getTime() : 0;
  useEffect(() => {
    if (!belumDibuka) {
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [belumDibuka]);
  useEffect(() => {
    if (belumDibuka && bukaMs > 0 && now >= bukaMs + 1000) {
// eslint-disable-next-line react-hooks/set-state-in-effect -- coba lagi saat ruang dibuka
      void muat();
    }
  }, [belumDibuka, bukaMs, now, muat]);

  // ── Izin runtime: minta sekali saat ruang siap ──────────────────────────
  useEffect(() => {
    if (status.kind !== 'siap' || sudahMinta.current) {
      return;
    }
    if (izin.kamera === 'belum' || izin.mikrofon === 'belum') {
      sudahMinta.current = true;
      void izin.minta();
    }
  }, [status.kind, izin]);

  const kameraBoleh = izin.kamera === 'diizinkan';
  const micBoleh = izin.mikrofon === 'diizinkan';
  const ditolak = (izin.kamera === 'ditolak' || izin.kamera === 'permanen') && (izin.mikrofon === 'ditolak' || izin.mikrofon === 'permanen');
  const sebagianDitolak = !ditolak && (izin.kamera === 'ditolak' || izin.kamera === 'permanen' || izin.mikrofon === 'ditolak' || izin.mikrofon === 'permanen');
  const permanen = izin.kamera === 'permanen' || izin.mikrofon === 'permanen';

  // ── Pratinjau kamera (track lokal; dihentikan saat layar tidak fokus) ──
  const mauPratinjau = status.kind === 'siap' && fokus && kameraBoleh && pilihan.kamera;
  useEffect(() => {
    if (!mauPratinjau) {
      return;
    }
    let track: LocalVideoTrack | null = null;
    let batal = false;
// eslint-disable-next-line react-hooks/set-state-in-effect -- reset galat saat pratinjau dimulai ulang
    setKameraGagal(false);
    createLocalVideoTrack({ facingMode: pilihan.arah, resolution: { width: 640, height: 480 } })
      .then((t) => {
        if (batal) {
          t.stop();
          return;
        }
        track = t;
        setPratinjau(t);
      })
      .catch(() => {
        if (!batal) {
          setKameraGagal(true);
        }
      });
    return () => {
      batal = true;
      track?.stop();
      setPratinjau(null);
    };
  }, [mauPratinjau, pilihan.arah]);

  // Keluaran suara yang tersedia (tanpa memulai sesi audio: daftar bawaan bila gagal).
  useEffect(() => {
    if (!lembar) {
      return;
    }
    let aktif = true;
    AudioSession.getAudioOutputs()
      .then((d) => {
        if (aktif && d.length > 0) {
          setKeluaran(d);
        }
      })
      .catch(() => undefined);
    return () => {
      aktif = false;
    };
  }, [lembar]);

  const ubahOptOut = async (nilai: boolean) => {
    setOptOut(nilai);
    try {
      setOptOut(await aturOptOutTranskrip(id, nilai));
    } catch (e) {
      setOptOut(!nilai);
      snackbar.show({ message: e instanceof Error ? e.message : 'Gagal menyimpan pilihan.', variant: 'bad' });
    }
  };

  const masuk = () => {
    // Pilihan final: tanpa izin, perangkat itu dimatikan (gabung mendengarkan).
    simpanPilihan({ mic: pilihan.mic && micBoleh, kamera: pilihan.kamera && kameraBoleh });
    pratinjau?.stop();
    setPratinjau(null);
    router.replace({ pathname: '/rapat/[id]/video/ruang', params: { id, tanggal: tanggal ?? '' } } as never);
  };

  // ── Keadaan penuh ─────────────────────────────────────────────────────────
  const header = <SubAppBar title={status.kind === 'siap' ? 'Detail rapat' : 'Gabung rapat'} onBack={() => kembali(id)} />;
  const keDetail = { label: 'Kembali ke detail rapat', onPress: () => kembali(id) };

  if (status.kind === 'memuat') {
    return (
      <Screen header={header}>
        <Loading />
      </Screen>
    );
  }
  if (status.kind !== 'siap') {
    let isi: React.JSX.Element;
    if (status.kind === 'tidakDitemukan') {
      isi = <KeadaanLayar ikon="calendar-x" nada="bad" judul="Ruang video tidak ditemukan" pesan="Rapat ini tidak ada, bukan rapat Video RuangKerja, atau Anda tidak memiliki akses." aksi={[keDetail]} />;
    } else if (status.kind === 'offline') {
      isi = (
        <KeadaanLayar
          ikon="wifi-off"
          nada="warn"
          judul="Tidak ada koneksi internet"
          pesan="Periksa Wi-Fi atau data seluler. Gabung rapat butuh jaringan."
          aksi={[{ label: 'Coba lagi', ikon: 'refresh-cw', varian: 'primary', onPress: () => void muat() }, keDetail]}
        />
      );
    } else if (status.kind === 'galat') {
      isi = <KeadaanLayar ikon="circle-alert" nada="bad" judul="Ruang rapat tidak bisa dibuka" pesan={status.pesan} aksi={[{ label: 'Coba lagi', ikon: 'refresh-cw', varian: 'primary', onPress: () => void muat() }, keDetail]} />;
    } else if (status.kode === 'ruang_belum_dibuka') {
      isi = (
        <KeadaanLayar
          ikon="clock"
          nada="warn"
          judul={`Ruang rapat dibuka pukul ${jam(data?.room.video.opens_at)}`}
          pesan="Ruang video dibuka 15 menit sebelum mulai. Dibuka dalam"
          hitung={hitungMundur(bukaMs - now)}
          aksi={[{ ...keDetail, ikon: 'arrow-left', varian: 'primary' }]}
          catatan="Penyelenggara bisa masuk kapan saja."
        />
      );
    } else if (status.kode === 'ruang_ditutup') {
      isi = (
        <KeadaanLayar
          ikon="door-closed"
          nada="teal"
          judul="Ruang rapat sudah ditutup"
          pesan="Rapat sudah selesai. Ruang dibuka sampai 2 jam setelah jam selesai."
          aksi={[
            { label: 'Lihat notulen', ikon: 'file-text', varian: 'primary', onPress: () => router.replace({ pathname: '/rapat/[id]/notulen', params: tanggal ? { id, tanggal } : { id } } as never) },
            keDetail,
          ]}
        />
      );
    } else if (status.kode === 'dikeluarkan') {
      isi = (
        <KeadaanLayar
          ikon="user-x"
          nada="bad"
          judul="Penyelenggara mengeluarkan Anda dari rapat"
          pesan={'Anda baru bisa masuk lagi setelah penyelenggara menekan "Izinkan masuk lagi". Anda juga tidak bisa menyunting notulen.'}
          aksi={[keDetail]}
        />
      );
    } else if (status.kode === 'video_belum_siap') {
      isi = (
        <KeadaanLayar
          ikon="server-off"
          nada="warn"
          judul="Video RuangKerja belum disiapkan"
          pesan="Video RuangKerja belum disiapkan di server ini. Hubungi admin, atau minta penyelenggara memakai Google Meet/Zoom."
          aksi={[keDetail]}
        />
      );
    } else {
      isi = (
        <KeadaanLayar
          ikon="shield-x"
          nada="bad"
          judul="Anda tidak bisa bergabung ke rapat ini"
          pesan={status.pesan || 'Hanya karyawan yang diundang yang bisa masuk ruang video. Pengamat rapat pimpinan hanya bisa melihat detail dan notulen.'}
          aksi={[keDetail]}
        />
      );
    }
    return <Screen header={header}>{isi}</Screen>;
  }

  // ── Siap: pratinjau + perangkat ───────────────────────────────────────────
  const room = data?.room;
  const meeting = room?.meeting;
  const diRuang = room?.video.in_room ?? 0;
  const sumber = room?.notes_source ?? null;
  const notulen = data?.notulen ?? null;
  const namaOrang = (uid: string | null) => room?.people.find((p) => p.id === uid)?.name ?? 'notulis';
  const labelPerangkat = `${pilihan.arah === 'user' ? 'Kamera depan' : 'Kamera belakang'} · ${labelKeluaran(pilihan.keluaran)}`;
  const micTampil = pilihan.mic && micBoleh;
  const kamTampil = pilihan.kamera && kameraBoleh;

  return (
    <Screen
      header={header}
      footer={
        <Button
          title={ditolak ? 'Gabung tanpa kamera & mikrofon' : 'Masuk ruang rapat'}
          icon="log-in"
          size="lg"
          onPress={masuk}
          style={{ flex: 1 }}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <Text variant="h1" accessibilityRole="header">
          {meeting?.title ?? 'Rapat'}
        </Text>
        <Text variant="body" tone="muted">
          Periksa kamera dan mikrofon, lalu masuk.
        </Text>
        {meeting ? <Text variant="meta">{`${rentangRapat(meeting.starts_at, meeting.ends_at)} · ${diRuang > 0 ? `${diRuang} orang sudah di ruang` : 'belum ada orang di ruang'}`}</Text> : null}
      </View>

      <View style={[s.pratinjau, { backgroundColor: kamTampil && pratinjau ? colors.roomBar : colors.roomTileOff }]}>
        {kamTampil && pratinjau?.mediaStream ? (
          <RTCView streamURL={urlStream(pratinjau.mediaStream)} style={StyleSheet.absoluteFill} objectFit="cover" mirror={pilihan.arah === 'user'} />
        ) : (
          <View style={s.tengah}>
            {!kameraBoleh || kameraGagal ? (
              <>
                <Icon name="video-off" size={36} color={colors.muted} />
                <Text variant="label" tone="muted">
                  {kameraGagal ? 'Kamera dipakai aplikasi lain' : 'Kamera tidak tersedia'}
                </Text>
              </>
            ) : (
              <>
                <Avatar name={room?.viewer.name} size="lg" />
                <Text variant="label" tone="muted">
                  Kamera mati
                </Text>
              </>
            )}
          </View>
        )}
        {kamTampil ? (
          <View style={s.balik}>
            <IconButton icon="refresh-cw" label="Balik kamera" variant="outline" size={40} onPress={() => ubah({ arah: pilihan.arah === 'user' ? 'environment' : 'user' })} />
          </View>
        ) : null}
        <View style={[s.chip, { backgroundColor: colors.roomCaption }]}>
          <Icon name={micTampil ? 'mic' : 'mic-off'} size={14} color={colors.roomOnCaption} />
          <Text variant="meta" weight={600} style={{ color: colors.roomOnCaption }}>
            {micTampil ? 'Mikrofon aktif' : 'Mikrofon mati'}
          </Text>
        </View>
      </View>

      <View style={s.kontrol}>
        <Sakelar ikonNyala="mic" ikonMati="mic-off" nyala={micTampil} label={micTampil ? 'Matikan mikrofon' : 'Nyalakan mikrofon'} disabled={!micBoleh} onPress={() => ubah({ mic: !pilihan.mic })} />
        <Sakelar ikonNyala="video" ikonMati="video-off" nyala={kamTampil} label={kamTampil ? 'Matikan kamera' : 'Nyalakan kamera'} disabled={!kameraBoleh} onPress={() => ubah({ kamera: !pilihan.kamera })} />
        <IconButton icon="sliders-horizontal" label="Mikrofon & kamera" onPress={() => setLembar(true)} size={52} />
        <Text variant="meta" align="right" style={{ flex: 1 }}>
          {!micTampil && !kamTampil ? 'Kamera & mikrofon mati' : labelPerangkat}
        </Text>
      </View>

      {ditolak || sebagianDitolak ? (
        <Banner
          tone="warn"
          icon="shield-alert"
          title={ditolak ? 'Izin kamera dan mikrofon ditolak.' : izin.kamera === 'diizinkan' ? 'Izin mikrofon ditolak.' : 'Izin kamera ditolak.'}
          message="Anda tetap bisa bergabung dan mendengarkan. Untuk berbicara atau menyalakan kamera, izinkan lewat Pengaturan aplikasi."
          actionLabel={permanen ? 'Buka Pengaturan aplikasi' : 'Minta izin lagi'}
          onAction={permanen ? izin.bukaSetelan : () => void izin.minta()}
        />
      ) : null}

      {notulen?.auto_minutes ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconTile icon="file-text" tone="blue" />
            <Text variant="title" style={{ flex: 1 }}>
              Notulen otomatis aktif
            </Text>
          </View>
          {notulen.notice ? <Text variant="body">{notulen.notice}</Text> : null}
          {notulen.notice_points.map((p) => (
            <Text key={p} variant="meta">
              {`• ${p}`}
            </Text>
          ))}
          {notulen.consent.can_change ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 }}>
              <Switch value={optOut ?? false} onValueChange={(v) => void ubahOptOut(v)} label="Jangan transkrip suara saya" />
              <View style={{ flex: 1 }}>
                <Text variant="label">Jangan transkrip suara saya</Text>
                <Text variant="meta">Pilihan privat; peserta lain tetap mendengar Anda seperti biasa.</Text>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {sumber?.chosen ? (
        <Card variant="tight">
          <Text variant="body">
            {'Notulen memakai '}
            <Text variant="body" weight={700}>
              {sumber.chosen === 'template' ? (sumber.template?.label ?? LABEL_SUMBER.template) : LABEL_SUMBER[sumber.chosen]}
            </Text>
            {` · dipilih ${namaOrang(sumber.chosen_by).split(/\s+/)[0] ?? ''}.`}
          </Text>
        </Card>
      ) : sumber?.can_choose ? (
        <Banner tone="info" icon="file-text" message="Sumber notulen untuk tanggal ini belum dipilih. Pilih di layar notulen rapat; tanpa pilihan, notulen memakai sumber yang disarankan." />
      ) : null}

      {sumber && sumber.open_follow_ups.length > 0 && sumber.previous ? (
        <View style={[s.amber, { backgroundColor: colors.warningSoft }]}>
          <Text variant="label" weight={700} tone="warning">
            {`Tindak lanjut terbuka dari ${tanggalTanpaTahun(`${sumber.previous.occurrence_date}T05:00:00Z`)}`}
          </Text>
          {sumber.open_follow_ups.slice(0, 5).map((f) => (
            <Text key={f.id} variant="meta" tone="warning">
              {`• ${f.text}${f.assignee_id ? ` · ${namaOrang(f.assignee_id).split(/\s+/)[0] ?? ''}` : ''}${f.due_date ? ` · ${tanggalTanpaTahun(`${f.due_date}T05:00:00Z`)}` : ''}`}
            </Text>
          ))}
        </View>
      ) : null}

      <BottomSheet visible={lembar} onClose={() => setLembar(false)} title="Mikrofon & kamera" showClose scrollable>
        <Text variant="overline" tone="muted">
          Keluaran suara
        </Text>
        {keluaran.map((k) => {
          const info = LABEL_KELUARAN[k] ?? { label: k, meta: '', ikon: 'volume-2' as const };
          return (
            <View key={k} style={s.baris}>
              <IconTile icon={info.ikon} tone="teal" />
              <Radio selected={pilihan.keluaran === k} onSelect={() => ubah({ keluaran: k })} label={info.label} description={info.meta} style={{ flex: 1 }} />
            </View>
          );
        })}
        <Text variant="overline" tone="muted">
          Kamera
        </Text>
        <View style={s.baris}>
          <IconTile icon="smartphone" tone="teal" />
          <Radio selected={pilihan.arah === 'user'} onSelect={() => ubah({ arah: 'user' })} label="Kamera depan" style={{ flex: 1 }} />
        </View>
        <View style={s.baris}>
          <IconTile icon="switch-camera" tone="teal" />
          <Radio selected={pilihan.arah === 'environment'} onSelect={() => ubah({ arah: 'environment' })} label="Kamera belakang" style={{ flex: 1 }} />
        </View>
        <View style={s.baris}>
          <View style={{ flex: 1 }}>
            <Text variant="title">Hemat data seluler</Text>
            <Text variant="meta">Video diterima 360p saat memakai data seluler</Text>
          </View>
          <Switch value={pilihan.hematData} onValueChange={(v) => ubah({ hematData: v })} label="Hemat data seluler" />
        </View>
        <Text variant="meta">Peredam bising dan gema aktif otomatis.</Text>
      </BottomSheet>
    </Screen>
  );
}

function Sakelar({
  ikonNyala,
  ikonMati,
  nyala,
  label,
  disabled,
  onPress,
}: {
  ikonNyala: 'mic' | 'video';
  ikonMati: 'mic-off' | 'video-off';
  nyala: boolean;
  label: string;
  disabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const bg = disabled ? colors.surface2 : nyala ? colors.surface : colors.badge;
  const fg = disabled ? colors.subtle : nyala ? colors.text : colors.onBadge;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      scaleTo={0.94}
      style={[s.sakelar, { backgroundColor: bg, borderColor: colors.border, boxShadow: nyala && !disabled ? shadows.card : undefined }]}
    >
      <Icon name={nyala ? ikonNyala : ikonMati} size={22} color={fg} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  pratinjau: { height: 260, borderRadius: radius['2xl'], overflow: 'hidden' },
  tengah: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  balik: { position: 'absolute', top: 10, right: 10 },
  chip: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  kontrol: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  amber: { borderRadius: radius.card, padding: 16, gap: 4 },
  sakelar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
