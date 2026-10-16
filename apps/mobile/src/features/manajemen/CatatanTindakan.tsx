/**
 * Catatan tindakan pribadi Direksi/HR/Super Admin (mockup 06 › 19; N1–N6):
 * tambah (teks + tenggat opsional), daftar terbuka sesuai urutan pengguna,
 * tenggat lewat = merah, aksi per catatan (Ubah · Selesai/Buka lagi · Naikkan
 * · Turunkan · Hapus + Urungkan sisi aplikasi), bagian "Selesai" dilipat.
 * Urutan lewat Naikkan/Turunkan (tanpa seret, keputusan pemilik).
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatCatatanTindakan, daftarCatatanTindakan, hapusCatatanTindakan, pindahCatatanTindakan, ubahCatatanTindakan, type CatatanTindakan as Catatan } from '@/api/manajemen';
import { hariTanggal } from '@/features/proyek/format';
import { pesanGalat, useTundaKirim } from '@/features/proyek/tunda';
import { useTheme } from '@/theme';
import { BottomSheet, Button, Checkbox, DateInput, EmptyState, ErrorState, Field, IconButton, Input, Loading, Pressable, SheetAction, Text, useSnackbar } from '@/ui';

export function CatatanTindakanDaftar({
  awal,
  batasTerbuka,
  offline = false,
  onSemua,
}: {
  /** Catatan dari `GET /manajemen` (M1); tanpa ini komponen memuat N1 sendiri. */
  awal?: Catatan[];
  /** Tampilkan maks. N catatan terbuka (ringkasan dashboard) + tautan Semua. */
  batasTerbuka?: number;
  offline?: boolean;
  onSemua?: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const tunda = useTundaKirim();
  const [notes, setNotes] = useState<Catatan[] | null>(awal ?? null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [teks, setTeks] = useState('');
  const [tenggat, setTenggat] = useState('');
  const [galatTambah, setGalatTambah] = useState<string | null>(null);
  const [menambah, setMenambah] = useState(false);
  const [sheetTenggat, setSheetTenggat] = useState(false);
  const [menu, setMenu] = useState<Catatan | null>(null);
  const [ubah, setUbah] = useState<{ n: Catatan; body: string; due: string } | null>(null);
  const [lipatSelesai, setLipatSelesai] = useState(true);
  const [tersembunyi, setTersembunyi] = useState<Set<string>>(new Set());

  const muat = useCallback(async (): Promise<void> => {
    try {
      const r = await daftarCatatanTindakan();
      setNotes(r.notes);
      setGalatMuat(null);
    } catch (err) {
      setGalatMuat(pesanGalat(err, 'Catatan tindakan gagal dimuat.'));
    }
  }, []);

  useEffect(() => {
    if (awal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron dengan data dashboard terbaru
      setNotes(awal);
    } else {
      void muat();
    }
  }, [awal, muat]);

  const ganti = (n: Catatan): void => setNotes((l) => (l ? l.map((x) => (x.id === n.id ? n : x)) : l));

  const tambah = async (): Promise<void> => {
    const isi = teks.trim();
    if (isi === '') {
      setGalatTambah('Tulis catatan tindakan.');
      return;
    }
    setMenambah(true);
    try {
      const n = await buatCatatanTindakan(isi, tenggat === '' ? null : tenggat);
      setNotes((l) => [n, ...(l ?? [])]);
      setTeks('');
      setTenggat('');
      setGalatTambah(null);
    } catch (err) {
      setGalatTambah(err instanceof ApiError && err.status === 422 ? (err.firstValidationError ?? err.message) : pesanGalat(err, 'Catatan gagal disimpan.'));
    } finally {
      setMenambah(false);
    }
  };

  const centang = async (n: Catatan): Promise<void> => {
    const sebelum = n;
    ganti({ ...n, done: !n.done, done_at: n.done ? null : new Date().toISOString(), overdue: false });
    try {
      const baru = await ubahCatatanTindakan(n.id, { done: !n.done });
      // dibuka lagi → paling bawah daftar terbuka (urutan server): muat ulang daftar penuh
      if (!baru.done) void muat();
      else ganti(baru);
    } catch (err) {
      ganti(sebelum);
      snackbar.show({ message: pesanGalat(err, 'Catatan gagal diubah.'), variant: 'bad' });
    }
  };

  const pindah = async (n: Catatan, arah: 'naik' | 'turun'): Promise<void> => {
    try {
      setNotes(await pindahCatatanTindakan(n.id, arah));
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Urutan gagal diubah.'), variant: 'bad' });
    }
  };

  const simpanUbah = async (): Promise<void> => {
    if (!ubah) return;
    if (ubah.body.trim() === '') {
      snackbar.show({ message: 'Tulis catatan tindakan.', variant: 'warn' });
      return;
    }
    try {
      ganti(await ubahCatatanTindakan(ubah.n.id, { body: ubah.body.trim(), due_on: ubah.due === '' ? null : ubah.due }));
      setUbah(null);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Catatan gagal disimpan.'), variant: 'bad' });
    }
  };

  const hapus = (n: Catatan): void => {
    setTersembunyi((s) => new Set(s).add(n.id));
    tunda({
      pesan: 'Catatan dihapus.',
      kirim: () => hapusCatatanTindakan(n.id),
      pulihkan: () => setTersembunyi((s) => { const b = new Set(s); b.delete(n.id); return b; }),
      selesai: () => setNotes((l) => (l ? l.filter((x) => x.id !== n.id) : l)),
    });
  };

  if (notes === null) {
    return galatMuat ? <ErrorState message={galatMuat} kind="umum" onRetry={() => void muat()} /> : <Loading rows={3} label="Memuat catatan tindakan…" />;
  }

  const terlihat = notes.filter((n) => !tersembunyi.has(n.id));
  const terbuka = terlihat.filter((n) => !n.done);
  const selesai = terlihat.filter((n) => n.done);
  const tampilTerbuka = batasTerbuka ? terbuka.slice(0, batasTerbuka) : terbuka;

  const baris = (n: Catatan, i: number, daftar: Catatan[]): React.JSX.Element => (
    <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.divider }}>
      <Checkbox checked={n.done} onChange={() => void centang(n)} disabled={offline} style={{ paddingRight: 4 }} />
      <Pressable scaleTo={1} style={{ flex: 1, paddingVertical: 8 }} onPress={() => setMenu(n)} accessibilityRole="button" accessibilityLabel={`${n.body}${n.due_on ? `, tenggat ${hariTanggal(n.due_on)}` : ''}${n.overdue ? ', lewat tenggat' : ''}. Buka aksi.`} accessibilityHint={`${i + 1} dari ${daftar.length}`}>
        <Text variant="body" style={{ fontSize: 16, textDecorationLine: n.done ? 'line-through' : 'none' }} tone={n.done ? 'muted' : 'text'}>
          {n.body}
        </Text>
        {n.due_on ? (
          <Text variant="meta" tone={n.overdue ? 'danger' : 'muted'}>
            {`${n.overdue ? 'Lewat · ' : ''}${hariTanggal(n.due_on)}`}
          </Text>
        ) : null}
      </Pressable>
      <IconButton icon="ellipsis-vertical" label={`Aksi catatan ${n.body}`} variant="ghost" size={44} onPress={() => setMenu(n)} />
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      <Text variant="meta">{`Hanya terlihat oleh Anda · ${terbuka.length} terbuka`}</Text>
      <Field label="Tambah catatan" error={galatTambah} counter={teks.length > 400 ? `${teks.length}/500` : undefined}>
        <Input
          value={teks}
          onChangeText={(v) => {
            setTeks(v);
            setGalatTambah(null);
          }}
          maxLength={500}
          placeholder="Tambah hal yang perlu dilakukan…"
          returnKeyType="done"
          onSubmitEditing={() => void tambah()}
          disabled={offline}
          accessibilityLabel="Catatan tindakan baru"
        />
      </Field>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Button title={tenggat ? hariTanggal(tenggat) : 'Tenggat'} variant="outline" size="sm" icon="calendar" onPress={() => setSheetTenggat(true)} disabled={offline} style={{ flex: 1 }} />
        <Button title="Tambah" size="sm" icon="plus" loading={menambah} onPress={() => void tambah()} disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} style={{ flex: 1 }} />
      </View>
      {terbuka.length === 0 && selesai.length === 0 ? (
        <EmptyState variant="plain" icon="list-todo" title="Belum ada catatan tindakan" description="Catat hal yang perlu Anda putuskan atau tindak lanjuti." />
      ) : (
        <View>{tampilTerbuka.map((n, i) => baris(n, i, terbuka))}</View>
      )}
      {batasTerbuka && terbuka.length > batasTerbuka && onSemua ? <Button title={`Semua catatan (${terbuka.length})`} variant="quiet" size="sm" onPress={onSemua} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}
      {selesai.length > 0 ? (
        <View>
          <Button title={`${lipatSelesai ? 'Tampilkan' : 'Sembunyikan'} selesai (${selesai.length})`} variant="quiet" size="sm" icon={lipatSelesai ? 'chevron-down' : 'chevron-up'} onPress={() => setLipatSelesai((v) => !v)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          {!lipatSelesai ? selesai.map((n, i) => baris(n, i, selesai)) : null}
        </View>
      ) : null}

      <BottomSheet visible={sheetTenggat} onClose={() => setSheetTenggat(false)} title="Tenggat catatan" showClose>
        <View style={{ gap: 16 }}>
          <DateInput label="Tenggat" value={tenggat} onChange={setTenggat} hint="Opsional" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Tanpa tenggat" variant="outline" style={{ flex: 1 }} onPress={() => { setTenggat(''); setSheetTenggat(false); }} />
            <Button title="Pakai" style={{ flex: 1.4 }} onPress={() => setSheetTenggat(false)} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title="Catatan tindakan">
        {menu ? (
          <>
            <Text variant="body" style={{ paddingHorizontal: 4, paddingBottom: 8 }} numberOfLines={3}>
              {menu.body}
            </Text>
            <SheetAction icon="pencil" label="Ubah" onPress={() => { const n = menu; setMenu(null); setUbah({ n, body: n.body, due: n.due_on ?? '' }); }} />
            <SheetAction icon={menu.done ? 'rotate-ccw' : 'circle-check'} label={menu.done ? 'Buka lagi' : 'Tandai selesai'} onPress={() => { const n = menu; setMenu(null); void centang(n); }} />
            {!menu.done ? (
              <>
                <SheetAction icon="arrow-up" label="Naikkan" onPress={() => { const n = menu; setMenu(null); void pindah(n, 'naik'); }} />
                <SheetAction icon="arrow-down" label="Turunkan" onPress={() => { const n = menu; setMenu(null); void pindah(n, 'turun'); }} />
              </>
            ) : null}
            <SheetAction icon="trash-2" label="Hapus" tone="danger" onPress={() => { const n = menu; setMenu(null); hapus(n); }} />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={ubah !== null} onClose={() => setUbah(null)} title="Ubah catatan" showClose>
        {ubah ? (
          <View style={{ gap: 16 }}>
            <Field label="Catatan" required counter={`${ubah.body.length}/500`}>
              <Input value={ubah.body} onChangeText={(v) => setUbah({ ...ubah, body: v })} multiline maxLength={500} accessibilityLabel="Isi catatan" />
            </Field>
            <DateInput label="Tenggat" value={ubah.due} onChange={(v) => setUbah({ ...ubah, due: v })} hint="Kosongkan untuk tanpa tenggat" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => setUbah(null)} />
              <Button title="Simpan" icon="check" style={{ flex: 1.4 }} onPress={() => void simpanUbah()} />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
