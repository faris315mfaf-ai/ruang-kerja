/**
 * Tugas saya (tab Tugas) — lingkup Ditugaskan · Saya amati · Saya buat,
 * kelompok Tenggat/Workspace/Prioritas/Status, filter, tampilan tersimpan,
 * mode "Rencana saya", geser kartu (Tunda · Selesai), paginasi, dan keadaan
 * memuat/kosong/galat/offline. Mockup: docs/mockups/android/screens/05-tugas-workspace/01–04.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Share, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  daftarTampilan,
  hapusTampilan,
  pindahStatus,
  setRencana,
  simpanTampilan,
  ubahTugas,
  type BarisTugas,
  type ItemRencana,
  type LajurRencana,
  type TampilanTersimpan,
  type TugasBaruMasuk,
} from '@/api/tugas';
import { hangatkanFormTugas } from '@/features/tugas/hangat';
import { daftarChip, dariTampilan, jumlahFilter, keTampilan, FILTER_KOSONG, type KelompokPer } from '@/features/tugas/filter';
import { PriorityBars, StatusRing, UbinWorkspace } from '@/features/tugas/ikon';
import { RencanaView } from '@/features/tugas/RencanaView';
import { SheetFilter, SheetKelompok, SheetRencanakan, SheetTampilan, DialogNamaTampilan } from '@/features/tugas/SheetTugasSaya';
import { SheetTenggat } from '@/features/tugas/Pilihan';
import { SwipeRow, type AksiGeser } from '@/features/tugas/SwipeRow';
import { DetailTugas } from '@/features/tugas/DetailTugas';
import { TugasBaruSheet } from '@/features/tugas/TugasBaruSheet';
import { TugasKartu } from '@/features/tugas/TugasKartu';
import { useTugasSaya } from '@/features/tugas/useTugasSaya';
import {
  LABEL_KATEGORI,
  LABEL_KELOMPOK,
  LABEL_LAJUR,
  LABEL_LINGKUP,
  LABEL_PRIORITAS,
  PESAN_TITIPAN,
  URUTAN_KELOMPOK,
  akhirPekan,
  hariSingkat,
  pesanGalat,
  stempelWaktu,
  tanpaKoneksi,
} from '@/features/tugas/util';
import { adalahOnline } from '@/offline';
import { PESAN_DISIMPAN_HP, tulisPindahStatus, tulisUbahTugas } from '@/offline/fitur/tugas';
import { eIdSementara } from '@/offline/fitur/tugasBersama';
import { terapkanDaftarBaris, useOverlayTugas } from '@/offline/fitur/tugasOverlay';
import { useSetelahSinkron } from '@/offline/fitur/useSetelahSinkron';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';
import {
  AppBar,
  Banner,
  Button,
  Chip,
  ChipScroller,
  EmptyState,
  ErrorState,
  Fab,
  Icon,
  Loading,
  PanelProvider,
  Pressable,
  Screen,
  SearchInput,
  SegmentedTabs,
  SheetAction,
  BottomSheet,
  Text,
  errorKindFromStatus,
  tanggal,
  useDialog,
  useSnackbar,
  useTabBarSpace,
  useTataLetak,
  lebarDaftar,
  type IconName,
} from '@/ui';

interface Seksi {
  kunci: string;
  judul: string;
  icon?: IconName;
  tone: 'danger' | 'warning' | 'text';
  catatan?: string;
  leading?: React.ReactNode;
  items: BarisTugas[];
}

function judulTanggal(iso: string): string {
  const p = tanggal.parseIso(iso);
  if (!p) {
    return '';
  }
  const idx = (tanggal.hariKe(p) + 6) % 7;
  return `${(tanggal.NAMA_HARI[(idx + 1) % 7] ?? '').toUpperCase()}, ${p.d} ${(tanggal.NAMA_BULAN[p.m - 1] ?? '').toUpperCase()}`;
}

function susunSeksi(tasks: BarisTugas[], per: KelompokPer, hariIni: string): Seksi[] {
  if (per === 'tenggat') {
    const ikon: Record<string, IconName> = { terlambat: 'circle-alert', 'hari-ini': 'clock', 'minggu-ini': 'calendar', nanti: 'inbox', 'tanpa-tenggat': 'calendar-off', selesai: 'circle-check' };
    return URUTAN_KELOMPOK.flatMap((k) => {
      const items = tasks.filter((t) => t.group === k);
      if (items.length === 0) {
        return [];
      }
      return [
        {
          kunci: k,
          judul: LABEL_KELOMPOK[k],
          icon: ikon[k],
          tone: k === 'terlambat' ? 'danger' : k === 'hari-ini' ? 'warning' : 'text',
          catatan: k === 'hari-ini' ? hariSingkat(hariIni) : k === 'minggu-ini' ? `sampai ${hariSingkat(akhirPekan(hariIni))}` : undefined,
          items,
        } satisfies Seksi,
      ];
    });
  }
  if (per === 'workspace') {
    const peta = new Map<string, BarisTugas[]>();
    for (const t of tasks) {
      peta.set(t.workspace.key, [...(peta.get(t.workspace.key) ?? []), t]);
    }
    return [...peta.entries()].map(([key, items]) => {
      const w = (items[0] as BarisTugas).workspace;
      return {
        kunci: key,
        judul: w.type === 'personal' ? 'Pribadi' : w.name,
        tone: 'text' as const,
        leading: <UbinWorkspace nama={w.name} jenis={w.type} size={24} />,
        items,
      };
    });
  }
  if (per === 'prioritas') {
    return [1, 2, 3, 4, 0].flatMap((p) => {
      const items = tasks.filter((t) => t.priority.value === p);
      return items.length === 0
        ? []
        : [{ kunci: `p${p}`, judul: LABEL_PRIORITAS[p] ?? '', tone: 'text' as const, leading: p === 0 ? <Icon name="minus" size={20} /> : <PriorityBars nilai={p} size={20} />, items }];
    });
  }
  return (['backlog', 'todo', 'in_progress', 'review', 'done', 'canceled'] as const).flatMap((k) => {
    const items = tasks.filter((t) => t.status.category === k);
    return items.length === 0 ? [] : [{ kunci: k, judul: LABEL_KATEGORI[k], tone: 'text' as const, leading: <StatusRing kategori={k} size={22} />, items }];
  });
}

export default function LayarTugasSaya(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const ruangTab = useTabBarSpace();
  const d = useTugasSaya();
  const { user } = useSession();
  const ov = useOverlayTugas();
  useSetelahSinkron(d.segarkanSenyap);
  // Tablet (jendela ≥ 720 dp, mockup 12/17): daftar + detail berdampingan; tugas
  // terpilih disimpan di parameter `?tugas=` supaya bertahan saat diputar.
  const tata = useTataLetak();
  const duaPanel = tata.duaPanel;
  const { tugas: paramTugas } = useLocalSearchParams<{ tugas?: string }>();
  const dipilih = duaPanel && typeof paramTugas === 'string' && paramTugas !== '' ? paramTugas : null;

  const [cari, setCari] = useState(false);
  const [teksCari, setTeksCari] = useState('');
  const [sheetFilter, setSheetFilter] = useState(false);
  const [sheetKelompok, setSheetKelompok] = useState(false);
  const [sheetTampilan, setSheetTampilan] = useState(false);
  const [dialogNama, setDialogNama] = useState(false);
  const [baruSheet, setBaruSheet] = useState(false);
  const [tampilan, setTampilan] = useState<TampilanTersimpan[]>([]);
  const [memuatTampilan, setMemuatTampilan] = useState(false);
  const [tampilanAktif, setTampilanAktif] = useState<string | null>(null);
  const [galatNama, setGalatNama] = useState<string | null>(null);
  const [menyimpanNama, setMenyimpanNama] = useState(false);
  const [menu, setMenu] = useState<{ id: string; key: string; title: string; type: string; lajur: LajurRencana | null; selesai: boolean } | null>(null);
  const [tunda, setTunda] = useState<{ id: string; key: string; title: string; due: string | null } | null>(null);
  const [rencanakan, setRencanakan] = useState<{ id: string; key: string; title: string; lajur: LajurRencana | null } | null>(null);
  const [terkunci, setTerkunci] = useState<ReadonlySet<string>>(new Set());

  const hariIni = d.meta?.today ?? d.perencana?.today ?? tanggal.hariIniIso();

  // Form "Tugas baru" harus bisa dipakai offline: pemanasan cache workspace Pribadi (sekali per proses).
  useEffect(() => {
    const tugasHangat = InteractionManager.runAfterInteractions(() => {
      void hangatkanFormTugas();
    });
    return () => tugasHangat.cancel();
  }, []);

  // Perubahan yang masih menunggu sinkron (buat/ubah/status) diterapkan di atas data server.
  const idSaya = user?.id ?? null;
  const tanpaFilter = d.aktifFilter === 0 && d.filter.q.trim() === '';
  const tasksTampil = useMemo(
    () => terapkanDaftarBaris(d.tasks, ov, { hariIni, sertakanBuat: tanpaFilter && d.mode === 'daftar', idSaya, lingkup: d.lingkup, tampilSelesai: d.tampilSelesai }),
    [d.tasks, ov, hariIni, tanpaFilter, d.mode, idSaya, d.lingkup, d.tampilSelesai],
  );

  // Muat ulang senyap saat layar kembali fokus (kecuali kali pertama).
  const pertama = useRef(true);
  const segarkanSenyap = d.segarkanSenyap;
  useFocusEffect(
    useCallback(() => {
      if (pertama.current) {
        pertama.current = false;
        return;
      }
      segarkanSenyap();
    }, [segarkanSenyap]),
  );

  // Pencarian ditunda 350 ms.
  const setFilter = d.setFilter;
  const filterSaatIni = d.filter;
  useEffect(() => {
    const t = setTimeout(() => {
      if (teksCari.trim() !== filterSaatIni.q.trim()) {
        setFilter({ ...filterSaatIni, q: teksCari.trim() });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [teksCari, filterSaatIni, setFilter]);

  const orangFilter = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of d.tasks) {
      for (const o of t.assignee_people) {
        m.set(o.id, o.name);
      }
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [d.tasks]);
  const labelFilter = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of d.tasks) {
      for (const l of t.labels) {
        m.set(l.id, l.name);
      }
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [d.tasks]);

  const chipFilter = daftarChip(
    d.filter,
    (id) => orangFilter.find((o) => o.id === id)?.name ?? 'Orang',
    (id) => labelFilter.find((l) => l.id === id)?.name ?? 'Label',
  );

  const bukaDetail = useCallback(
    (id: string): void => {
      if (duaPanel) {
        router.setParams({ tugas: id });
      } else {
        router.push(`/tugas/${id}`);
      }
    },
    [duaPanel],
  );
  const segarkanSenyapDaftar = d.segarkanSenyap;
  const tutupPanel = useCallback((): void => {
    router.setParams({ tugas: '' });
    segarkanSenyapDaftar();
  }, [segarkanSenyapDaftar]);

  function pesanOffline(): void {
    snackbar.show({ message: 'Tidak ada koneksi. Perubahan belum terkirim.', variant: 'offline' });
  }

  async function selesaikan(b: { id: string; key: string; title: string; workspaceType: string; status?: { is_done: boolean } }): Promise<void> {
    if (b.status?.is_done) {
      return;
    }
    if (b.workspaceType !== 'personal') {
      const ok = await dialog.confirm({
        title: 'Tandai selesai?',
        message: `${b.title} berada di workspace tim. Tugas dikirim ke kolom Review dulu, bukan langsung Selesai.`,
        confirmLabel: 'Kirim ke Review',
      });
      if (!ok) {
        return;
      }
    }
    try {
      const baris = d.tasks.find((t) => t.id === b.id);
      const hasil = await tulisPindahStatus({ id: b.id, key: b.key }, { done: true }, { jenisWorkspace: b.workspaceType as 'personal' | 'team' | 'division' | 'project', statusSekarangId: baris?.status.id ?? null });
      if (hasil.antre) {
        snackbar.show({ message: PESAN_DISIMPAN_HP, variant: 'info' });
        return;
      }
      const st = hasil.nilai.status;
      d.ubahLokal(b.id, (x) => (st.is_done && !d.tampilSelesai ? null : { ...x, status: { ...x.status, ...st, id: st.id ?? x.status.id } }));
      snackbar.show({
        message: st.is_done ? `${b.key} ditandai selesai` : `${b.key} dikirim ke ${st.name}`,
        variant: 'ok',
        actionLabel: 'Urungkan',
        onAction: () => {
          void pindahStatus(b.id, { done: false })
            .then(() => d.segarkan())
            .catch((e: unknown) => snackbar.show({ message: pesanGalat(e, 'Gagal mengurungkan.'), variant: 'bad' }));
        },
      });
      d.segarkanSenyap();
    } catch (err) {
      if (tanpaKoneksi(err)) {
        pesanOffline();
      } else {
        snackbar.show({ message: pesanGalat(err, 'Gagal menyelesaikan tugas.'), variant: 'bad' });
      }
    }
  }

  async function tundaKe(iso: string | null): Promise<void> {
    if (!tunda) {
      return;
    }
    const t = tunda;
    try {
      const hasil = await tulisUbahTugas({ id: t.id, key: t.key }, { due_date: iso }, { sumber: { due_date: t.due } });
      if (hasil.antre) {
        snackbar.show({ message: PESAN_DISIMPAN_HP, variant: 'info' });
        return;
      }
      d.ubahLokal(t.id, (x) => ({ ...x, due_date: iso }));
      snackbar.show({
        message: iso ? `Tenggat ${t.key} ditunda ke ${hariSingkat(iso)}` : `Tenggat ${t.key} dihapus`,
        variant: 'ok',
        actionLabel: 'Urungkan',
        onAction: () => {
          void ubahTugas(t.id, { due_date: t.due })
            .then(() => d.segarkan())
            .catch((e: unknown) => snackbar.show({ message: pesanGalat(e, 'Gagal mengurungkan.'), variant: 'bad' }));
        },
      });
      d.segarkanSenyap();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setTerkunci((lama) => new Set(lama).add(t.id));
        snackbar.show({ message: `${PESAN_TITIPAN} Gunakan Rencanakan untuk mengatur hari Anda.`, variant: 'warn', duration: 6000 });
      } else if (tanpaKoneksi(err)) {
        pesanOffline();
      } else {
        snackbar.show({ message: pesanGalat(err, 'Gagal menunda tenggat.'), variant: 'bad' });
      }
    }
  }

  async function pindahRencana(l: LajurRencana | null): Promise<void> {
    if (!rencanakan) {
      return;
    }
    const r = rencanakan;
    if (!adalahOnline() || eIdSementara(r.id)) {
      snackbar.show({ message: 'Butuh koneksi — rencana hari belum bisa diatur saat offline.', variant: 'offline' });
      return;
    }
    try {
      const p = await setRencana(r.id, l);
      d.setPerencana(p);
      snackbar.show({ message: l ? `${r.key} direncanakan di ${LABEL_LAJUR[l]}` : `${r.key} kembali otomatis`, variant: 'ok' });
      d.segarkanSenyap();
    } catch (err) {
      if (tanpaKoneksi(err)) {
        pesanOffline();
      } else {
        snackbar.show({ message: pesanGalat(err, 'Gagal menyimpan rencana.'), variant: 'bad' });
      }
    }
  }

  async function bukaTampilan(): Promise<void> {
    setSheetTampilan(true);
    setMemuatTampilan(true);
    try {
      setTampilan(await daftarTampilan());
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Tidak dapat memuat tampilan tersimpan.'), variant: 'bad' });
    } finally {
      setMemuatTampilan(false);
    }
  }

  async function simpanNama(nama: string): Promise<void> {
    setMenyimpanNama(true);
    setGalatNama(null);
    try {
      const baru = await simpanTampilan({ name: nama, filters: keTampilan(d.filter) });
      setTampilan((lama) => [...lama, baru]);
      setTampilanAktif(baru.id);
      setDialogNama(false);
      snackbar.show({ message: `Tampilan "${baru.name}" disimpan`, variant: 'ok' });
    } catch (err) {
      setGalatNama(pesanGalat(err, 'Gagal menyimpan tampilan.'));
    } finally {
      setMenyimpanNama(false);
    }
  }

  async function hapusSatuTampilan(t: TampilanTersimpan): Promise<void> {
    const ok = await dialog.confirm({ title: 'Hapus tampilan?', message: `Tampilan "${t.name}" akan dihapus.`, confirmLabel: 'Hapus', destructive: true });
    if (!ok) {
      return;
    }
    try {
      await hapusTampilan(t.id);
      setTampilan((lama) => lama.filter((x) => x.id !== t.id));
      if (tampilanAktif === t.id) {
        setTampilanAktif(null);
      }
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Gagal menghapus tampilan.'), variant: 'bad' });
    }
  }

  function bukaMenu(b: BarisTugas): void {
    setMenu({ id: b.id, key: b.key, title: b.title, type: b.workspace.type, lajur: b.plan.bucket, selesai: b.status.is_done });
  }

  function kartu(b: BarisTugas & { sinkron?: 'menunggu' | 'gagal' }): React.JSX.Element {
    const selesai = b.status.is_done || b.status.category === 'canceled';
    const aksi: AksiGeser[] = [];
    if (!selesai && !terkunci.has(b.id)) {
      aksi.push({ label: 'Tunda', icon: 'clock', tone: 'soft', onPress: () => setTunda({ id: b.id, key: b.key, title: b.title, due: b.due_date }) });
    }
    if (!selesai) {
      aksi.push({ label: 'Selesai', icon: 'check', tone: 'primary', onPress: () => void selesaikan({ id: b.id, key: b.key, title: b.title, workspaceType: b.workspace.type, status: b.status }) });
    }
    return (
      <SwipeRow key={b.id} aksi={aksi}>
        <TugasKartu baris={b} sinkron={'sinkron' in b ? b.sinkron : undefined} hariIni={hariIni} terpilih={dipilih === b.id} onPress={() => bukaDetail(b.id)} onLongPress={() => bukaMenu(b)} tampilkanWorkspace={d.kelompok !== 'workspace'} />
      </SwipeRow>
    );
  }

  const seksi = d.mode === 'daftar' ? susunSeksi(tasksTampil, d.kelompok, hariIni) : [];
  const adaFilter = d.aktifFilter > 0;
  const labelKelompok = d.kelompok === 'tenggat' ? 'Tenggat' : d.kelompok === 'workspace' ? 'Workspace' : d.kelompok === 'prioritas' ? 'Prioritas' : 'Status';

  return (
    <View style={[{ flex: 1 }, duaPanel && s.duaPanel]}>
      <View style={duaPanel ? [s.kolomDaftar, { width: lebarDaftar(tata, 'tugas'), borderRightColor: colors.border }] : { flex: 1 }}>
        <Screen refreshing={d.menyegarkan} onRefresh={d.segarkan} contentStyle={{ paddingBottom: ruangTab + 96 }}>
          <AppBar
            overline={judulTanggal(hariIni)}
            title="Tugas saya"
            actions={[
              { icon: 'search', label: 'Cari tugas', onPress: () => setCari((v) => !v) },
              { icon: 'sliders-horizontal', label: 'Filter tugas', onPress: () => setSheetFilter(true), badge: adaFilter ? true : undefined },
            ]}
          />

          {d.mode === 'rencana' ? (
            <>
              <SegmentedTabs
                value="rencana"
                options={[
                  { value: 'daftar', label: 'Tenggat' },
                  { value: 'rencana', label: 'Rencana saya' },
                ]}
                onChange={(v) => d.setMode(v === 'rencana' ? 'rencana' : 'daftar')}
              />
              <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
                Susun hari Anda — hanya Anda yang melihat rencana ini
              </Text>
            </>
          ) : (
            <>
              <View style={s.bleed}>
                <ChipScroller>
                  {(['ditugaskan', 'saya-amati', 'saya-buat'] as const).map((l) => (
                    <Chip key={l} label={LABEL_LINGKUP[l]} count={d.meta?.counts[l]} selected={d.lingkup === l} onPress={() => d.setLingkup(l)} />
                  ))}
                </ChipScroller>
              </View>

              {cari ? <SearchInput value={teksCari} onChangeText={setTeksCari} placeholder="Judul atau KEY-123" autoFocus /> : null}

              <View style={s.ringkas}>
                <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 15 }} numberOfLines={2}>
                  {d.meta ? (
                    d.lingkup === 'saya-buat' ? (
                      `${d.meta.counts['saya-buat']} tugas yang saya buat`
                    ) : (
                      <>
                        {d.meta.summary.aktif} aktif
                        {d.meta.summary.terlambat > 0 ? (
                          <>
                            {' · '}
                            <Text variant="body" weight={700} tone="danger" style={{ fontSize: 15 }}>
                              {d.meta.summary.terlambat} terlambat
                            </Text>
                          </>
                        ) : null}
                        {' · '}
                        {d.meta.summary.hari_ini} hari ini
                      </>
                    )
                  ) : (
                    ' '
                  )}
                </Text>
                <Pressable
                  onPress={() => setSheetKelompok(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Kelompokkan menurut ${labelKelompok}`}
                  style={[s.grup, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
                >
                  <Icon name="layers" size={20} />
                  <Text variant="label" weight={600}>
                    {labelKelompok}
                  </Text>
                  <Icon name="chevron-down" size={18} color={colors.muted} />
                </Pressable>
              </View>

              {d.chipWorkspace.length > 1 ? (
                <View style={s.bleed}>
                  <ChipScroller>
                    <Chip label="Semua" count={d.meta ? d.chipWorkspace.reduce((a, c) => a + c.jumlah, 0) : undefined} selected={d.filter.workspace.length === 0} onPress={() => d.setFilter({ ...d.filter, workspace: [] })} />
                    {d.chipWorkspace.map((c) => (
                      <Chip key={c.key} label={c.key} count={c.jumlah} selected={d.filter.workspace.includes(c.key)} onPress={() => d.setFilter({ ...d.filter, workspace: d.filter.workspace.includes(c.key) ? [] : [c.key] })} />
                    ))}
                  </ChipScroller>
                </View>
              ) : null}

              {chipFilter.length > 0 ? (
                <View style={s.bleed}>
                  <ChipScroller>
                    {chipFilter.map((c) => (
                      <Chip
                        key={c.kunci}
                        label={c.label}
                        selected
                        onDismiss={() => {
                          d.setFilter(c.hapus(d.filter));
                          if (c.kunci === 'q') {
                            setTeksCari('');
                          }
                          setTampilanAktif(null);
                        }}
                      />
                    ))}
                    <Button title="Simpan tampilan" variant="quiet" size="sm" icon="bookmark-plus" onPress={() => setDialogNama(true)} />
                  </ChipScroller>
                </View>
              ) : null}

              {d.basi ? <Banner tone="warn" icon="cloud-off" message={`Offline · data terakhir ${stempelWaktu(d.basi)}`} /> : null}
            </>
          )}

          {d.memuat ? (
            <Loading rows={5} />
          ) : d.galat && (d.mode === 'rencana' ? d.perencana === null : tasksTampil.length === 0) ? (
            <ErrorState message={d.galat.pesan} kind={errorKindFromStatus(d.galat.status)} onRetry={d.segarkan} />
          ) : d.mode === 'rencana' && d.perencana ? (
            <RencanaView
              planner={d.perencana}
              onBuka={bukaDetail}
              onRencanakan={(id, title, key, lajur) => setRencanakan({ id, key, title, lajur })}
              onTerima={(t: TugasBaruMasuk) => setRencanakan({ id: t.id, key: t.key, title: t.title, lajur: null })}
              onSelesai={(i: ItemRencana) => void selesaikan({ id: i.id, key: i.key, title: i.title, workspaceType: i.workspace.type, status: { is_done: i.done } })}
              onMenu={(i) => setMenu({ id: i.id, key: i.key, title: i.title, type: i.workspace.type, lajur: i.auto ? null : i.lane, selesai: i.done })}
            />
          ) : tasksTampil.length === 0 ? (
            adaFilter ? (
              <EmptyState
                icon="search-x"
                title="Tidak ada tugas yang cocok"
                description="Ubah filter atau pilih workspace lain."
                actionLabel="Hapus semua filter"
                onAction={() => {
                  d.setFilter(FILTER_KOSONG);
                  setTeksCari('');
                  setTampilanAktif(null);
                }}
              />
            ) : (
              <EmptyState
                icon="circle-check"
                title={d.lingkup === 'ditugaskan' ? 'Tidak ada tugas untuk Anda' : d.lingkup === 'saya-amati' ? 'Belum ada tugas yang Anda amati' : 'Belum ada tugas yang Anda buat'}
                description="Ketuk + untuk membuat tugas baru."
                actionLabel="Buat tugas"
                onAction={() => setBaruSheet(true)}
              />
            )
          ) : (
            <View style={{ gap: 16 }}>
              {d.galat ? <Banner tone="bad" message={d.galat.pesan} actionLabel="Coba lagi" onAction={d.segarkan} /> : null}
              {seksi.map((sek) => {
                const warna = sek.tone === 'danger' ? colors.danger : sek.tone === 'warning' ? colors.warning : colors.text;
                return (
                  <View key={sek.kunci} style={{ gap: 8 }}>
                    <View style={s.kepala} accessibilityRole="header">
                      {sek.leading ?? (sek.icon ? <Icon name={sek.icon} size={20} color={warna} /> : null)}
                      <Text variant="title" weight={700} style={{ color: warna }}>
                        {sek.judul}
                      </Text>
                      <Text variant="title" weight={700} style={{ color: sek.tone === 'text' ? colors.muted : warna }}>
                        {sek.items.length}
                      </Text>
                      {sek.catatan ? <Text variant="meta">· {sek.catatan}</Text> : null}
                    </View>
                    {sek.items.map((b) => kartu(b))}
                  </View>
                );
              })}
              {d.masihAda ? (
                <Button title={d.memuatLagi ? 'Memuat…' : 'Muat lagi'} variant="secondary" icon="chevron-down" loading={d.memuatLagi} disabled={d.memuatLagi} onPress={d.muatLagi} />
              ) : (
                <Text variant="meta" align="center">
                  Sudah menampilkan semua tugas
                </Text>
              )}
            </View>
          )}
        </Screen>

        <Fab label="Tugas baru" onPress={() => setBaruSheet(true)} style={{ position: 'absolute', right: 16, bottom: ruangTab + 16 }} />
      </View>

      {duaPanel ? (
        <View style={{ flex: 1 }}>
          {dipilih ? (
            <PanelProvider tutup={tutupPanel}>
              <DetailTugas key={dipilih} id={dipilih} />
            </PanelProvider>
          ) : (
            <View style={[s.panelKosong, { backgroundColor: colors.bg }]}>
              <EmptyState icon="square-check-big" title="Pilih tugas" description="Detail tugas tampil di sini." />
            </View>
          )}
        </View>
      ) : null}

      <SheetFilter
        visible={sheetFilter}
        onClose={() => setSheetFilter(false)}
        filter={d.filter}
        onTerapkan={(f) => {
          d.setFilter(f);
          setTeksCari(f.q);
          setTampilanAktif(null);
        }}
        orang={orangFilter}
        label={labelFilter}
        workspace={d.chipWorkspace.map((c) => c.key)}
      />
      <SheetKelompok
        visible={sheetKelompok}
        onClose={() => setSheetKelompok(false)}
        nilai={d.kelompok}
        onPilih={(k) => {
          d.setMode('daftar');
          d.setKelompok(k);
        }}
        tampilSelesai={d.tampilSelesai}
        onTampilSelesai={d.setTampilSelesai}
        onRencana={() => d.setMode('rencana')}
        onTampilan={() => void bukaTampilan()}
      />
      <SheetTampilan
        visible={sheetTampilan}
        onClose={() => setSheetTampilan(false)}
        tampilan={tampilan}
        aktifId={tampilanAktif}
        bisaSimpan={jumlahFilter(d.filter) > 0}
        memuat={memuatTampilan}
        onPakai={(t) => {
          d.setMode('daftar');
          const f = dariTampilan(t.filters);
          d.setFilter(f);
          setTeksCari(f.q);
          setTampilanAktif(t.id);
        }}
        onSimpan={() => setDialogNama(true)}
        onHapus={(t) => void hapusSatuTampilan(t)}
      />
      <DialogNamaTampilan visible={dialogNama} onBatal={() => setDialogNama(false)} onSimpan={(n) => void simpanNama(n)} memproses={menyimpanNama} galat={galatNama} />

      <SheetTenggat
        visible={tunda !== null}
        onClose={() => setTunda(null)}
        judul="Tunda tenggat"
        subjudul={tunda ? `${tunda.title} · ${tunda.key}` : undefined}
        nilai={tunda?.due ?? null}
        hariIni={hariIni}
        onPilih={(iso) => void tundaKe(iso)}
      />
      <SheetRencanakan
        visible={rencanakan !== null}
        onClose={() => setRencanakan(null)}
        subjudul={rencanakan ? `${rencanakan.title} · ${rencanakan.key}` : ''}
        lajur={rencanakan?.lajur ?? null}
        hariIni={hariIni}
        onPilih={(l) => void pindahRencana(l)}
      />

      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.key ?? ''} showClose>
        {menu ? (
          <>
            <Text variant="meta" numberOfLines={2}>
              {menu.title}
            </Text>
            <SheetAction
              icon="external-link"
              label="Buka"
              onPress={() => {
                const id = menu.id;
                setMenu(null);
                bukaDetail(id);
              }}
            />
            <SheetAction
              icon="calendar-clock"
              label="Rencanakan"
              onPress={() => {
                const m = menu;
                setMenu(null);
                setTimeout(() => setRencanakan({ id: m.id, key: m.key, title: m.title, lajur: m.lajur }), 250);
              }}
            />
            {!menu.selesai && !terkunci.has(menu.id) ? (
              <SheetAction
                icon="clock"
                label="Tunda tenggat"
                onPress={() => {
                  const m = menu;
                  const b = d.tasks.find((t) => t.id === m.id);
                  setMenu(null);
                  setTimeout(() => setTunda({ id: m.id, key: m.key, title: m.title, due: b?.due_date ?? null }), 250);
                }}
              />
            ) : null}
            {!menu.selesai ? (
              <SheetAction
                icon="circle-check"
                label="Tandai selesai"
                onPress={() => {
                  const m = menu;
                  setMenu(null);
                  setTimeout(() => void selesaikan({ id: m.id, key: m.key, title: m.title, workspaceType: m.type }), 250);
                }}
              />
            ) : null}
            <SheetAction
              icon="share-2"
              label="Bagikan"
              onPress={() => {
                const m = menu;
                setMenu(null);
                void Share.share({ message: `${m.key} · ${m.title}` });
              }}
            />
          </>
        ) : null}
      </BottomSheet>

      <TugasBaruSheet
        visible={baruSheet}
        onClose={() => setBaruSheet(false)}
        onDibuat={(t) => {
          setBaruSheet(false);
          d.segarkanSenyap();
          snackbar.show({ message: t.antre ? PESAN_DISIMPAN_HP : `${t.key} dibuat`, variant: t.antre ? 'info' : 'ok', actionLabel: 'Buka', onAction: () => bukaDetail(t.id) });
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  duaPanel: { flexDirection: 'row' },
  kolomDaftar: { borderRightWidth: StyleSheet.hairlineWidth },
  panelKosong: { flex: 1, justifyContent: 'center', padding: 32 },
  bleed: { marginHorizontal: -16 },
  ringkas: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grup: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
});
