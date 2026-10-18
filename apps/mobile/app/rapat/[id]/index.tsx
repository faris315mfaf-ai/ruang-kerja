/**
 * Detail rapat (mockup 08 › 07–09, 25): varian platform (video, Meet/Zoom,
 * tatap muka, di klien), hitung mundur + kartu ruang video, kehadiran saya
 * (RSVP + Urungkan, rollback saat gagal), agenda, peserta + lembar semua
 * peserta, "Hadir di rapat video" (penyelenggara/notulis), info rapat,
 * kartu notulen otomatis + opt-out, kartu notulen, menu aksi (ubah,
 * bagikan, kemunculan seri, batalkan seri) dan keadaan dibatalkan/selesai/
 * pengamat rapat pimpinan/404.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { ApiError, webBase } from '@/api/client';
import { detailRapat, rsvpRapat } from '@/api/endpoints';
import { batalkanRapat, kehadiranVideo, statusNotulenOtomatis, type KehadiranVideo, type RingkasanNotulenOtomatis } from '@/api/rapat';
import type { MeetingDetailResponse, RsvpValue } from '@/api/types';
import { KartuNotulenOtomatis } from '@/features/rapat/KartuNotulenOtomatis';
import { KartuTamu } from '@/features/rapat/KartuTamu';
import { BarisOrang, LencanaPlatform, NomorAgenda } from '@/features/rapat/komponen';
import { bukaNotulen, bukaTautan, bukaTranskrip, useBukaPraGabung } from '@/features/rapat/navigasi';
import { jumlahTamuDariPeserta, kemampuanTamu, pastikanAkhiranTamu } from '@/features/rapat/tamu';
import { useMuat } from '@/features/rapat/useMuat';
import { faseRapat, hariPanjang, hariSingkat, kemunculanSeri, labelBerulang, labelPengingat, lencanaSeri, rentangJam, teksSelang } from '@/features/rapat/util';
import { jam, ymdHariIni } from '@/lib/format';
import { LABEL_RSVP, TONE_RSVP } from '@/lib/rapat';
import { radius, useTheme } from '@/theme';
import {
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconTile,
  Loading,
  Pressable,
  Radio,
  Screen,
  SheetAction,
  SubAppBar,
  Text,
  useDialog,
  useSnackbar,
  type AnyIconName,
} from '@/ui';
import { useSession } from '@/session/SessionProvider';

type Jawaban = Exclude<RsvpValue, 'pending'>;

const PILIHAN: { nilai: Jawaban; label: string; ikon: AnyIconName }[] = [
  { nilai: 'yes', label: 'Hadir', ikon: 'circle-check' },
  { nilai: 'maybe', label: 'Mungkin', ikon: 'circle-help' },
  { nilai: 'no', label: 'Tidak hadir', ikon: 'circle-x' },
];

function useSekarang(ms = 30_000): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

function BarisInfo({ label, nilai, divider }: { label: string; nilai: string; divider?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.info, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
      <Text variant="meta" style={{ width: 110 }}>
        {label}
      </Text>
      <Text variant="body" style={{ flex: 1, fontSize: 16 }}>
        {nilai}
      </Text>
    </View>
  );
}

export default function LayarDetailRapat(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const bukaPraGabung = useBukaPraGabung();
  const { user } = useSession();
  const viewerId = user?.id ?? null;
  const sekarang = useSekarang();
  const param = useLocalSearchParams<{ id: string; tanggal?: string; tamu?: string }>();
  const id = typeof param.id === 'string' ? param.id : '';
  const tanggalParam = typeof param.tanggal === 'string' && param.tanggal !== '' ? param.tanggal : null;
  // Setelah menyimpan rapat dengan tamu eksternal, formulir membuka daftar tamu agar tautan bisa dibagikan.
  const bukaTamu = param.tamu === '1';

  const m = useMuat<MeetingDetailResponse>(`rapat:${id}:${tanggalParam ?? ''}`, () => detailRapat(id, tanggalParam));
  const [rsvp, setRsvp] = useState<RsvpValue | null>(null);
  const [rsvpSibuk, setRsvpSibuk] = useState(false);
  const [menu, setMenu] = useState(false);
  const [lembarPeserta, setLembarPeserta] = useState(false);
  const [lembarKemunculan, setLembarKemunculan] = useState(false);
  const [otomatis, setOtomatis] = useState<RingkasanNotulenOtomatis | null>(null);
  const [hadirVideo, setHadirVideo] = useState<KehadiranVideo | null>(null);

  const d = m.data;
  const rapat = d?.meeting ?? null;

  useEffect(() => {
    if (rapat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronkan RSVP lokal dengan data server terbaru
      setRsvp(rapat.rsvp_saya);
    }
  }, [rapat]);

  const saya = useMemo(() => {
    if (!rapat || !viewerId) {
      return { penyelenggara: false, notulis: false, diundang: false };
    }
    return {
      penyelenggara: rapat.organizer.id === viewerId,
      notulis: rapat.minute_taker?.id === viewerId,
      diundang: rapat.participants.some((p) => p.user_id === viewerId),
    };
  }, [rapat, viewerId]);
  const penulis = saya.penyelenggara || saya.notulis;
  const pengamat = rapat !== null && rapat.leadership && !saya.diundang && !saya.penyelenggara && !saya.notulis;
  const fase = rapat ? faseRapat(rapat.starts_at, rapat.ends_at, sekarang) : 'akan';
  const video = rapat?.platform === 'video';
  const kemampuan = useMemo(
    () => kemampuanTamu({
        platform: rapat?.platform ?? '',
        canceled: rapat?.canceled ?? false,
        penyelenggara: saya.penyelenggara,
        terundang: saya.penyelenggara || saya.notulis || saya.diundang,
        manageGuests: d?.can.manage_guests,
        manageLobby: d?.can.manage_lobby,
      }),
    [rapat?.platform, rapat?.canceled, saya, d?.can.manage_guests, d?.can.manage_lobby],
  );

  // Notulen otomatis + kehadiran ruang video (hanya rapat video).
  const muatTambahan = useCallback(async (): Promise<void> => {
    if (!rapat || rapat.platform !== 'video') {
      return;
    }
    const [o, k] = await Promise.allSettled([
      statusNotulenOtomatis(rapat.id, rapat.occurrence_date),
      penulis && fase !== 'akan' ? kehadiranVideo(rapat.id, rapat.occurrence_date) : Promise.resolve(null),
    ]);
    if (o.status === 'fulfilled') {
      setOtomatis(o.value);
    }
    if (k.status === 'fulfilled') {
      setHadirVideo(k.value);
    }
  }, [rapat, penulis, fase]);

  useEffect(() => {
    // Muat asinkron; setState terjadi setelah await (bukan sinkron di efek).
    const t = setTimeout(() => void muatTambahan(), 0);
    return () => clearTimeout(t);
  }, [muatTambahan]);

  useEffect(() => {
    if (!video || fase !== 'berlangsung') {
      return undefined;
    }
    const t = setInterval(() => void muatTambahan(), 30_000);
    return () => clearInterval(t);
  }, [video, fase, muatTambahan]);

  async function jawab(nilai: Jawaban, ulang = false): Promise<void> {
    if (!rapat || rsvpSibuk) {
      return;
    }
    const lama = rsvp;
    setRsvp(nilai);
    setRsvpSibuk(true);
    try {
      const hasil = await rsvpRapat(rapat.id, nilai);
      setRsvp(hasil);
      const label = LABEL_RSVP[hasil];
      const bisaUrung = !ulang && lama !== null && lama !== 'pending' && lama !== nilai;
      snackbar.show({
        message: `Kehadiran disimpan: ${label}`,
        variant: 'ok',
        actionLabel: bisaUrung ? 'Urungkan' : undefined,
        onAction: bisaUrung ? () => void jawab(lama as Jawaban, true) : undefined,
      });
    } catch (err) {
      setRsvp(lama);
      const offline = err instanceof ApiError && err.status === 0;
      snackbar.show({
        message: offline ? 'Tidak ada jaringan · jawaban dikembalikan' : err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Kehadiran gagal disimpan. Coba lagi.',
        variant: offline ? 'offline' : 'bad',
        actionLabel: 'Coba lagi',
        onAction: () => void jawab(nilai, ulang),
      });
    } finally {
      setRsvpSibuk(false);
    }
  }

  async function batalkan(): Promise<void> {
    if (!rapat) {
      return;
    }
    setMenu(false);
    const seri = rapat.recurrence !== 'none';
    const ok = await dialog.confirm({
      title: 'Batalkan rapat ini?',
      message: seri
        ? 'Seluruh seri rapat berulang ini dibatalkan dan peserta diberi tahu. Notulen yang sudah ada tetap bisa dibaca.\n\nPembatalan satu tanggal saja belum tersedia.'
        : 'Rapat dibatalkan dan peserta diberi tahu. Notulen yang sudah ada tetap bisa dibaca.',
      confirmLabel: seri ? 'Batalkan seri' : 'Batalkan rapat',
      cancelLabel: 'Tidak jadi',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      const hasil = await batalkanRapat(rapat.id);
      m.setData((lama) => (lama ? { ...lama, meeting: { ...lama.meeting, ...hasil.meeting, canceled: true }, can: hasil.can, video: hasil.video } : lama));
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Rapat gagal dibatalkan.', variant: 'bad' });
    }
  }

  function tautanRapat(): string {
    return `${webBase()}/rapat/${id}`;
  }

  function bagikan(ringkasan: boolean): void {
    setMenu(false);
    if (!rapat) {
      return;
    }
    const baris = ringkasan
      ? [rapat.title, `${hariPanjang(rapat.occurrence_date)} · ${rentangJam(rapat.starts_at, rapat.ends_at)} WIB`, rapat.platform_label + (rapat.location ? ` · ${rapat.location}` : ''), rapat.agenda_items.length ? `Agenda:\n${rapat.agenda_items.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : '', rapat.join_url ?? tautanRapat()]
      : [rapat.title, rapat.join_url ?? tautanRapat()];
    void Share.share({ message: baris.filter(Boolean).join('\n') }).catch(() => undefined);
  }

  function gabung(): void {
    if (!rapat) {
      return;
    }
    if (video) {
      bukaPraGabung(rapat.id, rapat.occurrence_date);
    } else if (rapat.join_url) {
      void bukaTautan(rapat.join_url).then((ok) => {
        if (!ok) {
          snackbar.show({ message: 'Tautan tidak bisa dibuka di perangkat ini.', variant: 'bad' });
        }
      });
    }
  }

  const header = (
    <SubAppBar
      title="Detail rapat"
      actions={
        rapat
          ? [
              ...(d?.can.edit && !rapat.canceled ? [{ icon: 'pencil' as const, label: 'Ubah rapat', onPress: () => router.push({ pathname: '/rapat/[id]/ubah', params: { id: rapat.id } } as never) }] : []),
              { icon: 'ellipsis' as const, label: 'Menu rapat', onPress: () => setMenu(true) },
            ]
          : []
      }
    />
  );

  if (m.status === 'mati' || (m.status === 'terlarang' && !rapat)) {
    return (
      <Screen header={<SubAppBar title="Detail rapat" />}>
        <EmptyState icon="calendar-x" title="Rapat tidak ditemukan" description="Rapat tidak ada atau Anda tidak memiliki akses. Bisa jadi Anda sudah dikeluarkan dari daftar undangan." actionLabel="Kembali ke agenda" onAction={() => router.replace('/rapat')} />
      </Screen>
    );
  }
  if (!rapat) {
    return (
      <Screen header={header}>
        {m.status === 'memuat' ? <Loading label="Memuat rapat…" /> : <ErrorState kind={m.status === 'offline' ? 'offline' : 'umum'} title="Rapat tidak dapat dimuat" message={m.galat?.message ?? 'Coba lagi beberapa saat.'} onRetry={() => void m.muat()} />}
      </Screen>
    );
  }

  const v = d?.video ?? null;
  const mulaiMs = new Date(rapat.starts_at).getTime();
  const bukaMs = v ? new Date(v.opens_at).getTime() : mulaiMs - 15 * 60_000;
  const ruangTerbuka = v !== null && v.can_join && sekarang >= bukaMs;
  const seri = lencanaSeri(rapat.recurrence);
  const jmlHadir = rapat.participants.filter((p) => p.rsvp === 'yes').length;
  const jmlMungkin = rapat.participants.filter((p) => p.rsvp === 'maybe').length;
  const ringkasRsvp = [jmlHadir ? `${jmlHadir} hadir` : '', jmlMungkin ? `${jmlMungkin} mungkin` : ''].filter(Boolean).join(' · ');
  const inRoom = hadirVideo?.in_room ?? 0;
  const tamuHadir = hadirVideo?.guests ?? [];
  const tamuDiRuang = tamuHadir.filter((g) => g.in_room).length;

  const labelPeranPeserta = (uid: string | null, opsional: boolean): string => {
    const peran = uid === rapat.organizer.id ? 'Penyelenggara' : uid !== null && uid === rapat.minute_taker?.id ? 'Notulis' : 'Peserta';
    return opsional ? `${peran} · opsional` : peran;
  };
  const namaPeserta = (p: (typeof rapat.participants)[number]): string => `${p.nama ?? p.guest_name ?? p.email ?? 'Peserta'}${p.user_id === viewerId ? ' (Anda)' : ''}`;

  // Kartu ruang video.
  let kartuVideo: React.ReactNode = null;
  if (video && !rapat.canceled) {
    let judul: string;
    let sub: string;
    let tombol: React.ReactNode;
    if (!v || !v.configured) {
      judul = 'Video RuangKerja belum disiapkan';
      sub = 'Video RuangKerja belum disiapkan di server ini. Hubungi admin.';
      tombol = null;
    } else if (pengamat) {
      judul = fase === 'berlangsung' ? 'Rapat sedang berlangsung' : 'Ruang rapat video';
      sub = 'Pengamat rapat pimpinan tidak bisa masuk ruang.';
      tombol = <Button title="Gabung rapat video" icon="video" variant="secondary" disabled disabledReason="Pengamat rapat pimpinan tidak bisa masuk ruang." onPress={() => undefined} />;
    } else if (ruangTerbuka || (v.can_join && saya.penyelenggara)) {
      judul = fase === 'berlangsung' ? 'Rapat sedang berlangsung' : 'Ruang rapat terbuka';
      sub = hadirVideo ? `${inRoom} orang di ruang rapat · ${fase === 'berlangsung' ? `mulai ${jam(rapat.starts_at)}` : 'diperbarui tiap 30 detik'}` : fase === 'berlangsung' ? `Mulai ${jam(rapat.starts_at)}` : `Rapat mulai ${jam(rapat.starts_at)}`;
      tombol = <Button title={fase === 'berlangsung' ? 'Gabung sekarang' : 'Gabung rapat video'} icon="video" onPress={gabung} />;
    } else if (sekarang < bukaMs) {
      judul = `Ruang dibuka dalam ${teksSelang(bukaMs - sekarang)}`;
      sub = `Ruang rapat dibuka pukul ${jam(new Date(bukaMs))} (15 menit sebelum mulai).`;
      tombol = <Button title={`Gabung rapat video · ${jam(new Date(bukaMs))}`} icon="clock" variant="secondary" disabled disabledReason={`Ruang dibuka pukul ${jam(new Date(bukaMs))}`} onPress={() => undefined} />;
    } else {
      judul = fase === 'selesai' ? 'Ruang rapat ditutup' : 'Ruang rapat belum bisa dibuka';
      sub = v.denied_reason ?? 'Rapat sudah selesai. Ruang rapat sudah ditutup.';
      tombol = null;
    }
    kartuVideo = (
      <Card style={{ gap: 12, backgroundColor: colors.linkSoft }}>
        <View style={s.baris}>
          <IconTile icon="video" tone="teal" />
          <View style={{ flex: 1 }}>
            <Text variant="title">{judul}</Text>
            <Text variant="meta">{sub}</Text>
          </View>
        </View>
        {tombol}
        <View style={s.baris}>
          <Text variant="meta" style={{ flex: 1 }}>
            Hanya yang diundang. Ruang tidak direkam.
          </Text>
          <Pressable onPress={() => bagikan(false)} accessibilityRole="button" accessibilityLabel="Bagikan tautan rapat" hitSlop={8} style={s.tautanKecil}>
            <Icon name="link" size={18} color={colors.link} />
            <Text variant="label" tone="link">
              Bagikan tautan
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  } else if ((rapat.platform === 'meet' || rapat.platform === 'zoom') && !rapat.canceled) {
    kartuVideo = (
      <Card style={{ gap: 10 }}>
        <Text variant="label">Tautan rapat</Text>
        {rapat.join_url ? (
          <>
            <Text variant="body" tone="link" numberOfLines={2}>
              {rapat.join_url.replace(/^https?:\/\//, '')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Bagikan tautan" variant="outline" size="sm" icon="share-2" onPress={() => bagikan(false)} style={{ flex: 1 }} />
              <Button title="Buka" variant="tonal" size="sm" icon="external-link" onPress={gabung} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <Text variant="meta">Penyelenggara belum menempel tautan rapat.</Text>
        )}
        <Text variant="meta">{rapat.platform === 'meet' ? 'Dibuka di aplikasi Google Meet atau browser. Tautan otomatis lewat Google Calendar ditahan.' : 'Dibuka di aplikasi Zoom atau browser.'}</Text>
      </Card>
    );
  } else if (rapat.location) {
    kartuVideo = (
      <Card style={{ gap: 6 }}>
        <Text variant="label">Lokasi</Text>
        <Text variant="body">{rapat.location}</Text>
        {rapat.platform === 'room' ? <Text variant="meta">Rapat tatap muka · tidak ada tautan daring</Text> : null}
      </Card>
    );
  }

  // Bilah aksi bawah.
  let bilah: React.ReactNode = null;
  if (!rapat.canceled && !pengamat && fase !== 'selesai') {
    const ubah = d?.can.edit ? <Button title="Ubah" variant="outline" icon="pencil" onPress={() => router.push({ pathname: '/rapat/[id]/ubah', params: { id: rapat.id } } as never)} style={{ flex: 1 }} /> : null;
    if (video && v?.configured) {
      const siap = ruangTerbuka || (v.can_join && saya.penyelenggara);
      bilah = (
        <>
          {ubah}
          <Button
            title={siap ? (fase === 'berlangsung' ? 'Gabung sekarang' : 'Gabung rapat video') : `Gabung rapat video · dibuka ${jam(new Date(bukaMs))}`}
            icon={siap ? 'video' : 'clock'}
            variant={siap ? 'primary' : 'secondary'}
            disabled={!siap}
            disabledReason={siap ? undefined : `Ruang dibuka pukul ${jam(new Date(bukaMs))}`}
            onPress={gabung}
            style={{ flex: 1.4 }}
          />
        </>
      );
    } else if (rapat.join_url && (rapat.platform === 'meet' || rapat.platform === 'zoom')) {
      bilah = (
        <>
          {ubah}
          <Button title={`Gabung lewat ${rapat.platform === 'meet' ? 'Google Meet' : 'Zoom'}`} icon="external-link" onPress={gabung} style={{ flex: 1.4 }} />
        </>
      );
    }
  }

  const statusNotulen = rapat.notulen.status;
  const tombolNotulen =
    statusNotulen === 'none' ? (penulis && !rapat.canceled ? (fase === 'akan' ? 'Mulai notulen' : 'Tulis notulen') : 'Lihat notulen') : penulis && statusNotulen === 'draft' ? 'Lanjutkan notulen' : statusNotulen === 'final' ? 'Lihat notulen' : 'Baca notulen';
  const kemunculan = rapat.recurrence !== 'none' ? kemunculanSeri(rapat.recurrence, rapat.occurrence_date, rapat.recurrence_until) : [];
  const hariIni = ymdHariIni();

  return (
    <Screen header={header} footer={bilah} refreshing={m.menyegarkan} onRefresh={() => void Promise.all([m.muat(), muatTambahan()])}>
      {m.dariCache !== null ? <Banner tone="neutral" icon="cloud-off" message="Tanpa koneksi. Menampilkan data terakhir. Gabung video dan jawaban kehadiran butuh jaringan." /> : null}
      <View style={{ gap: 8 }}>
        <View style={s.bungkus}>
          <LencanaPlatform platform={rapat.platform} />
          {saya.penyelenggara ? (
            <Badge tone="info" dot={false}>
              Penyelenggara
            </Badge>
          ) : null}
          {rapat.leadership ? (
            <Badge tone="info" dot={false}>
              Rapat pimpinan
            </Badge>
          ) : null}
          {seri ? (
            <Badge tone="neutral" dot={false}>
              {seri}
            </Badge>
          ) : null}
          {saya.notulis ? <Badge tone="warning">Notulis: Anda</Badge> : null}
          {rapat.canceled ? <Badge tone="danger">Dibatalkan</Badge> : fase === 'selesai' ? <Badge tone="neutral">Selesai</Badge> : null}
          {!rapat.canceled && !saya.penyelenggara && rsvp === 'pending' && d?.can.rsvp ? <Badge tone="info">Belum dijawab</Badge> : null}
        </View>
        <Text variant="h1" style={rapat.canceled ? { textDecorationLine: 'line-through' } : null}>
          {rapat.title}
        </Text>
        <Text variant="meta" style={{ fontSize: 15 }}>
          {hariPanjang(rapat.occurrence_date)} · {rentangJam(rapat.starts_at, rapat.ends_at)} WIB{rapat.workspace ? ` · ${rapat.workspace.key}` : ''}
        </Text>
      </View>

      {rapat.canceled ? <Banner tone="bad" icon="calendar-x" message="Rapat ini dibatalkan. Penyelenggara dan peserta sudah diberi tahu. Notulen yang ada tetap bisa dibaca." /> : null}
      {pengamat ? <Banner tone="info" icon="eye" message="Mode lihat saja. Anda melihat rapat ini karena rapat pimpinan, bukan karena diundang. Anda tidak bisa menjawab undangan atau masuk ruang video." /> : null}
      {!rapat.canceled && fase === 'akan' && mulaiMs - sekarang < 24 * 3_600_000 ? (
        <Banner tone="warn" icon="clock" message={`Mulai ${teksSelang(mulaiMs - sekarang)} lagi.${video ? ` Ruang video dibuka pukul ${jam(new Date(bukaMs))}.` : ''}`} />
      ) : null}
      {!rapat.canceled && fase === 'selesai' && statusNotulen === 'none' && penulis ? (
        <Card style={{ gap: 10 }}>
          <Text variant="body">Notulen belum ditulis.</Text>
          <Button title="Tulis notulen" icon="file-pen" onPress={() => bukaNotulen(rapat.id, rapat.occurrence_date)} />
          {rapat.auto_minutes ? <Text variant="meta">Atau periksa draf notulen otomatis bila sudah siap.</Text> : null}
        </Card>
      ) : null}

      {kartuVideo}

      {video && !rapat.canceled ? (
        <KartuTamu
          rapatId={rapat.id}
          tanggal={rapat.occurrence_date}
          judul={rapat.title}
          waktuLabel={`${hariPanjang(rapat.occurrence_date)} · ${rentangJam(rapat.starts_at, rapat.ends_at)} WIB`}
          kemampuan={kemampuan}
          jumlahTamu={jumlahTamuDariPeserta(rapat.participants)}
          bukaOtomatis={bukaTamu}
        />
      ) : null}

      {d?.can.rsvp && !rapat.canceled ? (
        <Card style={{ gap: 10 }}>
          <Text variant="h3">Kehadiran saya</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PILIHAN.map((p) => {
              const aktif = rsvp === p.nilai;
              return (
                <Pressable
                  key={p.nilai}
                  onPress={() => void jawab(p.nilai)}
                  disabled={rsvpSibuk}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: aktif }}
                  accessibilityLabel={p.label}
                  style={[s.pilihan, { borderColor: aktif ? colors.primary : colors.borderStrong, backgroundColor: aktif ? colors.linkSoft : colors.surface }]}
                >
                  <Icon name={p.ikon} size={20} color={aktif ? colors.link : colors.muted} />
                  <Text variant="label" tone={aktif ? 'link' : 'text'}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="meta">Jawaban berlaku untuk seluruh seri rapat.</Text>
        </Card>
      ) : null}

      {penulis && video && hadirVideo && (hadirVideo.attendance.length > 0 || (hadirVideo.guests ?? []).length > 0) ? (
        <Card style={{ gap: 4 }}>
          <View style={s.baris}>
            <Text variant="h3" style={{ flex: 1 }}>
              Hadir di rapat video
            </Text>
            {inRoom > 0 ? <Badge tone="success">{`${inRoom} di ruang`}</Badge> : null}
          </View>
          {hadirVideo.attendance.map((a, i) => {
            const orang = rapat.participants.find((p) => p.user_id === a.user_id);
            const nama = orang?.nama ?? 'Peserta';
            const sub = a.in_room ? `Masuk ${jam(a.joined_at)} · di ruang` : `Masuk ${jam(a.joined_at)} · keluar ${jam(a.left_at)} · ${Math.max(1, Math.round(a.duration_seconds / 60))} mnt`;
            return <BarisOrang key={`${a.user_id}-${i}`} nama={nama} sub={sub} divider={i > 0} kanan={a.late ? <Badge tone="warning">{`Terlambat ${a.late_minutes} mnt`}</Badge> : <Badge tone="success">Hadir</Badge>} />;
          })}
          {tamuHadir.length > 0 ? (
            <>
              <Text variant="overline" tone="muted" style={{ marginTop: 8 }}>
                {`Tamu eksternal (${tamuHadir.length}${tamuDiRuang > 0 ? ` · ${tamuDiRuang} di ruang` : ''})`}
              </Text>
              {tamuHadir.map((g, i) => {
                const sub = g.in_room ? `Masuk ${jam(g.joined_at)} · di ruang` : `Masuk ${jam(g.joined_at)} · keluar ${jam(g.left_at)} · ${Math.max(1, Math.round(g.duration_seconds / 60))} mnt`;
                return <BarisOrang key={`${g.participant_id}-${i}`} nama={pastikanAkhiranTamu(g.name)} sub={sub} divider={i > 0} kanan={<Badge tone="info">Tamu</Badge>} />;
              })}
            </>
          ) : null}
        </Card>
      ) : null}

      {rapat.agenda_items.length > 0 || rapat.description ? (
        <Card style={{ gap: 12 }}>
          <Text variant="h3">Agenda</Text>
          {rapat.agenda_items.map((a, i) => (
            <View key={`${i}-${a}`} style={s.baris}>
              <NomorAgenda n={i + 1} />
              <Text variant="body" style={{ flex: 1 }}>
                {a}
              </Text>
            </View>
          ))}
          {rapat.description ? (
            <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
              {rapat.description}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 4 }}>
        <View style={s.baris}>
          <Text variant="h3" style={{ flex: 1 }}>
            Peserta ({rapat.participants.length})
          </Text>
          {ringkasRsvp ? <Text variant="meta">{ringkasRsvp}</Text> : null}
        </View>
        {rapat.participants.slice(0, 5).map((p, i) => (
          <BarisOrang key={`${p.user_id ?? p.email}-${i}`} nama={namaPeserta(p)} sub={p.user_id ? labelPeranPeserta(p.user_id, p.optional) : 'Tamu eksternal · masuk lewat tautan pribadi'} divider={i > 0} kanan={<Badge tone={TONE_RSVP[p.rsvp]}>{LABEL_RSVP[p.rsvp]}</Badge>} />
        ))}
        {rapat.participants.length > 5 ? <Button title="Lihat semua peserta" variant="quiet" onPress={() => setLembarPeserta(true)} /> : null}
      </Card>

      <Card style={{ gap: 0 }}>
        <BarisInfo label="Penyelenggara" nilai={rapat.organizer.name ?? '—'} />
        {rapat.minute_taker ? <BarisInfo divider label="Notulis" nilai={rapat.minute_taker.name ?? '—'} /> : null}
        {rapat.workspace ? <BarisInfo divider label="Workspace" nilai={`${rapat.workspace.name} · ${rapat.workspace.key}`} /> : null}
        {rapat.recurrence !== 'none' ? <BarisInfo divider label="Berulang" nilai={labelBerulang(rapat.recurrence, rapat.occurrence_date, rapat.recurrence_until) ?? '—'} /> : null}
        <BarisInfo divider label="Pengingat" nilai={labelPengingat(rapat.reminders)} />
      </Card>

      {video && otomatis ? <KartuNotulenOtomatis rapatId={rapat.id} tanggal={rapat.occurrence_date} data={otomatis} onUbah={setOtomatis} onBuka={() => bukaTranskrip(rapat.id, rapat.occurrence_date)} dibatalkan={rapat.canceled} /> : null}

      <Card style={{ gap: 12 }}>
        <View style={s.baris}>
          <Text variant="h3" style={{ flex: 1 }}>
            Notulen
          </Text>
          <Badge tone={statusNotulen === 'final' ? 'success' : statusNotulen === 'draft' ? 'warning' : 'neutral'}>{statusNotulen === 'final' ? 'Final' : statusNotulen === 'draft' ? 'Draf' : 'Belum ada'}</Badge>
        </View>
        <Button title={tombolNotulen} variant="outline" icon="file-text" onPress={() => bukaNotulen(rapat.id, rapat.occurrence_date)} />
      </Card>

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        {d?.can.edit && !rapat.canceled ? (
          <SheetAction
            icon="pencil"
            label="Ubah rapat"
            onPress={() => {
              setMenu(false);
              router.push({ pathname: '/rapat/[id]/ubah', params: { id: rapat.id } } as never);
            }}
          />
        ) : null}
        <SheetAction icon="link" label="Bagikan tautan rapat" onPress={() => bagikan(false)} />
        <SheetAction icon="share-2" label="Bagikan ringkasan rapat" onPress={() => bagikan(true)} />
        {kemunculan.length > 1 ? (
          <SheetAction
            icon="repeat"
            label="Pilih kemunculan seri"
            onPress={() => {
              setMenu(false);
              setLembarKemunculan(true);
            }}
          />
        ) : null}
        <SheetAction
          icon="file-text"
          label="Notulen"
          onPress={() => {
            setMenu(false);
            bukaNotulen(rapat.id, rapat.occurrence_date);
          }}
        />
        {d?.can.edit && !rapat.canceled ? <SheetAction icon="calendar-x" label="Batalkan rapat" tone="danger" onPress={() => void batalkan()} /> : null}
      </BottomSheet>

      <BottomSheet visible={lembarPeserta} onClose={() => setLembarPeserta(false)} title={`Peserta (${rapat.participants.length})`} scrollable>
        <Text variant="meta">
          {`${jmlHadir} hadir · ${jmlMungkin} mungkin · ${rapat.participants.filter((p) => p.rsvp === 'no').length} tidak hadir · ${rapat.participants.filter((p) => p.rsvp === 'pending').length} belum menjawab`}
        </Text>
        {rapat.participants.map((p, i) => (
          <BarisOrang key={`${p.user_id ?? p.email}-${i}`} nama={namaPeserta(p)} sub={p.user_id ? labelPeranPeserta(p.user_id, p.optional) : 'Tamu eksternal · tautan pribadi'} divider={i > 0} kanan={<Badge tone={TONE_RSVP[p.rsvp]}>{LABEL_RSVP[p.rsvp]}</Badge>} />
        ))}
      </BottomSheet>

      <BottomSheet visible={lembarKemunculan} onClose={() => setLembarKemunculan(false)} title="Kemunculan rapat">
        <Text variant="meta">{`${labelBerulang(rapat.recurrence, rapat.occurrence_date, rapat.recurrence_until) ?? ''} · ${rentangJam(rapat.starts_at, rapat.ends_at)}`}</Text>
        {kemunculan.map((k) => {
          const ket = k === hariIni ? 'Hari ini' : k < hariIni ? 'Sudah lewat' : 'Akan datang';
          const ketNotulen = k === rapat.occurrence_date ? ` · ${statusNotulen === 'final' ? 'notulen final' : statusNotulen === 'draft' ? 'notulen draf' : 'notulen belum ada'}` : '';
          return (
            <Radio
              key={k}
              selected={k === rapat.occurrence_date}
              label={hariSingkat(k)}
              description={`${ket}${ketNotulen}`}
              onSelect={() => {
                setLembarKemunculan(false);
                if (k !== rapat.occurrence_date) {
                  router.setParams({ tanggal: k });
                }
              }}
            />
          );
        })}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pilihan: { flex: 1, minHeight: 64, borderRadius: radius.control, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  tautanKecil: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
});
