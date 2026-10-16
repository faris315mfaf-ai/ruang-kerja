/**
 * Tab Anggota (mockup 05 › 19-5, 19-6): peran + status "Akses Drive", ubah
 * peran / keluarkan (sheet), tambah anggota (kandidat). Kontrol kelola hanya
 * untuk owner/admin (`can.manage_members`); selain itu daftar baca saja.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  ambilAnggotaWorkspace,
  cariKandidatAnggota,
  keluarkanAnggota,
  tambahAnggota,
  ubahPeranAnggota,
  type AnggotaBaris,
  type AnggotaData,
  type DetailWorkspace,
  type KandidatAnggota,
} from '@/api/workspace';
import { useTheme } from '@/theme';
import { Avatar, Badge, BottomSheet, Button, Card, Chip, ChipScroller, EmptyState, Icon, Loading, Pressable, Radio, SearchInput, SheetAction, Text, useDialog, useSnackbar, type Tone } from '@/ui';

import { GalatMuat, PitaOffline, TabScroll } from './bagian';
import { useResource } from './useResource';

const DESKRIPSI_PERAN: Record<string, string> = {
  owner: 'Pemilik workspace',
  admin: 'Mengatur anggota dan pengaturan',
  member: 'Membuat dan mengubah tugas',
  viewer: 'Hanya melihat',
};

const NADA_DRIVE: Record<AnggotaBaris['drive_access']['status'], Tone> = {
  tersinkron: 'success',
  menunggu: 'warning',
  gagal: 'danger',
  akun_nonaktif: 'neutral',
  drive_belum_aktif: 'neutral',
};

function subjudul(a: AnggotaBaris): string {
  return [a.role_label, a.division ?? a.position].filter(Boolean).join(' · ');
}

export function AnggotaTab({ detail }: { detail: DetailWorkspace }): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const dialog = useDialog();
  const ws = detail.workspace.id;
  const agt = useResource<AnggotaData>(`anggota-penuh:${ws}`, () => ambilAnggotaWorkspace(ws));
  const [terpilih, setTerpilih] = useState<AnggotaBaris | null>(null);
  const [tambah, setTambah] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const data = agt.data;
  const kelola = data?.can.manage_members === true && !detail.read_only.read_only;
  const driveAktif = detail.drive.enabled;

  function tampilkanGalat(err: unknown, cadangan: string): void {
    snackbar.show({ message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : cadangan, variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
  }

  async function ubahPeran(a: AnggotaBaris, role: string): Promise<void> {
    if (sibuk || role === a.role) {
      return;
    }
    setSibuk(true);
    try {
      const h = await ubahPeranAnggota(ws, a.id, role);
      setTerpilih(null);
      snackbar.show({ message: h.message, variant: 'ok' });
      await agt.muat();
    } catch (err) {
      tampilkanGalat(err, 'Peran gagal diubah.');
    } finally {
      setSibuk(false);
    }
  }

  async function keluarkan(a: AnggotaBaris): Promise<void> {
    setTerpilih(null);
    const ya = await dialog.confirm({
      title: `Keluarkan ${a.name}?`,
      message: 'Ia tidak lagi bisa melihat atau mengubah tugas di workspace ini, dan akses folder Drive-nya dicabut.',
      confirmLabel: 'Keluarkan',
      destructive: true,
    });
    if (!ya) {
      return;
    }
    try {
      const h = await keluarkanAnggota(ws, a.id);
      snackbar.show({ message: h.message, variant: 'ok' });
      await agt.muat();
    } catch (err) {
      tampilkanGalat(err, 'Anggota gagal dikeluarkan.');
    }
  }

  if (agt.memuat && !data) {
    return (
      <TabScroll>
        <Loading label="Memuat anggota…" rows={5} />
      </TabScroll>
    );
  }
  if (agt.galat && !data) {
    return <GalatMuat galat={agt.galat} judul="Anggota belum bisa dimuat" onCoba={() => void agt.muat()} />;
  }
  if (!data) {
    return <View />;
  }

  return (
    <TabScroll onRefresh={agt.muat}>
      {agt.offline ? <PitaOffline diperbarui={agt.diperbarui} objek="daftar" /> : null}
      <View style={s.kepala}>
        <Text variant="overline" tone="muted" style={{ flex: 1 }}>
          {`${data.anggota.length} ANGGOTA`}
        </Text>
        {kelola ? <Button title="Tambah" icon="user-plus" variant="tonal" size="sm" onPress={() => setTambah(true)} /> : null}
      </View>

      {data.anggota.length === 0 ? (
        <EmptyState icon="users" title="Belum ada anggota" />
      ) : (
        <Card variant="flat">
          {data.anggota.map((a, i) => {
            const bisa = kelola && (a.can_change_role || a.can_remove);
            const isi = (
              <>
                <Avatar name={a.name} size="md" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title" numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
                    {subjudul(a)}
                  </Text>
                </View>
                {driveAktif && a.drive_access.status !== 'drive_belum_aktif' ? <Badge tone={NADA_DRIVE[a.drive_access.status]}>{a.drive_access.label}</Badge> : null}
                {bisa ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null}
              </>
            );
            const gaya = [s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null];
            return bisa ? (
              <Pressable key={a.id} onPress={() => setTerpilih(a)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${a.name}. ${subjudul(a)}. Akses Drive ${a.drive_access.label}. Ketuk untuk mengubah peran`} style={gaya}>
                {isi}
              </Pressable>
            ) : (
              <View key={a.id} style={gaya} accessible accessibilityLabel={`${a.name}. ${subjudul(a)}${driveAktif ? `. Akses Drive ${a.drive_access.label}` : ''}`}>
                {isi}
              </View>
            );
          })}
        </Card>
      )}
      {driveAktif ? (
        <Text variant="meta">Status “Akses Drive” per anggota: Tersinkron · Menunggu sinkron · Gagal sinkron.</Text>
      ) : (
        <Text variant="meta">Status akses Drive tampil setelah integrasi Google Drive diaktifkan.</Text>
      )}
      {!kelola ? <Text variant="meta">Hanya Owner/Admin yang bisa mengatur anggota. Anggota workspace Divisi disinkron otomatis dari divisi.</Text> : null}

      <BottomSheet visible={terpilih !== null} onClose={() => setTerpilih(null)} title={terpilih?.name ?? 'Anggota'} scrollable>
        {terpilih ? (
          <>
            <Text variant="meta">{`${subjudul(terpilih)}${driveAktif ? ` · akses Drive ${terpilih.drive_access.label.toLowerCase()}` : ''}`}</Text>
            {terpilih.can_change_role ? (
              <View style={{ gap: 2 }}>
                <Text variant="overline" tone="muted">
                  PERAN DI WORKSPACE
                </Text>
                {data.role_options.map((o) => (
                  <Radio key={o.value} selected={terpilih.role === o.value} label={o.label} description={DESKRIPSI_PERAN[o.value]} disabled={sibuk} onSelect={() => void ubahPeran(terpilih, o.value)} />
                ))}
              </View>
            ) : (
              <Text variant="meta">Peran anggota ini tidak bisa diubah di sini.</Text>
            )}
            {terpilih.can_remove ? <SheetAction icon="user-minus" label="Keluarkan dari workspace" tone="danger" onPress={() => void keluarkan(terpilih)} /> : null}
            <Text variant="meta">Hanya Owner/Admin. Anggota workspace Divisi disinkron otomatis dari divisi.</Text>
          </>
        ) : null}
      </BottomSheet>

      <TambahAnggotaSheet visible={tambah} ws={ws} peran={data.role_options} onClose={() => setTambah(false)} onDitambah={(pesan) => { snackbar.show({ message: pesan, variant: 'ok' }); void agt.muat(); }} />
    </TabScroll>
  );
}

function TambahAnggotaSheet({ visible, ws, peran, onClose, onDitambah }: { visible: boolean; ws: string; peran: { value: string; label: string }[]; onClose: () => void; onDitambah: (pesan: string) => void }): React.JSX.Element {
  const snackbar = useSnackbar();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('member');
  const [hasil, setHasil] = useState<KandidatAnggota[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const serial = useRef(0);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const t = setTimeout(
      () => {
        const id = ++serial.current;
        setMemuat(true);
        setGalat(null);
        cariKandidatAnggota(ws, q)
          .then((h) => {
            if (id === serial.current) {
              setHasil(h);
            }
          })
          .catch((err: unknown) => {
            if (id === serial.current) {
              setGalat(err instanceof ApiError ? err.message : 'Pencarian gagal.');
            }
          })
          .finally(() => {
            if (id === serial.current) {
              setMemuat(false);
            }
          });
      },
      q === '' ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [visible, q, ws]);

  async function pilih(k: KandidatAnggota): Promise<void> {
    setSibuk(k.id);
    try {
      const h = await tambahAnggota(ws, k.id, role);
      setHasil((l) => l.filter((x) => x.id !== k.id));
      onDitambah(h.message);
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Anggota gagal ditambahkan.', variant: 'bad' });
    } finally {
      setSibuk(null);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tambah anggota" scrollable>
      <SearchInput value={q} onChangeText={setQ} placeholder="Cari nama atau email karyawan" />
      <View style={{ gap: 6 }}>
        <Text variant="overline" tone="muted">
          PERAN
        </Text>
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          {peran.map((p) => (
            <Chip key={p.value} label={p.label} selected={role === p.value} onPress={() => setRole(p.value)} />
          ))}
        </ChipScroller>
        <Text variant="meta">{DESKRIPSI_PERAN[role] ?? ''}</Text>
      </View>
      {memuat && hasil.length === 0 ? <Loading rows={3} label="Mencari…" /> : null}
      {galat ? <Text variant="meta" tone="danger">{galat}</Text> : null}
      {!memuat && !galat && hasil.length === 0 ? <Text variant="meta">Tidak ada karyawan yang cocok, atau semua sudah menjadi anggota.</Text> : null}
      {hasil.map((k) => (
        <Pressable key={k.id} onPress={() => void pilih(k)} disabled={sibuk !== null} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`Tambahkan ${k.name}`} style={s.kandidat}>
          <Avatar name={k.name} size="md" />
          <View style={{ flex: 1 }}>
            <Text variant="title" numberOfLines={1}>
              {k.name}
            </Text>
            <Text variant="meta" numberOfLines={1}>
              {k.division ?? k.email}
            </Text>
          </View>
          {sibuk === k.id ? <Text variant="meta">Menambah…</Text> : <Icon name="user-plus" size={20} />}
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 72 },
  kandidat: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 6 },
});
