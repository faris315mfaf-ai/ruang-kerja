/**
 * Bottom sheet Hiring: Pindahkan/Tolak (mockup 08 p1–p3), tambah/ubah data
 * kandidat (08 p4–p5, 18 p2), dan pemilih karyawan (11 p3, 12).
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { pindahTahap, tambahKandidat, ubahKandidat, type DataKandidat, type OpsiLowonganRingkas, type OrangHiring, type ProfilKandidat, type TahapKandidat, type TujuanPindah } from '@/api/hiring';
import { useTheme } from '@/theme';
import { Avatar, BottomSheet, Button, Checkbox, Field, Icon, Input, Pressable, Radio, SearchInput, Text } from '@/ui';

import { galatField, pesanGalat, statusGalat } from './format';

// ── Pindahkan / Tolak ────────────────────────────────────────────────────────

export interface HasilPindah {
  message: string;
  previous_stage: TahapKandidat;
  candidate: ProfilKandidat;
}

export function SheetPindah({
  kandidat,
  tujuan,
  offline = false,
  langsungTolak = false,
  onClose,
  onSelesai,
}: {
  /** null = tertutup. */
  kandidat: Pick<DataKandidat, 'id' | 'full_name' | 'stage' | 'stage_label'> | null;
  tujuan: TujuanPindah[];
  offline?: boolean;
  /** Buka langsung pada form alasan penolakan. */
  langsungTolak?: boolean;
  onClose: () => void;
  onSelesai: (hasil: HasilPindah) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'pilih' | 'tolak'>('pilih');
  const [alasan, setAlasan] = useState('');
  const [galatAlasan, setGalatAlasan] = useState<string | null>(null);
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<TahapKandidat | null>(null);
  const terbuka = kandidat !== null;

  useEffect(() => {
    if (terbuka) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset isian saat sheet dibuka
      setMode(langsungTolak ? 'tolak' : 'pilih');
      setAlasan('');
      setGalatAlasan(null);
      setGalatUmum(null);
    }
  }, [terbuka, langsungTolak]);

  async function pindah(stage: TahapKandidat, reason: string | null): Promise<void> {
    if (!kandidat || sibuk) {
      return;
    }
    setSibuk(stage);
    setGalatUmum(null);
    try {
      const hasil = await pindahTahap(kandidat.id, stage, reason);
      onSelesai(hasil);
    } catch (err) {
      const g = galatField(err);
      if (g.reason) {
        setMode('tolak');
        setGalatAlasan(g.reason);
      } else {
        setGalatUmum(statusGalat(err) === 0 ? 'Tidak ada koneksi. Tahap belum dipindah; coba lagi setelah tersambung.' : `Gagal memindahkan: ${pesanGalat(err, 'coba lagi.')}`);
      }
    } finally {
      setSibuk(null);
    }
  }

  function kirimTolak(): void {
    const teks = alasan.trim();
    if (teks === '') {
      setGalatAlasan('Tulis alasan penolakan.');
      return;
    }
    void pindah('rejected', teks);
  }

  const nama = kandidat?.full_name ?? '';
  const bukaKembali = kandidat?.stage === 'hired' || kandidat?.stage === 'rejected';

  return (
    <BottomSheet visible={terbuka} onClose={onClose} title={mode === 'tolak' ? `Tolak ${nama}` : bukaKembali ? `Buka kembali ${nama}` : `Pindahkan ${nama}`} scrollable>
      {mode === 'pilih' ? (
        <View style={{ gap: 4 }}>
          <Text variant="body" tone="muted" style={{ marginTop: -6, marginBottom: 6 }}>
            {`Sekarang: ${kandidat?.stage_label ?? ''}. “Diterima” hanya lewat penyetuju akhir.`}
            {bukaKembali ? ' Membuka kembali menghapus keputusan putaran ini.' : ''}
          </Text>
          {tujuan.map((t) => {
            const mati = t.blocked !== null || offline || sibuk !== null;
            return (
              <Pressable
                key={t.stage}
                onPress={() => (t.requires_reason ? setMode('tolak') : void pindah(t.stage, null))}
                disabled={mati}
                scaleTo={1}
                accessibilityRole="button"
                accessibilityLabel={t.requires_reason ? `${t.label}, perlu alasan` : `Pindahkan ke ${t.label}`}
                accessibilityHint={t.blocked ?? (offline ? 'Butuh koneksi' : undefined)}
                accessibilityState={{ disabled: mati, busy: sibuk === t.stage }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, opacity: t.blocked ? 0.6 : 1 }}
              >
                <Icon name={t.requires_reason ? 'circle-x' : 'arrow-right'} size={22} color={t.requires_reason ? colors.danger : colors.link} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title" tone={t.requires_reason ? 'danger' : 'text'}>
                    {t.requires_reason ? `${t.label}…` : t.label}
                  </Text>
                  {t.blocked ? (
                    <Text variant="meta" style={{ fontSize: 14 }}>
                      {t.blocked}
                    </Text>
                  ) : null}
                </View>
                {sibuk === t.stage ? <Text variant="meta">Memindah…</Text> : null}
              </Pressable>
            );
          })}
          {offline ? (
            <Text variant="meta" tone="warning">
              Memindah tahap butuh koneksi.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Text variant="body" tone="muted" style={{ marginTop: -6 }}>
            Alasan disimpan di profil kandidat dan hanya terlihat HR dan penyetuju.
          </Text>
          <Field label="Alasan penolakan" required error={galatAlasan}>
            <Input
              value={alasan}
              onChangeText={(t) => {
                setAlasan(t);
                setGalatAlasan(null);
              }}
              multiline
              textAlignVertical="top"
              maxLength={2000}
              placeholder="Tulis alasan"
              invalid={galatAlasan !== null}
              autoFocus
              accessibilityLabel="Alasan penolakan"
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Batal" variant="outline" onPress={langsungTolak ? onClose : () => setMode('pilih')} style={{ flex: 1 }} />
            <Button
              title="Tolak kandidat"
              variant="danger"
              onPress={kirimTolak}
              loading={sibuk === 'rejected'}
              loadingTitle="Menolak…"
              disabled={offline}
              disabledReason={offline ? 'Butuh koneksi' : undefined}
              style={{ flex: 1.4 }}
            />
          </View>
        </View>
      )}
      {galatUmum ? (
        <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
          {galatUmum}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

// ── Tambah / ubah data kandidat ──────────────────────────────────────────────

export function SheetIsianKandidat({
  visible,
  kandidat,
  lowongan,
  lowonganAwal,
  onClose,
  onSelesai,
}: {
  visible: boolean;
  /** Ada = ubah data; null = tambah manual. */
  kandidat: DataKandidat | null;
  /** Pilihan lowongan (tambah manual). */
  lowongan: OpsiLowonganRingkas[];
  lowonganAwal?: string | null;
  onClose: () => void;
  onSelesai: (pesan: string, profil: ProfilKandidat) => void;
}): React.JSX.Element {
  const ubah = kandidat !== null;
  const pilihan = useMemo(() => lowongan.filter((l) => l.status !== 'closed'), [lowongan]);
  const [posisi, setPosisi] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [cv, setCv] = useState('');
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang saat sheet dibuka
      setNama(kandidat?.full_name ?? '');
      setEmail(kandidat?.email ?? '');
      setHp(kandidat?.phone ?? '');
      setCv(kandidat?.cv_url ?? '');
      setPosisi(lowonganAwal && pilihan.some((p) => p.id === lowonganAwal) ? lowonganAwal : pilihan.length === 1 ? (pilihan[0]?.id ?? null) : null);
      setGalat({});
      setGalatUmum(null);
    }
    // Hanya saat sheet dibuka: isian tidak boleh direset ketika induk merender ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function kosongJadiNull(t: string): string | null {
    const v = t.trim();
    return v === '' ? null : v;
  }

  async function simpan(): Promise<void> {
    if (sibuk) {
      return;
    }
    const g: Record<string, string> = {};
    if (!ubah && posisi === null) {
      g.position_id = pilihan.length === 0 ? 'Belum ada lowongan aktif. Pilih lowongan yang dibuka atau draf.' : 'Pilih lowongan.';
    }
    if (nama.trim().length < 2) {
      g.full_name = 'Nama lengkap wajib diisi.';
    }
    const tautan = cv.trim();
    if (tautan !== '' && !/^https?:\/\//i.test(tautan)) {
      g.cv_url = 'Tautan harus diawali http:// atau https://.';
    }
    if (Object.keys(g).length > 0) {
      setGalat(g);
      return;
    }
    setSibuk(true);
    setGalatUmum(null);
    const isian = { full_name: nama.trim(), email: kosongJadiNull(email), phone: kosongJadiNull(hp), cv_url: kosongJadiNull(cv) };
    try {
      const hasil = kandidat ? await ubahKandidat(kandidat.id, isian) : await tambahKandidat({ ...isian, position_id: posisi ?? '' });
      onSelesai(hasil.message, hasil.candidate);
    } catch (err) {
      const gf = galatField(err);
      if (Object.keys(gf).length > 0) {
        setGalat(gf);
      } else {
        setGalatUmum(pesanGalat(err, 'Data kandidat gagal disimpan.'));
      }
    } finally {
      setSibuk(false);
    }
  }

  const ubahField = (kunci: string, setter: (t: string) => void) => (t: string) => {
    setter(t);
    if (galat[kunci]) {
      setGalat((lama) => {
        const baru = { ...lama };
        delete baru[kunci];
        return baru;
      });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={ubah ? 'Ubah data kandidat' : 'Tambah kandidat manual'} scrollable>
      <View style={{ gap: 14 }}>
        {!ubah ? (
          <Text variant="body" tone="muted" style={{ marginTop: -6 }}>
            Untuk pelamar yang tidak lewat Google Form (rujukan, email). Kandidat masuk ke tahap Masuk.
          </Text>
        ) : null}
        {!ubah ? (
          <Field label="Lowongan" required error={galat.position_id ?? null}>
            {pilihan.length === 0 ? (
              <Text variant="body" tone="muted">
                Belum ada lowongan aktif.
              </Text>
            ) : (
              <View>
                {pilihan.map((l) => (
                  <Radio key={l.id} selected={posisi === l.id} onSelect={() => setPosisi(l.id)} label={l.title} description={l.status === 'draft' ? 'Draf' : 'Dibuka'} />
                ))}
              </View>
            )}
          </Field>
        ) : null}
        <Field label="Nama lengkap" required error={galat.full_name ?? null}>
          <Input value={nama} onChangeText={ubahField('full_name', setNama)} maxLength={150} invalid={!!galat.full_name} autoCapitalize="words" accessibilityLabel="Nama lengkap" />
        </Field>
        <Field label="Email" hint="Opsional" error={galat.email ?? null}>
          <Input value={email} onChangeText={ubahField('email', setEmail)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={190} invalid={!!galat.email} accessibilityLabel="Email" />
        </Field>
        <Field label="No. HP" hint="Opsional" error={galat.phone ?? null}>
          <Input value={hp} onChangeText={ubahField('phone', setHp)} keyboardType="phone-pad" maxLength={40} invalid={!!galat.phone} accessibilityLabel="Nomor HP" />
        </Field>
        <Field label="Tautan CV" hint={galat.cv_url ? null : 'Tautan saja; berkas tidak disimpan di RuangKerja.'} error={galat.cv_url ?? null}>
          <Input value={cv} onChangeText={ubahField('cv_url', setCv)} keyboardType="url" autoCapitalize="none" autoCorrect={false} maxLength={2000} placeholder="https://drive.google.com/…" invalid={!!galat.cv_url} accessibilityLabel="Tautan CV" />
        </Field>
        {galatUmum ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
            {galatUmum}
          </Text>
        ) : null}
        <Button title={ubah ? 'Simpan' : 'Tambah kandidat'} onPress={() => void simpan()} loading={sibuk} loadingTitle="Menyimpan…" />
      </View>
    </BottomSheet>
  );
}

// ── Pemilih karyawan (multi) ─────────────────────────────────────────────────

export function PemilihOrang({
  visible,
  judul,
  karyawan,
  terpilih,
  maks,
  catatan = 'Hanya karyawan aktif perusahaan yang bisa dipilih.',
  onClose,
  onSimpan,
}: {
  visible: boolean;
  judul: string;
  karyawan: OrangHiring[];
  terpilih: string[];
  maks: number;
  catatan?: string;
  onClose: () => void;
  onSimpan: (ids: string[]) => void;
}): React.JSX.Element {
  const [cari, setCari] = useState('');
  const [pilih, setPilih] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang saat sheet dibuka
      setPilih(terpilih);
      setCari('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat sheet dibuka
  }, [visible]);

  const aktif = useMemo(() => karyawan.filter((k) => k.active !== false), [karyawan]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q === '' ? aktif : aktif.filter((k) => k.name.toLowerCase().includes(q) || (k.position ?? '').toLowerCase().includes(q));
  }, [aktif, cari]);

  function ganti(id: string, nilai: boolean): void {
    setPilih((lama) => (nilai ? (lama.includes(id) || lama.length >= maks ? lama : [...lama, id]) : lama.filter((x) => x !== id)));
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={judul} scrollable snapPoints={['85%']}>
      <View style={{ gap: 10 }}>
        <SearchInput value={cari} onChangeText={setCari} placeholder="Cari karyawan aktif" />
        <Text variant="meta" style={{ fontSize: 14 }}>
          {`${pilih.length} dipilih · maks. ${maks}. ${catatan}`}
        </Text>
        {tampil.length === 0 ? (
          <Text variant="body" tone="muted">
            Tidak ada karyawan yang cocok.
          </Text>
        ) : (
          tampil.map((k) => {
            const dipilih = pilih.includes(k.id);
            return (
              <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={k.name} size="sm" />
                <Checkbox
                  checked={dipilih}
                  onChange={(v) => ganti(k.id, v)}
                  disabled={!dipilih && pilih.length >= maks}
                  label={k.position ? `${k.name} · ${k.position}` : k.name}
                  style={{ flex: 1, flexDirection: 'row-reverse' }}
                />
              </View>
            );
          })
        )}
        <Button title="Simpan pilihan" onPress={() => onSimpan(pilih)} />
      </View>
    </BottomSheet>
  );
}
