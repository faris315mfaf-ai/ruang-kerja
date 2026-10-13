/**
 * Detail tugas (layar panjang) — mockup 05-tugas-workspace/05–11: status track,
 * chip properti (terkunci untuk tugas titipan), deskripsi, checklist,
 * sub-tugas, lampiran, pengamat, aktivitas + komentar kaya, komposer.
 * Semantik simpan: hanya kirim field yang berubah; izin `can` segar dari server
 * dipakai apa adanya (tidak ditebak di klien).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Share, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  amati,
  anggotaUntukTugas,
  hapusButir,
  hapusKomentar,
  hapusTugasPenuh,
  kirimKomentarKaya,
  lepasLampiran,
  pindahStatus,
  setReaksi,
  setRencana,
  suntingKomentar,
  tambahButir,
  ubahButir,
  ubahTugas,
  type BodyKomentar,
  type BodyUbahTugas,
  type ButirChecklist,
  type KomentarTugas,
  type Lampiran,
  type LajurRencana,
  type Orang,
} from '@/api/tugas';
import { ChecklistBagian } from '@/features/tugas/ChecklistBagian';
import { HtmlText } from '@/features/tugas/HtmlText';
import { PriorityBars, StatusRing, UbinWorkspace } from '@/features/tugas/ikon';
import { KomentarItem, SheetAksiKomentar, SheetPembaca, pembacaKomentar } from '@/features/tugas/KomentarItem';
import { Komposer, type ModeSunting } from '@/features/tugas/Komposer';
import { BarisAktivitas, LampiranBagian, SheetLampiran } from '@/features/tugas/LampiranAktivitas';
import { SheetInput, SheetLabel, SheetOrang, SheetPrioritas, SheetStatus, SheetTenggat } from '@/features/tugas/Pilihan';
import { PropChip } from '@/features/tugas/PropChip';
import { SheetRencanakan } from '@/features/tugas/SheetTugasSaya';
import { StatusTrack } from '@/features/tugas/StatusTrack';
import { gabungKomentar, useDetailTugas } from '@/features/tugas/useDetailTugas';
import { LABEL_PRIORITAS, PESAN_TITIPAN, hariSingkat, pesanGalat, tanggalRingkas, tanpaKoneksi } from '@/features/tugas/util';
import { waktuRelatif } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import {
  Avatar,
  AvatarStack,
  Banner,
  BottomSheet,
  Button,
  ErrorState,
  Icon,
  IconButton,
  Input,
  Loading,
  Pressable,
  Screen,
  SegmentedTabs,
  SheetAction,
  SubAppBar,
  Text,
  errorKindFromStatus,
  tanggal,
  useDialog,
  useSnackbar,
  type IconName,
} from '@/ui';

type Pilih = 'status' | 'prioritas' | 'orang' | 'tenggat' | 'mulai' | 'label' | 'properti' | 'menu' | 'rencana' | 'estimasi' | null;

export default function LayarDetailTugas(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : undefined;
  const d = useDetailTugas(id);
  const { t } = d;
  const hariIni = tanggal.hariIniIso();

  const [pilih, setPilih] = useState<Pilih>(null);
  const [editJudul, setEditJudul] = useState<string | null>(null);
  const [editDeskripsi, setEditDeskripsi] = useState<string | null>(null);
  const [galatField, setGalatField] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [teksEstimasi, setTeksEstimasi] = useState('');
  const [tabAkt, setTabAkt] = useState<'semua' | 'komentar'>('semua');
  const [aksiKomentar, setAksiKomentar] = useState<KomentarTugas | null>(null);
  const [pembacaSheet, setPembacaSheet] = useState<KomentarTugas | null>(null);
  const [lampiranSheet, setLampiranSheet] = useState<Lampiran | null>(null);
  const [sunting, setSunting] = useState<ModeSunting | null>(null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [anggotaWs, setAnggotaWs] = useState<Orang[] | null>(null);

  const can = t?.can;
  const idWorkspace = t?.workspace.id;

  // Daftar anggota untuk pemilih penanggung — dimuat saat pertama dibuka.
  useEffect(() => {
    if (pilih !== 'orang' || anggotaWs !== null || !idWorkspace) {
      return;
    }
    void anggotaUntukTugas(idWorkspace)
      .then(setAnggotaWs)
      .catch(() => snackbar.show({ message: 'Daftar anggota tidak dapat dimuat.', variant: 'bad' }));
  }, [pilih, anggotaWs, idWorkspace, snackbar]);

  function pesanOffline(): void {
    snackbar.show({ message: 'Tidak ada koneksi. Perubahan belum terkirim.', variant: 'offline' });
  }

  function galatTulis(err: unknown, cadangan: string): void {
    if (tanpaKoneksi(err)) {
      pesanOffline();
    } else if (err instanceof ApiError && err.status === 403) {
      snackbar.show({ message: err.message || PESAN_TITIPAN, variant: 'warn', duration: 6000 });
    } else if (err instanceof ApiError && err.status === 404) {
      void d.muat();
    } else {
      snackbar.show({ message: pesanGalat(err, cadangan), variant: 'bad' });
    }
  }

  function terkunci(kunci: 'edit' | 'work' | 'delete' | 'comment' | 'move' | 'plan' | 'watch' = 'edit'): void {
    snackbar.show({ message: t?.locked_reason?.[kunci] ?? t?.banner?.message ?? PESAN_TITIPAN, variant: 'warn', duration: 6000 });
  }

  /** Kirim hanya field yang berubah; respons segar menimpa tugas. */
  async function simpan(body: BodyUbahTugas): Promise<boolean> {
    if (!id || Object.keys(body).length === 0) {
      return true;
    }
    setMenyimpan(true);
    setGalatField({});
    try {
      d.terapkan(await ubahTugas(id, body));
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const peta: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          if (v[0]) {
            peta[k] = v[0];
          }
        }
        setGalatField(peta);
        snackbar.show({ message: err.firstValidationError ?? err.message, variant: 'bad' });
      } else {
        galatTulis(err, 'Gagal menyimpan perubahan.');
      }
      return false;
    } finally {
      setMenyimpan(false);
    }
  }

  async function segarkan(): Promise<void> {
    setMenyegarkan(true);
    await Promise.all([d.muat(), d.muatKomentarBaru(), d.muatPembaca()]);
    setMenyegarkan(false);
  }

  async function pindah(statusId: string): Promise<void> {
    if (!id || !t) {
      return;
    }
    try {
      await pindahStatus(id, { status_id: statusId });
      await d.muat();
    } catch (err) {
      galatTulis(err, 'Gagal memindahkan tugas.');
    }
  }

  async function tandaiSelesai(): Promise<void> {
    if (!id || !t) {
      return;
    }
    if (t.workspace.type !== 'personal') {
      const ok = await dialog.confirm({
        title: 'Tandai selesai?',
        message: `${t.title} berada di workspace tim. Tugas dikirim ke kolom Review dulu, bukan langsung Selesai.`,
        confirmLabel: 'Kirim ke Review',
      });
      if (!ok) {
        return;
      }
    }
    try {
      const hasil = await pindahStatus(id, { done: true });
      await d.muat();
      snackbar.show({ message: hasil.status.is_done ? `${t.key} ditandai selesai` : `${t.key} dikirim ke ${hasil.status.name}`, variant: 'ok' });
    } catch (err) {
      galatTulis(err, 'Gagal menyelesaikan tugas.');
    }
  }

  async function bukaKembali(): Promise<void> {
    if (!id) {
      return;
    }
    try {
      await pindahStatus(id, { done: false });
      await d.muat();
    } catch (err) {
      galatTulis(err, 'Gagal membuka kembali tugas.');
    }
  }

  async function ubahRencana(l: LajurRencana | null): Promise<void> {
    if (!id || !t) {
      return;
    }
    try {
      await setRencana(id, l);
      d.ubahLokal((x) => ({ ...x, plan: { bucket: l, planned_for: l ? hariIni : null } }));
      snackbar.show({ message: l ? `${t.key} direncanakan` : `${t.key} kembali otomatis`, variant: 'ok' });
    } catch (err) {
      galatTulis(err, 'Gagal menyimpan rencana.');
    }
  }

  async function toggleAmati(): Promise<void> {
    if (!id || !t) {
      return;
    }
    const target = !t.am_watching;
    try {
      const h = await amati(id, target);
      d.ubahLokal((x) => ({ ...x, am_watching: h.watching, watchers: h.watchers }));
      snackbar.show({ message: h.watching ? `Anda mengamati ${t.key}` : `Berhenti mengamati ${t.key}`, variant: 'ok' });
    } catch (err) {
      galatTulis(err, 'Gagal mengubah pengamatan.');
    }
  }

  async function hapus(): Promise<void> {
    if (!id || !t) {
      return;
    }
    const ok = await dialog.confirm({
      title: `Hapus ${t.key}?`,
      message: `“${t.title}” beserta checklist, sub-tugas, komentar, dan lampirannya akan dihapus. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await hapusTugasPenuh(id);
      snackbar.show({ message: `${t.key} dihapus`, variant: 'ok' });
      router.back();
    } catch (err) {
      galatTulis(err, 'Gagal menghapus tugas.');
    }
  }

  // ── Checklist ──
  function terapkanChecklist(h: { items: ButirChecklist[]; checklist: { done: number; total: number } | null }): void {
    d.ubahLokal((x) => ({ ...x, checklist_items: h.items, checklist: h.checklist }));
  }
  async function centang(b: ButirChecklist, nilai: boolean): Promise<void> {
    if (!id) {
      return;
    }
    d.ubahLokal((x) => ({ ...x, checklist_items: x.checklist_items.map((i) => (i.id === b.id ? { ...i, is_done: nilai } : i)) }));
    try {
      terapkanChecklist(await ubahButir(id, b.id, { is_done: nilai }));
    } catch (err) {
      d.ubahLokal((x) => ({ ...x, checklist_items: x.checklist_items.map((i) => (i.id === b.id ? { ...i, is_done: !nilai } : i)) }));
      galatTulis(err, 'Gagal mengubah butir.');
    }
  }
  async function tambahButirBaru(judul: string): Promise<boolean> {
    if (!id) {
      return false;
    }
    try {
      terapkanChecklist(await tambahButir(id, judul));
      return true;
    } catch (err) {
      galatTulis(err, 'Gagal menambah butir.');
      return false;
    }
  }
  async function ubahJudulButir(b: ButirChecklist, judul: string): Promise<boolean> {
    if (!id) {
      return false;
    }
    try {
      terapkanChecklist(await ubahButir(id, b.id, { title: judul }));
      return true;
    } catch (err) {
      galatTulis(err, 'Gagal mengubah butir.');
      return false;
    }
  }
  async function hapusSatuButir(b: ButirChecklist): Promise<void> {
    if (!id) {
      return;
    }
    try {
      terapkanChecklist(await hapusButir(id, b.id));
    } catch (err) {
      galatTulis(err, 'Gagal menghapus butir.');
    }
  }
  async function geserButir(b: ButirChecklist, arah: 'naik' | 'turun'): Promise<void> {
    if (!id || !t) {
      return;
    }
    const daftar = t.checklist_items;
    const i = daftar.findIndex((x) => x.id === b.id);
    const tetangga = arah === 'naik' ? daftar[i - 1] : daftar[i + 1];
    if (!tetangga) {
      return;
    }
    try {
      terapkanChecklist(await ubahButir(id, b.id, arah === 'naik' ? { before_id: tetangga.id } : { after_id: tetangga.id }));
    } catch (err) {
      galatTulis(err, 'Gagal mengurutkan butir.');
    }
  }

  // ── Lampiran ──
  async function lepas(l: Lampiran): Promise<void> {
    if (!id) {
      return;
    }
    const ok = await dialog.confirm({ title: 'Lepas lampiran?', message: `${l.name} dilepas dari ${t?.key ?? 'tugas'}. Filenya tetap ada di Google Drive.`, confirmLabel: 'Lepas', destructive: true });
    if (!ok) {
      return;
    }
    try {
      const h = await lepasLampiran(id, l.id);
      d.ubahLokal((x) => ({ ...x, attachments: h.attachments, attachments_can_edit: h.attachments_can_edit }));
    } catch (err) {
      galatTulis(err, 'Gagal melepas lampiran.');
    }
  }

  // ── Komentar ──
  async function kirimKomentar(body: BodyKomentar, mode: ModeSunting | null): Promise<string | null> {
    if (!id) {
      return 'Tugas tidak ditemukan.';
    }
    try {
      if (mode) {
        const baru = await suntingKomentar(mode.id, body);
        d.setKomentar((lama) => gabungKomentar(lama, [baru]));
        setSunting(null);
      } else {
        const baru = await kirimKomentarKaya(id, body);
        d.setKomentar((lama) => gabungKomentar(lama, [baru]));
        d.ubahLokal((x) => ({ ...x, comments: { ...x.comments, count: x.comments.count + 1 } }));
        setTabAkt('komentar');
      }
      return null;
    } catch (err) {
      if (tanpaKoneksi(err)) {
        return 'Tidak ada koneksi. Komentar belum terkirim — coba lagi saat tersambung.';
      }
      return pesanGalat(err, 'Gagal mengirim komentar.');
    }
  }
  async function reaksi(k: KomentarTugas, emoji: string): Promise<void> {
    const aktif = !k.my_reactions.includes(emoji);
    try {
      const baru = await setReaksi(k.id, emoji, aktif);
      d.setKomentar((lama) => gabungKomentar(lama, [baru]));
    } catch (err) {
      galatTulis(err, 'Gagal mengirim reaksi.');
    }
  }
  async function hapusSatuKomentar(k: KomentarTugas): Promise<void> {
    const ok = await dialog.confirm({ title: 'Hapus komentar?', message: 'Komentar ini akan ditandai dihapus untuk semua orang.', confirmLabel: 'Hapus', destructive: true });
    if (!ok) {
      return;
    }
    try {
      const baru = await hapusKomentar(k.id);
      d.setKomentar((lama) => gabungKomentar(lama, [baru]));
    } catch (err) {
      galatTulis(err, 'Gagal menghapus komentar.');
    }
  }

  const pembacaPer = useMemo(() => {
    const peta = new Map<string, ReturnType<typeof pembacaKomentar>>();
    if (d.melacakBaca) {
      for (const k of d.komentar) {
        peta.set(k.id, pembacaKomentar(k, d.pembaca, null));
      }
    }
    return peta;
  }, [d.komentar, d.pembaca, d.melacakBaca]);

  // ── Render ──
  const bar = (
    <SubAppBar
      title={t?.key ?? 'Detail tugas'}
      actions={
        t
          ? [
              { icon: 'share-2', label: 'Bagikan tugas', onPress: () => void Share.share({ message: `${t.key} · ${t.title}` }) },
              { icon: 'ellipsis-vertical', label: 'Menu tugas', onPress: () => setPilih('menu') },
            ]
          : []
      }
    />
  );

  if (d.memuat && !t) {
    return (
      <Screen header={<SubAppBar title="Detail tugas" />}>
        <Loading rows={6} />
      </Screen>
    );
  }
  if (!t) {
    return (
      <Screen header={<SubAppBar title="Detail tugas" />}>
        <ErrorState
          kind={errorKindFromStatus(d.galat?.status)}
          title={d.galat?.status === 404 ? 'Tugas tidak ditemukan' : d.galat?.status === 0 ? 'Tugas belum bisa dimuat' : undefined}
          message={d.galat?.status === 404 ? 'Tugas ini sudah dihapus, atau Anda tidak punya akses ke workspace-nya.' : (d.galat?.pesan ?? 'Tidak dapat memuat tugas.')}
          onRetry={d.galat?.status === 404 ? () => router.back() : () => void d.muat()}
        />
      </Screen>
    );
  }

  const selesai = t.status.is_done;
  const dapatEdit = can?.edit === true;
  const kunciProp = !dapatEdit;
  const bannerIkon: IconName = t.banner?.kind === 'arsip' ? 'archive' : t.banner?.kind === 'lihat_saja' ? 'eye' : 'lock';
  const statusAktif = t.statuses.find((s) => s.id === t.status_id);
  const namaPenanggung = t.assignee_people.length === 0 ? 'Penanggung' : t.assignee_people.map((o) => o.name).join(', ');
  const punyaInduk = t.parent !== null;

  const aktivitasCampur = [
    ...t.activity_preview.map((a) => ({ jenis: 'akt' as const, waktu: a.created_at, a })),
    ...d.komentar.map((k) => ({ jenis: 'kom' as const, waktu: k.created_at ?? '', k })),
  ].sort((a, b) => (a.waktu < b.waktu ? -1 : 1));

  const komposerTersedia = can?.comment === true;
  const alasanKomposer = t.banner?.kind === 'arsip' ? 'Workspace diarsipkan · hanya baca' : t.banner?.kind === 'lihat_saja' ? 'Mode lihat saja · tidak bisa berkomentar' : (t.locked_reason?.comment ?? 'Anda tidak bisa berkomentar di tugas ini.');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Screen
        header={bar}
        refreshing={menyegarkan}
        onRefresh={() => void segarkan()}
        contentStyle={{ gap: 18, paddingBottom: 24 }}
        footer={
          komposerTersedia ? (
            <View style={{ flex: 1 }}>
              <Komposer taskId={t.id} workspaceKey={t.workspace.key} sunting={sunting} onBatalSunting={() => setSunting(null)} onKirim={kirimKomentar} />
            </View>
          ) : (
            <View style={[s.terkunci, { flex: 1, backgroundColor: colors.surface2 }]}>
              <Icon name="lock" size={18} color={colors.muted} />
              <Text variant="label" tone="muted" style={{ flex: 1 }}>
                {alasanKomposer}
              </Text>
            </View>
          )
        }
      >
        {d.basi ? <Banner tone="warn" icon="cloud-off" message="Offline · menampilkan data terakhir. Perubahan butuh sambungan internet." /> : null}
        {d.hilang ? (
          <Banner tone="bad" icon="trash-2" message="Tugas ini dihapus orang lain." actionLabel="Kembali" onAction={() => router.back()} />
        ) : null}
        {t.banner ? <Banner tone={t.banner.kind === 'titipan' ? 'info' : 'neutral'} icon={bannerIkon} message={t.banner.message} /> : null}

        <View style={{ gap: 8 }}>
          <View style={s.ws}>
            <UbinWorkspace nama={t.workspace.name} jenis={t.workspace.type} size={22} />
            <Text variant="meta" numberOfLines={1} style={{ flexShrink: 1 }}>
              {t.workspace.type === 'personal' ? 'Pribadi' : t.workspace.name}
            </Text>
            {t.source === 'attendance' ? <Text variant="meta" tone="link" weight={700}>· dari absen</Text> : null}
          </View>
          {punyaInduk && t.parent ? (
            <Pressable onPress={() => router.push(`/tugas/${t.parent?.id ?? ''}`)} accessibilityRole="button" accessibilityLabel={`Sub-tugas dari ${t.parent.key}`} style={s.ws}>
              <Icon name="corner-left-up" size={16} color={colors.link} />
              <Text variant="meta" tone="link" weight={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                Sub-tugas dari {t.parent.key} · {t.parent.title}
              </Text>
            </Pressable>
          ) : null}

          {editJudul !== null ? (
            <View style={{ gap: 8 }}>
              <Input
                value={editJudul}
                onChangeText={setEditJudul}
                multiline
                maxLength={300}
                autoFocus
                invalid={Boolean(galatField.title) || editJudul.trim().length > 255}
                accessibilityLabel="Judul tugas"
                style={{ fontSize: 22, minHeight: 64 }}
              />
              <Text variant="meta" tone={editJudul.trim().length > 255 ? 'danger' : 'muted'}>
                {galatField.title ?? `${editJudul.trim().length}/255`}
              </Text>
              <View style={s.aksiKecil}>
                <Button title="Batal" variant="outline" size="sm" onPress={() => { setEditJudul(null); setGalatField({}); }} />
                <Button
                  title="Simpan"
                  size="sm"
                  icon="check"
                  loading={menyimpan}
                  disabled={editJudul.trim() === '' || editJudul.trim().length > 255}
                  onPress={() => {
                    const baru = editJudul.trim();
                    if (baru === t.title) {
                      setEditJudul(null);
                      return;
                    }
                    void simpan({ title: baru }).then((ok) => ok && setEditJudul(null));
                  }}
                />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => (dapatEdit ? setEditJudul(t.title) : terkunci('edit'))}
              scaleTo={1}
              accessibilityRole="button"
              accessibilityLabel={`Judul: ${t.title}. ${dapatEdit ? 'Ketuk untuk mengubah' : 'Terkunci'}`}
            >
              <Text variant="h1" style={selesai ? { color: colors.muted } : undefined}>
                {t.title}
              </Text>
            </Pressable>
          )}
        </View>

        {can?.move ? (
          dapatEdit ? (
            <StatusTrack statuses={t.statuses} nilai={t.status_id} onPilih={(sid) => void pindah(sid)} />
          ) : (
            <View style={s.aksiBaris}>
              <View style={{ flex: 1 }}>
                <Button title="Pindahkan" icon="arrow-right-left" variant="tonal" onPress={() => setPilih('status')} />
              </View>
              {can.plan ? (
                <View style={{ flex: 1 }}>
                  <Button title="Rencanakan" icon="calendar-clock" variant="outline" onPress={() => setPilih('rencana')} />
                </View>
              ) : null}
            </View>
          )
        ) : null}

        <View style={s.chips}>
          <PropChip
            leading={statusAktif ? <StatusRing kategori={statusAktif.category} size={22} /> : <StatusRing kategori={t.status.category} size={22} />}
            label={t.status.name}
            onPress={can?.move ? () => setPilih('status') : undefined}
            terkunci={!can?.move}
          />
          <PropChip
            leading={t.priority.value === 0 ? <Icon name="minus" size={18} /> : <PriorityBars nilai={t.priority.value} size={20} />}
            label={t.priority.value === 0 ? 'Prioritas' : (LABEL_PRIORITAS[t.priority.value] ?? '')}
            onPress={() => (dapatEdit ? setPilih('prioritas') : terkunci('edit'))}
            terkunci={kunciProp}
          />
          <PropChip
            leading={t.assignee_people[0] ? <Avatar name={t.assignee_people[0].name} size="sm" /> : <Icon name="user" size={20} />}
            label={namaPenanggung}
            onPress={() => (dapatEdit ? setPilih('orang') : terkunci('edit'))}
            terkunci={kunciProp}
          />
          <PropChip
            leading={<Icon name="calendar" size={20} />}
            label={t.due_date ? hariSingkat(t.due_date) : 'Tenggat'}
            putus={!t.due_date}
            onPress={() => (dapatEdit ? setPilih('tenggat') : terkunci('edit'))}
            terkunci={kunciProp}
          />
          {t.labels.length > 0 ? (
            t.labels.map((l) => <PropChip key={l.id} leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentBlue }} />} label={l.name} onPress={() => (dapatEdit ? setPilih('label') : terkunci('edit'))} terkunci={kunciProp} />)
          ) : (
            <PropChip leading={<Icon name="tag" size={20} />} label="Label" putus onPress={() => (dapatEdit ? setPilih('label') : terkunci('edit'))} terkunci={kunciProp} />
          )}
        </View>
        <Pressable onPress={() => setPilih('properti')} accessibilityRole="button" accessibilityLabel="Semua properti" style={s.baris} scaleTo={1}>
          <Text variant="label" tone="link">
            {dapatEdit ? 'Semua properti' : 'Lihat properti'}
          </Text>
          <Icon name="chevron-right" size={18} color={colors.link} />
        </Pressable>

        {/* Deskripsi */}
        <View style={{ gap: 8 }}>
          <View style={s.kepala}>
            <Text variant="overline" tone="muted" style={{ flex: 1 }}>
              Deskripsi
            </Text>
            {!dapatEdit ? <Icon name="lock" size={16} color={colors.subtle} /> : editDeskripsi === null ? (
              <Pressable
                onPress={() => {
                  const mulai = (): void => setEditDeskripsi(t.description_text ?? '');
                  if (!t.description_plain && t.description_html) {
                    void dialog
                      .confirm({ title: 'Ubah sebagai teks polos?', message: 'Deskripsi ini punya format (tebal, daftar, sebutan). Mengubahnya di ponsel akan menjadi teks polos.', confirmLabel: 'Lanjut mengubah' })
                      .then((ok) => ok && mulai());
                  } else {
                    mulai();
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Ubah deskripsi"
                hitSlop={8}
              >
                <Text variant="label" tone="link">
                  Ubah
                </Text>
              </Pressable>
            ) : null}
          </View>
          {editDeskripsi !== null ? (
            <View style={{ gap: 8 }}>
              <Input value={editDeskripsi} onChangeText={setEditDeskripsi} multiline maxLength={20000} autoFocus accessibilityLabel="Deskripsi tugas" />
              <View style={s.aksiKecil}>
                <Button title="Batal" variant="outline" size="sm" onPress={() => setEditDeskripsi(null)} />
                <Button
                  title="Simpan"
                  size="sm"
                  icon="check"
                  loading={menyimpan}
                  onPress={() => {
                    const baru = editDeskripsi.trim() === '' ? null : editDeskripsi.trim();
                    const lama = (t.description_text ?? '').trim() === '' ? null : (t.description_text ?? '').trim();
                    if (baru === lama) {
                      setEditDeskripsi(null);
                      return;
                    }
                    void simpan({ description: baru }).then((ok) => ok && setEditDeskripsi(null));
                  }}
                />
              </View>
            </View>
          ) : t.description_html || t.description_text ? (
            <HtmlText html={t.description_html} fallback={t.description_text} />
          ) : (
            <Text variant="meta">{dapatEdit ? 'Belum ada deskripsi. Ketuk Ubah untuk menambahkan.' : 'Belum ada deskripsi.'}</Text>
          )}
        </View>

        <ChecklistBagian
          butir={t.checklist_items}
          boleh={can?.work === true}
          alasanTerkunci={t.locked_reason?.work ?? t.banner?.message ?? null}
          onCentang={(b, v) => void centang(b, v)}
          onTambah={tambahButirBaru}
          onUbah={ubahJudulButir}
          onHapus={(b) => void hapusSatuButir(b)}
          onGeser={(b, a) => void geserButir(b, a)}
          onTerkunci={(p) => snackbar.show({ message: p, variant: 'warn' })}
        />

        {/* Sub-tugas */}
        {!punyaInduk ? (
          <View style={{ gap: 10 }}>
            <View style={s.kepala}>
              <Text variant="overline" tone="muted">
                Sub-tugas
              </Text>
              {t.subtasks.length > 0 ? (
                <Text variant="overline" tone="muted">
                  {t.subtasks.filter((x) => x.status.is_done).length}/{t.subtasks.length}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              {can?.work ? (
                <IconButton
                  icon="plus"
                  label="Tambah sub-tugas"
                  variant="ghost"
                  size={44}
                  onPress={() => router.push({ pathname: '/tugas/baru', params: { parent_id: t.id, workspace: t.workspace.id } })}
                />
              ) : null}
            </View>
            {t.subtasks.length === 0 ? <Text variant="meta">Belum ada sub-tugas.</Text> : null}
            {t.subtasks.map((st) => (
              <Pressable
                key={st.id}
                onPress={() => router.push(`/tugas/${st.id}`)}
                scaleTo={0.99}
                accessibilityRole="button"
                accessibilityLabel={`Sub-tugas ${st.key} ${st.title}, ${st.status.name}`}
                style={[s.sub, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <StatusRing kategori={st.status.category} size={24} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" numberOfLines={2}>
                    {st.title}
                  </Text>
                  <Text variant="meta" numberOfLines={1}>
                    {st.key}
                    {st.due_date ? ` · ${st.status.is_done ? 'Selesai ' : ''}${hariSingkat(st.due_date)}` : ''}
                  </Text>
                </View>
                {st.assignee_people[0] ? <Avatar name={st.assignee_people[0].name} size="sm" /> : null}
                <PriorityBars nilai={st.priority.value} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text variant="meta">Sub-tugas tidak punya sub-tugas lagi (maks. satu tingkat).</Text>
        )}

        <LampiranBagian lampiran={t.attachments} drive={t.drive} bolehUbah={can?.work === true && t.attachments_can_edit} alasanTerkunci={t.locked_reason?.work ?? null} onAksi={setLampiranSheet} />

        {/* Pengamat */}
        <View style={s.kepala}>
          <Text variant="overline" tone="muted">
            Pengamat
          </Text>
          <View style={{ flex: 1 }}>{t.watchers.length > 0 ? <AvatarStack names={t.watchers.map((w) => w.name)} max={5} /> : <Text variant="meta">Belum ada</Text>}</View>
          {can?.watch ? <Button title={t.am_watching ? 'Berhenti amati' : 'Amati'} variant={t.am_watching ? 'outline' : 'tonal'} size="sm" icon={t.am_watching ? 'eye-off' : 'eye'} onPress={() => void toggleAmati()} /> : null}
        </View>

        {/* Aktivitas & komentar */}
        <View style={{ gap: 12 }}>
          <View style={s.kepala}>
            <Text variant="overline" tone="muted" style={{ flex: 1 }}>
              Aktivitas
            </Text>
            <View style={{ width: 230 }}>
              <SegmentedTabs
                value={tabAkt}
                onChange={setTabAkt}
                options={[
                  { value: 'semua', label: 'Semua' },
                  { value: 'komentar', label: 'Komentar', badge: t.comments.count > 0 ? t.comments.count : null },
                ]}
              />
            </View>
          </View>

          {d.memuatKomentar && d.komentar.length === 0 ? <Loading rows={2} /> : null}
          {d.galatKomentar && d.komentar.length === 0 ? (
            <Banner tone="bad" message={d.galatKomentar} actionLabel="Coba lagi" onAction={() => void d.muatKomentarBaru()} />
          ) : null}
          {d.masihAdaLama ? <Button title={d.memuatLama ? 'Memuat…' : 'Muat komentar sebelumnya'} variant="quiet" icon="chevron-up" loading={d.memuatLama} onPress={() => void d.muatKomentarLama()} /> : null}

          {tabAkt === 'komentar' ? (
            d.komentar.length === 0 && !d.memuatKomentar ? (
              <Text variant="meta">Belum ada komentar. Mulai diskusi di bawah.</Text>
            ) : (
              d.komentar.map((k) => (
                <KomentarItem key={k.id} k={k} pembaca={pembacaPer.get(k.id) ?? []} onReaksi={(kk, e) => void reaksi(kk, e)} onAksi={setAksiKomentar} onPembaca={setPembacaSheet} />
              ))
            )
          ) : (
            <>
              {aktivitasCampur.map((x) =>
                x.jenis === 'akt' ? (
                  <BarisAktivitas key={`a${x.a.id}`} a={x.a} />
                ) : (
                  <KomentarItem key={`k${x.k.id}`} k={x.k} pembaca={pembacaPer.get(x.k.id) ?? []} onReaksi={(kk, e) => void reaksi(kk, e)} onAksi={setAksiKomentar} onPembaca={setPembacaSheet} />
                ),
              )}
              {aktivitasCampur.length === 0 && !d.memuatKomentar ? <Text variant="meta">Belum ada aktivitas.</Text> : null}
            </>
          )}
          <Button title="Lihat semua riwayat" variant="outline" size="sm" icon="history" onPress={() => router.push({ pathname: '/tugas/aktivitas', params: { id: t.id, key: t.key } })} />
        </View>

        <View style={s.aksiBaris}>
          {selesai ? (
            <View style={{ flex: 1 }}>
              <Button title="Buka kembali tugas" variant="outline" icon="rotate-ccw" disabled={!can?.move} onPress={() => void bukaKembali()} />
            </View>
          ) : (
            <>
              {can?.plan ? (
                <View style={{ flex: 1 }}>
                  <Button title="Rencanakan" variant="outline" icon="calendar-clock" onPress={() => setPilih('rencana')} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button title="Tandai selesai" icon="check" disabled={!can?.move} disabledReason={t.locked_reason?.move ?? undefined} onPress={() => void tandaiSelesai()} />
              </View>
            </>
          )}
        </View>
      </Screen>

      {/* Sheet pilihan */}
      <SheetStatus
        visible={pilih === 'status'}
        onClose={() => setPilih(null)}
        statuses={t.statuses}
        nilai={t.status_id}
        subjudul={`${t.key} · saat ini ${t.status.name}`}
        catatan="Selesai di workspace tim mengirim tugas ke Review dulu."
        onPilih={(sid) => void pindah(sid)}
      />
      <SheetPrioritas visible={pilih === 'prioritas'} onClose={() => setPilih(null)} nilai={t.priority.value} onPilih={(n) => void simpan({ priority: n })} />
      <SheetOrang
        visible={pilih === 'orang'}
        onClose={() => setPilih(null)}
        orang={[...(anggotaWs ?? []), ...t.assignee_people.filter((a) => !(anggotaWs ?? []).some((o) => o.id === a.id))]}
        terpilih={t.assignee_people.map((o) => o.id)}
        onSimpan={(ids) => void simpan({ assignee_ids: ids })}
      />
      <SheetTenggat visible={pilih === 'tenggat'} onClose={() => setPilih(null)} nilai={t.due_date} hariIni={hariIni} min={t.start_date ?? undefined} subjudul={`${t.title} · ${t.key}`} onPilih={(iso) => void simpan({ due_date: iso })} />
      <SheetTenggat visible={pilih === 'mulai'} onClose={() => setPilih(null)} nilai={t.start_date} hariIni={hariIni} judul="Tanggal mulai" subjudul={`${t.title} · ${t.key}`} onPilih={(iso) => void simpan({ start_date: iso })} />
      <SheetLabel visible={pilih === 'label'} onClose={() => setPilih(null)} label={t.workspace_labels} terpilih={t.labels.map((l) => l.id)} onSimpan={(ids) => void simpan({ label_ids: ids })} />
      <SheetRencanakan
        visible={pilih === 'rencana'}
        onClose={() => setPilih(null)}
        subjudul={`${t.title} · ${t.key}`}
        lajur={t.plan.bucket}
        hariIni={hariIni}
        onPilih={(l) => void ubahRencana(l)}
      />

      <BottomSheet visible={pilih === 'estimasi'} onClose={() => setPilih(null)} title="Estimasi" showClose>
        <SheetInput
          value={teksEstimasi}
          onChangeText={setTeksEstimasi}
          placeholder="mis. 1,5"
          keyboardType="decimal-pad"
          accessibilityLabel="Estimasi dalam jam"
          invalid={Boolean(galatField.estimate_hours)}
        />
        <Text variant="meta" tone={galatField.estimate_hours ? 'danger' : 'muted'}>
          {galatField.estimate_hours ?? 'Dalam jam. Angka desimal pakai koma, mis. 1,5. Kosongkan untuk menghapus.'}
        </Text>
        <Button
          title="Simpan"
          loading={menyimpan}
          onPress={() => {
            const teks = teksEstimasi.trim().replace(',', '.');
            const n = teks === '' ? null : Number(teks);
            if (n !== null && (!Number.isFinite(n) || n < 0 || n > 9999)) {
              setGalatField({ estimate_hours: 'Estimasi harus angka 0–9999 jam.' });
              return;
            }
            void simpan({ estimate_hours: n }).then((ok) => ok && setPilih(null));
          }}
        />
      </BottomSheet>

      <BottomSheet visible={pilih === 'properti'} onClose={() => setPilih(null)} title="Semua properti" showClose scrollable>
        {(
          [
            { ikon: 'circle-dot', judul: 'Status', nilai: t.status.name, aksi: can?.move ? 'status' : null, kunci: !can?.move },
            { ikon: 'signal-high', judul: 'Prioritas', nilai: LABEL_PRIORITAS[t.priority.value] ?? '', aksi: dapatEdit ? 'prioritas' : null, kunci: !dapatEdit },
            { ikon: 'users', judul: 'Penanggung jawab', nilai: t.assignee_people.map((o) => o.name).join(', ') || 'Belum ada', aksi: dapatEdit ? 'orang' : null, kunci: !dapatEdit },
            { ikon: 'calendar-plus', judul: 'Mulai', nilai: t.start_date ? hariSingkat(t.start_date) : 'Belum diatur', aksi: dapatEdit ? 'mulai' : null, kunci: !dapatEdit },
            { ikon: 'calendar', judul: 'Tenggat', nilai: t.due_date ? hariSingkat(t.due_date) : 'Belum diatur', aksi: dapatEdit ? 'tenggat' : null, kunci: !dapatEdit },
            { ikon: 'timer', judul: 'Estimasi', nilai: t.estimate_hours !== null ? `${String(t.estimate_hours).replace('.', ',')} jam` : 'Belum diatur', aksi: dapatEdit ? 'estimasi' : null, kunci: !dapatEdit },
            { ikon: 'tag', judul: 'Label', nilai: t.labels.map((l) => l.name).join(', ') || 'Tanpa label', aksi: dapatEdit ? 'label' : null, kunci: !dapatEdit },
          ] as { ikon: IconName; judul: string; nilai: string; aksi: Pilih; kunci: boolean }[]
        ).map((p) => (
          <Pressable
            key={p.judul}
            scaleTo={1}
            accessibilityRole="button"
            accessibilityLabel={`${p.judul}: ${p.nilai}${p.kunci ? ', terkunci' : ''}`}
            onPress={() => {
              if (p.aksi) {
                if (p.aksi === 'estimasi') {
                  setTeksEstimasi(t.estimate_hours !== null ? String(t.estimate_hours).replace('.', ',') : '');
                }
                const tujuan = p.aksi;
                setPilih(null);
                setTimeout(() => setPilih(tujuan), 250);
              } else {
                terkunci('edit');
              }
            }}
            style={s.prop}
          >
            <Icon name={p.ikon} size={22} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text variant="meta">{p.judul}</Text>
              <Text variant="title" numberOfLines={2}>
                {p.nilai}
              </Text>
            </View>
            {p.kunci ? <Icon name="lock" size={18} color={colors.subtle} /> : <Icon name="chevron-right" size={18} color={colors.muted} />}
          </Pressable>
        ))}
        <View style={s.prop}>
          <Icon name="user-round" size={22} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text variant="meta">Dibuat oleh</Text>
            <Text variant="title">
              {t.creator?.name ?? '—'} · {tanggalRingkas(t.created_at?.slice(0, 10))}
            </Text>
          </View>
        </View>
        {t.completed_at ? (
          <View style={s.prop}>
            <Icon name="circle-check" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text variant="meta">Selesai</Text>
              <Text variant="title">{waktuRelatif(t.completed_at)}</Text>
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={pilih === 'menu'} onClose={() => setPilih(null)} title={t.key} showClose>
        {can?.watch ? (
          <SheetAction
            icon={t.am_watching ? 'eye-off' : 'eye'}
            label={t.am_watching ? 'Berhenti amati' : 'Amati'}
            description="Dapatkan notifikasi komentar dan perubahan"
            onPress={() => {
              setPilih(null);
              void toggleAmati();
            }}
          />
        ) : null}
        {can?.plan ? <SheetAction icon="calendar-clock" label="Rencanakan" onPress={() => { setPilih(null); setTimeout(() => setPilih('rencana'), 250); }} /> : null}
        {can?.work && !punyaInduk ? (
          <SheetAction
            icon="corner-down-right"
            label="Tambah sub-tugas"
            onPress={() => {
              setPilih(null);
              router.push({ pathname: '/tugas/baru', params: { parent_id: t.id, workspace: t.workspace.id } });
            }}
          />
        ) : null}
        <SheetAction
          icon="share-2"
          label="Bagikan"
          onPress={() => {
            setPilih(null);
            void Share.share({ message: `${t.key} · ${t.title}` });
          }}
        />
        {can?.delete ? (
          <SheetAction
            icon="trash-2"
            label="Hapus"
            tone="danger"
            onPress={() => {
              setPilih(null);
              setTimeout(() => void hapus(), 250);
            }}
          />
        ) : (
          <SheetAction icon="lock" label="Hapus tidak tersedia" description={t.locked_reason?.delete ?? 'Hanya pembuat atau atasan yang bisa menghapus tugas ini.'} onPress={() => { setPilih(null); terkunci('delete'); }} />
        )}
      </BottomSheet>

      <SheetAksiKomentar
        k={aksiKomentar}
        onClose={() => setAksiKomentar(null)}
        onReaksi={(k, e) => void reaksi(k, e)}
        onSunting={(k) => setSunting({ id: k.id, teks: k.body_text ?? '' })}
        onHapus={(k) => void hapusSatuKomentar(k)}
      />
      <SheetPembaca visible={pembacaSheet !== null} onClose={() => setPembacaSheet(null)} pembaca={pembacaSheet ? (pembacaPer.get(pembacaSheet.id) ?? []) : []} />
      <SheetLampiran lampiran={lampiranSheet} onClose={() => setLampiranSheet(null)} onLepas={(l) => void lepas(l)} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  ws: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 36 },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aksiKecil: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  aksiBaris: { flexDirection: 'row', gap: 10 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 12 },
  terkunci: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.lg, paddingHorizontal: 14, minHeight: 52 },
  prop: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 8 },
});
