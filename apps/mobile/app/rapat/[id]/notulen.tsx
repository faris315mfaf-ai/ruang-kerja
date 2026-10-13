/**
 * Notulen satu kemunculan (mockup 08 › 21–23): draf tulis (notulis/
 * penyelenggara) dengan simpan otomatis (PUT, debounce) + penanda "sedang
 * menyunting", kehadiran (hadir/alasan), catatan per agenda, keputusan,
 * tindak lanjut; finalkan (daftar masalah 422), buka kembali (penyelenggara),
 * riwayat versi + pratinjau, pilihan sumber notulen (rapat video, sekali),
 * baca-saja peserta, belum dimulai, offline (antre di perangkat).
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { ApiError, webBase } from '@/api/client';
import { notulenRapat } from '@/api/endpoints';
import {
  bacaVersi,
  bukaKembaliNotulen,
  daftarTindakLanjut,
  daftarVersi,
  finalkanNotulen,
  pilihSumberNotulen,
  simpanNotulen,
  tandaiMenyunting,
  type DaftarTindakLanjut,
  type IsiNotulen,
  type IsiVersi,
  type Notulen,
  type PenandaMenyunting,
  type SumberNotulen,
  type VersiNotulen,
} from '@/api/rapat';
import type { MeetingMinutesResponse } from '@/api/types';
import { NomorAgenda, BarisOrang } from '@/features/rapat/komponen';
import { TindakLanjutKartu, type OrangRapat } from '@/features/rapat/TindakLanjut';
import { hariSingkatTahun, rentangJam } from '@/features/rapat/util';
import { jam, ymdHariIni } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import {
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  Loading,
  Pressable,
  Screen,
  SheetAction,
  SubAppBar,
  Switch,
  Text,
  useDialog,
  useSnackbar,
} from '@/ui';
import { useSession } from '@/session/SessionProvider';

type StatusSimpan = 'tersimpan' | 'menyimpan' | 'tertunda' | 'gagal';

function isiDari(n: Notulen): IsiNotulen {
  return { attendance: n.attendance, sections: n.sections, decisions: n.decisions };
}

function waktuSimpan(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const tgl = iso.slice(0, 10);
  return tgl === ymdHariIni() ? jam(iso) : `${hariSingkatTahun(tgl)} ${jam(iso)}`;
}

export default function LayarNotulen(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { user } = useSession();
  const viewerId = user?.id ?? null;
  const param = useLocalSearchParams<{ id: string; tanggal?: string }>();
  const id = typeof param.id === 'string' ? param.id : '';
  const tanggal = typeof param.tanggal === 'string' && param.tanggal !== '' ? param.tanggal : null;

  const [data, setData] = useState<MeetingMinutesResponse | null>(null);
  const [tl, setTl] = useState<DaftarTindakLanjut | null>(null);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [isi, setIsi] = useState<IsiNotulen | null>(null);
  const [status, setStatus] = useState<StatusSimpan>('tersimpan');
  const [penyunting, setPenyunting] = useState<PenandaMenyunting | null>(null);
  const [lembar, setLembar] = useState<null | 'menu' | 'versi' | 'masalah' | 'hadir'>(null);
  const [versi, setVersi] = useState<VersiNotulen[] | null>(null);
  const [pratinjau, setPratinjau] = useState<IsiVersi | null>(null);
  const [masalah, setMasalah] = useState<string[]>([]);
  const [hadirDipilih, setHadirDipilih] = useState<{ user_id: string; present: boolean; reason: string } | null>(null);
  const [keputusanBaru, setKeputusanBaru] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const rev = useRef(0);
  const isiRef = useRef<IsiNotulen | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simpanRef = useRef<(() => Promise<void>) | null>(null);

  const notulen = data?.notulen ?? null;
  const rapat = data?.meeting ?? null;
  const tgl = rapat?.occurrence_date ?? tanggal;
  const bolehTulis = tl?.can.edit === true;
  const bolehKelola = tl?.can.manage === true;
  const final = notulen?.status === 'final';
  const modeTulis = bolehTulis && !final;
  const penyelenggara = rapat !== null && rapat.organizer.id === viewerId;
  const offline = status === 'tertunda';

  const muat = useCallback(async (diam = false): Promise<void> => {
    try {
      const [n, t] = await Promise.all([notulenRapat(id, tanggal), daftarTindakLanjut(id, tanggal).catch(() => null)]);
      setData(n);
      if (t) {
        setTl(t);
      }
      setGalat(null);
      // Jangan timpa ketikan lokal yang belum tersimpan.
      if (timer.current === null && (status === 'tersimpan' || !diam)) {
        setIsi(isiDari(n.notulen));
        isiRef.current = isiDari(n.notulen);
      }
    } catch (err) {
      if (!diam) {
        setGalat(err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Notulen tidak dapat dimuat.' }));
      }
    }
  }, [id, tanggal, status]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muat awal per rapat/kemunculan
  }, [id, tanggal]);

  // Polling: pembaca 30 detik; penulis 30 detik bila tidak ada perubahan lokal.
  useFocusEffect(
    useCallback(() => {
      const t = setInterval(() => {
        if (timer.current === null) {
          void muat(true);
        }
      }, 30_000);
      return () => clearInterval(t);
    }, [muat]),
  );

  // Penanda "sedang menyunting" (TTL 30 detik di server → kirim tiap 20 detik).
  useFocusEffect(
    useCallback(() => {
      if (!modeTulis || !id) {
        return undefined;
      }
      let aktif = true;
      const kirim = (): void => {
        tandaiMenyunting(id, tgl, true)
          .then((p) => {
            if (aktif) {
              setPenyunting(p);
            }
          })
          .catch(() => undefined);
      };
      kirim();
      const t = setInterval(kirim, 20_000);
      return () => {
        aktif = false;
        clearInterval(t);
        void tandaiMenyunting(id, tgl, false).catch(() => undefined);
      };
    }, [modeTulis, id, tgl]),
  );

  const simpan = useCallback(async (): Promise<void> => {
    timer.current = null;
    const isiKini = isiRef.current;
    if (!isiKini || !id) {
      return;
    }
    const r = rev.current;
    setStatus('menyimpan');
    try {
      const baru = await simpanNotulen(id, tgl, isiKini);
      setData((lama) => (lama ? { ...lama, notulen: r === rev.current ? baru : { ...baru, attendance: lama.notulen.attendance, sections: lama.notulen.sections, decisions: lama.notulen.decisions } } : lama));
      setStatus(r === rev.current ? 'tersimpan' : 'menyimpan');
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setStatus('tertunda');
        // Coba kirim ulang otomatis.
        timer.current = setTimeout(() => void simpanRef.current?.(), 10_000);
      } else {
        setStatus('gagal');
        snackbar.show({ message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Notulen gagal disimpan.', variant: 'bad', actionLabel: 'Coba lagi', onAction: () => void simpanRef.current?.() });
      }
    }
  }, [id, tgl, snackbar]);

  useEffect(() => {
    simpanRef.current = simpan;
  }, [simpan]);

  function ubahIsi(fn: (lama: IsiNotulen) => IsiNotulen, segera = false): void {
    setIsi((lama) => {
      if (!lama) {
        return lama;
      }
      const baru = fn(lama);
      isiRef.current = baru;
      return baru;
    });
    rev.current += 1;
    if (status !== 'tertunda') {
      setStatus('menyimpan');
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => void simpan(), segera ? 50 : 1200);
  }

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void simpan();
      }
    },
    [simpan],
  );

  async function flush(): Promise<boolean> {
    if (timer.current) {
      clearTimeout(timer.current);
      await simpan();
    }
    return timer.current === null;
  }

  async function finalkan(): Promise<void> {
    if (!rapat || sibuk) {
      return;
    }
    const ok = await dialog.confirm({
      title: 'Finalkan dan bagikan?',
      message: `Setelah difinalkan: notulen terkunci, dibagikan ke ${rapat.participants.length} peserta, dan tindak lanjut menjadi checklist yang bisa dicentang PIC-nya. Penyelenggara bisa membukanya lagi.`,
      confirmLabel: 'Finalkan',
      cancelLabel: 'Lengkapi dulu',
    });
    if (!ok) {
      return;
    }
    setSibuk(true);
    try {
      if (!(await flush())) {
        snackbar.show({ message: 'Perubahan belum tersimpan. Finalkan butuh jaringan.', variant: 'offline' });
        return;
      }
      const hasil = await finalkanNotulen(rapat.id, tgl);
      setData((l) => (l ? { ...l, notulen: hasil.notulen } : l));
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setMasalah(Object.values(err.errors).flat());
        setLembar('masalah');
      } else {
        snackbar.show({ message: err instanceof ApiError ? err.message : 'Notulen gagal difinalkan.', variant: 'bad' });
      }
    } finally {
      setSibuk(false);
    }
  }

  async function bukaKembali(): Promise<void> {
    if (!rapat) {
      return;
    }
    setLembar(null);
    const ok = await dialog.confirm({ title: 'Buka kembali sebagai draf?', message: 'Notulen tidak lagi terkunci dan notulis bisa mengubahnya. Peserta melihat draf sampai difinalkan lagi.', confirmLabel: 'Buka kembali' });
    if (!ok) {
      return;
    }
    try {
      const hasil = await bukaKembaliNotulen(rapat.id, tgl);
      setData((l) => (l ? { ...l, notulen: hasil.notulen } : l));
      setIsi(isiDari(hasil.notulen));
      isiRef.current = isiDari(hasil.notulen);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Notulen gagal dibuka kembali.', variant: 'bad' });
    }
  }

  async function bukaVersi(): Promise<void> {
    setLembar('versi');
    setVersi(null);
    setPratinjau(null);
    try {
      const r = await daftarVersi(id, tgl);
      setVersi(r.versions);
    } catch {
      setVersi([]);
    }
  }

  async function pilihSumber(sumber: SumberNotulen): Promise<void> {
    setSibuk(true);
    try {
      const hasil = await pilihSumberNotulen(id, tgl, sumber);
      setData((l) => (l ? { ...l, notulen: hasil.notulen } : l));
      setIsi(isiDari(hasil.notulen));
      isiRef.current = isiDari(hasil.notulen);
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Pilihan gagal disimpan.', variant: 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  function bagikan(): void {
    if (!rapat || !isi) {
      return;
    }
    const teks = [
      `Notulen — ${rapat.title}`,
      `${hariSingkatTahun(rapat.occurrence_date)} · ${rentangJam(rapat.starts_at, rapat.ends_at)} WIB`,
      ...isi.sections.map((sec, i) => `\n${i + 1}. ${sec.title}\n${sec.body}`),
      isi.decisions.length ? `\nKeputusan:\n${isi.decisions.map((k) => `• ${k}`).join('\n')}` : '',
      `\n${webBase()}${notulen?.href ?? `/rapat/${id}/notulen`}`,
    ];
    void Share.share({ message: teks.filter(Boolean).join('\n') }).catch(() => undefined);
  }

  const header = (
    <SubAppBar
      title="Notulen"
      actions={rapat ? [{ icon: 'ellipsis', label: 'Menu notulen', onPress: () => setLembar('menu') }] : []}
    />
  );

  if (galat && !data) {
    const tidakAda = galat.status === 404 || galat.status === 403;
    return (
      <Screen header={<SubAppBar title="Notulen" />}>
        {tidakAda ? (
          <EmptyState icon="file-x" title="Notulen tidak ditemukan" description="Rapat tidak ada atau Anda tidak memiliki akses ke notulennya." actionLabel="Kembali" onAction={() => router.back()} />
        ) : (
          <ErrorState kind={galat.status === 0 ? 'offline' : 'umum'} title="Notulen tidak dapat dimuat" message={galat.message} onRetry={() => void muat()} />
        )}
      </Screen>
    );
  }
  if (!data || !rapat || !notulen || !isi) {
    return (
      <Screen header={header}>
        <Loading label="Memuat notulen…" />
      </Screen>
    );
  }

  const orang: OrangRapat[] = rapat.participants.filter((p) => p.user_id).map((p) => ({ id: p.user_id as string, nama: p.nama ?? 'Peserta' }));
  for (const p of data.people) {
    if (!orang.some((o) => o.id === p.id)) {
      orang.push({ id: p.id, nama: p.name });
    }
  }
  const namaOrang = (uid: string): string => orang.find((o) => o.id === uid)?.nama ?? 'Peserta';
  const jmlHadir = isi.attendance.filter((a) => a.present).length;
  const belumDimulai = notulen.id === null && !bolehTulis;
  const bolehPilihSumber = modeTulis && notulen.id === null && notulen.source === null && rapat.platform === 'video';
  const orangLain = penyunting && penyunting.user_id !== viewerId ? penyunting : null;

  const statusTeks =
    status === 'menyimpan'
      ? 'Menyimpan…'
      : status === 'tertunda'
        ? 'Perubahan belum tersimpan'
        : status === 'gagal'
          ? 'Gagal menyimpan'
          : final
            ? `Difinalkan · ${waktuSimpan(notulen.finalized_at)}`
            : notulen.saved_at
              ? `${modeTulis ? 'Disimpan' : 'Diperbarui'} ${waktuSimpan(notulen.saved_at)}${notulen.version_count ? ` · ${notulen.version_count} versi` : ''}`
              : 'Belum disimpan';

  let footer: React.ReactNode = null;
  if (modeTulis) {
    footer = (
      <>
        <IconButton icon="history" label="Riwayat versi" onPress={() => void bukaVersi()} />
        <Button title={offline ? 'Finalkan & bagikan · butuh jaringan' : 'Finalkan & bagikan'} icon="send" disabled={offline} loading={sibuk} onPress={() => void finalkan()} style={{ flex: 1 }} />
      </>
    );
  } else if (final && (penyelenggara || bolehKelola)) {
    footer = (
      <>
        {penyelenggara ? <Button title="Buka kembali draf" variant="outline" icon="lock-open" onPress={() => void bukaKembali()} style={{ flex: 1 }} /> : null}
        <Button title="Bagikan lagi" icon="share-2" onPress={bagikan} style={{ flex: 1 }} />
      </>
    );
  }

  if (belumDimulai) {
    return (
      <Screen header={header}>
        <EmptyState icon="file-pen" title="Notulen belum dimulai" description="Notulis akan mengisi notulen setelah rapat. Halaman ini diperbarui otomatis saat notulen mulai ditulis." actionLabel="Kembali ke detail rapat" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen header={header} footer={footer} refreshing={false} onRefresh={() => void muat()}>
      <View style={{ gap: 6 }}>
        <Text variant="h2">{rapat.title}</Text>
        <Text variant="meta" style={{ fontSize: 15 }}>
          {`${hariSingkatTahun(rapat.occurrence_date)} · ${rentangJam(rapat.starts_at, rapat.ends_at)} WIB${rapat.workspace ? ` · ${rapat.workspace.key}` : ''}`}
        </Text>
        <View style={s.baris}>
          <Badge tone={final ? 'success' : 'warning'}>{final ? 'Final' : 'Draf'}</Badge>
          <Icon name={status === 'tersimpan' ? 'circle-check' : status === 'menyimpan' ? 'loader' : 'cloud-off'} size={16} color={status === 'tersimpan' ? colors.muted : colors.warning} />
          <Text variant="meta" tone={status === 'tertunda' || status === 'gagal' ? 'warning' : 'muted'}>
            {statusTeks}
          </Text>
        </View>
      </View>

      {offline ? <Banner tone="warn" icon="cloud-off" message="Tanpa koneksi. Perubahan disimpan di perangkat dan dikirim otomatis saat tersambung. Jangan tutup layar ini terlalu lama." /> : null}
      {modeTulis && orangLain ? <Banner tone="info" icon="pencil" message={`${orangLain.name} sedang menyunting. Simpanan terakhir yang berlaku.`} /> : null}
      {final ? <Banner tone="ok" icon="lock" title="Notulen terkunci." message={`Dibagikan ke ${rapat.participants.length} peserta. Penyelenggara bisa membuka kembali sebagai draf.`} /> : null}
      {!final && !bolehTulis ? <Banner tone="info" icon="eye" message="Anda membaca notulen. Notulis dan penyelenggara yang menulis; draf bisa berubah." /> : null}

      {bolehPilihSumber ? (
        <Card style={{ gap: 10 }}>
          <Text variant="h3">Mulai notulen dari…</Text>
          <Text variant="meta">Dipilih sekali untuk rapat ini.</Text>
          <SheetAction icon="history" label="Lanjutkan notulen rapat lalu" description="Bawa tindak lanjut yang masih terbuka" onPress={() => void pilihSumber('continue')} />
          <SheetAction icon="layout-template" label="Templat agenda" description="Bagian per butir agenda + Keputusan & Tindak lanjut" onPress={() => void pilihSumber('template')} />
          <SheetAction icon="file" label="Dokumen kosong" onPress={() => void pilihSumber('blank')} />
        </Card>
      ) : null}

      <Card style={{ gap: 4 }}>
        <View style={s.baris}>
          <Text variant="h3" style={{ flex: 1 }}>
            Kehadiran
          </Text>
          <Badge tone="success">{`${jmlHadir} hadir`}</Badge>
        </View>
        {isi.attendance.length === 0 ? <Text variant="meta">Belum ada daftar hadir.</Text> : null}
        {isi.attendance.map((a, i) => (
          <BarisOrang
            key={a.user_id}
            nama={namaOrang(a.user_id)}
            sub={a.reason}
            divider={i > 0}
            onPress={modeTulis ? () => { setHadirDipilih({ user_id: a.user_id, present: a.present, reason: a.reason ?? '' }); setLembar('hadir'); } : undefined}
            kanan={
              modeTulis ? (
                <Checkbox checked={a.present} onChange={(v) => ubahIsi((l) => ({ ...l, attendance: l.attendance.map((x) => (x.user_id === a.user_id ? { ...x, present: v } : x)) }))} label={`Hadir: ${namaOrang(a.user_id)}`} />
              ) : (
                <Badge tone={a.present ? 'success' : 'neutral'}>{a.present ? 'Hadir' : 'Tidak hadir'}</Badge>
              )
            }
          />
        ))}
        {modeTulis && rapat.platform === 'video' ? <Text variant="meta">Terisi otomatis dari ruang video. Ketuk untuk mengubah.</Text> : null}
      </Card>

      <Card style={{ gap: 14 }}>
        <Text variant="h3">{modeTulis ? 'Catatan per agenda' : 'Pembahasan'}</Text>
        {isi.sections.length === 0 ? <Text variant="meta">Belum ada catatan.</Text> : null}
        {isi.sections.map((sec, i) =>
          modeTulis ? (
            <View key={`sec-${i}`} style={{ gap: 8 }}>
              <View style={s.baris}>
                <NomorAgenda n={i + 1} />
                <Text variant="label" style={{ flex: 1, fontSize: 16 }}>
                  {sec.title}
                </Text>
              </View>
              <Input
                value={sec.body}
                onChangeText={(t) => ubahIsi((l) => ({ ...l, sections: l.sections.map((x, j) => (j === i ? { ...x, body: t } : x)) }))}
                placeholder="Catat poin pembahasan…"
                multiline
                textAlignVertical="top"
                style={{ minHeight: 96, paddingTop: 12 }}
                accessibilityLabel={`Catatan agenda ${i + 1}: ${sec.title}`}
              />
            </View>
          ) : (
            <View key={`sec-${i}`} style={{ gap: 4 }}>
              <Text variant="title">{`${i + 1}. ${sec.title}`}</Text>
              <Text variant="body" tone={sec.body ? 'text' : 'muted'}>
                {sec.body || 'Belum ada catatan.'}
              </Text>
            </View>
          ),
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text variant="h3">Keputusan</Text>
        {isi.decisions.length === 0 && !modeTulis ? <Text variant="meta">Belum ada keputusan.</Text> : null}
        {isi.decisions.map((k, i) => (
          <View key={`kep-${i}`} style={[s.keputusan, { backgroundColor: colors.successSoft }]}>
            <Icon name="flag" size={18} color={colors.success} />
            <Text variant="body" style={{ flex: 1 }}>
              {k}
            </Text>
            {modeTulis ? <IconButton icon="x" label={`Hapus keputusan ${i + 1}`} variant="ghost" size={40} onPress={() => ubahIsi((l) => ({ ...l, decisions: l.decisions.filter((_, j) => j !== i) }))} /> : null}
          </View>
        ))}
        {modeTulis ? (
          <Input
            value={keputusanBaru}
            onChangeText={setKeputusanBaru}
            placeholder="Tulis keputusan rapat"
            returnKeyType="done"
            maxLength={500}
            onSubmitEditing={() => {
              const t = keputusanBaru.trim();
              if (t) {
                ubahIsi((l) => ({ ...l, decisions: [...l.decisions, t] }));
                setKeputusanBaru('');
              }
            }}
            right={
              keputusanBaru.trim() ? (
                <Pressable
                  onPress={() => {
                    ubahIsi((l) => ({ ...l, decisions: [...l.decisions, keputusanBaru.trim()] }));
                    setKeputusanBaru('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Tambah keputusan"
                  hitSlop={8}
                >
                  <Icon name="plus" size={22} color={colors.link} />
                </Pressable>
              ) : undefined
            }
            accessibilityLabel="Keputusan baru"
          />
        ) : null}
      </Card>

      <TindakLanjutKartu
        rapatId={rapat.id}
        tanggal={tgl}
        items={notulen.action_items}
        orang={orang}
        viewerId={viewerId}
        bolehTulis={bolehTulis}
        bolehKelola={bolehKelola}
        workspace={tl?.workspace ?? null}
        workspaces={tl?.workspaces ?? []}
        final={final}
        offline={offline}
        onItems={(items) => setData((l) => (l ? { ...l, notulen: { ...l.notulen, action_items: items } } : l))}
        onNotulen={(n) => setData((l) => (l ? { ...l, notulen: { ...l.notulen, action_items: n.action_items } } : l))}
      />

      <BottomSheet visible={lembar === 'menu'} onClose={() => setLembar(null)}>
        <SheetAction icon="history" label="Riwayat versi" onPress={() => void bukaVersi()} />
        <SheetAction icon="share-2" label="Bagikan notulen" onPress={() => { setLembar(null); bagikan(); }} />
        {rapat.platform === 'video' && rapat.auto_minutes ? (
          <SheetAction icon="sparkles" label="Notulen otomatis" onPress={() => { setLembar(null); router.push({ pathname: '/rapat/[id]/transkrip', params: { id: rapat.id, tanggal: rapat.occurrence_date } } as never); }} />
        ) : null}
        {final && penyelenggara ? <SheetAction icon="lock-open" label="Buka kembali draf" onPress={() => void bukaKembali()} /> : null}
        <SheetAction icon="calendar-days" label="Detail rapat" onPress={() => { setLembar(null); router.back(); }} />
      </BottomSheet>

      <BottomSheet visible={lembar === 'versi'} onClose={() => setLembar(null)} title={pratinjau ? 'Pratinjau versi' : 'Riwayat versi'} scrollable>
        {pratinjau ? (
          <>
            <Text variant="meta">{`${pratinjau.created_by?.name ?? 'Sistem'} · ${waktuSimpan(pratinjau.updated_at)}`}</Text>
            {pratinjau.sections.map((sec, i) => (
              <View key={`pv-${i}`} style={{ gap: 2 }}>
                <Text variant="label">{`${i + 1}. ${sec.title}`}</Text>
                <Text variant="body" tone={sec.body ? 'text' : 'muted'}>
                  {sec.body || '—'}
                </Text>
              </View>
            ))}
            {pratinjau.decisions.length ? <Text variant="label">Keputusan</Text> : null}
            {pratinjau.decisions.map((k, i) => (
              <Text key={`pk-${i}`} variant="body">{`• ${k}`}</Text>
            ))}
            <Button title="Kembali ke riwayat" variant="outline" onPress={() => setPratinjau(null)} />
          </>
        ) : (
          <>
            <Text variant="meta">{versi ? `${versi.length} versi · simpan otomatis tiap beberapa detik` : 'Memuat…'}</Text>
            {versi?.map((v, i) => (
              <View key={v.id} style={s.versi}>
                <Text variant="label" style={{ width: 36 }}>{`v${v.number}`}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{v.created_by?.name ?? 'Sistem'}</Text>
                  <Text variant="meta">{`${waktuSimpan(v.updated_at)}${i === 0 ? ' · Versi terkini' : ''}`}</Text>
                </View>
                {i === 0 ? (
                  <Text variant="meta">Sekarang</Text>
                ) : (
                  <Button
                    title="Lihat"
                    size="sm"
                    variant="tonal"
                    onPress={() => {
                      bacaVersi(id, v.id, tgl)
                        .then(setPratinjau)
                        .catch(() => snackbar.show({ message: 'Versi tidak dapat dimuat.', variant: 'bad' }));
                    }}
                  />
                )}
              </View>
            ))}
            <Text variant="meta">Memulihkan versi lama belum tersedia di aplikasi.</Text>
          </>
        )}
      </BottomSheet>

      <BottomSheet visible={lembar === 'masalah'} onClose={() => setLembar(null)} title="Periksa sebelum finalisasi">
        {masalah.map((m) => (
          <View key={m} style={s.baris}>
            <Icon name="circle-alert" size={18} color={colors.warning} />
            <Text variant="body" style={{ flex: 1 }}>
              {m}
            </Text>
          </View>
        ))}
        <Button title="Lengkapi dulu" onPress={() => setLembar(null)} />
      </BottomSheet>

      <BottomSheet visible={lembar === 'hadir' && hadirDipilih !== null} onClose={() => setLembar(null)} title={hadirDipilih ? `Kehadiran · ${namaOrang(hadirDipilih.user_id)}` : 'Kehadiran'}>
        {hadirDipilih ? (
          <>
            <View style={s.baris}>
              <View style={{ flex: 1 }}>
                <Text variant="label">Hadir</Text>
                {rapat.platform === 'video' ? <Text variant="meta">Terisi dari ruang video; bisa diubah</Text> : null}
              </View>
              <Switch value={hadirDipilih.present} onValueChange={(v) => setHadirDipilih({ ...hadirDipilih, present: v })} label="Hadir" />
            </View>
            <Text variant="label">Alasan tidak hadir (opsional)</Text>
            <Input value={hadirDipilih.reason} onChangeText={(t) => setHadirDipilih({ ...hadirDipilih, reason: t })} placeholder="Izin: servis kendaraan" maxLength={200} />
            <Button
              title="Simpan"
              onPress={() => {
                const h = hadirDipilih;
                ubahIsi((l) => ({ ...l, attendance: l.attendance.map((x) => (x.user_id === h.user_id ? { ...x, present: h.present, reason: h.reason.trim() || null } : x)) }), true);
                setLembar(null);
              }}
            />
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keputusan: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
  versi: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
});
