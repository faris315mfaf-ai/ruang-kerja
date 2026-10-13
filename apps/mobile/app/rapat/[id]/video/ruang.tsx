/**
 * Ruang rapat video native (mockup 08 › 15–20, 16 lanskap): tab Video
 * (sorotan + petak kecil, atau Petak) dan Notulen (baca, disegarkan oleh
 * penanda `rk.minutes`), bilah kontrol gelap 7 tombol, menu ⋯ (berbagi
 * layar, tampilan, subtitle, waktu bicara, setelan), panel Obrolan &
 * Kehadiran (moderasi penyelenggara), subtitle `rk-notulen`, keadaan
 * jaringan/akses, konfirmasi Keluar → "Anda keluar".
 *
 * Lanskap: tata letak imersif dipakai bila jendela lebih lebar dari tinggi.
 * Orientasi aplikasi tetap terkunci potret (`app.json`) — membuka rotasi
 * hanya di ruang butuh `expo-screen-orientation` (belum terpasang).
 */
import { useChat } from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { Participant } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { notulenRapat } from '@/api/endpoints';
import type { MeetingMinutesData } from '@/api/types';
import { ruangVideo, type RuangVideoResponse } from '@/api/video';
import { useAppLock } from '@/features/auth/appLock';
import { BilahKontrol, type TombolKontrol } from '@/features/video/BilahKontrol';
import { useIzinVideo } from '@/features/video/izin';
import { KeadaanLayar } from '@/features/video/KeadaanLayar';
import { SheetKehadiran } from '@/features/video/SheetKehadiran';
import { SheetMenu, SheetSetelan, SheetWaktuBicara } from '@/features/video/SheetMenu';
import { SheetObrolan, type PesanObrolan } from '@/features/video/SheetObrolan';
import { ambilPilihan } from '@/features/video/sesi';
import { Subtitle } from '@/features/video/Subtitle';
import { Ubin } from '@/features/video/Ubin';
import { pesertaTampil, useRuang, type RuangLive } from '@/features/video/useRuang';
import { durasiMenit, jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Button, Icon, Pressable, SegmentedTabs, Text, useDialog, useSnackbar } from '@/ui';

type Tab = 'video' | 'notulen';

function keDetail(id: string): void {
  router.replace({ pathname: '/rapat/[id]', params: { id } } as never);
}

function keNotulen(id: string, tanggal: string | null): void {
  router.replace({ pathname: '/rapat/[id]/notulen', params: tanggal ? { id, tanggal } : { id } } as never);
}

/** Siapa di sorotan: layar bersama → disematkan → pembicara aktif → peserta lain → saya. */
function pilihSorotan(daftar: Participant[], pembicara: string[], disematkan: string | null): { p: Participant; layar: boolean } | null {
  const berbagi = daftar.find((p) => p.isScreenShareEnabled && !p.isLocal) ?? daftar.find((p) => p.isScreenShareEnabled);
  if (berbagi) {
    return { p: berbagi, layar: true };
  }
  const pin = disematkan ? daftar.find((p) => p.identity === disematkan) : undefined;
  if (pin) {
    return { p: pin, layar: false };
  }
  const bicara = daftar.find((p) => !p.isLocal && pembicara.includes(p.identity));
  if (bicara) {
    return { p: bicara, layar: false };
  }
  const lain = daftar.find((p) => !p.isLocal);
  const satu = lain ?? daftar[0];
  return satu ? { p: satu, layar: false } : null;
}

export default function RuangVideo(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string; tanggal?: string }>();
  const id = String(params.id ?? '');
  const tanggal = params.tanggal ? String(params.tanggal) : null;
  const [data, setData] = useState<RuangVideoResponse | null>(null);

  useEffect(() => {
    let aktif = true;
    ruangVideo(id, tanggal)
      .then((r) => {
        if (aktif) {
          setData(r);
        }
      })
      .catch(() => undefined);
    return () => {
      aktif = false;
    };
  }, [id, tanggal]);

  const people = useMemo(() => data?.room.people ?? [], [data]);
  const live = useRuang(id, tanggal, people);

  return <Isi id={id} tanggal={tanggal} data={data} setData={setData} live={live} />;
}

function Isi({
  id,
  tanggal,
  data,
  setData,
  live,
}: {
  id: string;
  tanggal: string | null;
  data: RuangVideoResponse | null;
  setData: (fn: (lama: RuangVideoResponse | null) => RuangVideoResponse | null) => void;
  live: RuangLive;
}): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const lanskap = width > height;
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const izin = useIzinVideo();
  const { tahanKunci } = useAppLock();
  const { room, fase, versi, nama, pembicara, tangan } = live;

  const [tab, setTab] = useState<Tab>('video');
  const [tampilan, setTampilan] = useState<'sorotan' | 'petak'>('sorotan');
  const [disematkan, setDisematkan] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | 'kehadiran' | 'obrolan' | 'menu' | 'setelan' | 'bicara'>(null);
  const [subtitleNyala, setSubtitleNyala] = useState(true);
  const [dibacaObrolan, setDibacaObrolan] = useState(0);

  const { chatMessages, send, isSending } = useChat({ room });
  const pesan: PesanObrolan[] = useMemo(
    () => chatMessages.map((m) => ({ id: m.id, timestamp: m.timestamp, message: m.message, from: m.from ? { identity: m.from.identity, isLocal: m.from.isLocal } : undefined })),
    [chatMessages],
  );
  const belumDibaca = panel === 'obrolan' ? 0 : pesan.slice(dibacaObrolan).filter((m) => !m.from?.isLocal).length;
  useEffect(() => {
    if (panel === 'obrolan') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tandai obrolan terbaca saat panel terbuka
      setDibacaObrolan(pesan.length);
    }
  }, [panel, pesan.length]);

  const tersambung = fase.kind === 'tersambung';
  const lp = room.localParticipant;
  const micNyala = tersambung && lp.isMicrophoneEnabled;
  const kamNyala = tersambung && lp.isCameraEnabled;
  const layarNyala = tersambung && lp.isScreenShareEnabled;
  const tanganNaik = Boolean(tangan[lp.identity]);
  const daftar = useMemo(() => (tersambung ? pesertaTampil(room) : []), [room, tersambung, versi]); // eslint-disable-line react-hooks/exhaustive-deps -- versi = pemicu peserta/track berubah
  const ids = useMemo(() => daftar.map((p) => p.identity), [daftar]);

  // ── Keluar (konfirmasi) + tombol kembali sistem ─────────────────────────
  const minta = useRef(false);
  const tanyaKeluar = useCallback(async () => {
    if (minta.current) {
      return;
    }
    minta.current = true;
    const ok = await dialog.confirm({
      title: 'Keluar dari rapat?',
      message: 'Anda bisa bergabung lagi selama ruang masih terbuka. Jam keluar tercatat otomatis.',
      confirmLabel: 'Keluar',
      cancelLabel: 'Tetap di rapat',
      destructive: true,
    });
    minta.current = false;
    if (ok) {
      await live.keluar();
    }
  }, [dialog, live]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fase.kind === 'tersambung') {
        void tanyaKeluar();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [fase.kind, tanyaKeluar]);

  // ── Notulen (tab) ────────────────────────────────────────────────────────
  const [notulen, setNotulen] = useState<MeetingMinutesData | null>(null);
  const [notulenGagal, setNotulenGagal] = useState(false);
  useEffect(() => {
    if (tab !== 'notulen') {
      return;
    }
    let aktif = true;
    const muat = () =>
      notulenRapat(id, tanggal)
        .then((r) => {
          if (aktif) {
            setNotulen(r.notulen);
            setNotulenGagal(false);
          }
        })
        .catch(() => {
          if (aktif) {
            setNotulenGagal(true);
          }
        });
    void muat();
    const t = setInterval(() => void muat(), 30_000);
    return () => {
      aktif = false;
      clearInterval(t);
    };
  }, [tab, id, tanggal, live.versiNotulen]);

  // ── Aksi bilah ───────────────────────────────────────────────────────────
  const galat = (e: unknown, cadangan: string) => snackbar.show({ message: e instanceof Error && e.message ? e.message : cadangan, variant: 'bad' });

  const tombolMic = async () => {
    if (izin.mikrofon !== 'diizinkan') {
      const r = await izin.minta();
      if (!r.mikrofon) {
        snackbar.show({ message: 'Izinkan mikrofon lewat Pengaturan aplikasi untuk berbicara.', variant: 'warn', actionLabel: 'Pengaturan', onAction: izin.bukaSetelan });
        return;
      }
    }
    await live.aturMic(!micNyala).catch((e: unknown) => galat(e, 'Mikrofon tidak bisa dinyalakan.'));
  };

  const tombolKamera = async () => {
    if (izin.kamera !== 'diizinkan') {
      const r = await izin.minta();
      if (!r.kamera) {
        snackbar.show({ message: 'Izinkan kamera lewat Pengaturan aplikasi.', variant: 'warn', actionLabel: 'Pengaturan', onAction: izin.bukaSetelan });
        return;
      }
    }
    await live.aturKamera(!kamNyala).catch((e: unknown) => galat(e, 'Kamera dipakai aplikasi lain atau tidak tersedia.'));
  };

  const tombolLayar = async () => {
    setPanel(null);
    try {
      // Dialog sistem MediaProjection membuat aplikasi sempat di latar → tahan kunci aplikasi.
      await tahanKunci(() => live.aturLayar(!layarNyala));
    } catch (e) {
      galat(e, layarNyala ? 'Gagal menghentikan berbagi layar.' : 'Berbagi layar dibatalkan.');
    }
  };

  const tombolTangan = () => {
    live.angkatTangan(!tanganNaik).catch((e: unknown) => galat(e, 'Gagal mengubah tangan.'));
  };

  const tombol: TombolKontrol[] = [
    { key: 'mic', ikon: micNyala ? 'mic' : 'mic-off', label: micNyala ? 'Matikan mikrofon' : 'Nyalakan mikrofon', nada: micNyala ? 'biasa' : 'mati', onPress: () => void tombolMic(), disabled: !tersambung },
    { key: 'kam', ikon: kamNyala ? 'video' : 'video-off', label: kamNyala ? 'Matikan kamera' : 'Nyalakan kamera', nada: kamNyala ? 'biasa' : 'mati', onPress: () => void tombolKamera(), disabled: !tersambung },
    ...(layarNyala ? [{ key: 'layar', ikon: 'monitor-up' as const, label: 'Berhenti membagikan layar', nada: 'aktif' as const, onPress: () => void tombolLayar() }] : []),
    { key: 'tangan', ikon: 'hand', label: tanganNaik ? 'Turunkan tangan' : 'Angkat tangan', nada: tanganNaik ? 'aktif' : 'biasa', onPress: tombolTangan, disabled: !tersambung },
    { key: 'obrolan', ikon: 'message-square', label: 'Obrolan', onPress: () => setPanel('obrolan'), lencana: belumDibaca },
    { key: 'kehadiran', ikon: 'users', label: 'Kehadiran', onPress: () => setPanel('kehadiran'), lencana: daftar.length },
    { key: 'menu', ikon: 'ellipsis', label: 'Lainnya', onPress: () => setPanel('menu') },
    { key: 'keluar', ikon: 'phone-off', label: 'Keluar dari rapat', nada: 'keluar', onPress: () => void tanyaKeluar() },
  ];

  // ── Keadaan penuh ────────────────────────────────────────────────────────
  if (fase.kind !== 'tersambung') {
    const kembali = { label: 'Kembali ke detail rapat', onPress: () => keDetail(id) };
    const cobaLagi = { label: 'Coba lagi', ikon: 'refresh-cw' as const, varian: 'primary' as const, onPress: live.sambung };
    let isi: React.JSX.Element;
    switch (fase.kind) {
      case 'menyambung':
        isi = <KeadaanLayar latarRuang ikon="loader-circle" nada="teal" judul="Menyambung ke ruang rapat…" pesan="Memeriksa jalur jaringan. Ini biasanya beberapa detik." />;
        break;
      case 'offline':
        isi = <KeadaanLayar latarRuang ikon="wifi-off" nada="warn" judul="Tidak ada koneksi internet" pesan="Periksa Wi-Fi atau data seluler. Gabung rapat butuh jaringan." aksi={[cobaLagi, kembali]} />;
        break;
      case 'server':
        isi = <KeadaanLayar latarRuang ikon="server-crash" nada="bad" judul="Tidak bisa tersambung ke server rapat" pesan={fase.pesan} aksi={[cobaLagi, kembali]} />;
        break;
      case 'dikeluarkan':
        isi = (
          <KeadaanLayar
            latarRuang
            ikon="user-x"
            nada="bad"
            judul="Penyelenggara mengeluarkan Anda dari rapat"
            pesan={'Anda baru bisa masuk lagi setelah penyelenggara menekan "Izinkan masuk lagi". Anda juga tidak bisa menyunting notulen.'}
            aksi={[kembali]}
          />
        );
        break;
      case 'dibatalkan':
        isi = (
          <KeadaanLayar
            latarRuang
            ikon="calendar-x"
            nada="bad"
            judul="Rapat dibatalkan"
            pesan="Penyelenggara membatalkan rapat ini. Ruang ditutup."
            aksi={[{ label: 'Kembali ke agenda', onPress: () => router.replace('/rapat' as never) }]}
          />
        );
        break;
      case 'selesai':
        isi = (
          <KeadaanLayar
            latarRuang
            ikon="circle-check"
            nada="ok"
            judul="Rapat selesai"
            pesan={data?.notulen?.auto_minutes ? 'Transkrip sedang diproses; draf notulen biasanya siap dalam beberapa menit.' : 'Ruang rapat sudah ditutup.'}
            aksi={[
              { label: 'Buka notulen', ikon: 'file-text', varian: 'primary', onPress: () => keNotulen(id, tanggal) },
              ...(data?.notulen?.auto_minutes
                ? [{ label: 'Lihat status notulen otomatis', ikon: 'sparkles' as const, onPress: () => router.replace({ pathname: '/rapat/[id]/transkrip', params: { id } } as never) }]
                : [kembali]),
            ]}
          />
        );
        break;
      case 'perangkatLain':
        isi = <KeadaanLayar latarRuang ikon="smartphone" nada="warn" judul="Anda masuk dari perangkat lain" pesan="Ruang rapat ini dibuka dengan akun Anda di perangkat atau tab lain, jadi sambungan di sini ditutup." aksi={[cobaLagi, kembali]} />;
        break;
      case 'ditolak':
        isi = (
          <KeadaanLayar
            latarRuang
            ikon={fase.kode === 'ruang_ditutup' ? 'door-closed' : fase.kode === 'video_belum_siap' ? 'server-off' : fase.kode === 'ruang_belum_dibuka' ? 'clock' : 'shield-x'}
            nada={fase.kode === 'video_belum_siap' || fase.kode === 'ruang_belum_dibuka' ? 'warn' : 'bad'}
            judul={
              fase.kode === 'ruang_ditutup'
                ? 'Ruang rapat sudah ditutup'
                : fase.kode === 'video_belum_siap'
                  ? 'Video RuangKerja belum disiapkan'
                  : fase.kode === 'ruang_belum_dibuka'
                    ? 'Ruang rapat belum dibuka'
                    : 'Anda tidak bisa bergabung ke rapat ini'
            }
            pesan={fase.pesan}
            aksi={[kembali]}
          />
        );
        break;
      case 'keluar': {
        const menit = Math.max(1, Math.round((fase.keluar - fase.masuk) / 60_000));
        isi = (
          <KeadaanLayar
            latarRuang
            ikon="log-out"
            nada="ok"
            judul="Anda keluar dari rapat"
            pesan={`${fase.sisa > 0 ? `Rapat masih berlangsung dengan ${fase.sisa} orang. ` : ''}Tercatat ${jam(new Date(fase.masuk))}–${jam(new Date(fase.keluar))} (${durasiMenit(menit)}).`}
            aksi={[
              { label: 'Gabung lagi', ikon: 'video', varian: 'primary', onPress: () => router.replace({ pathname: '/rapat/[id]/video/pra-gabung', params: { id, tanggal: tanggal ?? '' } } as never) },
              { label: 'Buka notulen', ikon: 'file-text', varian: 'tonal', onPress: () => keNotulen(id, tanggal) },
              { label: 'Kembali ke detail rapat', varian: 'quiet', onPress: () => keDetail(id) },
            ]}
          />
        );
        break;
      }
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.roomDesk, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <StatusBar hidden={false} />
        {isi}
      </View>
    );
  }

  // ── Tersambung ───────────────────────────────────────────────────────────
  const sorot = pilihSorotan(daftar, pembicara, disematkan);
  const sisa = daftar.filter((p) => !(sorot && !sorot.layar && p.identity === sorot.p.identity));
  const cermin = live.arah === 'user';
  const presenter = sorot?.layar ? sorot.p : null;
  const notulenOto = data?.notulen?.auto_minutes ?? false;
  const subtitleAda = live.subtitleTersedia || (data?.room.features?.subtitles ?? false);

  const ubin = (p: Participant, opsi: { besar?: boolean; layar?: boolean; style?: object } = {}) => (
    <Ubin
      key={`${p.identity}-${opsi.layar ? 'layar' : 'kam'}`}
      participant={p}
      nama={nama(p.identity)}
      besar={opsi.besar}
      layar={opsi.layar}
      berbicara={!opsi.layar && pembicara.includes(p.identity)}
      tangan={Boolean(tangan[p.identity])}
      cermin={p.isLocal && cermin && !opsi.layar}
      onPress={
        opsi.layar
          ? undefined
          : () => {
              const baru = disematkan === p.identity ? null : p.identity;
              setDisematkan(baru);
              snackbar.show({ message: baru ? `${nama(p.identity)} disematkan di layar Anda.` : 'Sematan dilepas.', variant: 'info', duration: 2000 });
            }
      }
      style={opsi.style}
    />
  );

  const statusBaris = (
    <View style={s.status}>
      {notulenOto || subtitleAda ? (
        <View style={[s.pil, { backgroundColor: colors.infoSoft }]}>
          <View style={[s.titik, { backgroundColor: colors.badge }]} />
          <Text variant="meta" weight={700} tone="info" numberOfLines={1}>
            {[notulenOto ? 'Notulen otomatis aktif' : null, subtitleAda && subtitleNyala ? 'Subtitle ID' : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {presenter ? (
        <View style={[s.pil, { backgroundColor: colors.warningSoft }]}>
          <Icon name="presentation" size={14} color={colors.warning} />
          <Text variant="meta" weight={700} tone="warning" numberOfLines={1}>
            {`${nama(presenter.identity).split(/\s+/)[0] ?? ''} sedang presentasi`}
          </Text>
        </View>
      ) : null}
      {tab === 'video' && !lanskap ? (
        <Pressable onPress={() => setTampilan(tampilan === 'sorotan' ? 'petak' : 'sorotan')} accessibilityRole="button" accessibilityLabel={`Tampilan ${tampilan === 'sorotan' ? 'Sorotan' : 'Petak'}, ganti`} style={s.tampilan}>
          <Icon name="layout-grid" size={16} color={colors.muted} />
          <Text variant="meta">{tampilan === 'sorotan' ? 'Sorotan' : `Petak · ${daftar.length} peserta`}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const banner = (
    <>
      {live.menyambungUlang ? (
        <View style={[s.banner, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite">
          <Icon name="wifi" size={18} color={colors.warning} />
          <Text variant="meta" tone="warning" style={{ flex: 1 }}>
            <Text variant="meta" weight={700} tone="warning">
              Menyambungkan ulang…{' '}
            </Text>
            Suara dan gambar kembali begitu tersambung.
          </Text>
        </View>
      ) : live.jaringanLemah ? (
        <View style={[s.banner, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite">
          <Icon name="signal-low" size={18} color={colors.warning} />
          <Text variant="meta" tone="warning" style={{ flex: 1 }}>
            Jaringan lemah · kualitas video diturunkan otomatis. Matikan kamera bila patah-patah.
          </Text>
        </View>
      ) : null}
      {layarNyala ? (
        <View style={s.bannerBaris}>
          <View style={[s.pilMerah, { backgroundColor: colors.badge }]}>
            <Icon name="screen-share" size={16} color={colors.onBadge} />
            <Text variant="meta" weight={700} style={{ color: colors.onBadge }}>
              Anda membagikan layar
            </Text>
          </View>
          <Pressable onPress={() => void tombolLayar()} accessibilityRole="button" accessibilityLabel="Berhenti membagikan layar" style={[s.pilMerah, { backgroundColor: colors.badge }]}>
            <Text variant="meta" weight={700} style={{ color: colors.onBadge }}>
              Berhenti
            </Text>
          </Pressable>
        </View>
      ) : null}
      {live.pemberitahuan ? (
        <View style={[s.toast, { backgroundColor: colors.roomBar }]} accessibilityLiveRegion="polite">
          <Icon name={live.pemberitahuan.jenis === 'tangan' ? 'hand' : 'info'} size={18} color={colors.roomOnBar} />
          <Text variant="label" style={{ color: colors.roomOnBar, flex: 1 }}>
            {live.pemberitahuan.teks}
          </Text>
          {live.pemberitahuan.jenis === 'tangan' ? (
            <Pressable onPress={() => setPanel('kehadiran')} accessibilityRole="button" accessibilityLabel="Lihat kehadiran">
              <Text variant="meta" weight={700} style={{ color: colors.roomOnBar }}>
                Lihat
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );

  const kolomKecil = lanskap ? 1 : 3;
  const panggung =
    tampilan === 'petak' && !lanskap ? (
      <ScrollView contentContainerStyle={s.petak}>
        {daftar.map((p) => (
          <View key={p.identity} style={{ width: '48.5%', aspectRatio: 0.82 }}>
            {ubin(p)}
          </View>
        ))}
      </ScrollView>
    ) : (
      <View style={[{ flex: 1, gap: 10 }, lanskap && { flexDirection: 'row' }]}>
        <View style={{ flex: lanskap ? 1 : undefined, aspectRatio: lanskap ? undefined : 1.45 }}>{sorot ? ubin(sorot.p, { besar: true, layar: sorot.layar }) : null}</View>
        <ScrollView style={lanskap ? { width: 180, flexGrow: 0 } : undefined} contentContainerStyle={[s.kecil, lanskap && { flexDirection: 'column' }]}>
          {sisa.map((p) => (
            <View key={p.identity} style={{ width: lanskap ? '100%' : `${100 / kolomKecil - 2.2}%`, aspectRatio: lanskap ? 1.3 : 1 }}>
              {ubin(p)}
            </View>
          ))}
        </ScrollView>
      </View>
    );

  const tabNotulen = (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
      <View style={[s.kertas, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="file-text" size={16} color={colors.muted} />
          <Text variant="meta" style={{ flex: 1 }} numberOfLines={1}>
            {`Notulen · ${data?.room.meeting.title ?? ''}`}
          </Text>
          {notulen?.saved_at ? <Text variant="meta">{`Disimpan ${jam(notulen.saved_at)}`}</Text> : null}
        </View>
        {notulen === null ? (
          <Text variant="body" tone="muted">
            {notulenGagal ? 'Notulen tidak bisa dimuat. Periksa jaringan.' : 'Memuat notulen…'}
          </Text>
        ) : (
          <>
            {notulen.sections.map((b, i) => (
              <View key={`${b.title}-${i}`} style={{ gap: 4 }}>
                <Text variant="h3">{`${i + 1}. ${b.title}`}</Text>
                <Text variant="body" tone={b.body.trim() === '' ? 'subtle' : 'text'}>
                  {b.body.trim() === '' ? 'Belum ada catatan.' : b.body}
                </Text>
              </View>
            ))}
            {notulen.decisions.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text variant="h3">Keputusan</Text>
                {notulen.decisions.map((k, i) => (
                  <View key={`${k}-${i}`} style={[s.keputusan, { backgroundColor: colors.successSoft }]}>
                    <Icon name="flag" size={18} color={colors.success} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {k}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
      <Button
        title={data?.room.can?.edit_minutes ? 'Buka & sunting notulen' : 'Buka notulen'}
        icon="file-pen"
        variant="tonal"
        onPress={() => router.push({ pathname: '/rapat/[id]/notulen', params: tanggal ? { id, tanggal } : { id } } as never)}
      />
      <Text variant="meta" align="center">
        Notulen di ruang ini hanya baca dan disegarkan saat notulis menyimpan. Rapat tetap berjalan saat Anda membuka notulen.
      </Text>
    </ScrollView>
  );

  const pilihan = ambilPilihan();

  return (
    <View style={{ flex: 1, backgroundColor: colors.roomDesk, paddingTop: lanskap ? 8 : insets.top, paddingBottom: insets.bottom + 8, paddingHorizontal: lanskap ? Math.max(12, insets.left) : 12 }}>
      <StatusBar hidden={lanskap} style="auto" />
      {!lanskap ? (
        <View style={{ marginBottom: 8 }}>
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'video', label: 'Video' },
              { value: 'notulen', label: 'Notulen' },
            ]}
          />
        </View>
      ) : null}
      {banner}
      {statusBaris}
      <View style={{ flex: 1, marginTop: 8 }}>{tab === 'video' || lanskap ? panggung : tabNotulen}</View>
      <View style={{ gap: 8, marginTop: 8 }}>
        {subtitleNyala && (tab === 'video' || lanskap) ? <Subtitle lines={live.captions} nama={nama} /> : null}
        <BilahKontrol tombol={tombol} lebar={lanskap ? 640 : undefined} />
      </View>

      <SheetKehadiran
        visible={panel === 'kehadiran'}
        onClose={() => setPanel(null)}
        room={room}
        meetingId={id}
        tanggal={tanggal}
        data={data?.room ?? null}
        kehadiran={live.kehadiran}
        tangan={tangan}
        nama={nama}
        bisaModerasi={live.token?.can.moderate ?? data?.room.can?.moderate ?? false}
        bisaPanggil={live.token?.can.call_participants ?? data?.room.can?.call_participants ?? false}
        disematkan={disematkan}
        onSematkan={setDisematkan}
        onBerubah={live.segarkanKehadiran}
      />
      <SheetObrolan visible={panel === 'obrolan'} onClose={() => setPanel(null)} pesan={pesan} kirim={send} mengirim={isSending} nama={nama} />
      <SheetMenu
        visible={panel === 'menu'}
        onClose={() => setPanel(null)}
        berbagiLayar={layarNyala}
        onLayar={() => void tombolLayar()}
        tampilan={tampilan}
        onTampilan={() => {
          setTampilan(tampilan === 'sorotan' ? 'petak' : 'sorotan');
          setTab('video');
          setPanel(null);
        }}
        subtitleAda={subtitleAda}
        subtitleNyala={subtitleNyala}
        onSubtitle={() => {
          setSubtitleNyala(!subtitleNyala);
          setPanel(null);
        }}
        onWaktuBicara={() => setPanel('bicara')}
        onBalikKamera={() => {
          setPanel(null);
          live.balikKamera().catch((e: unknown) => galat(e, 'Kamera tidak bisa dibalik.'));
        }}
        kameraNyala={kamNyala}
        onSetelan={() => setPanel('setelan')}
      />
      <SheetSetelan
        visible={panel === 'setelan'}
        onClose={() => setPanel(null)}
        meetingId={id}
        notulen={data?.notulen ?? null}
        onNotulenBerubah={(optedOut) => setData((lama) => (lama?.notulen ? { ...lama, notulen: { ...lama.notulen, consent: { ...lama.notulen.consent, opted_out: optedOut } } } : lama))}
        arah={live.arah}
        kameraNyala={kamNyala}
        onArah={(a) => {
          if (a !== live.arah) {
            live.balikKamera().catch((e: unknown) => galat(e, 'Kamera tidak bisa dibalik.'));
          }
        }}
        hematData={pilihan.hematData}
        onLihatNotulenOtomatis={() => {
          setPanel(null);
          router.push({ pathname: '/rapat/[id]/transkrip', params: tanggal ? { id, tanggal } : { id } } as never);
        }}
      />
      <SheetWaktuBicara visible={panel === 'bicara'} onClose={() => setPanel(null)} talk={live.talk} ids={ids} nama={nama} />
    </View>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, flexShrink: 1 },
  titik: { width: 8, height: 8, borderRadius: 4 },
  tampilan: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', minHeight: 44, paddingHorizontal: 4 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, marginBottom: 6 },
  bannerBaris: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  pilMerah: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: radius.md },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 48, borderRadius: radius.lg, marginBottom: 6 },
  petak: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  kecil: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kertas: { borderRadius: radius['2xl'], padding: 18, gap: 14 },
  keputusan: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg },
});
