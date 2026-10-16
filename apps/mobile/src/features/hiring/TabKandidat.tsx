/**
 * Hiring › Kandidat (mockup 11 › 07, 08, 09): filter lowongan, cari, chip tahap
 * berangka, kartu kandidat, "Pindahkan ke…" (tanpa seret) + Urungkan, FAB
 * tambah kandidat manual (HR/SA). `GET /hiring/kandidat`.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { daftarKandidat, pindahTahap, type DaftarKandidat, type KartuKandidat, type RingkasHiring, type TahapKandidat } from '@/api/hiring';
import { BottomSheet, Chip, ChipScroller, EmptyState, ErrorState, Fab, Loading, Radio, Screen, SearchInput, SelectField, Text, errorKindFromStatus, useSnackbar, Banner } from '@/ui';

import { pesanGalat, tujuanDariDaftar } from './format';
import { BannerOffline, HalamanTidakDitemukan, KartuKandidatItem } from './parts';
import { SheetIsianKandidat, SheetPindah, type HasilPindah } from './sheets';
import { useHiringData } from './useHiringData';

export function TabKandidat({
  header,
  lowonganAwal,
  onHiring,
  onKeLowongan,
}: {
  header: React.ReactNode;
  lowonganAwal: string | null;
  onHiring: (h: RingkasHiring) => void;
  onKeLowongan: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const [lowongan, setLowongan] = useState<string | null>(lowonganAwal);
  const [cari, setCari] = useState('');
  const [cariAktif, setCariAktif] = useState('');
  const [tahap, setTahap] = useState<TahapKandidat | null>(null);
  const [sheetLowongan, setSheetLowongan] = useState(false);
  const [pindah, setPindah] = useState<KartuKandidat | null>(null);
  const [tambah, setTambah] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter dari parameter rute (ketuk kartu lowongan)
    setLowongan(lowonganAwal);
  }, [lowonganAwal]);

  useEffect(() => {
    const t = setTimeout(() => setCariAktif(cari.trim()), 400);
    return () => clearTimeout(t);
  }, [cari]);

  const kunci = `kandidat:${lowongan ?? ''}:${cariAktif}:${tahap ?? ''}`;
  const ambil = useCallback(() => daftarKandidat({ lowongan, q: cariAktif || null, tahap }), [lowongan, cariAktif, tahap]);
  const m = useHiringData<DaftarKandidat>(kunci, ambil);
  const d = m.data;
  const offline = m.offlineSejak !== null;

  useEffect(() => {
    if (d) {
      onHiring(d.hiring);
    }
  }, [d, onHiring]);

  // Segarkan diam-diam saat kembali dari profil kandidat (tahap/checklist bisa berubah).
  const pertama = useRef(true);
  const muat = m.muat;
  useFocusEffect(
    useCallback(() => {
      if (pertama.current) {
        pertama.current = false;
        return;
      }
      void muat('diam');
    }, [muat]),
  );

  const hapusFilter = (): void => {
    setLowongan(null);
    setCari('');
    setCariAktif('');
    setTahap(null);
  };

  function setelahPindah(k: Pick<KartuKandidat, 'id' | 'full_name'>, hasil: HasilPindah): void {
    setPindah(null);
    void m.muat('diam');
    snackbar.show({
      message: hasil.message,
      variant: 'ok',
      actionLabel: 'Urungkan',
      duration: 6000,
      onAction: () => {
        void (async () => {
          try {
            await pindahTahap(k.id, hasil.previous_stage);
            snackbar.show({ message: `${k.full_name} dikembalikan.`, variant: 'info' });
          } catch (err) {
            snackbar.show({ message: pesanGalat(err, 'Gagal mengurungkan.'), variant: 'bad' });
          } finally {
            void m.muat('diam');
          }
        })();
      },
    });
  }

  if (m.galat && (m.galat.status === 404 || m.galat.status === 403)) {
    return <HalamanTidakDitemukan />;
  }

  const total = d ? d.stages.reduce((n, st) => n + st.count, 0) : 0;
  const posisiTerpilih = d?.positions.find((p) => p.id === lowongan) ?? null;
  const adaFilter = lowongan !== null || cariAktif !== '';

  let isi: React.ReactNode = null;
  if (m.memuat && !d) {
    isi = <Loading rows={5} label="Memuat kandidat…" />;
  } else if (m.galat && !d) {
    isi =
      m.galat.status === 0 ? (
        <ErrorState kind="offline" title="Hiring tidak tersedia offline" message="Data pelamar tidak disimpan di perangkat. Sambungkan internet, lalu coba lagi." onRetry={() => void m.muat()} />
      ) : (
        <ErrorState title="Kandidat gagal dimuat" message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muat()} />
      );
  } else if (d) {
    if (d.positions.length === 0 && !adaFilter) {
      isi = (
        <EmptyState
          icon="briefcase-business"
          title="Belum ada lowongan"
          description={d.can.manage ? 'Buat lowongan dulu, lalu sambungkan Google Form-nya agar pelamar masuk otomatis.' : 'Belum ada lowongan yang ditugaskan kepada Anda.'}
          actionLabel={d.can.manage ? 'Buka tab Lowongan' : undefined}
          onAction={d.can.manage ? onKeLowongan : undefined}
        />
      );
    } else if (d.candidates.length === 0) {
      isi = adaFilter ? (
        <EmptyState icon="search-x" title="Tidak ada kandidat yang cocok" description="Ubah filter lowongan atau kata pencarian." actionLabel="Hapus filter" onAction={hapusFilter} />
      ) : tahap ? (
        <EmptyState icon="users" title="Belum ada kandidat di tahap ini" description={d.can.move ? 'Pindahkan kandidat dari tahap sebelumnya lewat menu “Pindahkan ke…”.' : 'Kandidat muncul di sini setelah HR memindahkannya.'} variant="plain" />
      ) : (
        <EmptyState icon="users" title="Belum ada kandidat" description={d.can.create_candidate ? 'Pelamar dari Google Form masuk otomatis. Anda juga bisa menambah kandidat manual.' : 'Pelamar dari Google Form masuk otomatis.'} />
      );
    } else {
      isi = (
        <View style={{ gap: 12 }}>
          {d.candidates.map((k) => (
            <KartuKandidatItem
              key={k.id}
              k={k}
              tampilTahap={tahap === null}
              onPress={() => router.push(`/hiring/kandidat/${k.id}` as never)}
              onPindah={d.can.move ? () => setPindah(k) : undefined}
              pindahNonaktif={offline}
            />
          ))}
          {d.truncated ? <Banner tone="info" message="Menampilkan 500 kandidat terbaru. Pakai filter lowongan atau pencarian untuk yang lebih lama." /> : null}
        </View>
      );
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen header={header} refreshing={m.menyegarkan} onRefresh={() => void m.muat('tarik')} contentStyle={{ paddingTop: 12, paddingBottom: d?.can.create_candidate ? 112 : undefined }}>
        {m.offlineSejak !== null ? <BannerOffline sejak={m.offlineSejak} pesan="memindah tahap dan menyimpan keputusan butuh koneksi." /> : null}
        {d && (d.positions.length > 0 || adaFilter) ? (
          <>
            <SelectField
              value={posisiTerpilih ? posisiTerpilih.title : 'Semua lowongan'}
              onPress={() => setSheetLowongan(true)}
              accessibilityLabel={`Filter lowongan: ${posisiTerpilih ? posisiTerpilih.title : 'Semua lowongan'}`}
            />
            <SearchInput value={cari} onChangeText={setCari} placeholder="Cari nama atau email" />
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              <Chip label="Semua" count={total} selected={tahap === null} onPress={() => setTahap(null)} />
              {d.stages.map((st) => (
                <Chip key={st.value} label={st.label} count={st.count} selected={tahap === st.value} onPress={() => setTahap(tahap === st.value ? null : st.value)} />
              ))}
            </ChipScroller>
          </>
        ) : null}
        {isi}
        {tahap === 'hired' || tahap === 'rejected' ? (
          <Text variant="meta" style={{ fontSize: 14 }}>
            Data pelamar dihapus permanen 30 hari setelah keputusan akhir (retensi).
          </Text>
        ) : null}
      </Screen>
      {d?.can.create_candidate ? (
        <Fab icon="user-plus" label="Tambah kandidat manual" onPress={() => setTambah(true)} style={{ position: 'absolute', right: 16, bottom: insets.bottom + 20 }} />
      ) : null}
      <BottomSheet visible={sheetLowongan} onClose={() => setSheetLowongan(false)} title="Filter lowongan" scrollable>
        <View>
          <Radio
            selected={lowongan === null}
            onSelect={() => {
              setLowongan(null);
              setSheetLowongan(false);
            }}
            label="Semua lowongan"
          />
          {(d?.positions ?? []).map((p) => (
            <Radio
              key={p.id}
              selected={lowongan === p.id}
              onSelect={() => {
                setLowongan(p.id);
                setSheetLowongan(false);
              }}
              label={p.title}
              description={p.status === 'open' ? 'Dibuka' : p.status === 'draft' ? 'Draf' : 'Ditutup'}
            />
          ))}
        </View>
      </BottomSheet>
      <SheetPindah
        kandidat={pindah ? { id: pindah.id, full_name: pindah.full_name, stage: pindah.stage, stage_label: pindah.stage_label } : null}
        tujuan={pindah ? tujuanDariDaftar(pindah.stage) : []}
        offline={offline}
        onClose={() => setPindah(null)}
        onSelesai={(hasil) => {
          if (pindah) {
            setelahPindah(pindah, hasil);
          }
        }}
      />
      <SheetIsianKandidat
        visible={tambah}
        kandidat={null}
        lowongan={d?.positions ?? []}
        lowonganAwal={lowongan}
        onClose={() => setTambah(false)}
        onSelesai={(pesan, profil) => {
          setTambah(false);
          snackbar.show({ message: pesan, variant: 'ok', actionLabel: 'Buka', onAction: () => router.push(`/hiring/kandidat/${profil.candidate.id}` as never) });
          void m.muat('diam');
        }}
      />
    </View>
  );
}
