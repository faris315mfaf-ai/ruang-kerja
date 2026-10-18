/**
 * Kartu "Tamu eksternal" pada detail rapat video.
 *
 * - Penyelenggara (`manageGuests`): daftar tamu (nama/email, status ruang tunggu),
 *   Bagikan tautan pribadi per tamu, Putar ulang tautan (konfirmasi), Cabut
 *   (konfirmasi), Tambah tamu (email + nama opsional). Undangan HANYA lewat
 *   tautan yang dibagikan sendiri — aplikasi tidak mengirim email/notifikasi ke tamu.
 * - Pengundang lain: hanya ringkasan jumlah tamu + petunjuk bahwa mereka bisa
 *   mengizinkan tamu masuk dari ruang rapat.
 *
 * Tautan = rahasia: tidak pernah ditampilkan utuh, dicatat, atau disimpan; dibagikan
 * lewat sheet Bagikan sistem (`Share`) — paket clipboard belum terpasang di build ini.
 */
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { type TamuRapat } from '@/api/rapatTamu';
import { SheetInput } from '@/features/tugas/Pilihan';
import { tanggalJam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Button, Card, Icon, IconButton, IconTile, Pressable, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import {
  type KemampuanTamu,
  MAKS_NAMA_TAMU,
  labelStatusTamu,
  namaTampilTamu,
  nadaStatusTamu,
  pesanBagikanTautan,
  samarkanTautan,
  tanpaAkhiranTamu,
  tautanTamuSah,
  validasiTamu,
} from './tamu';
import { useTamuRapat } from './useTamuRapat';

const MAKS_INLINE = 4;

interface Props {
  rapatId: string;
  tanggal: string | null;
  judul: string;
  /** "Sel, 13 Okt · 09.00–10.00 WIB" — ikut di teks yang dibagikan. */
  waktuLabel: string;
  kemampuan: KemampuanTamu;
  /** Jumlah baris peserta tanpa akun (dari detail), untuk pengundang non-penyelenggara. */
  jumlahTamu: number;
  /** Buka daftar lengkap otomatis (setelah rapat disimpan dengan tamu). */
  bukaOtomatis?: boolean;
}

export function KartuTamu({ rapatId, tanggal, judul, waktuLabel, kemampuan, jumlahTamu, bukaOtomatis = false }: Props): React.JSX.Element | null {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const tamu = useTamuRapat(rapatId, tanggal, kemampuan.kelola);
  const [lembar, setLembar] = useState<null | 'semua' | 'tambah'>(null);
  const [aksi, setAksi] = useState<TamuRapat | null>(null);
  const sudahBuka = useRef(false);

  const { data, status } = tamu;
  const daftar = data?.guests ?? [];

  useEffect(() => {
    if (bukaOtomatis && !sudahBuka.current && status === 'siap' && daftar.length > 0) {
      sudahBuka.current = true;
      setLembar('semua');
    }
  }, [bukaOtomatis, status, daftar.length]);

  async function bagikan(t: TamuRapat): Promise<void> {
    setAksi(null);
    if (t.link_expired) {
      snackbar.show({ message: 'Tautan ini sudah kedaluwarsa. Putar ulang tautan bila rapat masih berlangsung.', variant: 'warn' });
      return;
    }
    if (!tautanTamuSah(t.link_url)) {
      snackbar.show({ message: 'Tautan tamu belum siap. Muat ulang daftar tamu.', variant: 'warn' });
      void tamu.muat(true);
      return;
    }
    try {
      await Share.share({ message: pesanBagikanTautan({ judul, waktu: waktuLabel, namaTamu: t.name, url: t.link_url }) });
    } catch {
      // Sheet Bagikan ditutup/gagal dibuka — tidak ada yang perlu dilaporkan.
    }
  }

  async function putar(t: TamuRapat): Promise<void> {
    setAksi(null);
    const ok = await dialog.confirm({
      title: `Putar ulang tautan ${namaTampilTamu(t)}?`,
      message: 'Tautan lama langsung mati. Jika tamu sedang berada di ruang rapat, ia dikeluarkan dan harus meminta masuk lagi lewat tautan baru. Bagikan tautan baru itu kepadanya.',
      confirmLabel: 'Putar ulang',
      cancelLabel: 'Batal',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const hasil = await tamu.putar(t.id);
    if (!hasil.ok) {
      snackbar.show({ message: hasil.pesan, variant: hasil.offline ? 'offline' : 'bad' });
      return;
    }
    snackbar.show({ message: 'Tautan baru dibuat. Tautan lama sudah mati.', variant: 'ok', actionLabel: 'Bagikan', onAction: () => void bagikan(hasil.nilai) });
  }

  async function cabut(t: TamuRapat): Promise<void> {
    setAksi(null);
    const ok = await dialog.confirm({
      title: `Cabut ${namaTampilTamu(t)}?`,
      message: 'Tamu dihapus dari rapat ini dan tautannya mati. Jika ia sedang berada di ruang rapat, ia dikeluarkan.',
      confirmLabel: 'Cabut tamu',
      cancelLabel: 'Batal',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const hasil = await tamu.cabut(t.id);
    snackbar.show(hasil.ok ? { message: 'Tamu dicabut.', variant: 'ok' } : { message: hasil.pesan, variant: hasil.offline ? 'offline' : 'bad' });
  }

  // Pengundang lain: hanya ringkasan.
  if (!kemampuan.kelola) {
    if (!kemampuan.ruangTunggu || jumlahTamu === 0) {
      return null;
    }
    return (
      <Card style={{ gap: 8 }}>
        <View style={s.baris}>
          <IconTile icon="users" tone="blue" />
          <Text variant="h3" style={{ flex: 1 }}>
            {`Tamu eksternal (${jumlahTamu})`}
          </Text>
        </View>
        <Text variant="meta">Tamu masuk lewat tautan pribadi dari penyelenggara dan menunggu di ruang tunggu. Saat rapat berlangsung, Anda bisa mengizinkan atau menolaknya dari ruang rapat.</Text>
      </Card>
    );
  }

  if (status === 'terlarang') {
    return null;
  }

  const jendela = data?.window;
  const penuh = data !== null && daftar.length >= data.limit;

  const baris = (t: TamuRapat, divider: boolean): React.JSX.Element => (
    <View key={t.id} style={[s.barisTamu, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
      <Pressable onPress={() => setAksi(t)} accessibilityRole="button" accessibilityLabel={`${namaTampilTamu(t)}, ${labelStatusTamu(t.status, t.status_label)}. Buka pilihan`} style={s.isiBaris}>
        <Avatar name={tanpaAkhiranTamu(namaTampilTamu(t))} size="md" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {namaTampilTamu(t)}
          </Text>
          <Text variant="meta" numberOfLines={1}>
            {t.name ? t.email : 'Tanpa nama'}
          </Text>
          <View style={s.lencana}>
            <Badge tone={nadaStatusTamu(t.status)}>{labelStatusTamu(t.status, t.status_label)}</Badge>
            {t.in_room ? <Badge tone="success">Di ruang</Badge> : null}
            {t.link_expired ? <Badge tone="danger">Tautan kedaluwarsa</Badge> : null}
          </View>
        </View>
      </Pressable>
      <IconButton icon="share-2" label={`Bagikan tautan ${namaTampilTamu(t)}`} variant="outline" size={44} onPress={() => void bagikan(t)} />
    </View>
  );

  return (
    <>
      <Card style={{ gap: 10 }}>
        <View style={s.baris}>
          <IconTile icon="users" tone="blue" />
          <View style={{ flex: 1 }}>
            <Text variant="h3">Tamu eksternal</Text>
            <Text variant="meta">{daftar.length > 0 ? `${daftar.length} tamu · maksimal ${data?.limit ?? 30}` : 'Undang orang di luar perusahaan'}</Text>
          </View>
          <Button title="Tambah" icon="user-plus" size="sm" variant="tonal" onPress={() => setLembar('tambah')} disabled={penuh} disabledReason={penuh ? `Maksimal ${data?.limit ?? 30} tamu per rapat` : undefined} />
        </View>
        <Text variant="meta">Tamu masuk lewat tautan pribadi di peramban, tanpa aplikasi. Bagikan tautannya sendiri; aplikasi tidak mengirim email ke tamu. Penyelenggara dan peserta mengizinkan tamu masuk dari ruang tunggu.</Text>

        {jendela?.state === 'closed' ? (
          <Banner tone="warn" icon="clock" message="Jendela gabung rapat ini sudah tutup. Tautan tamu tidak lagi bisa dipakai masuk." />
        ) : jendela?.state === 'early' ? (
          <Banner tone="info" icon="clock" message={`Ruang tunggu tamu dibuka mulai ${tanggalJam(jendela.opens_at)}.`} />
        ) : null}

        {status === 'memuat' || status === 'diam' ? <Text variant="meta">Memuat daftar tamu…</Text> : null}
        {status === 'offline' ? <Banner tone="neutral" icon="cloud-off" message="Butuh koneksi — daftar tamu memuat tautan pribadi sehingga tidak disimpan di HP." actionLabel="Coba lagi" onAction={() => void tamu.muat()} /> : null}
        {status === 'galat' ? <Banner tone="bad" message={tamu.galat ?? 'Daftar tamu tidak dapat dimuat.'} actionLabel="Coba lagi" onAction={() => void tamu.muat()} /> : null}
        {status === 'siap' && daftar.length === 0 ? <Text variant="body" tone="muted">Belum ada tamu. Tambahkan email tamu untuk membuat tautan pribadinya.</Text> : null}

        {daftar.slice(0, MAKS_INLINE).map((t, i) => baris(t, i > 0))}
        {daftar.length > MAKS_INLINE ? <Button title={`Kelola semua tamu (${daftar.length})`} variant="quiet" onPress={() => setLembar('semua')} /> : null}
      </Card>

      <BottomSheet visible={lembar === 'semua' && aksi === null} onClose={() => setLembar(null)} title={`Tamu eksternal (${daftar.length})`} showClose scrollable snapPoints={['70%', '92%']}>
        <Text variant="meta">Ketuk tamu untuk putar ulang tautan atau mencabut. Ikon bagikan membuka sheet Bagikan sistem (di sana juga ada Salin).</Text>
        {daftar.map((t, i) => baris(t, i > 0))}
        <Button title="Tambah tamu" icon="user-plus" variant="tonal" onPress={() => setLembar('tambah')} disabled={penuh} />
      </BottomSheet>

      <BottomSheet visible={aksi !== null} onClose={() => setAksi(null)}>
        {aksi ? (
          <>
            <View style={s.baris}>
              <Avatar name={tanpaAkhiranTamu(namaTampilTamu(aksi))} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="title">{namaTampilTamu(aksi)}</Text>
                <Text variant="meta">{aksi.email}</Text>
                <Text variant="meta">{`${labelStatusTamu(aksi.status, aksi.status_label)}${aksi.link_expires_at ? ` · tautan berlaku sampai ${tanggalJam(aksi.link_expires_at)}` : ''}`}</Text>
              </View>
            </View>
            <Text variant="meta" tone="subtle">{`Tautan pribadi: ${samarkanTautan(aksi.link_url)}`}</Text>
            <SheetAction icon="share-2" label="Bagikan tautan" description="Buka sheet Bagikan sistem (Salin, WhatsApp, dan lainnya)" onPress={() => void bagikan(aksi)} />
            <SheetAction icon="refresh-cw" label="Putar ulang tautan" description="Tautan lama mati, tamu di ruang dikeluarkan" onPress={() => void putar(aksi)} />
            <SheetAction icon="trash-2" label="Cabut tamu" tone="danger" onPress={() => void cabut(aksi)} />
          </>
        ) : null}
      </BottomSheet>

      <SheetTambahTamu
        visible={lembar === 'tambah'}
        onClose={() => setLembar(null)}
        jumlahTamu={daftar.length}
        onTambah={async (email, nama) => {
          const hasil = await tamu.tambah(email, nama);
          if (!hasil.ok) {
            return hasil.pesan;
          }
          setLembar(null);
          const { guest, baru } = hasil.nilai;
          snackbar.show({
            message: baru ? `${namaTampilTamu(guest)} ditambahkan. Bagikan tautannya kepada tamu.` : 'Email itu sudah terdaftar; tautannya tidak berubah.',
            variant: 'ok',
            actionLabel: 'Bagikan',
            onAction: () => void bagikan(guest),
          });
          return null;
        }}
      />
    </>
  );
}

function SheetTambahTamu({
  visible,
  onClose,
  jumlahTamu,
  onTambah,
}: {
  visible: boolean;
  onClose: () => void;
  jumlahTamu: number;
  /** Mengembalikan pesan galat (tampil di sheet) atau null bila berhasil. */
  onTambah: (email: string, nama: string | null) => Promise<string | null>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [galat, setGalat] = useState<{ email: string | null; nama: string | null; umum: string | null }>({ email: null, nama: null, umum: null });
  const [mengirim, setMengirim] = useState(false);

  useEffect(() => {
    if (!visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kosongkan isian saat sheet ditutup
      setEmail('');
      setNama('');
      setGalat({ email: null, nama: null, umum: null });
    }
  }, [visible]);

  async function kirim(): Promise<void> {
    const v = validasiTamu(email, nama, jumlahTamu);
    setGalat({ email: v.galatEmail, nama: v.galatNama, umum: null });
    if (!v.valid) {
      return;
    }
    setMengirim(true);
    try {
      const pesan = await onTambah(v.email, v.nama);
      if (pesan !== null) {
        setGalat({ email: null, nama: null, umum: pesan });
      }
    } finally {
      setMengirim(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tambah tamu eksternal" showClose>
      <Text variant="meta">Tamu menerima tautan pribadi yang Anda bagikan sendiri. Email dipakai sebagai identitas undangan; aplikasi tidak mengirim email ke tamu.</Text>
      <View style={{ gap: 6 }}>
        <Text variant="label">Email tamu</Text>
        <SheetInput value={email} onChangeText={setEmail} placeholder="nama@perusahaan-mitra.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" invalid={galat.email !== null} accessibilityLabel="Email tamu" maxLength={190} />
        {galat.email ? <Text variant="meta" tone="danger" accessibilityRole="alert">{galat.email}</Text> : null}
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="label">Nama tamu (opsional)</Text>
        <SheetInput value={nama} onChangeText={setNama} placeholder="Mis. Budi Mitra" autoCapitalize="words" invalid={galat.nama !== null} accessibilityLabel="Nama tamu" maxLength={MAKS_NAMA_TAMU} />
        {galat.nama ? <Text variant="meta" tone="danger" accessibilityRole="alert">{galat.nama}</Text> : <Text variant="meta">Nama terisi di halaman tamu; tamu tetap bisa mengubahnya sebelum meminta masuk. Di ruang tampil sebagai “Nama (Tamu)”.</Text>}
      </View>
      {galat.umum ? (
        <View style={[s.baris, { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12 }]} accessibilityRole="alert">
          <Icon name="circle-alert" size={18} color={colors.danger} />
          <Text variant="meta" tone="danger" style={{ flex: 1 }}>
            {galat.umum}
          </Text>
        </View>
      ) : null}
      <Button title="Tambah tamu" icon="user-plus" loading={mengirim} loadingTitle="Menambahkan…" onPress={() => void kirim()} />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barisTamu: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 72, paddingVertical: 8 },
  isiBaris: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  lencana: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
