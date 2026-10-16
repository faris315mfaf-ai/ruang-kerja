/**
 * Profil kandidat · tab Profil (mockup 11 › 13: Ringkasan, data, berkas,
 * jawaban formulir; kandidat manual; Diterima/Ditolak) dan tab Notulensi
 * (16: daftar, tulis, ubah/hapus milik sendiri, kosong). CV & berkas dibuka di
 * peramban luar — tidak pernah diunduh/di-cache di aplikasi.
 */
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { hapusNotulensi, tambahNotulensi, ubahNotulensi, type Notulensi, type ProfilKandidat } from '@/api/hiring';
import { jam, tanggalPanjang, tanggalPendek } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Banner, BottomSheet, Button, Card, EmptyState, Field, Icon, IconButton, Input, Pressable, Progress, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import { angkaSatu, pesanGalat, tautanAman } from './format';

function BarisData({ label, children, akhir = false }: { label: string; children: React.ReactNode; akhir?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.baris, !akhir ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider } : null]}>
      <Text variant="body" tone="muted" style={{ width: 96, fontSize: 16 }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <Text variant="body" weight={600} style={{ fontSize: 16 }} selectable>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function bukaTautanLuar(url: string | null | undefined, onGagal: (pesan: string) => void): void {
  const aman = tautanAman(url);
  if (!aman) {
    onGagal('Tautan tidak valid. Hanya tautan http/https yang bisa dibuka.');
    return;
  }
  Linking.openURL(aman).catch(() => onGagal('Tautan tidak bisa dibuka di perangkat ini.'));
}

function TautanTeks({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} scaleTo={1} accessibilityRole="link" accessibilityLabel={a11y} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text variant="body" tone="link" weight={600} style={{ fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Kartu "Ringkasan" (cincin checklist, total poin — informasi saja —, status keputusan). */
export function RingkasanKandidat({ p }: { p: ProfilKandidat }): React.JSX.Element {
  const c = p.summary.checklist;
  const persen = c.total > 0 ? (c.done / c.total) * 100 : 100;
  const skor = p.summary.score ?? p.summary.my_score;
  const kep = p.summary.decisions;
  return (
    <Card style={{ gap: 12 }}>
      <Text variant="overline">Ringkasan</Text>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="label">Checklist wajib</Text>
          <Text variant="label" tone={c.done >= c.total ? 'success' : 'text'}>
            {c.total === 0 ? 'Tanpa butir wajib' : c.done >= c.total ? `${c.done}/${c.total} · Lengkap` : `${c.done}/${c.total}`}
          </Text>
        </View>
        <Progress value={persen} label={`Checklist wajib ${c.done} dari ${c.total}`} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="label">{p.summary.score ? 'Total poin wawancara' : 'Poin Anda'}</Text>
        <Text variant="label">{skor && skor.scored_questions > 0 ? `${angkaSatu(skor.total)} / ${skor.max}` : 'Belum ada poin'}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="label">Keputusan akhir</Text>
        <Text variant="label" tone={kep.rejected > 0 ? 'danger' : kep.total > 0 && kep.approved === kep.total ? 'success' : 'text'}>
          {kep.total === 0 ? 'Belum ada penyetuju' : kep.rejected > 0 ? `${kep.rejected} menolak` : `${kep.approved} dari ${kep.total} setuju`}
        </Text>
      </View>
    </Card>
  );
}

/** Spanduk hasil akhir (Diterima + retensi 30 hari / Ditolak + alasan). */
export function BannerHasil({ p }: { p: ProfilKandidat }): React.JSX.Element | null {
  const k = p.candidate;
  if (k.stage === 'hired') {
    const batas = k.decided_at ? tanggalPendek(new Date(new Date(k.decided_at).getTime() + 30 * 86_400_000)) : null;
    return (
      <Banner
        tone="ok"
        title="Diterima"
        message={`${k.decided_at ? `${tanggalPanjang(k.decided_at)} oleh semua penyetuju. ` : ''}Pindahkan data yang perlu disimpan ke profil karyawan${batas ? ` sebelum ${batas}` : ''} (retensi 30 hari).`}
      />
    );
  }
  if (k.stage === 'rejected') {
    return <Banner tone="bad" title="Ditolak" message={`${k.rejected_reason ? `“${k.rejected_reason}”. ` : ''}Alasan hanya terlihat di aplikasi. Data pelamar dihapus 30 hari setelah keputusan.`} />;
  }
  return null;
}

export function TabProfil({ p, onUbah, onGagal }: { p: ProfilKandidat; onUbah?: () => void; onGagal: (pesan: string) => void }): React.JSX.Element {
  const k = p.candidate;
  const cv = tautanAman(k.cv_url);
  return (
    <View style={{ gap: 16 }}>
      <RingkasanKandidat p={p} />
      <Card style={{ gap: 0 }}>
        <Text variant="h3" style={{ marginBottom: 4 }}>
          Data kandidat
        </Text>
        <BarisData label="Email">{k.email ? <TautanTeks label={k.email} a11y={`Kirim email ke ${k.email}`} onPress={() => void Linking.openURL(`mailto:${k.email}`).catch(() => undefined)} /> : '—'}</BarisData>
        <BarisData label="No. HP">{k.phone ? <TautanTeks label={k.phone} a11y={`Telepon ${k.phone}`} onPress={() => void Linking.openURL(`tel:${k.phone?.replace(/[^\d+]/g, '')}`).catch(() => undefined)} /> : '—'}</BarisData>
        <BarisData label="Sumber">{k.source_label}</BarisData>
        <BarisData label="Melamar">{tanggalPanjang(k.applied_at)}</BarisData>
        <BarisData label="CV" akhir>
          {cv ? (
            <View style={{ gap: 6, alignItems: 'flex-start' }}>
              <Button title="Buka CV" variant="tonal" icon="external-link" onPress={() => bukaTautanLuar(cv, onGagal)} accessibilityHint="Membuka CV di peramban atau aplikasi Drive" />
              <Text variant="meta" style={{ fontSize: 14 }}>
                CV dibuka di Chrome/aplikasi Drive; berkas tidak disimpan di RuangKerja.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 6, alignItems: 'flex-start' }}>
              <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
                Belum ada tautan CV.
              </Text>
              {onUbah ? <Button title="Ubah data" variant="quiet" icon="pencil" onPress={onUbah} /> : null}
            </View>
          )}
        </BarisData>
      </Card>
      {k.attachments.length > 0 ? (
        <Card style={{ gap: 4 }}>
          <Text variant="h3">Berkas dari formulir</Text>
          {k.attachments.map((b, i) => (
            <Pressable
              key={`${b.url}-${i}`}
              onPress={() => bukaTautanLuar(b.url, onGagal)}
              scaleTo={1}
              accessibilityRole="link"
              accessibilityLabel={`Buka ${b.label}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}
            >
              <Icon name="paperclip" size={20} />
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={2}>
                  {b.label}
                </Text>
                <Text variant="meta" numberOfLines={1}>
                  {b.url.replace(/^https?:\/\//, '')}
                </Text>
              </View>
              <Icon name="external-link" size={18} />
            </Pressable>
          ))}
        </Card>
      ) : null}
      <Card style={{ gap: 10 }}>
        <Text variant="h3">Jawaban formulir</Text>
        {k.form_answers.length === 0 ? (
          <Text variant="body" tone="muted">
            {k.is_manual ? 'Tidak ada jawaban formulir. Kandidat ini ditambahkan manual oleh HR.' : 'Tidak ada jawaban formulir.'}
          </Text>
        ) : (
          k.form_answers.map((j, i) => (
            <View key={`${j.question}-${i}`} style={{ gap: 2 }}>
              <Text variant="meta" weight={700} style={{ fontSize: 14 }}>
                {j.question}
              </Text>
              <Text variant="body" selectable>
                {j.answer}
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

// ── Notulensi ────────────────────────────────────────────────────────────────

const MAKS_NOTULENSI = 20_000;

export function TabNotulensi({
  p,
  offline,
  onUbahDaftar,
}: {
  p: ProfilKandidat;
  offline: boolean;
  onUbahDaftar: (ubah: (lama: Notulensi[]) => Notulensi[]) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [tulis, setTulis] = useState<{ note: Notulensi | null } | null>(null);
  const [menu, setMenu] = useState<Notulensi | null>(null);
  const [isi, setIsi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (tulis) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang saat sheet dibuka
      setIsi(tulis.note?.body ?? '');
      setGalat(null);
    }
  }, [tulis]);

  async function simpan(): Promise<void> {
    if (!tulis || sibuk) {
      return;
    }
    const teks = isi.trim();
    if (teks.length < 2) {
      setGalat('Tulis notulensi minimal 2 karakter.');
      return;
    }
    setSibuk(true);
    try {
      if (tulis.note) {
        const hasil = await ubahNotulensi(tulis.note.id, teks);
        onUbahDaftar((lama) => lama.map((n) => (n.id === hasil.note.id ? hasil.note : n)));
        snackbar.show({ message: hasil.message, variant: 'ok' });
      } else {
        const hasil = await tambahNotulensi(p.candidate.id, teks);
        onUbahDaftar((lama) => [hasil.note, ...lama]);
        snackbar.show({ message: hasil.message, variant: 'ok' });
      }
      setTulis(null);
    } catch (err) {
      setGalat(pesanGalat(err, 'Notulensi gagal disimpan.'));
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(n: Notulensi): Promise<void> {
    setMenu(null);
    const ok = await dialog.confirm({ title: 'Hapus notulensi ini?', message: 'Hanya penulis yang bisa menghapus. Tindakan ini tidak bisa dibatalkan.', confirmLabel: 'Hapus', destructive: true });
    if (!ok) {
      return;
    }
    try {
      await hapusNotulensi(n.id);
      onUbahDaftar((lama) => lama.filter((x) => x.id !== n.id));
      snackbar.show({ message: 'Notulensi dihapus.', variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Notulensi gagal dihapus.'), variant: 'bad' });
    }
  }

  const tombolTambah = p.can.note ? (
    <Button title="Tambah notulensi…" variant="outline" icon="notebook-pen" onPress={() => setTulis({ note: null })} disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} />
  ) : null;

  return (
    <View style={{ gap: 12 }}>
      {p.notes.length === 0 ? (
        <EmptyState icon="notebook-pen" title="Belum ada notulensi" description="Catat jalannya wawancara dan kesan Anda di sini." variant="plain" />
      ) : (
        p.notes.map((n) => (
          <Card key={n.id} variant="tight" style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={n.author?.name ?? 'Pengguna'} size="sm" />
              <View style={{ flex: 1 }}>
                <Text variant="label">{n.author?.name ?? 'Pengguna'}</Text>
                <Text variant="meta">{`${tanggalPendek(n.created_at)} · ${jam(n.created_at)}${n.edited_at ? ' · diubah' : ''}`}</Text>
              </View>
              {n.can_edit ? <IconButton icon="ellipsis-vertical" label="Menu notulensi" variant="ghost" onPress={() => setMenu(n)} /> : null}
            </View>
            <Text variant="body" selectable>
              {n.body}
            </Text>
          </Card>
        ))
      )}
      {tombolTambah}
      <BottomSheet visible={tulis !== null} onClose={() => setTulis(null)} title={tulis?.note ? 'Ubah notulensi' : 'Tambah notulensi'} scrollable>
        <View style={{ gap: 14 }}>
          <Field label="Notulensi" error={galat} hint={galat ? null : 'Teks polos, maks. 20.000 karakter. Terlihat HR, pewawancara, dan penyetuju lowongan ini.'} counter={`${isi.length} / ${MAKS_NOTULENSI}`}>
            <Input
              value={isi}
              onChangeText={(t) => {
                setIsi(t);
                setGalat(null);
              }}
              multiline
              textAlignVertical="top"
              maxLength={MAKS_NOTULENSI}
              placeholder="Catat jalannya wawancara, kesan, dan tindak lanjut"
              invalid={galat !== null}
              autoFocus
              style={{ minHeight: 140 }}
              accessibilityLabel="Isi notulensi"
            />
          </Field>
          <Button title="Simpan notulensi" onPress={() => void simpan()} loading={sibuk} loadingTitle="Menyimpan…" disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} />
        </View>
      </BottomSheet>
      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)}>
        <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
          <SheetAction
            icon="pencil"
            label="Ubah notulensi"
            onPress={() => {
              const n = menu;
              setMenu(null);
              if (n) {
                setTulis({ note: n });
              }
            }}
          />
        </View>
        <SheetAction icon="trash-2" label="Hapus notulensi" tone="danger" onPress={() => (menu ? void hapus(menu) : undefined)} />
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'flex-start', minHeight: 48 },
});
