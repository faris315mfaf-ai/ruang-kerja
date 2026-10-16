/**
 * Editor catatan (modul 07) — teks polos tanpa kolaborasi realtime: isi
 * diedit sebagai teks multi-baris (`body_text`), autosave debounce 1,5 dtk
 * (konversi baris → `<p>` + `updated_at` dasar) lewat mesin simpan per
 * catatan (`sesiSimpan.ts`; konflik 409, antrean, simpan latar). Catatan
 * berformat lengkap (`mobile_editable:false`) dibuka baca-saja; judul tetap
 * bisa diganti. App bar minimalis: kembali + judul + status simpan, tab
 * dokumen, mode catat.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { kirimTautanDesktop } from '@/api/akun';
import { ApiError, webBase } from '@/api/client';
import { detailCatatan, hapusCatatan, pohonWorkspace, tabDokumen, type CatatanDetail, type PohonNode, type TabDokumen } from '@/api/catatan';
import { AksesSheet } from '@/features/catatan/AksesSheet';
import { BacaBlok } from '@/features/catatan/BacaBlok';
import { IkonStatusSimpan, TombolBar } from '@/features/catatan/Ikon';
import { PindahSheet } from '@/features/catatan/PindahSheet';
import { RiwayatSheet } from '@/features/catatan/RiwayatSheet';
import { SelesaiSheet } from '@/features/catatan/SelesaiSheet';
import { StatusSheet } from '@/features/catatan/StatusSheet';
import { TabSheet, type AksiCatatan } from '@/features/catatan/TabSheet';
import { TeksSheet } from '@/features/catatan/TeksSheet';
import { akhiriSesi, mulaiSesi, perbaruiSesi, setDiDokumen, sesiStore } from '@/features/catatan/sesiCatat';
import { pasangSesi, sesiUntuk, type SesiSimpan, type SesiState } from '@/features/catatan/sesiSimpan';
import { infoDiubah, cariNode } from '@/features/catatan/pohon';
import { useUkuranHuruf } from '@/features/catatan/ukuranHuruf';
import { jam } from '@/lib/format';
import { useOnline } from '@/offline';
import { ChipMenunggu } from '@/offline/ChipMenunggu';
import { detailLokalCatatan } from '@/offline/fitur/catatan';
import { eIdSementara, useIdNyata } from '@/offline/fitur/tugasBersama';
import { font, useTheme } from '@/theme';
import { Banner, Button, Card, EmptyState, ErrorState, Glass, Icon, ListRow, Loading, Screen, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

const KOSONG: SesiState = { status: 'idle', tersimpanPada: null, galat: null, judulGalat: null, kotor: false, kaya: false, catatan: null, diHp: false };
const TIDAK_ADA = (): (() => void) => () => undefined;

type LembarTerbuka = 'status' | 'tab' | 'akses' | 'riwayat' | 'huruf' | 'pindah' | 'selesai' | null;

/** Galat muat: 404/403 = catatan hilang/akses dicabut. */
interface GalatMuat {
  status: number;
  pesan: string;
}

export default function LayarCatatan(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { skala } = useUkuranHuruf();
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const catatId = typeof id === 'string' ? id : null;
  const online = useOnline();
  // Catatan baru dari HP (belum ada di server): id sementara → pindah ke id asli begitu terkirim.
  const sementara = eIdSementara(catatId);
  const idNyata = useIdNyata(sementara && catatId !== null ? catatId : undefined);
  useEffect(() => {
    if (idNyata) {
      router.replace(`/catatan/${idNyata}` as never);
    }
  }, [idNyata]);

  const [sesi, setSesi] = useState<SesiSimpan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<GalatMuat | null>(null);
  const [judul, setJudul] = useState('');
  const [teks, setTeks] = useState('');
  const [lembar, setLembar] = useState<LembarTerbuka>(null);
  const [tab, setTab] = useState<TabDokumen | null>(null);
  const [memuatTab, setMemuatTab] = useState(false);
  const [galatTab, setGalatTab] = useState<string | null>(null);
  const [anak, setAnak] = useState<PohonNode[] | null>(null);

  const judulRef = useRef<TextInput>(null);
  const judulSaatIni = useRef('');
  const keluarRef = useRef(false);
  const mulaiCatatRef = useRef(false);
  const statusSebelum = useRef('idle');

  // ── Sesi simpan per catatan ────────────────────────────────────────────────
  useEffect(() => {
    if (catatId === null) {
      return undefined;
    }
    const s = sesiUntuk(catatId);
    pasangSesi(s);
    /* eslint-disable react-hooks/set-state-in-effect -- pasang sesi simpan untuk catatan ini */
    setSesi(s);
    if (s.sudahDimuat) {
      // Kembali dari pil / dari editor yang sama: tampilkan suntingan lokal dulu.
      setJudul(s.judulSaatIni);
      setTeks(s.teks);
      judulSaatIni.current = s.judulSaatIni;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      s.lepas();
    };
  }, [catatId]);

  const st = useSyncExternalStore(sesi ? sesi.state.subscribe : TIDAK_ADA, sesi ? sesi.state.get : () => KOSONG, () => KOSONG);
  const catatan: CatatanDetail | null = st.catatan;
  const boleh = catatan?.can_edit === true;
  const kaya = st.kaya;
  const folder = catatan?.kind === 'folder';
  const bolehIsi = boleh && !kaya && !folder;
  const sesiCatat = sesiStore.use();
  const modeAktif = sesiCatat.diDokumen && sesiCatat.sesi !== null;

  const terapkan = useCallback(
    (detail: CatatanDetail, buangAntrean = false): void => {
      if (sesi === null) {
        return;
      }
      sesi.terapkanServer(detail, { buangAntrean });
      // Teks/judul yang menunggu di antrean offline menang atas salinan server.
      setJudul(sesi.judulSaatIni);
      judulSaatIni.current = sesi.judulSaatIni;
      setTeks(sesi.teks);
    },
    [sesi],
  );

  const muat = useCallback(async (buangAntrean = false): Promise<void> => {
    if (catatId === null || sesi === null) {
      return;
    }
    setMemuat(true);
    setGalatMuat(null);
    try {
      let detail: CatatanDetail;
      if (eIdSementara(catatId)) {
        const lokal = detailLokalCatatan(catatId);
        if (lokal === null) {
          throw new ApiError({ status: 404, message: 'Catatan baru ini sudah dikirim atau dibuang dari antrean.' });
        }
        detail = lokal;
      } else {
        detail = await detailCatatan(catatId);
      }
      terapkan(detail, buangAntrean);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      setGalatMuat({ status, pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat catatan.' });
      if ((status === 404 || status === 403) && sesiStore.get().sesi !== null) {
        akhiriSesi();
        snackbar.show({ message: 'Notulensi dihapus atau akses Anda dicabut — mode catat berakhir.', variant: 'warn' });
      }
    } finally {
      setMemuat(false);
    }
  }, [catatId, sesi, terapkan, snackbar]);

  useEffect(() => {
    if (sesi === null) {
      return;
    }
    if (sesi.sudahDimuat && sesi.state.get().kotor) {
      // Ada suntingan lokal yang belum terkirim (kembali dari pil): jangan ditimpa.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sesi lokal sudah memuat
      setMemuat(false);
      return;
    }
    void muat();
  }, [sesi, muat]);

  // ── Tab dokumen ────────────────────────────────────────────────────────────
  const muatTabDokumen = useCallback(async (): Promise<void> => {
    if (catatId === null) {
      return;
    }
    if (eIdSementara(catatId)) {
      setGalatTab('Tab dokumen tersedia setelah catatan ini terkirim.');
      return;
    }
    setMemuatTab(true);
    setGalatTab(null);
    try {
      setTab(await tabDokumen(catatId));
    } catch (err) {
      setGalatTab(err instanceof ApiError ? err.message : 'Tab dokumen gagal dimuat.');
    } finally {
      setMemuatTab(false);
    }
  }, [catatId]);

  useEffect(() => {
    if (catatan !== null && catatan.kind === 'note' && tab === null && !memuatTab && galatTab === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- muat tab setelah catatan siap
      void muatTabDokumen();
    }
  }, [catatan, tab, memuatTab, galatTab, muatTabDokumen]);

  // Isi folder (bila catatan ini sebuah folder).
  useEffect(() => {
    if (catatan === null || catatan.kind !== 'folder') {
      return;
    }
    pohonWorkspace(catatan.workspace_id)
      .then((r) => setAnak(cariNode(r.tree, catatan.id)?.children ?? []))
      .catch(() => setAnak([]));
  }, [catatan]);

  // Layar ini bagian dari dokumen mode catat → pil disembunyikan; lacak catatan terakhir.
  const rootId = tab?.root_id ?? null;
  const sesiRoot = sesiCatat.sesi?.rootId ?? null;
  useEffect(() => {
    if (catatId === null || rootId === null || sesiRoot === null || rootId !== sesiRoot) {
      return undefined;
    }
    setDiDokumen(true);
    perbaruiSesi({ noteId: catatId });
    return () => setDiDokumen(false);
  }, [catatId, rootId, sesiRoot]);

  // `?mode=catat` (Mulai notulensi): mulai mode catat sekali setelah tab diketahui.
  useEffect(() => {
    if (mode !== 'catat' || mulaiCatatRef.current || catatan === null || catatId === null) {
      return;
    }
    if (!boleh || kaya || folder || (tab === null && galatTab === null)) {
      return;
    }
    mulaiCatatRef.current = true;
    if (sesiStore.get().sesi === null) {
      const akar = tab?.tabs.find((t) => t.id === tab.root_id);
      mulaiSesi({ noteId: catatId, rootId: tab?.root_id ?? catatId, title: akar?.title ?? catatan.title });
      snackbar.show({ message: 'Mode catat aktif. Pindah modul kapan saja; kembali lewat pil “Kembali ke notulensi”.', variant: 'info' });
    }
  }, [mode, catatan, catatId, boleh, kaya, folder, tab, galatTab, snackbar]);

  // ── Konflik 409 ────────────────────────────────────────────────────────────
  const muatUlang = useCallback(async (): Promise<void> => {
    // "Muat ulang" eksplisit (konflik): suntingan HP yang menunggu di antrean diganti versi server.
    await muat(true);
  }, [muat]);

  useEffect(() => {
    if (st.status === 'konflik' && statusSebelum.current !== 'konflik') {
      void dialog
        .confirm({
          title: 'Catatan berubah',
          message: 'Versi di server lebih baru daripada versi di aplikasi. Muat ulang untuk melihat perubahan terbaru — suntingan Anda yang belum tersimpan akan diganti.',
          confirmLabel: 'Muat ulang',
          cancelLabel: 'Nanti',
        })
        .then((ya) => {
          if (ya) {
            void muatUlang();
          }
        });
    }
    statusSebelum.current = st.status;
  }, [st.status, dialog, muatUlang]);

  // ── Kembali / navigasi ─────────────────────────────────────────────────────
  const kembali = useCallback((): void => {
    if (keluarRef.current) {
      return;
    }
    if (sesi === null || !boleh) {
      router.back();
      return;
    }
    keluarRef.current = true;
    void (async () => {
      // Flush: judul lalu isi — keduanya tersimpan sebelum layar ditutup.
      sesi.antreJudul(judulSaatIni.current);
      const aman = await sesi.siram();
      if (aman) {
        router.back();
        return;
      }
      const buang = await dialog.confirm({
        title: 'Perubahan belum tersimpan',
        message:
          st.status === 'konflik'
            ? 'Catatan ini diubah orang lain. Bila keluar sekarang, suntingan Anda yang belum tersimpan akan hilang.'
            : 'Sebagian perubahan gagal disimpan. Bila keluar sekarang, perubahan itu akan hilang.',
        confirmLabel: 'Buang & keluar',
        cancelLabel: 'Tetap di sini',
        destructive: true,
      });
      if (buang) {
        sesi.buang();
        router.back();
        return;
      }
      keluarRef.current = false;
    })();
  }, [sesi, boleh, dialog, st.status]);

  useEffect(() => {
    const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
      kembali();
      return true;
    });
    return () => langganan.remove();
  }, [kembali]);

  /** Pindah ke catatan lain di dokumen yang sama: simpanan jalan di latar (pil bila gagal). */
  const pergi = useCallback(
    (tujuan: string): void => {
      if (sesi !== null && boleh) {
        sesi.antreJudul(judulSaatIni.current);
        void sesi.siram();
      }
      router.replace(`/catatan/${tujuan}`);
    },
    [sesi, boleh],
  );

  // ── Aksi ───────────────────────────────────────────────────────────────────
  async function bagikanTeks(): Promise<void> {
    if (catatan === null) {
      return;
    }
    const isi = (sesi?.teks ?? catatan.body_text ?? '').trim();
    try {
      await Share.share({ message: isi === '' ? catatan.title : `${catatan.title}\n\n${isi}` });
    } catch {
      snackbar.show({ message: 'Catatan gagal dibagikan.', variant: 'bad' });
    }
  }

  /** "Kirim tautan ke email saya"; bila server menolak path itu, bagikan tautan lewat share sheet. */
  async function kirimTautanWeb(): Promise<void> {
    if (catatan === null) {
      return;
    }
    try {
      const hasil = await kirimTautanDesktop(`/catatan/${catatan.id}`);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        snackbar.show({ message: 'Tidak ada koneksi. Tautan belum terkirim.', variant: 'offline' });
        return;
      }
      try {
        await Share.share({ message: `${webBase()}/catatan/${catatan.id}` });
      } catch {
        snackbar.show({ message: 'Tautan gagal dikirim.', variant: 'bad' });
      }
    }
  }

  /** Aksi yang hanya bisa lewat server (riwayat, bagikan, pindah, hapus): "Butuh koneksi" alih-alih permintaan yang gagal. */
  function perluOnline(aksi: string): boolean {
    if (sementara) {
      snackbar.show({ message: `${aksi} tersedia setelah catatan ini terkirim ke server.`, variant: 'info' });
      return false;
    }
    if (!online) {
      snackbar.show({ message: `Butuh koneksi — ${aksi} tidak bisa dilakukan saat offline.`, variant: 'offline' });
      return false;
    }
    return true;
  }

  async function hapusCatatanIni(): Promise<void> {
    if (catatan === null) {
      return;
    }
    const ya = await dialog.confirm({
      title: 'Hapus catatan?',
      message: `“${catatan.title}” dan riwayat versinya tidak akan tampil lagi. Anda kembali ke daftar catatan.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ya) {
      return;
    }
    try {
      const hasil = await hapusCatatan(catatan.id);
      sesi?.buang();
      if (sesiStore.get().sesi?.rootId === catatan.id) {
        akhiriSesi();
      }
      snackbar.show({ message: `${catatan.title} dihapus.`, variant: 'ok' });
      if (hasil.parent_id !== null && tab !== null && hasil.parent_id === tab.root_id) {
        router.replace(`/catatan/${hasil.parent_id}`);
      } else {
        router.back();
      }
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Catatan gagal dihapus.', variant: 'bad' });
    }
  }

  function aksiLembar(aksi: AksiCatatan): void {
    switch (aksi) {
      case 'ganti':
        setLembar(null);
        setTimeout(() => judulRef.current?.focus(), 350);
        break;
      case 'riwayat':
        if (perluOnline('Riwayat versi')) {
          setLembar('riwayat');
        }
        break;
      case 'bagikan':
        if (perluOnline('Pengaturan akses')) {
          setLembar('akses');
        }
        break;
      case 'huruf':
        setLembar('huruf');
        break;
      case 'pindah':
        if (perluOnline('Memindahkan catatan')) {
          setLembar('pindah');
        }
        break;
      case 'teks':
        setLembar(null);
        void bagikanTeks();
        break;
      case 'hapus':
        setLembar(null);
        if (perluOnline('Menghapus catatan')) {
          void hapusCatatanIni();
        }
        break;
    }
  }

  function ketukModeCatat(): void {
    if (catatan === null || catatId === null) {
      return;
    }
    if (modeAktif) {
      setLembar('selesai');
      return;
    }
    if (sesiStore.get().sesi !== null) {
      snackbar.show({ message: 'Notulensi lain sedang berjalan. Selesaikan dulu lewat pil “Kembali ke notulensi”.', variant: 'info' });
      return;
    }
    if (kaya) {
      snackbar.show({ message: 'Catatan ini berformat lengkap. Mode catat butuh catatan yang bisa disunting di ponsel.', variant: 'info' });
      return;
    }
    const akar = tab?.tabs.find((t) => t.id === tab.root_id);
    mulaiSesi({ noteId: catatId, rootId: tab?.root_id ?? catatId, title: akar?.title ?? catatan.title });
    snackbar.show({ message: 'Mode catat aktif. Pindah modul kapan saja; kembali lewat pil “Kembali ke notulensi”.', variant: 'info' });
  }

  async function tarikMuatUlang(): Promise<void> {
    if (sesi !== null && sesi.state.get().kotor) {
      const ya = await dialog.confirm({
        title: 'Muat ulang catatan?',
        message: 'Suntingan Anda yang belum tersimpan akan diganti dengan versi di server.',
        confirmLabel: 'Muat ulang',
        cancelLabel: 'Batal',
      });
      if (!ya) {
        return;
      }
    }
    await muat(sesi !== null && sesi.state.get().kotor);
    setTab(null);
    setGalatTab(null);
  }

  // ── Tampilan ───────────────────────────────────────────────────────────────
  const labelStatus = st.status === 'menyimpan' ? 'Status: menyimpan' : st.status === 'konflik' ? 'Status: konflik versi' : st.status === 'gagal' || st.kotor ? 'Status: belum tersimpan' : st.diHp ? 'Status: tersimpan di HP, menunggu sinkron' : 'Status: tersimpan';
  const judulBar = judul.trim() !== '' ? judul : (catatan?.title ?? 'Catatan');
  const ukuranIsi = (17 * skala) / 100;
  const tinggiIsi = (26 * skala) / 100;
  const meta = useMemo(() => {
    if (catatan === null) {
      return '';
    }
    return `${catatan.workspace_key ? `${catatan.workspace_key} · ` : ''}diperbarui ${jam(catatan.updated_at)}${catatan.penyunting ? ` · ${catatan.penyunting.split(' ')[0]}` : ''}`;
  }, [catatan]);

  const appBar = (
    <Glass style={{ paddingTop: insets.top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, borderWidth: 0 }}>
      <View style={s.bar}>
        <TombolBar label="Kembali dan simpan" onPress={kembali}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TombolBar>
        <Text variant="title" weight={700} numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
          {judulBar}
        </Text>
        {catatan !== null && !folder ? (
          <>
            {boleh && !kaya ? (
              <TombolBar label={labelStatus} onPress={() => setLembar('status')}>
                <IkonStatusSimpan status={st.status} kotor={st.kotor} diHp={st.diHp} />
              </TombolBar>
            ) : null}
            <TombolBar label="Tab dokumen" onPress={() => setLembar('tab')}>
              <Icon name="list" size={24} color={colors.text} />
            </TombolBar>
            {boleh && !kaya ? (
              <TombolBar label={modeAktif ? 'Mode catat aktif, selesai mencatat' : 'Mode catat'} aktif={modeAktif} onPress={ketukModeCatat}>
                <Icon name="notebook-pen" size={24} color={modeAktif ? colors.primary : colors.text} />
              </TombolBar>
            ) : null}
          </>
        ) : null}
      </View>
    </Glass>
  );

  // Keadaan penuh layar: memuat / galat.
  if (catatId === null || (galatMuat !== null && catatan === null) || (memuat && catatan === null)) {
    return (
      <Screen header={appBar} contentStyle={{ paddingTop: 12 }}>
        {memuat && galatMuat === null && catatId !== null ? (
          <Loading label="Memuat catatan…" rows={5} />
        ) : galatMuat?.status === 404 || catatId === null ? (
          <View style={{ gap: 12 }}>
            <ErrorState kind="notfound" title="Catatan tidak ditemukan" message="Catatan ini sudah dihapus, atau akses Anda ke catatan ini dicabut." />
            <Button title="Kembali ke daftar" variant="outline" onPress={() => router.replace('/catatan')} />
          </View>
        ) : (
          <ErrorState
            kind={errorKindFromStatus(galatMuat?.status)}
            title={galatMuat?.status === 0 ? undefined : 'Tidak dapat memuat catatan'}
            message={galatMuat?.status === 0 ? 'Catatan butuh koneksi internet. Sambungkan Wi-Fi atau data seluler, lalu coba lagi.' : (galatMuat?.pesan ?? 'Server tidak merespons. Periksa koneksi lalu coba lagi.')}
            onRetry={() => void muat()}
          />
        )}
      </Screen>
    );
  }

  if (catatan === null) {
    return <Screen header={appBar}>{null}</Screen>;
  }

  const luring = st.status === 'gagal' && st.galat?.status === 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen header={appBar} refreshing={memuat} onRefresh={() => void tarikMuatUlang()} contentStyle={{ paddingTop: 12, gap: 12 }}>
        {st.status === 'konflik' ? (
          <Banner tone="warn" icon="triangle-alert" message="Catatan diubah orang lain — muat ulang untuk versi terbaru." actionLabel="Muat ulang" onAction={() => void muatUlang()} />
        ) : luring ? (
          <Banner tone="warn" icon="cloud-off" message="Belum tersimpan — periksa koneksi. Suntingan dikirim ulang otomatis." actionLabel="Coba lagi" onAction={() => void sesi?.siram()} />
        ) : st.status === 'gagal' ? (
          <Banner tone="bad" icon="circle-alert" message="Gagal menyimpan. Ubah sedikit teks agar percobaan simpan diulang." actionLabel="Coba lagi" onAction={() => void sesi?.siram()} />
        ) : null}

        {!boleh && !folder ? <Banner tone="info" icon="eye" message="Baca-saja — Anda tidak dapat mengubah catatan ini." /> : null}
        {boleh && kaya ? (
          <Banner
            tone="info"
            icon="info"
            message="Catatan ini berformat lengkap. Sunting di web."
            actionLabel="Kirim tautan ke email saya"
            onAction={() => void kirimTautanWeb()}
          />
        ) : null}

        {folder ? (
          <View style={{ gap: 12 }}>
            <Text variant="h2">{catatan.title}</Text>
            <Text variant="meta">Folder · {anak === null ? 'memuat…' : `${anak.length} item`}</Text>
            {anak === null ? (
              <Loading rows={3} />
            ) : anak.length === 0 ? (
              <EmptyState icon="folder-open" title="Folder kosong" description="Belum ada catatan di folder ini." />
            ) : (
              <Card variant="flat" style={{ gap: 0 }}>
                {anak.map((n, i) => (
                  <ListRow key={n.id} icon={n.kind === 'folder' ? 'folder' : n.preset === 'minutes' ? 'notebook-pen' : 'file-text'} title={n.title} subtitle={n.kind === 'folder' ? `${n.children.length} item` : infoDiubah(n)} divider={i > 0} onPress={() => router.push(`/catatan/${n.id}`)} />
                ))}
              </Card>
            )}
          </View>
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <TextInput
                ref={judulRef}
                value={judul}
                onChangeText={(t) => {
                  setJudul(t);
                  judulSaatIni.current = t;
                }}
                onEndEditing={() => {
                  if (sesi !== null && sesi.antreJudul(judulSaatIni.current)) {
                    void sesi.siram();
                  } else if (judulSaatIni.current.trim() === '') {
                    // Judul kosong ditolak: kembalikan yang tersimpan.
                    const lama = sesi?.judulSaatIni ?? catatan.title;
                    setJudul(lama);
                    judulSaatIni.current = lama;
                  }
                }}
                editable={boleh}
                multiline
                maxLength={200}
                placeholder="Tanpa judul"
                placeholderTextColor={colors.subtle}
                accessibilityLabel="Judul catatan"
                style={[s.judul, { color: colors.text, fontFamily: font(800) }]}
              />
              {st.judulGalat ? (
                <Text variant="meta" tone="danger" accessibilityRole="alert">
                  {st.judulGalat}
                </Text>
              ) : null}
              <Text variant="meta" numberOfLines={1}>
                {meta}
              </Text>
              {st.diHp && st.status !== 'konflik' ? <ChipMenunggu teks="Tersimpan di HP · menunggu sinkron" /> : null}
            </View>

            {bolehIsi ? (
              <TextInput
                value={teks}
                onChangeText={(t) => {
                  setTeks(t);
                  sesi?.ubahTeks(t);
                }}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                placeholder="Tulis catatan di sini…"
                placeholderTextColor={colors.subtle}
                accessibilityLabel="Isi catatan"
                style={[s.isi, { color: colors.text, fontFamily: font(400), fontSize: ukuranIsi, lineHeight: tinggiIsi }]}
              />
            ) : (
              <BacaBlok html={catatan.body_html} teks={catatan.body_text} skala={skala} />
            )}
          </>
        )}
      </Screen>

      <StatusSheet
        visible={lembar === 'status'}
        onClose={() => setLembar(null)}
        state={st}
        updatedAt={catatan.updated_at}
        onSiram={() => void sesi?.siram()}
        onMuatUlang={() => void muatUlang()}
        onBagikanTeks={() => void bagikanTeks()}
      />
      <TabSheet
        visible={lembar === 'tab'}
        onClose={() => setLembar(null)}
        tab={tab}
        memuat={memuatTab}
        galat={galatTab}
        onCoba={() => void muatTabDokumen()}
        note={catatan}
        onBerubah={() => {
          setTab(null);
          setGalatTab(null);
        }}
        onAksi={aksiLembar}
        pergi={pergi}
      />
      <AksesSheet visible={lembar === 'akses'} onClose={() => setLembar(null)} noteId={catatan.id} workspaceName={catatan.workspace_key} />
      <RiwayatSheet
        visible={lembar === 'riwayat'}
        onClose={() => setLembar(null)}
        noteId={catatan.id}
        siram={() => (sesi ? sesi.siram() : Promise.resolve(true))}
        onDipulihkan={terapkan}
      />
      <TeksSheet visible={lembar === 'huruf'} onClose={() => setLembar(null)} />
      <PindahSheet visible={lembar === 'pindah'} onClose={() => setLembar(null)} note={catatan} onDipindah={(n) => sesi?.terapkanMeta(n)} />
      <SelesaiSheet visible={lembar === 'selesai'} onClose={() => setLembar(null)} siram={() => (sesi ? sesi.siram() : Promise.resolve(true))} />
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, height: 56 },
  judul: { fontSize: 26, lineHeight: 32, paddingVertical: 4, paddingHorizontal: 0, textAlignVertical: 'top' },
  isi: { minHeight: 320, paddingHorizontal: 0, paddingTop: 4 },
});
