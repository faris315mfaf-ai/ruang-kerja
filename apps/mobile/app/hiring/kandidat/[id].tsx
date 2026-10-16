/**
 * Profil kandidat (mockup 11 › 13–18): kepala (nama, lowongan · divisi,
 * tahap, Pindahkan…), tab menggulir Profil · Wawancara · Checklist n/m ·
 * Notulensi · Keputusan, menu ⋯ (Ubah data, Buka CV). Data pelamar hanya di
 * memori layar; CV dibuka di peramban luar. `GET /hiring/kandidat/{id}`.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { pindahTahap, simpanPoin, profilKandidat, type ButirChecklist, type Notulensi, type ProfilKandidat } from '@/api/hiring';
import { nadaTahap, pesanGalat, tautanAman } from '@/features/hiring/format';
import { BannerOffline, HalamanTidakDitemukan } from '@/features/hiring/parts';
import { SheetIsianKandidat, SheetPindah, type HasilPindah } from '@/features/hiring/sheets';
import { BannerHasil, TabNotulensi, TabProfil, bukaTautanLuar } from '@/features/hiring/TabProfil';
import { TabChecklist, TabKeputusan, TabWawancara, type DrafPoin } from '@/features/hiring/TabPenilaian';
import { useHiringData } from '@/features/hiring/useHiringData';
import { useJawaban } from '@/features/hiring/useJawaban';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';
import { Badge, BottomSheet, Button, ErrorState, Loading, Screen, SheetAction, SubAppBar, TabNav, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

type TabProfilKandidat = 'profil' | 'wawancara' | 'checklist' | 'notulensi' | 'keputusan';

export default function ProfilKandidatLayar(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useSession();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [tab, setTab] = useState<TabProfilKandidat>('profil');
  const [menu, setMenu] = useState(false);
  const [ubah, setUbah] = useState(false);
  const [pindah, setPindah] = useState<{ tolak: boolean } | null>(null);
  const [konflik, setKonflik] = useState(false);
  const [draf, setDraf] = useState<Record<string, DrafPoin>>({});
  const [galatPoin, setGalatPoin] = useState<Record<string, string>>({});
  const [simpanPoinSibuk, setSimpanPoinSibuk] = useState(false);

  const ambil = useCallback(() => profilKandidat(id ?? ''), [id]);
  const m = useHiringData<ProfilKandidat>(id ? `kandidat:${id}` : null, ambil);
  const p = m.data;
  const offline = m.offlineSejak !== null;
  const setData = m.setData;

  const jawabanTersimpan = useCallback(
    (qid: string, answer: string | null) => {
      setData((lama) => (lama ? { ...lama, questions: lama.questions.map((q) => (q.id === qid ? { ...q, answer } : q)) } : lama));
    },
    [setData],
  );
  const jawaban = useJawaban(id ?? null, jawabanTersimpan);

  const jumlahDraf = Object.keys(draf).length;
  const saya = user?.id ?? null;

  const tabOpsi = useMemo(() => {
    if (!p) {
      return [
        { value: 'profil' as const, label: 'Profil' },
        { value: 'wawancara' as const, label: 'Wawancara' },
        { value: 'checklist' as const, label: 'Checklist' },
        { value: 'notulensi' as const, label: 'Notulensi' },
        { value: 'keputusan' as const, label: 'Keputusan' },
      ];
    }
    return [
      { value: 'profil' as const, label: 'Profil' },
      { value: 'wawancara' as const, label: 'Wawancara' },
      { value: 'checklist' as const, label: `Checklist ${p.summary.checklist.done}/${p.summary.checklist.total}` },
      { value: 'notulensi' as const, label: p.notes.length > 0 ? `Notulensi ${p.notes.length}` : 'Notulensi' },
      { value: 'keputusan' as const, label: 'Keputusan' },
    ];
  }, [p]);

  function pasangProfil(baru: ProfilKandidat): void {
    setData(() => baru);
    setKonflik(false);
  }

  async function kembali(): Promise<void> {
    if (jumlahDraf > 0) {
      const ok = await dialog.confirm({ title: 'Buang poin yang belum disimpan?', message: `${jumlahDraf} poin belum disimpan.`, confirmLabel: 'Buang', destructive: true });
      if (!ok) {
        return;
      }
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/hiring' as never);
    }
  }

  async function simpanSemuaPoin(): Promise<void> {
    if (!p || simpanPoinSibuk) {
      return;
    }
    setSimpanPoinSibuk(true);
    const galatBaru: Record<string, string> = {};
    const sisa: Record<string, DrafPoin> = { ...draf };
    for (const [qid, d] of Object.entries(draf)) {
      const note = d.note.trim() === '' ? null : d.note.trim();
      try {
        const hasil = await simpanPoin(p.candidate.id, qid, d.score, d.score === null ? null : note);
        delete sisa[qid];
        setData((lama) => (lama ? { ...lama, questions: lama.questions.map((q) => (q.id === qid ? { ...q, my_score: hasil.my_score } : q)) } : lama));
      } catch (err) {
        galatBaru[qid] = pesanGalat(err, 'Poin gagal disimpan.');
      }
    }
    setDraf(sisa);
    setGalatPoin(galatBaru);
    setSimpanPoinSibuk(false);
    if (Object.keys(galatBaru).length === 0) {
      snackbar.show({ message: 'Poin disimpan.', variant: 'ok' });
    } else {
      snackbar.show({ message: `${Object.keys(galatBaru).length} poin belum tersimpan. Periksa pesan di pertanyaan.`, variant: 'bad' });
    }
    void m.muat('diam');
  }

  function setelahPindah(hasil: HasilPindah): void {
    setPindah(null);
    pasangProfil(hasil.candidate);
    const nama = hasil.candidate.candidate.full_name;
    snackbar.show({
      message: hasil.message,
      variant: 'ok',
      actionLabel: 'Urungkan',
      duration: 6000,
      onAction: () => {
        void (async () => {
          try {
            const balik = await pindahTahap(hasil.candidate.candidate.id, hasil.previous_stage);
            pasangProfil(balik.candidate);
            snackbar.show({ message: `${nama} dikembalikan.`, variant: 'info' });
          } catch (err) {
            snackbar.show({ message: pesanGalat(err, 'Gagal mengurungkan.'), variant: 'bad' });
            void m.muat('diam');
          }
        })();
      },
    });
  }

  if (m.galat && (m.galat.status === 404 || m.galat.status === 403)) {
    return <HalamanTidakDitemukan judul="Kandidat" alasan="Kandidat ini tidak ada atau tidak ditugaskan kepada Anda." />;
  }

  const k = p?.candidate ?? null;
  const cv = tautanAman(k?.cv_url);
  const aksiBar = p && (p.can.edit || cv) ? [{ icon: 'ellipsis-vertical' as const, label: 'Menu kandidat', onPress: () => setMenu(true) }] : [];

  let isiTab: React.ReactNode = null;
  if (p) {
    switch (tab) {
      case 'profil':
        isiTab = <TabProfil p={p} onUbah={p.can.edit ? () => setUbah(true) : undefined} onGagal={(pesan) => snackbar.show({ message: pesan, variant: 'bad' })} />;
        break;
      case 'wawancara':
        isiTab = (
          <TabWawancara
            p={p}
            jawaban={jawaban}
            draf={draf}
            galatPoin={galatPoin}
            offline={offline}
            onDraf={(qid, d) => {
              setGalatPoin((lama) => {
                if (!lama[qid]) {
                  return lama;
                }
                const baru = { ...lama };
                delete baru[qid];
                return baru;
              });
              setDraf((lama) => {
                const baru = { ...lama };
                if (d === null) {
                  delete baru[qid];
                } else {
                  baru[qid] = d;
                }
                return baru;
              });
            }}
            onBukaLowongan={p.can.manage ? () => router.push(`/hiring/lowongan/${p.candidate.position.id}` as never) : undefined}
          />
        );
        break;
      case 'checklist':
        isiTab = (
          <TabChecklist
            p={p}
            offline={offline}
            onButir={(itemId, item: ButirChecklist | null) =>
              setData((lama) => (lama ? { ...lama, checklist: item ? lama.checklist.map((b) => (b.id === itemId ? item : b)) : lama.checklist.filter((b) => b.id !== itemId) } : lama))
            }
            onSegarkan={() => void m.muat('diam')}
          />
        );
        break;
      case 'notulensi':
        isiTab = <TabNotulensi p={p} offline={offline} onUbahDaftar={(ubahDaftar: (lama: Notulensi[]) => Notulensi[]) => setData((lama) => (lama ? { ...lama, notes: ubahDaftar(lama.notes) } : lama))} />;
        break;
      case 'keputusan':
        isiTab = (
          <TabKeputusan
            key={`${p.candidate.stage}-${p.my_decision?.decision ?? ''}`}
            p={p}
            saya={saya}
            offline={offline}
            konflik={konflik}
            onMuatUlang={() => {
              setKonflik(false);
              void m.muat('tarik');
            }}
            onKonflik={() => {
              setKonflik(true);
              void m.muat('diam');
            }}
            onHasil={(pesan, baru) => {
              pasangProfil(baru);
              snackbar.show({ message: pesan, variant: 'ok' });
            }}
            onBukaChecklist={() => setTab('checklist')}
            onBukaKembali={p.can.move ? () => setPindah({ tolak: false }) : undefined}
          />
        );
        break;
    }
  }

  const footer =
    p && tab === 'wawancara' && p.can.score ? (
      <Button
        title={jumlahDraf > 0 ? `Simpan poin (${jumlahDraf})` : 'Simpan poin'}
        icon="save"
        onPress={() => void simpanSemuaPoin()}
        loading={simpanPoinSibuk}
        loadingTitle="Menyimpan…"
        disabled={jumlahDraf === 0 || offline}
        disabledReason={offline ? 'Butuh koneksi' : 'Belum ada poin yang diubah'}
        style={{ flex: 1 }}
      />
    ) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <View>
            <SubAppBar title={k?.full_name ?? 'Kandidat'} onBack={() => void kembali()} actions={aksiBar} />
            {p && k ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
                <Text variant="body" tone="muted" numberOfLines={2}>
                  {[k.position.title, k.position.division ? `Divisi ${k.position.division}` : null].filter(Boolean).join(' · ')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <Badge tone={nadaTahap(k.stage)} dot>
                    {k.stage_label}
                  </Badge>
                  {k.is_manual ? <Badge tone="neutral">Ditambahkan manual</Badge> : null}
                  {k.position.status !== 'open' ? <Badge tone="neutral">{`Lowongan ${k.position.status_label.toLowerCase()}`}</Badge> : null}
                  <View style={{ flex: 1 }} />
                  {p.can.move ? (
                    <Button
                      title={k.stage === 'hired' || k.stage === 'rejected' ? 'Buka kembali…' : 'Pindahkan…'}
                      variant="tonal"
                      icon="arrow-right-left"
                      onPress={() => setPindah({ tolak: false })}
                      disabled={offline}
                      disabledReason={offline ? 'Butuh koneksi' : undefined}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            <View style={{ backgroundColor: colors.bg }}>
              <TabNav value={tab} options={tabOpsi} onChange={setTab} />
            </View>
          </View>
        }
        refreshing={m.menyegarkan}
        onRefresh={() => void m.muat('tarik')}
        contentStyle={{ paddingTop: 12 }}
        footer={footer}
      >
        {m.offlineSejak !== null ? <BannerOffline sejak={m.offlineSejak} pesan="memindah tahap dan keputusan butuh koneksi." /> : null}
        {m.memuat && !p ? (
          <Loading rows={6} label="Memuat profil kandidat…" />
        ) : m.galat && !p ? (
          m.galat.status === 0 ? (
            <ErrorState kind="offline" title="Profil tidak tersedia offline" message="Data pelamar tidak disimpan di perangkat. Sambungkan internet, lalu coba lagi." onRetry={() => void m.muat()} />
          ) : (
            <ErrorState title="Profil kandidat gagal dimuat" message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muat()} />
          )
        ) : p ? (
          <>
            {tab === 'profil' ? <BannerHasil p={p} /> : null}
            {isiTab}
          </>
        ) : null}
      </Screen>

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        {p?.can.edit ? (
          <SheetAction
            icon="pencil"
            label="Ubah data"
            description="Nama, email, No. HP, tautan CV"
            onPress={() => {
              setMenu(false);
              setUbah(true);
            }}
          />
        ) : null}
        {cv ? (
          <SheetAction
            icon="external-link"
            label="Buka CV"
            description="Di Chrome/aplikasi Drive; tidak disimpan di RuangKerja"
            onPress={() => {
              setMenu(false);
              bukaTautanLuar(cv, (pesan) => snackbar.show({ message: pesan, variant: 'bad' }));
            }}
          />
        ) : null}
      </BottomSheet>

      <SheetIsianKandidat
        visible={ubah}
        kandidat={k}
        lowongan={[]}
        onClose={() => setUbah(false)}
        onSelesai={(pesan, baru) => {
          setUbah(false);
          pasangProfil(baru);
          snackbar.show({ message: pesan, variant: 'ok' });
        }}
      />

      <SheetPindah
        kandidat={pindah && k ? { id: k.id, full_name: k.full_name, stage: k.stage, stage_label: k.stage_label } : null}
        tujuan={p?.move_targets ?? []}
        offline={offline}
        langsungTolak={pindah?.tolak ?? false}
        onClose={() => setPindah(null)}
        onSelesai={setelahPindah}
      />
    </View>
  );
}
