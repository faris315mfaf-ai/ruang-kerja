/**
 * Formulir Jadwalkan/Ubah rapat (mockup 08 › 10–12): judul, tanggal, mulai
 * + durasi, tempat (5 pilihan), tautan/lokasi, peserta + tamu email,
 * agenda, notulis, ulangi + sampai, workspace tindak lanjut, pengingat,
 * rapat pimpinan, notulen otomatis; cek bentrok (`rapat/bentrok`), galat
 * 422 per isian, ringkasan sebelum kirim, gagal kirim offline, buang
 * perubahan.
 */
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatRapat, cekBentrok, formulirRapat, ubahRapat, type Bentrok, type FormulirRapat, type IsianRapat, type Orang, type PengulanganRapat, type PlatformRapat } from '@/api/rapat';
import { jam as jamWib } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  DateInput,
  ErrorState,
  Field,
  Icon,
  IconButton,
  Input,
  Loading,
  Pressable,
  Radio,
  Screen,
  SelectField,
  SubAppBar,
  Switch,
  Text,
  useDialog,
  useSnackbar,
} from '@/ui';

import { NomorAgenda } from './komponen';
import { PemilihPeserta } from './PemilihPeserta';
import { MAKS_TAMU, susunNamaTamuForm } from './tamu';
import { LABEL_ULANGI, hariPanjang, infoPlatform, labelDurasi, labelPengingat, namaDepan, namaHari } from './util';

type Galat = Partial<Record<keyof IsianRapat | 'umum', string>>;

const JAM = Array.from({ length: 16 }, (_, i) => i + 6);
const MENIT = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function sekarangWib(): { ymd: string; menit: number } {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const ambil = (t: string): string => p.find((x) => x.type === t)?.value ?? '00';
  return { ymd: `${ambil('year')}-${ambil('month')}-${ambil('day')}`, menit: Number(ambil('hour')) * 60 + Number(ambil('minute')) };
}

function tambahHariYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n));
  return t.toISOString().slice(0, 10);
}

function jamTeks(menit: number): string {
  return `${String(Math.floor(menit / 60)).padStart(2, '0')}:${String(menit % 60).padStart(2, '0')}`;
}

/** "14:30" → "14.30" (format tampil Indonesia). */
function tampilJam(hhmm: string): string {
  return hhmm.replace(':', '.');
}

function isianAwal(f: FormulirRapat): IsianRapat {
  if (f.meeting) {
    const { id: _id, ...sisa } = f.meeting;
    return { ...sisa, guest_names: sisa.guest_names ?? {}, agenda: sisa.agenda.length ? sisa.agenda : [''] };
  }
  const now = sekarangWib();
  let mulai = Math.ceil((now.menit + 1) / 30) * 30;
  let tanggal = now.ymd;
  if (mulai > 20 * 60) {
    mulai = 9 * 60;
    tanggal = tambahHariYmd(now.ymd, 1);
  }
  return {
    title: '',
    description: null,
    date: tanggal,
    start: jamTeks(mulai),
    duration: 60,
    platform: f.video_enabled ? 'video' : 'meet',
    join_url: null,
    location: null,
    participant_ids: [],
    guest_emails: [],
    guest_names: {},
    agenda: [''],
    recurrence: 'none',
    recurrence_until: null,
    reminders: [15, 5],
    minute_taker_id: null,
    workspace_id: f.workspaces.length === 1 ? (f.workspaces[0]?.id ?? null) : null,
    leadership: false,
    auto_minutes: false,
  };
}

function validasi(isi: IsianRapat, baru: boolean): Galat {
  const g: Galat = {};
  if (isi.title.trim() === '') {
    g.title = 'Judul rapat wajib diisi.';
  }
  if (baru && isi.date < sekarangWib().ymd) {
    g.date = 'Tanggal sudah lewat. Pilih hari ini atau sesudahnya.';
  }
  if (isi.participant_ids.length === 0 && isi.guest_emails.length === 0) {
    g.participant_ids = 'Tambahkan sedikitnya satu peserta selain Anda.';
  }
  if (isi.agenda.every((a) => a.trim() === '')) {
    g.agenda = 'Tambahkan minimal satu butir agenda.';
  }
  const url = (isi.join_url ?? '').trim();
  if (isi.platform === 'zoom' && url === '') {
    g.join_url = 'Tempel tautan Zoom lengkap, misalnya https://zoom.us/j/81234567890.';
  } else if ((isi.platform === 'zoom' || isi.platform === 'meet') && url !== '' && !/^https:\/\//i.test(url)) {
    g.join_url = 'Tautan harus diawali https://.';
  }
  if ((isi.platform === 'room' || isi.platform === 'client') && (isi.location ?? '').trim() === '') {
    g.location = isi.platform === 'room' ? 'Isi nama ruangan.' : 'Isi nama klien dan alamatnya.';
  }
  return g;
}

function galatServer(err: ApiError): Galat {
  const g: Galat = {};
  for (const [k, v] of Object.entries(err.errors)) {
    const kunci = k.split('.')[0] as keyof IsianRapat;
    if (!g[kunci] && v[0]) {
      g[kunci] = v[0];
    }
  }
  return g;
}

function PilihanBaris({ label, deskripsi, terpilih, onPress }: { label: string; deskripsi?: string; terpilih: boolean; onPress: () => void }): React.JSX.Element {
  return <Radio selected={terpilih} label={label} description={deskripsi} onSelect={onPress} />;
}

export function FormRapat({ rapatId }: { rapatId: string | null }): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const navigation = useNavigation();
  const baru = rapatId === null;

  const [form, setForm] = useState<FormulirRapat | null>(null);
  const [galatMuat, setGalatMuat] = useState<ApiError | null>(null);
  const [isi, setIsi] = useState<IsianRapat | null>(null);
  const awalJson = useRef<string>('');
  const [galat, setGalat] = useState<Galat>({});
  const [kenal, setKenal] = useState<Map<string, Orang>>(new Map());
  const [lembar, setLembar] = useState<null | 'peserta' | 'jam' | 'durasi' | 'notulis' | 'ulangi' | 'workspace' | 'ringkasan'>(null);
  const [bentrok, setBentrok] = useState<Bentrok | null>(null);
  const [abaikanBentrok, setAbaikanBentrok] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [gagalOffline, setGagalOffline] = useState(false);
  const lewati = useRef(false);

  const muat = useCallback(async (): Promise<void> => {
    setGalatMuat(null);
    try {
      const f = await formulirRapat(rapatId);
      const awal = isianAwal(f);
      setForm(f);
      setIsi(awal);
      awalJson.current = JSON.stringify(awal);
      setKenal(new Map(f.people.map((o) => [o.id, o])));
    } catch (err) {
      setGalatMuat(err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Formulir tidak dapat dimuat.' }));
    }
  }, [rapatId]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  const berubah = isi !== null && JSON.stringify(isi) !== awalJson.current;

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (lewati.current || !berubah) {
        return;
      }
      e.preventDefault();
      void dialog.confirm({ title: 'Buang perubahan?', message: 'Isian rapat yang belum dikirim akan hilang.', confirmLabel: 'Buang', cancelLabel: 'Lanjut mengisi', destructive: true }).then((ok) => {
        if (ok) {
          lewati.current = true;
          navigation.dispatch(e.data.action);
        }
      });
    });
  }, [navigation, berubah, dialog]);

  // Cek bentrok (debounce) saat peserta/tanggal/jam/durasi berubah.
  const kunciBentrok = isi ? `${isi.participant_ids.join(',')}|${isi.date}|${isi.start}|${isi.duration}` : '';
  useEffect(() => {
    if (!isi || isi.participant_ids.length === 0) {
      return undefined;
    }
    const t = setTimeout(() => {
      cekBentrok({ peserta: isi.participant_ids, tanggal: isi.date, mulai: isi.start, durasi: isi.duration, abaikan: rapatId })
        .then((b) => {
          setBentrok(b);
          setAbaikanBentrok(false);
        })
        .catch(() => setBentrok(null));
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup dipicu kunci bentrok
  }, [kunciBentrok, rapatId]);

  const ubah = <K extends keyof IsianRapat>(k: K, v: IsianRapat[K]): void => {
    setIsi((lama) => (lama ? { ...lama, [k]: v } : lama));
    if (galat[k]) {
      setGalat((g) => ({ ...g, [k]: undefined }));
    }
  };

  const nama = useCallback((id: string | null): string => (id ? (kenal.get(id)?.name ?? 'Karyawan') : ''), [kenal]);
  const viewer = form ? kenal.get(form.viewer_id) : undefined;

  const jumlahGalat = Object.values(galat).filter(Boolean).length;
  const daftarBentrok = useMemo(() => (bentrok && !abaikanBentrok ? bentrok.conflicts : []), [bentrok, abaikanBentrok]);

  if (galatMuat) {
    const tutup = galatMuat.status === 403 || galatMuat.status === 404;
    return (
      <Screen header={<SubAppBar title={baru ? 'Jadwalkan rapat' : 'Ubah rapat'} />}>
        <ErrorState kind={galatMuat.status === 0 ? 'offline' : tutup ? 'forbidden' : 'umum'} title={tutup ? 'Rapat tidak dapat diubah' : 'Formulir tidak dapat dimuat'} message={galatMuat.message} onRetry={tutup ? undefined : () => void muat()} />
      </Screen>
    );
  }
  if (!form || !isi) {
    return (
      <Screen header={<SubAppBar title={baru ? 'Jadwalkan rapat' : 'Ubah rapat'} />}>
        <Loading label="Memuat formulir…" />
      </Screen>
    );
  }

  const platformTersedia = form.platforms.filter((p) => p !== 'video' || form.video_enabled);
  const agendaTerisi = isi.agenda.map((a) => a.trim()).filter(Boolean);
  const jumlahUndangan = isi.participant_ids.length + isi.guest_emails.length + (isi.minute_taker_id && !isi.participant_ids.includes(isi.minute_taker_id) && isi.minute_taker_id !== form.viewer_id ? 1 : 0);

  function periksa(): void {
    if (!isi) {
      return;
    }
    const g = validasi(isi, baru);
    setGalat(g);
    if (Object.keys(g).length > 0) {
      snackbar.show({ message: `Periksa ${Object.keys(g).length} isian.`, variant: 'warn' });
      return;
    }
    if (baru) {
      setLembar('ringkasan');
    } else {
      void kirim();
    }
  }

  async function kirim(): Promise<void> {
    if (!isi || mengirim) {
      return;
    }
    setLembar(null);
    setMengirim(true);
    setGagalOffline(false);
    const body: IsianRapat = {
      ...isi,
      title: isi.title.trim(),
      agenda: agendaTerisi,
      join_url: isi.platform === 'meet' || isi.platform === 'zoom' ? (isi.join_url ?? '').trim() || null : null,
      location: isi.platform === 'room' || isi.platform === 'client' ? (isi.location ?? '').trim() || null : null,
      recurrence_until: isi.recurrence === 'none' ? null : isi.recurrence_until,
      auto_minutes: isi.platform === 'video' && form?.auto_minutes_enabled === true ? isi.auto_minutes : false,
      leadership: form?.can_lead === true ? isi.leadership : false,
      guest_names: susunNamaTamuForm(isi.guest_emails, isi.guest_names ?? {}),
    };
    try {
      const hasil = baru ? await buatRapat(body) : await ubahRapat(rapatId as string, body);
      lewati.current = true;
      // Ada tamu eksternal: detail rapat membuka daftar tamu agar tautan pribadinya bisa langsung dibagikan.
      const bukaTamu = body.platform === 'video' && body.guest_emails.length > 0;
      const tujuan = { pathname: '/rapat/[id]', params: bukaTamu ? { id: hasil.meeting.id, tanggal: hasil.meeting.occurrence_date, tamu: '1' } : { id: hasil.meeting.id, tanggal: hasil.meeting.occurrence_date } } as never;
      const dasar = baru ? `Undangan rapat terkirim ke ${hasil.invited ?? jumlahUndangan} peserta` : hasil.message;
      snackbar.show({ message: bukaTamu ? `${dasar}. Bagikan tautan tamu dari daftar tamu.` : dasar, variant: 'ok' });
      router.replace(tujuan);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const g = galatServer(err);
        setGalat(Object.keys(g).length ? g : { umum: err.message });
      } else if (err instanceof ApiError && err.status === 0) {
        setGagalOffline(true);
      } else {
        setGalat({ umum: err instanceof ApiError ? err.message : 'Rapat gagal disimpan. Coba lagi.' });
      }
    } finally {
      setMengirim(false);
    }
  }

  const header = (
    <SubAppBar
      title={baru ? 'Jadwalkan rapat' : 'Ubah rapat'}
      actions={[{ icon: 'x', label: 'Batal', onPress: () => router.back() }]}
    />
  );
  const footer = <Button title={baru ? 'Periksa & kirim undangan' : 'Simpan perubahan'} loading={mengirim} loadingTitle={baru ? 'Mengirim undangan…' : 'Menyimpan…'} onPress={periksa} style={{ flex: 1 }} />;

  return (
    <Screen header={header} footer={footer}>
      {gagalOffline ? (
        <Banner tone="bad" icon="cloud-off" title="Undangan belum terkirim." message="Tidak ada jaringan. Isian Anda tetap tersimpan di layar ini; coba lagi saat tersambung." actionLabel="Coba kirim lagi" onAction={() => void kirim()} />
      ) : null}
      {jumlahGalat > 0 ? <Banner tone="bad" icon="circle-alert" message={galat.umum ?? `Periksa ${jumlahGalat} isian yang ditandai merah.`} /> : null}
      {!baru && isi.recurrence !== 'none' ? (
        <Banner tone="info" icon="repeat" message={'Rapat berulang. Perubahan berlaku untuk seluruh seri. Bila jam berubah, jawaban kehadiran peserta kembali ke "Belum menjawab" dan mereka diberi tahu.'} />
      ) : null}
      {!form.video_enabled ? <Banner tone="neutral" icon="video-off" message="Video RuangKerja belum disiapkan di server ini, jadi tidak ditawarkan. Gunakan Google Meet atau Zoom." /> : null}

      <Field label="Judul rapat" required error={galat.title}>
        <Input value={isi.title} onChangeText={(t) => ubah('title', t)} placeholder="Misalnya: Review vendor logistik" invalid={!!galat.title} maxLength={160} accessibilityLabel="Judul rapat" />
      </Field>
      <DateInput label="Tanggal" value={isi.date} onChange={(v) => ubah('date', v)} min={baru ? sekarangWib().ymd : undefined} required error={galat.date} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Mulai" error={galat.start}>
            <SelectField value={tampilJam(isi.start)} onPress={() => setLembar('jam')} accessibilityLabel="Jam mulai" invalid={!!galat.start} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Durasi" error={galat.duration}>
            <SelectField value={labelDurasi(isi.duration)} onPress={() => setLembar('durasi')} accessibilityLabel="Durasi" />
          </Field>
        </View>
      </View>

      {daftarBentrok.length > 0 && bentrok ? (
        <Card style={{ gap: 10, backgroundColor: colors.warningSoft }}>
          <View style={s.baris}>
            <Icon name="triangle-alert" size={20} color={colors.warning} />
            <Text variant="label" tone="warning" style={{ flex: 1 }}>
              {`Bentrok dengan ${new Set(daftarBentrok.map((b) => b.user_id)).size} peserta`}
            </Text>
          </View>
          <Text variant="meta">{daftarBentrok.map((b) => `${namaDepan(nama(b.user_id))}: ${b.title} ${jamWib(b.starts_at)}–${jamWib(b.ends_at)}`).join(' · ')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {bentrok.suggestion ? <Button title={`Pakai ${tampilJam(bentrok.suggestion)}`} size="sm" variant="tonal" onPress={() => ubah('start', bentrok.suggestion as string)} style={{ flex: 1 }} /> : null}
            <Button title="Tetap jadwalkan" size="sm" variant="outline" onPress={() => setAbaikanBentrok(true)} style={{ flex: 1 }} />
          </View>
          {!bentrok.suggestion ? <Text variant="meta">Tidak ada waktu kosong bersama di hari ini. Coba hari lain.</Text> : null}
        </Card>
      ) : null}

      <Text variant="label">Tempat rapat</Text>
      <View style={{ gap: 10 }}>
        {platformTersedia.map((p: PlatformRapat) => {
          const info = infoPlatform(p);
          const aktif = isi.platform === p;
          return (
            <Pressable
              key={p}
              onPress={() => {
                ubah('platform', p);
                if (p !== 'video') {
                  ubah('auto_minutes', false);
                }
              }}
              scaleTo={0.99}
              accessibilityRole="radio"
              accessibilityState={{ selected: aktif }}
              accessibilityLabel={`${info.label}. ${info.hint}`}
              style={[s.kartuTempat, { borderColor: aktif ? colors.primary : colors.border, backgroundColor: aktif ? colors.linkSoft : colors.surface }]}
            >
              <View style={[s.radio, { borderColor: aktif ? colors.primary : colors.borderStrong }]}>{aktif ? <View style={[s.radioIsi, { backgroundColor: colors.primary }]} /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{info.label}</Text>
                <Text variant="meta">{info.hint}</Text>
              </View>
              <Icon name={p === 'meet' || p === 'zoom' ? 'link' : info.ikon} size={20} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>
      {isi.platform === 'meet' || isi.platform === 'zoom' ? (
        <Field label={isi.platform === 'meet' ? 'Tautan Google Meet (opsional)' : 'Tautan Zoom'} required={isi.platform === 'zoom'} error={galat.join_url} hint="Tautan harus diawali https://. Tautan dicek formatnya dan ikut di pengingat peserta.">
          <Input value={isi.join_url ?? ''} onChangeText={(t) => ubah('join_url', t)} placeholder={isi.platform === 'meet' ? 'https://meet.google.com/abc-defg-hij' : 'https://zoom.us/j/81234567890'} autoCapitalize="none" keyboardType="url" invalid={!!galat.join_url} />
        </Field>
      ) : null}
      {isi.platform === 'room' || isi.platform === 'client' ? (
        <Field label={isi.platform === 'room' ? 'Ruangan' : 'Nama klien & alamat'} required error={galat.location}>
          <Input value={isi.location ?? ''} onChangeText={(t) => ubah('location', t)} placeholder={isi.platform === 'room' ? 'Ruang Rapat Lt. 3' : 'PT Sinar Logistik, Cikarang'} invalid={!!galat.location} maxLength={200} />
        </Field>
      ) : null}

      <Field label={`Peserta · ${isi.participant_ids.length + isi.guest_emails.length + 1} orang`} error={galat.participant_ids} hint={isi.guest_emails.length > 0 ? (isi.platform === 'video' ? 'Tamu eksternal masuk lewat tautan pribadi yang Anda bagikan sendiri (tanpa email otomatis) dan tidak melihat isi aplikasi. Tautan muncul di detail rapat setelah disimpan.' : 'Tautan tamu hanya berlaku untuk Video RuangKerja. Untuk Meet/Zoom, bagikan tautan rapatnya sendiri.') : undefined}>
        <View style={[s.kotakPeserta, { borderColor: galat.participant_ids ? colors.danger : colors.borderStrong, backgroundColor: colors.surface }]}>
          <View style={s.bungkus}>
            <Chip label={`${namaDepan(viewer?.name) || 'Saya'} (Anda)`} />
            {isi.participant_ids.map((pid) => (
              <Chip key={pid} label={nama(pid)} onDismiss={() => ubah('participant_ids', isi.participant_ids.filter((x) => x !== pid))} />
            ))}
            {isi.guest_emails.map((e) => (
              <Chip
                key={e}
                label={isi.guest_names?.[e] ? `${isi.guest_names[e]} · ${e}` : e}
                icon="mail"
                onDismiss={() => {
                  ubah('guest_emails', isi.guest_emails.filter((x) => x !== e));
                  ubah('guest_names', Object.fromEntries(Object.entries(isi.guest_names ?? {}).filter(([k]) => k !== e)));
                }}
              />
            ))}
          </View>
          <Pressable onPress={() => setLembar('peserta')} accessibilityRole="button" accessibilityLabel="Tambah peserta" style={s.tambahPeserta}>
            <Icon name="search" size={18} color={colors.muted} />
            <Text variant="body" tone="subtle">
              Tambah nama atau email…
            </Text>
          </Pressable>
        </View>
      </Field>

      <Text variant="h3">Agenda</Text>
      {galat.agenda ? (
        <Text variant="meta" tone="danger" accessibilityRole="alert">
          {galat.agenda}
        </Text>
      ) : null}
      {isi.agenda.map((a, i) => (
        <View key={`agenda-${i}`} style={s.baris}>
          <NomorAgenda n={i + 1} />
          <View style={{ flex: 1 }}>
            <Input value={a} onChangeText={(t) => ubah('agenda', isi.agenda.map((x, j) => (j === i ? t : x)))} placeholder="Butir agenda" maxLength={200} accessibilityLabel={`Butir agenda ${i + 1}`} invalid={!!galat.agenda && i === 0} />
          </View>
          <IconButton icon="trash-2" label={`Hapus butir agenda ${i + 1}`} variant="ghost" disabled={isi.agenda.length <= 1} onPress={() => ubah('agenda', isi.agenda.filter((_, j) => j !== i))} />
        </View>
      ))}
      {isi.agenda.length < 20 ? <Button title="Tambah butir agenda" variant="tonal" icon="plus" onPress={() => ubah('agenda', [...isi.agenda, ''])} /> : null}

      <Field label="Notulis" hint="Notulis juga diundang otomatis." error={galat.minute_taker_id}>
        <SelectField value={isi.minute_taker_id ? nama(isi.minute_taker_id) : 'Tanpa notulis'} onPress={() => setLembar('notulis')} accessibilityLabel="Notulis" />
      </Field>
      <Field label="Ulangi" error={galat.recurrence}>
        <SelectField value={isi.recurrence === 'weekly' ? `Setiap minggu (${namaHari(isi.date)})` : LABEL_ULANGI[isi.recurrence]} onPress={() => setLembar('ulangi')} accessibilityLabel="Ulangi" />
      </Field>
      {isi.recurrence !== 'none' ? <DateInput label="Berulang sampai (opsional)" value={isi.recurrence_until ?? ''} onChange={(v) => ubah('recurrence_until', v || null)} min={isi.date} placeholder="Tanpa akhir" error={galat.recurrence_until} /> : null}
      <Field label="Workspace tugas tindak lanjut" hint={'Dipakai tombol "Jadikan tugas" di notulen.'} error={galat.workspace_id}>
        <SelectField value={isi.workspace_id ? (() => { const w = form.workspaces.find((x) => x.id === isi.workspace_id); return w ? `${w.name} · ${w.key}` : 'Workspace'; })() : 'Tanpa workspace'} onPress={() => setLembar('workspace')} accessibilityLabel="Workspace tugas tindak lanjut" />
      </Field>

      <Text variant="h3">Pengingat</Text>
      <View style={s.bungkus}>
        {[...form.reminders].sort((a, b) => b - a).map((r) => {
          const on = isi.reminders.includes(r);
          return <Chip key={r} label={`${r} menit`} variant="tonal" selected={on} onPress={() => ubah('reminders', on ? isi.reminders.filter((x) => x !== r) : [...isi.reminders, r])} />;
        })}
      </View>

      {form.can_lead ? (
        <Card style={{ gap: 8 }}>
          <View style={s.baris}>
            <Switch value={isi.leadership} onValueChange={(v) => ubah('leadership', v)} label="Rapat pimpinan" />
            <Text variant="label" style={{ flex: 1 }}>
              Rapat pimpinan
            </Text>
          </View>
          <Text variant="meta">Tampil di Jadwal manajemen. Direksi, HR, dan Super Admin yang tidak diundang bisa melihatnya (baca saja). Hanya mereka yang bisa menandai.</Text>
        </Card>
      ) : null}

      <Card style={{ gap: 8 }}>
        <View style={s.baris}>
          <Switch value={isi.auto_minutes} onValueChange={(v) => ubah('auto_minutes', v)} label="Notulen otomatis" disabled={!form.auto_minutes_enabled || isi.platform !== 'video'} />
          <Text variant="label" style={{ flex: 1 }}>
            Notulen otomatis
          </Text>
        </View>
        {!form.auto_minutes_enabled || isi.platform !== 'video' ? (
          <Text variant="meta">{!form.auto_minutes_enabled ? 'Hanya untuk rapat Video RuangKerja. Belum disiapkan admin di server ini.' : 'Hanya untuk rapat Video RuangKerja.'}</Text>
        ) : (
          <>
            <Text variant="meta">{form.auto_minutes_notice ?? 'Suara peserta ditranskrip setelah rapat, lalu AI menyusun draf notulen untuk diperiksa notulis. Peserta bisa menolak.'}</Text>
            {isi.auto_minutes
              ? form.auto_minutes_notice_points.map((p) => (
                  <View key={p} style={s.baris}>
                    <Icon name="check" size={16} color={colors.link} />
                    <Text variant="meta" style={{ flex: 1 }}>
                      {p}
                    </Text>
                  </View>
                ))
              : null}
            <Text variant="meta" tone="warning">
              Hindari untuk rapat berisi data pribadi sensitif.
            </Text>
          </>
        )}
        {galat.auto_minutes ? (
          <Text variant="meta" tone="danger">
            {galat.auto_minutes}
          </Text>
        ) : null}
      </Card>

      {galat.platform ? <Banner tone="bad" message={galat.platform} /> : null}

      <PemilihPeserta
        visible={lembar === 'peserta'}
        onClose={() => setLembar(null)}
        awal={form.people}
        terpilih={isi.participant_ids}
        tamu={isi.guest_emails}
        namaTamu={isi.guest_names ?? {}}
        batasTamu={MAKS_TAMU}
        kecuali={form.viewer_id}
        onUbah={(ids, tamu, orang, namaTamu) => {
          if (orang.length) {
            setKenal((k) => {
              const b = new Map(k);
              for (const o of orang) {
                b.set(o.id, o);
              }
              return b;
            });
          }
          setIsi((l) => (l ? { ...l, participant_ids: ids, guest_emails: tamu, guest_names: namaTamu ?? l.guest_names ?? {} } : l));
          setGalat((g) => ({ ...g, participant_ids: undefined }));
        }}
      />

      <BottomSheet visible={lembar === 'jam'} onClose={() => setLembar(null)} title="Pilih jam mulai">
        <Text variant="h2" align="center">
          {tampilJam(isi.start)}
        </Text>
        <Text variant="label">Jam</Text>
        <View style={s.bungkus}>
          {JAM.map((h) => (
            <Chip key={h} label={String(h).padStart(2, '0')} selected={Number(isi.start.slice(0, 2)) === h} onPress={() => ubah('start', `${String(h).padStart(2, '0')}:${isi.start.slice(3, 5)}`)} />
          ))}
        </View>
        <Text variant="label">Menit</Text>
        <View style={s.bungkus}>
          {MENIT.map((mm) => (
            <Chip key={mm} label={String(mm).padStart(2, '0')} selected={Number(isi.start.slice(3, 5)) === mm} onPress={() => ubah('start', `${isi.start.slice(0, 2)}:${String(mm).padStart(2, '0')}`)} />
          ))}
        </View>
        <Button title="OK" onPress={() => setLembar(null)} />
      </BottomSheet>

      <BottomSheet visible={lembar === 'durasi'} onClose={() => setLembar(null)} title="Durasi">
        {form.durations.map((dur) => (
          <PilihanBaris key={dur} label={labelDurasi(dur)} terpilih={isi.duration === dur} onPress={() => { ubah('duration', dur); setLembar(null); }} />
        ))}
      </BottomSheet>

      <BottomSheet visible={lembar === 'notulis'} onClose={() => setLembar(null)} title="Notulis" scrollable snapPoints={['70%']}>
        <PilihanBaris label="Tanpa notulis" deskripsi="Penyelenggara menulis notulen sendiri" terpilih={isi.minute_taker_id === null} onPress={() => { ubah('minute_taker_id', null); setLembar(null); }} />
        {[form.viewer_id, ...isi.participant_ids, ...form.people.map((o) => o.id).filter((x) => x !== form.viewer_id && !isi.participant_ids.includes(x))].map((pid) => (
          <PilihanBaris
            key={pid}
            label={pid === form.viewer_id ? `${nama(pid)} (Anda)` : nama(pid)}
            deskripsi={isi.participant_ids.includes(pid) ? 'Peserta' : pid === form.viewer_id ? 'Penyelenggara' : 'Akan diundang otomatis'}
            terpilih={isi.minute_taker_id === pid}
            onPress={() => {
              ubah('minute_taker_id', pid);
              setLembar(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet visible={lembar === 'ulangi'} onClose={() => setLembar(null)} title="Ulangi">
        {form.recurrences.map((r: PengulanganRapat) => (
          <PilihanBaris key={r} label={r === 'weekly' ? `Setiap minggu (${namaHari(isi.date)})` : LABEL_ULANGI[r] ?? r} terpilih={isi.recurrence === r} onPress={() => ubah('recurrence', r)} />
        ))}
        <Button title="Pakai" onPress={() => setLembar(null)} />
      </BottomSheet>

      <BottomSheet visible={lembar === 'workspace'} onClose={() => setLembar(null)} title="Workspace tugas tindak lanjut" scrollable>
        <Text variant="meta">Hanya workspace yang bisa Anda ubah tugasnya.</Text>
        {form.workspaces.map((w) => (
          <PilihanBaris key={w.id} label={`${w.key} · ${w.name}`} terpilih={isi.workspace_id === w.id} onPress={() => { ubah('workspace_id', w.id); setLembar(null); }} />
        ))}
        <PilihanBaris label="Tanpa workspace (pilih saat menjadikan tugas)" terpilih={isi.workspace_id === null} onPress={() => { ubah('workspace_id', null); setLembar(null); }} />
      </BottomSheet>

      <BottomSheet visible={lembar === 'ringkasan'} onClose={() => setLembar(null)} title="Periksa undangan">
        <Card variant="flat" style={{ gap: 6 }}>
          <Text variant="title">{isi.title.trim()}</Text>
          <Text variant="meta">{`${hariPanjang(isi.date)} · ${tampilJam(isi.start)}–${tampilJam(jamTeks((Number(isi.start.slice(0, 2)) * 60 + Number(isi.start.slice(3, 5)) + isi.duration) % (24 * 60)))} WIB`}</Text>
          <Text variant="meta">{infoPlatform(isi.platform).label + (isi.location ? ` · ${isi.location}` : '')}</Text>
        </Card>
        <View style={s.baris}>
          <Icon name="users" size={20} color={colors.link} />
          <View style={{ flex: 1 }}>
            <Text variant="label">{`${jumlahUndangan} peserta akan menerima notifikasi`}</Text>
            <Text variant="meta">
              {[...isi.participant_ids.map((x) => namaDepan(nama(x))), ...(isi.guest_emails.length ? [`${isi.guest_emails.length} tamu eksternal (tautan pribadi dibagikan sendiri)`] : [])].join(', ')}
            </Text>
          </View>
        </View>
        <View style={s.baris}>
          <Icon name="bell" size={20} color={colors.link} />
          <Text variant="meta" style={{ flex: 1 }}>
            {isi.reminders.length ? `Pengingat ${labelPengingat(isi.reminders).replace(' sebelumnya', ' sebelum mulai')}` : 'Tanpa pengingat'}
          </Text>
        </View>
        {isi.auto_minutes ? (
          <View style={s.baris}>
            <Icon name="sparkles" size={20} color={colors.link} />
            <Text variant="meta" style={{ flex: 1 }}>
              Notulen otomatis aktif · peserta bisa menolak
            </Text>
          </View>
        ) : null}
        <Button title="Kirim undangan" icon="send" loading={mengirim} onPress={() => void kirim()} />
        <Button title="Kembali mengedit" variant="quiet" onPress={() => setLembar(null)} />
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kartuTempat: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1.5 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioIsi: { width: 12, height: 12, borderRadius: 6 },
  kotakPeserta: { borderWidth: 1, borderRadius: radius.control, padding: 10, gap: 8 },
  tambahPeserta: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 6 },
});


